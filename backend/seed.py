import os
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import psycopg2
from psycopg2.extras import Json
import numpy as np
from typing import List, Dict, Any, Tuple
import io
import requests
from dotenv import load_dotenv

# Load environment variables (override to ensure fresh read in reseed scenarios)
load_dotenv(override=True)

def _sanitize_key(raw: str) -> str:
    if raw is None:
        raise ValueError("ENCRYPTION_KEY missing in environment")
    key = raw.strip()
    if len(key) >= 2 and ((key[0] == '"' and key[-1] == '"') or (key[0] == "'" and key[-1] == "'")):
        key = key[1:-1].strip()
    if not key:
        raise ValueError("ENCRYPTION_KEY empty after sanitization")
    return key

# Constants
DB_URL = os.getenv("DATABASE_URL")
ENCRYPTION_KEY = _sanitize_key(os.getenv("ENCRYPTION_KEY"))
OLLAMA_EMBED_MODEL = "nomic-embed-text"
PDF_DIRECTORY = "./demo_reports/"  # Root containing subdirectories like 'oncology', 'speech_hearing'

if not DB_URL or not ENCRYPTION_KEY:
    raise ValueError("DATABASE_URL and ENCRYPTION_KEY must be set in .env file")

# Configure chunk sizes
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100

def get_db_connection():
    """Establish and return a database connection."""
    try:
        conn = psycopg2.connect(DB_URL)
        return conn
    except psycopg2.Error as e:
        print(f"Error connecting to database: {e}")
        raise

def extract_text_from_pdf(file_path: str) -> List[Tuple[str, int]]:
    """
    Extract text from a PDF file using PyMuPDF first, falling back to Tesseract OCR if needed.
    Returns a list of (text, page_number) tuples.
    """
    try:
        # Try PyMuPDF first
        doc = fitz.open(file_path)
        pages_text = []
        
        for page_num, page in enumerate(doc, 1):
            text = page.get_text().strip()
            pages_text.append((text, page_num))
        doc.close()

        # If all pages have very little text, fall back to OCR
        if all(len(text) < 100 for text, _ in pages_text):  # Arbitrary threshold
            return extract_text_with_ocr(file_path)
        
        return pages_text
    except Exception as e:
        print(f"Error extracting text from PDF {file_path}: {e}")
        return extract_text_with_ocr(file_path)

def extract_text_with_ocr(file_path: str) -> List[Tuple[str, int]]:
    """
    Extract text using Tesseract OCR as a fallback method.
    Returns a list of (text, page_number) tuples.
    """
    try:
        doc = fitz.open(file_path)
        pages_text = []
        
        for page_num, page in enumerate(doc, 1):
            # Convert PDF page to image
            pix = page.get_pixmap()
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Use Tesseract OCR
            text = pytesseract.image_to_string(img).strip()
            pages_text.append((text, page_num))
        
        doc.close()
        return pages_text
    except Exception as e:
        print(f"OCR extraction failed for {file_path}: {e}")
        return []

def chunk_text(pages_text: List[Tuple[str, int]]) -> List[Tuple[str, Dict[str, int]]]:
    """
    Split text into chunks with overlap, preserving page information.
    Returns a list of (chunk_text, metadata) tuples.
    """
    chunks = []
    
    for page_text, page_num in pages_text:
        start = 0
        chunk_index = 0
        
        while start < len(page_text):
            end = start + CHUNK_SIZE
            
            # Adjust chunk end to not break words
            if end < len(page_text):
                # Try to find a space to break at
                while end > start and page_text[end] != ' ':
                    end -= 1
                if end == start:  # If no space found, just break at CHUNK_SIZE
                    end = start + CHUNK_SIZE
            
            chunk = page_text[start:end].strip()
            if chunk:  # Only add non-empty chunks
                metadata = {
                    'page': page_num,
                    'chunk_index': chunk_index
                }
                chunks.append((chunk, metadata))
                chunk_index += 1
            
            start = end - CHUNK_OVERLAP
    
    return chunks

def get_embedding(text: str) -> List[float]:
    """
    Get vector embedding using Ollama REST API.
    """
    response = requests.post(
        "http://localhost:11434/api/embed",
        json={"model": OLLAMA_EMBED_MODEL, "input": text}
    )
    if response.status_code != 200:
        raise Exception(f"Failed to get embedding: {response.text}")
    
    data = response.json()
    # Handle both 'embedding' and 'embeddings' response formats
    if 'embedding' in data:
        return data['embedding']
    elif 'embeddings' in data:
        return data['embeddings'][0] if isinstance(data['embeddings'], list) else data['embeddings']
    else:
        raise Exception(f"Unexpected embed response format: {data.keys()}")

def infer_report_type(file_path: str) -> str:
    """Infer report type using both filename and directory context.
    Directory signals act as strong defaults with keyword refinement.
    - speech_hearing/: defaults to 'Speech Therapy' unless audiology keyword present
    - oncology/: radiology/pathology keywords first; else 'Oncology Report'
    Otherwise fall back to filename keyword heuristics.
    """
    filename = os.path.basename(file_path)
    lower_fp = file_path.lower()
    lower_name = filename.lower()

    # Speech / Hearing directory logic
    if 'speech_hearing' in lower_fp:
        if 'audio' in lower_name or 'audiology' in lower_name:
            return 'Audiology'
        # Default when no specific audiology keyword
        return 'Speech Therapy'

    # Oncology directory logic
    if 'oncology' in lower_fp:
        if any(k in lower_name for k in ['mri', 'ct', 'xray', 'radiology', 'imaging']):
            return 'Radiology'
        if any(k in lower_name for k in ['path', 'biopsy', 'histology']):
            return 'Pathology'
        return 'Oncology Report'

    # Generic filename-based inference
    if any(k in lower_name for k in ['mri', 'ct', 'xray', 'radiology', 'imaging']):
        return 'Radiology'
    if any(k in lower_name for k in ['path', 'biopsy', 'histology']):
        return 'Pathology'
    if any(k in lower_name for k in ['lab', 'blood', 'cbc']):
        return 'Laboratory'
    if any(k in lower_name for k in ['discharge', 'summary']):
        return 'Clinical Summary'
    return 'General'

def main():
    # Connect to database
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Clear existing data
        cur.execute("TRUNCATE patients, reports, report_chunks CASCADE;")
        
        # Map patients to their reports (filename -> patient assignment)
        # This allows multiple PDFs to belong to the same demo patient
        patient_report_mapping = {}
        
        # Scan all PDFs (including subdirectories) and build patient mapping
        pdf_files = []
        for root, _dirs, files in os.walk(PDF_DIRECTORY):
            for f in files:
                if f.lower().endswith('.pdf'):
                    pdf_files.append(os.path.join(root, f))
        
        # Strategy: group by base name before first underscore or number
        # For demo purposes, we'll create logical patient groupings:
        # If files share a common prefix (before _ or before trailing digits), group them under same patient
        import re
        def extract_patient_key_and_display(base: str) -> Tuple[str, str]:
            original = base
            # Normalize underscores to spaces
            cleaned = original.replace('_', ' ').strip()
            # Remove trailing digits
            cleaned = re.sub(r'\d+$', '', cleaned).strip()
            # Remove common trailing tokens (e.g., Report, MRI) if they appear at end
            cleaned = re.sub(r'(?:report|summary|mri|ct|xray)$', '', cleaned, flags=re.IGNORECASE).strip()
            # Collapse multiple spaces
            cleaned = re.sub(r'\s+', ' ', cleaned)
            if not cleaned:
                cleaned = original
            display = cleaned.title()
            # patient_key: slugify (lowercase, remove non-alnum except space -> underscore)
            slug = re.sub(r'[^a-z0-9 ]+', '', display.lower())
            slug = re.sub(r'\s+', '_', slug).strip('_')
            if not slug:
                slug = original.lower()
            return slug, display

        for file_path in pdf_files:
            filename = os.path.basename(file_path)
            base = os.path.splitext(filename)[0]
            patient_key, display_name = extract_patient_key_and_display(base)

            if patient_key not in patient_report_mapping:
                patient_report_mapping[patient_key] = {'display': display_name, 'files': []}
            patient_report_mapping[patient_key]['files'].append(file_path)
        
        # Create patients and process their reports
        for patient_key, info in patient_report_mapping.items():
            report_files = info['files']
            display_name = info['display']
            patient_demo_id = f"patient_{patient_key}"
            
            cur.execute("""
                INSERT INTO patients (patient_demo_id, patient_display_name)
                VALUES (%s, %s)
                RETURNING patient_id
            """, (patient_demo_id, display_name))
            
            patient_id = cur.fetchone()[0]
            print(f"\nCreated patient: {display_name} (ID: {patient_id}, demo_id: {patient_demo_id})")
            
            # Process each report for this patient
            for file_path in report_files:
                filename = os.path.basename(file_path)
                print(f"  Processing report: {filename}...")
                
                # Extract text from PDF
                pages_text = extract_text_from_pdf(file_path)
                if not pages_text:
                    print(f"    No text extracted from {filename}, skipping...")
                    continue
                
                # Combine all text for the full report
                full_text = "\n\n".join(text for text, _ in pages_text)
                
                # Infer report type
                report_type = infer_report_type(file_path)
                
                # Create report entry
                cur.execute("""
                    INSERT INTO reports (patient_id, report_filepath_pointer, report_type, report_text_encrypted)
                    VALUES (%s, %s, %s, pgp_sym_encrypt(%s, %s))
                    RETURNING report_id
                """, (patient_id, file_path, report_type, full_text, ENCRYPTION_KEY))
                
                report_id = cur.fetchone()[0]
                
                # Process chunks with accurate page tracking
                chunks_with_metadata = chunk_text(pages_text)
                for chunk, metadata in chunks_with_metadata:
                    # Get embedding
                    vector = get_embedding(chunk)
                    
                    # Insert chunk with accurate page metadata
                    cur.execute("""
                        INSERT INTO report_chunks 
                        (report_id, chunk_text_encrypted, report_vector, source_metadata)
                        VALUES (%s, pgp_sym_encrypt(%s, %s), %s, %s)
                    """, (
                        report_id,
                        chunk,
                        ENCRYPTION_KEY,
                        vector,
                        Json(metadata)
                    ))
                
                print(f"    Processed {len(chunks_with_metadata)} chunks for {filename} (type: {report_type})")
            
            conn.commit()
            print(f"  ✓ Committed {len(report_files)} report(s) for {display_name}")
            
    except Exception as e:
        conn.rollback()
        print(f"Error in main process: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()