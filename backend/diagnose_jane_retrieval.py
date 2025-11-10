"""
Diagnostic script to analyze chunk retrieval for Jane (patient_id=5)
Shows which chunks are retrieved, their similarity scores, and preview content
"""
import os
import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv()

# Get encryption key
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', 'my-secret-key-for-demo-only')
def _sanitize_key(key: str) -> str:
    if key.startswith('"') and key.endswith('"'):
        key = key[1:-1]
    return key.replace('\\n', '\n').replace('\\t', '\t')

ENCRYPTION_KEY = _sanitize_key(ENCRYPTION_KEY)

# Database connection
conn = psycopg2.connect('dbname=summaid user=postgres password=1234 host=localhost port=5432')

patient_id = 5

print(f"=== Analyzing retrieval for patient_id={patient_id} (Jane) ===\n")

# 1. Get patient's reports
cur = conn.cursor()
cur.execute("SELECT report_id, report_filepath_pointer, report_type FROM reports WHERE patient_id = %s", (patient_id,))
reports_raw = cur.fetchall()
reports = []
for rid, fpath, rtype in reports_raw:
    fname = os.path.basename(fpath) if fpath else f"report_{rid}.pdf"
    reports.append((rid, fname, rtype))
print(f"Reports ({len(reports)}):")
for rid, fname, rtype in reports:
    print(f"  - report_id={rid}, filename={fname}, type={rtype}")
    
report_ids = [r[0] for r in reports]
print(f"\nReport IDs: {report_ids}\n")

# 2. Get embedding for a generic query
query_text = "What are the key clinical findings?"
ollama_url = 'http://localhost:11434/api/embeddings'
embed_response = requests.post(
    ollama_url,
    json={'model': 'nomic-embed-text', 'prompt': query_text}
)
embedding = embed_response.json()['embedding']
print(f"Query: '{query_text}'")
print(f"Embedding dimension: {len(embedding)}\n")

# 3. Run similarity search (matching backend logic)
placeholders = ','.join(['%s'] * len(report_ids))
similarity_sql = f"""
    SELECT
        chunk_id,
        report_id,
        pgp_sym_decrypt(chunk_text_encrypted::bytea, %s) AS decrypted_text,
        source_metadata,
        1 - (report_vector <=> %s) AS similarity_score
    FROM report_chunks
    WHERE report_id IN ({placeholders})
    ORDER BY similarity_score DESC
    LIMIT 20
"""
params = [ENCRYPTION_KEY, str(embedding)] + report_ids
cur.execute(similarity_sql, params)
chunks = cur.fetchall()

print(f"=== Top {len(chunks)} chunks by similarity ===\n")
for idx, (chunk_id, report_id, text, meta, score) in enumerate(chunks, 1):
    # Get report filename
    report_name = next((fname for rid, fname, _ in reports if rid == report_id), f"report_{report_id}")
    preview = text[:150].replace('\n', ' ') if text else '(empty)'
    page = meta.get('page', '?') if meta else '?'
    chunk_index = meta.get('chunk_index', '?') if meta else '?'
    print(f"{idx}. chunk_id={chunk_id}, report={report_name}, page={page}, score={score:.4f}")
    print(f"   chunk_index={chunk_index}")
    print(f"   Preview: {preview}...")
    print()

# 4. Check if "bilobed paramedial extra-axial mass" appears in any chunks
print("=== Searching for 'bilobed paramedial extra-axial mass' ===\n")
search_sql = f"""
    SELECT
        chunk_id,
        report_id,
        pgp_sym_decrypt(chunk_text_encrypted::bytea, %s) AS decrypted_text,
        source_metadata
    FROM report_chunks
    WHERE report_id IN ({placeholders})
    AND LOWER(pgp_sym_decrypt(chunk_text_encrypted::bytea, %s)::text) LIKE %s
"""
search_params = [ENCRYPTION_KEY] + report_ids + [ENCRYPTION_KEY, '%bilobed%']
cur.execute(search_sql, search_params)
bilobed_chunks = cur.fetchall()

if bilobed_chunks:
    print(f"Found {len(bilobed_chunks)} chunks containing 'bilobed':\n")
    for chunk_id, report_id, text, meta in bilobed_chunks:
        report_name = next((fname for rid, fname, _ in reports if rid == report_id), f"report_{report_id}")
        page = meta.get('page', '?') if meta else '?'
        chunk_index = meta.get('chunk_index', '?') if meta else '?'
        # Find the sentence with "bilobed"
        text_lower = text.lower()
        idx = text_lower.find('bilobed')
        if idx != -1:
            start = max(0, idx - 100)
            end = min(len(text), idx + 200)
            excerpt = text[start:end].replace('\n', ' ')
            print(f"chunk_id={chunk_id}, report={report_name}, page={page}, chunk_index={chunk_index}")
            print(f"Context: ...{excerpt}...")
            print()
else:
    print("❌ 'bilobed' not found in any chunks for this patient!\n")

# 5. Check what's in the brain report specifically
print("=== Brain report chunks ===\n")
brain_report = next((rid for rid, fname, rtype in reports if 'brain' in fname.lower() or 'head' in fname.lower() or rtype == 'MRI Brain'), None)
if brain_report:
    cur.execute(
        "SELECT chunk_id, pgp_sym_decrypt(chunk_text_encrypted::bytea, %s) AS text, source_metadata FROM report_chunks WHERE report_id = %s ORDER BY chunk_id",
        (ENCRYPTION_KEY, brain_report)
    )
    brain_chunks = cur.fetchall()
    print(f"Brain report (report_id={brain_report}) has {len(brain_chunks)} chunks:\n")
    for chunk_id, text, meta in brain_chunks[:5]:  # Show first 5
        page = meta.get('page', '?') if meta else '?'
        chunk_index = meta.get('chunk_index', '?') if meta else '?'
        preview = text[:200].replace('\n', ' ') if text else '(empty)'
        print(f"chunk {chunk_index} (id={chunk_id}, page={page}):")
        print(f"  {preview}...")
        print()
else:
    print("No brain report found")

cur.close()
conn.close()
print("\n=== Analysis complete ===")
