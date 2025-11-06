import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- Configuration Loading & Validation ---
DATABASE_URL = os.getenv("DATABASE_URL")
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
    allow_methods=["GET", "POST", "OPTIONS"], # Be explicit instead of "*"
    allow_headers=["*"], # Can be tightened later if needed
)

# Root endpoint
@app.get("/")
def read_root():
    """
    Root health check endpoint.
    """
    return {"status": "ok", "message": "SummAID API is running."}