"""
Test actual summarize endpoint for Jane to see what chunks are used
"""
import requests
import json

url = "http://localhost:8001/summarize/5"
payload = {
    "keywords": None,
    "max_chunks": 12,
    "max_context_chars": 12000
}

print(f"Testing {url}")
print(f"Payload: {json.dumps(payload, indent=2)}\n")

response = requests.post(url, json=payload)
print(f"Status: {response.status_code}\n")

if response.status_code == 200:
    data = response.json()
    summary = data.get('summary_text', '')
    citations = data.get('citations', [])
    
    print(f"=== Summary ({len(summary)} chars) ===")
    print(summary)
    print(f"\n=== Citations ({len(citations)}) ===")
    
    for i, cit in enumerate(citations, 1):
        chunk_id = cit['source_chunk_id']
        report_id = cit['report_id']
        meta = cit.get('source_metadata', {})
        page = meta.get('page', '?')
        chunk_idx = meta.get('chunk_index', '?')
        preview = cit['source_text_preview'][:100]
        
        print(f"\n{i}. chunk_id={chunk_id}, report_id={report_id}, page={page}, chunk_idx={chunk_idx}")
        print(f"   Preview: {preview}...")
        
        # Check if this chunk contains critical findings
        full_text = cit.get('source_full_text', '').lower()
        if 'bilobed' in full_text:
            print("   ⭐ CONTAINS 'bilobed' - PRIMARY FINDING!")
        if 'extra-axial mass' in full_text and 'prominent' in full_text:
            print("   ⭐ CONTAINS primary mass description!")
        if 'impression' in full_text.lower()[:50]:
            print("   📋 IMPRESSION section")
        if 'findings' in full_text.lower()[:50]:
            print("   📋 FINDINGS section")
else:
    print(f"Error: {response.text}")
