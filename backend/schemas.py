"""
SummAID Backend Schemas
=======================
Defines strict JSON structures for AI responses to ensure clean, predictable data for frontend rendering.

These Pydantic models enforce:
- Type safety and validation
- Consistent field naming
- Nullable specialty sections (oncology, speech, etc.)
- Clear evolution/status/plan structure for all patients
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import date, datetime


# ============================================================================
# UNIVERSAL PATIENT DATA (ALL PATIENTS)
# ============================================================================

class UniversalData(BaseModel):
    """
    Core information present for every patient regardless of specialty.
    """
    evolution: str = Field(
        ...,
        description="High-level summary of patient's medical journey and progression"
    )
    current_status: List[str] = Field(
        default_factory=list,
        description="List of current medical conditions, symptoms, or status points"
    )
    plan: List[str] = Field(
        default_factory=list,
        description="List of next steps, treatments, or follow-up actions"
    )


# ============================================================================
# ONCOLOGY SPECIALTY DATA
# ============================================================================

class TumorSizeMeasurement(BaseModel):
    """Single tumor size measurement at a specific date."""
    date: str = Field(..., description="Date of measurement (YYYY-MM-DD or YYYY-MM)")
    size_cm: float = Field(..., description="Tumor size in centimeters", ge=0)
    location: Optional[str] = Field(None, description="Anatomical location if multiple tumors")
    status: Optional[str] = Field(None, description="Trend status: IMPROVING, WORSENING, or STABLE")

    @validator('date')
    def validate_date_format(cls, v):
        """Ensure date is in acceptable format."""
        try:
            # Try parsing as full date or year-month
            if len(v) == 10:
                datetime.strptime(v, '%Y-%m-%d')
            elif len(v) == 7:
                datetime.strptime(v, '%Y-%m')
            else:
                raise ValueError
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD or YYYY-MM format')
        return v


class OncologyData(BaseModel):
    """
    Oncology-specific patient data.
    Null if patient is not an oncology case.
    """
    tumor_size_trend: List[TumorSizeMeasurement] = Field(
        default_factory=list,
        description="Historical tumor size measurements over time"
    )
    tnm_staging: Optional[str] = Field(
        None,
        description="TNM staging classification (e.g., 'T2N0M0', 'T3N1M0')"
    )
    cancer_type: Optional[str] = Field(
        None,
        description="Type of cancer (e.g., 'Breast Cancer', 'Lung Adenocarcinoma')"
    )
    grade: Optional[str] = Field(
        None,
        description="Tumor grade (e.g., 'Grade 2', 'Well-differentiated')"
    )
    biomarkers: Optional[Dict[str, Any]] = Field(
        None,
        description="Relevant biomarkers (e.g., {'HER2': 'positive', 'ER': 'positive', 'PR': 'negative'})"
    )
    treatment_response: Optional[str] = Field(
        None,
        description="Response to current treatment (e.g., 'Partial Response', 'Stable Disease')"
    )
    pertinent_negatives: Optional[List[str]] = Field(
        None,
        description="Major oncology findings that are absent (e.g., 'No metastasis', 'No lymph node involvement')"
    )


# ============================================================================
# SPEECH/AUDIOLOGY SPECIALTY DATA
# ============================================================================

class AudiogramFrequency(BaseModel):
    """Hearing threshold at specific frequencies."""
    freq_500hz: Optional[float] = Field(None, description="Hearing threshold at 500 Hz (dB HL)", alias="500Hz")
    freq_1000hz: Optional[float] = Field(None, description="Hearing threshold at 1000 Hz (dB HL)", alias="1000Hz")
    freq_2000hz: Optional[float] = Field(None, description="Hearing threshold at 2000 Hz (dB HL)", alias="2000Hz")
    freq_4000hz: Optional[float] = Field(None, description="Hearing threshold at 4000 Hz (dB HL)", alias="4000Hz")
    freq_8000hz: Optional[float] = Field(None, description="Hearing threshold at 8000 Hz (dB HL)", alias="8000Hz")

    class Config:
        populate_by_name = True  # Allow both "500Hz" and "freq_500hz"


class Audiogram(BaseModel):
    """Complete audiogram data for both ears."""
    left: Optional[AudiogramFrequency] = Field(None, description="Left ear audiogram")
    right: Optional[AudiogramFrequency] = Field(None, description="Right ear audiogram")
    test_date: Optional[str] = Field(None, description="Date of audiogram test")
    status: Optional[str] = Field(None, description="Hearing status: HIGH (significant loss), NORMAL, or LOW")


class SpeechScores(BaseModel):
    """Speech recognition and threshold scores."""
    srt_db: Optional[float] = Field(
        None,
        description="Speech Reception Threshold in dB",
        ge=0,
        le=120
    )
    wrs_percent: Optional[float] = Field(
        None,
        description="Word Recognition Score as percentage",
        ge=0,
        le=100
    )
    mcl_db: Optional[float] = Field(
        None,
        description="Most Comfortable Loudness level in dB"
    )
    ucl_db: Optional[float] = Field(
        None,
        description="Uncomfortable Loudness level in dB"
    )


class SpeechData(BaseModel):
    """
    Speech/Audiology-specific patient data.
    Null if patient is not a speech/audiology case.
    """
    audiogram: Optional[Audiogram] = Field(
        None,
        description="Audiogram test results"
    )
    speech_scores: Optional[SpeechScores] = Field(
        None,
        description="Speech recognition and threshold scores"
    )
    hearing_loss_type: Optional[str] = Field(
        None,
        description="Type of hearing loss (e.g., 'Sensorineural', 'Conductive', 'Mixed')"
    )
    hearing_loss_severity: Optional[str] = Field(
        None,
        description="Severity classification (e.g., 'Mild', 'Moderate', 'Severe', 'Profound')"
    )
    hearing_trend: Optional[str] = Field(
        None,
        description="Hearing trend over time: IMPROVING, WORSENING, or STABLE"
    )
    tinnitus: Optional[bool] = Field(
        None,
        description="Presence of tinnitus"
    )
    balance_issues: Optional[bool] = Field(
        None,
        description="Presence of balance or vestibular issues"
    )
    amplification: Optional[str] = Field(
        None,
        description="Current amplification device (e.g., 'Hearing Aid', 'Cochlear Implant', 'None')"
    )
    pertinent_negatives: Optional[List[str]] = Field(
        None,
        description="Audiology findings that are absent (e.g., 'No conductive loss', 'No middle ear pathology')"
    )


# ============================================================================
# CARDIOLOGY SPECIALTY DATA (EXAMPLE - EXPANDABLE)
# ============================================================================

class CardiologyData(BaseModel):
    """
    Cardiology-specific patient data.
    Null if patient is not a cardiology case.
    """
    ejection_fraction: Optional[float] = Field(
        None,
        description="Left ventricular ejection fraction (percentage)",
        ge=0,
        le=100
    )
    nyha_class: Optional[str] = Field(
        None,
        description="NYHA heart failure classification (I, II, III, IV)"
    )
    blood_pressure_trend: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Historical BP readings [{date, systolic, diastolic}]"
    )
    ecg_findings: Optional[List[str]] = Field(
        None,
        description="Key ECG findings"
    )
    medications: Optional[List[str]] = Field(
        None,
        description="Current cardiac medications"
    )


# ============================================================================
# MAIN AI RESPONSE SCHEMA
# ============================================================================

class AIResponseSchema(BaseModel):
    """
    Complete AI response structure for patient summaries.
    
    This is the top-level schema that the AI must return.
    Frontend can safely access any field knowing the structure is validated.
    
    Usage in backend:
        validated_response = AIResponseSchema.model_validate(ai_output)
        return validated_response.model_dump(exclude_none=True)
    """
    universal: UniversalData = Field(
        ...,
        description="Universal patient data (required for all patients)"
    )
    
    # Specialty sections - null if not applicable
    oncology: Optional[OncologyData] = Field(
        None,
        description="Oncology-specific data (null if not an oncology patient)"
    )
    speech: Optional[SpeechData] = Field(
        None,
        description="Speech/Audiology data (null if not a speech patient)"
    )
    cardiology: Optional[CardiologyData] = Field(
        None,
        description="Cardiology data (null if not a cardiology patient)"
    )
    
    # Metadata
    generated_at: Optional[str] = Field(
        None,
        description="Timestamp when this summary was generated (ISO format)"
    )
    patient_id: Optional[int] = Field(
        None,
        description="Patient ID this summary belongs to"
    )
    specialty: Optional[str] = Field(
        None,
        description="Primary specialty classification (e.g., 'oncology', 'speech', 'general')"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "universal": {
                    "evolution": "Patient diagnosed with early-stage breast cancer, currently undergoing adjuvant chemotherapy with good tolerance.",
                    "current_status": [
                        "Post-lumpectomy, healing well",
                        "Cycle 3 of AC-T chemotherapy",
                        "Mild fatigue, manageable nausea"
                    ],
                    "plan": [
                        "Complete remaining 3 cycles of chemotherapy",
                        "Schedule radiation oncology consult",
                        "Monitor CBC weekly",
                        "Follow-up appointment in 3 weeks"
                    ]
                },
                "oncology": {
                    "tumor_size_trend": [
                        {"date": "2024-01-15", "size_cm": 2.3},
                        {"date": "2024-03-20", "size_cm": 1.8},
                        {"date": "2024-06-10", "size_cm": 1.2}
                    ],
                    "tnm_staging": "T1N0M0",
                    "cancer_type": "Invasive Ductal Carcinoma",
                    "grade": "Grade 2",
                    "biomarkers": {
                        "ER": "positive",
                        "PR": "positive",
                        "HER2": "negative"
                    },
                    "treatment_response": "Partial Response"
                },
                "speech": None,
                "cardiology": None,
                "generated_at": "2024-12-01T14:30:00Z",
                "patient_id": 123,
                "specialty": "oncology"
            }
        }


# ============================================================================
# CHAT RESPONSE SCHEMA
# ============================================================================

class ChatResponseSchema(BaseModel):
    """
    Structured response for chat endpoint.
    Ensures chat responses have consistent format with optional citations.
    """
    response: str = Field(..., description="AI-generated response text")
    citations: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Source citations for the response"
    )
    confidence: Optional[float] = Field(
        None,
        description="Confidence score for the response (0.0 to 1.0)",
        ge=0.0,
        le=1.0
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "response": "Based on the latest lab results, the patient's hemoglobin is 11.2 g/dL, which is slightly below normal range. This is common during chemotherapy.",
                "citations": [
                    {
                        "id": 456,
                        "type": "lab_report",
                        "date": "2024-11-28",
                        "excerpt": "Hemoglobin: 11.2 g/dL"
                    }
                ],
                "confidence": 0.92
            }
        }


# ============================================================================
# EXPORT ALL SCHEMAS
# ============================================================================

__all__ = [
    # Main schemas
    "AIResponseSchema",
    "ChatResponseSchema",
    
    # Universal
    "UniversalData",
    
    # Specialty data
    "OncologyData",
    "TumorSizeMeasurement",
    "SpeechData",
    "Audiogram",
    "AudiogramFrequency",
    "SpeechScores",
    "CardiologyData",
]
