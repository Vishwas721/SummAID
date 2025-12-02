"""
Quick script to run the doctor_summary_edits migration.
"""
import psycopg2

# Database connection parameters
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    user="postgres",
    password="1234",
    dbname="summaid"
)

# Read migration file
with open("migrations/003_doctor_summary_edits.sql", "r") as f:
    migration_sql = f.read()

# Execute migration
cur = conn.cursor()
try:
    cur.execute(migration_sql)
    conn.commit()
    print("✅ Migration 003_doctor_summary_edits.sql executed successfully!")
    
    # Verify table was created
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'doctor_summary_edits'
    """)
    if cur.fetchone():
        print("✅ Table 'doctor_summary_edits' confirmed in database")
    else:
        print("⚠️ Table not found after migration")
        
except Exception as e:
    conn.rollback()
    print(f"❌ Migration failed: {e}")
finally:
    cur.close()
    conn.close()
