# SummAID Test Plan

## Document Information
- **Project**: SummAID
- **Version**: 1.0
- **Date**: December 2025
- **Author**: QA Team
- **Scope**: Functional, Integration, Security, Performance testing

---

## 1. Test Objectives

- Verify all core features work as specified (summary generation, safety check, prescriptions, doctor edits)
- Validate specialty-specific functionality (oncology infographics, speech data)
- Ensure safety-check allergy detection is accurate with no false positives
- Confirm prescription print blocking works on allergy detection
- Verify doctor edits are properly merged and used in chat/safety-check
- Test performance targets (latency <10s for retrieval, summary <120s)
- Validate security (encryption, access control, audit logging)
- Test error handling and graceful fallbacks

---

## 2. Test Scope

### In Scope
- Patient list retrieval and filtering
- Summary generation (universal, oncology, speech)
- Specialty infographics (oncology: tumor trends, biomarkers, TNM)
- RAG chat with citations
- Safety check (allergy detection, drug-specific matching)
- Digital prescription (PDF generation, print blocking)
- Doctor edits (save, history, merge with AI summary)
- Medical Journey multi-view (Timeline/Narrative/Points)
- Demographics display (age/sex badges)
- API endpoints and response validation
- Database operations (encryption, embeddings)
- Error handling and fallbacks
- Compliance logging

### Out of Scope
- Cloud deployment (on-prem only tested)
- EMR/FHIR integration (planned Phase 2)
- Patient-facing UI (Phase 2)
- Advanced visualizations beyond current infographics
- OCR for image-only PDFs (Phase 2)

---

## 3. Test Environment

### Hardware
- **Server**: On-prem hospital network (simulated: localhost)
- **DB**: PostgreSQL 14+ with pgcrypto, pgvector
- **LLM**: Ollama with llama3:8b, nomic-embed-text
- **RAM**: ≥8GB (for LLM + DB)
- **GPU**: Optional (CUDA for faster LLM)

### Software
- **Frontend**: Node 16+, React 18, Vite
- **Backend**: Python 3.9+, FastAPI
- **Database**: PostgreSQL 14+
- **LLM Service**: Ollama (local)

### Test Data
- Demo patients: Jane (62F, oncology), Rahul (5M, general)
- Sample reports: Radiology, Pathology, Lab notes
- Drug list: Penicillin (Jane allergic), Ibuprofen (safe), Aspirin (safe)
- Doctor edits: Sample edits on medical_journey and action_plan

---

## 4. Test Cases

### 4.1 Patient Management

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_001 | Retrieve patient list | GET /patients/doctor | Returns list with age, sex, all patients | ⚪ |
| TC_002 | Filter patients by name | Search "Jane" | Only Jane appears in list | ⚪ |
| TC_003 | Patient with age/sex badges | Select patient | Badges show correct age (62), sex (Female) with icons | ⚪ |
| TC_004 | Patient count consistency | List vs detail | Same patient count in list and detail view | ⚪ |

### 4.2 Summary Generation

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_005 | Generate universal summary | POST /summarize/44 (Jane) | Summary includes evolution, status, plan | ⚪ |
| TC_006 | Generate oncology summary | POST /summarize/44 (Jane) | Oncology section with tumor trend, TNM, biomarkers | ⚪ |
| TC_007 | Summary latency | Generate summary, measure time | <120s (typically 30-60s) | ⚪ |
| TC_008 | Summary contains citations | View generated summary | All claims have clickable citations | ⚪ |
| TC_009 | Summary accuracy | Manual review by clinician | Critical findings present, no hallucinations | ⚪ |
| TC_010 | No reports for patient | Create patient with no reports | Returns safe summary or flag | ⚪ |

### 4.3 Specialty Infographics (Oncology)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_011 | Tumor size trend graph | Generate Jane summary | Graph shows sizes with dates, trend (IMPROVING/WORSENING/STABLE) | ⚪ |
| TC_012 | TNM staging extraction | Check summary | TNM field populated (e.g., T2N0M0) | ⚪ |
| TC_013 | Biomarker extraction | Check summary | ER, PR, HER2 status shown | ⚪ |
| TC_014 | Pertinent negatives | Check summary | "No metastasis", "No distant spread" listed | ⚪ |
| TC_015 | Oncology extraction timeout | Wait 120s | If timeout, flag missing data but return universal summary | ⚪ |
| TC_016 | Non-oncology patient | Generate Rahul summary | No oncology section, only universal | ⚪ |

### 4.4 RAG Chat

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_017 | Chat basic question | POST /chat/44 "What is the trend in tumor size?" | Answer includes trend info with citations | ⚪ |
| TC_018 | Chat with allergy question | "What allergies does Jane have?" | Returns documented allergies if any | ⚪ |
| TC_019 | Chat includes doctor edits | Doctor edits medical_journey, then ask chat | Chat answer reflects doctor edit | ⚪ |
| TC_020 | Chat citation accuracy | Get answer with citation | Citation text matches source report | ⚪ |
| TC_021 | Chat latency | Ask question, measure time | <10s for retrieval + answer | ⚪ |
| TC_022 | Chat on non-existent patient | POST /chat/9999 | Returns 404 or "patient not found" | ⚪ |

### 4.5 Doctor Edits

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_023 | Doctor edit medical_journey | POST /patients/44/summary/edit with medical_journey content | Edit saved with timestamp, edit_id | ⚪ |
| TC_024 | Doctor edit action_plan | POST /patients/44/summary/edit with action_plan content | Edit saved | ⚪ |
| TC_025 | Retrieve merged summary | GET /patients/44/summary | Response includes AI summary + latest doctor edits | ⚪ |
| TC_026 | Edit append-only (no overwrite) | Create 2 edits on same section | GET shows latest edit; previous edit in history | ⚪ |
| TC_027 | Edit appears in chat | Edit, then ask chat | Chat answer includes doctor edit content | ⚪ |
| TC_028 | Edit appears in safety-check | Edit with allergy mention, run safety-check | Safety-check scans doctor edit | ⚪ |
| TC_029 | Invalid section name | POST /patients/44/summary/edit with section="invalid" | Returns 400 or validation error | ⚪ |

### 4.6 Safety Check & Allergy Detection

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_030 | Safety check - allergic drug | POST /safety-check/44 with drug="Penicillin" (Jane allergic) | has_allergy=true, warnings show allergy | ⚪ |
| TC_031 | Safety check - safe drug | POST /safety-check/44 with drug="Ibuprofen" (not allergic) | has_allergy=false, no warnings | ⚪ |
| TC_032 | Safety check - no false positives | Patient with generic allergies, check unrelated drug | has_allergy=false (not true even though patient has allergies) | ⚪ |
| TC_033 | Safety check - drug + allergy co-occurrence | Ensure logic requires BOTH drug name + allergy keyword in same chunk | Only flags if co-occur, not just generic allergies | ⚪ |
| TC_034 | Safety check includes all sources | Check patient with: report allergies + doctor edit allergies + annotation allergies | All sources scanned, citations show origin | ⚪ |
| TC_035 | Safety check latency | Run check, measure time | <5s | ⚪ |
| TC_036 | Safety check on non-existent patient | POST /safety-check/9999 | Returns 404 | ⚪ |

### 4.7 Digital Prescription

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_037 | Prescription PDF structure | Generate prescription for safe drug | PDF has header, patient info, Rx badge, meds box, signature line, footer | ⚪ |
| TC_038 | Prescription PDF colors | View PDF | Blue header, emerald Rx badge, red allergy alert (if applicable), professional styling | ⚪ |
| TC_039 | Prescription print enabled (safe drug) | Run safety check (safe), attempt print | Print button ENABLED, PDF opens/prints | ⚪ |
| TC_040 | Prescription print blocked (allergy) | Run safety check (allergic drug), attempt print | Print button DISABLED, shows "Cannot Prescribe - Allergy Detected" | ⚪ |
| TC_041 | Prescription print blocked (before safety check) | Don't run safety check, attempt print | Print button DISABLED, shows "Run Safety Check First" | ⚪ |
| TC_042 | Prescription with allergy alert box | Generate prescription for allergic drug | PDF includes red "⚠ ALLERGY ALERT" box with details | ⚪ |
| TC_043 | Prescription includes dosage/frequency/duration | Fill all fields | PDF shows all entered data | ⚪ |
| TC_044 | Prescription filename | Generate prescription | Filename includes drug name and date | ⚪ |

### 4.8 Medical Journey Multi-View

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_045 | Toggle Timeline view | Click Timeline button | Events shown with date badges, color-coded tags | ⚪ |
| TC_046 | Toggle Narrative view | Click Narrative button | Full paragraph text displayed | ⚪ |
| TC_047 | Toggle Points view | Click Points button | Bullet list with cleaned text, no names/dates | ⚪ |
| TC_048 | Keyword highlighting | Toggle highlight | Keywords highlighted in color in Narrative/Points | ⚪ |
| TC_049 | Timeline date extraction | View Timeline | Dates correctly parsed from evolution text | ⚪ |
| TC_050 | Timeline tag detection | View Timeline | Tags auto-detected (diagnosis, treatment, etc.) | ⚪ |

### 4.9 UI/UX & Demographics

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_051 | Patient header badges | Select patient | Age badge (emerald, with icon), sex badge (blue/pink, with icon) | ⚪ |
| TC_052 | Age extraction from PDF | Jane's age | Shows 62 (extracted from PDF, not hash) | ⚪ |
| TC_053 | Sex display in badge | Jane display | Shows "Female" with user icon | ⚪ |
| TC_054 | Specialty cards render (oncology) | Jane summary | Oncology cards visible | ⚪ |
| TC_055 | Specialty cards hidden (non-oncology) | Rahul summary | No oncology cards visible | ⚪ |
| TC_056 | All patients in list (not just with summaries) | /patients/doctor | Both Jane (with summary) and Rahul (maybe no summary) shown | ⚪ |

### 4.10 Error Handling & Fallbacks

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_057 | LLM timeout handling | Let summary generation timeout (~120s) | Gracefully return partial data or flag; no crash | ⚪ |
| TC_058 | Oncology extraction timeout | Force oncology timeout | Universal summary returned, oncology flagged missing | ⚪ |
| TC_059 | Database connection error | Stop PostgreSQL, try summary | Graceful error message, no crash | ⚪ |
| TC_060 | Ollama service unavailable | Stop Ollama, try summary | Error message "LLM service unavailable", no crash | ⚪ |
| TC_061 | Missing encryption key | Remove encryption key, try access | Error or fallback, no crash | ⚪ |
| TC_062 | Invalid patient ID | Try GET /patients/abc | Returns 400 or validation error | ⚪ |
| TC_063 | Empty report | Patient with no text content | Handles gracefully | ⚪ |

### 4.11 Security & Compliance

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_064 | Text encryption at rest | Check DB directly (pgcrypto) | Report text is encrypted BYTEA, not plaintext | ⚪ |
| TC_065 | Embedding storage | Check pgvector column | Embeddings stored as vector(768), not plaintext | ⚪ |
| TC_066 | Access control (MA) | Log in as MA, try doctor edit | Cannot access edit endpoint; returns 403 | ⚪ |
| TC_067 | Access control (DOCTOR) | Log in as DOCTOR, access edit | Can access and edit | ⚪ |
| TC_068 | Audit log - safety check | Run safety check, check logs | Event logged with patient_id, drug_name, result | ⚪ |
| TC_069 | Audit log - doctor edit | Doctor edits, check logs | Event logged with editor, section, timestamp | ⚪ |
| TC_070 | Audit log - prescription print | Print prescription, check logs | Event logged with patient_id, drug_name, timestamp | ⚪ |
| TC_071 | No PHI in logs (sanitized) | Check logs for plaintext patient data | Logs use patient_id only, not names/details | ⚪ |
| TC_072 | CORS headers | Frontend request from different origin | Response headers allow/deny correctly | ⚪ |

### 4.12 Performance

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_073 | Patient list retrieval latency | GET /patients/doctor | <1s | ⚪ |
| TC_074 | Vector similarity search latency | Query pgvector index | <1s for top-N results | ⚪ |
| TC_075 | Summary generation latency | POST /summarize with N reports | <120s (target: 30-60s) | ⚪ |
| TC_076 | Chat response latency | POST /chat with question | <10s | ⚪ |
| TC_077 | Safety check latency | POST /safety-check | <5s | ⚪ |
| TC_078 | Doctor edit save latency | POST /patients/{id}/summary/edit | <1s | ⚪ |
| TC_079 | PDF generation latency | Generate prescription PDF | <2s | ⚪ |
| TC_080 | Load test - 10 concurrent requests | Simulate 10 users hitting /patients/doctor | All succeed, <1s each | ⚪ |

### 4.13 Integration Tests

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TC_081 | Full workflow: MA | MA logs in → view patient → generate summary → view chat → run safety check | All steps succeed, no errors | ⚪ |
| TC_082 | Full workflow: Doctor | Doctor logs in → view patient → generate summary → edit section → view chat (includes edit) → run safety check → print prescription (if safe) | All steps succeed, edits integrated | ⚪ |
| TC_083 | Workflow: Edit + Chat | Doctor edits medical_journey → chat asks about journey → answer reflects edit | Edit properly merged | ⚪ |
| TC_084 | Workflow: Edit + Safety Check | Doctor edits with allergy mention → safety-check scans → flagged in results | Edit included in safety scan | ⚪ |
| TC_085 | Workflow: Multiple edits | Doctor makes 2+ edits on same section → latest edit shown, history preserved | Append-only logic works | ⚪ |

---

## 5. Test Execution Strategy

### Phase 1: Unit Testing (Backend)
- Test individual API endpoints in isolation
- Test utility functions (embedding, encryption, text extraction)
- Mock LLM responses for deterministic testing

### Phase 2: Integration Testing
- Test full workflows (patient → summary → chat → prescription)
- Test doctor edits in context (chat + safety-check)
- Test specialty extraction pipeline

### Phase 3: System Testing
- Test on full environment (frontend + backend + DB + LLM)
- Test with demo data (Jane, Rahul, sample reports)
- Measure performance under load

### Phase 4: Compliance & Security
- Verify encryption, access control, audit logging
- Validate no PHI in logs
- Check CORS, role-based access

### Phase 5: Regression Testing
- After each code change, rerun critical tests
- Focus on: safety check (no false positives), prescription blocking, doctor edits

---

## 6. Test Tools & Resources

- **Unit Testing**: pytest (Python backend)
- **API Testing**: curl, Postman, pytest-asyncio
- **Frontend Testing**: React Testing Library, Vitest
- **Load Testing**: Apache JMeter or wrk
- **Database**: psql CLI for direct schema/data verification
- **Logging**: Backend logs (FastAPI), application logs for audit trail
- **Monitoring**: CPU, RAM, latency metrics during test runs

---

## 7. Test Data Requirements

### Demo Patients
1. **Jane** (patient_id=44)
   - Age: 62, Sex: Female
   - Specialty: Oncology
   - Allergies: Penicillin (documented)
   - Reports: Radiology (tumor 2.3cm), Pathology (ER+ PR+ HER2-), Lab (WBC 7.2)

2. **Rahul** (patient_id=48)
   - Age: 5, Sex: Male
   - Specialty: General
   - Allergies: None documented
   - Reports: Pediatric note, basic labs

### Test Drugs
- Penicillin: Jane allergic (triggers has_allergy=true)
- Ibuprofen: Safe for all (triggers has_allergy=false)
- Aspirin: Safe for all

### Doctor Edit Samples
- Medical Journey: "Patient responded well to chemotherapy, pain improved significantly."
- Action Plan: "Continue current regimen, reassess in 4 weeks."

---

## 8. Pass/Fail Criteria

### Must Pass (Go/No-Go)
- TC_030, TC_031, TC_032: Safety check no false positives
- TC_039, TC_040: Prescription print blocking works
- TC_023, TC_026, TC_027: Doctor edits append-only & used in chat
- TC_005, TC_006: Summary generation completes
- TC_064, TC_065, TC_066: Security (encryption, access control)

### Should Pass (High Priority)
- All TC_0XX in sections 4.1-4.9 (main features)
- Performance tests: latency <10s for chat, <120s for summary

### Nice-to-Have (Future)
- Load tests (TC_080)
- Advanced integration tests (TC_085)

---

## 9. Deliverables

- Test Plan (this document)
- Test Case Execution Log
- Test Result Summary Report
- Bug Report (if any failures)
- Performance Baseline Report
- Coverage Report

---

## 10. Schedule

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1 (Unit) | 1 day | Dec 20 | Dec 20 |
| Phase 2 (Integration) | 2 days | Dec 21 | Dec 22 |
| Phase 3 (System) | 2 days | Dec 23 | Dec 24 |
| Phase 4 (Security) | 1 day | Dec 27 | Dec 27 |
| Phase 5 (Regression) | Ongoing | Dec 28 | Release |

---

## 11. Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Lead | | | |
| Development Lead | | | |
| Product Owner | | | |
