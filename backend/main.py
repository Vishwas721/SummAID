import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import get_db_connection

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