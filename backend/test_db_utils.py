"""Test db_utils with real patient data"""
from db_utils import get_all_chunks_for_patient, get_patient_info, get_report_types_for_patient

print("Testing with patient ID 40 (Joe Smith)")
print("=" * 60)

# Get patient info
info = get_patient_info(40)
if info:
    print(f"\nPatient Info: {info['patient_display_name']}")
    print(f"Demo ID: {info.get('patient_demo_id', 'N/A')}")
else:
    print("\n❌ Patient not found")

# Get report types
types = get_report_types_for_patient(40)
print(f"\nReport Types: {types}")

# Get chunks
chunks = get_all_chunks_for_patient(40)
print(f"\nTotal chunks retrieved: {len(chunks)}")

if chunks:
    print("\n✅ Chunk retrieval successful!")
    print(f"First chunk preview (200 chars):")
    print("-" * 60)
    preview = chunks[0]["text"][:200]
    print(preview + "...")
    print("-" * 60)
    print(f"\nChunk metadata:")
    print(f"  - chunk_id: {chunks[0]['chunk_id']}")
    print(f"  - report_id: {chunks[0]['report_id']}")
else:
    print("\n⚠️ No chunks found for this patient")
