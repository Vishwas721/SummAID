"""
Test script for validating SummAID schemas.

Run this to verify schemas work correctly and see example usage.

Usage:
    cd C:\\SummAID\\backend
    python test_schemas.py
"""

import json
from datetime import datetime
from schemas import (
    AIResponseSchema,
    ChatResponseSchema,
    UniversalData,
    OncologyData,
    SpeechData,
    TumorSizeMeasurement,
    Audiogram,
    AudiogramFrequency,
    SpeechScores
)


def test_minimal_valid_response():
    """Test minimal valid AI response (just universal data)."""
    print("\n" + "="*60)
    print("TEST 1: Minimal Valid Response")
    print("="*60)
    
    data = {
        "universal": {
            "evolution": "Patient presented with chest pain, diagnosed with stable angina.",
            "current_status": ["Stable on medications", "No acute symptoms"],
            "plan": ["Continue current medications", "Follow-up in 2 weeks"]
        }
    }
    
    try:
        validated = AIResponseSchema.model_validate(data)
        print("✓ Validation successful!")
        print("\nClean JSON output:")
        print(validated.model_dump_json(indent=2, exclude_none=True))
        return True
    except Exception as e:
        print(f"✗ Validation failed: {e}")
        return False


def test_oncology_patient():
    """Test complete oncology patient response."""
    print("\n" + "="*60)
    print("TEST 2: Oncology Patient with Full Data")
    print("="*60)
    
    data = {
        "universal": {
            "evolution": "62-year-old female with invasive ductal carcinoma, post-lumpectomy, currently on cycle 4/6 of AC-T chemotherapy.",
            "current_status": [
                "Post-surgical site healing well",
                "Tolerating chemotherapy with manageable side effects",
                "Mild peripheral neuropathy noted",
                "CBC stable, WBC within normal limits"
            ],
            "plan": [
                "Complete remaining 2 cycles of chemotherapy",
                "Schedule radiation oncology consultation",
                "Continue antiemetic prophylaxis",
                "Monitor for neuropathy progression",
                "Repeat imaging in 4 weeks"
            ]
        },
        "oncology": {
            "tumor_size_trend": [
                {"date": "2024-01-15", "size_cm": 2.8},
                {"date": "2024-04-10", "size_cm": 2.1},
                {"date": "2024-07-22", "size_cm": 1.5},
                {"date": "2024-10-05", "size_cm": 0.9}
            ],
            "tnm_staging": "T2N0M0",
            "cancer_type": "Invasive Ductal Carcinoma",
            "grade": "Grade 2, Moderately Differentiated",
            "biomarkers": {
                "ER": "Positive (95%)",
                "PR": "Positive (80%)",
                "HER2": "Negative",
                "Ki-67": "18%"
            },
            "treatment_response": "Partial Response (30% reduction in tumor size)"
        },
        "speech": None,
        "cardiology": None,
        "generated_at": datetime.now().isoformat(),
        "patient_id": 101,
        "specialty": "oncology"
    }
    
    try:
        validated = AIResponseSchema.model_validate(data)
        print("✓ Validation successful!")
        print("\nOncology-specific data:")
        print(f"  TNM Staging: {validated.oncology.tnm_staging}")
        print(f"  Cancer Type: {validated.oncology.cancer_type}")
        print(f"  Tumor measurements: {len(validated.oncology.tumor_size_trend)} data points")
        print(f"  Latest size: {validated.oncology.tumor_size_trend[-1].size_cm} cm")
        print("\nClean JSON output:")
        print(validated.model_dump_json(indent=2, exclude_none=True))
        return True
    except Exception as e:
        print(f"✗ Validation failed: {e}")
        return False


def test_speech_patient():
    """Test speech/audiology patient response."""
    print("\n" + "="*60)
    print("TEST 3: Speech/Audiology Patient")
    print("="*60)
    
    data = {
        "universal": {
            "evolution": "45-year-old male with progressive bilateral sensorineural hearing loss over 3 years.",
            "current_status": [
                "Moderate hearing loss bilaterally",
                "Tinnitus present in both ears",
                "No balance issues reported",
                "Good candidate for hearing aids"
            ],
            "plan": [
                "Fit bilateral hearing aids",
                "Hearing aid orientation session scheduled",
                "Follow-up audiogram in 6 months",
                "Tinnitus management counseling"
            ]
        },
        "oncology": None,
        "speech": {
            "audiogram": {
                "left": {
                    "500Hz": 45,
                    "1000Hz": 50,
                    "2000Hz": 55,
                    "4000Hz": 60,
                    "8000Hz": 65
                },
                "right": {
                    "500Hz": 40,
                    "1000Hz": 48,
                    "2000Hz": 52,
                    "4000Hz": 58,
                    "8000Hz": 62
                },
                "test_date": "2024-11-15"
            },
            "speech_scores": {
                "srt_db": 45,
                "wrs_percent": 82,
                "mcl_db": 65,
                "ucl_db": 95
            },
            "hearing_loss_type": "Sensorineural",
            "hearing_loss_severity": "Moderate",
            "tinnitus": True,
            "balance_issues": False,
            "amplification": "Bilateral Hearing Aids Recommended"
        },
        "generated_at": datetime.now().isoformat(),
        "patient_id": 202,
        "specialty": "speech"
    }
    
    try:
        validated = AIResponseSchema.model_validate(data)
        print("✓ Validation successful!")
        print("\nSpeech/Audiology data:")
        print(f"  Hearing loss: {validated.speech.hearing_loss_severity} {validated.speech.hearing_loss_type}")
        print(f"  SRT: {validated.speech.speech_scores.srt_db} dB")
        print(f"  WRS: {validated.speech.speech_scores.wrs_percent}%")
        print(f"  Tinnitus: {'Yes' if validated.speech.tinnitus else 'No'}")
        print("\nLeft ear thresholds:")
        left = validated.speech.audiogram.left
        for freq in ['500Hz', '1000Hz', '2000Hz', '4000Hz', '8000Hz']:
            val = getattr(left, f"freq_{freq.lower()}", None)
            if val:
                print(f"  {freq}: {val} dB HL")
        print("\nClean JSON output:")
        print(validated.model_dump_json(indent=2, exclude_none=True))
        return True
    except Exception as e:
        print(f"✗ Validation failed: {e}")
        return False


def test_chat_response():
    """Test chat response schema."""
    print("\n" + "="*60)
    print("TEST 4: Chat Response")
    print("="*60)
    
    data = {
        "response": "Based on the latest imaging from November 28th, the tumor has shown a 25% reduction in size compared to the previous scan. This indicates a partial response to the current chemotherapy regimen. The patient's treatment plan should continue as scheduled.",
        "citations": [
            {
                "id": 1234,
                "type": "radiology_report",
                "date": "2024-11-28",
                "excerpt": "Tumor dimensions: 1.5 x 1.2 x 0.8 cm (previously 2.0 x 1.6 x 1.1 cm)"
            },
            {
                "id": 1235,
                "type": "oncology_note",
                "date": "2024-11-29",
                "excerpt": "Patient tolerating chemotherapy well, partial response noted on imaging"
            }
        ],
        "confidence": 0.94
    }
    
    try:
        validated = ChatResponseSchema.model_validate(data)
        print("✓ Validation successful!")
        print(f"\nResponse preview: {validated.response[:100]}...")
        print(f"Citations: {len(validated.citations)}")
        print(f"Confidence: {validated.confidence:.2%}")
        print("\nClean JSON output:")
        print(validated.model_dump_json(indent=2, exclude_none=True))
        return True
    except Exception as e:
        print(f"✗ Validation failed: {e}")
        return False


def test_invalid_data():
    """Test that invalid data raises validation errors."""
    print("\n" + "="*60)
    print("TEST 5: Invalid Data (Should Fail)")
    print("="*60)
    
    # Missing required universal field
    data = {
        "oncology": {
            "tnm_staging": "T2N0M0"
        }
    }
    
    try:
        validated = AIResponseSchema.model_validate(data)
        print("✗ Should have failed but didn't!")
        return False
    except Exception as e:
        print(f"✓ Correctly rejected invalid data")
        print(f"  Error: {str(e)[:150]}...")
        return True


def test_json_schema_export():
    """Export JSON schema for API documentation."""
    print("\n" + "="*60)
    print("TEST 6: JSON Schema Export (for API docs)")
    print("="*60)
    
    schema = AIResponseSchema.model_json_schema()
    print("✓ Schema exported successfully")
    print(f"\nSchema has {len(schema['properties'])} top-level properties:")
    for prop in schema['properties'].keys():
        print(f"  - {prop}")
    
    # Save to file for reference
    with open('ai_response_schema.json', 'w') as f:
        json.dump(schema, f, indent=2)
    print("\n✓ Full schema saved to: ai_response_schema.json")
    return True


def run_all_tests():
    """Run all test cases."""
    print("\n" + "="*80)
    print(" "*20 + "SUMMAID SCHEMA VALIDATION TESTS")
    print("="*80)
    
    tests = [
        test_minimal_valid_response,
        test_oncology_patient,
        test_speech_patient,
        test_chat_response,
        test_invalid_data,
        test_json_schema_export
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"\n✗ Test crashed: {e}")
            results.append(False)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 All tests passed! Schemas are ready to use.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review errors above.")
    
    print("\nNext steps:")
    print("1. Review SCHEMAS_INTEGRATION_GUIDE.md for usage instructions")
    print("2. Update AI prompts to request JSON output matching these schemas")
    print("3. Add validation to /summarize and /chat endpoints")
    print("4. Update frontend to consume structured data")
    print("\n" + "="*80 + "\n")


if __name__ == "__main__":
    run_all_tests()
