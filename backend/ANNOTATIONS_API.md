# Annotations API Documentation

## Overview
The annotations endpoints allow doctors to save and retrieve notes for patients.

## Database Schema

### Table: `annotations`
- `annotation_id` (SERIAL PRIMARY KEY) - Unique identifier for each annotation
- `patient_id` (INTEGER, FK) - References patients table
- `doctor_note` (TEXT) - The doctor's note content
- `created_at` (TIMESTAMP WITH TIME ZONE) - Auto-generated timestamp

### Indexes
- `idx_annotations_patient_id` - For efficient patient lookups
- `idx_annotations_created_at` - For chronological ordering

## API Endpoints

### POST /annotate
Creates a new annotation for a patient.

**Request Body:**
```json
{
  "patient_id": 14,
  "doctor_note": "Patient shows significant improvement in mobility. Continue current treatment plan."
}
```

**Response (200 OK):**
```json
{
  "annotation_id": 1,
  "patient_id": 14,
  "doctor_note": "Patient shows significant improvement in mobility. Continue current treatment plan.",
  "created_at": "2025-11-21T12:09:42.153374+05:30"
}
```

**Error Responses:**
- `404 Not Found` - Patient does not exist
- `500 Internal Server Error` - Database error

### GET /annotations/{patient_id}
Retrieves all annotations for a specific patient, ordered by most recent first.

**Path Parameter:**
- `patient_id` (integer) - The patient ID to fetch annotations for

**Response (200 OK):**
```json
[
  {
    "annotation_id": 2,
    "patient_id": 14,
    "doctor_note": "Follow-up scheduled for next week. Monitor pain levels and adjust medication if needed.",
    "created_at": "2025-11-21T12:09:44.346321+05:30"
  },
  {
    "annotation_id": 1,
    "patient_id": 14,
    "doctor_note": "Patient shows significant improvement in mobility. Continue current treatment plan.",
    "created_at": "2025-11-21T12:09:42.153374+05:30"
  }
]
```

**Error Responses:**
- `404 Not Found` - Patient does not exist
- `500 Internal Server Error` - Database error

## Testing

Run the test script:
```bash
cd backend
python test_annotations.py
```

The test script will:
1. Fetch available patients
2. Create multiple annotations
3. Retrieve all annotations for a patient
4. Verify error handling for non-existent patients

## Interactive API Documentation

Visit http://localhost:8001/docs to access the FastAPI Swagger UI for interactive testing.

## Migration

The annotations table was created using the migration file:
- `backend/migrations/001_add_annotations_table.sql`

To apply the migration manually:
```bash
cd backend
python apply_migration.py
```
