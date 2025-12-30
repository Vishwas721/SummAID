"""
Test the updated prompts to verify fixes for:
1. Medical incoherence (surgery vs tumor)
2. Hallucinated symptoms
3. Infographic trend mislabeling

Run after regenerating summary for the same patient.
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8002"

def test_updated_prompts(patient_id=44):
    """Test that updated prompts fix the three critical issues."""
    
    print("="*80)
    print(f"TESTING UPDATED PROMPTS FOR PATIENT {patient_id}")
    print("="*80)
    
    # Regenerate summary
    print("\n[STEP 1] Regenerating summary with updated prompts...")
    try:
        resp = requests.post(
            f"{BASE_URL}/summarize/{patient_id}",
            json={"keywords": None, "max_chunks": 12, "max_context_chars": 12000},
            timeout=180
        )
        if resp.status_code != 200:
            print(f"❌ Regeneration failed: {resp.status_code}")
            return False
        summary_data = resp.json()
        summary_obj = json.loads(summary_data.get("summary_text", "{}"))
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    print("✓ Summary regenerated")
    
    # Check 1: Medical coherence
    print("\n[CHECK 1] Medical Coherence (Evolution narrative)...")
    evolution = summary_obj.get("universal", {}).get("evolution", "")
    print(f"Evolution: {evolution[:200]}...")
    
    if "⚠️ CONTRADICTION" in evolution or "contradiction" in evolution.lower():
        print("✓ GOOD: Contradiction flagged in narrative")
    elif "lumpectomy" in evolution.lower() and ("shrinking" in evolution.lower() or "tumor" in evolution.lower()):
        print("⚠ WARNING: Still mentions both lumpectomy and tumor shrinkage")
    else:
        print("✓ Evolution narrative appears coherent")
    
    # Check 2: No fabricated symptoms
    print("\n[CHECK 2] Hallucination Detection (Current Status)...")
    status = summary_obj.get("universal", {}).get("current_status", [])
    print(f"Current Status ({len(status)} items):")
    for i, item in enumerate(status[:5], 1):
        print(f"  {i}. {item}")
    
    fabricated_patterns = ["no fever", "no bleeding", "no symptoms"]
    found_fabricated = False
    for pattern in fabricated_patterns:
        if any(pattern in s.lower() for s in status):
            print(f"⚠ WARNING: Found potential fabrication: '{pattern}'")
            found_fabricated = True
    
    if not found_fabricated:
        print("✓ No obvious fabricated symptoms detected")
    
    # Check 3: Tumor trend labeling
    print("\n[CHECK 3] Infographic Trend Labeling (Oncology Data)...")
    oncology = summary_obj.get("oncology")
    if oncology:
        trend = oncology.get("tumor_size_trend", {})
        treatment_response = oncology.get("treatment_response", "")
        
        print(f"Tumor Size Trend: {trend}")
        print(f"Treatment Response: {treatment_response}")
        
        # If we see >30% reduction, status should be IMPROVING or PARTIAL RESPONSE
        if isinstance(trend, list) and len(trend) > 0:
            first_item = trend[0]
            if "percent_change" in first_item:
                pct = first_item["percent_change"]
                status_label = first_item.get("status", "")
                print(f"  Percent change: {pct}")
                print(f"  Status label: {status_label}")
                
                # Parse percent change
                try:
                    pct_val = float(pct.rstrip("%"))
                    if pct_val < -30:  # >30% reduction
                        if "STABLE" in status_label:
                            print(f"❌ ERROR: {pct} reduction labeled as STABLE")
                        elif any(x in status_label for x in ["IMPROVING", "PARTIAL RESPONSE"]):
                            print(f"✓ GOOD: {pct} reduction correctly labeled as {status_label}")
                        else:
                            print(f"⚠ WARNING: {pct} has unexpected label: {status_label}")
                except:
                    pass
    else:
        print("ℹ No oncology data (patient may not be oncology)")
    
    # Summary
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)
    print("\nCheck the narrative, status, and oncology data above for improvements.")
    print("Compare against the previous evaluation results to verify fixes.\n")
    
    return True

if __name__ == "__main__":
    patient_id = int(sys.argv[1]) if len(sys.argv) > 1 else 44
    
    print(f"\n📋 TESTING UPDATED PROMPTS")
    print(f"   Patient ID: {patient_id}")
    print(f"   Backend URL: {BASE_URL}")
    print(f"   Fixes: Coherence, Hallucinations, Trend Labeling\n")
    
    success = test_updated_prompts(patient_id)
    sys.exit(0 if success else 1)
