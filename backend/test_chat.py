"""
Quick test script for the /chat endpoint.
Run the backend server first: uvicorn main:app --reload
"""
import requests
import json

BASE_URL = "http://localhost:8001"  # Using port 8001 as server is running there

def get_patients():
    """Fetch list of patients to find valid patient_id"""
    print("Fetching available patients...")
    response = requests.get(f"{BASE_URL}/patients")
    if response.status_code == 200:
        patients = response.json()
        print(f"Found {len(patients)} patients:")
        for p in patients:
            print(f"  - ID: {p['patient_id']}, Name: {p['patient_display_name']}")
        return patients
    else:
        print(f"Error fetching patients: {response.text}")
        return []

def test_chat():
    # First get available patients
    patients = get_patients()
    if not patients:
        print("\nNo patients found. Run seed.py first.")
        return
    
    # Use the first available patient
    patient_id = patients[0]['patient_id']
    patient_name = patients[0]['patient_display_name']
    print(f"\n{'='*60}")
    print(f"Testing with Patient: {patient_name} (ID: {patient_id})")
    print(f"{'='*60}\n")
    
    # Test question about tumor size trend
    question = "What is the trend in tumor size?"
    
    print(f"Testing /chat endpoint with patient_id={patient_id}")
    print(f"Question: {question}\n")
    
    response = requests.post(
        f"{BASE_URL}/chat/{patient_id}",
        json={
            "question": question,
            "max_chunks": 15,
            "max_context_chars": 12000
        }
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\nAnswer:\n{data.get('answer', 'No answer')}\n")
        print(f"Number of citations: {len(data.get('citations', []))}")
        
        if data.get('citations'):
            print("\nFirst citation preview:")
            first = data['citations'][0]
            print(f"  Report ID: {first.get('report_id')}")
            print(f"  Chunk ID: {first.get('source_chunk_id')}")
            print(f"  Preview: {first.get('source_text_preview', '')[:100]}...")
    else:
        print(f"Error: {response.text}")

def test_another_question(patient_id):
    question = "What were the white blood cell counts?"
    
    print(f"\n{'='*60}")
    print(f"Testing second question with patient_id={patient_id}")
    print(f"Question: {question}\n")
    
    response = requests.post(
        f"{BASE_URL}/chat/{patient_id}",
        json={
            "question": question,
            "max_chunks": 15
        }
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\nAnswer:\n{data.get('answer', 'No answer')}\n")
        print(f"Number of citations: {len(data.get('citations', []))}")
    else:
        print(f"Error: {response.text}")

if __name__ == "__main__":
    try:
        patients = get_patients()
        if patients:
            patient_id = patients[0]['patient_id']
            test_chat()
            test_another_question(patient_id)
        else:
            print("\nNo patients found. Please run: python seed.py")
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to backend. Make sure the server is running:")
        print("  cd backend && uvicorn main:app --reload")
    except Exception as e:
        print(f"Error: {e}")
