# WORKFLOW: EVALUATING ONCOLOGY SUMMARIES
## Step-by-Step Instructions After LLM Setup

---

## PREREQUISITES

✅ You have **LLM_SYSTEM_PROMPT_ONCOLOGY.md** open  
✅ You have a **NEW conversation** open in ChatGPT/Claude/Gemini  
✅ You have **original medical documents** (5-7 files)  
✅ You have a **SummAID-generated summary** (text)  
✅ You have an **infographic image** (PNG/JPG)

---

## STEP 1: SET UP THE LLM (1 minute)

### What to do:
1. Open ChatGPT, Claude.ai, Gemini, or your chosen LLM
2. Start a **NEW conversation**
3. Copy the entire **LLM_SYSTEM_PROMPT_ONCOLOGY.md** file (from the code block section)
4. Paste it into the chat

### What you'll type:
```
[Paste entire system prompt from LLM_SYSTEM_PROMPT_ONCOLOGY.md]
```

### Expected LLM response:
The LLM will say something like:
> "I understand. I'm ready to evaluate oncology summaries using the 6-dimension framework. I'll score Medical Journey accuracy, Action Plan accuracy, Infographic accuracy, Completeness, Hallucination Detection, and Clinical Utility on a 0-10 scale. I'm ready for the medical documents when you are."

**Status**: ✅ LLM is configured

---

## STEP 2: UPLOAD ORIGINAL MEDICAL DOCUMENTS (2 minutes)

### What to do:
Tell the LLM you're uploading source documents. Then upload your patient's original medical records.

### What you'll type:
```
I'm uploading the original medical documents for this patient. These are the source documents I want you to reference. Read them carefully and remember all the details. I'll refer to them later.

Document 1: [Consultation notes]
Document 2: [Mammography report]
Document 3: [Biopsy results]
Document 4: [CT staging]
Document 5: [Lab results]
Document 6: [Tumor board summary]
Document 7: [Pre-op clearance]
```

### How to upload:
- **If using ChatGPT/Claude**: Click the + icon or paperclip → upload PDFs/images
- **If using Gemini**: Click the attachment icon
- **If using text-based**: Copy-paste the document text directly

### Upload order (recommended):
1. Consultation notes (gives context)
2. Imaging reports (CT, MRI, mammography)
3. Pathology/biopsy reports (diagnosis details)
4. Lab results (hormone receptor status, genetic testing)
5. Tumor board notes (treatment recommendations)
6. Any additional records

### Expected LLM response:
The LLM will confirm it has read the documents:
> "I've reviewed all the medical documents. I can see the patient diagnosis, staging, test results, and recommendations. I'm ready for the next step."

**Status**: ✅ Medical documents uploaded and memorized

---

## STEP 3: PASTE THE SUMNAID SUMMARY (1 minute)

### What to do:
Tell the LLM you're providing the AI-generated summary. Paste your SummAID output with three clear sections.

### What you'll type:
```
Here is the AI-generated summary I want you to evaluate:

---

MEDICAL JOURNEY:
[Paste the medical_journey text from SummAID]

ACTION PLAN:
[Paste the action_plan text from SummAID]

INFOGRAPHIC DATA:
[Paste description of what the infographic shows]

---
```

### How to get your SummAID summary:
1. Go to SummAID backend: `POST /api/patients/{patient_id}/summarize`
2. Extract fields:
   - `medical_journey`
   - `action_plan`
   - `specialty_summary` (infographic text)

### Example format:
```
MEDICAL JOURNEY:
Jane Doe is a 62-year-old female with newly diagnosed Stage IIB invasive ductal carcinoma of the left breast. Diagnosed on mammography showing 3.2cm mass. Biopsy confirmed invasive ductal adenocarcinoma, ER+/PR+/HER2-. Oncotype DX score of 18 indicates moderate recurrence risk. No distant metastases on CT chest/abdomen/pelvis.

ACTION PLAN:
1. Adriamycin 60mg/m² IV every 2 weeks × 4 cycles (AC regimen)
2. Paclitaxel 80mg/m² IV weekly × 12 weeks
3. Left partial mastectomy with sentinel lymph node biopsy
4. Radiation therapy to chest wall
5. Tamoxifen 20mg daily × 5 years or aromatase inhibitor

INFOGRAPHIC DATA:
Timeline showing: Diagnosis → Chemotherapy (16 weeks) → Surgery (2 weeks post-chemo) → Radiation (6 weeks) → Hormone therapy (5 years). Survival curves show 85% disease-free survival at 5 years.
```

### Expected LLM response:
The LLM will confirm:
> "I have the AI-generated summary. I can see the Medical Journey describing the patient's diagnosis, the Action Plan outlining treatment, and the Infographic Data describing a timeline. Ready for the infographic image."

**Status**: ✅ Summary received

---

## STEP 4: UPLOAD THE INFOGRAPHIC IMAGE (1 minute)

### What to do:
Tell the LLM you're uploading the infographic image/screenshot. Upload the visual representation.

### What you'll type:
```
Here is the infographic image representing the summary:

[Upload image file]
```

### How to get your infographic image:
1. From SummAID frontend, generate the infographic
2. Take a screenshot (Ctrl+Print Screen)
3. Save as PNG or JPG
4. Upload to LLM

### What the image should show:
- Patient's disease stage/progression
- Treatment timeline (if applicable)
- Key metrics/findings (tumor size, markers, etc.)
- Visual representation of recommendations
- Any charts or graphs

### Expected LLM response:
The LLM will confirm:
> "I can see the infographic image. I have all the information I need: the source documents, the AI summary, and the visual representation. Ready to evaluate."

**Status**: ✅ Infographic image received

---

## STEP 5: REQUEST EVALUATION (2-5 minutes)

### What to do:
Ask the LLM to evaluate the summary using all 6 dimensions.

### What you'll type:
```
Now evaluate this summary against the source documents using the criteria you were given. Provide a score from 0-10 for each dimension, with your reasoning. Use the output format specified.
```

### Wait time:
The LLM will process and respond in **2-5 minutes** depending on:
- Length of documents
- LLM speed
- System load

### Expected output:
The LLM will return:
```
## ONCOLOGY SUMMARY EVALUATION RESULTS

### Medical Journey Accuracy: 8/10
**Reasoning**: The summary accurately captures... [explanation]

### Action Plan Accuracy: 9/10
**Reasoning**: All recommendations are supported by... [explanation]

### Infographic Accuracy: 7/10
**Reasoning**: The visual representation... [explanation]

### Completeness: 8/10
**Reasoning**: The summary captures most important... [explanation]

### Hallucination Detection: 10/10
**Reasoning**: No false statements detected... [explanation]

### Clinical Utility: 8/10
**Reasoning**: This summary would save... [explanation]

---
## OVERALL ACCURACY
**Raw Score**: 50/60 × 100 = **83.3%**
**Recommendation**: This summary is clinically useful...
```

**Status**: ✅ Evaluation complete

---

## STEP 6: RECORD YOUR SCORES (1 minute)

### What to do:
Copy the LLM's scores and save them for aggregation.

### Create a file or spreadsheet:
```
Patient: Jane Doe
Specialty: Oncology
LLM: GPT-4
Date: Dec 20, 2025

Scores:
- Medical Journey: 8/10
- Action Plan: 9/10
- Infographic: 7/10
- Completeness: 8/10
- Hallucination Detection: 10/10
- Clinical Utility: 8/10

Average: 83.3%
```

**Status**: ✅ Scores recorded

---

## STEP 7: REPEAT WITH OTHER LLMs (Optional, 45 min total)

### To get consensus accuracy, repeat steps 1-6 with:

1. **Claude 3 Opus**: claude.ai
2. **Gemini Pro**: gemini.google.com
3. **Llama 3**: via API or huggingface
4. **Mistral Large**: via API

### Each iteration takes ~10 minutes:
- New conversation
- Paste system prompt
- Upload documents (or just remind it)
- Paste summary
- Upload image
- Request evaluation

### Expected result:
5 evaluations × ~83% average = **83% consensus accuracy**

**Status**: ✅ Multiple LLM evaluations complete

---

## FINAL STEP: CALCULATE FINAL ACCURACY

### Simple calculation:
```
GPT-4: 83.3%
Claude: 85.2%
Gemini: 81.5%
Llama: 84.1%
Mistral: 82.9%

AVERAGE: (83.3 + 85.2 + 81.5 + 84.1 + 82.9) / 5 = 83.4%
```

### What to tell hospitals:
> "We evaluated this summary using 5 independent LLMs (GPT-4, Claude 3 Opus, Gemini Pro, Llama 3, Mistral Large). Consensus accuracy: **83.4%**"

---

## TIMELINE SUMMARY

| Step | Time | What |
|------|------|------|
| 1 | 1 min | Set up LLM |
| 2 | 2 min | Upload documents |
| 3 | 1 min | Paste summary |
| 4 | 1 min | Upload image |
| 5 | 3 min | Request evaluation |
| 6 | 1 min | Record scores |
| **Single LLM** | **~9 min** | **One evaluation** |
| × 5 LLMs | **~45 min** | **Consensus accuracy** |

---

## TROUBLESHOOTING

### "LLM says it can't see the image"
→ Try uploading again  
→ Use PNG or JPG format  
→ Make sure image is clear and readable  
→ Try with different LLM

### "LLM keeps forgetting the documents"
→ Re-upload all documents  
→ Ask LLM: "Do you remember all 7 medical documents?"  
→ If no, paste them again as text

### "Scores seem too high/low"
→ This is normal - different LLMs have different thresholds  
→ Averaging 5 LLMs gives more reliable result than any single one

### "LLM won't follow the output format"
→ In step 5, be more specific:  
   "Use this exact format: [paste format]"  
→ Or ask: "Please provide one score per line like this..."

---

## NEXT: Audiology Evaluation

→ If evaluating an **audiology patient**, use **LLM_SYSTEM_PROMPT_AUDIOLOGY.md** instead  
→ Follow the same workflow with **WORKFLOW_AUDIOLOGY_STEP_BY_STEP.md**

---

**Ready to evaluate?**  
Start with Step 1 now. Takes ~10 minutes per LLM. 🚀

