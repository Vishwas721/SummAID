"""
Quick test for POST /summarize/{patient_id} endpoint.
Usage: python test_summarize_by_id.py 5
"""
import sys
import requests

BASE_URL = "http://localhost:8001"

def main():
    pid = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    url = f"{BASE_URL}/summarize/{pid}"
    print(f"POST {url}")
    try:
        resp = requests.post(url, json={
            "keywords": None,
            "max_chunks": 8,
            "max_context_chars": 8000
        }, timeout=120)
        print("Status:", resp.status_code)
        if resp.status_code != 200:
            print(resp.text)
            sys.exit(1)
        data = resp.json()
        summary = data.get('summary_text', '')
        citations = data.get('citations', [])
        print(f"Summary length: {len(summary)}")
        print(f"Citations: {len(citations)}")
        if citations:
            print("First citation preview:", citations[0].get('source_text_preview', '')[:120])
    except Exception as e:
        print("Error:", e)
        sys.exit(2)

if __name__ == "__main__":
    main()
