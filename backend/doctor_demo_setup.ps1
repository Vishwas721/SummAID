# SummAID Doctor Trial Setup (DEMO mode, no DB)
# Creates a Python venv, installs backend deps, and starts the FastAPI server

param(
  [int]$Port = 8001
)

Write-Host "=== SummAID Doctor Trial Setup ===" -ForegroundColor Cyan

# Move to backend directory
Set-Location "c:\SummAID\backend"

# Ensure Python available
$python = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $python) {
  Write-Host "ERROR: Python not found in PATH" -ForegroundColor Red
  Write-Host "Install Python 3.10+ and rerun." -ForegroundColor Yellow
  exit 1
}

# Create venv in repo root if missing
$venvPath = "c:\SummAID\.venv"
if (-not (Test-Path $venvPath)) {
  Write-Host "Creating virtual environment at $venvPath" -ForegroundColor Yellow
  python -m venv $venvPath
}

# Activate venv
$activate = Join-Path $venvPath "Scripts\Activate.ps1"
if (-not (Test-Path $activate)) {
  Write-Host "ERROR: venv activation script not found" -ForegroundColor Red
  exit 1
}
. $activate

# Install backend requirements
Write-Host "Installing backend requirements..." -ForegroundColor Yellow
pip install -r requirements.txt

# DEMO mode: skip DB/ENCRYPTION checks
$env:DEMO_MODE = "1"
Write-Host "DEMO_MODE=1 enabled" -ForegroundColor Green

Write-Host "Starting FastAPI server on port $Port..." -ForegroundColor Cyan
python -m uvicorn main:app --reload --port $Port
