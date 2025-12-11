# SummAID - On-Premise AI Medical Report Summarization

An enterprise-grade, on-premise AI assistant that synthesizes complex patient medical history into concise, verifiable summaries with specialty-specific insights for clinical teams. Built for **HIPAA/DPDPA compliance** with end-to-end encryption and zero cloud dependency.

## Key Features

### 1. Intelligent Summary Generation
- **Parallel structured summaries** with specialty detection (universal/oncology/speech)
- **AIResponseSchema** for consistent multi-field output: Evolution, Current Status, Action Plan
- **Hybrid RAG retrieval**: keyword + vector similarity search across encrypted report chunks
- **Verifiable citations** ("Glass Box"): every claim links back to source text
- Structured extraction: tumor trends, TNM staging, biomarkers (oncology), audiology metrics (speech)

### 2. Doctor-Editable Summaries (NEW)
- Doctors can edit `medical_journey` and `action_plan` sections post-generation
- **Revision history** (append-only, no overwrites)
- Edits merged with AI summaries at read time
- Edits automatically included in chat and safety-check context (high-priority synthetic chunks)

### 3. Interactive RAG Chatbot
- Ask specific questions about patient history
- Chatbot pulls from: encrypted reports + AI summaries + doctor edits
- Examples:
  - "What is the trend in tumor size?"
  - "What were the white blood cell counts?"
  - "Are there any allergies documented?"
- Includes citations with sources

### 4. Safety Check & Allergy Detection
- **Drug-specific allergy detection**: requires drug + allergy keyword co-occurrence (no false positives)
- Scans: clinical notes, AI summaries, doctor edits
- Returns: `has_allergy`, `warnings`, `allergy_details`, `citations`
- Prevents accidental prescribing via UI block

### 5. Digital Prescription with Safety Gate
- **Colorful, professional PDF**: blue header with medical cross, patient info panel, Rx badge, medication box, allergy alert box
- **Print is blocked** if allergy detected; button shows "Cannot Prescribe - Allergy Detected"
- Safety-check gate before prescription generation
- Includes dosage, frequency, duration, doctor signature line

### 6. Medical Journey Multi-View
- **Timeline**: Events with date badges and color-coded tags
- **Narrative**: Full paragraph with optional keyword highlighting
- **Points**: Cleaned bullet list for quick scan
- Interactive toggle for clinician preference

### 7. Specialty Infographics (Oncology)
- **Tumor size trend graph**: IMPROVING/WORSENING/STABLE status
- **TNM staging, biomarkers** (ER, PR, HER2, Ki-67)
- **Treatment response & pertinent negatives** (what's absent)
- Reliable extraction with 120s timeout + optimized prompt (~6000 chars)

### 8. Enhanced Patient Demographics
- **Colorful age/sex badges** with icons (emerald age, blue/pink sex)
- Age extracted from source PDFs via regex (not hash-based)
- `/patients/doctor` endpoint returns all patients with age/sex fields

## Quick Start

### Prerequisites
- **Python 3.9+**, **Node.js 16+**, **PostgreSQL 14+**, **Ollama** (for local LLM)
- See [INSTALL.md](INSTALL.md) for detailed setup

### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Configure .env (see INSTALL.md)
# Start PostgreSQL, enable pgcrypto + pgvector extensions
# Create database schema (see documents/Database schema.txt)

# Seed demo data (Jane, Rahul with sample reports)
python seed.py

# Start server on port 8002
python main.py --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### LLM Service
```bash
# In another terminal
ollama pull llama3:8b
ollama serve
# Runs on localhost:11434
```

### Verify Installation
- Backend Swagger: `http://localhost:8002/docs`
- Frontend: `http://localhost:5173`
- Select a patient and generate a summary

For full installation & troubleshooting, see **[INSTALL.md](INSTALL.md)**

## API Endpoints

### Authentication & Roles
- **MA** (Medical Assistant): View summaries, run safety checks, chat
- **DOCTOR**: View summaries, edit sections, prescribe, access doctor edits

### Core Endpoints

#### GET /patients/doctor
Returns all patients (not just those with summaries) with age, sex, and metadata.

**Response:**
```json
[
  {
    "patient_id": 44,
    "patient_display_name": "Jane",
    "age": 62,
    "sex": "Female",
    "summary_count": 1
  }
]
```

#### POST /summarize/{patient_id}
Generate comprehensive structured summary with specialty classification.

**Request:**
```json
{
  "chief_complaint": "Worsening headaches"
}
```

**Response:**
```json
{
  "summary_text": "...",
  "specialty": "oncology",  // or universal, speech
  "oncology": {
    "tumor_size_trend": [{"date": "2025-01-15", "size_cm": 2.3, "status": "IMPROVING"}],
    "tnm_staging": "T2N0M0",
    "cancer_type": "Breast Cancer",
    "biomarkers": {"ER": "positive", "HER2": "negative"},
    "treatment_response": "Partial response",
    "pertinent_negatives": ["No metastasis"]
  },
  "citations": [...]
}
```

#### POST /chat/{patient_id}
Ask questions about patient. Context includes AI summary + doctor edits + reports.

**Request:**
```json
{
  "question": "What is the trend in tumor size?",
  "max_chunks": 15
}
```

**Response:**
```json
{
  "answer": "The tumor has grown from 1.2cm to 3.1cm over 6 months...",
  "citations": [...]
}
```

#### POST /safety-check/{patient_id}
Check for drug-specific allergies. Requires drug + allergy keyword co-occurrence (no false positives).

**Request:**
```json
{
  "drug_name": "Penicillin"
}
```

**Response:**
```json
{
  "has_allergy": true,
  "warnings": ["⚠️ Patient may be allergic to Penicillin"],
  "allergy_details": "Documented penicillin allergy - anaphylaxis risk",
  "citations": [{"source": "Clinical Annotation", "text": "...", "date": "2024-11-15"}]
}
```

#### POST /patients/{patient_id}/summary/edit
Doctor edits a summary section (append-only, no overwrites).

**Request:**
```json
{
  "section": "medical_journey",
  "content": "Patient had significant improvement after chemotherapy..."
}
```

**Response:**
```json
{
  "edit_id": 123,
  "section": "medical_journey",
  "edited_at": "2025-01-20T10:30:00Z",
  "edited_by": "Dr. Smith"
}
```

#### GET /patients/{patient_id}/summary
Fetch merged summary (AI + latest doctor edits).

**Response:**
```json
{
  "ai_summary": "...",
  "doctor_edits": {
    "medical_journey": "Latest doctor edit text...",
    "action_plan": "Latest action plan edit..."
  },
  "merged_summary": "Combined AI + edits",
  "citations": [...]
}
```

See backend API docs at `http://localhost:8002/docs` for full endpoint details.

## Testing the Chat Endpoint

### Using curl:
```bash
curl -X POST "http://localhost:8000/chat/1" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the trend in tumor size?"}'
```

### Using Python:
```bash
cd backend
python test_chat.py
```

## Technology Stack

**Backend:**
- FastAPI (Python 3.9+)
- PostgreSQL 14+ with **pgcrypto** (AES-256 encryption) and **pgvector** (768-dim embeddings)
- Ollama local LLM service (llama3:8b, nomic-embed-text)
- Parallel async prompts for structured extraction
- On-premise, zero cloud dependency

**Frontend:**
- React 18 + Vite (fast dev server)
- Tailwind CSS + shadcn/ui components
- jsPDF for prescription generation
- Axios for API calls
- Interactive chart/card components

**Deployment:**
- Docker containers (optional)
- On-prem hospital network only
- TLS for internal transport
- EMR/FHIR adapter (read-only, planned)

## Architecture

### System Overview
```
Hospital Network (On-Prem)
├── Frontend (Vite/React) → port 5173
├── Backend API (FastAPI) → port 8002
│   ├── RAG Pipeline
│   │   ├── Hybrid Retrieval (keyword + vector similarity)
│   │   ├── Context Merging (with doctor edits as synthetic chunks)
│   │   └── Structured Extraction (universal + specialty prompts)
│   ├── Safety Check (drug + allergy co-occurrence)
│   ├── Doctor Edits (append-only)
│   └── Prescription Generation (PDF with allergy gate)
├── PostgreSQL (port 5432)
│   ├── Encrypted text (pgcrypto AES-256)
│   ├── Embeddings (pgvector 768-dim)
│   └── Doctor edits, summaries, patient metadata
└── Ollama LLM Service (port 11434)
    ├── llama3:8b (summarization, extraction)
    └── nomic-embed-text (768-dim embeddings)
```

### RAG Pipeline
1. **Ingestion**: PDF → text extraction → pgcrypto encryption → PostgreSQL storage
2. **Embedding**: nomic-embed-text (768-dim) stored in pgvector
3. **Retrieval**: Hybrid (keyword filter + cosine similarity search)
4. **Context Merging**: 
   - Priority: structured sections → semantically relevant chunks → doctor edits (synthetic)
   - Deduplication, character limit enforcement
5. **Generation**:
   - **Summarization**: Parallel structured prompts (evolution, current status, plan, specialty)
   - **Safety Check**: Drug-specific allergy scanning
   - **Chat**: Task-specific prompt + RAG context
6. **Output**: Citations preserved; AI-generated flag; merged with doctor edits

### Security
- **Encryption at Rest**: AES-256 (pgcrypto) for all medical text
- **Network**: On-premise only; no cloud APIs; TLS for internal transport
- **Access Control**: Role-based (MA, DOCTOR); EMR SSO integration (planned)
- **Audit Logging**: Safety checks, prescription events, doctor edits tracked
- **Data Minimization**: Only clinical text + minimal identifiers (patient_id, display name)

## Development Notes

### Model Service
Ensure Ollama is running before starting backend:
```bash
ollama serve
ollama pull llama3:8b
ollama pull nomic-embed-text
```

### Database
- Schema: See `documents/Database schema.txt`
- Tables: `patients`, `reports`, `report_chunks`, `patient_summaries`, `doctor_summary_edits`, `annotations`
- Encryption: pgcrypto (AES-256)
- Embeddings: pgvector (768-dim)

### Key Configuration
- **LLM_TIMEOUT**: 120s (oncology extraction reliability)
- **Oncology Prompt**: ~6000 chars (optimized for speed)
- **Allergy Check**: Drug + keyword co-occurrence (no false positives)
- **Doctor Edits**: Append-only, merged at read time (no overwrites)

### Specialty Classification
- **Oncology**: TNM staging, biomarkers, tumor trends, pertinent negatives
- **Speech**: Audiology metrics, hearing thresholds (if implemented)
- **Universal**: Always generated (evolution, current status, action plan)

### Testing
```bash
# Test chat endpoint
cd backend
python test_chat.py

# Run safety check
curl -X POST "http://localhost:8002/safety-check/44" \
  -H "Content-Type: application/json" \
  -d '{"drug_name": "Penicillin"}'

# Generate summary with specialty
curl -X POST "http://localhost:8002/summarize/44" \
  -H "Content-Type: application/json" \
  -d '{"chief_complaint": ""}'
```

## Documentation

- **[INSTALL.md](INSTALL.md)** – Complete installation & deployment guide with troubleshooting
- **[USER_GUIDE.md](USER_GUIDE.md)** – How to use SummAID: workflows, safety checks, prescriptions, doctor edits, specialty views
- **[documents/Database schema.txt](documents/Database schema.txt)** – Full PostgreSQL schema
- **[documents/Product Requirements Specification(PRS).pdf](documents/Product Requirements Specification(PRS).pdf)** – Feature spec & objectives
- **[documents/Plan for Collecting and Using Data.md](documents/Plan for Collecting and Using Data.md)** – Data policy, privacy, compliance (HIPAA/DPDPA)
- **Backend API Docs** – `http://localhost:8002/docs` (FastAPI Swagger)

## Known Limitations & Future Work

### Phase 1 (Current)
✅ Parallel structured summaries  
✅ Doctor edits with revision history  
✅ Specialty infographics (oncology)  
✅ Safety check with allergy detection  
✅ Digital prescription with allergy gate  
✅ Medical Journey multi-view  
✅ On-premise deployment  

### Phase 2 (Planned)
⏳ FHIR/EMR integration (read-only)  
⏳ EMR SSO authentication  
⏳ Patient-facing summaries  
⏳ Real-time collaboration  
⏳ Advanced trend visualization (lab value graphs)  
⏳ Temporal filtering ("most recent" vs "baseline")  
⏳ Cloud-based backup (encrypted, hospital-approved)  

## Compliance & Privacy

- **HIPAA/DPDPA**: On-premise deployment, no cloud PHI transmission
- **Data Encryption**: AES-256 at rest (pgcrypto); TLS in transit
- **Access Control**: Role-based (MA, DOCTOR); audit logging
- **Data Retention**: Hospital policy; doctor edits append-only (audit trail)
- **No AI Marketing**: Data used only for clinical care, not model training

See [documents/Plan for Collecting and Using Data.md](documents/Plan for Collecting and Using Data.md) for full policy.

## Troubleshooting

### Issue: "Summary not generating" or "LLM timeout"
**Fix**: Ensure Ollama is running (`ollama serve`), model is pulled (`ollama pull llama3:8b`), and backend has >8GB RAM available.

### Issue: "Allergy check says patient is allergic to every drug"
**Fix**: This was a bug in early versions. Update to latest code; safety check now requires drug + allergy keyword co-occurrence.

### Issue: "Oncology infographics not appearing"
**Fix**: Oncology extraction has 120s timeout. Regenerate summary or check backend logs for timeout errors.

### Issue: "Frontend cannot connect to backend (CORS error)"
**Fix**: Verify `VITE_API_URL` in `.env.local` matches backend address; update `CORS_ORIGINS` in backend `.env`.

For more, see [INSTALL.md](INSTALL.md) troubleshooting section.
