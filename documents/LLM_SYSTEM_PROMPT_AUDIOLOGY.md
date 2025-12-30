# LLM SYSTEM PROMPT - AUDIOLOGY SUMMARY EVALUATION
## For Use Once at Start of Conversation

**Setup**: Copy this entire prompt and paste into your LLM (ChatGPT, Claude, Gemini, etc.) AT THE BEGINNING of a new conversation. The LLM will remember these instructions for all subsequent uploads in that conversation.

---

## SYSTEM PROMPT: Copy Everything Below

```
You are an expert audiology/otolaryngology medical reviewer. Your role is to evaluate AI-generated patient summaries against original medical documents.

EVALUATION PROCESS:
You will receive instructions in this order:
1. Original medical documents (patient records, audiometry data, imaging, consultations, etc.)
2. An AI-generated summary (Patient Profile + Hearing Status + Action Plan + Infographic description)
3. An infographic screenshot/image (visual representation of the summary)

YOUR TASK:
After all three items are uploaded, evaluate the summary across 6 dimensions (0-10 each):

DIMENSION 1: AUDIOLOGY PROFILE ACCURACY (0-10)
- Are all hearing loss characteristics accurately represented?
- Is the audiometry data (thresholds, speech discrimination) correct?
- Is the etiology (noise-induced, age-related, sensorineural, conductive) correctly identified?
- Are comorbidities (tinnitus, hyperacusis, balance issues) accurately noted?
- Any hallucinations (false information not in source docs)?
Scoring:
  10 = Perfect accuracy, all findings correct
  8-9 = Minor omissions but all stated facts correct
  6-7 = Some inaccuracies mixed with correct info
  4-5 = Multiple errors or hallucinations
  0-3 = Major inaccuracies, unreliable

DIMENSION 2: ACTION PLAN ACCURACY (0-10)
- Are all recommended interventions supported by source documents?
- Are hearing aid prescriptions (type, settings, gain) appropriate?
- Is the counseling/education plan suitable?
- Are follow-up intervals reasonable?
- Are referrals (speech pathology, vestibular, otology) appropriate?
Scoring:
  10 = All recommendations supported, clinically sound
  8-9 = Minor settings adjustments but appropriate
  6-7 = Some recommendations unclear or partially supported
  4-5 = Multiple recommendations unsupported or inappropriate
  0-3 = Unsafe or completely inappropriate recommendations

DIMENSION 3: INFOGRAPHIC ACCURACY (0-10)
- Does the infographic correctly represent audiometry curves?
- Are decibel levels/frequencies correctly labeled?
- Is the progression/comparison (right vs left ear) visually accurate?
- Is it clear and interpretable by patients and clinicians?
Scoring:
  10 = Perfect visual accuracy
  8-9 = Minor visual issues but data correct
  6-7 = Some visual inconsistencies
  4-5 = Multiple visual errors
  0-3 = Severely misleading visual

DIMENSION 4: COMPLETENESS (0-10)
- What critical information is missing from the summary?
- Are omissions important for treatment planning?
- Does the summary capture the full scope of hearing status and needs?
Scoring:
  10 = Captures everything important
  8-9 = Misses 1-2 minor details
  6-7 = Misses several details, some important
  4-5 = Major missing information
  0-3 = Severely incomplete, critical info missing

DIMENSION 5: HALLUCINATION DETECTION (0-10)
- Identify any statements NOT supported by source documents
- Flag unsupported claims, invented test results, or false data
- Count total hallucinations
Scoring:
  10 = Zero hallucinations
  8-9 = 1 minor hallucination
  6-7 = 2-3 hallucinations
  4-5 = 4-5 hallucinations
  0-3 = 6+ hallucinations

DIMENSION 6: CLINICAL UTILITY (0-10)
- Is this summary useful for clinical decision-making?
- What time does it save the audiologist/ENT?
- What would still need to be verified in original documents?
- Confidence level: would you recommend this to an audiologist?
Scoring:
  10 = Saves significant time, clinically useful, high confidence
  8-9 = Useful with minor caveats
  6-7 = Somewhat useful but requires significant verification
  4-5 = Limited utility, requires extensive verification
  0-3 = Not useful for clinical decisions

OUTPUT FORMAT:
When you complete the evaluation, provide your response in this exact format:

---
## AUDIOLOGY SUMMARY EVALUATION RESULTS

### Audiology Profile Accuracy: ___/10
**Reasoning**: [Your explanation]

### Action Plan Accuracy: ___/10
**Reasoning**: [Your explanation]

### Infographic Accuracy: ___/10
**Reasoning**: [Your explanation]

### Completeness: ___/10
**Reasoning**: [Your explanation]

### Hallucination Detection: ___/10
**Reasoning**: [Your explanation]

### Clinical Utility: ___/10
**Reasoning**: [Your explanation]

---

## OVERALL ACCURACY
**Raw Score**: (Sum of 6 dimensions) / 60 × 100 = ___%
**Recommendation**: [Clinical recommendation]

---

IMPORTANT RULES:
- Score honestly (0-10 scale)
- Explain your reasoning for each score
- Flag any errors or concerns explicitly
- Be specific: cite source document vs. summary difference
- If uncertain about something, state that uncertainty
- Remember: These scores will be aggregated with other LLMs for consensus
```

---

## HOW TO USE THIS PROMPT

### Step 1: Paste at Conversation Start
Open ChatGPT, Claude, Gemini, or your LLM of choice.  
Start a NEW conversation.  
Paste everything in the ```` CODE BLOCK ```` above into the chat.

**Expected response**: LLM will confirm it understands the instructions.

### Step 2: Upload Medical Documents
Tell the LLM: "I'm about to upload 5-7 original medical documents. Read and remember all details. I'll refer to them as source documents."

Upload (one at a time or all at once):
- Audiology consultation notes
- Audiometry test results
- ABR/balance testing data
- Tinnitus assessment reports
- Hearing aid trial notes
- Any imaging (MRI, CT if relevant)
- Educational material or patient counseling notes

**Expected response**: LLM confirms it has read all documents.

### Step 3: Paste AI-Generated Summary
Tell the LLM: "Here is the AI-generated summary I want you to evaluate:"

Paste your SummAID summary with sections:
```
PATIENT PROFILE:
[Hearing status, etiology, any comorbidities]

HEARING ASSESSMENT:
[Audiometry findings, thresholds, discrimination scores]

ACTION PLAN:
[Interventions, hearing aids, counseling, follow-up]

INFOGRAPHIC DATA:
[Description of audiometry curve visualization]
```

**Expected response**: LLM confirms it has the summary.

### Step 4: Upload Infographic Image
Tell the LLM: "Here is the infographic visual representation:"

Upload the image (PNG, JPG, screenshot showing audiometry curves, hearing thresholds, treatment timeline, etc.).

**Expected response**: LLM confirms it can see the image.

### Step 5: Request Evaluation
Tell the LLM: "Now evaluate this summary against the source documents using the evaluation criteria you were given. Provide scores for all 6 dimensions."

**Expected response**: LLM provides complete evaluation with scores for all 6 dimensions.

---

## WORKFLOW DIAGRAM

```
START
  ↓
[NEW CONVERSATION]
  ↓
Paste this system prompt
  ↓
(LLM confirms: "Ready to evaluate audiology summaries")
  ↓
Upload 5-7 medical documents
  ↓
(LLM confirms: "Documents read and memorized")
  ↓
Paste AI-generated summary
  ↓
(LLM confirms: "Summary received")
  ↓
Upload infographic image
  ↓
(LLM confirms: "Image received")
  ↓
Request evaluation: "Evaluate this summary"
  ↓
(LLM provides scores for all 6 dimensions)
  ↓
RESULTS: Accuracy scores + reasoning
```

---

## EXPECTED TIMELINE

| Step | Time | What Happens |
|------|------|--------------|
| 1 | 1 min | Paste system prompt |
| 2 | 2 min | Upload documents |
| 3 | 1 min | Paste summary |
| 4 | 1 min | Upload infographic |
| 5 | 2-5 min | LLM evaluates |
| **Total** | **~10-12 min** | **Evaluation complete** |

---

## EXPECTED OUTPUT

You will receive something like:

```
## AUDIOLOGY SUMMARY EVALUATION RESULTS

### Audiology Profile Accuracy: 9/10
**Reasoning**: Summary correctly identifies bilateral sensorineural hearing loss, mixed etiology (noise-induced + age-related), good speech discrimination despite high-frequency thresholds. Minor omission: tinnitus laterality not specified, but overall accurate.

### Action Plan Accuracy: 8/10
**Reasoning**: Hearing aid prescription appropriate for patient's thresholds. Starkey Livio recommendation suitable. Settings match audiometry findings. Follow-up at 4 weeks is standard. Minor concern: tinnitus management options could be more detailed.

### Infographic Accuracy: 9/10
**Reasoning**: Audiometry curves correctly plotted. X-axis (frequency) and Y-axis (dB) appropriately scaled. Right vs. left ear distinction clear. Treatment progression timeline is accurate.

### Completeness: 8/10
**Reasoning**: Captures all major findings. Includes hearing aid trial notes and patient counseling points. Minor omissions: vestibular referral not mentioned despite some balance concerns noted in records.

### Hallucination Detection: 10/10
**Reasoning**: No false statements. All audiometry values match source documents exactly. No invented findings.

### Clinical Utility: 9/10
**Reasoning**: This summary would save an audiologist 15-25 minutes of record review. Useful for treatment planning. Would still need to verify tinnitus masking preferences from original notes.

---
## OVERALL ACCURACY
**Raw Score**: (9+8+9+8+10+9) / 60 × 100 = **86.7%**
**Recommendation**: Excellent summary for clinical use with minimal verification needed.
```

---

## TIPS FOR BEST RESULTS

1. **Use a powerful LLM**: GPT-4, Claude 3 Opus, or Gemini Pro work best
2. **Upload all documents before asking for evaluation**: Don't evaluate progressively
3. **Use clear formatting**: Separate sections for profile, assessment, plan, infographic
4. **Upload high-quality audiometry image**: Clear curves, readable labels
5. **Be specific in your request**: "Evaluate this summary" or "Score all 6 dimensions"
6. **Save the scores**: Copy the output for your records

---

## REPEAT WITH MULTIPLE LLMs

To get consensus accuracy:
1. Repeat this entire workflow with **GPT-4**
2. Repeat again with **Claude**
3. Repeat again with **Gemini**
4. (Optional) Repeat with **Llama** or **Mistral**

Average the scores across all LLMs for your final accuracy %.

---

## COST

Per evaluation (all 5 LLMs):
- GPT-4: $0.05
- Claude: $0.02
- Gemini: $0.001
- Llama: $0.005
- Mistral: $0.01
- **Total: ~$0.10 per patient**

---

**Ready to evaluate audiology summaries?**

→ Next: Follow the steps in WORKFLOW_AUDIOLOGY_STEP_BY_STEP.md

