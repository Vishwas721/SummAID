"""
Test script to verify the new multi-report schema.
Run this after seeding to confirm everything works.
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

def test_schema():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    print("=== Testing Multi-Report Schema ===\n")
    
    # Test 1: Check patients table
    print("1. Checking patients table...")
    cur.execute("SELECT patient_id, patient_demo_id, patient_display_name FROM patients ORDER BY patient_id")
    patients = cur.fetchall()
    print(f"   Found {len(patients)} patients:")
    for p in patients:
        print(f"   - ID={p[0]}, demo_id={p[1]}, name={p[2]}")
    print()
    
    # Test 2: Check reports per patient
    print("2. Checking reports per patient...")
    cur.execute("""
        SELECT p.patient_display_name, COUNT(r.report_id) as report_count
        FROM patients p
        LEFT JOIN reports r ON r.patient_id = p.patient_id
        GROUP BY p.patient_id, p.patient_display_name
        ORDER BY report_count DESC
    """)
    report_counts = cur.fetchall()
    for rc in report_counts:
        print(f"   - {rc[0]}: {rc[1]} report(s)")
    print()
    
    # Test 3: Show report details
    print("3. Report details by patient...")
    cur.execute("""
        SELECT p.patient_display_name, r.report_type, r.report_filepath_pointer
        FROM patients p
        JOIN reports r ON r.patient_id = p.patient_id
        ORDER BY p.patient_display_name, r.report_id
    """)
    reports = cur.fetchall()
    current_patient = None
    for r in reports:
        if current_patient != r[0]:
            current_patient = r[0]
            print(f"\n   Patient: {current_patient}")
        print(f"     - {r[1]}: {os.path.basename(r[2])}")
    print()
    
    # Test 4: Check chunks are properly linked
    print("4. Checking report chunks...")
    cur.execute("""
        SELECT p.patient_display_name, r.report_type, COUNT(c.chunk_id) as chunk_count
        FROM patients p
        JOIN reports r ON r.patient_id = p.patient_id
        JOIN report_chunks c ON c.report_id = r.report_id
        GROUP BY p.patient_id, p.patient_display_name, r.report_id, r.report_type
        ORDER BY p.patient_display_name, r.report_id
    """)
    chunks = cur.fetchall()
    for ch in chunks:
        print(f"   - {ch[0]} / {ch[1]}: {ch[2]} chunks")
    print()
    
    # Test 5: Identify multi-report patients (KEY TEST)
    print("5. MULTI-REPORT PATIENTS (Key Demo Feature):")
    cur.execute("""
        SELECT p.patient_display_name, p.patient_demo_id, COUNT(r.report_id) as report_count
        FROM patients p
        JOIN reports r ON r.patient_id = p.patient_id
        GROUP BY p.patient_id, p.patient_display_name, p.patient_demo_id
        HAVING COUNT(r.report_id) > 1
        ORDER BY report_count DESC
    """)
    multi_report_patients = cur.fetchall()
    if multi_report_patients:
        print(f"   ✓ Found {len(multi_report_patients)} patient(s) with multiple reports:")
        for mrp in multi_report_patients:
            print(f"     - {mrp[0]} ({mrp[1]}): {mrp[2]} reports")
            # Show report types for this patient
            cur.execute("""
                SELECT r.report_type
                FROM reports r
                JOIN patients p ON p.patient_id = r.patient_id
                WHERE p.patient_demo_id = %s
                ORDER BY r.report_id
            """, (mrp[1],))
            types = [t[0] for t in cur.fetchall()]
            print(f"       Types: {', '.join(types)}")
    else:
        print("   ⚠ WARNING: No patients with multiple reports found!")
        print("   To demo multi-report RAG, add multiple PDFs with same prefix:")
        print("   e.g., 'jane_mri.pdf' and 'jane_pathology.pdf'")
    print()
    
    print("=== Schema Test Complete ===")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    try:
        test_schema()
    except Exception as e:
        print(f"Error: {e}")
        raise
