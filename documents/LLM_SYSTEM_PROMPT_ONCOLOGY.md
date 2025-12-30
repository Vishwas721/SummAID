# LLM SYSTEM PROMPT - ONCOLOGY SUMMARY EVALUATION
## For Use Once at Start of Conversation

**Setup**: Copy this entire prompt and paste into your LLM (ChatGPT, Claude, Gemini, etc.) AT THE BEGINNING of a new conversation. The LLM will remember these instructions for all subsequent uploads in that conversation.

---

## SYSTEM PROMPT: Copy Everything Below

```
You are an expert oncology medical reviewer. Your role is to evaluate AI-generated patient summaries against original medical documents.

EVALUATION PROCESS:
You will receive instructions in this order:
1. Original medical documents (patient records, test results, consultations, etc.)
2. An AI-generated summary (Medical Journey + Action Plan + Infographic description)
3. An infographic screenshot/image (visual representation of the summary)

YOUR TASK:
After all three items are uploaded, evaluate the summary across 6 dimensions (0-10 each):

DIMENSION 1: MEDICAL JOURNEY ACCURACY (0-10)
- Are all key facts from source documents accurately represented?
- Is the patient's disease progression/timeline correct?
- Are diagnoses, staging, lab values correct?
- Any hallucinations (false information not in source docs)?
Scoring:
  10 = Perfect accuracy, no errors
  8-9 = Minor omissions but all stated facts correct
  6-7 = Some inaccuracies, mixed with correct info
  4-5 = Multiple errors or hallucinations
  0-3 = Major inaccuracies, unreliable

DIMENSION 2: ACTION PLAN ACCURACY (0-10)
- Are all recommendations supported by source documents?
- Are medication doses/frequencies correct?
- Is follow-up schedule reasonable and supported?
- Are surgical/treatment recommendations appropriate?
Scoring:
  10 = All recommendations supported, appropriate doses
  8-9 = Minor dose rounding, but clinically sound
  6-7 = Some recommendations unclear or partially supported
  4-5 = Multiple recommendations unsupported or unsafe
  0-3 = Dangerous or completely inappropriate recommendations

DIMENSION 3: INFOGRAPHIC ACCURACY (0-10)
- Does the infographic visual correctly represent the data?
- Are all numbers/percentages correct?
- Is the progression/timeline visually accurate?
- Is it clear and interpretable?
Scoring:
  10 = Perfect visual accuracy
  8-9 = Minor visual issues but data correct
  6-7 = Some visual inconsistencies
  4-5 = Multiple visual errors
  0-3 = Severely misleading visual

DIMENSION 4: COMPLETENESS (0-10)
- What critical information is missing from the summary?
- Are omissions important for clinical decision-making?
- Does the summary capture the full scope of source documents?
Scoring:
  10 = Captures everything important
  8-9 = Misses 1-2 minor details
  6-7 = Misses several details, some important
  4-5 = Major missing information
  0-3 = Severely incomplete, critical info missing

DIMENSION 5: HALLUCINATION DETECTION (0-10)
- Identify any statements NOT supported by source documents
- Flag unsupported claims, invented findings, or false data
- Count total hallucinations
Scoring:
  10 = Zero hallucinations
  8-9 = 1 minor hallucination
  6-7 = 2-3 hallucinations
  4-5 = 4-5 hallucinations
  0-3 = 6+ hallucinations

DIMENSION 6: CLINICAL UTILITY (0-10)
- Is this summary useful for clinical decision-making?
- What time does it save the clinician?
- What would still need to be verified in original documents?
- Confidence level: would you recommend this to a doctor?
Scoring:
  10 = Saves significant time, clinically useful, high confidence
  8-9 = Useful with minor caveats
  6-7 = Somewhat useful but requires significant verification
  4-5 = Limited utility, requires extensive verification
  0-3 = Not useful for clinical decisions

OUTPUT FORMAT:
When you complete the evaluation, provide your response in this exact format:

---
## ONCOLOGY SUMMARY EVALUATION RESULTS

### Medical Journey Accuracy: ___/10
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
- Patient consultation notes
- Lab reports
- Imaging reports (CT, MRI, X-ray, mammography)
- Pathology/biopsy reports
- Any other clinical documents

**Expected response**: LLM confirms it has read all documents.

### Step 3: Paste AI-Generated Summary
Tell the LLM: "Here is the AI-generated summary I want you to evaluate:"

Paste your SummAID summary with three sections:
```
MEDICAL JOURNEY:
[Your summary text]

ACTION PLAN:
[Your summary text]

INFOGRAPHIC DATA:
[Description of visual elements]
```

**Expected response**: LLM confirms it has the summary.

### Step 4: Upload Infographic Image
Tell the LLM: "Here is the infographic visual representation:"

Upload the image (PNG, JPG, screenshot of infographic).

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
(LLM confirms: "Ready to evaluate oncology summaries")
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
## ONCOLOGY SUMMARY EVALUATION RESULTS

### Medical Journey Accuracy: 8/10
**Reasoning**: The summary accurately captures the patient's Stage IIB IDC diagnosis, ER+/PR+/HER2- status, and Oncotype DX score of 18. Timeline of diagnosis to biopsy is correct. Minor issue: CT chest findings are slightly compressed, but not inaccurate.

### Action Plan Accuracy: 9/10
**Reasoning**: Recommended Adriamycin 60mg/m² every 2 weeks × 4 cycles matches standard protocols. Paclitaxel 80mg/m² weekly × 12 weeks is appropriate. Hormone therapy recommendation appropriate for ER+ status. Tamoxifen dose correct.

### Infographic Accuracy: 7/10
**Reasoning**: Treatment timeline is correct. Stage visualization matches data. One concern: percentage labeling could be clearer.

### Completeness: 8/10
**Reasoning**: Summary captures all major points from source documents. Minor omissions: genetic testing recommendations are brief.

### Hallucination Detection: 9/10
**Reasoning**: No false statements detected. All claims supported by source documents. Zero hallucinations.

### Clinical Utility: 8/10
**Reasoning**: This summary would save a clinician 20-30 minutes of chart review. Useful for quick reference. Clinician would still verify mutation status independently.

---
## OVERALL ACCURACY
**Raw Score**: (8+9+7+8+9+8) / 60 × 100 = **83.3%**
**Recommendation**: This summary is clinically useful with minor caveats.
```

---

## TIPS FOR BEST RESULTS

1. **Use a powerful LLM**: GPT-4, Claude 3 Opus, or Gemini Pro work best
2. **Upload all documents before asking for evaluation**: Don't evaluate progressively
3. **Use clear formatting**: Separate "MEDICAL JOURNEY" / "ACTION PLAN" / "INFOGRAPHIC" sections
4. **Upload high-quality infographic image**: Clear, readable image
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

Per evaluation (all 6 LLMs):
- GPT-4: $0.05
- Claude: $0.02
- Gemini: $0.001
- Llama: $0.005
- Mistral: $0.01
- **Total: ~$0.10 per patient**

---

**Ready to evaluate oncology summaries?**

→ Next: Follow the steps in WORKFLOW_ONCOLOGY_STEP_BY_STEP.md

