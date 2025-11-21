# SummAID - AI-Powered Medical Report Summarization

## Features

### 1. AI Summary Generation
- Generate comprehensive clinical narratives from multiple patient reports
- Structured output with Main Story, Key Findings, Lab Values (table), and Evolution
- Chief Complaint input to bias retrieval toward relevant abnormalities
- Evidence citations with PDF highlighting

### 2. Interactive RAG Chat (NEW)
- Ask specific questions about a patient's medical history
- Get concise answers based only on report context
- Examples:
  - "What is the trend in tumor size?"
  - "What were the white blood cell counts?"
  - "Are there any abnormal findings in the liver?"
- Includes source citations for verification

### 3. PDF Export
- Download summaries as clean, formatted PDF documents
- Includes patient metadata, chief complaint, timestamps
- Embedded evidence sources with report references

## Quick Start

### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Set up .env file with DATABASE_URL and ENCRYPTION_KEY
# Start PostgreSQL with pgvector extension

# Seed demo data
python seed.py

# Start server
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

### GET /patients
Returns list of all patients with IDs and display names.

### POST /summarize/{patient_id}
Generate a comprehensive clinical summary.

**Request:**
```json
{
  "chief_complaint": "Worsening headaches",
  "keywords": null,
  "max_chunks": 20,
  "max_context_chars": 16000
}
```

**Response:**
```json
{
  "summary_text": "Main Story:\n- Persistent neutrophilic leukocytosis...",
  "citations": [...]
}
```

### POST /chat/{patient_id}
Ask specific questions about a patient.

**Request:**
```json
{
  "question": "What is the trend in tumor size?",
  "max_chunks": 15,
  "max_context_chars": 12000
}
```

**Response:**
```json
{
  "answer": "The tumor has grown from 1.2cm to 3.1cm...",
  "citations": [...]
}
```

See [CHAT_ENDPOINT.md](backend/CHAT_ENDPOINT.md) for detailed documentation.

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
- FastAPI
- PostgreSQL with pgvector and pgcrypto extensions
- Ollama (local LLM: llama3:8b, nomic-embed-text)
- Python 3.9+

**Frontend:**
- React + Vite
- Tailwind CSS
- react-pdf (PDF viewing)
- jsPDF (PDF export)
- Axios

## Architecture

### RAG Pipeline
1. **Hybrid Retrieval:**
   - Structured section detection (FINDINGS, IMPRESSION, CONCLUSION)
   - Semantic vector similarity search
   - Optional keyword filtering

2. **Context Merging:**
   - Priority: structured sections → keywords → similarity
   - Deduplication and character limit enforcement

3. **Generation:**
   - Task-specific prompts (summary vs. Q&A)
   - Robust CUDA fallback with quantized models
   - Context trimming for GPU memory constraints

### Security
- AES-256 encryption for all medical text (pgcrypto)
- ⚠️ Phase 1 prototype uses .env-based keys
- Production requires HashiCorp Vault HA Cluster

## Development Notes

### Model Service
Ensure Ollama is running:
```bash
ollama serve
ollama pull llama3:8b
ollama pull nomic-embed-text
```

### Database Schema
- `patients`: patient metadata
- `reports`: uploaded report files
- `report_chunks`: encrypted text chunks with vector embeddings

### PDF Highlight Feature
Citations link to specific pages and highlight matching text in yellow.

## Future Enhancements
- Temporal filtering ("most recent" vs "initial")
- Report-type classification (lab, imaging, pathology)
- Multi-hop reasoning for complex questions
- Trend visualization for lab values
- Real-time collaboration features

## License
Prototype for demonstration purposes.
