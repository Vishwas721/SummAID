"""
Parallel Prompt System Module (Production-Ready)
=================================================
Focused extraction functions for structured AI responses.
Includes robust error handling, timeouts, and environment variable configuration.

Features:
- Environment variable for LLM model selection
- Timeout protection (60s default)
- Comprehensive error handling with user-friendly messages
- Parallel execution for performance
- Schema validation for data integrity
"""

import asyncio
import json
import logging
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
import requests

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Load LLM model from environment variable (default: llama3:8b)
DEFAULT_MODEL = os.getenv('LLM_MODEL', 'llama3:8b')
LLM_TIMEOUT = 120  # Timeout for LLM calls in seconds

# =============================================================================
# PARALLEL PROMPT SYSTEM FOR STRUCTURED EXTRACTION
# =============================================================================

async def _call_llm_async(prompt: str, model: str, temperature: float = 0.1) -> str:
    """
    Async wrapper for LLM calls to enable parallel execution.
    
    Args:
        prompt: The prompt to send to the LLM
        model: Model name (e.g., 'llama3:8b')
        temperature: Sampling temperature (0.0-1.0)
        
    Returns:
        LLM response text or error message
    """
    loop = asyncio.get_event_loop()
    
    def _call():
        try:
            r = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_ctx": 4096,
                        "top_p": 0.9,
                        "repeat_penalty": 1.1
                    }
                },
                timeout=120
            )
            data = r.json()
            if r.status_code != 200:
                return f"⚠️ Error: {json.dumps(data)[:200]}"
            return data.get('response', '').strip()
        except requests.exceptions.Timeout:
            return "⚠️ Error: LLM request timed out"
        except requests.exceptions.ConnectionError:
            return "⚠️ Error: Cannot connect to LLM service"
        except Exception as e:
            return f"⚠️ Error: {str(e)}"
    
    return await loop.run_in_executor(None, _call)

async def _classify_specialty(context: str, model: str) -> str:
    """
    Step 1: Classify patient specialty (oncology, speech, or general).
    
    Args:
        context: Medical report text
        model: LLM model name
        
    Returns:
        One of: 'oncology', 'speech', 'general'
    """
    prompt = f"""Analyze the following medical report excerpts and classify the patient specialty.

RETURN ONLY ONE WORD: oncology, speech, or general

Rules:
- Return "oncology" if reports mention cancer, tumors, chemotherapy, radiation, TNM staging, oncology visits
- Return "speech" if reports mention audiology, hearing loss, audiograms, speech therapy, tinnitus, hearing aids
- Return "general" for other medical cases (cardiology, internal medicine, etc.)

Medical Reports:
{context[:3000]}

Classification (one word only):"""
    
    try:
        result = await asyncio.wait_for(
            _call_llm_async(prompt, model, temperature=0.0),
            timeout=LLM_TIMEOUT
        )
        
        # Check for error message
        if result.startswith('⚠️ Error:'):
            logger.error(f"Specialty classification failed: {result}")
            return 'general'
        
        classification = result.lower().strip()
        
        # Validate and default
        if classification in ['oncology', 'speech', 'general']:
            return classification
        elif 'oncology' in classification or 'cancer' in classification:
            return 'oncology'
        elif 'speech' in classification or 'audio' in classification:
            return 'speech'
        else:
            return 'general'
            
    except asyncio.TimeoutError:
        logger.error("Specialty classification timed out")
        return 'general'
    except Exception as e:
        logger.error(f"Specialty classification error: {e}")
        return 'general'

async def _extract_evolution(context: str, specialty: str, model: str) -> str:
    """
    Step 2a: Extract medical journey narrative.
    
    Args:
        context: Medical report text
        specialty: Patient specialty classification
        model: LLM model name
        
    Returns:
        Narrative text or error message
    """
    prompt = f"""You are a medical AI. Write a concise 2-3 sentence narrative describing the patient's medical journey from diagnosis to current state.

Focus on:
- Initial presentation/diagnosis
- Key treatments or interventions
- Current status
- **PERTINENT NEGATIVES**: Include crucial conditions that were checked but are ABSENT (e.g., "No metastasis", "No lymph node involvement", "No conductive component")

Medical Reports:
{context[:8000]}

Narrative (2-3 sentences):"""
    
    try:
        result = await asyncio.wait_for(
            _call_llm_async(prompt, model, temperature=0.2),
            timeout=LLM_TIMEOUT
        )
        
        if result.startswith('⚠️ Error:'):
            return f"⚠️ Unable to generate medical narrative. {result}"
        
        return result
        
    except asyncio.TimeoutError:
        return "⚠️ Error: Narrative generation timed out."
    except Exception as e:
        return f"⚠️ Error: {str(e)}"

async def _extract_current_status(context: str, specialty: str, model: str) -> List[str]:
    """
    Step 2b: Extract current status as bullet points.
    
    Args:
        context: Medical report text
        specialty: Patient specialty classification
        model: LLM model name
        
    Returns:
        List of status bullet points or error list
    """
    prompt = f"""Extract the patient's CURRENT medical status as 3-5 concise bullet points.

Focus on:
- Current symptoms or conditions
- Latest test results or findings
- Current treatment status
- Active issues
- **PERTINENT NEGATIVES**: Explicitly list major conditions or symptoms that were RULED OUT or are ABSENT (e.g., "No fever", "No bleeding", "No progression")

RETURN ONLY bullet points, one per line, starting with a dash. No other text.

Medical Reports:
{context[:8000]}

Current Status:
-"""
    
    try:
        result = await asyncio.wait_for(
            _call_llm_async(prompt, model, temperature=0.1),
            timeout=LLM_TIMEOUT
        )
        
        if result.startswith('⚠️ Error:'):
            return [f"⚠️ Status extraction failed. {result}"]
        
        # Parse bullet points
        lines = [line.strip() for line in result.split('\n') if line.strip()]
        bullets = []
        for line in lines:
            if line.startswith('-'):
                bullets.append(line[1:].strip())
            elif line.startswith('•'):
                bullets.append(line[1:].strip())
            elif bullets:  # continuation of previous bullet
                bullets[-1] += ' ' + line
        
        return bullets[:5] if bullets else ["Status information not available"]
        
    except asyncio.TimeoutError:
        return ["⚠️ Error: Status extraction timed out."]
    except Exception as e:
        return [f"⚠️ Error: {str(e)}"]

async def _extract_plan(context: str, specialty: str, model: str) -> List[str]:
    """
    Step 2c: Extract treatment plan and next steps.
    
    Args:
        context: Medical report text
        specialty: Patient specialty classification
        model: LLM model name
        
    Returns:
        List of plan bullet points or error list
    """
    prompt = f"""Extract the treatment PLAN and next steps as 3-5 concise bullet points.

Focus on:
- Planned treatments or procedures
- Follow-up appointments
- Monitoring or testing
- Recommendations

RETURN ONLY bullet points, one per line, starting with a dash. No other text.

Medical Reports:
{context[:8000]}

Plan:
-"""
    
    try:
        result = await asyncio.wait_for(
            _call_llm_async(prompt, model, temperature=0.1),
            timeout=LLM_TIMEOUT
        )
        
        if result.startswith('⚠️ Error:'):
            return [f"⚠️ Plan extraction failed. {result}"]
        
        # Parse bullet points
        lines = [line.strip() for line in result.split('\n') if line.strip()]
        bullets = []
        for line in lines:
            if line.startswith('-'):
                bullets.append(line[1:].strip())
            elif line.startswith('•'):
                bullets.append(line[1:].strip())
            elif bullets:
                bullets[-1] += ' ' + line
        
        return bullets[:5] if bullets else ["Plan information not available"]
        
    except asyncio.TimeoutError:
        return ["⚠️ Error: Plan extraction timed out."]
    except Exception as e:
        return [f"⚠️ Error: {str(e)}"]

async def _extract_oncology_data(context: str, model: str) -> Optional[Dict[str, Any]]:
    """
    Step 3a: Extract oncology-specific structured data.
    
    Args:
        context: Medical report text
        model: LLM model name
        
    Returns:
        Oncology data dict or None if extraction fails
    """
    prompt = f"""Extract oncology data from medical reports. Return ONLY valid JSON, no explanations.

Extract from the text below:
- Tumor measurements (size in cm, dates)
- TNM staging
- Cancer type and grade
- Biomarkers (ER, PR, HER2, Ki-67)
- Treatment response
- Pertinent negatives (what's absent: no metastasis, no spread, etc.)

For tumor_size_trend: If multiple measurements exist, compare latest to earliest.
Status: "IMPROVING" (smaller), "WORSENING" (larger), "STABLE" (no change)

JSON FORMAT (use null if not found):
{{
  "tumor_size_trend": [{{"date": "YYYY-MM-DD", "size_cm": 2.3, "status": "IMPROVING"}}],
  "tnm_staging": "T2N0M0",
  "cancer_type": "Breast Cancer",
  "grade": "Grade 2",
  "biomarkers": {{"ER": "positive", "PR": "positive", "HER2": "negative"}},
  "treatment_response": "Partial response",
  "pertinent_negatives": ["No metastasis"]
}}

Reports:
{context[:6000]}

JSON:"""
    
    try:
        result = await asyncio.wait_for(
            _call_llm_async(prompt, model, temperature=0.0),
            timeout=LLM_TIMEOUT
        )
        
        if result.startswith('⚠️ Error:'):
            logger.error(f"Oncology data extraction failed: {result}")
            return None
        
        # Extract JSON from response
        start = result.find('{')
        end = result.rfind('}')
        if start >= 0 and end >= 0:
            json_str = result[start:end+1]
            data = json.loads(json_str)
            return data
        return None
        
    except asyncio.TimeoutError:
        logger.error("Oncology data extraction timed out")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Oncology JSON parse error: {e}")
        return None
    except Exception as e:
        logger.error(f"Oncology data extraction error: {e}")
        return None

async def _extract_speech_data(context: str, model: str) -> Optional[Dict[str, Any]]:
    """
    Step 3b: Extract speech/audiology structured data.
    
    Args:
        context: Medical report text
        model: LLM model name
        
    Returns:
        Speech data dict or None if extraction fails
    """
    prompt = f"""Extract audiology data from the medical reports and return ONLY valid JSON.

Extract:
1. Audiogram frequencies (500Hz, 1000Hz, 2000Hz, 4000Hz, 8000Hz) for left and right ears (dB HL values)
2. Speech scores (SRT in dB, WRS as percentage)
3. Hearing loss type (Sensorineural, Conductive, Mixed)
4. Severity (Mild, Moderate, Severe, Profound)
5. Tinnitus presence (true/false)
6. Amplification device
7. **PERTINENT NEGATIVES**: List audiology findings that are ABSENT (e.g., "No conductive component", "No air-bone gap", "No middle ear pathology", "No acoustic reflex abnormality")

TREND ANALYSIS INSTRUCTIONS:
- For audiogram values: Compare to previous reports if available
  * Higher dB values = worse hearing (WORSENING)
  * Lower dB values = better hearing (IMPROVING)
  * No change = STABLE
- Normal hearing: 0-20 dB HL
- Mild loss: 21-40 dB HL
- Moderate loss: 41-70 dB HL (assign status "HIGH")
- Severe loss: 71-90 dB HL (assign status "HIGH")
- Profound loss: 91+ dB HL (assign status "HIGH")
- If multiple audiograms exist, calculate trend and add "hearing_trend" field: "IMPROVING", "WORSENING", or "STABLE"

RETURN ONLY THIS JSON STRUCTURE (use null for missing data):
{{
  "audiogram": {{
    "left": {{"500Hz": 45, "1000Hz": 50, "2000Hz": 55, "4000Hz": 60}},
    "right": {{"500Hz": 40, "1000Hz": 48, "2000Hz": 52, "4000Hz": 58}},
    "test_date": "YYYY-MM-DD",
    "status": "HIGH"
  }},
  "speech_scores": {{"srt_db": 45, "wrs_percent": 82}},
  "hearing_loss_type": "Sensorineural",
  "hearing_loss_severity": "Moderate",
  "hearing_trend": "STABLE",
  "tinnitus": true,
  "amplification": "Device description",
  "pertinent_negatives": ["No conductive component", "No middle ear pathology"]
}}

Medical Reports:
{context[:8000]}

JSON:"""
    
    try:
        result = await asyncio.wait_for(
            _call_llm_async(prompt, model, temperature=0.0),
            timeout=LLM_TIMEOUT
        )
        
        if result.startswith('⚠️ Error:'):
            logger.error(f"Speech data extraction failed: {result}")
            return None
        
        # Extract JSON from response
        start = result.find('{')
        end = result.rfind('}')
        if start >= 0 and end >= 0:
            json_str = result[start:end+1]
            data = json.loads(json_str)
            return data
        return None
        
    except asyncio.TimeoutError:
        logger.error("Speech data extraction timed out")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Speech JSON parse error: {e}")
        return None
    except Exception as e:
        logger.error(f"Speech data extraction error: {e}")
        return None

async def _generate_structured_summary_parallel(
    context_chunks: List[str], 
    patient_label: str, 
    patient_type_hint: str, 
    model: str = None
) -> str:
    """
    Generate structured summary using parallel prompts for better accuracy and speed.
    
    This replaces the monolithic _generate_summary with a multi-stage parallel approach:
    1. Classify specialty
    2. Extract universal data in parallel (evolution, status, plan)
    3. Extract specialty data based on classification (oncology or speech)
    4. Combine into structured JSON following AIResponseSchema
    
    Args:
        context_chunks: List of medical report text chunks
        patient_label: Patient identifier for logging
        patient_type_hint: Hint for patient type (optional)
        model: LLM model name (defaults to environment variable)
        
    Returns:
        JSON string with structured summary data
    """
    # Use environment variable model if not specified
    if model is None:
        model = DEFAULT_MODEL
    context = "\n\n".join(context_chunks)
    logger.info(f"Starting parallel structured summary generation for {patient_label} using model: {model}")
    
    try:
        # Step 1: Classify specialty (fast)
        specialty = await _classify_specialty(context, model)
        logger.info(f"Classified as: {specialty}")
        
        # Step 2: Extract universal data in parallel
        universal_tasks = [
            _extract_evolution(context, specialty, model),
            _extract_current_status(context, specialty, model),
            _extract_plan(context, specialty, model)
        ]
        
        evolution, current_status, plan = await asyncio.gather(*universal_tasks)
        
        logger.info(f"Universal data extracted: evolution={len(evolution)} chars, status={len(current_status)} items, plan={len(plan)} items")
        
        # Step 3: Extract specialty-specific data in parallel (conditional)
        specialty_data = None
        if specialty == 'oncology':
            specialty_data = await _extract_oncology_data(context, model)
            logger.info(f"Oncology data extracted: {specialty_data is not None}")
        elif specialty == 'speech':
            specialty_data = await _extract_speech_data(context, model)
            logger.info(f"Speech data extracted: {specialty_data is not None}")
        
        # Step 4: Build structured response following AIResponseSchema
        structured_response = {
            "universal": {
                "evolution": evolution,
                "current_status": current_status,
                "plan": plan
            },
            "oncology": specialty_data if specialty == 'oncology' else None,
            "speech": specialty_data if specialty == 'speech' else None,
            "specialty": specialty,
            "generated_at": datetime.now().isoformat()
        }
        
        # Step 5: Validate against schema
        try:
            from schemas import AIResponseSchema
            validated = AIResponseSchema.model_validate(structured_response)
            clean_json = validated.model_dump_json(exclude_none=True, indent=2)
            logger.info(f"✓ Validated structured summary for {patient_label}")
            return clean_json
        except ImportError:
            logger.warning("schemas module not found, skipping validation")
            return json.dumps(structured_response, indent=2)
        except Exception as e:
            logger.error(f"Schema validation failed: {e}")
            # Return unvalidated JSON as fallback
            return json.dumps(structured_response, indent=2)
    
    except asyncio.TimeoutError:
        logger.error(f"⚠️ Parallel summary generation timed out for {patient_label}")
        # Fallback to minimal structure
        fallback = {
            "universal": {
                "evolution": f"⚠️ Medical summary generation timed out for {patient_label}. Please retry.",
                "current_status": ["⚠️ Data extraction timed out"],
                "plan": ["Review medical records manually", "Retry summary generation"]
            },
            "specialty": "general"
        }
        return json.dumps(fallback, indent=2)
    
    except Exception as e:
        logger.error(f"⚠️ Parallel summary generation failed for {patient_label}: {e}")
        # Fallback to minimal structure
        fallback = {
            "universal": {
                "evolution": f"⚠️ Medical summary generation failed for {patient_label}. Error: {str(e)}",
                "current_status": ["⚠️ Data extraction error"],
                "plan": ["Review medical records manually", "Contact system administrator"]
            },
            "specialty": "general"
        }
        return json.dumps(fallback, indent=2)
