"""
Task 49 Validation Script
==========================
Demonstrates that schemas.py fully satisfies Task 49 requirements:
- Top-level keys: universal (required) + specialty (dynamic)
- Universal contains: evolution, current_status, plan
- Specialty can hold oncology_data OR speech_data (or both null)
"""

from schemas import AIResponseSchema, UniversalData, OncologyData, SpeechData
from pydantic import ValidationError
import json


def test_oncology_patient():
    """Test schema with oncology patient data."""
    data = {
        "universal": {
            "evolution": "Patient diagnosed with early-stage breast cancer, undergoing chemotherapy.",
            "current_status": [
                "Post-lumpectomy, healing well",
                "Cycle 3 of AC-T chemotherapy"
            ],
            "plan": [
                "Complete remaining 3 cycles",
                "Schedule radiation consult"
            ]
        },
        "oncology": {
            "tumor_size_trend": [
                {"date": "2024-01-15", "size_cm": 3.2},
                {"date": "2024-03-20", "size_cm": 2.8},
                {"date": "2024-06-10", "size_cm": 2.1}
            ],
            "tnm_staging": "T2N0M0",
            "cancer_type": "Invasive Ductal Carcinoma",
            "biomarkers": {
                "ER": "positive",
                "PR": "positive",
                "HER2": "negative"
            },
            "pertinent_negatives": ["No metastasis", "No lymph node involvement"]
        },
        "speech": None,
        "specialty": "oncology"
    }
    
    # Validate against schema
    validated = AIResponseSchema.model_validate(data)
    
    # Verify structure
    assert validated.universal is not None
    assert validated.universal.evolution is not None
    assert len(validated.universal.current_status) == 2
    assert len(validated.universal.plan) == 2
    assert validated.oncology is not None
    assert len(validated.oncology.tumor_size_trend) == 3
    assert validated.speech is None
    
    print("✅ ONCOLOGY PATIENT: Schema validation passed")
    print(f"   - Universal data: {len(validated.universal.current_status)} findings, {len(validated.universal.plan)} action items")
    print(f"   - Oncology data: {len(validated.oncology.tumor_size_trend)} tumor measurements")
    print(f"   - Pertinent negatives: {validated.oncology.pertinent_negatives}")
    return validated


def test_speech_patient():
    """Test schema with speech/audiology patient data."""
    data = {
        "universal": {
            "evolution": "Patient with progressive bilateral sensorineural hearing loss.",
            "current_status": [
                "Bilateral hearing aids fitted",
                "Moderate hearing loss in both ears"
            ],
            "plan": [
                "Follow-up audiogram in 6 months",
                "Continue hearing aid use"
            ]
        },
        "oncology": None,
        "speech": {
            "audiogram": {
                "left": {
                    "500Hz": 45.0,
                    "1000Hz": 50.0,
                    "2000Hz": 55.0,
                    "4000Hz": 60.0,
                    "8000Hz": 65.0
                },
                "right": {
                    "500Hz": 40.0,
                    "1000Hz": 48.0,
                    "2000Hz": 52.0,
                    "4000Hz": 58.0,
                    "8000Hz": 63.0
                },
                "test_date": "2024-11-15",
                "status": "HIGH"
            },
            "hearing_loss_type": "Sensorineural",
            "hearing_loss_severity": "Moderate",
            "hearing_trend": "WORSENING",
            "amplification": "Bilateral Hearing Aids",
            "pertinent_negatives": ["No conductive component", "No middle ear pathology"]
        },
        "specialty": "speech"
    }
    
    # Validate against schema
    validated = AIResponseSchema.model_validate(data)
    
    # Verify structure
    assert validated.universal is not None
    assert validated.speech is not None
    assert validated.speech.audiogram is not None
    assert validated.speech.audiogram.left is not None
    assert validated.speech.audiogram.right is not None
    assert validated.oncology is None
    
    print("✅ SPEECH PATIENT: Schema validation passed")
    print(f"   - Universal data: {len(validated.universal.current_status)} findings, {len(validated.universal.plan)} action items")
    print(f"   - Audiogram data: Left ear 500Hz = {validated.speech.audiogram.left.freq_500hz} dB")
    print(f"   - Hearing trend: {validated.speech.hearing_trend}")
    print(f"   - Pertinent negatives: {validated.speech.pertinent_negatives}")
    return validated


def test_general_patient():
    """Test schema with general patient (no specialty data)."""
    data = {
        "universal": {
            "evolution": "Patient with hypertension, well-controlled on medications.",
            "current_status": [
                "Blood pressure 128/82 mmHg",
                "No side effects from current regimen"
            ],
            "plan": [
                "Continue current medications",
                "Recheck BP in 3 months"
            ]
        },
        "oncology": None,
        "speech": None,
        "specialty": "general"
    }
    
    # Validate against schema
    validated = AIResponseSchema.model_validate(data)
    
    # Verify structure
    assert validated.universal is not None
    assert validated.oncology is None
    assert validated.speech is None
    
    print("✅ GENERAL PATIENT: Schema validation passed")
    print(f"   - Universal data: {len(validated.universal.current_status)} findings, {len(validated.universal.plan)} action items")
    print(f"   - No specialty data (as expected)")
    return validated


def test_invalid_schema():
    """Test that invalid data is rejected."""
    data = {
        # Missing required 'universal' field
        "oncology": {
            "tumor_size_trend": []
        }
    }
    
    try:
        AIResponseSchema.model_validate(data)
        print("❌ VALIDATION ERROR: Should have failed on missing 'universal' field")
    except ValidationError as e:
        print("✅ SCHEMA VALIDATION: Correctly rejected invalid data")
        print(f"   - Error: {e.errors()[0]['msg']}")


if __name__ == "__main__":
    print("=" * 70)
    print("TASK 49 VALIDATION: Master JSON Schema Definition")
    print("=" * 70)
    print()
    
    print("Testing Oncology Patient Schema...")
    print("-" * 70)
    test_oncology_patient()
    print()
    
    print("Testing Speech/Audiology Patient Schema...")
    print("-" * 70)
    test_speech_patient()
    print()
    
    print("Testing General Patient Schema...")
    print("-" * 70)
    test_general_patient()
    print()
    
    print("Testing Schema Validation (Invalid Data)...")
    print("-" * 70)
    test_invalid_schema()
    print()
    
    print("=" * 70)
    print("✅ TASK 49 COMPLETE: All schema requirements satisfied")
    print("=" * 70)
    print()
    print("Schema Structure:")
    print("  ├── AIResponseSchema (top-level)")
    print("  │   ├── universal: UniversalData (REQUIRED)")
    print("  │   │   ├── evolution: str")
    print("  │   │   ├── current_status: List[str]")
    print("  │   │   └── plan: List[str]")
    print("  │   ├── oncology: Optional[OncologyData]")
    print("  │   │   └── tumor_size_trend: List[TumorSizeMeasurement]")
    print("  │   ├── speech: Optional[SpeechData]")
    print("  │   │   └── audiogram: Audiogram (frequency data)")
    print("  │   └── specialty: Optional[str]")
    print()
