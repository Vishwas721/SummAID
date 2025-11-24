import os
import json
import logging
import unicodedata
from typing import List, Optional, Tuple
from fastapi import FastAPI, HTTPException, Body, Path, Request
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

# --- Ensure late-added schema objects exist (idempotent) ---
def ensure_summary_support():
    """Create patient_summaries table and chart_prepared_at column if they do not exist.
    Safe to call multiple times; used opportunistically before summary operations.
    """
    conn = None
    try:
        conn = get_db_connection(); cur = conn.cursor()
        # Add chart_prepared_at column if missing
        try:
            cur.execute("ALTER TABLE patients ADD COLUMN IF NOT EXISTS chart_prepared_at TIMESTAMP NULL")
        except Exception as e:
            logger.warning(f"chart_prepared_at alter warning: {e}")
        # Create patient_summaries table if missing
        cur.execute("""
            CREATE TABLE IF NOT EXISTS patient_summaries (
              patient_id INTEGER PRIMARY KEY REFERENCES patients(patient_id) ON DELETE CASCADE,
              summary_text TEXT NOT NULL,
              patient_type TEXT NOT NULL,
              chief_complaint TEXT NULL,
              citations JSONB NOT NULL DEFAULT '[]'::jsonb,
              generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Index for retrieval ordering if needed
        cur.execute("CREATE INDEX IF NOT EXISTS idx_patient_summaries_generated_at ON patient_summaries(generated_at DESC)")
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        if conn:
            conn.rollback()
        logger.warning(f"ensure_summary_support error (non-fatal): {e}")
    finally:
        if conn:
            conn.close()

@app.on_event("startup")
def _startup_init():
    # Best-effort schema ensure so first request doesn't race
    ensure_summary_support()

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

# System prompts
STANDARD_PROMPT = (
    "You are an expert medical AI assistant. Your goal is to generate a comprehensive, structured, and professional medical summary for a doctor.\n"
    "Format the output using Markdown.\n"
    "Structure the summary with the following sections:\n"
    "1. **Patient History & Chief Complaint**: Brief overview.\n"
    "2. **Key Findings**: Use bullet points for significant clinical observations.\n"
    "3. **Lab Results & Vitals**: YOU MUST USE MARKDOWN TABLES for all lab values, vitals, and measurements. Columns should be: Test/Measure, Value, Reference Range (if available), and Flag (High/Low).\n"
    "4. **Diagnosis & Impression**: Clear statement of diagnoses.\n"
    "5. **Plan & Recommendations**: Next steps.\n"
    "\n"
    "Ensure the tone is professional, concise, and clinically accurate. Do not use conversational filler."
)
SPEECH_PROMPT = (
    "You are an expert Audiologist. Summarize the patient's hearing levels (dB), speech intelligibility, and therapy goals. Do not look for tumors."
)

class SummarizeRequest(BaseModel):
    keywords: Optional[List[str]] = Field(default=None, description="Optional keyword filters for hybrid search")
    max_chunks: int = Field(default=20, ge=1, le=50, description="Maximum number of chunks from similarity search (increased to capture more context including critical findings)")
    max_context_chars: int = Field(default=12000, ge=500, le=60000, description="Max characters of context sent to model")
    chief_complaint: Optional[str] = Field(default=None, description="Optional visit reason / chief complaint to bias retrieval toward relevant abnormalities")

class ChatRequest(BaseModel):
    question: str = Field(..., description="The question to answer about the patient")
    keywords: Optional[List[str]] = Field(default=None, description="Optional keyword filters for hybrid search")
    max_chunks: int = Field(default=15, ge=1, le=50, description="Maximum number of chunks to retrieve")
    max_context_chars: int = Field(default=12000, ge=500, le=60000, description="Max characters of context sent to model")

class AnnotationRequest(BaseModel):
    patient_id: int = Field(..., description="Patient ID for the annotation")
    doctor_note: str = Field(..., description="Doctor's note/annotation text")
    selected_text: Optional[str] = Field(default=None, description="Selected text from summary that is being annotated")

class AnnotationResponse(BaseModel):
    annotation_id: int
    patient_id: int
    doctor_note: str
    selected_text: Optional[str] = None
    created_at: str

class SafetyCheckRequest(BaseModel):
    drug_name: str = Field(..., description="Name of the drug to check for allergies")

class SafetyCheckResponse(BaseModel):
    has_allergy: bool = Field(..., description="Whether an allergy was detected")
    warnings: List[str] = Field(default_factory=list, description="List of specific warnings")
    allergy_details: Optional[str] = Field(default=None, description="Detailed allergy information")
    citations: List[dict] = Field(default_factory=list, description="Report chunks containing allergy information")

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

def _generate_summary(context_chunks: List[str], patient_label: str, system_prompt: str) -> str:
    """Generate synthesized clinical narrative with robust CUDA fallback and context trimming.
    system_prompt controls domain framing (standard vs speech/hearing)."""
    joined = "\n\n".join(context_chunks)
    MAX_SAFE_CHARS = 18000
    if len(joined) > MAX_SAFE_CHARS:
        joined = joined[-MAX_SAFE_CHARS:]
    approx_tokens = len(joined) // 4
    logger.debug(f"Summarization context chars={len(joined)} approx_tokens={approx_tokens}")
    prompt = (
        f"{system_prompt}\n\n"
        f"Strict Formatting Rules:\n"
        f"- Key Findings: Use bullet points.\n"
        f"- Lab Values: If there are lab results, output them in a Markdown table with columns: Date | Test | Value | Flag (High/Low/Normal). Include only abnormal or clinically relevant normals for rule-outs.\n"
        f"- Evolution: Explicitly describe how values or sizes changed from the oldest to the newest report.\n"
        f"- Do not write long paragraphs. Keep sentences concise. No decorative formatting.\n\n"
        f"Additional Guidance:\n"
        f"- Identify the main clinical story in one line (e.g., 'Persistent neutrophilic leukocytosis with improving trend').\n"
        f"- Prefer specific numbers with units and dates, exactly as given.\n"
        f"- Do not invent or infer values or dates that are not present in the context.\n"
        f"- If no labs are present, omit the Lab Values table section.\n\n"
        f"Output exactly in the following order and headings (no extra sections):\n\n"
        f"Main Story:\n"
        f"- <one-line main story>\n\n"
        f"Key Findings:\n"
        f"- <bullet>\n- <bullet>\n\n"
        f"Lab Values:\n"
        f"| Date | Test | Value | Flag |\n"
        f"|---|---|---|---|\n"
        f"[add rows only if labs exist]\n\n"
        f"Evolution:\n"
        f"- <bulleted trend statements from oldest → newest>\n\n"
        f"Context:\n{joined}\n\n"
        f"Summary:"
    )

    def _try(model_name: str, ctx: str) -> Tuple[bool, str]:
        try:
            r = requests.post(
                "http://localhost:11434/api/generate",
                json={"model": model_name, "prompt": ctx, "stream": False}, timeout=180
            )
        except Exception as e:
            return False, f"network:{e}"
        try:
            data = r.json()
        except Exception:
            return False, f"non-json:{r.text[:180]}"
        if r.status_code != 200:
            return False, json.dumps(data)[:300]
        out = data.get('response') or data.get('output') or ''
        if not out:
            return False, f"empty:{data}"
        return True, out.strip()

    ok, primary = _try(GEN_MODEL, prompt)
    if ok:
        return primary
    lower_err = primary.lower()
    if any(k in lower_err for k in ["cuda", "oom", "terminated", "memory"]):
        logger.warning(f"GPU-related generation failure detected: {primary}")
        fallbacks = [f"{GEN_MODEL}-q4", "llama3:8b-q4", "llama3:8b-instruct"]
        for fm in fallbacks:
            ok2, res2 = _try(fm, prompt)
            if ok2:
                return res2 + "\n(Note: Quantized fallback model used due to GPU memory constraints.)"
        reduced = joined[-(MAX_SAFE_CHARS // 2):]
        reduced_prompt = prompt.replace(f"Context:\n{joined}", f"Context (Reduced Extract):\n{reduced}")
        ok3, res3 = _try(GEN_MODEL, reduced_prompt)
        if ok3:
            return res3 + "\n(Note: Context reduced due to GPU memory constraints.)"
        raise HTTPException(status_code=500, detail=f"Generation GPU error; all fallbacks failed: {primary}")
    raise HTTPException(status_code=500, detail=f"Generation error: {primary}")

def _infer_patient_type(report_types: List[str]) -> str:
    """Infer patient type category from list of report_types.
    Returns 'speech' if any speech/audiology types present, otherwise 'oncology'."""
    speech_markers = {"Speech Therapy", "Audiology"}
    if any(rt in speech_markers for rt in report_types):
        return "speech"
    return "oncology"

def _answer_question(context_chunks: List[str], question: str) -> str:
    """Answer a specific question using RAG context with robust fallback handling."""
    joined = "\n\n".join(context_chunks)
    MAX_SAFE_CHARS = 18000
    if len(joined) > MAX_SAFE_CHARS:
        joined = joined[-MAX_SAFE_CHARS:]
    
    approx_tokens = len(joined) // 4
    logger.debug(f"Question answering context chars={len(joined)} approx_tokens={approx_tokens}")
    
    prompt = (
        f"You are a clinical assistant helping a doctor analyze patient records.\n\n"
        f"Context (Medical Reports):\n{joined}\n\n"
        f"User Question: {question}\n\n"
        f"Instructions:\n"
        f"- Answer the question using ONLY the information provided in the context above.\n"
        f"- Be concise and direct. Use bullet points if listing multiple items.\n"
        f"- If specific values, dates, or measurements are mentioned, include them exactly as stated.\n"
        f"- If the context does not contain information to answer the question, say 'The provided reports do not contain information about [topic]'.\n"
        f"- Do not invent, infer, or speculate beyond what is explicitly stated.\n\n"
        f"Answer:"
    )

    def _try(model_name: str, ctx: str) -> Tuple[bool, str]:
        try:
            r = requests.post(
                "http://localhost:11434/api/generate",
                json={"model": model_name, "prompt": ctx, "stream": False}, timeout=180
            )
        except Exception as e:
            return False, f"network:{e}"
        try:
            data = r.json()
        except Exception:
            return False, f"non-json:{r.text[:180]}"
        if r.status_code != 200:
            return False, json.dumps(data)[:300]
        out = data.get('response') or data.get('output') or ''
        if not out:
            return False, f"empty:{data}" 
        return True, out.strip()

    ok, primary = _try(GEN_MODEL, prompt)
    if ok:
        return primary
    
    lower_err = primary.lower()
    if any(k in lower_err for k in ["cuda", "oom", "terminated", "memory"]):
        logger.warning(f"GPU-related generation failure detected: {primary}")
        fallbacks = [f"{GEN_MODEL}-q4", "llama3:8b-q4", "llama3:8b-instruct"]
        for fm in fallbacks:
            ok2, res2 = _try(fm, prompt)
            if ok2:
                return res2 + "\n(Note: Quantized fallback model used due to GPU memory constraints.)"
        # Reduce context aggressively
        reduced = joined[-(MAX_SAFE_CHARS // 2):]
        reduced_prompt = prompt.replace(f"Context (Medical Reports):\n{joined}", f"Context (Reduced Extract):\n{reduced}")
        ok3, res3 = _try(GEN_MODEL, reduced_prompt)
        if ok3:
            return res3 + "\n(Note: Context reduced due to GPU memory constraints.)"
        raise HTTPException(status_code=500, detail=f"Generation GPU error; all fallbacks failed: {primary}")
    raise HTTPException(status_code=500, detail=f"Generation error: {primary}")

def _normalize_text(s: str) -> str:
    """Normalize Unicode and fix common mojibake artifacts from PDF/OCR."""
    if not isinstance(s, str):
        return s
    s = unicodedata.normalize('NFKC', s)
    replacements = {
        'â€¦': '…','â€"': '–','â€"': '—','â€˜': ''','â€™': ''','â€œ': '"','â€': '"',
        'Â·': '·','Â®': '®','Â©': '©','Â°': '°','Â±': '±','Â': ' '
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    s = s.replace('\r\n', '\n').replace('\r', '\n')
    s = '\n'.join(' '.join(line.split()) for line in s.split('\n'))
    return s.strip()

@app.post("/summarize/{patient_id}")
async def summarize_patient(
    request: Request,
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
        # Guard: only Medical Assistant role may generate summaries
        role = request.headers.get('X-User-Role') or request.headers.get('x-user-role') or ''
        if role.upper() == 'DOCTOR':
            raise HTTPException(status_code=403, detail="Doctors cannot generate summaries; use /summary/{patient_id}")
        # 1. Resolve display label & fetch report_ids
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT patient_display_name, patient_demo_id FROM patients WHERE patient_id=%s", (patient_id,))
        prow = cur.fetchone()
        if not prow:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
        display_name, patient_demo_id = prow[0], prow[1]
        label = display_name or patient_demo_id or str(patient_id)

        cur.execute("SELECT report_id, report_type FROM reports WHERE patient_id=%s ORDER BY report_id", (patient_id,))
        report_rows = cur.fetchall()
        report_ids = [r[0] for r in report_rows]
        report_types = [r[1] for r in report_rows]
        if not report_ids:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail=f"No reports found for patient_id={patient_id}")

        # Determine patient type for prompt selection
        patient_type = _infer_patient_type(report_types)
        system_prompt = SPEECH_PROMPT if patient_type == "speech" else STANDARD_PROMPT
        logger.debug(f"Summarize patient_id={patient_id} type={patient_type} using prompt='{system_prompt[:60]}...'")

        # 2. Build embedding basis - use clinically-focused query for better retrieval
        if payload.keywords:
            embed_basis = " ".join(payload.keywords)
        else:
            # Clinically-focused query to boost FINDINGS/IMPRESSION sections, with optional chief complaint focus
            if payload.chief_complaint and payload.chief_complaint.strip():
                cc = payload.chief_complaint.strip()
                embed_basis = f"clinical findings diagnosis impression abnormalities related to {cc} key findings radiological findings pathology results"
            else:
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
        summary_text = _generate_summary([t for _,_,t,_ in context_accum], label, system_prompt)

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
        # Ensure schema support (table/column) before persist
        ensure_summary_support()
        # 7. Persist summary & mark chart prepared
        try:
            conn2 = get_db_connection(); cur2 = conn2.cursor()
            # Upsert patient_summaries
            cur2.execute("""
                INSERT INTO patient_summaries (patient_id, summary_text, patient_type, chief_complaint, citations)
                VALUES (%s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (patient_id) DO UPDATE
                  SET summary_text = EXCLUDED.summary_text,
                      patient_type = EXCLUDED.patient_type,
                      chief_complaint = EXCLUDED.chief_complaint,
                      citations = EXCLUDED.citations,
                      generated_at = CURRENT_TIMESTAMP
            """, (patient_id, summary_text, patient_type, payload.chief_complaint, json.dumps(citations)))
            cur2.execute("UPDATE patients SET chart_prepared_at = CURRENT_TIMESTAMP WHERE patient_id=%s", (patient_id,))
            conn2.commit(); cur2.close(); conn2.close()
        except Exception as e:
            logger.warning(f"Failed to persist summary for patient {patient_id}: {e}")
        return {"summary_text": summary_text, "citations": citations}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Summarization error for patient_id {patient_id}")
        raise HTTPException(status_code=500, detail=f"Summarization error: {e}")


@app.post("/chat/{patient_id}")
async def chat_with_patient(
    patient_id: int = Path(..., description="The numeric patient_id to query"),
    payload: ChatRequest = Body(...)
):
    """Answer a specific question about a patient using RAG-based retrieval.
    
    Steps:
    - Resolve patient and fetch their report_ids
    - Use the question to create a semantically relevant embedding query
    - Run hybrid search (structured sections, similarity, optional keywords)
    - Generate an answer using only the retrieved context
    - Return answer with citations
    """
    try:
        # 1. Resolve patient and get report_ids
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

        # 2. Build embedding basis from the question itself
        if payload.keywords:
            embed_basis = " ".join(payload.keywords) + " " + payload.question
        else:
            # Use the question directly for semantic search
            embed_basis = payload.question
        
        query_embedding = _embed_text(embed_basis)
        if len(query_embedding) != 768:
            raise HTTPException(status_code=500, detail=f"Embedding dimension {len(query_embedding)} != 768")
        embedding_literal = '[' + ','.join(f'{x:.6f}' for x in query_embedding) + ']'

        # 3. Retrieval using same hybrid logic as summarize
        similarity_chunks: List[Tuple[int, int, str, dict]] = []
        keyword_chunks: List[Tuple[int, int, str, dict]] = []
        structured_chunks: List[Tuple[int, int, str, dict]] = []
        
        placeholders = ','.join(['%s'] * len(report_ids))
        
        # 3a. Force-include key structured sections
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
        
        # 3b. Similarity search
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
        
        # 3c. Optional keyword search
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

        # 4. Merge and deduplicate - prioritize structured, then keywords, then similarity
        seen = set(); merged: List[Tuple[int,int,str,dict]] = []
        for cid,rid,txt,meta in structured_chunks:
            sig = txt[:200]
            if sig in seen: continue
            seen.add(sig); merged.append((cid,rid,txt,meta))
        for cid,rid,txt,meta in keyword_chunks:
            sig = txt[:200]
            if sig in seen: continue
            seen.add(sig); merged.append((cid,rid,txt,meta))
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
            raise HTTPException(status_code=404, detail=f"No relevant context found for question")

        # 5. Generate answer using the question-focused prompt
        answer_text = _answer_question([t for _,_,t,_ in context_accum], payload.question)

        # 6. Build citations
        citations = []
        PREVIEW_LEN = 160
        for cid,rid,txt,meta in context_accum:
            norm_full = _normalize_text(txt)
            preview = norm_full[:PREVIEW_LEN] + ("…" if len(norm_full) > PREVIEW_LEN else "")
            enriched_meta = (meta or {}).copy()
            enriched_meta.setdefault('report_id', rid)
            citations.append({
                "source_chunk_id": cid,
                "report_id": rid,
                "source_text_preview": preview,
                "source_full_text": norm_full,
                "source_metadata": enriched_meta
            })
        
        return {"answer": answer_text, "citations": citations}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Chat error for patient_id {patient_id}")
        raise HTTPException(status_code=500, detail=f"Chat error: {e}")


# ---------- Annotations Endpoints ----------
@app.post("/annotate", response_model=AnnotationResponse)
def create_annotation(payload: AnnotationRequest):
    """
    Save a doctor's note/annotation for a specific patient.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Verify patient exists
        cur.execute("SELECT patient_id FROM patients WHERE patient_id = %s", (payload.patient_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Patient {payload.patient_id} not found")
        
        # Insert annotation
        cur.execute(
            """
            INSERT INTO annotations (patient_id, doctor_note, selected_text, created_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            RETURNING annotation_id, patient_id, doctor_note, selected_text, created_at
            """,
            (payload.patient_id, payload.doctor_note, payload.selected_text)
        )
        row = cur.fetchone()
        conn.commit()
        
        return AnnotationResponse(
            annotation_id=row[0],
            patient_id=row[1],
            doctor_note=row[2],
            selected_text=row[3],
            created_at=row[4].isoformat()
        )
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.exception(f"Error creating annotation for patient {payload.patient_id}")
        raise HTTPException(status_code=500, detail=f"Annotation creation error: {e}")
    finally:
        if conn:
            conn.close()


@app.get("/annotations/{patient_id}", response_model=List[AnnotationResponse])
def get_annotations(patient_id: int = Path(..., description="Patient ID to fetch annotations for")):
    """
    Fetch all annotations/doctor notes for a specific patient, ordered by most recent first.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Verify patient exists
        cur.execute("SELECT patient_id FROM patients WHERE patient_id = %s", (patient_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
        
        # Fetch all annotations for this patient
        cur.execute(
            """
            SELECT annotation_id, patient_id, doctor_note, selected_text, created_at
            FROM annotations
            WHERE patient_id = %s
            ORDER BY created_at DESC
            """,
            (patient_id,)
        )
        rows = cur.fetchall()
        
        return [
            AnnotationResponse(
                annotation_id=row[0],
                patient_id=row[1],
                doctor_note=row[2],
                selected_text=row[3],
                created_at=row[4].isoformat()
            )
            for row in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching annotations for patient {patient_id}")
        raise HTTPException(status_code=500, detail=f"Annotation retrieval error: {e}")
    finally:
        if conn:
            conn.close()

@app.get("/summary/{patient_id}")
def fetch_patient_summary(patient_id: int = Path(..., description="Patient ID to fetch persisted summary for")):
    """Return persisted summary & citations if chart prepared; 404 if not available."""
    conn = None
    try:
        ensure_summary_support()
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT summary_text, patient_type, chief_complaint, citations, generated_at FROM patient_summaries WHERE patient_id=%s", (patient_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Summary not prepared")
        summary_text, patient_type, chief_complaint, citations_json, generated_at = row
        # citations_json is already JSONB; ensure proper Python structure
        citations = citations_json if isinstance(citations_json, list) else citations_json
        return {
            "summary_text": summary_text,
            "citations": citations,
            "patient_type": patient_type,
            "chief_complaint": chief_complaint,
            "generated_at": generated_at.isoformat() if hasattr(generated_at, 'isoformat') else str(generated_at)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Fetch summary error patient_id={patient_id}")
        # If table truly missing and creation failed, treat as not prepared
        if 'patient_summaries' in str(e).lower():
            raise HTTPException(status_code=404, detail="Summary not prepared")
        raise HTTPException(status_code=500, detail=f"Summary fetch error: {e}")
    finally:
        if conn:
            conn.close()

@app.get("/patients/doctor")
async def get_doctor_patients():
    """Return only patients whose chart has been prepared (summary exists)."""
    conn = None
    try:
        ensure_summary_support()
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""
            SELECT p.patient_id, p.patient_display_name, ps.generated_at
            FROM patients p
            JOIN patient_summaries ps ON ps.patient_id = p.patient_id
            ORDER BY ps.generated_at DESC
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [
            {
                "patient_id": r[0],
                "patient_display_name": r[1],
                "prepared_at": r[2].isoformat() if hasattr(r[2], 'isoformat') else str(r[2])
            } for r in rows
        ]
    except Exception as e:
        logger.exception("Doctor patients fetch error")
        raise HTTPException(status_code=500, detail=f"Doctor patients fetch error: {e}")
    finally:
        if conn:
            conn.close()


@app.post("/safety-check/{patient_id}", response_model=SafetyCheckResponse)
async def safety_check(
    patient_id: int = Path(..., description="Patient ID to check for allergies"),
    payload: SafetyCheckRequest = Body(...)
):
    """
    Check for drug allergies by searching patient's medical history using RAG.
    
    Uses hybrid search to find:
    - Allergy-related information in patient reports
    - Mentions of the specific drug or drug class
    - Known allergic reactions or sensitivities
    
    Returns warnings if potential allergies are detected.
    """
    try:
        # 1. Resolve patient and get report_ids
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT patient_display_name, patient_demo_id FROM patients WHERE patient_id=%s", (patient_id,))
        prow = cur.fetchone()
        if not prow:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
        display_name, patient_demo_id = prow[0], prow[1]
        label = display_name or patient_demo_id or str(patient_id)

        cur.execute("SELECT report_id FROM reports WHERE patient_id=%s ORDER BY report_id", (patient_id,))
        report_rows = cur.fetchall()
        report_ids = [r[0] for r in report_rows]
        if not report_ids:
            cur.close()
            conn.close()
            # No reports = no documented allergies
            return SafetyCheckResponse(
                has_allergy=False,
                warnings=[],
                allergy_details=None,
                citations=[]
            )

        # 2. Build search query focused on allergies + drug name
        drug_name = payload.drug_name.strip()
        search_query = f"allergy allergies allergic reaction {drug_name}"
        
        query_embedding = _embed_text(search_query)
        if len(query_embedding) != 768:
            raise HTTPException(status_code=500, detail=f"Embedding dimension {len(query_embedding)} != 768")
        embedding_literal = '[' + ','.join(f'{x:.6f}' for x in query_embedding) + ']'

        # 3. Hybrid retrieval: keyword + similarity search for allergy-related content
        placeholders = ','.join(['%s'] * len(report_ids))
        
        # 3a. Keyword search for allergy mentions
        allergy_keywords = ['allergy', 'allergies', 'allergic', 'hypersensitivity', 'adverse reaction']
        patterns = [f"%{kw}%" for kw in allergy_keywords]
        ors = " OR ".join([f"pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text ILIKE %s" for _ in patterns])
        params: List[str] = []
        for ptn in patterns:
            params.extend([ENCRYPTION_KEY, ptn])
        
        keyword_sql = f"""
            SELECT DISTINCT c.chunk_id,
                   c.report_id,
                   pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text AS chunk_text,
                   c.source_metadata
            FROM report_chunks c
            WHERE c.report_id IN ({placeholders})
            AND ({ors})
            LIMIT 10
        """
        cur.execute(keyword_sql, [ENCRYPTION_KEY, *report_ids, *params])
        keyword_chunks = []
        for row in cur.fetchall():
            if row and row[2]:
                keyword_chunks.append((row[0], row[1], row[2], row[3]))
        
        # 3b. Similarity search with allergy-focused query
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
            LIMIT 5
        """
        cur.execute(similarity_sql, (embedding_literal, ENCRYPTION_KEY, *report_ids))
        similarity_chunks = []
        for row in cur.fetchall():
            if row and row[2]:
                similarity_chunks.append((row[0], row[1], row[2], row[3]))
        
        # 3c. Also search clinical annotations for allergy mentions
        cur.execute(
            """
            SELECT annotation_id, doctor_note, created_at
            FROM annotations
            WHERE patient_id = %s
            AND (doctor_note ILIKE %s OR doctor_note ILIKE %s OR doctor_note ILIKE %s)
            ORDER BY created_at DESC
            """,
            (patient_id, '%allerg%', '%hypersensitiv%', '%adverse reaction%')
        )
        annotation_rows = cur.fetchall()
        
        # 4. Combine and deduplicate chunks
        seen_chunk_ids = set()
        all_chunks = []
        for chunk_tuple in (keyword_chunks + similarity_chunks):
            chunk_id = chunk_tuple[0]
            if chunk_id not in seen_chunk_ids:
                seen_chunk_ids.add(chunk_id)
                all_chunks.append(chunk_tuple)
        
        cur.close()
        conn.close()
        
        if not all_chunks and not annotation_rows:
            # No allergy information found
            return SafetyCheckResponse(
                has_allergy=False,
                warnings=[],
                allergy_details=None,
                citations=[]
            )
        
        # 5. Analyze chunks for drug-specific allergies
        drug_lower = drug_name.lower()
        has_allergy = False
        warnings = []
        allergy_details_parts = []
        citations = []
        
        # 5a. Check annotations first (most recent clinical notes)
        for annotation_id, doctor_note, created_at in annotation_rows:
            note_lower = doctor_note.lower()
            
            # Check if annotation mentions the specific drug
            if drug_lower in note_lower:
                has_allergy = True
                warnings.append(f"⚠️ Clinical note mentions {drug_name} allergy")
                allergy_details_parts.append(doctor_note)
                
                citations.append({
                    "annotation_id": annotation_id,
                    "text": doctor_note[:200] + ('...' if len(doctor_note) > 200 else ''),
                    "source": "Clinical Annotation",
                    "date": created_at.isoformat() if hasattr(created_at, 'isoformat') else str(created_at)
                })
        
        # 5b. Check report chunks
        for chunk_id, report_id, chunk_text, metadata in all_chunks:
            chunk_lower = chunk_text.lower()
            
            # Check if this chunk mentions the specific drug
            if drug_lower in chunk_lower:
                # Drug mentioned in allergy-related context
                has_allergy = True
                warnings.append(f"Patient has documented information about {drug_name} in medical history")
                
                # Extract relevant lines
                lines = chunk_text.split('\n')
                for line in lines:
                    if drug_lower in line.lower() and any(kw in line.lower() for kw in allergy_keywords):
                        allergy_details_parts.append(line.strip())
            
            # Check for general allergy keywords
            if any(kw in chunk_lower for kw in allergy_keywords):
                # Build citation
                citations.append({
                    "chunk_id": chunk_id,
                    "report_id": report_id,
                    "text": chunk_text[:200] + ('...' if len(chunk_text) > 200 else ''),
                    "metadata": metadata
                })
        
        # 6. Compile response
        allergy_details = ' | '.join(allergy_details_parts) if allergy_details_parts else None
        
        if not allergy_details and citations:
            # Found allergy mentions but not specifically about this drug
            allergy_details = "Allergy history found in patient records. Please review citations for details."
            warnings.append("Patient has documented allergies in medical history - review before prescribing")
        
        return SafetyCheckResponse(
            has_allergy=has_allergy or len(warnings) > 0,
            warnings=warnings,
            allergy_details=allergy_details,
            citations=citations
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error in safety check for patient {patient_id}")
        raise HTTPException(status_code=500, detail=f"Safety check error: {e}")