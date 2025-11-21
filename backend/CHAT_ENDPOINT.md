# Chat Endpoint Documentation

## Overview
The `/chat/{patient_id}` endpoint allows doctors to ask specific questions about a patient and get answers based only on the patient's medical reports using RAG (Retrieval-Augmented Generation).

## Endpoint Details

**URL:** `POST /chat/{patient_id}`

**Path Parameters:**
- `patient_id` (int, required): The numeric patient ID to query

**Request Body (JSON):**
```json
{
  "question": "What is the trend in tumor size?",
  "keywords": ["tumor", "size"],  // Optional
  "max_chunks": 15,               // Optional, default 15
  "max_context_chars": 12000      // Optional, default 12000
}
```

**Response (JSON):**
```json
{
  "answer": "The tumor has grown from 1.2cm to 3.1cm over the course of three reports...",
  "citations": [
    {
      "source_chunk_id": 42,
      "report_id": 1,
      "source_text_preview": "The mass measures approximately 3.1cm...",
      "source_full_text": "FINDINGS: The mass measures approximately 3.1cm in greatest dimension...",
      "source_metadata": {
        "page": 2,
        "chunk_index": 5,
        "report_id": 1
      }
    }
  ]
}
```

## How It Works

1. **Context Retrieval**: Uses the same hybrid RAG logic as the summarize endpoint:
   - Embeds the question semantically
   - Retrieves relevant chunks using vector similarity
   - Force-includes structured sections (FINDINGS, IMPRESSION, CONCLUSION)
   - Optional keyword filtering

2. **Question Answering**: Sends the retrieved context and question to Llama 3 with instructions to:
   - Answer using ONLY the provided context
   - Be concise and direct
   - Include specific values, dates, measurements
   - Say "not found" if the context doesn't contain the answer

3. **Fallback Handling**: Same robust GPU fallback as summarize:
   - Tries quantized models if CUDA errors occur
   - Reduces context if needed
   - Returns helpful error notes

## Example Usage

### Using curl:

```bash
curl -X POST "http://localhost:8000/chat/1" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the trend in tumor size?"
  }'
```

### With keywords:

```bash
curl -X POST "http://localhost:8000/chat/1" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What were the white blood cell counts?",
    "keywords": ["WBC", "leukocyte", "white blood"]
  }'
```

### Using Python:

```python
import requests

response = requests.post(
    "http://localhost:8000/chat/1",
    json={
        "question": "What is the trend in tumor size?",
        "max_chunks": 15
    }
)

data = response.json()
print(f"Answer: {data['answer']}")
print(f"Citations: {len(data['citations'])}")
```

## Testing

1. Start the backend server:
```bash
cd backend
uvicorn main:app --reload
```

2. Run the test script:
```bash
python test_chat.py
```

Or use curl:
```bash
curl -X POST "http://localhost:8000/chat/1" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the trend in tumor size?"}'
```

## Example Questions

- "What is the trend in tumor size?"
- "What were the white blood cell counts?"
- "Has the patient had any imaging studies?"
- "What medications were mentioned?"
- "Are there any abnormal findings in the liver?"
- "What was the most recent blood pressure reading?"

## Response Characteristics

- **Concise**: Answers are direct and focused
- **Contextual**: Only uses information from the patient's reports
- **Cited**: Every answer includes source citations with report IDs and page numbers
- **Honest**: If information isn't in the reports, the model will say so

## Error Handling

- **404**: Patient not found or no reports for patient
- **500**: Generation errors (with fallback notes if applicable)
- **422**: Invalid request body

## Optimization Notes

For the demo, the endpoint uses standard relevance-based retrieval. Future optimizations could include:
- Question-type detection (lab values, imaging, medications)
- Report-type filtering (prioritize lab reports for "blood" questions)
- Temporal filtering (e.g., "most recent" vs "initial")
- Multi-hop reasoning for complex questions
