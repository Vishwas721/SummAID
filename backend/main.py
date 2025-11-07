import os
import json
import logging
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import get_db_connection
import requests
from pydantic import BaseModel, Field

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

@app.post("/summarize/{patient_demo_id}")
async def summarize_patient(
    patient_demo_id: str = Path(..., description="The patient_demo_id to summarize"),
    payload: SummarizeRequest = Body(default=SummarizeRequest())
):
    """Skeleton summarization endpoint performing basic hybrid search + generation."""
    try:
        # 1. Build embedding for a generic summarization intent (could be enhanced with keywords)
        embed_basis = " ".join(payload.keywords) if payload.keywords else f"summary {patient_demo_id}"
        query_embedding = _embed_text(embed_basis)
        if len(query_embedding) != 768:
            # Warn mismatch early
            raise HTTPException(status_code=500, detail=f"Embedding dimension {len(query_embedding)} != 768 schema expectation")

        # Convert embedding to pgvector literal string
        embedding_literal = '[' + ','.join(f'{x:.6f}' for x in query_embedding) + ']'

        conn = None
        similarity_chunks: List[tuple] = []  # Will store (chunk_text, metadata, filepath)
        keyword_chunks: List[tuple] = []     # Will store (chunk_text, metadata, filepath)
        try:
            conn = get_db_connection()
            cur = conn.cursor()

            # 2. Similarity search limited - NOW INCLUDING METADATA AND FILEPATH
            cur.execute(
                f"""
                WITH q AS (SELECT %s::vector(768) AS qv)
                SELECT pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text AS chunk_text,
                       c.source_metadata,
                       r.report_filepath_pointer,
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
            similarity_chunks = [(row[0], row[1], row[2]) for row in similarity_rows if row and row[0]]

            # 3. Keyword search (if any) - NOW INCLUDING METADATA AND FILEPATH
            if payload.keywords:
                patterns = [f"%{kw}%" for kw in payload.keywords]
                ors = " OR ".join([f"pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text ILIKE %s" for _ in patterns])
                params: List[str] = []
                for p in patterns:
                    params.extend([ENCRYPTION_KEY, p])
                sql = f"""
                    SELECT DISTINCT pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text AS chunk_text,
                           c.source_metadata,
                           r.report_filepath_pointer
                    FROM report_chunks c
                    JOIN reports r ON r.report_id = c.report_id
                    WHERE r.patient_demo_id = %s AND ( {ors} )
                """.replace('%s)::text ILIKE %s', '%s)::text ILIKE %s')  # keep placeholders stable
                # Build final parameters: first decrypt key for DISTINCT select, patient id, then repeated pairs
                final_params = [ENCRYPTION_KEY, patient_demo_id] + params
                cur.execute(sql, final_params)
                keyword_rows = cur.fetchall()
                keyword_chunks = [(row[0], row[1], row[2]) for row in keyword_rows if row and row[0]]
            cur.close()
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database hybrid search error: {e}")
        finally:
            if conn:
                conn.close()

        # 4. Merge & trim context - NOW PRESERVING CITATIONS
        seen = set()
        merged: List[tuple] = []  # List of (chunk_text, metadata, filepath)
        for source_list in (keyword_chunks, similarity_chunks):  # prioritize keyword matches first
            for chunk_tuple in source_list:
                chunk_text = chunk_tuple[0]
                key = chunk_text[:200]
                if key in seen:
                    continue
                seen.add(key)
                merged.append(chunk_tuple)
        
        # Limit by character budget
        context_accum: List[tuple] = []  # List of (chunk_text, metadata, filepath)
        total_chars = 0
        for chunk_tuple in merged:
            chunk_text = chunk_tuple[0]
            if total_chars + len(chunk_text) > payload.max_context_chars:
                break
            context_accum.append(chunk_tuple)
            total_chars += len(chunk_text)
        
        if not context_accum:
            raise HTTPException(status_code=404, detail=f"No chunks found for patient_demo_id={patient_demo_id}")

        # 5. Generate summary - extract just text for generation
        context_texts = [chunk_tuple[0] for chunk_tuple in context_accum]
        summary_text = _generate_summary(context_texts, patient_demo_id)

        # 6. Build sources list for Glass Box transparency
        sources = []
        for chunk_tuple in context_accum:
            try:
                sources.append({
                    "metadata": chunk_tuple[1] if len(chunk_tuple) > 1 else {},
                    "filepath": chunk_tuple[2] if len(chunk_tuple) > 2 else None
                })
            except (IndexError, TypeError) as e:
                # Log but don't fail if citation data is malformed
                print(f"Warning: Could not extract citation for chunk: {e}")
                sources.append({"metadata": {}, "filepath": None})

        return {
            "patient_demo_id": patient_demo_id,
            "model": GEN_MODEL,
            "embedding_model": EMBED_MODEL,
            "chunks_used": len(context_accum),
            "total_context_chars": total_chars,
            "summary": summary_text,
            "sources": sources  # GLASS BOX: Every statement must be citable
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Summarization error for patient {patient_demo_id}")
        raise HTTPException(status_code=500, detail=f"Summarization error: {str(e)}")