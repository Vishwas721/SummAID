"""
Test improved retrieval for Jane with structured section detection
"""
import requests
import json

url = "http://localhost:8001/summarize/5"
payload = {
    "keywords": None,
    "max_chunks": 20,
    "max_context_chars": 16000
}

print(f"Testing IMPROVED retrieval: {url}")
print(f"Payload: {json.dumps(payload, indent=2)}\n")

response = requests.post(url, json=payload)
print(f"Status: {response.status_code}\n")

if response.status_code == 200:
    data = response.json()
    summary = data.get('summary_text', '')
    citations = data.get('citations', [])
    
    print(f"=== Summary ({len(summary)} chars) ===")
    print(summary)
    print(f"\n{'='*80}")
    print(f"=== Citations ({len(citations)}) ===\n")
    
    has_bilobed = False
    has_primary_mass = False
    findings_chunks = []
    impression_chunks = []
    
    for i, cit in enumerate(citations, 1):
        chunk_id = cit['source_chunk_id']
        report_id = cit['report_id']
        meta = cit.get('source_metadata', {})
        page = meta.get('page', '?')
        chunk_idx = meta.get('chunk_index', '?')
        preview = cit['source_text_preview'][:80]
        full_text = cit.get('source_full_text', '').lower()
        
        markers = []
        
        # Check for critical content
        if 'bilobed' in full_text:
            has_bilobed = True
            markers.append('⭐ BILOBED PRIMARY FINDING')
        if 'extra-axial mass' in full_text and 'prominent' in full_text:
            has_primary_mass = True
            markers.append('⭐ PRIMARY MASS')
        if 'findings\n' in full_text.lower()[:100]:
            findings_chunks.append(i)
            markers.append('📋 FINDINGS section')
        if 'impression\n' in full_text.lower()[:100]:
            impression_chunks.append(i)
            markers.append('📋 IMPRESSION section')
            
        print(f"{i}. chunk_id={chunk_id}, report_id={report_id}, page={page}, chunk_idx={chunk_idx}")
        print(f"   Preview: {preview}...")
        if markers:
            for m in markers:
                print(f"   {m}")
        print()
    
    print(f"{'='*80}")
    print("=== VALIDATION ===")
    print(f"✓ Contains 'bilobed' primary finding: {'YES ✓' if has_bilobed else 'NO ✗'}")
    print(f"✓ Contains primary mass description: {'YES ✓' if has_primary_mass else 'NO ✗'}")
    print(f"✓ FINDINGS sections included: {len(findings_chunks)} chunks {findings_chunks}")
    print(f"✓ IMPRESSION sections included: {len(impression_chunks)} chunks {impression_chunks}")
    
    # Check if summary mentions primary finding
    summary_lower = summary.lower()
    print(f"\n=== SUMMARY CONTENT CHECK ===")
    print(f"✓ Summary mentions 'bilobed': {'YES ✓' if 'bilobed' in summary_lower else 'NO ✗'}")
    print(f"✓ Summary mentions 'extra-axial': {'YES ✓' if 'extra-axial' in summary_lower else 'NO ✗'}")
    print(f"✓ Summary mentions 'paramedial': {'YES ✓' if 'paramedial' in summary_lower else 'NO ✗'}")
    print(f"✓ Summary mentions 'mass': {'YES ✓' if 'mass' in summary_lower else 'NO ✗'}")
    
else:
    print(f"Error: {response.text}")
