"""
Quick test script to verify GET /reports/{patient_id} endpoint refactor.
Usage: python test_reports_endpoint.py
"""
import requests
import sys

BASE_URL = "http://localhost:8001"

def test_reports_endpoint():
    """Test the refactored /reports/{patient_id} endpoint."""
    print("Testing GET /reports/{patient_id} endpoint...")
    print("-" * 60)
    
    # Test with patient_id=1 (should be Jane Doe if seeded)
    patient_id = 1
    url = f"{BASE_URL}/reports/{patient_id}"
    
    print(f"Request: GET {url}")
    try:
        response = requests.get(url, timeout=5)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Success! Found {len(data)} report(s)")
            print("\nResponse structure:")
            for i, report in enumerate(data, 1):
                print(f"\nReport {i}:")
                print(f"  report_id: {report.get('report_id')}")
                print(f"  filepath: {report.get('filepath')}")
                print(f"  filename: {report.get('filename')}")
                print(f"  report_type: {report.get('report_type')}")
            
            # Verify required fields
            for report in data:
                assert 'report_id' in report, "Missing report_id"
                assert 'filepath' in report, "Missing filepath"
            print("\n✓ All required fields present")
            return True
        else:
            print(f"✗ Error: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("✗ Connection failed. Is the backend running on port 8001?")
        return False
    except Exception as e:
        print(f"✗ Test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_reports_endpoint()
    sys.exit(0 if success else 1)
