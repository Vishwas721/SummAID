# Quick Test Commands for Chat Endpoint

## Prerequisites
Ensure backend is running and Ollama service is active:
```bash
# Terminal 1: Start backend
cd c:/SummAID/backend
uvicorn main:app --reload

# Terminal 2: Verify Ollama (if needed)
ollama serve
```

## Test Commands

### 1. Basic Question (Tumor Trend)
```bash
curl -X POST "http://localhost:8000/chat/1" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"What is the trend in tumor size?\"}"
```

### 2. Lab Values Question
```bash
curl -X POST "http://localhost:8000/chat/1" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"What were the white blood cell counts?\"}"
```

### 3. Question with Keywords
```bash
curl -X POST "http://localhost:8000/chat/1" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"Are there abnormal liver findings?\", \"keywords\": [\"liver\", \"hepatic\"]}"
```

### 4. Custom Context Limits
```bash
curl -X POST "http://localhost:8000/chat/1" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"What medications were mentioned?\", \"max_chunks\": 20, \"max_context_chars\": 15000}"
```

## PowerShell Equivalents

### Basic Question
```powershell
$body = @{
    question = "What is the trend in tumor size?"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/chat/1" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

### With Keywords
```powershell
$body = @{
    question = "What were the white blood cell counts?"
    keywords = @("WBC", "leukocyte")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/chat/1" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

## Python Script Test
```bash
cd c:/SummAID/backend
python test_chat.py
```

## Expected Response Format
```json
{
  "answer": "The tumor has grown from 1.2cm in the first report dated 2024-01-15 to 3.1cm in the most recent report dated 2024-03-20, showing significant progression over approximately 2 months.",
  "citations": [
    {
      "source_chunk_id": 42,
      "report_id": 1,
      "source_text_preview": "FINDINGS: The mass measures approximately 3.1cm in greatest dimension, showing interval growth compared to prior imaging...",
      "source_full_text": "...",
      "source_metadata": {
        "page": 2,
        "chunk_index": 5,
        "report_id": 1
      }
    }
  ]
}
```

## Troubleshooting

### Connection Refused
- Ensure backend is running: `uvicorn main:app --reload`
- Check port 8000 is not in use

### 404 Patient Not Found
- Verify patient exists: `curl http://localhost:8000/patients`
- Use correct patient_id in URL path

### 500 Embedding Service Error
- Start Ollama: `ollama serve`
- Verify models: `ollama list`
- Pull if needed: `ollama pull nomic-embed-text`

### CUDA/GPU Errors
- Model will automatically fall back to quantized versions
- Response will include note about fallback usage

## Sample Questions by Category

### Clinical Trends
- "What is the trend in tumor size?"
- "How has the patient's blood pressure changed?"
- "Is the inflammation improving or worsening?"

### Lab Values
- "What were the white blood cell counts?"
- "Are there any abnormal electrolytes?"
- "What was the most recent creatinine level?"

### Imaging
- "Has the patient had any CT scans?"
- "What imaging findings were reported?"
- "Are there any new lesions?"

### Medications
- "What medications were mentioned?"
- "Has the patient been prescribed antibiotics?"

### Diagnoses
- "What conditions have been diagnosed?"
- "Are there any differential diagnoses mentioned?"

### Anatomical Queries
- "Are there abnormal liver findings?"
- "What was noted about the lungs?"
- "Any cardiac abnormalities?"
