# Multi-Report Demo Setup Guide

## Overview
The schema now supports a true one-to-many relationship: one patient can have multiple reports (e.g., MRI, Pathology, Lab).

## New Schema Structure

1. **patients** table
   - `patient_id` (primary key)
   - `patient_demo_id` (unique, e.g., "patient_jane_doe")
   - `patient_display_name` (e.g., "Jane Doe")

2. **reports** table
   - `report_id` (primary key)
   - `patient_id` (foreign key → patients)
   - `report_filepath_pointer`
   - `report_type` (e.g., "Radiology", "Pathology", "Laboratory")
   - `report_text_encrypted`

3. **report_chunks** table (unchanged structure)
   - Links to reports via `report_id`

## Demo Data Setup

### Step 1: Organize Your PDFs
The seed script will group PDFs by patient based on filename patterns. PDFs are grouped when they share a common prefix before the first underscore.

**Example file structure to demo multi-report:**
```
backend/demo_reports/
  jane_mri.pdf          → Patient "Jane" - Radiology report
  jane_pathology.pdf    → Patient "Jane" - Pathology report
  john_ct.pdf           → Patient "John" - Radiology report
  john_lab.pdf          → Patient "John" - Laboratory report
  demo_xray.pdf         → Patient "Demo" - Radiology report
```

**Naming convention:**
- Format: `{patientName}_{reportType}.pdf`
- Patient names before underscore will be grouped together
- Report type is inferred from filename keywords:
  - **Radiology**: mri, ct, xray, radiology, imaging
  - **Pathology**: path, biopsy, histology
  - **Laboratory**: lab, blood, cbc
  - **Clinical Summary**: discharge, summary
  - **General**: anything else

### Step 2: Reset and Seed Database

```powershell
# Navigate to backend directory
cd backend

# Drop and recreate schema (WARNING: destroys existing data)
$env:PGPASSWORD="your_password"
psql -U postgres -d summaid_db -f schema.sql

# Run the seed script
python seed.py
```

### Step 3: Verify Multi-Report Setup

```powershell
# Connect to database
psql -U postgres -d summaid_db

# Check patients
SELECT * FROM patients;

# Check reports per patient
SELECT p.patient_display_name, r.report_type, r.report_filepath_pointer
FROM patients p
JOIN reports r ON r.patient_id = p.patient_id
ORDER BY p.patient_display_name, r.report_id;

# Count reports per patient (should show patients with multiple reports)
SELECT p.patient_display_name, COUNT(r.report_id) as report_count
FROM patients p
JOIN reports r ON r.patient_id = p.patient_id
GROUP BY p.patient_id, p.patient_display_name
ORDER BY report_count DESC;
```

## API Changes

### `/patients` endpoint
**Before:** Returned array of strings (patient_demo_id)
```json
["patient_jane_doe", "patient_john_smith"]
```

**After:** Returns array of patient objects
```json
[
  {
    "patient_demo_id": "patient_jane",
    "patient_display_name": "Jane"
  },
  {
    "patient_demo_id": "patient_john",
    "patient_display_name": "John"
  }
]
```

### `/reports/{patient_demo_id}` endpoint
**New field added:**
```json
[
  {
    "report_id": 1,
    "filepath": "./demo_reports/jane_mri.pdf",
    "filename": "jane_mri.pdf",
    "report_type": "Radiology"
  },
  {
    "report_id": 2,
    "filepath": "./demo_reports/jane_pathology.pdf",
    "filename": "jane_pathology.pdf",
    "report_type": "Pathology"
  }
]
```

### `/summarize/{patient_demo_id}` endpoint
Now synthesizes across **all reports** for that patient automatically.

## Demo Scenario

1. **Create multi-report patients:**
   - Place `jane_mri.pdf` and `jane_pathology.pdf` in `demo_reports/`
   - Run `python seed.py`

2. **View in UI:**
   - Login to dashboard
   - Select "Jane" from patient sidebar
   - See multiple reports appear as tabs in the PDF viewer
   - Click "Generate Summary"
   - The summary will synthesize information from BOTH reports
   - Citations will link back to specific pages in the correct report

3. **Verify Glass Box:**
   - Each citation shows which report (by filename) the evidence came from
   - Clicking "view" opens the correct PDF and jumps to the cited page
   - Summary is verifiable across multiple source documents

## Migration Notes

### For existing databases:
If you have existing data, you'll need to migrate:

```sql
-- Create new patients table
CREATE TABLE patients (
    patient_id SERIAL PRIMARY KEY,
    patient_demo_id TEXT UNIQUE NOT NULL,
    patient_display_name TEXT NOT NULL
);

-- Populate patients from existing reports
INSERT INTO patients (patient_demo_id, patient_display_name)
SELECT DISTINCT patient_demo_id, 
       REPLACE(REPLACE(patient_demo_id, 'patient_', ''), '_', ' ')
FROM reports;

-- Add patient_id column to reports
ALTER TABLE reports ADD COLUMN patient_id INTEGER REFERENCES patients(patient_id);

-- Populate patient_id
UPDATE reports r
SET patient_id = p.patient_id
FROM patients p
WHERE r.patient_demo_id = p.patient_demo_id;

-- Make patient_id NOT NULL and drop patient_demo_id from reports
ALTER TABLE reports ALTER COLUMN patient_id SET NOT NULL;
ALTER TABLE reports DROP COLUMN patient_demo_id;

-- Add report_type column
ALTER TABLE reports ADD COLUMN report_type TEXT;
```

## Testing the Multi-Report RAG

After seeding, test the core feature:

```powershell
# Test summarization across multiple reports
cd backend
.\test_summarize.ps1 patient_jane
```

You should see:
- Summary text synthesizing across all of Jane's reports
- Citations from multiple different report_ids
- Evidence from both Radiology and Pathology reports

## Frontend Updates

The PatientSidebar now shows:
- **Display name** (large text): "Jane"
- **Demo ID** (small text): "patient_jane"

The chart view report tabs now show report type badges (future enhancement opportunity).
