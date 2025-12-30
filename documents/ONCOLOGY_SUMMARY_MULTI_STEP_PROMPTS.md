# Oncology Summary – Multi-Step Prompt Pack (Generalizable + Temporal-Safe)

Goal: Generate a clinically safe oncology summary that never carries forward outdated plans. Designed for Llama‑3‑8B and other lightweight models using short, focused prompts.

How to use: Run each step as a separate prompt (new message). Keep responses structured. Do not paste everything at once.

---

## STEP 0 — System Setup (Paste once at conversation start)

You are an oncology clinical summarizer. You must:
- Extract facts only from provided documents (no guessing).
- Normalize all dates and sort by recency.
- Derive the current patient state based on the latest dated evidence.
- Generate a forward-only action plan (no past or completed items).
- Apply strict temporal filters: never present past plans as current.
- Run safety checks for contradictions, hallucinations, and outdated actions.
- Produce a final summary with narrative, action plan, and infographic data.

Confirm readiness, then wait for documents.

---

## STEP 1 — Structured Fact Extraction (Short prompt)

Instructions:
- Extract key facts into JSON. Only include info explicitly present in the documents.
- Include document date (`YYYY-MM-DD`) for every fact.

Output format:
```
{
  "patient": {"name": "", "age": 0, "sex": "F|M"},
  "diagnosis": [{"date": "", "condition": "", "primary_site": "", "histology": "", "stage": "", "TNM": ""}],
  "biomarkers": [{"date": "", "marker": "ER|PR|HER2|Ki67|Oncotype", "value": ""}],
  "imaging": [{"date": "", "modality": "CT|MRI|Mammography", "finding": "", "tumor_size_cm": 0.0}],
  "pathology": [{"date": "", "finding": "", "receptor_status": ""}],
  "treatments_completed": [{"date": "", "type": "surgery|chemo|radiation|endocrine", "details": ""}],
  "treatments_planned": [{"date": "", "type": "", "details": ""}],
  "current_medications": [{"date": "", "drug": "", "dose": ""}],
  "follow_up": [{"date": "", "plan": ""}]
}
```

---

## STEP 2 — Timeline Normalization (Short prompt)

Instructions:
- Using STEP 1 JSON, list all events with normalized dates and labels: `Completed`, `Current`, `Planned`.
- Sort descending by date; include doc source.
- Do not interpret beyond the facts.

Output format:
```
[
  {"date": "YYYY-MM-DD", "label": "Completed|Current|Planned", "type": "diagnosis|imaging|treatment|followup", "summary": "...", "source": "Doc X"}
]
```

---

## STEP 3 — Current State Derivation (Short prompt)

Instructions:
- Derive the patient’s current clinical state strictly from the latest dated evidence.
- If earlier plans contradict the latest evidence, mark them as outdated.

Output format:
```
{
  "as_of_date": "YYYY-MM-DD (latest evidence)",
  "disease_status": "active|stable|partial_response|near_complete_remission|complete_remission",
  "current_therapy": ["endocrine|surveillance|..."],
  "key_metrics": {"tumor_size_cm": 0.0, "stage": "", "ER_PR_HER2": ""},
  "notes": ["Any important caveats observed"]
}
```

---

## STEP 4 — Forward-Only Action Plan (Short prompt)

Instructions:
- Create an action plan that is ONLY forward-looking relative to `as_of_date`.
- Exclude any item already completed or dated in the past.
- If the record shows a next follow-up, include it.
- If uncertain, output `VERIFY_FROM_SOURCE` and omit.

Output format:
```
{
  "forward_plan": [
    {"action": "followup_imaging", "when": "in 3 months", "rationale": "based on last report"},
    {"action": "continue_endocrine", "drug": "tamoxifen 20mg daily", "duration": "per protocol"}
  ],
  "excluded_outdated": ["lumpectomy (done 2024-01-15)", "chemo cycle 2/6 (completed 2024-06-10)"]
}
```

---

## STEP 5 — Safety & Consistency Checks (Short prompt)

Instructions:
- Run these checks and produce a result:
  1) Temporal filter: confirm no past/planned items remain in forward plan.
  2) Narrative vs Plan consistency: ensure status and plan align.
  3) Hallucination scan: flag any item without source support.
  4) Contraindications/allergies: flag if any risk.
- If critical failure, set `do_not_use: true` and list reasons.

Output format:
```
{
  "temporal_ok": true|false,
  "consistency_ok": true|false,
  "hallucinations": ["..."],
  "contraindications": ["..."],
  "do_not_use": true|false,
  "reasons": ["..."]
}
```

---

## STEP 6 — Infographic Data Compose (Short prompt)

Instructions:
- Compose infographic input values from latest evidence only.
- Avoid labels that contradict evidence (e.g., do not say "Stable" if clear regression).

Output format:
```
{
  "timeline": ["Diagnosis → Chemo (completed) → Surgery (completed) → Radiation (completed) → Endocrine (current) → Follow-up (future)"],
  "tumor_trend_cm": [{"date":"YYYY-MM-DD","size":3.2},{"date":"YYYY-MM-DD","size":0.9}],
  "status_label": "near complete remission",
  "markers": {"ER": "+", "PR": "+", "HER2": "-"}
}
```

---

## STEP 7 — Final Summary (Short prompt)

Instructions:
- Produce the final patient summary using outputs of Steps 3–6.
- Sections: Medical Journey, Action Plan (forward-only), Infographic Data.
- If `do_not_use: true`, prepend WARNING block and list reasons.

Output format:
```
MEDICAL JOURNEY:
[Concise narrative reflecting latest evidence only]

ACTION PLAN (FORWARD-ONLY):
- [Only future/current items]
- [No completed past items]
- [If uncertain: omit or label VERIFY_FROM_SOURCE]

INFOGRAPHIC DATA:
- status_label: ...
- tumor_trend_cm: ...
- timeline: ...
- markers: ...
```

---

## STEP 8 — Self-Audit (Short prompt)

Instructions:
- Cross-check the Final Summary against Steps 1–6.
- If any contradiction/temporal leakage is found, fix and re-output Final Summary.

Output format:
```
{
  "final_ok": true|false,
  "fixes": ["Removed outdated chemo plan", "Updated status label to near complete remission"],
  "final_summary": "<reprinted summary>"
}
```

---

## Notes for Generalization (All Oncology Patients)
- Always derive the current state from the **latest dated evidence**.
- Treat earlier "plans" as **historical** unless reaffirmed by a newer document.
- Prefer omission over speculation. Use `VERIFY_FROM_SOURCE` rather than guessing.
- Keep each step’s prompt short and explicit for 8B models.
- Maintain consistent JSON structures to chain steps reliably.

---

## Quick Run (Command-style)
1) Paste STEP 0 and confirm.
2) Paste documents; run STEP 1.
3) Run STEP 2 → STEP 3 → STEP 4 → STEP 5 → STEP 6 → STEP 7 → STEP 8.
4) Use the `final_summary` as the output.

This pack prioritizes temporal safety and generalization across oncology cases.
