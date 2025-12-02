import psycopg2

conn = psycopg2.connect(
    dbname='summaid',
    user='postgres',
    password='1234',
    host='localhost',
    port=5432
)
cur = conn.cursor()
cur.execute('DELETE FROM patient_summaries')
conn.commit()
print(f'✅ Deleted {cur.rowcount} summaries - ready for new AIResponseSchema format')
cur.close()
conn.close()
