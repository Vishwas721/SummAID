# SummAID Schema System - Quick Start

## 📋 What You Got

Three new files in `backend/`:

1. **`schemas.py`** - Pydantic models defining strict JSON structure for AI responses
2. **`SCHEMAS_INTEGRATION_GUIDE.md`** - Comprehensive integration instructions
3. **`test_schemas.py`** - Validation tests (all passing ✓)
4. **`ai_response_template.json`** - Copy-paste JSON template
5. **`ai_response_schema.json`** - Full JSON schema for API docs

## 🚀 Quick Usage

### For AI Prompt Engineering (Immediate Use)

Copy the template into your AI system prompt:

```python
system_prompt = f"""You are a medical AI assistant.

CRITICAL: Return ONLY valid JSON matching this structure:

{
  "universal": {
    "evolution": "Medical journey summary",
    "current_status": ["Status 1", "Status 2"],
    "plan": ["Action 1", "Action 2"]
  },
  "oncology": {
    "tumor_size_trend": [{"date": "2024-01-15", "size_cm": 1.2}],
    "tnm_staging": "T2N0M0"
  },
  "speech": null
}

Rules:
- Set oncology to null if NOT oncology patient
- Set speech to null if NOT speech patient  
- Always populate universal section
- Use null for unknown values
- NO markdown formatting, ONLY JSON
"""
```

### For Backend Validation (Recommended)

Add to your endpoint:

```python
from schemas import AIResponseSchema
import json

# After getting AI response
try:
    ai_json = json.loads(ai_response_text)
    validated = AIResponseSchema.model_validate(ai_json)
    clean_json = validated.model_dump(exclude_none=True)
    return clean_json
except Exception as e:
    logger.error(f"Validation failed: {e}")
    # Handle error
```

### For Frontend Consumption

Safe nested access:

```javascript
// Universal data (always present)
const evolution = data.universal.evolution;
const status = data.universal.current_status;  // Array
const plan = data.universal.plan;  // Array

// Specialty data (check first)
if (data.oncology) {
    const tumorTrend = data.oncology.tumor_size_trend;
    const staging = data.oncology.tnm_staging;
    // Render oncology UI
}

if (data.speech) {
    const audiogram = data.speech.audiogram;
    const scores = data.speech.speech_scores;
    // Render speech/audiology UI
}
```

## 📊 Schema Structure

```
AIResponseSchema
├── universal (REQUIRED)
│   ├── evolution: string
│   ├── current_status: string[]
│   └── plan: string[]
├── oncology (OPTIONAL)
│   ├── tumor_size_trend: [{date, size_cm}]
│   ├── tnm_staging: string
│   ├── cancer_type: string
│   ├── grade: string
│   ├── biomarkers: object
│   └── treatment_response: string
├── speech (OPTIONAL)
│   ├── audiogram: {left, right, test_date}
│   ├── speech_scores: {srt_db, wrs_percent, ...}
│   ├── hearing_loss_type: string
│   ├── hearing_loss_severity: string
│   ├── tinnitus: boolean
│   ├── balance_issues: boolean
│   └── amplification: string
├── cardiology (OPTIONAL - expandable)
│   ├── ejection_fraction: number
│   ├── nyha_class: string
│   ├── blood_pressure_trend: array
│   └── medications: string[]
└── metadata
    ├── generated_at: string (ISO timestamp)
    ├── patient_id: number
    └── specialty: string
```

## ✅ Testing

Run tests to verify everything works:

```bash
cd C:\SummAID\backend
python test_schemas.py
```

Expected output: `🎉 All tests passed! Schemas are ready to use.`

## 🔧 Adding New Specialties

1. Add schema class in `schemas.py`:

```python
class NeurologyData(BaseModel):
    glasgow_coma_scale: Optional[int] = Field(None, ge=3, le=15)
    seizure_frequency: Optional[str] = None
    mri_findings: Optional[List[str]] = None
```

2. Add to `AIResponseSchema`:

```python
class AIResponseSchema(BaseModel):
    universal: UniversalData
    oncology: Optional[OncologyData] = None
    speech: Optional[SpeechData] = None
    neurology: Optional[NeurologyData] = None  # NEW
```

3. Update AI prompt to include neurology structure

4. Frontend checks `if (data.neurology) { ... }`

## 📖 Full Documentation

- **Integration Guide**: `SCHEMAS_INTEGRATION_GUIDE.md` (detailed)
- **JSON Template**: `ai_response_template.json` (copy-paste)
- **API Schema**: `ai_response_schema.json` (for OpenAPI docs)
- **Test Suite**: `test_schemas.py` (6 test cases)

## 🎯 Benefits

✓ **Type Safety** - Frontend knows exact data structure  
✓ **Validation** - Catch malformed AI responses early  
✓ **Extensibility** - Easy to add new specialties  
✓ **Documentation** - Schema serves as API contract  
✓ **Error Handling** - Pydantic provides detailed errors  

## 🚦 Rollout Path

**Phase 1 (Now)**: Use as JSON template in AI prompts  
**Phase 2 (Week 2)**: Add validation to `/summarize`  
**Phase 3 (Week 3)**: Add validation to `/chat`  
**Phase 4 (Week 4)**: Update frontend to consume structured data  
**Phase 5 (Ongoing)**: Add new specialties as needed  

## 💡 Tips

- Always set unused specialty sections to `null`
- Use `exclude_none=True` when dumping to JSON
- Check validation errors for debugging: `str(e)`
- Export schema for docs: `AIResponseSchema.model_json_schema()`

## 🆘 Troubleshooting

**Q: AI returns free text instead of JSON?**  
A: Update system prompt, add JSON examples, emphasize "ONLY JSON"

**Q: Validation fails with "field required"?**  
A: Make field optional: `Optional[str] = None`

**Q: Frontend breaks after changes?**  
A: Use `exclude_none=True` for backward compatibility

**Q: How to handle legacy data?**  
A: Wrap old summaries in minimal structure:
```python
{
    "universal": {
        "evolution": old_summary_text,
        "current_status": [],
        "plan": []
    }
}
```

## 📞 Next Steps

1. ✅ Review `schemas.py` structure
2. ✅ Run `python test_schemas.py` (verify all pass)
3. ⏭️ Read `SCHEMAS_INTEGRATION_GUIDE.md` (detailed instructions)
4. ⏭️ Update AI system prompt to request JSON output
5. ⏭️ Add validation to one endpoint as proof-of-concept
6. ⏭️ Update frontend components to consume structured data

---

**Created**: December 1, 2025  
**Status**: ✅ All tests passing  
**Ready for**: Immediate use (prompt engineering) or full integration
