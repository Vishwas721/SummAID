import psycopg2

conn = psycopg2.connect('dbname=summaid user=postgres password=1234 host=localhost port=5432')
cur = conn.cursor()

print("=== Chunk 57 (FINDINGS with bilobed) ===")
cur.execute('SELECT pgp_sym_decrypt(chunk_text_encrypted, %s), source_metadata FROM report_chunks WHERE chunk_id=57', ('my-secret-key-for-demo-only',))
row = cur.fetchone()
print(row[0])
print(f"\nMetadata: {row[1]}\n")

print("\n=== Chunk 63 (IMPRESSION with bilobed) ===")
cur.execute('SELECT pgp_sym_decrypt(chunk_text_encrypted, %s), source_metadata FROM report_chunks WHERE chunk_id=63', ('my-secret-key-for-demo-only',))
row = cur.fetchone()
print(row[0])
print(f"\nMetadata: {row[1]}\n")

cur.close()
conn.close()
