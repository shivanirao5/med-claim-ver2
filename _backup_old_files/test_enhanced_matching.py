#!/usr/bin/env python3
"""
Enhanced Matching Accuracy Test
Tests the improved fuzzy matching with real-world medicine name variations
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server import normalize_medicine_name, fuzzy_match_score, find_best_match

def test_matching():
    """Test matching accuracy with various medicine name formats"""
    
    test_cases = [
        # (prescription_name, bill_name, should_match, description)
        ("CROCIN 650MG", "CROCIN TAB 650MG", True, "Dosage variation"),
        ("DOLO 650", "DOLO 650 TAB", True, "With/without TAB"),
        ("AMOXICILLIN 500MG", "AMOXICILLIN CAP 500MG", True, "With capsule form"),
        ("AZITHROMYCIN 250", "AZITHROMYCIN 250 TAB", True, "With tablet form"),
        ("CETIRIZINE 10MG", "CETIRIZINE TAB 10MG", True, "Order variation"),
        ("PARACETAMOL", "PARACETAMOL 500MG TAB", True, "Missing dosage"),
        ("MOX 500", "AMOXICILLIN 500", False, "Different medicines"),
        ("CROCIN", "CROCIN ADVANCE", True, "Variant product"),
        ("AZEE 500", "AZITHROMYCIN 500", True, "Brand vs Generic"),
        ("D COLD TOTAL", "D-COLD TOTAL TAB", True, "Hyphen variation"),
        ("PAN 40", "PAN-40 TAB", True, "Hyphen in dosage"),
        ("PANTOCID DSR", "PANTOCID-DSR CAP", True, "Hyphen in suffix"),
        ("OMEZ 20", "OMEZ-20 CAP", True, "Dosage hyphen"),
        ("SHELCAL 500", "SHELCAL-500 TAB", True, "Brand with dosage"),
        ("LIVOGEN Z", "LIVOGEN-Z CAP", True, "Brand with suffix"),
        ("BECOSULES", "BECOSULES CAP", True, "Without form"),
        ("NUROKIND GOLD", "NUROKIND-GOLD TAB", True, "Two-word brand"),
        ("SINAREST", "SINAREST TAB", True, "Simple brand"),
        ("AUGMENTIN 625", "AUGMENTIN-625 TAB", True, "Brand + dosage"),
        ("LEVOCET M", "LEVOCET-M TAB", True, "Brand + letter suffix"),
    ]
    
    print("="*80)
    print("ENHANCED MATCHING ACCURACY TEST")
    print("="*80)
    print()
    
    passed = 0
    failed = 0
    
    for prescription, bill, should_match, description in test_cases:
        # Normalize both
        norm_presc = normalize_medicine_name(prescription)
        norm_bill = normalize_medicine_name(bill)
        
        # Calculate match score
        score = fuzzy_match_score(prescription, bill)
        
        # Determine if matched (threshold 0.55)
        matched = score >= 0.55
        
        # Check if result is correct
        is_correct = matched == should_match
        
        if is_correct:
            passed += 1
            status = "✅ PASS"
        else:
            failed += 1
            status = "❌ FAIL"
        
        print(f"{status} | {description}")
        print(f"   Prescription: {prescription}")
        print(f"   Bill: {bill}")
        print(f"   Normalized P: '{norm_presc}'")
        print(f"   Normalized B: '{norm_bill}'")
        print(f"   Match Score: {score:.2%}")
        print(f"   Expected: {'MATCH' if should_match else 'NO MATCH'}")
        print(f"   Got: {'MATCH' if matched else 'NO MATCH'}")
        print()
    
    print("="*80)
    print(f"RESULTS: {passed} passed, {failed} failed out of {len(test_cases)} tests")
    print(f"Accuracy: {passed/len(test_cases)*100:.1f}%")
    print("="*80)
    
    return passed, failed

def test_bill_matching():
    """Test matching with actual bill items"""
    print("\n" + "="*80)
    print("BILL ITEM MATCHING TEST")
    print("="*80)
    print()
    
    prescriptions = [
        "CROCIN 650MG",
        "DOLO 650",
        "AZITHROMYCIN 250",
        "CETIRIZINE 10MG"
    ]
    
    bill_items = [
        {"name": "CROCIN TAB 650MG", "amount": 50.0},
        {"name": "DOLO-650 TABLET", "amount": 45.0},
        {"name": "AZITHROMYCIN 250 TAB", "amount": 120.0},
        {"name": "CETIRIZINE TAB 10MG", "amount": 25.0},
        {"name": "CONSULTATION FEE", "amount": 300.0},
        {"name": "VITAMIN B12 INJ", "amount": 80.0}
    ]
    
    for prescription in prescriptions:
        best_match, score = find_best_match(prescription, bill_items, threshold=0.55)
        
        if best_match:
            print(f"✅ MATCHED: {prescription}")
            print(f"   → {best_match['name']} (₹{best_match['amount']:.2f})")
            print(f"   Match Score: {score:.2%}")
        else:
            print(f"❌ NO MATCH: {prescription}")
        print()
    
    print("="*80)

def test_edge_cases():
    """Test edge cases and problematic matches"""
    print("\n" + "="*80)
    print("EDGE CASE TESTS")
    print("="*80)
    print()
    
    edge_cases = [
        ("", "CROCIN 650", 0.0, "Empty prescription"),
        ("CROCIN", "", 0.0, "Empty bill"),
        ("A", "B", 0.0, "Single character mismatch"),
        ("CROCIN 650MG TAB", "CROCIN 650MG TAB", 1.0, "Exact match"),
        ("CROCIN", "CROCIN ADVANCE FAST RELIEF", 0.8, "Partial match"),
        ("PAN", "PANTOCID DSR CAP", 0.5, "Abbreviation vs full"),
        ("PARACETAMOL", "DOLO 650", 0.3, "Generic vs brand (low match)"),
    ]
    
    for presc, bill, expected_min_score, description in edge_cases:
        score = fuzzy_match_score(presc, bill)
        
        if score >= expected_min_score:
            print(f"✅ {description}")
        else:
            print(f"⚠️ {description}")
        
        print(f"   '{presc}' vs '{bill}'")
        print(f"   Score: {score:.2%} (expected ≥ {expected_min_score:.2%})")
        print()
    
    print("="*80)

if __name__ == "__main__":
    print("\n🧪 Running Enhanced Matching Tests...\n")
    
    # Run all tests
    passed, failed = test_matching()
    test_bill_matching()
    test_edge_cases()
    
    print("\n✅ All tests completed!")
    
    if failed == 0:
        print("🎉 Perfect! All tests passed.")
        sys.exit(0)
    else:
        print(f"⚠️ {failed} test(s) failed. Review the results above.")
        sys.exit(1)
