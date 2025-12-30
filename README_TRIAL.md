# SummAID Doctor Trial Pack (No Full Integration)

This lightweight trial lets doctors test summaries with a local upload flow—no database or EHR integration required.

## What this provides
- Upload a PDF and get a structured summary (AIResponseSchema format)
- See lightweight citations by page for transparency
- Runs fully locally on Windows

## Prerequisites
- Windows with Python 3.10+ installed
- Ollama running locally (for LLM + embeddings)
  - Install: https://ollama.com
  - Pull models (examples; adjust as needed):
    - `ollama pull nomic-embed-text`
    - `ollama pull llama3:8b` (or any supported instruct model)

## Quick Start (Windows)
1. Open PowerShell.
2. Run the setup script to create a virtual env, install deps, and start the server in DEMO mode:

```powershell
# From repo root (C:\SummAID)
./backend/doctor_demo_setup.ps1
```

3. Upload a PDF to the demo endpoint:
   - Use Postman/Insomnia or `curl`:

```powershell
# Example: using PowerShell's Invoke-WebRequest
Invoke-WebRequest -Uri http://localhost:8001/demo/summarize -Method Post -InFile "C:\path\to\report.pdf" -ContentType "application/pdf"
```

Or with `curl` (PowerShell):
```powershell
curl -X POST http://localhost:8001/demo/summarize -H "Content-Type: application/pdf" --data-binary @C:\path\to\report.pdf
```

Response is JSON with keys: `universal`, `oncology`, `speech`, `specialty`, `generated_at`, `citations`.

## Full Workflow Trial (Local DB, no hospital integration)
Use this if you want multi-report RAG, saved summaries, doctor edits, safety checks, etc., but still run locally.

1. Prepare `.env` in `backend/` with:
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
ENCRYPTION_KEY=your-demo-key
LLM_MODEL_NAME=llama3:8b   # or a smaller instruct model
```

2. Initialize DB schema:
```powershell
cd backend
.\n+python init_db.py
```
Alternatively, use the reset script (DELETES data):
```powershell
.\n+./reset_db.ps1
```

3. Start server (normal mode):
```powershell
./start_server.ps1
```

4. Create a trial patient:
```powershell
curl -X POST http://localhost:8001/trial/patient -H "Content-Type: application/json" -d "{ \"display_name\": \"Jane Doe\" }"
```
Response: `{ "patient_id": 1, "patient_demo_id": "patient_jane_doe" }`

5. Upload one or more PDFs to that patient:
```powershell
curl -X POST http://localhost:8001/trial/patient/1/upload-pdf -H "Content-Type: application/pdf" --data-binary @C:\path\to\report1.pdf
curl -X POST http://localhost:8001/trial/patient/1/upload-pdf -H "Content-Type: application/pdf" --data-binary @C:\path\to\report2.pdf
```

6. Generate and persist a summary using the full workflow:
```powershell
curl -X POST http://localhost:8001/summarize/1 -H "Content-Type: application/json" -d "{}"
```

7. Fetch the prepared summary (with citations):
```powershell
curl http://localhost:8001/summary/1
```

8. Optional doctor edits and safety checks:
- List patients: `GET /patients/doctor`
- Edit merged summary: `POST /patients/{id}/summary/edit`
- Allergy safety check: `POST /safety-check/{id}`

## Notes
- DEMO mode avoids the database, patient seeding, and persistence.
- If you later want multi-report, RAG, and saved summaries, use the standard backend scripts in `backend/` (`init_db.py`, `seed.py`, `start_server.ps1`).
- If the model is too large for your machine, switch to a smaller Ollama model (e.g., `qwen2.5:3b-instruct-q4_K_M`).
 - If you see DB errors, confirm `.env` values and that Postgres is reachable. Use `init_db.py` to create tables.

## Troubleshooting
- If the server errors on model calls:
  - Verify Ollama is running: `ollama serve`
  - Test endpoints: `powershell ./backend/verify_ollama.ps1`
  - Adjust model name via `.env` or `backend/config.py` defaults.

## Feedback Guide
- Assess summary structure: evolution, current_status, plan, key findings.
- Check specialty sections if applicable (oncology, speech/audiology).
- Use the `citations` array to review page-level sources.
- Share qualitative feedback and cases where output needs adjustment.
