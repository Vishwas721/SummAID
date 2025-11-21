"""
Test script for annotation endpoints
Tests POST /annotate and GET /annotations/{patient_id}
"""
import requests
import json

BASE_URL = "http://localhost:8001"

def test_annotations():
    print("=== Testing Annotation Endpoints ===\n")
    
    # 1. Get available patients
    print("1. Fetching available patients...")
    try:
        response = requests.get(f"{BASE_URL}/patients")
        patients = response.json()
        if not patients:
            print("❌ No patients found. Please seed database first.")
            return
        patient_id = patients[0]['patient_id']
        patient_name = patients[0]['patient_display_name']
        print(f"✅ Using patient ID {patient_id} ({patient_name})\n")
    except Exception as e:
        print(f"❌ Error fetching patients: {e}")
        return
    
    # 2. Create first annotation
    print("2. Creating first annotation...")
    annotation1 = {
        "patient_id": patient_id,
        "doctor_note": "Patient shows significant improvement in mobility. Continue current treatment plan."
    }
    try:
        response = requests.post(f"{BASE_URL}/annotate", json=annotation1)
        response.raise_for_status()
        result1 = response.json()
        print(f"✅ Created annotation {result1['annotation_id']}")
        print(f"   Note: {result1['doctor_note']}")
        print(f"   Created at: {result1['created_at']}\n")
    except Exception as e:
        print(f"❌ Error creating annotation: {e}")
        return
    
    # 3. Create second annotation
    print("3. Creating second annotation...")
    annotation2 = {
        "patient_id": patient_id,
        "doctor_note": "Follow-up scheduled for next week. Monitor pain levels and adjust medication if needed."
    }
    try:
        response = requests.post(f"{BASE_URL}/annotate", json=annotation2)
        response.raise_for_status()
        result2 = response.json()
        print(f"✅ Created annotation {result2['annotation_id']}")
        print(f"   Note: {result2['doctor_note']}")
        print(f"   Created at: {result2['created_at']}\n")
    except Exception as e:
        print(f"❌ Error creating second annotation: {e}")
        return
    
    # 4. Fetch all annotations for patient
    print(f"4. Fetching all annotations for patient {patient_id}...")
    try:
        response = requests.get(f"{BASE_URL}/annotations/{patient_id}")
        response.raise_for_status()
        annotations = response.json()
        print(f"✅ Retrieved {len(annotations)} annotation(s):\n")
        for ann in annotations:
            print(f"   ID: {ann['annotation_id']}")
            print(f"   Note: {ann['doctor_note']}")
            print(f"   Created: {ann['created_at']}")
            print()
    except Exception as e:
        print(f"❌ Error fetching annotations: {e}")
        return
    
    # 5. Test with non-existent patient
    print("5. Testing with non-existent patient (should fail)...")
    try:
        response = requests.post(
            f"{BASE_URL}/annotate",
            json={"patient_id": 99999, "doctor_note": "Test note"}
        )
        if response.status_code == 404:
            print("✅ Correctly returned 404 for non-existent patient\n")
        else:
            print(f"⚠️ Expected 404 but got {response.status_code}\n")
    except Exception as e:
        print(f"❌ Error during validation test: {e}")
    
    print("=== Annotation Tests Complete ===")

if __name__ == "__main__":
    test_annotations()
