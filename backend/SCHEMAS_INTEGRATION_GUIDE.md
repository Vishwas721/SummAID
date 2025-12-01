"""
SCHEMAS INTEGRATION GUIDE
=========================

This guide shows how to integrate the new schemas.py models into SummAID backend
to enforce structured AI responses.

PHASE 1: IMMEDIATE USAGE (No Code Changes Required)
====================================================

The schemas.py file can be used RIGHT NOW as:

1. **JSON Template Reference**: Copy example JSON from AIResponseSchema.Config.json_schema_extra
2. **AI Prompt Engineering**: Include schema structure in system prompts
3. **Validation Layer**: Post-process AI responses before sending to frontend


PHASE 2: BACKEND INTEGRATION (Recommended)
============================================

Step 1: Import schemas in main.py
----------------------------------
Add to imports section (around line 12):

    from schemas import (
        AIResponseSchema,
        ChatResponseSchema,
        UniversalData,
        OncologyData,
        SpeechData
    )


Step 2: Update system prompts to request structured output
-----------------------------------------------------------

Current: Free-text AI responses
Target: JSON-structured responses following AIResponseSchema

Example modification for /summarize endpoint (_generate_summary function):

    CURRENT SYSTEM PROMPT (line ~390):
        system_prompt = f'''You are a medical AI assistant...
        Please generate a comprehensive clinical summary...'''
    
    NEW STRUCTURED PROMPT:
        system_prompt = f'''You are a medical AI assistant...
        
        CRITICAL: You MUST return a valid JSON object following this exact structure:
        
        {{
          "universal": {{
            "evolution": "Brief medical journey summary",
            "current_status": ["Status point 1", "Status point 2"],
            "plan": ["Next step 1", "Next step 2"]
          }},
          "oncology": {{
            "tumor_size_trend": [{{"date": "YYYY-MM-DD", "size_cm": 1.2}}],
            "tnm_staging": "T2N0M0",
            "cancer_type": "Cancer type",
            "treatment_response": "Response status"
          }},
          "speech": null,
          "specialty": "oncology"
        }}
        
        Rules:
        - If patient is NOT oncology, set "oncology": null
        - If patient is NOT speech/audiology, set "speech": null
        - Always populate "universal" section
        - Use null for missing/unknown values
        - Return ONLY valid JSON, no markdown formatting
        '''


Step 3: Validate and parse AI responses
----------------------------------------

In /summarize endpoint (around line 790), after getting AI response:

    # Current: summary_text is raw string
    summary_text = _generate_summary(...)
    
    # New: Parse and validate against schema
    try:
        # Parse AI JSON response
        ai_json = json.loads(summary_text)
        
        # Validate against schema (raises ValidationError if invalid)
        validated = AIResponseSchema.model_validate(ai_json)
        
        # Convert back to clean JSON (removes None values, ensures consistency)
        clean_json = validated.model_dump(exclude_none=True)
        
        # Store as JSON string for database
        summary_text = json.dumps(clean_json)
        
        logger.info(f"✓ Validated AI response for patient {patient_id}")
        
    except json.JSONDecodeError as e:
        logger.error(f"AI returned invalid JSON: {e}")
        # Fallback: wrap free-text in minimal structure
        summary_text = json.dumps({
            "universal": {
                "evolution": summary_text,
                "current_status": [],
                "plan": []
            }
        })
    except Exception as e:
        logger.error(f"Schema validation failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI response validation failed: {str(e)}")


Step 4: Update /chat endpoint similarly
----------------------------------------

In /chat endpoint (around line 900), wrap chat response:

    # After getting AI response
    chat_response_text = ...  # from Ollama
    
    # Validate chat response
    try:
        validated_chat = ChatResponseSchema(
            response=chat_response_text,
            citations=citations,  # Already extracted
            confidence=None  # Optional: add confidence scoring
        )
        return validated_chat.model_dump(exclude_none=True)
    except Exception as e:
        logger.error(f"Chat validation error: {e}")
        # Fallback
        return {"response": chat_response_text, "citations": citations}


PHASE 3: FRONTEND CONSUMPTION
==============================

With structured responses, frontend can safely access nested data:

JavaScript/React Example:
--------------------------

    // Fetch patient summary
    const response = await fetch(`/api/summarize/${patientId}`);
    const data = await response.json();
    
    // Safely access universal data (always present)
    const evolution = data.universal.evolution;
    const currentStatus = data.universal.current_status;  // Array
    const plan = data.universal.plan;  // Array
    
    // Check if oncology patient
    if (data.oncology) {
        const tumorTrend = data.oncology.tumor_size_trend;
        const staging = data.oncology.tnm_staging;
        
        // Render tumor size chart
        <TumorSizeChart data={tumorTrend} />
    }
    
    // Check if speech patient
    if (data.speech) {
        const audiogram = data.speech.audiogram;
        const scores = data.speech.speech_scores;
        
        // Render audiogram visualization
        <AudiogramChart left={audiogram.left} right={audiogram.right} />
    }


PHASE 4: EXTENDING SCHEMAS (Adding New Specialties)
====================================================

To add a new specialty (e.g., Neurology):

1. Add new schema class in schemas.py:

    class NeurologyData(BaseModel):
        glasgow_coma_scale: Optional[int] = Field(None, ge=3, le=15)
        seizure_frequency: Optional[str] = None
        mri_findings: Optional[List[str]] = None
        medications: Optional[List[str]] = None

2. Add to AIResponseSchema:

    class AIResponseSchema(BaseModel):
        universal: UniversalData
        oncology: Optional[OncologyData] = None
        speech: Optional[SpeechData] = None
        neurology: Optional[NeurologyData] = None  # NEW

3. Update system prompt to include neurology structure

4. Frontend can now check `if (data.neurology) { ... }`


TESTING THE SCHEMAS
===================

Run validation tests:

    cd C:\\SummAID\\backend
    python -c "from schemas import AIResponseSchema; print(AIResponseSchema.model_json_schema())"

This prints the full JSON schema for reference or API documentation.


BENEFITS
========

✓ Type Safety: Frontend knows exact structure
✓ Validation: Catch malformed AI responses early
✓ Documentation: Schema serves as API contract
✓ Extensibility: Easy to add new specialties
✓ Error Handling: Pydantic provides detailed validation errors
✓ API Docs: FastAPI auto-generates OpenAPI docs from schemas


ROLLOUT STRATEGY
================

Week 1: Use schemas as reference, update AI prompts
Week 2: Add validation layer to /summarize endpoint
Week 3: Add validation to /chat endpoint
Week 4: Update frontend to consume structured data
Week 5: Add new specialty schemas as needed


TROUBLESHOOTING
===============

Q: AI returns free text instead of JSON?
A: Update system prompt to explicitly request JSON format. Add examples.

Q: Validation fails with "field required" error?
A: Check if AI is populating all required fields. Make optional with Optional[].

Q: Frontend breaks after schema changes?
A: Use exclude_none=True in model_dump() to maintain backward compatibility.

Q: How to handle legacy data?
A: Migration script to wrap old free-text summaries in minimal universal structure.


NEXT STEPS
==========

1. Review schemas.py structure
2. Test schema validation with sample data:
   
   python
   from schemas import AIResponseSchema
   
   sample = {
       "universal": {
           "evolution": "Test patient",
           "current_status": ["Status 1"],
           "plan": ["Plan 1"]
       },
       "oncology": None,
       "speech": None
   }
   
   validated = AIResponseSchema.model_validate(sample)
   print(validated.model_dump_json(indent=2))

3. Update one endpoint (/summarize) as proof of concept
4. Gather feedback from frontend team
5. Roll out to remaining endpoints
6. Add monitoring/logging for validation failures


CONTACT
=======

For questions about schema design or integration, refer to:
- schemas.py docstrings
- Pydantic documentation: https://docs.pydantic.dev
- FastAPI validation guide: https://fastapi.tiangolo.com/tutorial/body/
"""
