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

# Load environment variables (prefer .env values even if process has existing vars)
load_dotenv(override=True)

# Shared helper to sanitize encryption key (strip surrounding quotes/whitespace)
def _sanitize_key(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    key = raw.strip()
    if len(key) >= 2 and ((key[0] == '"' and key[-1] == '"') or (key[0] == "'" and key[-1] == "'")):
        key = key[1:-1]
    return key

# --- Configuration Loading & Validation ---
DATABASE_URL = os.getenv("DATABASE_URL")

# ⚠️ SECURITY WARNING ⚠️
# This .env-based encryption key management is STRICTLY for Phase 1 prototype only.
# MUST be replaced with HashiCorp Vault HA Cluster using Transit Engine before ANY pilot
# with real data or production deployment. See Project Constitution Phase 2 Production Blueprint.
ENCRYPTION_KEY = _sanitize_key(os.getenv("ENCRYPTION_KEY"))

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
    """Return list of patients.

    Task 17 specification: return objects with patient_id and patient_display_name.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Query for all patients, sorted by display name
        cur.execute("""
            SELECT patient_id, patient_display_name
            FROM patients
            ORDER BY patient_display_name
        """)
        rows = cur.fetchall()
        patients = [
            {
                "patient_id": r[0],
                "patient_display_name": r[1]
            }
            for r in rows
        ]
        cur.close()
        return patients
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        if conn:
            conn.close()


# ---------- Summarization (Skeleton) ----------
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")  # 768-dim
GEN_MODEL = os.getenv("GEN_MODEL", "llama3:8b")  # generation model via Ollama

class SummarizeRequest(BaseModel):
    keywords: Optional[List[str]] = Field(default=None, description="Optional keyword filters for hybrid search")
    max_chunks: int = Field(default=20, ge=1, le=50, description="Maximum number of chunks from similarity search (increased to capture more context including critical findings)")
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

def _generate_summary(context_chunks: List[str], patient_label: str) -> str:
    """Call local Ollama generate endpoint to produce a synthesized clinical narrative from provided context."""
    joined = "\n\n".join(context_chunks)
    prompt = (
        f"You are an expert clinician synthesizing medical findings for patient '{patient_label}'. Write a clinical narrative that tells the story, not just lists results.\n\n"
        f"CORE PRINCIPLES:\n"
        f"1. CLINICAL STORY FIRST: Start with the PRIMARY clinical concern or pattern (e.g., 'This patient has persistent neutrophilic leukocytosis likely driven by an allergic/inflammatory process')\n"
        f"2. EVIDENCE & TRENDS: Support your story with specific data and time trends:\n"
        f"   - WBC trend: 16,810 (Apr 2025) → 10,020 (Sep 2025) - improving but still elevated\n"
        f"   - Key finding: Serum IgE markedly elevated at 278 (ref <100) - suggests allergic etiology\n"
        f"   - Supporting: ESR elevated in Sep suggesting ongoing inflammation\n"
        f"3. CLINICAL SIGNIFICANCE: Explain WHY findings matter:\n"
        f"   - 'The elevated IgE with neutrophilia suggests allergic inflammation rather than infection'\n"
        f"   - 'Improvement in WBC suggests response to treatment or resolving trigger'\n"
        f"4. DIFFERENTIAL & RULED OUT: Briefly mention what was excluded:\n"
        f"   - 'Dengue ruled out; thyroid function normal'\n"
        f"5. CLINICAL IMPRESSION: End with a 1-2 sentence summary of the clinical picture and what it means\n\n"
        f"AVOID:\n"
        f"- Bold formatting with ** (use plain text)\n"
        f"- Generic section headers like 'Main Clinical Story' or 'Trend Analysis'\n"
        f"- Listing every normal finding\n"
        f"- Repeating the same information multiple times\n\n"
        f"EXAMPLE GOOD OUTPUT:\n"
        f"'Patient Vignesh (20/M) presents with neutrophilic leukocytosis that has significantly improved over 5 months (WBC 16,810→10,020), though remains elevated. The markedly elevated Serum IgE (278, ref <100) strongly suggests an underlying allergic or atopic process driving the leukocytosis. The elevated ESR in September indicates ongoing inflammation. Infectious etiologies including dengue have been ruled out, and thyroid function is normal. Clinical impression: Allergic/inflammatory leukocytosis with favorable trend, likely requires allergy workup and possible environmental trigger identification.'\n\n"
        f"Context (Medical Reports):\n{joined}\n\n"
        f"Clinical Narrative:"
    )
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

@app.post("/summarize/{patient_id}")
async def summarize_patient(
    patient_id: int = Path(..., description="The numeric patient_id to summarize"),
    payload: SummarizeRequest = Body(default=SummarizeRequest())
):
    """Summarize using patient_id (canonical endpoint) across all of the patient's reports.

    Steps:
    - Resolve patient's display name (for labeling/prompt only)
    - Find all report_ids for this patient
    - Hybrid search (vector + optional keywords) only within those report_ids
    - Decrypt best chunks and generate summary via Ollama
    - Return summary + citations (unchanged shape)
    """
    try:
        # 1. Resolve display label & fetch report_ids
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT patient_display_name, patient_demo_id FROM patients WHERE patient_id=%s", (patient_id,))
        prow = cur.fetchone()
        if not prow:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
        display_name, patient_demo_id = prow[0], prow[1]
        label = display_name or patient_demo_id or str(patient_id)

        cur.execute("SELECT report_id FROM reports WHERE patient_id=%s ORDER BY report_id", (patient_id,))
        report_rows = cur.fetchall()
        report_ids = [r[0] for r in report_rows]
        if not report_ids:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail=f"No reports found for patient_id={patient_id}")

        # 2. Build embedding basis - use clinically-focused query for better retrieval
        if payload.keywords:
            embed_basis = " ".join(payload.keywords)
        else:
            # Clinically-focused query to boost FINDINGS/IMPRESSION sections
            embed_basis = "clinical findings diagnosis impression key findings radiological findings pathology results"
        
        query_embedding = _embed_text(embed_basis)
        if len(query_embedding) != 768:
            raise HTTPException(status_code=500, detail=f"Embedding dimension {len(query_embedding)} != 768 schema expectation")
        embedding_literal = '[' + ','.join(f'{x:.6f}' for x in query_embedding) + ']'

        # 3. Retrieval limited to this patient's report_ids
        similarity_chunks: List[Tuple[int, int, str, dict]] = []
        keyword_chunks: List[Tuple[int, int, str, dict]] = []
        structured_chunks: List[Tuple[int, int, str, dict]] = []  # Force-include FINDINGS/IMPRESSION
        
        # reuse existing connection/cur
        placeholders = ','.join(['%s'] * len(report_ids))
        
        # 3a. First, force-include chunks with key structured sections (FINDINGS, IMPRESSION, CONCLUSION)
        structured_sql = f"""
            SELECT c.chunk_id,
                   c.report_id,
                   pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text AS chunk_text,
                   c.source_metadata
            FROM report_chunks c
            WHERE c.report_id IN ({placeholders})
            AND (
                pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text ~* '\\n\\s*FINDINGS\\s*\\n'
                OR pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text ~* '\\n\\s*IMPRESSION\\s*\\n'
                OR pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text ~* '\\n\\s*CONCLUSION\\s*\\n'
            )
        """
        cur.execute(structured_sql, [ENCRYPTION_KEY, *report_ids, ENCRYPTION_KEY, ENCRYPTION_KEY, ENCRYPTION_KEY])
        for row in cur.fetchall():
            if row and row[2]:
                structured_chunks.append((row[0], row[1], row[2], row[3]))
        
        # 3b. Then get similarity-based chunks
        similarity_sql = f"""
            WITH q AS (SELECT %s::vector(768) AS qv)
            SELECT c.chunk_id,
                   c.report_id,
                   pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text AS chunk_text,
                   c.source_metadata,
                   (c.report_vector <=> q.qv) AS distance
            FROM report_chunks c, q
            WHERE c.report_id IN ({placeholders})
            ORDER BY c.report_vector <=> q.qv
            LIMIT %s
        """
        cur.execute(
            similarity_sql,
            (embedding_literal, ENCRYPTION_KEY, *report_ids, payload.max_chunks)
        )
        for row in cur.fetchall():
            if row and row[2]:
                similarity_chunks.append((row[0], row[1], row[2], row[3]))
        if payload.keywords:
            patterns = [f"%{kw}%" for kw in payload.keywords]
            ors = " OR ".join([f"pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text ILIKE %s" for _ in patterns])
            params: List[str] = []
            for ptn in patterns:
                params.extend([ENCRYPTION_KEY, ptn])
            kw_sql = f"""
                SELECT DISTINCT c.chunk_id,
                       c.report_id,
                       pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text AS chunk_text,
                       c.source_metadata
                FROM report_chunks c
                WHERE c.report_id IN ({placeholders}) AND ( {ors} )
            """.replace('%s)::text ILIKE %s', '%s)::text ILIKE %s')
            final_params = [ENCRYPTION_KEY, *report_ids] + params
            cur.execute(kw_sql, final_params)
            for row in cur.fetchall():
                if row and row[2]:
                    keyword_chunks.append((row[0], row[1], row[2], row[3]))
        cur.close(); conn.close()

        # 4. Merge & trim - prioritize structured sections, then keywords, then similarity
        seen = set(); merged: List[Tuple[int,int,str,dict]] = []
        # Force structured sections first (FINDINGS/IMPRESSION always included)
        for cid,rid,txt,meta in structured_chunks:
            sig = txt[:200]
            if sig in seen: continue
            seen.add(sig); merged.append((cid,rid,txt,meta))
        # Then keyword matches
        for cid,rid,txt,meta in keyword_chunks:
            sig = txt[:200]
            if sig in seen: continue
            seen.add(sig); merged.append((cid,rid,txt,meta))
        # Then similarity-based chunks
        for cid,rid,txt,meta in similarity_chunks:
            sig = txt[:200]
            if sig in seen: continue
            seen.add(sig); merged.append((cid,rid,txt,meta))
        context_accum: List[Tuple[int,int,str,dict]] = []
        total_chars = 0
        for cid,rid,txt,meta in merged:
            if total_chars + len(txt) > payload.max_context_chars: break
            context_accum.append((cid,rid,txt,meta)); total_chars += len(txt)
        if not context_accum:
            raise HTTPException(status_code=404, detail=f"No chunks found for patient_id={patient_id}")

        # 5. Generate summary using display label
        summary_text = _generate_summary([t for _,_,t,_ in context_accum], label)

        # 6. Citations
        citations = []
        PREVIEW_LEN = 160
        for cid,rid,txt,meta in context_accum:
            norm_full = _normalize_text(txt)
            preview = norm_full[:PREVIEW_LEN] + ("…" if len(norm_full) > PREVIEW_LEN else "")
            # Ensure report_id is available inside source_metadata for frontend routing
            enriched_meta = (meta or {}).copy()
            enriched_meta.setdefault('report_id', rid)
            citations.append({
                "source_chunk_id": cid,
                "report_id": rid,
                "source_text_preview": preview,
                "source_full_text": norm_full,
                "source_metadata": enriched_meta
            })
        return {"summary_text": summary_text, "citations": citations}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Summarization error for patient_id {patient_id}")
        raise HTTPException(status_code=500, detail=f"Summarization error: {e}")