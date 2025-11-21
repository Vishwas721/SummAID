"""
Apply annotations table migration
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    print("ERROR: DATABASE_URL not found in .env!")
    exit(1)

print("=== Applying Annotations Table Migration ===\n")

try:
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Read migration file
    with open('migrations/001_add_annotations_table.sql', 'r') as f:
        migration_sql = f.read()
    
    # Execute migration
    print("Creating annotations table...")
    cur.execute(migration_sql)
    
    print("✅ Migration applied successfully!")
    
    # Verify table was created
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'annotations'
        ORDER BY ordinal_position
    """)
    columns = cur.fetchall()
    
    print("\nAnnotations table structure:")
    for col_name, col_type in columns:
        print(f"  - {col_name}: {col_type}")
    
    conn.close()
    print("\n✅ Migration complete!")
    
except Exception as e:
    print(f"❌ Migration failed: {e}")
    exit(1)
