"""
EXAMPLE: How to integrate schemas into existing SummAID endpoints

This file shows actual code modifications needed for main.py
"""

# =============================================================================
# STEP 1: Add imports at the top of main.py (around line 12)
# =============================================================================

# BEFORE:
# from pydantic import BaseModel, Field

# AFTER:
from pydantic import BaseModel, Field
from schemas import AIResponseSchema, ChatResponseSchema  # NEW


# =============================================================================
# STEP 2: Update system prompt in _generate_summary() (around line 390)
# =============================================================================

# BEFORE (current free-text prompt):
"""
system_prompt = f'''You are a medical AI assistant for SummAID.
Patient type: {patient_type}
Chief complaint: {chief_complaint}
Context: {len(chunks)} medical report chunks

Generate a comprehensive clinical summary...
'''
"""

# AFTER (structured JSON prompt):
"""
system_prompt = f'''You are a medical AI assistant for SummAID.
Patient type: {patient_type}
Chief complaint: {chief_complaint}

CRITICAL: You MUST return a valid JSON object following this EXACT structure:

{{
  "universal": {{
    "evolution": "Brief medical journey from diagnosis to current state (2-3 sentences)",
    "current_status": [
      "Current condition or symptom 1",
      "Current condition or symptom 2",
      "Current condition or symptom 3"
    ],
    "plan": [
      "Next treatment or action step 1",
      "Next treatment or action step 2",
      "Follow-up or monitoring plan"
    ]
  }},
  "oncology": {{
    "tumor_size_trend": [
      {{"date": "YYYY-MM-DD", "size_cm": 2.3}},
      {{"date": "YYYY-MM-DD", "size_cm": 1.8}}
    ],
    "tnm_staging": "T2N0M0",
    "cancer_type": "Type of cancer",
    "grade": "Grade description",
    "biomarkers": {{"ER": "positive", "PR": "positive", "HER2": "negative"}},
    "treatment_response": "Response status"
  }},
  "speech": {{
    "audiogram": {{
      "left": {{"500Hz": 45, "1000Hz": 50, "2000Hz": 55, "4000Hz": 60}},
      "right": {{"500Hz": 40, "1000Hz": 48, "2000Hz": 52, "4000Hz": 58}},
      "test_date": "YYYY-MM-DD"
    }},
    "speech_scores": {{
      "srt_db": 45,
      "wrs_percent": 82
    }},
    "hearing_loss_type": "Sensorineural or Conductive",
    "hearing_loss_severity": "Mild, Moderate, Severe, or Profound",
    "tinnitus": true,
    "amplification": "Device description"
  }},
  "specialty": "{patient_type}"
}}

RULES:
1. If patient is NOT oncology, set "oncology": null
2. If patient is NOT speech/audiology, set "speech": null
3. ALWAYS populate the "universal" section
4. Use null for unknown/missing values
5. Return ONLY valid JSON - NO markdown formatting, NO code blocks
6. Base ALL information on the provided report chunks

Medical report context ({len(chunks)} chunks):
{context_text}
'''
"""


# =============================================================================
# STEP 3: Add validation in /summarize endpoint (around line 790)
# =============================================================================

# BEFORE (current code):
"""
summary_text = _generate_summary([t for _,_,t,_ in context_accum], label, system_prompt)
"""

# AFTER (with validation):
"""
import json

# Generate summary
raw_summary = _generate_summary([t for _,_,t,_ in context_accum], label, system_prompt)

# Validate and clean
try:
    # Parse JSON response from AI
    ai_json = json.loads(raw_summary)
    
    # Validate against schema
    validated = AIResponseSchema.model_validate(ai_json)
    
    # Convert to clean JSON (removes null fields, ensures consistency)
    summary_text = validated.model_dump_json(exclude_none=True)
    
    logger.info(f"✓ Validated structured response for patient {patient_id}")
    
except json.JSONDecodeError as e:
    # AI returned invalid JSON - fallback to wrapping free text
    logger.warning(f"AI returned invalid JSON for patient {patient_id}: {e}")
    fallback = {
        "universal": {
            "evolution": raw_summary,
            "current_status": [],
            "plan": []
        }
    }
    summary_text = json.dumps(fallback)
    
except Exception as e:
    # Schema validation failed - log and fallback
    logger.error(f"Schema validation failed for patient {patient_id}: {e}")
    fallback = {
        "universal": {
            "evolution": raw_summary,
            "current_status": [],
            "plan": []
        }
    }
    summary_text = json.dumps(fallback)
"""


# =============================================================================
# STEP 4: Update /chat endpoint (around line 900)
# =============================================================================

# BEFORE (current code returns raw text):
"""
return {
    "response": chat_response_text,
    "citations": citations
}
"""

# AFTER (with schema validation):
"""
try:
    # Validate chat response
    validated_chat = ChatResponseSchema(
        response=chat_response_text,
        citations=citations,
        confidence=None  # Optional: could add confidence scoring
    )
    
    return validated_chat.model_dump(exclude_none=True)
    
except Exception as e:
    logger.error(f"Chat response validation failed: {e}")
    # Fallback
    return {
        "response": chat_response_text,
        "citations": citations
    }
"""


# =============================================================================
# STEP 5: Update frontend to consume structured data
# =============================================================================

# In frontend/src/components/SummaryPanel.jsx or wherever summary is displayed:

"""
// BEFORE (free text display):
<div className="summary-text">
  {summaryData.summary_text}
</div>

// AFTER (structured data display):
const parsedSummary = JSON.parse(summaryData.summary_text);

<div className="summary-structured">
  {/* Universal section (always present) */}
  <section className="universal">
    <h3>Medical Journey</h3>
    <p>{parsedSummary.universal.evolution}</p>
    
    <h4>Current Status</h4>
    <ul>
      {parsedSummary.universal.current_status.map((status, i) => (
        <li key={i}>{status}</li>
      ))}
    </ul>
    
    <h4>Treatment Plan</h4>
    <ul>
      {parsedSummary.universal.plan.map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </ul>
  </section>
  
  {/* Oncology section (conditional) */}
  {parsedSummary.oncology && (
    <section className="oncology">
      <h3>Oncology Details</h3>
      <p><strong>Cancer Type:</strong> {parsedSummary.oncology.cancer_type}</p>
      <p><strong>TNM Staging:</strong> {parsedSummary.oncology.tnm_staging}</p>
      <p><strong>Grade:</strong> {parsedSummary.oncology.grade}</p>
      
      {/* Tumor size chart */}
      {parsedSummary.oncology.tumor_size_trend.length > 0 && (
        <div className="tumor-chart">
          <h4>Tumor Size Progression</h4>
          <TumorSizeChart data={parsedSummary.oncology.tumor_size_trend} />
        </div>
      )}
      
      {/* Biomarkers */}
      {parsedSummary.oncology.biomarkers && (
        <div className="biomarkers">
          <h4>Biomarkers</h4>
          {Object.entries(parsedSummary.oncology.biomarkers).map(([key, val]) => (
            <span key={key} className="biomarker-badge">
              {key}: {val}
            </span>
          ))}
        </div>
      )}
    </section>
  )}
  
  {/* Speech/Audiology section (conditional) */}
  {parsedSummary.speech && (
    <section className="speech">
      <h3>Audiology Details</h3>
      <p><strong>Hearing Loss:</strong> {parsedSummary.speech.hearing_loss_severity} {parsedSummary.speech.hearing_loss_type}</p>
      
      {/* Audiogram chart */}
      {parsedSummary.speech.audiogram && (
        <div className="audiogram-chart">
          <h4>Audiogram Results</h4>
          <AudiogramChart 
            left={parsedSummary.speech.audiogram.left}
            right={parsedSummary.speech.audiogram.right}
            testDate={parsedSummary.speech.audiogram.test_date}
          />
        </div>
      )}
      
      {/* Speech scores */}
      {parsedSummary.speech.speech_scores && (
        <div className="speech-scores">
          <div>SRT: {parsedSummary.speech.speech_scores.srt_db} dB</div>
          <div>WRS: {parsedSummary.speech.speech_scores.wrs_percent}%</div>
        </div>
      )}
    </section>
  )}
</div>
"""


# =============================================================================
# COMPLETE EXAMPLE: Minimal backend integration
# =============================================================================

def example_minimal_integration():
    """
    Minimal example showing the core changes needed.
    Copy this pattern into your actual endpoints.
    """
    from schemas import AIResponseSchema
    import json
    
    # 1. Get AI response (your existing code)
    ai_raw_response = call_your_ai_function()  # Returns string
    
    # 2. Parse and validate
    try:
        # Parse JSON
        ai_json = json.loads(ai_raw_response)
        
        # Validate
        validated = AIResponseSchema.model_validate(ai_json)
        
        # Get clean output
        clean_json_string = validated.model_dump_json(exclude_none=True)
        
        # Store or return
        return clean_json_string
        
    except (json.JSONDecodeError, Exception) as e:
        # Fallback for invalid responses
        print(f"Validation error: {e}")
        fallback = {
            "universal": {
                "evolution": ai_raw_response,
                "current_status": [],
                "plan": []
            }
        }
        return json.dumps(fallback)


# =============================================================================
# TESTING YOUR INTEGRATION
# =============================================================================

"""
After making changes, test with:

1. Run schema tests:
   cd C:\\SummAID\\backend
   python test_schemas.py

2. Test a real API call:
   curl -X POST http://localhost:8000/summarize/1 \\
     -H "Content-Type: application/json" \\
     -d '{"chief_complaint": "test", "max_chunks": 10}'

3. Check the response structure:
   - Should have "universal" section
   - Should have specialty sections (oncology/speech) or null
   - Should be valid JSON

4. Check backend logs:
   - Look for "✓ Validated structured response" (success)
   - Look for "Schema validation failed" (needs attention)
"""


# =============================================================================
# ROLLBACK PLAN (if something goes wrong)
# =============================================================================

"""
If validation causes issues:

1. Comment out validation temporarily:
   # validated = AIResponseSchema.model_validate(ai_json)
   summary_text = raw_summary  # Use raw AI response

2. Check logs for validation errors
3. Fix AI prompt or schema
4. Re-enable validation

The system gracefully falls back to free text if validation fails,
so integration is low-risk.
"""
