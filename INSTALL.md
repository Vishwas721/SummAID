# SummAID Installation Guide

## Prerequisites

- **OS**: Linux/Windows/Mac
- **Python**: 3.9+
- **PostgreSQL**: 14+ (with pgcrypto, pgvector extensions)
- **Node.js**: 16+
- **Ollama**: Local LLM service (for llama3:8b or similar)
- **Docker** (optional, for containerized deployment)

## Step 1: Clone Repository

```bash
git clone https://github.com/Vishwas721/SummAID.git
cd SummAID
```

## Step 2: Set Up Backend

### 2.1 Create Virtual Environment

```bash
python -m venv .venv
# On Windows:
.\.venv\Scripts\Activate.ps1
# On Linux/Mac:
source .venv/bin/activate
```

### 2.2 Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2.3 Set Up PostgreSQL Database

**Create database and enable extensions:**

```sql
CREATE DATABASE summaid;
\c summaid

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tables (see schema in documents/Database schema.txt)
-- Run the schema creation script or execute the SQL from database schema file
```

**Create tables:**

```sql
CREATE TABLE patients (
    patient_id SERIAL PRIMARY KEY,
    patient_display_name TEXT,
    patient_demo_id TEXT,
    age INT,
    sex TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reports (
    report_id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES patients(patient_id),
    report_type TEXT,
    file_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE report_chunks (
    chunk_id SERIAL PRIMARY KEY,
    report_id INT REFERENCES reports(report_id),
    chunk_text_encrypted BYTEA,
    report_vector vector(768),
    source_metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patient_summaries (
    summary_id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES patients(patient_id),
    summary_text TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    specialty TEXT
);

CREATE TABLE doctor_summary_edits (
    edit_id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES patients(patient_id),
    section TEXT,
    content TEXT,
    edited_by TEXT,
    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE annotations (
    annotation_id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES patients(patient_id),
    doctor_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4 Configure Environment Variables

Create `.env` file in `backend/` directory:

```env
# Database
DATABASE_URL=postgresql://postgres:1234@localhost:5432/summaid
ENCRYPTION_KEY=your-secure-encryption-key-32-chars

# LLM
LLM_MODEL=llama3:8b
LLM_TIMEOUT=120

# API
API_PORT=8002
API_HOST=0.0.0.0

# CORS (adjust for your setup)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 2.5 Seed Database (Optional - Demo Data)

```bash
python seed.py
```

This creates demo patients (Jane, Rahul) with sample reports.

### 2.6 Start Backend Server

```bash
python main.py --reload
```

Backend runs on `http://localhost:8002`

## Step 3: Set Up Frontend

### 3.1 Install Node Dependencies

```bash
cd frontend
npm install
```

### 3.2 Configure Environment Variables

Create `.env.local` in `frontend/` directory:

```env
VITE_API_URL=http://localhost:8002
```

### 3.3 Start Frontend Dev Server

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

## Step 4: Start Ollama LLM Service

Ollama must be running for summarization and safety checks:

```bash
# Install Ollama from https://ollama.ai
# Pull the model
ollama pull llama3:8b

# Start service (default: localhost:11434)
ollama serve
```

## Step 5: Verify Installation

### Check Backend Health

```bash
curl http://localhost:8002/docs
```

Should show FastAPI Swagger UI.

### Check Frontend

Open `http://localhost:5173` in browser. You should see:
- Patient list (if seeded with demo data)
- Summary, Chat, and RX tabs
- Login form (if auth is configured)

### Test Summarization

1. Log in as MA or Doctor
2. Select a patient
3. Click "SUMMARY" tab
4. Click "Generate Summary"
5. Wait for LLM to process (~30-60s)
6. View generated summary with citations

## Step 6: Docker Deployment (Optional)

### Build Docker Images

```bash
# Backend
docker build -f backend/Dockerfile -t summaid-backend:latest ./backend

# Frontend
docker build -f frontend/Dockerfile -t summaid-frontend:latest ./frontend
```

### Run with Docker Compose

```bash
docker-compose up -d
```

Services start in background (backend:8002, frontend:80, postgres:5432, ollama:11434).

## Troubleshooting

### Issue: `ModuleNotFoundError: No module named 'fastapi'`
**Fix**: Ensure virtual environment is activated and `pip install -r requirements.txt` ran successfully.

### Issue: `Connection refused to localhost:5432`
**Fix**: Ensure PostgreSQL is running:
```bash
# Linux/Mac
pg_ctl -D /usr/local/var/postgres start

# Windows (if installed via installer)
net start postgresql-x64-14
```

### Issue: `LLM request timed out`
**Fix**: Ensure Ollama is running (`ollama serve`) and model is pulled (`ollama pull llama3:8b`).

### Issue: Frontend cannot connect to backend (CORS error)
**Fix**: Check `.env.local` VITE_API_URL matches backend address; update `CORS_ORIGINS` in backend `.env`.

### Issue: `pgvector not installed`
**Fix**: In PostgreSQL:
```sql
CREATE EXTENSION vector;
```

## Production Deployment

For hospital deployment:

1. **Use production-grade PostgreSQL** with backups.
2. **Configure HTTPS/TLS** (use nginx reverse proxy).
3. **Enable EMR/FHIR authentication** instead of demo login.
4. **Set up LLM behind authenticated service** (no external calls).
5. **Configure audit logging** for compliance (HIPAA/DPDPA).
6. **Monitor LLM latency and oncology extraction timeout rate**.

See deployment docs for detailed instructions.

## Next Steps

- Read `USER_GUIDE.md` to learn how to use the application.
- Check `README.md` for project overview and architecture.
- Review `documents/Database schema.txt` for data model details.
