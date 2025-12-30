# WORKFLOW: EVALUATING AUDIOLOGY SUMMARIES
## Step-by-Step Instructions After LLM Setup

---

## PREREQUISITES

✅ You have **LLM_SYSTEM_PROMPT_AUDIOLOGY.md** open  
✅ You have a **NEW conversation** open in ChatGPT/Claude/Gemini  
✅ You have **original medical documents** (5-7 files)  
✅ You have a **SummAID-generated summary** (text)  
✅ You have an **infographic image** (PNG/JPG with audiometry curves)

---

## STEP 1: SET UP THE LLM (1 minute)

### What to do:
1. Open ChatGPT, Claude.ai, Gemini, or your chosen LLM
2. Start a **NEW conversation**
3. Copy the entire **LLM_SYSTEM_PROMPT_AUDIOLOGY.md** file (from the code block section)
4. Paste it into the chat

### What you'll type:
```
[Paste entire system prompt from LLM_SYSTEM_PROMPT_AUDIOLOGY.md]
```

### Expected LLM response:
The LLM will say something like:
> "I understand. I'm ready to evaluate audiology summaries using the 6-dimension framework. I'll score Audiology Profile accuracy, Action Plan accuracy, Infographic accuracy, Completeness, Hallucination Detection, and Clinical Utility on a 0-10 scale. I'm ready for the medical documents when you are."

**Status**: ✅ LLM is configured

---

## STEP 2: UPLOAD ORIGINAL MEDICAL DOCUMENTS (2 minutes)

### What to do:
Tell the LLM you're uploading source documents. Then upload your patient's original medical records.

### What you'll type:
```
I'm uploading the original medical documents for this patient. These are the source documents I want you to reference. Read them carefully and remember all the details. I'll refer to them later.

Document 1: [Audiology consultation notes]
Document 2: [Audiometry test results]
Document 3: [ABR/balance testing]
Document 4: [Tinnitus assessment]
Document 5: [Hearing aid trial notes]
Document 6: [Ototoxicity screening if applicable]
Document 7: [Patient counseling notes]
```

### How to upload:
- **If using ChatGPT/Claude**: Click the + icon or paperclip → upload PDFs/images
- **If using Gemini**: Click the attachment icon
- **If using text-based**: Copy-paste the document text directly

### Upload order (recommended):
1. Consultation notes (gives context, patient demographics, chief complaint)
2. Audiometry results (baseline thresholds, speech discrimination)
3. Balance testing (if performed)
4. Tinnitus assessment (severity, laterality, impact)
5. Hearing aid trial or recommendation notes
6. Any imaging (MRI, CT if relevant)
7. Patient education or counseling records

### Expected LLM response:
The LLM will confirm it has read the documents:
> "I've reviewed all the audiology documents. I can see the patient's hearing loss profile, audiometry findings, tinnitus status, and hearing aid recommendations. I'm ready for the next step."

**Status**: ✅ Medical documents uploaded and memorized

---

## STEP 3: PASTE THE SUMNAID SUMMARY (1 minute)

### What to do:
Tell the LLM you're providing the AI-generated summary. Paste your SummAID output with sections.

### What you'll type:
```
Here is the AI-generated summary I want you to evaluate:

---

PATIENT PROFILE:
[Paste hearing status, etiology, comorbidities from SummAID]

HEARING ASSESSMENT:
[Paste audiometry findings, thresholds, speech discrimination]

ACTION PLAN:
[Paste recommendations, hearing aid plan, counseling, follow-up]

INFOGRAPHIC DATA:
[Paste description of audiometry visualization]

---
```

### How to get your SummAID summary:
1. Go to SummAID backend: `POST /api/patients/{patient_id}/summarize`
2. Extract fields:
   - `medical_journey` (Patient profile)
   - `action_plan` (Treatment/intervention plan)
   - `specialty_summary` (Infographic text/description)

### Example format:
```
PATIENT PROFILE:
Robert Chen is a 58-year-old male with bilateral sensorineural hearing loss (SNHL) of mixed etiology, primarily noise-induced from 35 years of industrial work exposure plus age-related presbycusis. Onset gradual over 15 years. Currently reports difficulty understanding speech in noisy environments, tinnitus in both ears at 7-8/10 severity (worse at night), no balance issues.

HEARING ASSESSMENT:
Pure tone audiometry shows bilateral high-frequency SNHL with air-bone gap < 10dB throughout (sensorineural pattern). Thresholds: 500Hz 35dB, 1kHz 42dB, 2kHz 48dB, 4kHz 62dB, 8kHz 65dB (bilateral). Speech discrimination 72% at 80dB (right), 68% (left) = moderate impact. Tympanometry normal. Acoustic reflex present.

ACTION PLAN:
1. Starkey Livio AI hearing aids (binaural, receiver-in-canal)
2. Settings: gain +6dB at 2-4kHz, compression ratio 4:1
3. Tinnitus masking feature enabled (white noise background 65dB)
4. Follow-up audiology: 2 weeks (verification), 4 weeks (fine-tuning), 3 months
5. Occupational hearing protection counseling
6. Referral to ENT if tinnitus worsens

INFOGRAPHIC DATA:
Audiometry curves showing bilateral SNHL pattern. Frequency on X-axis (125Hz-8kHz), dB on Y-axis. Treatment timeline: Hearing aid fitting → 2-week follow-up → Fine-tuning → Ongoing monitoring.
```

### Expected LLM response:
The LLM will confirm:
> "I have the AI-generated summary. I can see the Patient Profile describing hearing loss, the Hearing Assessment with audiometry findings, the Action Plan with interventions, and the Infographic Data. Ready for the infographic image."

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
1. From SummAID frontend, generate the audiology infographic
2. Take a screenshot (Ctrl+Print Screen)
3. Save as PNG or JPG
4. Upload to LLM

### What the image should show:
- Audiometry curves (frequencies vs. hearing thresholds)
- Left ear vs. right ear comparison
- Severity classification (normal, mild, moderate, severe, profound)
- Treatment recommendation visualization
- Tinnitus severity indicator (if applicable)
- Hearing aid settings or follow-up timeline

### Image quality tips:
- Ensure axes are clearly labeled (Frequency: 125Hz-8kHz; Hearing Level: -10dB to 120dB)
- Use standard audiometry symbols (O for right ear, X for left ear, U for unmasked bone)
- Make sure text is readable (title, legend, patient info)

### Expected LLM response:
The LLM will confirm:
> "I can see the audiometry infographic with the patient's hearing curves. I have all the information I need: the source documents, the AI summary, and the visual representation. Ready to evaluate."

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
## AUDIOLOGY SUMMARY EVALUATION RESULTS

### Audiology Profile Accuracy: 9/10
**Reasoning**: Summary correctly identifies bilateral SNHL of mixed etiology... [explanation]

### Action Plan Accuracy: 8/10
**Reasoning**: Hearing aid prescription appropriate for thresholds... [explanation]

### Infographic Accuracy: 8/10
**Reasoning**: Audiometry curves accurately plotted... [explanation]

### Completeness: 8/10
**Reasoning**: Captures all major findings... [explanation]

### Hallucination Detection: 10/10
**Reasoning**: All values match source documents... [explanation]

### Clinical Utility: 9/10
**Reasoning**: Saves clinician 20 minutes... [explanation]

---
## OVERALL ACCURACY
**Raw Score**: 52/60 × 100 = **86.7%**
**Recommendation**: Excellent summary for clinical use...
```

**Status**: ✅ Evaluation complete

---

## STEP 6: RECORD YOUR SCORES (1 minute)

### What to do:
Copy the LLM's scores and save them for aggregation.

### Create a file or spreadsheet:
```
Patient: Robert Chen
Specialty: Audiology
LLM: GPT-4
Date: Dec 20, 2025

Scores:
- Audiology Profile: 9/10
- Action Plan: 8/10
- Infographic: 8/10
- Completeness: 8/10
- Hallucination Detection: 10/10
- Clinical Utility: 9/10

Average: 86.7%
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
5 evaluations × ~87% average = **87% consensus accuracy**

**Status**: ✅ Multiple LLM evaluations complete

---

## FINAL STEP: CALCULATE FINAL ACCURACY

### Simple calculation:
```
GPT-4: 86.7%
Claude: 88.2%
Gemini: 85.5%
Llama: 87.1%
Mistral: 86.9%

AVERAGE: (86.7 + 88.2 + 85.5 + 87.1 + 86.9) / 5 = 86.9%
```

### What to tell hospitals:
> "We evaluated this audiology summary using 5 independent LLMs (GPT-4, Claude 3 Opus, Gemini Pro, Llama 3, Mistral Large). Consensus accuracy: **86.9%**"

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
→ Make sure audiometry curves are visible and clear  
→ Try with different LLM

### "LLM keeps forgetting the documents"
→ Re-upload all documents  
→ Ask LLM: "Do you remember all 7 audiology documents?"  
→ If no, paste them again as text

### "Scores seem off for my specialty"
→ Audiology typical range: 80-92%  
→ Different LLMs weight factors differently  
→ Averaging 5 LLMs corrects individual biases

### "LLM won't follow the output format"
→ In step 5, be more specific:  
   "Use this exact format: [paste format]"  
→ Or ask: "Please provide scores in exactly this format..."

---

## NEXT: Oncology Evaluation

→ If evaluating an **oncology patient**, use **LLM_SYSTEM_PROMPT_ONCOLOGY.md** instead  
→ Follow the same workflow with **WORKFLOW_ONCOLOGY_STEP_BY_STEP.md**

---

**Ready to evaluate?**  
Start with Step 1 now. Takes ~10 minutes per LLM. 🚀

