Set-Location c:\SummAID\backend
$env:PYTHONUNBUFFERED = '1'
python -m uvicorn main:app --reload --port 8001
