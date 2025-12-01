"""
Parallel Prompt System Module
==============================
Focused extraction functions for structured AI responses.
To be integrated into main.py after _infer_patient_type function.
"""

import asyncio
import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
import requests

logger = logging.getLogger(__name__)

# =============================================================================
# PARALLEL PROMPT SYSTEM FOR STRUCTURED EXTRACTION
# =============================================================================

async def _call_llm_async(prompt: str, model: str, temperature: float = 0.1) -> str:
    """Async wrapper for LLM calls to enable parallel execution."""
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
                return f"Error: {json.dumps(data)[:200]}"
            return data.get('response', '').strip()
        except Exception as e:
            return f"Error: {str(e)}"
    
    return await loop.run_in_executor(None, _call)

async def _classify_specialty(context: str, model: str) -> str:
    """Step 1: Classify patient specialty (oncology, speech, or general)."""
    prompt = f"""Analyze the following medical report excerpts and classify the patient specialty.

RETURN ONLY ONE WORD: oncology, speech, or general

Rules:
- Return "oncology" if reports mention cancer, tumors, chemotherapy, radiation, TNM staging, oncology visits
- Return "speech" if reports mention audiology, hearing loss, audiograms, speech therapy, tinnitus, hearing aids
- Return "general" for other medical cases (cardiology, internal medicine, etc.)

Medical Reports:
{context[:3000]}

Classification (one word only):"""
    
    result = await _call_llm_async(prompt, model, temperature=0.0)
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

async def _extract_evolution(context: str, specialty: str, model: str) -> str:
    """Step 2a: Extract medical journey narrative."""
    prompt = f"""You are a medical AI. Write a concise 2-3 sentence narrative describing the patient's medical journey from diagnosis to current state.

Focus on:
- Initial presentation/diagnosis
- Key treatments or interventions
- Current status

Medical Reports:
{context[:8000]}

Narrative (2-3 sentences):"""
    
    return await _call_llm_async(prompt, model, temperature=0.2)

async def _extract_current_status(context: str, specialty: str, model: str) -> List[str]:
    """Step 2b: Extract current status as bullet points."""
    prompt = f"""Extract the patient's CURRENT medical status as 3-5 concise bullet points.

Focus on:
- Current symptoms or conditions
- Latest test results or findings
- Current treatment status
- Active issues

RETURN ONLY bullet points, one per line, starting with a dash. No other text.

Medical Reports:
{context[:8000]}

Current Status:
-"""
    
    result = await _call_llm_async(prompt, model, temperature=0.1)
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

async def _extract_plan(context: str, specialty: str, model: str) -> List[str]:
    """Step 2c: Extract treatment plan and next steps."""
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
    
    result = await _call_llm_async(prompt, model, temperature=0.1)
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

async def _extract_oncology_data(context: str, model: str) -> Optional[Dict[str, Any]]:
    """Step 3a: Extract oncology-specific structured data."""
    prompt = f"""Extract oncology data from the medical reports and return ONLY valid JSON.

Extract:
1. Tumor size measurements with dates (look for measurements in cm, dimensions)
2. TNM staging (e.g., T2N0M0)
3. Cancer type
4. Grade
5. Biomarkers (ER, PR, HER2, Ki-67, etc.)
6. Treatment response

RETURN ONLY THIS JSON STRUCTURE (use null for missing data):
{{
  "tumor_size_trend": [
    {{"date": "YYYY-MM-DD", "size_cm": 2.3}}
  ],
  "tnm_staging": "T2N0M0",
  "cancer_type": "Cancer type",
  "grade": "Grade description",
  "biomarkers": {{"ER": "positive", "PR": "positive"}},
  "treatment_response": "Response description"
}}

Medical Reports:
{context[:8000]}

JSON:"""
    
    result = await _call_llm_async(prompt, model, temperature=0.0)
    
    # Extract JSON from response
    try:
        # Try to find JSON in the response
        start = result.find('{')
        end = result.rfind('}')
        if start >= 0 and end >= 0:
            json_str = result[start:end+1]
            data = json.loads(json_str)
            return data
        return None
    except:
        return None

async def _extract_speech_data(context: str, model: str) -> Optional[Dict[str, Any]]:
    """Step 3b: Extract speech/audiology structured data."""
    prompt = f"""Extract audiology data from the medical reports and return ONLY valid JSON.

Extract:
1. Audiogram frequencies (500Hz, 1000Hz, 2000Hz, 4000Hz, 8000Hz) for left and right ears (dB HL values)
2. Speech scores (SRT in dB, WRS as percentage)
3. Hearing loss type (Sensorineural, Conductive, Mixed)
4. Severity (Mild, Moderate, Severe, Profound)
5. Tinnitus presence (true/false)
6. Amplification device

RETURN ONLY THIS JSON STRUCTURE (use null for missing data):
{{
  "audiogram": {{
    "left": {{"500Hz": 45, "1000Hz": 50, "2000Hz": 55, "4000Hz": 60}},
    "right": {{"500Hz": 40, "1000Hz": 48, "2000Hz": 52, "4000Hz": 58}},
    "test_date": "YYYY-MM-DD"
  }},
  "speech_scores": {{"srt_db": 45, "wrs_percent": 82}},
  "hearing_loss_type": "Sensorineural",
  "hearing_loss_severity": "Moderate",
  "tinnitus": true,
  "amplification": "Device description"
}}

Medical Reports:
{context[:8000]}

JSON:"""
    
    result = await _call_llm_async(prompt, model, temperature=0.0)
    
    # Extract JSON from response
    try:
        start = result.find('{')
        end = result.rfind('}')
        if start >= 0 and end >= 0:
            json_str = result[start:end+1]
            data = json.loads(json_str)
            return data
        return None
    except:
        return None

async def _generate_structured_summary_parallel(context_chunks: List[str], patient_label: str, patient_type_hint: str, model: str) -> str:
    """Generate structured summary using parallel prompts for better accuracy and speed.
    
    This replaces the monolithic _generate_summary with a multi-stage parallel approach:
    1. Classify specialty
    2. Extract universal data in parallel (evolution, status, plan)
    3. Extract specialty data based on classification (oncology or speech)
    4. Combine into structured JSON following AIResponseSchema
    """
    context = "\n\n".join(context_chunks)
    logger.info(f"Starting parallel structured summary generation for {patient_label}")
    
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
        from schemas import AIResponseSchema
        try:
            validated = AIResponseSchema.model_validate(structured_response)
            clean_json = validated.model_dump_json(exclude_none=True, indent=2)
            logger.info(f"✓ Validated structured summary for {patient_label}")
            return clean_json
        except Exception as e:
            logger.error(f"Schema validation failed: {e}")
            # Return unvalidated JSON as fallback
            return json.dumps(structured_response, indent=2)
    
    except Exception as e:
        logger.error(f"Parallel summary generation failed: {e}")
        # Fallback to minimal structure
        fallback = {
            "universal": {
                "evolution": f"Medical summary for {patient_label}. Detailed extraction failed.",
                "current_status": ["Data extraction error"],
                "plan": ["Review medical records manually"]
            },
            "specialty": "general"
        }
        return json.dumps(fallback, indent=2)
