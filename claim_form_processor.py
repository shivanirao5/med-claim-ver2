"""
Enhanced Medical Claim Reimbursement System
Handles claim forms + supporting documents with intelligent cross-verification
"""

import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

def extract_claim_form_data(text: str) -> Optional[Dict]:
    """
    Extract structured data from medical reimbursement claim form
    Returns None if no form structure is detected
    """
    
    # Check if this looks like a claim form
    form_indicators = [
        'claim format',
        'reimbursement',
        'employee no',
        'claim no',
        'hospitalized from date',
        'treatment received',
        'details of treatment',
        'declaration by'
    ]
    
    text_lower = text.lower()
    if not any(indicator in text_lower for indicator in form_indicators):
        return None  # Not a claim form
    
    form_data = {
        'isClaimForm': True,
        'employeeDetails': {},
        'claimDetails': {},
        'treatmentDetails': [],
        'declaredAmounts': {},
        'formType': 'medical_reimbursement_claim'
    }
    
    # Extract Employee Information
    employee_patterns = {
        'employeeNo': r'employee\s*no[:\.]?\s*([A-Z0-9]+)',
        'name': r'(?:name|नाम)[:\s]+([A-Za-z\s]+?)(?:\n|Designation)',
        'designation': r'designation[:\s]+([A-Za-z\s]+?)(?:\n|Department)',
        'department': r'department[:\s]+([A-Za-z\s]+?)(?:\n|Grade)',
        'grade': r'grade[:\s]+([A-Z0-9]+)',
        'claimNo': r'claim\s*no[:\.]?\s*([0-9]+)',
        'claimDate': r'claim\s*submitted\s*date[:\s]*([0-9]{2}[\.\/\-][0-9]{2}[\.\/\-][0-9]{4})'
    }
    
    for key, pattern in employee_patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            form_data['employeeDetails'][key] = match.group(1).strip()
    
    # Extract Place of Treatment
    place_match = re.search(r'place\s*of\s*(?:stay|treatment)[:\s]+([A-Za-z\s,]+?)(?:\n|Township)', text, re.IGNORECASE)
    if place_match:
        form_data['claimDetails']['placeOfTreatment'] = place_match.group(1).strip()
    
    # Extract Township
    township_match = re.search(r'township[:\s]+([A-Za-z\s]+)', text, re.IGNORECASE)
    if township_match:
        form_data['claimDetails']['township'] = township_match.group(1).strip()
    
    # Extract Treatment Details Table
    treatment_details = extract_treatment_table(text)
    if treatment_details:
        form_data['treatmentDetails'] = treatment_details
        
        # Calculate total claimed amount
        total_claimed = sum(float(item.get('amount', 0)) for item in treatment_details)
        form_data['declaredAmounts']['totalClaimed'] = round(total_claimed, 2)
    
    # Extract total amount from bottom
    total_patterns = [
        r'(?:amount\s*in\s*rupees)[:\s]*(?:rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{2})?)',
        r'(?:total)[:\s]*(?:rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{2})?)',
        r'([0-9]{1,2},?[0-9]{3}\.[0-9]{2})\s*(?:rupees)?'
    ]
    
    for pattern in total_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(',', '')
            try:
                form_data['declaredAmounts']['totalClaimedOnForm'] = float(amount_str)
                break
            except:
                pass
    
    return form_data

def extract_treatment_table(text: str) -> List[Dict]:
    """
    Extract treatment details from table in claim form
    """
    treatments = []
    
    # Look for table rows with S.No, Date, Patient Name, Relation, Doctor/Hospital, Treatment, Amount
    # Pattern: date, name, relation (SON/WIFE/SELF), hospital/doctor, treatment type, amount
    
    lines = text.split('\n')
    
    for i, line in enumerate(lines):
        # Skip header rows
        if any(header in line.lower() for header in ['s.no', 'bill date', 'name of patient', 'relation']):
            continue
        
        # Look for lines with dates and amounts
        # Pattern: date (DD.MM.YYYY or DD-MM-YYYY), followed by text, ending with amount
        date_pattern = r'([0-9]{2}[\.\-/][0-9]{2}[\.\-/][0-9]{4})'
        amount_pattern = r'([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*$'
        
        if re.search(date_pattern, line) and re.search(amount_pattern, line):
            # Extract components
            date_match = re.search(date_pattern, line)
            amount_match = re.search(amount_pattern, line)
            
            if date_match and amount_match:
                date_str = date_match.group(1)
                amount_str = amount_match.group(1).replace(',', '')
                
                # Extract patient name and hospital
                # Text between date and amount
                middle_text = line[date_match.end():amount_match.start()].strip()
                
                # Common relations to identify
                relations = ['SON', 'WIFE', 'SELF', 'DAUGHTER', 'HUSBAND', 'FATHER', 'MOTHER']
                relation = None
                patient_name = None
                
                for rel in relations:
                    if rel in middle_text.upper():
                        relation = rel
                        # Patient name is usually before relation
                        parts = middle_text.upper().split(rel)
                        if len(parts) > 0:
                            patient_name = parts[0].strip()
                        break
                
                # Extract hospital/doctor name (usually has DR or HOSPITAL)
                hospital_match = re.search(r'(DR\.?\s+[A-Z\s]+|[A-Z\s]+HOSPITAL|[A-Z\s]+CLINIC)', middle_text, re.IGNORECASE)
                hospital_name = hospital_match.group(1).strip() if hospital_match else None
                
                # Extract treatment type (CONSULTATION, MEDICINE, VACCINATION, etc.)
                treatment_types = ['CONSULTATION', 'MEDICINE', 'VACCINATION', 'SURGERY', 'DIAGNOSTIC', 'TEST']
                treatment_type = None
                for ttype in treatment_types:
                    if ttype in middle_text.upper():
                        treatment_type = ttype
                        break
                
                treatment = {
                    'date': date_str,
                    'patientName': patient_name,
                    'relation': relation,
                    'hospitalName': hospital_name,
                    'treatmentType': treatment_type,
                    'amount': float(amount_str),
                    'rawText': line.strip()
                }
                
                treatments.append(treatment)
    
    return treatments

def cross_verify_claim(form_data: Dict, extracted_data: Dict) -> Dict:
    """
    Cross-verify claimed amounts vs actual bills/prescriptions
    Returns verification results with discrepancies
    """
    
    verification = {
        'formPresent': True,
        'verificationStatus': 'verified',
        'discrepancies': [],
        'matches': [],
        'summary': {}
    }
    
    # Get claimed amounts from form
    claimed_total = form_data.get('declaredAmounts', {}).get('totalClaimed', 0)
    form_treatments = form_data.get('treatmentDetails', [])
    
    # Get actual amounts from bills
    matching_results = extracted_data.get('matching', {})
    actual_admissible = matching_results.get('summary', {}).get('totalAdmissibleAmount', 0)
    actual_total_bills = matching_results.get('summary', {}).get('totalAmount', 0)
    
    # Compare totals
    difference = abs(claimed_total - actual_admissible)
    tolerance = 1.0  # ₹1 tolerance for rounding
    
    verification['summary'] = {
        'claimedAmount': round(claimed_total, 2),
        'actualBillAmount': round(actual_total_bills, 2),
        'admissibleAmount': round(actual_admissible, 2),
        'difference': round(difference, 2),
        'discrepancyPercentage': round((difference / claimed_total * 100) if claimed_total > 0 else 0, 2)
    }
    
    # Check for significant discrepancy
    if difference > tolerance:
        if claimed_total > actual_admissible:
            verification['verificationStatus'] = 'over_claimed'
            verification['discrepancies'].append({
                'type': 'AMOUNT_MISMATCH',
                'severity': 'HIGH' if difference > 500 else 'MEDIUM',
                'description': f'Claimed amount (₹{claimed_total:.2f}) exceeds admissible amount (₹{actual_admissible:.2f})',
                'difference': round(difference, 2)
            })
        else:
            verification['verificationStatus'] = 'under_claimed'
            verification['discrepancies'].append({
                'type': 'AMOUNT_MISMATCH',
                'severity': 'LOW',
                'description': f'Claimed amount (₹{claimed_total:.2f}) is less than admissible amount (₹{actual_admissible:.2f})',
                'difference': round(difference, 2)
            })
    else:
        verification['verificationStatus'] = 'verified'
        verification['matches'].append({
            'type': 'AMOUNT_MATCH',
            'description': f'Claimed amount matches admissible amount (₹{actual_admissible:.2f})',
            'confidence': 'HIGH'
        })
    
    # Cross-verify individual treatment items
    verify_treatment_items(form_treatments, matching_results, verification)
    
    # Check for missing supporting documents
    check_supporting_documents(form_treatments, matching_results, verification)
    
    return verification

def verify_treatment_items(form_treatments: List[Dict], matching_results: Dict, verification: Dict):
    """
    Verify each treatment item claimed in form against actual bills
    """
    
    matched_items = matching_results.get('matchedItems', [])
    
    for form_item in form_treatments:
        treatment_type = (form_item.get('treatmentType') or 'UNKNOWN').upper()
        claimed_amount = form_item.get('amount', 0)
        treatment_date = form_item.get('date', '')
        
        # Find corresponding items in matched bills
        corresponding_found = False
        
        for matched_item in matched_items:
            item_amount = matched_item.get('amount', 0)
            
            # Check if amounts are close (within 10% or ₹50)
            amount_diff = abs(claimed_amount - item_amount)
            if amount_diff <= 50 or amount_diff / claimed_amount <= 0.1:
                corresponding_found = True
                verification['matches'].append({
                    'type': 'ITEM_MATCH',
                    'formItem': f"{treatment_type} - ₹{claimed_amount:.2f}",
                    'billItem': f"{matched_item.get('billItemName')} - ₹{item_amount:.2f}",
                    'confidence': 'HIGH' if amount_diff <= 10 else 'MEDIUM'
                })
                break
        
        if not corresponding_found and claimed_amount > 0:
            verification['discrepancies'].append({
                'type': 'MISSING_SUPPORTING_DOCUMENT',
                'severity': 'MEDIUM',
                'description': f"Claimed {treatment_type} (₹{claimed_amount:.2f}) on {treatment_date} - no matching bill found",
                'claimedAmount': claimed_amount
            })

def check_supporting_documents(form_treatments: List[Dict], matching_results: Dict, verification: Dict):
    """
    Check if all claimed treatments have supporting documents
    """
    
    # Count different types of treatments claimed
    consultations_claimed = sum(1 for t in form_treatments if 'CONSULT' in (t.get('treatmentType') or '').upper())
    medicines_claimed = sum(1 for t in form_treatments if 'MEDICINE' in (t.get('treatmentType') or '').upper())
    
    # Count what was actually found
    matched_items = matching_results.get('matchedItems', [])
    consultations_found = sum(1 for m in matched_items if m.get('isConsultation', False))
    medicines_found = sum(1 for m in matched_items if not m.get('isConsultation', False) and not m.get('isTest', False))
    
    # Check for missing documents
    if consultations_claimed > consultations_found:
        verification['discrepancies'].append({
            'type': 'MISSING_BILLS',
            'severity': 'HIGH',
            'description': f"Claimed {consultations_claimed} consultations but found {consultations_found} consultation bills"
        })
    
    if medicines_claimed > medicines_found:
        verification['discrepancies'].append({
            'type': 'MISSING_PRESCRIPTIONS',
            'severity': 'MEDIUM',
            'description': f"Claimed {medicines_claimed} medicine purchases but found {medicines_found} medicine bills"
        })

def format_verification_report(form_data: Dict, verification: Dict) -> str:
    """
    Format a human-readable verification report
    """
    
    report = []
    report.append("=" * 80)
    report.append("CLAIM VERIFICATION REPORT")
    report.append("=" * 80)
    report.append("")
    
    # Employee Details
    emp_details = form_data.get('employeeDetails', {})
    if emp_details:
        report.append("EMPLOYEE INFORMATION:")
        report.append(f"  Name: {emp_details.get('name', 'N/A')}")
        report.append(f"  Employee No: {emp_details.get('employeeNo', 'N/A')}")
        report.append(f"  Claim No: {emp_details.get('claimNo', 'N/A')}")
        report.append(f"  Claim Date: {emp_details.get('claimDate', 'N/A')}")
        report.append("")
    
    # Verification Summary
    summary = verification.get('summary', {})
    report.append("AMOUNT VERIFICATION:")
    report.append(f"  Amount Claimed in Form:    ₹{summary.get('claimedAmount', 0):.2f}")
    report.append(f"  Total Bill Amount:         ₹{summary.get('actualBillAmount', 0):.2f}")
    report.append(f"  Admissible Amount:         ₹{summary.get('admissibleAmount', 0):.2f}")
    report.append(f"  Difference:                ₹{summary.get('difference', 0):.2f}")
    report.append("")
    
    # Status
    status = verification.get('verificationStatus', 'unknown')
    status_symbols = {
        'verified': '✅ VERIFIED',
        'over_claimed': '⚠️ OVER-CLAIMED',
        'under_claimed': '⚠️ UNDER-CLAIMED',
        'discrepancy': '❌ DISCREPANCY FOUND'
    }
    report.append(f"VERIFICATION STATUS: {status_symbols.get(status, status.upper())}")
    report.append("")
    
    # Discrepancies
    discrepancies = verification.get('discrepancies', [])
    if discrepancies:
        report.append("DISCREPANCIES FOUND:")
        for i, disc in enumerate(discrepancies, 1):
            report.append(f"  {i}. [{disc['severity']}] {disc['description']}")
        report.append("")
    
    # Matches
    matches = verification.get('matches', [])
    if matches:
        report.append("VERIFIED MATCHES:")
        for i, match in enumerate(matches[:5], 1):  # Show first 5
            report.append(f"  {i}. {match.get('description', '')}")
        if len(matches) > 5:
            report.append(f"  ... and {len(matches) - 5} more matches")
        report.append("")
    
    report.append("=" * 80)
    
    return "\n".join(report)
