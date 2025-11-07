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

# Load environment variables
load_dotenv()

# Constants
DB_URL = os.getenv("DATABASE_URL")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
OLLAMA_EMBED_MODEL = "nomic-embed-text"
PDF_DIRECTORY = "./demo_reports/"

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
        "http://localhost:11434/api/embeddings",
        json={"model": OLLAMA_EMBED_MODEL, "prompt": text}
    )
    if response.status_code != 200:
        raise Exception(f"Failed to get embedding: {response.text}")
    
    data = response.json()
    return data["embedding"]

def main():
    # Connect to database
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Clear existing data
        cur.execute("TRUNCATE reports, report_chunks CASCADE;")
        
        # Process each PDF in the directory
        for filename in os.listdir(PDF_DIRECTORY):
            if not filename.lower().endswith('.pdf'):
                continue
                
            file_path = os.path.join(PDF_DIRECTORY, filename)
            print(f"Processing {filename}...")
            
            # Extract text from PDF
            pages_text = extract_text_from_pdf(file_path)
            if not pages_text:
                print(f"No text extracted from {filename}, skipping...")
                continue
            
            # Combine all text for the full report
            full_text = "\n\n".join(text for text, _ in pages_text)
            
            # Create report entry
            patient_demo_id = f"patient_{os.path.splitext(filename)[0]}"
            cur.execute("""
                INSERT INTO reports (patient_demo_id, report_filepath_pointer, report_text_encrypted)
                VALUES (%s, %s, pgp_sym_encrypt(%s, %s))
                RETURNING report_id
            """, (patient_demo_id, file_path, full_text, ENCRYPTION_KEY))
            
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
            
            print(f"Processed {len(chunks_with_metadata)} chunks for {filename}")
            conn.commit()
            
    except Exception as e:
        conn.rollback()
        print(f"Error in main process: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()