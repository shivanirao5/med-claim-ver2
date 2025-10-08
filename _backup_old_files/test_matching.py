"""
Test the new intelligent matching system
"""

import sys
sys.path.insert(0, '.')

from server import normalize_medicine_name, fuzzy_match_score, extract_brand_name

# Test cases from the report
test_cases = [
    # (prescription, bill_item, should_match)
    ("NMFE LIP BALM", "NT E LIP ONE", False),  # Different products
    ("Tab.MEL BOOST", "MELBOOST TAB", True),  # Same product
    ("CALPSOR OINTMENT", "CAPSOR OINT 30GM", True),  # Same product  
    ("LIV MOIST cream", "NMFE LIP BALM", False),  # Both have generic words but different brands
    ("PIMOVATE CREAM 1%", "NMFE LIP BALM", False),  # Different brands
    ("Delevco lotion", "DERIVA C LOTION", False),  # Different brands
    ("NMFE LIP BALM SPF 40%", "HMF E LIP CARE", True),  # Same product (OCR error NMFE->HMF)
]

print("=" * 80)
print("INTELLIGENT MATCHING TEST RESULTS")
print("=" * 80)
print()

for prescription, bill_item, should_match in test_cases:
    # Normalize
    norm_presc = normalize_medicine_name(prescription)
    norm_bill = normalize_medicine_name(bill_item)
    
    # Extract brands
    brand_presc = extract_brand_name(prescription)
    brand_bill = extract_brand_name(bill_item)
    
    # Calculate score
    score = fuzzy_match_score(prescription, bill_item)
    match_threshold = 0.6
    will_match = score >= match_threshold
    
    # Check if result is correct
    correct = "✅" if will_match == should_match else "❌"
    
    print(f"{correct} Prescription: {prescription}")
    print(f"   Bill Item:    {bill_item}")
    print(f"   Normalized:   '{norm_presc}' vs '{norm_bill}'")
    print(f"   Brands:       '{brand_presc}' vs '{brand_bill}'")
    print(f"   Score:        {score:.2%} (threshold: {match_threshold:.0%})")
    print(f"   Will Match:   {will_match} (Expected: {should_match})")
    print()

print("=" * 80)
print("KEY IMPROVEMENTS:")
print("=" * 80)
print("1. Brand-focused matching - compares first significant word (brand name)")
print("2. Generic word filtering - ignores cream/ointment/lotion/balm/lip/etc")
print("3. Higher threshold - 60% instead of 50% for stricter matching")
print("4. De-duplication - prevents same item appearing multiple times")
print("5. OCR error handling - NMFE -> HMF conversion")
print()
