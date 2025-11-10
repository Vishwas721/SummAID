import psycopg2

conn = psycopg2.connect('dbname=summaid user=postgres password=1234 host=localhost port=5432')
cur = conn.cursor()
cur.execute("SELECT patient_id, patient_demo_id, patient_display_name FROM patients WHERE patient_display_name ILIKE %s", ('%jane%',))
for r in cur.fetchall():
    print(f'patient_id={r[0]}, demo_id={r[1]}, name={r[2]}')
cur.close()
conn.close()
