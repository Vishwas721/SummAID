import os
import json
import logging
import unicodedata
import asyncio
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
from fastapi import FastAPI, HTTPException, Body, Path, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import get_db_connection
import requests
from pydantic import BaseModel, Field
from routers.patient_router import router as patient_router
from schemas import AIResponseSchema, UniversalData, OncologyData, SpeechData
from parallel_prompts import _generate_structured_summary_parallel

# =============================================================================
# DATABASE UTILITIES
# =============================================================================

def get_all_chunks_for_patient(patient_id: int) -> List[Tuple[int, int, str, dict]]:
    """
    Retrieve all decrypted text chunks for a given patient from PostgreSQL.
    
    Args:
        patient_id: The patient ID to retrieve chunks for
        
    Returns:
        List of tuples: (chunk_id, report_id, chunk_text, source_metadata)
        
    Raises:
        HTTPException: If patient not found or database error occurs
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get all report IDs for this patient
        cur.execute("SELECT report_id FROM reports WHERE patient_id=%s ORDER BY report_id", (patient_id,))
        report_rows = cur.fetchall()
        report_ids = [r[0] for r in report_rows]
        
        if not report_ids:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail=f"No reports found for patient_id={patient_id}")
        
        # Retrieve all chunks for these reports, decrypted with metadata
        placeholders = ','.join(['%s'] * len(report_ids))
        chunk_sql = f"""
            SELECT 
                c.chunk_id,
                c.report_id,
                pgp_sym_decrypt(c.chunk_text_encrypted, %s)::text AS chunk_text,
                c.source_metadata
            FROM report_chunks c
            WHERE c.report_id IN ({placeholders})
            ORDER BY c.report_id, c.chunk_id
        """
        cur.execute(chunk_sql, [ENCRYPTION_KEY, *report_ids])
        rows = cur.fetchall()
        
        chunks = [(row[0], row[1], row[2], row[3]) for row in rows if row and row[2]]
        
        cur.close()
        conn.close()
        
        if not chunks:
            raise HTTPException(status_code=404, detail=f"No text chunks found for patient_id={patient_id}")
        
        return chunks
        
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.close()
        logger.exception(f"Error retrieving chunks for patient {patient_id}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


async def generate_parallel_summary(full_context: str, patient_label: str = "Patient", patient_type: str = "general") -> Dict[str, Any]:
    """
    Generate a structured medical summary using parallel prompt extraction.
    
    This is a wrapper around _generate_structured_summary_parallel that:
    - Takes a single context string and splits it appropriately
    - Returns a parsed Python dict in AIResponseSchema format
    - Includes universal, oncology, and speech sections
    
    Args:
        full_context: Concatenated medical report text
        patient_label: Patient identifier for logging
        patient_type: Type hint (oncology, speech, general)
        
    Returns:
        Dictionary with AIResponseSchema structure: {universal, oncology, speech, specialty, generated_at}
    """
    # Split context into reasonable chunks (if very large)
    MAX_CHUNK_SIZE = 8000
    if len(full_context) > MAX_CHUNK_SIZE:
        # Split into overlapping chunks
        chunks = []
        step = MAX_CHUNK_SIZE // 2
        for i in range(0, len(full_context), step):
            chunk = full_context[i:i+MAX_CHUNK_SIZE]
            if chunk.strip():
                chunks.append(chunk)
    else:
        chunks = [full_context]
    
    # Call parallel extraction system
    summary_json = await _generate_structured_summary_parallel(
        context_chunks=chunks,
        patient_label=patient_label,
        patient_type_hint=patient_type,
        model=None  # Uses DEFAULT_MODEL from environment
    )
    
    # Parse JSON response - already in AIResponseSchema format
    summary_dict = json.loads(summary_json)
    
    # Return the complete structured response with specialty data intact
    return summary_dict

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
        # Add demographic columns (age, sex) if missing (Task: augment patients schema)
        try:
            cur.execute("ALTER TABLE patients ADD COLUMN IF NOT EXISTS age INT NULL")
        except Exception as e:
            logger.warning(f"age alter warning (non-fatal): {e}")
        try:
            cur.execute("ALTER TABLE patients ADD COLUMN IF NOT EXISTS sex TEXT NULL")
        except Exception as e:
            logger.warning(f"sex alter warning (non-fatal): {e}")
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
        # Add last_edited_at column when missing (do this even if table existed before)
        try:
            cur.execute("ALTER TABLE patient_summaries ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP NULL")
        except Exception as e:
            logger.warning(f"last_edited_at alter warning (non-fatal): {e}")
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
    allow_origins=[
        FRONTEND_ORIGIN, 
        "http://localhost:5173", 
        "http://127.0.0.1:5173"
    ],  # Explicitly allow common frontend origins
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
            SELECT patient_id, patient_display_name, age, sex
            FROM patients
            ORDER BY patient_display_name
        """)
        rows = cur.fetchall()
        patients = [
            {
                "patient_id": r[0],
                "patient_display_name": r[1],
                "age": r[2],
                "sex": r[3]
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
# LLM-agnostic model selection now centralized in config.py
from config import LLM_MODEL_NAME, GENERATION_OPTIONS, FALLBACK_MODELS

# System prompts
STANDARD_PROMPT = (
    "You are an expert medical AI assistant. Generate a comprehensive, structured medical summary in Markdown format.\n\n"
    "**FORMATTING RULES:**\n"
    "- Use ## for section headers (e.g., ## Patient History)\n"
    "- For bullet points, ALWAYS use this format:\n"
    "  - First item\n"
    "  - Second item\n"
    "  - Third item\n"
    "- Each bullet point MUST be on its own line with a line break after it\n"
    "- For lab values/vitals, create a markdown table:\n"
    "  | Test | Value | Reference Range | Flag |\n"
    "  |------|-------|----------------|------|\n"
    "  | WBC | 12.5 | 4.5-11.0 | High |\n\n"
    "**REQUIRED SECTIONS:**\n"
    "## Patient History & Chief Complaint\n"
    "Brief overview in 2-3 sentences.\n\n"
    "## Key Findings\n"
    "- Finding 1\n"
    "- Finding 2\n"
    "- Finding 3\n\n"
    "## Lab Results & Vitals\n"
    "Use markdown table format for any lab values or measurements.\n\n"
    "## Diagnosis & Impression\n"
    "Clear diagnostic statement.\n\n"
    "## Plan & Recommendations\n"
    "- Recommendation 1\n"
    "- Recommendation 2\n\n"
    "Keep tone professional and clinically accurate. Avoid conversational filler."
)
SPEECH_PROMPT = (
    "You are an expert medical AI assistant. Generate a comprehensive, structured medical summary in Markdown format.\n\n"
    "**FORMATTING RULES:**\n"
    "- Use ## for section headers (e.g., ## Patient History)\n"
    "- For bullet points, ALWAYS use this format:\n"
    "  - First item\n"
    "  - Second item\n"
    "  - Third item\n"
    "- Each bullet point MUST be on its own line with a line break after it\n"
    "- For lab values/vitals, create a markdown table:\n"
    "  | Test | Value | Reference Range | Flag |\n"
    "  |------|-------|----------------|------|\n"
    "  | WBC | 12.5 | 4.5-11.0 | High |\n\n"
    "**REQUIRED SECTIONS:**\n"
    "## Patient History & Chief Complaint\n"
    "Brief overview in 2-3 sentences.\n\n"
    "## Key Findings\n"
    "- Finding 1\n"
    "- Finding 2\n"
    "- Finding 3\n\n"
    "## Lab Results & Vitals\n"
    "Use markdown table format for any lab values or measurements.\n\n"
    "## Diagnosis & Impression\n"
    "Clear diagnostic statement.\n\n"
    "## Plan & Recommendations\n"
    "- Recommendation 1\n"
    "- Recommendation 2\n\n"
    "Keep tone professional and clinically accurate. Avoid conversational filler."
)
SPEECH_PROMPT = (
    "You are an expert medical AI assistant specializing in comprehensive clinical documentation. Generate a structured medical summary using the exact hierarchy below.\n\n"
    "## PATIENT OVERVIEW\n"
    "- Name, Age, Sex, DOB\n"
    "- **Primary Diagnosis** (in bold, first line)\n"
    "- Report Date Range: [earliest] to [latest]\n\n"
    "## DIAGNOSIS & CLASSIFICATION\n"
    "- Primary diagnosis with severity grade\n"
    "- Secondary diagnoses (ICD codes if available)\n"
    "- Etiology/likely cause if stated\n\n"
    "## CLINICAL TIMELINE (Chronological)\n"
    "**CRITICAL:** Always sort timeline entries from OLDEST to NEWEST.\n"
    "- Format: YYYY-MM-DD - Event description\n"
    "- If exact date unknown but sequence is clear, use \"Early/Mid/Late [Month Year]\"\n"
    "- Example:\n"
    "  - 2024-11-15 - Initial evaluation: bilateral SNHL diagnosed\n"
    "  - 2024-11-20 - Bilateral Phonak Sky hearing aids fitted\n"
    "  - 2025-02-10 - Progress check: improved compliance and MLU gains\n\n"
    "## KEY FINDINGS BY SYSTEM\n"
    "Organized by body system or specialty:\n"
    "- **Audiology**: [thresholds, configurations, reflexes]\n"
    "- **Speech-Language**: [MLU, articulation, comprehension]\n"
    "- **Device/Equipment**: [specific brand names, models when available - e.g., \"Phonak Sky\" not \"hearing aids\"]\n\n"
    "## FUNCTIONAL STATUS & QUALITY OF LIFE\n"
    "- **Baseline symptoms**: [patient/family reported limitations from earliest report]\n"
    "- **Current status**: [how symptoms have changed - be specific]\n"
    "- **School/work impact**: [specific examples of participation, attention, performance]\n"
    "- **Caregiver burden**: [compliance challenges, support needed, family training]\n\n"
    "## INTERVENTIONS & RESPONSE\n"
    "**Treatment Timeline (Chronological):**\n"
    "- **What was started**: [device/medication/therapy with brand/model/dosage]\n"
    "- **When started**: [actual date - never write \"[date]\", use real date or \"date not specified\"]\n"
    "- **Initial response**: [side effects, acceptance, immediate outcomes]\n"
    "- **Adjustments**: [changes to treatment plan over time]\n"
    "- **Compliance/adherence**: [quantitative data - quote exactly as written, do not fabricate]\n\n"
    "**Treatment Response Tracking:**\n"
    "For quantitative measures, always show: Baseline → Latest (% change or delta)\n"
    "- Use symbols: ↑ for improvement, ↓ for decline, → for stable\n"
    "- Example: \"MLU: 2.2 words (2024-11-15) → 3.5 words (2025-02-10) [+1.3 words, +59% ↑]\"\n"
    "- Example: \"Hearing aid usage: 2-3 hours/day (2024-11-20) → 9.5 hours/day (2025-02-10) [+7 hours ↑]\"\n\n"
    "## OBJECTIVE MEASUREMENTS (Table format)\n"
    "| Date | Test | Value | Reference Range | Interpretation |\n"
    "| :--- | :--- | :--- | :--- | :--- |\n"
    "| YYYY-MM-DD | [Test Name] | [Value] | [Range] | [Clinical meaning] |\n\n"
    "**CRITICAL:** Flag only TRUE abnormals - use clinical judgment, not just lab ranges. Do NOT mark values as abnormal if they are expected/consistent with the diagnosis.\n\n"
    "## OUTSTANDING ISSUES & RED FLAGS\n"
    "- Any safety concerns (progressive loss, infections, non-compliance)\n"
    "- Pending workups (genetic testing, imaging, consultations)\n"
    "- Medical clearances needed\n"
    "- **Missing critical data**: If a test/value should have been documented but wasn't mentioned, flag it:\n"
    "  Example: \"⚠️ Genetic testing for hereditary SNHL not mentioned\"\n"
    "  Example: \"⚠️ OAE results not documented\"\n\n"
    "## CURRENT MANAGEMENT PLAN\n"
    "1. Active treatments with frequency (include brand names, models, specific therapy types)\n"
    "2. Upcoming goals (specific, measurable)\n"
    "3. Next follow-up date and purpose\n\n"
    "## PROGNOSIS\n"
    "- Short-term outlook\n"
    "- Long-term functional expectations\n\n"
    "---\n\n"
    "**CRITICAL RULES:**\n"
    "1. NEVER mark values as \"abnormal\" if they're expected/consistent with diagnosis\n"
    "2. Age for pediatric patients MUST appear in first 2 lines\n"
    "3. Use past tense for completed findings, present tense for current status\n"
    "4. Quantify whenever possible (use numbers, percentages, dates)\n"
    "5. Distinguish between \"not done\" vs \"within normal limits\"\n"
    "6. For serial reports: highlight CHANGES between timepoints with deltas and percentages\n"
    "7. If multiple specialists: clearly label which findings came from whom\n"
    "8. Extract data EXACTLY as stated - do not invent or infer values not present\n"
    "9. For compliance data: quote exactly as written (e.g., \"2-3 hours\"), do not average or fabricate\n"
    "10. Distinguish metric types carefully (e.g., SRT vs Presentation Level, Detection vs Production)\n"
    "11. NEVER write placeholder text like \"[date]\" or \"[value]\" - extract actual data or write \"Not documented\"\n"
    "12. Always sort chronological sections from OLDEST to NEWEST\n"
    "13. Include device/medication brand names and models when available\n"
    "14. Show treatment response with Baseline → Latest format and calculate change percentages\n\n"
    "**CRITICAL DATA EXTRACTION RULES:**\n"
    "15. **NEVER omit test results mentioned in source documents**\n"
    "    - If document mentions \"OAE absent\", it MUST appear in summary\n"
    "    - If document mentions \"bone conduction\", it MUST appear in summary\n"
    "    - If document mentions \"acoustic reflexes\", it MUST appear in summary\n"
    "    - ALL mentioned test results are clinically relevant - do not filter them out\n\n"
    "16. **Quantitative Comparisons - ALWAYS calculate and show:**\n"
    "    - Baseline value with date\n"
    "    - Follow-up value with date\n"
    "    - Absolute change (e.g., +1.3 words, +7 hours/day)\n"
    "    - Percent change (e.g., +59%, +233%)\n"
    "    - Direction symbol: ↑ improvement, ↓ decline, → stable\n"
    "    - Example format: \"MLU: 2.2 words (2024-11-15) → 3.5 words (2025-02-10) [+1.3 words, +59% ↑]\"\n\n"
    "17. **Date Inference:**\n"
    "    - If document says \"two weeks ago\" on Date X, calculate Date X minus 14 days\n"
    "    - Format approximations as \"~YYYY-MM-DD\" to indicate calculated date\n"
    "    - If month/year only: use first day of month (e.g., \"November 2024\" → \"2024-11-01\")\n\n"
    "18. **Compliance Data - ALWAYS extract:**\n"
    "    - Quantitative wear time/adherence data (hours per day, frequency)\n"
    "    - Show trajectory: Initial → Current with dates\n"
    "    - Include any barriers to compliance mentioned\n"
    "    - Example: \"Hearing aid usage: 2-3 hours/day (2024-11-20) → 9.5 hours/day (2025-02-10) [+7 hours ↑]\"\n\n"
    "19. **Functional Outcomes - Extract ALL mentions of:**\n"
    "    - Real-world impact (school performance, home communication, social participation)\n"
    "    - Teacher reports/observations\n"
    "    - Parent/caregiver feedback\n"
    "    - These are as clinically important as test scores\n\n"
    "20. **OUTSTANDING ISSUES & RED FLAGS section is MANDATORY:**\n"
    "    - Never omit this section\n"
    "    - If no issues found in documents, write: \"No acute safety concerns identified at this time\"\n"
    "    - If documents are silent on expected tests, flag as: \"⚠️ [Test name] not documented\"\n"
    "    - Always include any progressive conditions, non-compliance, or pending workups"
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


class SaveSummaryRequest(BaseModel):
    patient_id: int = Field(..., description="Patient ID to save summary for")
    summary_text: str = Field(..., description="Edited summary text to persist as official version")


class SummaryResponse(BaseModel):
    """Response model for /summarize endpoint using AIResponseSchema format"""
    universal: dict = Field(..., description="Universal data: evolution, current_status, plan")
    oncology: Optional[dict] = Field(None, description="Oncology-specific data")
    speech: Optional[dict] = Field(None, description="Speech/audiology data")
    specialty: Optional[str] = Field(None, description="Classified specialty")
    generated_at: Optional[str] = Field(None, description="Generation timestamp")
    citations: List[dict] = Field(default_factory=list, description="Source citations with chunk IDs and report IDs")

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
    
    # Check if using the new structured SPEECH_PROMPT format
    if system_prompt == SPEECH_PROMPT:
        # New format: prompt is self-contained with its own structure
        prompt = f"{system_prompt}\n\n**PATIENT DATA (Medical Reports):**\n{joined}\n\n**Generate the summary now:**"
    else:
        # Legacy STANDARD_PROMPT format with additional formatting rules
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

    def _try(model_name: str, ctx: str, use_cpu: bool = False) -> Tuple[bool, str]:
        try:
            options_dict = {
                "temperature": 0.1,
                "num_ctx": 4096 if use_cpu else 8192,
                "top_p": 0.9,
                "repeat_penalty": 1.1
            }
            if use_cpu:
                options_dict["num_gpu"] = 0
            
            r = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model_name,
                    "prompt": ctx,
                    "stream": False,
                    "options": options_dict
                },
                timeout=600 if use_cpu else 300
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

    ok, primary = _try(LLM_MODEL_NAME, prompt)
    if ok:
        return primary
    lower_err = primary.lower()
    if any(k in lower_err for k in ["cuda", "oom", "terminated", "memory"]):
        logger.warning(f"GPU-related generation failure detected: {primary}")
        
        # Try CPU-only mode with original model first
        logger.info("Attempting CPU-only inference...")
        ok_cpu, res_cpu = _try(LLM_MODEL_NAME, prompt, use_cpu=True)
        if ok_cpu:
            return res_cpu + "\n(Note: Generated using CPU due to GPU constraints.)"
        
        # Try smaller models
        fallbacks = ["qwen2.5:7b-instruct-q4_K_M", "qwen2.5:3b-instruct-q4_K_M", "llama3.2:3b-instruct-q4_K_M"]
        for fm in FALLBACK_MODELS:
            ok2, res2 = _try(fm, prompt)
            if ok2:
                return res2 + "\n(Note: Smaller model used due to GPU memory constraints.)"
        
        # Last resort: reduced context
        reduced = joined[-(MAX_SAFE_CHARS // 2):]
        if "Context:\n{joined}" in prompt:
            reduced_prompt = prompt.replace(f"Context:\n{joined}", f"Context (Reduced Extract):\n{reduced}")
        else:
            reduced_prompt = prompt.replace(joined, reduced)
        ok3, res3 = _try(LLM_MODEL_NAME, reduced_prompt)
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

    def _try(model_name: str, ctx: str, use_cpu: bool = False) -> Tuple[bool, str]:
        try:
            options_dict = {
                "temperature": 0.1,
                "num_ctx": 4096 if use_cpu else 8192,
                "top_p": 0.9,
                "repeat_penalty": 1.1
            }
            if use_cpu:
                options_dict["num_gpu"] = 0
            
            r = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model_name,
                    "prompt": ctx,
                    "stream": False,
                    "options": options_dict
                },
                timeout=600 if use_cpu else 300
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

    ok, primary = _try(LLM_MODEL_NAME, prompt)
    if ok:
        return primary
    
    lower_err = primary.lower()
    if any(k in lower_err for k in ["cuda", "oom", "terminated", "memory"]):
        logger.warning(f"GPU-related generation failure detected: {primary}")
        
        # Try CPU-only mode first
        logger.info("Attempting CPU-only inference for question answering...")
        ok_cpu, res_cpu = _try(LLM_MODEL_NAME, prompt, use_cpu=True)
        if ok_cpu:
            return res_cpu + "\n(Note: Generated using CPU due to GPU constraints.)"
        
        fallbacks = ["qwen2.5:7b-instruct-q4_K_M", "qwen2.5:3b-instruct-q4_K_M", "llama3.2:3b-instruct-q4_K_M"]
        for fm in FALLBACK_MODELS:
            ok2, res2 = _try(fm, prompt)
            if ok2:
                return res2 + "\n(Note: Smaller model used due to GPU memory constraints.)"
        # Reduce context aggressively
        reduced = joined[-(MAX_SAFE_CHARS // 2):]
        reduced_prompt = prompt.replace(f"Context (Medical Reports):\n{joined}", f"Context (Reduced Extract):\n{reduced}")
        ok3, res3 = _try(LLM_MODEL_NAME, reduced_prompt)
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
    """Summarize using patient_id with full RAG logic.

    Implementation:
    1. Retrieve all text chunks from PostgreSQL using get_all_chunks_for_patient()
    2. Check if chunks is empty; raise 404 if no data
    3. Concatenate chunks into single full_context string
    4. Pass full_context to generate_parallel_summary()
    5. Return structured response with evolution, labs, key_findings, recommendations
    """
    try:
        # Guard: only Medical Assistant role may generate summaries
        role = request.headers.get('X-User-Role') or request.headers.get('x-user-role') or ''
        if role.upper() == 'DOCTOR':
            raise HTTPException(status_code=403, detail="Doctors cannot generate summaries; use /summary/{patient_id}")
        
        # 1. Resolve patient display name for labeling
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
        
        # Determine patient type from report_types
        cur.execute("SELECT report_type FROM reports WHERE patient_id=%s", (patient_id,))
        report_types = [r[0] for r in cur.fetchall()]
        patient_type = _infer_patient_type(report_types)
        
        cur.close()
        conn.close()
        
        # 2. Retrieve all chunks from database (with metadata for citations)
        logger.info(f"Retrieving chunks for patient {patient_id}")
        chunk_data = get_all_chunks_for_patient(patient_id)
        
        # 3. Check if empty
        if not chunk_data:
            raise HTTPException(status_code=404, detail=f"No text chunks found for patient_id={patient_id}")
        
        # 4. Extract text for context and prepare citations
        chunk_texts = [chunk[2] for chunk in chunk_data]  # Extract chunk_text
        full_context = "\n\n".join(chunk_texts)
        logger.info(f"Context prepared: {len(full_context)} characters from {len(chunk_data)} chunks")
        
        # Build citations array with preview and full text
        PREVIEW_LEN = 160
        def _classify_sections(chunk_text: str, metadata: dict) -> list:
            """Heuristic mapping of a source chunk to summary sections.
            We do not have explicit model-level provenance, so we approximate based on keywords and report_type.
            Returns list of section keys: evolution | labs | key_findings | recommendations | oncology | speech.
            """
            sections = set()
            lower = chunk_text.lower()
            rpt_type = (metadata or {}).get('report_type', '')
            if rpt_type:
                if 'onco' in rpt_type.lower() or 'cancer' in lower:
                    sections.add('oncology')
                if 'audiology' in rpt_type.lower() or 'speech' in rpt_type.lower() or 'hearing' in lower:
                    sections.add('speech')
                if 'lab' in rpt_type.lower() or 'panel' in lower:
                    sections.add('labs')
            # Keyword heuristics
            if any(k in lower for k in ['bp', 'blood pressure', 'lab', 'wbc', 'hgb', 'platelet', 'potassium', 'sodium']):
                sections.add('labs')
            if any(k in lower for k in ['recommend', 'continue', 'start', 'increase', 'decrease', 'follow up', 'monitor']):
                sections.add('recommendations')
            if any(k in lower for k in ['tumor', 'metastas', 'chemo', 'radiation', 'oncology', 'lesion']):
                sections.add('oncology')
            if any(k in lower for k in ['audiogram', 'tymp', 'speech discrimination', 'tinnitus', 'hearing']):
                sections.add('speech')
            # Findings keywords
            if any(k in lower for k in ['findings', 'impression', 'assessment', 'noted', 'observed']):
                sections.add('key_findings')
            # Default fallback always include evolution narrative
            sections.add('evolution')
            return list(sorted(sections))

        citations = []
        for chunk_id, report_id, chunk_text, metadata in chunk_data:
            norm_full = _normalize_text(chunk_text)
            preview = norm_full[:PREVIEW_LEN] + ("…" if len(norm_full) > PREVIEW_LEN else "")
            enriched_meta = (metadata or {}).copy()
            enriched_meta.setdefault('report_id', report_id)
            sections = _classify_sections(norm_full, enriched_meta)
            citations.append({
                "source_chunk_id": chunk_id,
                "report_id": report_id,
                "source_text_preview": preview,
                "source_full_text": norm_full,
                "source_metadata": enriched_meta,
                "sections": sections
            })
        
        # 5. Generate summary using parallel prompt system
        logger.info(f"Generating parallel summary for patient {patient_id} ({patient_type})")
        summary_dict = await generate_parallel_summary(
            full_context=full_context,
            patient_label=label,
            patient_type=patient_type
        )
        
        # 6. Build response with AIResponseSchema structure + citations
        # summary_dict now contains: {universal, oncology, speech, specialty, generated_at}
        response_data = {
            "universal": summary_dict.get("universal", {}),
            "oncology": summary_dict.get("oncology"),
            "speech": summary_dict.get("speech"),
            "specialty": summary_dict.get("specialty", "general"),
            "generated_at": summary_dict.get("generated_at"),
            "citations": citations
        }
        
        # 7. Persist summary to database
        ensure_summary_support()
        try:
            conn2 = get_db_connection()
            cur2 = conn2.cursor()
            
            # Convert to JSON string for storage
            summary_text = json.dumps(response_data, indent=2)
            
            # Upsert patient_summaries with citations
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
            
            # Mark chart as prepared
            cur2.execute("UPDATE patients SET chart_prepared_at = CURRENT_TIMESTAMP WHERE patient_id=%s", (patient_id,))
            
            conn2.commit()
            cur2.close()
            conn2.close()
            
            logger.info(f"Summary persisted for patient {patient_id}")
        except Exception as e:
            logger.warning(f"Failed to persist summary for patient {patient_id}: {e}")
        
        return response_data
        
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
        citations = citations_json if isinstance(citations_json, list) else citations_json

        def _classify_sections(chunk_text: str, metadata: dict) -> list:
            sections = set(); lower = (chunk_text or '').lower(); rpt_type = (metadata or {}).get('report_type', '')
            if rpt_type:
                rt_low = rpt_type.lower()
                if 'onco' in rt_low or 'cancer' in lower: sections.add('oncology')
                if any(t in rt_low for t in ['audiology','speech']) or 'hearing' in lower: sections.add('speech')
                if 'lab' in rt_low or 'panel' in lower: sections.add('labs')
            if any(k in lower for k in ['bp','blood pressure','lab','wbc','hgb','platelet','potassium','sodium']): sections.add('labs')
            if any(k in lower for k in ['recommend','continue','start','increase','decrease','follow up','monitor']): sections.add('recommendations')
            if any(k in lower for k in ['tumor','metastas','chemo','radiation','oncology','lesion']): sections.add('oncology')
            if any(k in lower for k in ['audiogram','tymp','speech discrimination','tinnitus','hearing']): sections.add('speech')
            if any(k in lower for k in ['findings','impression','assessment','noted','observed']): sections.add('key_findings')
            sections.add('evolution'); return list(sorted(sections))

        changed = False
        if isinstance(citations, list):
            for c in citations:
                if isinstance(c, dict) and 'sections' not in c and 'source_full_text' in c:
                    c['sections'] = _classify_sections(c.get('source_full_text',''), c.get('source_metadata', {})); changed = True
        if changed:
            try:
                conn2 = get_db_connection(); cur2 = conn2.cursor()
                cur2.execute("UPDATE patient_summaries SET citations=%s::jsonb WHERE patient_id=%s", (json.dumps(citations), patient_id))
                conn2.commit(); cur2.close(); conn2.close()
            except Exception as _e:
                logger.debug(f"Citation upgrade persist failed for patient {patient_id}: {_e}")

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


@app.get("/report/{report_id}/pdf")
async def get_report_pdf(report_id: int = Path(..., description="Report ID to fetch PDF for")):
    """Fetch the original PDF file for a report to display alongside citations."""
    from fastapi.responses import Response
    
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get PDF file path from reports table
        cur.execute("""
            SELECT report_filepath_pointer, patient_id 
            FROM reports 
            WHERE report_id = %s
        """, (report_id,))
        
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
        
        pdf_path, patient_id = row[0], row[1]
        cur.close()
        conn.close()
        
        # Check if file exists
        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=404, detail=f"PDF file not found at {pdf_path}")
        
        # Read PDF file
        with open(pdf_path, 'rb') as f:
            pdf_content = f.read()
        
        logger.info(f"Serving PDF for report_id={report_id}, patient_id={patient_id}, size={len(pdf_content)} bytes")
        
        # Return PDF with proper content type
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=report_{report_id}.pdf",
                "Access-Control-Allow-Origin": FRONTEND_ORIGIN
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching PDF for report {report_id}")
        raise HTTPException(status_code=500, detail=f"Error fetching PDF: {e}")


@app.post("/save_summary")
def save_summary(payload: SaveSummaryRequest):
    """Save an edited summary as the official version and update last_edited_at."""
    conn = None
    try:
        ensure_summary_support()
        conn = get_db_connection(); cur = conn.cursor()
        # Upsert summary text and set last_edited_at
        cur.execute(
            """
            INSERT INTO patient_summaries (patient_id, summary_text, patient_type, chief_complaint, citations, generated_at, last_edited_at)
            VALUES (%s, %s, %s, %s, %s::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (patient_id) DO UPDATE
              SET summary_text = EXCLUDED.summary_text,
                  last_edited_at = CURRENT_TIMESTAMP
            """,
            (payload.patient_id, payload.summary_text, 'manual', None, '[]')
        )
        # Also mark patient as chart_prepared if not already
        try:
            cur.execute("UPDATE patients SET chart_prepared_at = CURRENT_TIMESTAMP WHERE patient_id=%s", (payload.patient_id,))
        except Exception:
            # non-critical
            pass
        conn.commit(); cur.close(); conn.close()
        return {"summary_text": payload.summary_text, "last_edited_at": datetime.utcnow().isoformat()}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.exception(f"Save summary error for patient {payload.patient_id}")
        raise HTTPException(status_code=500, detail=f"Save summary error: {e}")
    finally:
        if conn:
            conn.close()

@app.get("/patients/doctor")
async def get_doctor_patients():
    """Return all patients with preparation status (summary exists or not).
    
    Patients with prepared charts show generated_at timestamp.
    Patients without charts show prepared_at as null.
    """
    conn = None
    try:
        ensure_summary_support()
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""
            SELECT p.patient_id, p.patient_display_name, ps.generated_at
            FROM patients p
            LEFT JOIN patient_summaries ps ON ps.patient_id = p.patient_id
            ORDER BY ps.generated_at DESC NULLS LAST, p.patient_display_name
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()
        return [
            {
                "patient_id": r[0],
                "patient_display_name": r[1],
                "prepared_at": r[2].isoformat() if r[2] and hasattr(r[2], 'isoformat') else None
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
    logger.info(f"🚀 Safety check started for patient_id={patient_id}, drug={payload.drug_name}")
    try:
        # 1. Resolve patient and get report_ids
        conn = get_db_connection()
        cur = conn.cursor()
        logger.info(f"   Fetching patient data for patient_id={patient_id}")
        cur.execute("SELECT patient_display_name, patient_demo_id FROM patients WHERE patient_id=%s", (patient_id,))
        prow = cur.fetchone()
        logger.info(f"   Patient query result: {prow}")
        if not prow:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
        display_name, patient_demo_id = prow[0], prow[1]
        label = display_name or patient_demo_id or str(patient_id)

        logger.info(f"   Fetching reports for patient_id={patient_id}")
        cur.execute("SELECT report_id FROM reports WHERE patient_id=%s ORDER BY report_id", (patient_id,))
        report_rows = cur.fetchall()
        report_ids = [r[0] for r in report_rows]
        logger.info(f"   Found {len(report_ids)} reports: {report_ids}")
        
        # Fetch latest summary text
        logger.info(f"   Fetching summary for patient_id={patient_id}")
        cur.execute("SELECT summary_text FROM patient_summaries WHERE patient_id=%s ORDER BY generated_at DESC LIMIT 1", (patient_id,))
        summary_row = cur.fetchone()
        summary_text = summary_row[0] if summary_row else ""
        logger.info(f"   Summary found: {bool(summary_text)} (length: {len(summary_text) if summary_text else 0})")

        if not report_ids and not summary_text:
            logger.info(f"   ✅ No reports or summary - returning safe")
            cur.close()
            conn.close()
            # No reports or summary = no documented allergies
            return SafetyCheckResponse(
                has_allergy=False,
                warnings=[],
                allergy_details=None,
                citations=[]
            )

        # 2. Build search query focused on allergies + drug name
        drug_name = payload.drug_name.strip()
        logger.info(f"   Drug name: {drug_name}")
        search_query = f"allergy allergies allergic reaction {drug_name}"
        logger.info(f"   Search query: {search_query}")
        
        query_embedding = _embed_text(search_query)
        if len(query_embedding) != 768:
            raise HTTPException(status_code=500, detail=f"Embedding dimension {len(query_embedding)} != 768")
        embedding_literal = '[' + ','.join(f'{x:.6f}' for x in query_embedding) + ']'

        # 3. Hybrid retrieval: keyword + similarity search for allergy-related content
        placeholders = ','.join(['%s'] * len(report_ids)) if report_ids else 'NULL'
        
        # 3a. Keyword search for allergy mentions
        allergy_keywords = ['allergy', 'allergies', 'allergic', 'hypersensitivity', 'adverse reaction']
        patterns = [f"%{kw}%" for kw in allergy_keywords]
        
        keyword_chunks = []
        if report_ids:
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
            for row in cur.fetchall():
                if row and row[2]:
                    keyword_chunks.append((row[0], row[1], row[2], row[3]))
        
        # 3b. Similarity search with allergy-focused query
        similarity_chunks = []
        if report_ids:
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
        
        if not all_chunks and not annotation_rows and not summary_text:
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

        # 5x. Check summary text
        if summary_text:
            summary_lower = summary_text.lower()
            if drug_lower in summary_lower:
                # Check if it's in an allergy context
                # Simple heuristic: look for allergy keywords in the same line or sentence
                lines = summary_text.split('\n')
                for line in lines:
                    line_lower = line.lower()
                    if drug_lower in line_lower and any(kw in line_lower for kw in allergy_keywords):
                        has_allergy = True
                        warnings.append(f"⚠️ Patient summary mentions {drug_name} allergy")
                        allergy_details_parts.append(line.strip())
                        citations.append({
                            "source": "Patient Summary",
                            "text": line.strip(),
                            "date": "Current"
                        })
                        break # Found it in summary

        
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
        
        response = SafetyCheckResponse(
            has_allergy=has_allergy or len(warnings) > 0,
            warnings=warnings,
            allergy_details=allergy_details,
            citations=citations
        )
        logger.info(f"   ✅ Safety check complete - returning response:")
        logger.info(f"      has_allergy: {response.has_allergy}")
        logger.info(f"      warnings: {response.warnings}")
        logger.info(f"      allergy_details: {response.allergy_details}")
        logger.info(f"      citations count: {len(response.citations)}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ Error in safety check for patient {patient_id}")
        raise HTTPException(status_code=500, detail=f"Safety check error: {e}")