import os
import psycopg2
from dotenv import load_dotenv

# Ensure we load the same env behavior as main.py
load_dotenv(override=True)

def _sanitize_key(raw: str):
    if raw is None:
        return None
    key = raw.strip()
    if len(key) >= 2 and ((key[0] == '"' and key[-1] == '"') or (key[0] == "'" and key[-1] == "'")):
        key = key[1:-1]
    return key

DB = os.getenv('DATABASE_URL')
KEY = _sanitize_key(os.getenv('ENCRYPTION_KEY'))

print('Key length:', len(KEY) if KEY else None)

conn = psycopg2.connect(DB)
cur = conn.cursor()

try:
    cur.execute("SELECT chunk_id, octet_length(chunk_text_encrypted) FROM report_chunks LIMIT 1")
    row = cur.fetchone()
    print('Encrypted row exists:', bool(row), 'encrypted_len:', row[1] if row else None)
    cur.execute("SELECT pgp_sym_decrypt(chunk_text_encrypted, %s)::text FROM report_chunks LIMIT 1", (KEY,))
    row2 = cur.fetchone()
    print('Decrypted ok, sample length:', len(row2[0]) if row2 and row2[0] else None)
except Exception as e:
    print('Decrypt error:', e)
finally:
    cur.close(); conn.close()
