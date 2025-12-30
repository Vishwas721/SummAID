"""
Delete all stored summaries and doctor edits from the database.

This script:
1. Deletes all rows from doctor_summary_edits (doctor-edited summaries)
2. Deletes all rows from patient_summaries (AI-generated summaries)
3. Optionally resets chart_prepared_at in patients table
4. Verifies deletion count

Usage:
    python delete_all_summaries.py

WARNING: This is destructive. All stored summaries will be deleted.
"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL must be set in .env file")

print("="*80)
print("DELETE ALL STORED SUMMARIES AND DOCTOR EDITS")
print("="*80)
print("\nWARNING: This will permanently delete all summaries from the database.")
print("You will need to regenerate summaries for all patients.\n")

confirm = input("Type 'yes' to confirm deletion: ").strip().lower()
if confirm != 'yes':
    print("Aborted.")
    exit(0)

try:
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Step 1: Delete doctor edits
    print("\n[Step 1] Deleting doctor_summary_edits...")
    cur.execute("DELETE FROM doctor_summary_edits")
    edits_deleted = cur.rowcount
    print(f"✓ Deleted {edits_deleted} doctor edit(s)")
    
    # Step 2: Delete patient summaries
    print("\n[Step 2] Deleting patient_summaries...")
    cur.execute("DELETE FROM patient_summaries")
    summaries_deleted = cur.rowcount
    print(f"✓ Deleted {summaries_deleted} summary/summaries")
    
    # Step 3: Reset chart_prepared_at (optional but recommended)
    print("\n[Step 3] Resetting chart_prepared_at in patients table...")
    cur.execute("UPDATE patients SET chart_prepared_at = NULL")
    patients_updated = cur.rowcount
    print(f"✓ Reset chart_prepared_at for {patients_updated} patient(s)")
    
    # Commit all changes
    conn.commit()
    
    # Step 4: Verify deletion
    print("\n[Step 4] Verifying deletion...")
    cur.execute("SELECT COUNT(*) FROM doctor_summary_edits")
    edits_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM patient_summaries")
    summaries_count = cur.fetchone()[0]
    
    print(f"✓ doctor_summary_edits remaining: {edits_count}")
    print(f"✓ patient_summaries remaining: {summaries_count}")
    
    cur.close()
    conn.close()
    
    print("\n" + "="*80)
    print("✅ DELETION COMPLETE")
    print("="*80)
    print(f"\nSummary:")
    print(f"  - Deleted {edits_deleted} doctor edit(s)")
    print(f"  - Deleted {summaries_deleted} stored summary/summaries")
    print(f"  - Reset chart_prepared_at for {patients_updated} patient(s)")
    print(f"\nYou can now regenerate fresh summaries using:")
    print(f"  POST /summarize/{{patient_id}}")
    print("\n")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    if conn:
        conn.rollback()
    exit(1)
