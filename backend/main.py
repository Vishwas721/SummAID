import os
import json
import logging
import unicodedata
from typing import List, Optional, Tuple
from fastapi import FastAPI, HTTPException, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import get_db_connection
import requests
from pydantic import BaseModel, Field
from routers.patient_router import router as patient_router

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# --- Configuration Loading & Validation ---
DATABASE_URL = os.getenv("DATABASE_URL")

# ⚠️ SECURITY WARNING ⚠️
# This .env-based encryption key management is STRICTLY for Phase 1 prototype only.
# MUST be replaced with HashiCorp Vault HA Cluster using Transit Engine before ANY pilot
# with real data or production deployment. See Project Constitution Phase 2 Production Blueprint.
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

# Default to Vite's default port if not specified
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

if not DATABASE_URL or not ENCRYPTION_KEY:
    raise ValueError("DATABASE_URL and ENCRYPTION_KEY must be set in .env file")
# --- End Configuration ---


# Initialize FastAPI app
app = FastAPI(
    title="SummAID API",
    description="Backend for the v3-lite Canned Demo",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],  # Explicitly allow our React app's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include sub-routers
app.include_router(patient_router)

@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "SummAID API is running."}

@app.get("/patients")
async def get_patients():
    """
    Get list of all unique patient demo IDs from the reports table.
    Returns a JSON array of patient_demo_id strings.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Query for unique patient_demo_ids, sorted alphabetically
        cur.execute("""
            SELECT DISTINCT patient_demo_id 
            FROM reports 
            ORDER BY patient_demo_id
        """)
        
        # Extract just the patient_demo_id values into a list
        patients = [row[0] for row in cur.fetchall()]
        
        cur.close()
        return patients
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            conn.close()


# ---------- Summarization (Skeleton) ----------
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")  # 768-dim
GEN_MODEL = os.getenv("GEN_MODEL", "llama3:8b")  # generation model via Ollama

class SummarizeRequest(BaseModel):
    keywords: Optional[List[str]] = Field(default=None, description="Optional keyword filters for hybrid search")
    max_chunks: int = Field(default=12, ge=1, le=50, description="Maximum number of chunks from similarity search")
    max_context_chars: int = Field(default=12000, ge=500, le=60000, description="Max characters of context sent to model")

def _embed_text(text: str) -> List[float]:
    """Call local Ollama embed endpoint and return embedding (list of floats)."""
    try:
        resp = requests.post(
            "http://localhost:11434/api/embed",
            json={"model": EMBED_MODEL, "input": text}, timeout=60
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding service error: {e}")
    try:
        data = resp.json()
    except Exception:
        raise HTTPException(status_code=500, detail=f"Non-JSON response from embed endpoint: {resp.text[:200]}")
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Embedding error: {data}")
    # Support either 'embedding' or 'embeddings'
    if 'embedding' in data:
        return data['embedding']
    if 'embeddings' in data:
        # take first if list of lists
        emb = data['embeddings']
        return emb[0] if isinstance(emb, list) else emb
    raise HTTPException(status_code=500, detail=f"Embedding key missing in response: {data}")

def _generate_summary(context_chunks: List[str], patient_demo_id: str) -> str:
    """Call local Ollama generate endpoint to produce a summary from provided context."""
    # Basic prompt (Phase 1 skeleton) – can be refined later
    joined = "\n\n".join(context_chunks)
    prompt = (
        f"You are a clinical summarization assistant. Produce a concise, factual summary for patient '{patient_demo_id}'.\n"
        f"Use only the information in the provided context.\n"
        f"Context:\n{joined}\n\nSummary:" )
    try:
        resp = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": GEN_MODEL,
                "prompt": prompt,
                "stream": False
            }, timeout=120
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation service error: {e}")
    try:
        data = resp.json()
    except Exception:
        raise HTTPException(status_code=500, detail=f"Non-JSON response from generate endpoint: {resp.text[:200]}")
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Generation error: {data}")
    # Ollama /api/generate returns {'response': '...'}
    summary = data.get('response') or data.get('output') or ''
    if not summary:
        raise HTTPException(status_code=500, detail=f"Empty summary response: {data}")
    return summary.strip()

def _normalize_text(s: str) -> str:
    """Normalize Unicode and fix common mojibake artifacts from PDF/OCR.
    This is a light-touch pass to improve readability without altering meaning.
    """
    if not isinstance(s, str):
        return s
    # Unicode normalization
    s = unicodedata.normalize('NFKC', s)
    # Common mojibake replacements
    replacements = {
        'â€¦': '…',
        'â€“': '–',
        'â€”': '—',
        'â€˜': '‘',
        'â€™': '’',
        'â€œ': '“',
        'â€': '”',
        'Â·': '·',
        'Â®': '®',
        'Â©': '©',
        'Â°': '°',
        'Â±': '±',
        'Â': ' ',  # stray non-breaking artifact
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    # Normalize whitespace
    s = s.replace('\r\n', '\n').replace('\r', '\n')
    # Collapse overlong whitespace runs
    s = '\n'.join(' '.join(line.split()) for line in s.split('\n'))
    return s.strip()

@app.post("/summarize/{patient_demo_id}")
async def summarize_patient(
    patient_demo_id: str = Path(..., description="The patient_demo_id to summarize"),
    payload: SummarizeRequest = Body(default=SummarizeRequest())
):
    """Summarization endpoint with Glass Box citations.

    Returns a JSON object containing:
    {
      "summary_text": <model summary>,
      "citations": [
         {"source_chunk_id": <int>, "source_text_preview": <str>, "source_metadata": <JSON>},
         ...
      ]
    }
    """
    try:
        # 1. Build embedding for a generic summarization intent (could be enhanced with keywords)
        embed_basis = " ".join(payload.keywords) if payload.keywords else f"summary {patient_demo_id}"
        query_embedding = _embed_text(embed_basis)
        if len(query_embedding) != 768:
            raise HTTPException(status_code=500, detail=f"Embedding dimension {len(query_embedding)} != 768 schema expectation")

        embedding_literal = '[' + ','.join(f'{x:.6f}' for x in query_embedding) + ']'

        conn = None
        # (chunk_id, report_id, chunk_text, metadata)
        similarity_chunks: List[Tuple[int, int, str, dict]] = []
        keyword_chunks: List[Tuple[int, int, str, dict]] = []
        try:
            conn = get_db_connection()
            cur = conn.cursor()

            # 2. Similarity search - include chunk_id + metadata
            cur.execute(
                f"""
                WITH q AS (SELECT %s::vector(768) AS qv)
                SELECT c.chunk_id,
                       c.report_id,
                       pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text AS chunk_text,
                       c.source_metadata,
                       (c.report_vector <=> q.qv) AS distance
                FROM report_chunks c
                JOIN reports r ON r.report_id = c.report_id
                JOIN q ON TRUE
                WHERE r.patient_demo_id = %s
                ORDER BY c.report_vector <=> q.qv
                LIMIT %s
                """,
                (embedding_literal, ENCRYPTION_KEY, patient_demo_id, payload.max_chunks)
            )
            similarity_rows = cur.fetchall()
            for row in similarity_rows:
                # row: (chunk_id, report_id, chunk_text, metadata, distance)
                if row and row[2]:  # ensure chunk_text exists
                    similarity_chunks.append((row[0], row[1], row[2], row[3]))

            # 3. Keyword search (if any) - include chunk_id
            if payload.keywords:
                patterns = [f"%{kw}%" for kw in payload.keywords]
                ors = " OR ".join([f"pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text ILIKE %s" for _ in patterns])
                params: List[str] = []
                for p in patterns:
                    params.extend([ENCRYPTION_KEY, p])
                sql = f"""
                    SELECT DISTINCT c.chunk_id,
                           c.report_id,
                           pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text AS chunk_text,
                           c.source_metadata
                    FROM report_chunks c
                    JOIN reports r ON r.report_id = c.report_id
                    WHERE r.patient_demo_id = %s AND ( {ors} )
                """.replace('%s)::text ILIKE %s', '%s)::text ILIKE %s')
                final_params = [ENCRYPTION_KEY, patient_demo_id] + params
                cur.execute(sql, final_params)
                keyword_rows = cur.fetchall()
                for row in keyword_rows:
                    # row: (chunk_id, report_id, chunk_text, metadata)
                    if row and row[2]:
                        keyword_chunks.append((row[0], row[1], row[2], row[3]))
            cur.close()
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database hybrid search error: {e}")
        finally:
            if conn:
                conn.close()

        # 4. Merge (keyword priority) & trim by character budget
        seen_text = set()
        merged: List[Tuple[int, int, str, dict]] = []
        for source_list in (keyword_chunks, similarity_chunks):
            for chunk_id, report_id, chunk_text, metadata in source_list:
                dedup_key = chunk_text[:200]
                if dedup_key in seen_text:
                    continue
                seen_text.add(dedup_key)
                merged.append((chunk_id, report_id, chunk_text, metadata))

        context_accum: List[Tuple[int, int, str, dict]] = []
        total_chars = 0
        for chunk_id, report_id, chunk_text, metadata in merged:
            if total_chars + len(chunk_text) > payload.max_context_chars:
                break
            context_accum.append((chunk_id, report_id, chunk_text, metadata))
            total_chars += len(chunk_text)

        if not context_accum:
            raise HTTPException(status_code=404, detail=f"No chunks found for patient_demo_id={patient_demo_id}")

        # 5. Generate summary
        summary_text = _generate_summary([t for _, _, t, _ in context_accum], patient_demo_id)

        # 6. Build citations list
        citations = []
        PREVIEW_LEN = 160
        for chunk_id, report_id, chunk_text, metadata in context_accum:
            # Normalize full text and preview for readability
            norm_full = _normalize_text(chunk_text)
            preview = norm_full[:PREVIEW_LEN]
            if len(norm_full) > PREVIEW_LEN:
                preview += "…"
            citations.append({
                "source_chunk_id": chunk_id,
                "report_id": report_id,
                "source_text_preview": preview,
                "source_full_text": norm_full,
                "source_metadata": metadata or {}
            })

        return {
            "summary_text": summary_text,
            "citations": citations
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Summarization error for patient {patient_demo_id}")
        raise HTTPException(status_code=500, detail=f"Summarization error: {str(e)}")