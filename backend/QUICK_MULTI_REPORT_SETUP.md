# Quick Multi-Report Demo Setup

## Current Status
✓ New schema is active (patients → reports → report_chunks)
✓ 8 patients loaded, each with 1 report
⚠ No multi-report patients yet

## To Demo the Multi-Report Feature

### Option 1: Duplicate and Rename Existing PDFs

```powershell
# Navigate to demo_reports folder
cd c:\SummAID\backend\demo_reports

# Create multi-report patient "Jane" by copying MRI files
Copy-Item "brain-mri-sample-report-1.pdf" "jane_brain_mri.pdf"
Copy-Item "abdomen-mri-with-contrast-sample-report-1.pdf" "jane_abdomen_mri.pdf"

# Create multi-report patient "John" with different report types
Copy-Item "cervical-spine-mri-sample-report-1.pdf" "john_mri.pdf"
Copy-Item "sterling-accuris-pathology-sample-report-unlocked.pdf" "john_pathology.pdf"

# Go back and reseed
cd ..
python reset_db.py  # Type 'yes' when prompted
python seed.py
python test_schema.py  # Should now show 2+ multi-report patients!
```

### Option 2: Add Your Own Medical PDFs

Place multiple PDFs with the same patient prefix:
```
demo_reports/
  patient_jane_mri_scan.pdf
  patient_jane_pathology_biopsy.pdf
  patient_jane_lab_results.pdf
  patient_john_ct_scan.pdf
  patient_john_discharge_summary.pdf
```

Then reseed:
```powershell
cd c:\SummAID\backend
python reset_db.py
python seed.py
```

## What You'll See

After reseeding with multi-report patients:

1. **In the database:**
   ```
   Patient: Jane
     - Radiology: jane_brain_mri.pdf
     - Radiology: jane_abdomen_mri.pdf
   
   Patient: John
     - Radiology: john_mri.pdf
     - Pathology: john_pathology.pdf
   ```

2. **In the UI:**
   - Patient sidebar shows "Jane" and "John"
   - Selecting Jane shows 2 report tabs in PDF viewer
   - Generate Summary synthesizes across BOTH reports
   - Citations link back to the correct source report

3. **The "Glass Box" in action:**
   - Summary combines findings from multiple reports
   - Each citation shows which report it came from
   - Click "view" to jump to that specific report and page
   - Verifiable evidence across the patient's full medical record

## Test the Multi-Report Summarization

```powershell
# After creating multi-report patients
cd c:\SummAID\backend
.\test_summarize.ps1 patient_jane
```

You should see citations from multiple report_ids!
