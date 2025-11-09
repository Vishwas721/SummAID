"""
Reset database with new multi-report schema.
WARNING: This will DELETE all existing data!
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    print("ERROR: DATABASE_URL not found in .env!")
    exit(1)

print("=== SummAID Database Reset ===\n")
print(f"Database URL: {DB_URL.split('@')[1]}")  # Hide credentials
print("\n⚠️  WARNING: This will DELETE ALL existing data!")
confirm = input("Type 'yes' to continue: ")

if confirm != 'yes':
    print("Aborted.")
    exit(0)

print("\nResetting database schema...")

try:
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Drop existing tables
    print("  - Dropping existing tables...")
    cur.execute("DROP TABLE IF EXISTS report_chunks CASCADE;")
    cur.execute("DROP TABLE IF EXISTS reports CASCADE;")
    cur.execute("DROP TABLE IF EXISTS patients CASCADE;")
    
    # Read and execute schema.sql
    print("  - Creating new schema...")
    with open('schema.sql', 'r') as f:
        schema_sql = f.read()
    
    cur.execute(schema_sql)
    
    cur.close()
    conn.close()
    
    print("\n✓ Database schema reset complete!\n")
    print("Next steps:")
    print("  1. Add PDF files to ./demo_reports/")
    print("     - Use naming like: jane_mri.pdf, jane_pathology.pdf")
    print("     - Files with same prefix will be grouped under one patient\n")
    print("  2. Run seeding script:")
    print("     python seed.py\n")
    print("  3. Verify multi-report setup:")
    print("     python test_schema.py")
    
except Exception as e:
    print(f"\n✗ Error resetting database: {e}")
    exit(1)
