# Llama‑3‑8B Parallel Prompting Runbook (Oncology)

Purpose: Achieve safer, higher-quality summaries on smaller models by splitting tasks into short, parallel prompts and then aggregating.

---

## Overview
- Run multiple short prompts in parallel (or sequentially if needed).
- Each prompt returns structured JSON.
- Final aggregator merges results, applies temporal filters, and emits the summary.

---

## Prompts to Run (Parallel Batch A)

1) `extract_facts` (same as STEP 1 in oncology pack)
```
Task: Extract only explicit facts from documents into JSON with dates.
Output: facts.json
```

2) `build_timeline` (same as STEP 2)
```
Task: Normalize dates and label events (Completed|Current|Planned). Sort by recency.
Input: facts.json
Output: timeline.json
```

3) `derive_state` (same as STEP 3)
```
Task: Determine current state from latest evidence.
Input: timeline.json
Output: state.json
```

4) `forward_plan` (same as STEP 4)
```
Task: Create forward-only plan; exclude outdated items.
Input: state.json + timeline.json
Output: plan.json
```

5) `safety_checks` (same as STEP 5)
```
Task: Run temporal, consistency, hallucination, contraindication checks.
Input: facts.json + timeline.json + plan.json
Output: safety.json
```

6) `infographic_data` (same as STEP 6)
```
Task: Compose infographic data from latest evidence only.
Input: state.json
Output: infographic.json
```

---

## Aggregator Prompt (Batch B)

```
Inputs: facts.json, timeline.json, state.json, plan.json, safety.json, infographic.json

Requirements:
- Apply strict temporal filter: any plan item dated earlier than `state.as_of_date` must be excluded or marked historical.
- Ensure `state.disease_status` aligns with narrative and infographic labels.
- If `safety.do_not_use` is true, prepend WARNING block with reasons and output minimal safe summary.
- Otherwise, output Final Summary sections:
  - MEDICAL JOURNEY (latest evidence only)
  - ACTION PLAN (forward-only)
  - INFOGRAPHIC DATA (numbers + labels consistent with state)

Output: final_summary.txt
```

---

## Consistency Checker (Batch C)

```
Input: final_summary.txt + all JSONs
Task: Verify no temporal leakage, contradictions, or unsupported claims.
If issues found: list fixes and re-output corrected summary.
Output: final_summary_v2.txt
```

---

## Tips for Llama‑3‑8B
- Keep prompts under ~250 tokens; use explicit JSON schemas.
- Avoid long context; reference only prior JSON outputs.
- Prefer short lists over verbose prose until final aggregation.
- Use strict phrases: "Exclude", "Forward-only", "Latest evidence", "No guessing".
- If the model hesitates, rerun the specific sub-prompt with clearer examples.

---

## Quick Execution Plan
1) Run Batch A (6 prompts) → collect JSONs.
2) Run Aggregator (Batch B) → get `final_summary.txt`.
3) Run Consistency Checker (Batch C) → get `final_summary_v2.txt`.
4) Use `final_summary_v2.txt` as the output.

This pattern increases robustness on 8B models and minimizes temporal errors.
