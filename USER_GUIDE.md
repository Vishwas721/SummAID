# SummAID User Guide

## Overview

SummAID is an on-premises AI assistant that synthesizes complex patient medical history into concise, verifiable summaries for clinical teams. This guide walks through key workflows for **Medical Assistants (MAs)** and **Doctors**.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Patient Dashboard](#patient-dashboard)
3. [Summary Workflow](#summary-workflow)
4. [Chatbot & Q&A](#chatbot--qa)
5. [Safety Check & Digital Prescription](#safety-check--digital-prescription)
6. [Doctor Edits](#doctor-edits)
7. [Medical Journey Views](#medical-journey-views)
8. [Specialty Features (Oncology)](#specialty-features-oncology)
9. [FAQs](#faqs)

---

## Getting Started

### Login

1. Open `http://localhost:5173` (or your hospital's SummAID URL)
2. Select your role: **MA** (Medical Assistant) or **DOCTOR**
3. Choose a patient from the list

**Roles:**
- **MA**: Can view summaries, run safety checks, generate checklists
- **DOCTOR**: Can view summaries, edit sections, prescribe, and access advanced analytics

---

## Patient Dashboard

### Patient List

- Shows all patients with **age** and **sex** badges (color-coded: emerald for age, blue/pink for sex)
- Search by name or ID
- Click to select a patient

### Patient Header

Once selected, you see:
- Patient name with age/sex badges
- Age extracted from source PDFs (e.g., "Jane, 62 years old, Female")
- Report count and summary status

---

## Summary Workflow

### 1. Generate Summary

**Steps:**
1. Click **SUMMARY** tab
2. Click **Generate Summary** button
3. Wait for LLM to process (~30-120 seconds depending on report volume)
4. View results:
   - **Universal section**: Evolution, Current Status, Action Plan (all patients)
   - **Specialty section**: If patient type is detected (e.g., oncology cards, speech data)

### 2. Understanding Summary Sections

- **Evolution**: How the patient's condition has changed over time
- **Current Status**: Present clinical picture across multiple domains
- **Action Plan**: Recommended next steps and monitoring

### 3. Citations ("Glass Box")

Each summary statement links back to source:
- Click a citation to highlight the original text
- See report name, date, and exact location
- Verify AI-generated claims

### 4. Specialty Infographics

**For Oncology Patients:**
- Tumor size trend graph (IMPROVING/WORSENING/STABLE)
- TNM staging
- Biomarker status (ER, PR, HER2, Ki-67)
- Treatment response
- Pertinent negatives (what's absent: no metastasis, etc.)

---

## Chatbot & Q&A

### Ask Questions

1. Click **CHATBOT** tab
2. Type a question (e.g., "What allergies does the patient have?")
3. Chatbot retrieves relevant context and answers
4. Answers include **citations** to source reports

### Smart Context

- Chatbot includes doctor edits (if any) as high-priority context
- Answers reflect latest clinical information, not just AI summary

---

## Safety Check & Digital Prescription

### Run Safety Check (Doctors Only)

1. Click **RX** tab
2. Enter drug name (e.g., "Penicillin")
3. Click **Run Safety Check**
4. System checks for:
   - **Allergy Match**: Drug + allergy keywords in patient records
   - **False Positive Prevention**: Only flags if drug is mentioned WITH allergy (not just generic "has allergies")

### Safety Check Results

**Green Light (Safe):**
- "No allergies detected"
- **Print Prescription** button **ENABLED**
- Proceed with prescription

**Red Alert (Allergy Detected):**
- "⚠ ALLERGY ALERT - Patient may be allergic to [Drug]"
- Shows allergic reaction or source
- **Print Prescription** button **DISABLED** (grayed out with warning text)
- Cannot prescribe until you select a different drug

### Digital Prescription PDF

**Format:**
- **Header**: Blue gradient with medical cross (✚) icon
- **Patient Info**: Name, date, system
- **Rx Badge**: Emerald circle with "Rx"
- **Medication Box**: Drug, dosage, frequency, duration (bordered)
- **Allergy Alert** (if applicable): Red box with warning
- **Signature Line**: For doctor sign-off
- **Footer Badge**: "Powered by SummAID"

**Print:**
1. Confirm safety check (no allergy)
2. Click **Print Prescription**
3. PDF opens in new window
4. Print or save as needed

---

## Doctor Edits

### Edit Summary Sections (Doctors Only)

1. In **SUMMARY** tab, locate section (e.g., Medical Journey)
2. Click **Edit** (pencil icon)
3. Modify text
4. Click **Save**
5. Edit is stored with timestamp and doctor name
6. Original AI summary **unchanged**; edit merged at read time

### View Edit History

- Click **View History** in edited section
- See all previous versions with timestamps
- Revert or compare versions

### Where Edits Are Used

- **Chat**: Doctor edits appear as high-priority context in chatbot responses
- **Safety Check**: Allergies in doctor edits are scanned for safety warnings
- **Summaries**: Merged view shows "AI + Doctor Edits"

---

## Medical Journey Views

### Toggle View Modes

In the **Medical Journey** card, click toggle buttons:

1. **Timeline** (Clock icon)
   - Events listed with dates
   - Color-coded tags for types (e.g., diagnosis, treatment)
   - Bullet points for clarity

2. **Narrative**
   - Full paragraph text (original AI summary)
   - Optional keyword highlighting (toggle on/off)
   - Best for reading flow

3. **Points**
   - Cleaned bullet list (names/dates stripped)
   - Key findings highlighted
   - Quick scan format

### Keyword Highlighting

- Toggle **Highlight** to see important medical keywords in color
- Helps spot critical findings quickly

---

## Specialty Features (Oncology)

### Oncology Summary (Jane example)

When a patient is classified as **oncology**:

1. **Tumor Size Trend Graph**
   - X-axis: Dates of measurements
   - Y-axis: Size in cm
   - Trend: IMPROVING (down), WORSENING (up), STABLE (flat)

2. **TNM Staging**
   - Tumor (T), Node (N), Metastasis (M) classification
   - Example: T2N0M0

3. **Biomarkers**
   - ER (estrogen receptor): Positive/Negative
   - PR (progesterone receptor): Positive/Negative
   - HER2 (human epidermal growth factor 2): Positive/Negative
   - Ki-67: High/Low (proliferation index)

4. **Treatment Response**
   - Complete Response, Partial Response, Stable, Progressing

5. **Pertinent Negatives**
   - What's **absent**: "No metastasis", "No lymph node involvement", "No distant spread"
   - Critical for risk assessment

### Oncology Reliability

- Extraction timeout: 120 seconds (increased for reliability)
- Prompt optimized to ~6000 characters
- If oncology data unavailable, universal summary still shown with flag

---

## FAQs

### Q: Summary not generating?
**A:** Check that:
1. Ollama LLM service is running (`ollama serve`)
2. Backend is healthy (`http://localhost:8002/docs`)
3. Patient has reports in database (check via seeding or upload)
4. Wait 30-120s depending on report volume

### Q: Allergy check saying "Allergic to every drug"?
**A:** Bug fixed: System now only flags if drug name + allergy keyword appear together (not generic "has allergies"). If still seeing false positives, report to IT.

### Q: Can I edit the AI summary?
**A:** Yes (Doctors only). Edits don't overwrite AI text; they're merged and flagged as "Doctor Edit". Original AI summary remains for audit.

### Q: Can I print the prescription if allergy is detected?
**A:** No. Print button is disabled with warning "Cannot Prescribe - Allergy Detected". Select a different drug or consult with patient/chart before proceeding.

### Q: How long does summarization take?
**A:** ~30-120 seconds depending on:
- Number and size of reports
- LLM model (llama3:8b default)
- Specialty extraction (oncology extraction: up to 120s)

### Q: Are my edits saved?
**A:** Yes. Doctor edits are append-only in the database (no overwrites). Edits persist across sessions.

### Q: Can I export the summary?
**A:** Currently, you can:
- Print prescription PDF (if safe)
- Copy/paste summary text
- Take screenshots
Full export feature coming in Phase 2.

### Q: What if oncology infographics don't appear?
**A:** Oncology extraction may have timed out. Try regenerating summary. If persistent, check backend logs for timeout errors. IT can increase timeout or optimize LLM model.

### Q: Can the MA run safety checks?
**A:** No, currently doctors only. MAs can view results if doctor has run a check.

### Q: Is my data secure?
**A:** Yes:
- All text encrypted at rest (pgcrypto)
- No data leaves hospital network
- Access controlled by role (MA vs Doctor)
- Audit logs capture safety checks and prescription events

---

## Support

- **Technical Issues**: Contact hospital IT
- **Clinical Questions**: Refer to your attending or supervisor
- **Feature Requests**: Contact SummAID team

---

## Additional Resources

- **Installation Guide**: See `INSTALL.md`
- **System Architecture**: See `README.md`
- **Database Schema**: See `documents/Database schema.txt`
- **PRS & Data Policy**: See `documents/` folder
