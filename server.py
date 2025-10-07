from flask import Flask, request, jsonify, send_from_directory, render_template
import os
import json
from flask_cors import CORS
import base64
import requests
import time
import hashlib
import re
import sqlite3
import threading
from datetime import datetime, timedelta
from difflib import SequenceMatcher
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Database setup
DB_PATH = os.path.join(BASE_DIR, 'med_claim_data.db')
db_lock = threading.Lock()

def init_database():
    """Initialize SQLite database for metadata storage"""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total_sessions INTEGER DEFAULT 0,
                total_files INTEGER DEFAULT 0,
                total_amount REAL DEFAULT 0.0
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_name TEXT NOT NULL,
                session_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                file_count INTEGER DEFAULT 0,
                prescription_count INTEGER DEFAULT 0,
                bill_count INTEGER DEFAULT 0,
                total_amount REAL DEFAULT 0.0,
                UNIQUE(employee_name, session_id)
            )
        ''')
        
        conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_employee_name ON sessions(employee_name)
        ''')
        
        conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_created_at ON sessions(created_at)
        ''')
        
        conn.commit()

def update_employee_stats(employee_name):
    """Update employee statistics in database"""
    with db_lock:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.execute('''
                SELECT COUNT(*) as total_sessions, 
                       SUM(file_count) as total_files, 
                       SUM(total_amount) as total_amount,
                       MAX(created_at) as last_activity
                FROM sessions 
                WHERE employee_name = ?
            ''', (employee_name,))
            
            row = cursor.fetchone()
            if row:
                total_sessions, total_files, total_amount, last_activity = row
                
                conn.execute('''
                    INSERT OR REPLACE INTO employees 
                    (name, total_sessions, total_files, total_amount, last_activity)
                    VALUES (?, ?, ?, ?, ?)
                ''', (employee_name, total_sessions or 0, total_files or 0, 
                      total_amount or 0.0, last_activity or datetime.now().isoformat()))
                
                conn.commit()

def sync_database_with_filesystem():
    """Synchronize database with filesystem"""
    with db_lock:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.execute('SELECT name FROM employees')
            db_employees = [row[0] for row in cursor.fetchall()]
            
            cursor = conn.execute('SELECT employee_name, session_id FROM sessions')
            db_sessions = cursor.fetchall()
            
            employees_to_delete = []
            for employee in db_employees:
                emp_dir = os.path.join(DATASET_DIR, _sanitize_name(employee))
                if not os.path.isdir(emp_dir):
                    employees_to_delete.append(employee)
            
            sessions_to_delete = []
            for employee_name, session_id in db_sessions:
                emp_dir = os.path.join(DATASET_DIR, _sanitize_name(employee_name))
                sess_dir = os.path.join(emp_dir, session_id)
                if not os.path.isdir(sess_dir):
                    sessions_to_delete.append((employee_name, session_id))
            
            if employees_to_delete:
                for employee in employees_to_delete:
                    conn.execute('DELETE FROM employees WHERE name = ?', (employee,))
                    conn.execute('DELETE FROM sessions WHERE employee_name = ?', (employee,))
            
            if sessions_to_delete:
                for employee_name, session_id in sessions_to_delete:
                    conn.execute('DELETE FROM sessions WHERE employee_name = ? AND session_id = ?', 
                               (employee_name, session_id))
            
            cursor = conn.execute('SELECT DISTINCT employee_name FROM sessions')
            remaining_employees = [row[0] for row in cursor.fetchall()]
            
            for employee in remaining_employees:
                cursor = conn.execute('''
                    SELECT COUNT(*) as total_sessions, 
                           SUM(file_count) as total_files, 
                           SUM(total_amount) as total_amount,
                           MAX(created_at) as last_activity
                    FROM sessions 
                    WHERE employee_name = ?
                ''', (employee,))
                
                row = cursor.fetchone()
                if row:
                    total_sessions, total_files, total_amount, last_activity = row
                    conn.execute('''
                        INSERT OR REPLACE INTO employees 
                        (name, total_sessions, total_files, total_amount, last_activity)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (employee, total_sessions or 0, total_files or 0, 
                          total_amount or 0.0, last_activity or datetime.now().isoformat()))
            
            conn.commit()
            
            if employees_to_delete or sessions_to_delete:
                return True
            return False

def record_session(employee_name, session_id, summary_data):
    """Record session data in database"""
    with db_lock:
        with sqlite3.connect(DB_PATH) as conn:
            file_count = len(summary_data.get('files', []))
            
            aggregated = summary_data.get('aggregated', {})
            prescription_count = len(aggregated.get('prescriptions', []))
            bill_count = len(aggregated.get('bills', []))
            
            total_amount = 0
            for bill in aggregated.get('bills', []):
                for item in bill.get('items', []):
                    total_amount += item.get('amount', 0)
            
            conn.execute('''
                INSERT OR REPLACE INTO sessions 
                (employee_name, session_id, file_count, prescription_count, bill_count, total_amount)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (employee_name, session_id, file_count, prescription_count, bill_count, total_amount))
            
            conn.commit()
    
    update_employee_stats(employee_name)

init_database()

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"

def get_api_key() -> str:
    global _ENV_LOADED
    if load_dotenv and not globals().get('_ENV_LOADED'):
        load_dotenv(os.path.join(BASE_DIR, '.env'))
        _ENV_LOADED = True
    return os.getenv('GEMINI_API_KEY')

# Enhanced fuzzy matching utilities
def normalize_medicine_name(name):
    """Enhanced normalize medicine names for better matching"""
    if not name:
        return ""
    
    # Convert to lowercase
    name = name.lower().strip()
    
    # Store original for reference
    original_name = name
    
    # Remove common prefixes/suffixes
    prefixes = ['tab', 'tablet', 'cap', 'capsule', 'syrup', 'syp', 'inj', 'injection', 'susp', 'suspension', 'drops', 'sol', 'solution']
    for prefix in prefixes:
        if name.startswith(prefix + '.'):
            name = name[len(prefix)+1:].strip()
        elif name.startswith(prefix + ' '):
            name = name[len(prefix)+1:].strip()
        elif name.endswith(' ' + prefix):
            name = name[:-len(prefix)-1].strip()
        elif name.endswith('.' + prefix):
            name = name[:-len(prefix)-1].strip()
    
    # Handle common suffixes like "kid", "ds", "forte", "plus"
    suffixes = ['kid', 'ds', 'forte', 'plus', 'sr', 'xl', 'cr', 'er', 'mr']
    for suffix in suffixes:
        if name.endswith('-' + suffix):
            name = name[:-len(suffix)-1].strip()
        elif name.endswith(' ' + suffix):
            name = name[:-len(suffix)-1].strip()
    
    # Remove dosage information but preserve core name
    # Extract the base medicine name before dosage
    name = re.sub(r'\s*\d+\s*mg\s*', ' ', name)
    name = re.sub(r'\s*\d+\s*ml\s*', ' ', name)
    name = re.sub(r'\s*\d+\s*gm\s*', ' ', name)
    name = re.sub(r'\s*\d+\s*mcg\s*', ' ', name)
    
    # Replace hyphens with spaces for better matching
    name = name.replace('-', ' ')
    
    # Remove special characters but keep spaces
    name = re.sub(r'[^\w\s]', ' ', name)
    
    # Remove extra spaces
    name = ' '.join(name.split())
    
    return name

def fuzzy_match_score(str1, str2):
    """Enhanced fuzzy match score calculation for medicine names"""
    if not str1 or not str2:
        return 0.0
    
    # Normalize both strings
    s1 = normalize_medicine_name(str1)
    s2 = normalize_medicine_name(str2)
    
    if s1 == s2:
        return 1.0
    
    # If either string is empty after normalization, no match
    if not s1 or not s2:
        return 0.0
    
    # Base sequence matching
    base_score = SequenceMatcher(None, s1, s2).ratio()
    
    # Word-level matching (most important for medicines)
    words1 = set(s1.split())
    words2 = set(s2.split())
    
    if words1 and words2:
        # Calculate Jaccard similarity
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        jaccard_score = len(intersection) / len(union) if union else 0
        
        # If there's significant word overlap, boost the score
        if len(intersection) > 0:
            word_overlap_ratio = len(intersection) / max(len(words1), len(words2))
            word_score = max(jaccard_score, word_overlap_ratio) * 0.95
            base_score = max(base_score, word_score)
    
    # Check for substring matches (core medicine name)
    if s1 in s2 or s2 in s1:
        substring_score = 0.88
        base_score = max(base_score, substring_score)
    
    # Check for partial word matches (like "calpol" matching in both)
    for word1 in words1:
        for word2 in words2:
            if len(word1) >= 4 and len(word2) >= 4:  # Only for meaningful words
                word_ratio = SequenceMatcher(None, word1, word2).ratio()
                if word_ratio > 0.8:
                    partial_word_score = word_ratio * 0.85
                    base_score = max(base_score, partial_word_score)
    
    # Handle numeric variations (like "120" vs "120mg")
    nums1 = re.findall(r'\d+', str1.lower())
    nums2 = re.findall(r'\d+', str2.lower())
    if nums1 and nums2 and set(nums1) == set(nums2):
        # Same numbers found, boost score
        base_score = min(1.0, base_score + 0.1)
    
    return base_score

def find_best_match(medicine_name, bill_items, threshold=0.6):
    """Find the best matching bill item for a given medicine name"""
    best_match = None
    best_score = 0.0
    
    for item in bill_items:
        item_name = item.get('name', '')
        score = fuzzy_match_score(medicine_name, item_name)
        
        if score > best_score and score >= threshold:
            best_score = score
            best_match = item
    
    return best_match, best_score

def classify_consultation_fee(item_name, amount):
    """Check if an item is a consultation fee and validate the amount"""
    consultation_keywords = [
        'consultation', 'doctor fee', 'doctor charge', 'consulting', 
        'visit', 'opd', 'consultation fee', 'dr fee', 'dr charge',
        'physician fee', 'medical consultation', 'consulting fee'
    ]
    
    normalized_name = normalize_medicine_name(item_name)
    
    is_consultation = any(keyword in normalized_name for keyword in consultation_keywords)
    
    if is_consultation:
        max_allowed = 300.0
        if amount > max_allowed:
            return True, max_allowed, amount - max_allowed
        else:
            return True, amount, 0.0
    
    return False, amount, 0.0

def build_enhanced_prompt() -> str:
    return (
        "You are an expert medical document analyzer. Analyze this image carefully.\n\n"
        "1) DOCUMENT CLASSIFICATION:\n"
        "   - Classify as: 'prescription', 'bill', 'test_report', 'lab_report', 'consultation_receipt', 'medical_record', or 'unknown'\n"
        "   - A prescription contains medicine names prescribed by a doctor\n"
        "   - A bill/receipt shows items purchased with prices (medicines, tests, consultations)\n"
        "   - A test_report/lab_report contains medical test results, lab values, diagnostic tests\n"
        "   - A consultation receipt shows doctor consultation charges\n"
        "   - Medical records show patient history, diagnoses, etc.\n\n"
        "2) MEDICINE EXTRACTION (for prescriptions):\n"
        "   - Extract ALL medicine names, brands, and generic names\n"
        "   - Include full medicine names with proper spelling\n"
        "   - EXCLUDE: doctor names, clinic names, addresses, dates, patient names\n"
        "   - EXCLUDE: Headers like 'Rx', 'Prescription', or administrative text\n\n"
        "3) BILL ITEM EXTRACTION (for bills/receipts):\n"
        "   - Extract each item name and its corresponding amount\n"
        "   - Identify consultation fees, test fees, and medicine costs separately\n"
        "   - Mark test items with 'isTest': true\n"
        "   - Mark consultation fees with 'isConsultation': true\n"
        "   - Include medicine names and their prices\n"
        "   - Extract subtotals, taxes, and final totals if present\n\n"
        "4) TEST EXTRACTION (for test/lab reports):\n"
        "   - Extract test names (CBC, Blood Sugar, X-Ray, etc.)\n"
        "   - Look for diagnostic procedure names\n"
        "   - Include pathology tests, imaging tests, etc.\n\n"
        "Return a JSON object with this EXACT structure:\n"
        "{\n"
        "  \"type\": \"prescription|bill|test_report|lab_report|consultation_receipt|medical_record|unknown\",\n"
        "  \"prescriptionNames\": [\"medicine1\", \"medicine2\", ...],\n"
        "  \"testNames\": [\"CBC\", \"Blood Sugar\", \"X-Ray Chest\", ...],\n"
        "  \"billItems\": [\n"
        "    {\"name\": \"item_name\", \"amount\": 100.50, \"isConsultation\": false, \"isTest\": false},\n"
        "    ...\n"
        "  ],\n"
        "  \"metadata\": {\n"
        "    \"hasConsultationFee\": false,\n"
        "    \"hasTestFees\": false,\n"
        "    \"totalAmount\": 0,\n"
        "    \"itemCount\": 0\n"
        "  }\n"
        "}\n\n"
        "IMPORTANT RULES:\n"
        "- Medicine names must be complete and correctly spelled\n"
        "- Test names should be clear and standard (e.g., 'Complete Blood Count' not 'CBC test done')\n"
        "- For bills, 'amount' must be a number (not string)\n"
        "- Mark consultation fees with 'isConsultation': true\n"
        "- Mark test/lab fees with 'isTest': true\n"
        "- Use empty arrays for unused fields\n"
        "- Be thorough in extraction - don't miss any medicines, tests, or items\n"
    )

def call_gemini(image_bytes: bytes, mime: str, prompt: str, api_key: str):
    image_b64 = base64.b64encode(image_bytes).decode('utf-8')
    body = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": mime or "image/jpeg", "data": image_b64}},
            ]
        }],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    last_error = None
    for attempt in range(3):
        try:
            r = requests.post(
                f"{GEMINI_URL}?key={api_key}",
                json=body,
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            if 500 <= r.status_code < 600:
                raise requests.HTTPError(f"{r.status_code} Server Error", response=r)
            r.raise_for_status()
            data = r.json()
            text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
            cleaned = text.strip().replace('```json', '').replace('```', '')
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                return {}
        except requests.RequestException as e:
            last_error = e
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise last_error

# Cache system
_OCR_CACHE: dict[str, dict] = {}
_OCR_CACHE_KEYS: list[str] = []
_OCR_CACHE_MAX = 128

def _hash_bytes(data: bytes) -> str:
    return hashlib.sha1(data).hexdigest()

def _cache_get(cache_key: str):
    return _OCR_CACHE.get(cache_key)

def _cache_set(cache_key: str, value: dict):
    if cache_key in _OCR_CACHE:
        try:
            _OCR_CACHE_KEYS.remove(cache_key)
        except ValueError:
            pass
    _OCR_CACHE[cache_key] = value
    _OCR_CACHE_KEYS.append(cache_key)
    while len(_OCR_CACHE_KEYS) > _OCR_CACHE_MAX:
        old = _OCR_CACHE_KEYS.pop(0)
        _OCR_CACHE.pop(old, None)

def fetch_with_cache(kind: str, image_bytes: bytes, mime: str, prompt: str, api_key: str):
    key = f"{kind}:{_hash_bytes(image_bytes)}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    result = call_gemini(image_bytes, mime, prompt, api_key)
    _cache_set(key, result)
    return result

# Persistence helpers
DATASET_DIR = os.path.join(BASE_DIR, 'dataset')

def _sanitize_name(name: str) -> str:
    name = (name or '').strip()
    name = name.replace(' ', '_')
    return re.sub(r'[^A-Za-z0-9_.\-]', '', name)[:100] or 'unknown'

def _ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)

def _new_session_dir(employee: str) -> str:
    emp = _sanitize_name(employee)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    path = os.path.join(DATASET_DIR, emp, ts)
    _ensure_dir(path)
    return path

def _save_binary(path: str, data: bytes):
    with open(path, 'wb') as f:
        f.write(data)

def _save_json(path: str, obj: dict):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

@app.post('/api/ocr/auto')
def ocr_auto():
    api_key = get_api_key()
    employee = request.form.get('employee')
    files = request.files.getlist('files')
    if not files:
        return jsonify({"error": "No files provided"}), 400

    results = []
    all_prescriptions = []
    all_bills = []
    session_dir = None
    
    if employee:
        session_dir = _new_session_dir(employee)
    
    enhanced_prompt = build_enhanced_prompt()
    
    for f in files:
        filename = getattr(f, 'filename', '')
        file_bytes = f.read()
        
        if not api_key:
            # Mock mode
            fname_lower = (filename or '').lower()
            mock_type = 'bill' if any(k in fname_lower for k in ['bill', 'receipt', 'invoice']) else (
                'prescription' if any(k in fname_lower for k in ['pres', 'rx', 'doctor']) else 'unknown'
            )
            h = int(_hash_bytes(file_bytes)[:6], 16)
            presc_names = [f"Medicine-{h % 97}"] if mock_type == 'prescription' else []
            bill_items = ([{"name": f"Item-{h % 89}", "amount": float((h % 5000) / 10.0)}] if mock_type == 'bill' else [])
            data = {"type": mock_type, "prescriptionNames": presc_names, "billItems": bill_items}
        else:
            try:
                data = fetch_with_cache('enhanced_auto', file_bytes, f.mimetype, enhanced_prompt, api_key)
            except requests.RequestException as e:
                results.append({
                    "filename": filename,
                    "error": "Upstream model temporarily unavailable",
                    "detail": str(e)
                })
                continue

        # Normalize output
        typ = (data or {}).get('type') if isinstance(data, dict) else None
        presc_names = []
        test_names = []
        bill_items = []
        
        if isinstance(data, dict):
            if isinstance(data.get('prescriptionNames'), list):
                presc_names = [str(n).strip() for n in data.get('prescriptionNames') if isinstance(n, str) and n.strip()]
            if isinstance(data.get('testNames'), list):
                test_names = [str(n).strip() for n in data.get('testNames') if isinstance(n, str) and n.strip()]
            if isinstance(data.get('billItems'), list):
                for it in data.get('billItems'):
                    if isinstance(it, dict) and it.get('name'):
                        entry = {"name": str(it['name']).strip()}
                        if isinstance(it.get('amount'), (int, float)):
                            entry['amount'] = float(it['amount'])
                        entry['isConsultation'] = it.get('isConsultation', False)
                        entry['isTest'] = it.get('isTest', False)
                        bill_items.append(entry)

        # Filter prescription names
        if presc_names:
            blacklist = ['dr ', 'clinic', 'medical', 'hospital', 'chemist', 'address', 'prescription', 'rx']
            presc_names = [n for n in presc_names if not any(b in n.lower() for b in blacklist)]

        file_result = {
            "filename": filename,
            "type": typ or ('bill' if bill_items else ('test_report' if test_names else ('prescription' if presc_names else 'unknown'))),
            "prescriptionNames": presc_names,
            "testNames": test_names,
            "billItems": bill_items,
        }
        
        # Persist per-file if requested
        if session_dir:
            safe_name = _sanitize_name(filename or 'image.jpg')
            _save_binary(os.path.join(session_dir, safe_name), file_bytes)
            meta = {
                "type": file_result["type"],
                "prescriptionNames": presc_names,
                "testNames": test_names,
                "billItems": bill_items,
            }
            base_no_ext = os.path.splitext(safe_name)[0]
            _save_json(os.path.join(session_dir, f"{base_no_ext}.json"), meta)
        
        results.append(file_result)
        
        if presc_names:
            # Add to all_prescriptions, avoiding duplicates
            for name in presc_names:
                normalized = normalize_medicine_name(name)
                # Check if this medicine (normalized) is already in the list
                already_exists = any(
                    normalize_medicine_name(existing) == normalized 
                    for existing in all_prescriptions
                )
                if not already_exists:
                    all_prescriptions.append(name)
        
        if bill_items:
            all_bills.extend(bill_items)

    # Collect all tests
    all_tests = []
    for file_result in results:
        test_names = file_result.get('testNames', [])
        if test_names:
            for test_name in test_names:
                if test_name not in all_tests:
                    all_tests.append(test_name)
    
    # Perform intelligent matching
    matching_results = perform_intelligent_matching(all_prescriptions, all_bills, all_tests)
    
    summary = {
        "files": results,
        "aggregated": {
            "prescriptions": [{"names": all_prescriptions}] if all_prescriptions else [],
            "tests": [{"names": all_tests}] if all_tests else [],
            "bills": [{"items": all_bills}] if all_bills else []
        },
        "matching": matching_results
    }
    
    if session_dir:
        full_summary = {
            "employee": employee,
            "createdAt": datetime.now().isoformat(),
            **summary
        }
        _save_json(os.path.join(session_dir, 'summary.json'), full_summary)
        
        session_id = os.path.basename(session_dir)
        record_session(employee, session_id, full_summary)
        
        summary['saved'] = {"employee": employee, "sessionDir": os.path.relpath(session_dir, BASE_DIR)}
    
    return jsonify(summary)

def perform_intelligent_matching(prescriptions, bill_items, tests=None):
    """Perform intelligent fuzzy matching between prescriptions, tests and bills"""
    if tests is None:
        tests = []
    
    matched_items = []
    unmatched_prescriptions = []
    unmatched_tests = []
    inadmissible_items = []
    consultation_adjustments = []
    
    total_admissible = 0.0
    total_inadmissible = 0.0
    total_consultation_excess = 0.0
    
    # Create a copy of bill items to track which ones are matched
    remaining_bills = list(bill_items)
    
    # Track which prescriptions have been matched to avoid duplicates
    matched_prescription_names = set()
    
    # Match each prescription with bill items
    for prescription in prescriptions:
        # Normalize prescription name for comparison
        normalized_prescription = normalize_medicine_name(prescription)
        # Normalize prescription name for comparison
        normalized_prescription = normalize_medicine_name(prescription)
        
        # Skip if this prescription has already been matched (handles duplicates in prescription list)
        if normalized_prescription in matched_prescription_names:
            continue
        
        best_match, match_score = find_best_match(prescription, remaining_bills)
        
        if best_match:
            # Mark this prescription as matched
            matched_prescription_names.add(normalized_prescription)
            
            # Also mark the bill item's normalized name as matched to prevent double-matching
            normalized_bill = normalize_medicine_name(best_match['name'])
            matched_prescription_names.add(normalized_bill)
            
            # Check if it's a consultation fee
            is_consultation, allowed_amount, excess = classify_consultation_fee(
                best_match['name'], 
                best_match.get('amount', 0)
            )
            
            if is_consultation:
                if excess > 0:
                    consultation_adjustments.append({
                        "itemName": best_match['name'],
                        "prescriptionName": prescription,
                        "matchScore": round(match_score * 100, 2),
                        "billedAmount": best_match.get('amount', 0),
                        "admissibleAmount": allowed_amount,
                        "excessAmount": excess,
                        "reason": f"Consultation fee capped at ₹300. Excess amount: ₹{excess:.2f}"
                    })
                    total_admissible += allowed_amount
                    total_consultation_excess += excess
                else:
                    matched_items.append({
                        "prescriptionName": prescription,
                        "billItemName": best_match['name'],
                        "amount": best_match.get('amount', 0),
                        "matchScore": round(match_score * 100, 2),
                        "status": "admissible",
                        "isConsultation": True
                    })
                    total_admissible += best_match.get('amount', 0)
            else:
                matched_items.append({
                    "prescriptionName": prescription,
                    "billItemName": best_match['name'],
                    "amount": best_match.get('amount', 0),
                    "matchScore": round(match_score * 100, 2),
                    "status": "admissible"
                })
                total_admissible += best_match.get('amount', 0)
            
            # Remove matched item from remaining bills
            remaining_bills.remove(best_match)
        else:
            # Only add to unmatched if this prescription name hasn't been matched yet
            if normalized_prescription not in matched_prescription_names:
                unmatched_prescriptions.append({
                    "prescriptionName": prescription,
                    "status": "not_billed",
                    "reason": "No matching item found in bills. Medicine prescribed but not purchased or bill not provided."
                })
                matched_prescription_names.add(normalized_prescription)
    
    # Match tests with bill items
    matched_test_names = set()
    for test_name in tests:
        normalized_test = normalize_medicine_name(test_name)
        
        # Skip if already matched
        if normalized_test in matched_test_names:
            continue
        
        best_match, match_score = find_best_match(test_name, remaining_bills, threshold=0.7)
        
        if best_match:
            matched_test_names.add(normalized_test)
            
            matched_items.append({
                "prescriptionName": f"Test: {test_name}",
                "billItemName": best_match['name'],
                "amount": best_match.get('amount', 0),
                "matchScore": round(match_score * 100, 2),
                "status": "admissible",
                "isTest": True
            })
            total_admissible += best_match.get('amount', 0)
            
            remaining_bills.remove(best_match)
        else:
            if normalized_test not in matched_test_names:
                unmatched_tests.append({
                    "testName": test_name,
                    "status": "not_billed",
                    "reason": "Test prescribed but not found in bills or test report without corresponding bill."
                })
                matched_test_names.add(normalized_test)
    
    # Process remaining unmatched bill items as inadmissible
    for bill_item in remaining_bills:
        # Check if it's a consultation fee
        is_consultation, allowed_amount, excess = classify_consultation_fee(
            bill_item['name'], 
            bill_item.get('amount', 0)
        )
        
        if is_consultation:
            if excess > 0:
                consultation_adjustments.append({
                    "itemName": bill_item['name'],
                    "prescriptionName": None,
                    "matchScore": 0,
                    "billedAmount": bill_item.get('amount', 0),
                    "admissibleAmount": allowed_amount,
                    "excessAmount": excess,
                    "reason": f"Consultation fee capped at ₹300. Excess amount: ₹{excess:.2f}"
                })
                total_admissible += allowed_amount
                total_consultation_excess += excess
            else:
                matched_items.append({
                    "prescriptionName": "Consultation Fee",
                    "billItemName": bill_item['name'],
                    "amount": bill_item.get('amount', 0),
                    "matchScore": 100,
                    "status": "admissible",
                    "isConsultation": True
                })
                total_admissible += bill_item.get('amount', 0)
        else:
            inadmissible_items.append({
                "billItemName": bill_item['name'],
                "amount": bill_item.get('amount', 0),
                "status": "inadmissible",
                "reason": "Item not found in prescription. May be over-the-counter purchase or non-prescribed item."
            })
            total_inadmissible += bill_item.get('amount', 0)
    
    return {
        "matchedItems": matched_items,
        "unmatchedPrescriptions": unmatched_prescriptions,
        "unmatchedTests": unmatched_tests,
        "inadmissibleItems": inadmissible_items,
        "consultationAdjustments": consultation_adjustments,
        "summary": {
            "totalPrescriptions": len(prescriptions),
            "totalTests": len(tests),
            "totalBillItems": len(bill_items),
            "matchedCount": len(matched_items),
            "unmatchedPrescriptionCount": len(unmatched_prescriptions),
            "unmatchedTestCount": len(unmatched_tests),
            "inadmissibleCount": len(inadmissible_items),
            "totalAdmissibleAmount": round(total_admissible, 2),
            "totalInadmissibleAmount": round(total_inadmissible, 2),
            "totalConsultationExcess": round(total_consultation_excess, 2),
            "totalAmount": round(total_admissible + total_inadmissible + total_consultation_excess, 2)
        }
    }

# Health and utility routes
@app.get('/api/health')
def health():
    key_present = bool(get_api_key())
    return jsonify({"ok": True, "hasKey": key_present})

@app.route('/')
def index():
    return render_template('index.html')

@app.get('/employees')
def employees_page():
    return render_template('employees.html')

@app.get('/api/datasets')
def list_datasets():
    employee = request.args.get('employee', '').strip()
    limit = request.args.get('limit', type=int) or 100
    offset = request.args.get('offset', type=int) or 0
    force_sync = request.args.get('sync', '').lower() == 'true'
    
    if force_sync or not employee:
        sync_database_with_filesystem()
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            
            if not employee:
                cursor = conn.execute('''
                    SELECT name, total_sessions, total_files, total_amount, last_activity
                    FROM employees 
                    ORDER BY last_activity DESC
                    LIMIT ? OFFSET ?
                ''', (limit, offset))
                
                employees_data = []
                for row in cursor.fetchall():
                    employees_data.append({
                        'name': row['name'],
                        'sessionCount': row['total_sessions'],
                        'fileCount': row['total_files'],
                        'totalAmount': row['total_amount'],
                        'lastActivity': row['last_activity']
                    })
                
                total_cursor = conn.execute('SELECT COUNT(*) FROM employees')
                total = total_cursor.fetchone()[0]
                
                return jsonify({
                    "employees": [emp['name'] for emp in employees_data],
                    "employeesWithStats": employees_data,
                    "sessions": [], 
                    "total": total,
                    "hasMore": offset + limit < total,
                    "offset": offset,
                    "limit": limit
                })
            
            else:
                cursor = conn.execute('''
                    SELECT session_id, created_at, file_count, prescription_count, 
                           bill_count, total_amount
                    FROM sessions 
                    WHERE employee_name = ? 
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                ''', (employee, limit, offset))
                
                sessions_data = []
                for row in cursor.fetchall():
                    emp_dir = os.path.join(DATASET_DIR, _sanitize_name(employee))
                    sess_dir = os.path.join(emp_dir, row['session_id'])
                    summary = None
                    
                    if os.path.isdir(sess_dir):
                        summary_path = os.path.join(sess_dir, 'summary.json')
                        if os.path.isfile(summary_path):
                            try:
                                with open(summary_path, 'r', encoding='utf-8') as f:
                                    summary = json.load(f)
                            except Exception as e:
                                print(f"Error loading summary: {e}")
                    
                    sessions_data.append({
                        "session": row['session_id'],
                        "summary": summary,
                        "stats": {
                            "fileCount": row['file_count'],
                            "prescriptionCount": row['prescription_count'],
                            "billCount": row['bill_count'],
                            "totalAmount": row['total_amount'],
                            "createdAt": row['created_at']
                        }
                    })
                
                total_cursor = conn.execute(
                    'SELECT COUNT(*) FROM sessions WHERE employee_name = ?', 
                    (employee,)
                )
                total = total_cursor.fetchone()[0]
                
                return jsonify({
                    "employees": [employee],
                    "sessions": sessions_data,
                    "total": total,
                    "hasMore": offset + limit < total,
                    "offset": offset,
                    "limit": limit
                })
                
    except Exception as e:
        print(f"Database query failed: {e}")
        return jsonify({"employees": [], "sessions": [], "total": 0, "hasMore": False})

@app.get('/api/datasets/<employee>/<session_id>')
def get_dataset_summary(employee: str, session_id: str):
    emp_dir = os.path.join(DATASET_DIR, _sanitize_name(employee))
    sess_dir = os.path.join(emp_dir, _sanitize_name(session_id))
    if not os.path.isdir(sess_dir):
        return jsonify({"error": "Not found"}), 404
    summary_path = os.path.join(sess_dir, 'summary.json')
    summary = None
    try:
        if os.path.isfile(summary_path):
            with open(summary_path, 'r', encoding='utf-8') as f:
                summary = json.load(f)
    except Exception:
        summary = None
    files = []
    for fn in os.listdir(sess_dir):
        files.append(fn)
    return jsonify({
        "employee": employee,
        "session": session_id,
        "summary": summary,
        "files": files,
    })

@app.get('/api/analytics/overview')
def analytics_overview():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            
            cursor = conn.execute('''
                SELECT 
                    COUNT(DISTINCT name) as total_employees,
                    SUM(total_sessions) as total_sessions,
                    SUM(total_files) as total_files,
                    SUM(total_amount) as total_amount
                FROM employees
            ''')
            totals = cursor.fetchone()
            
            one_week_ago = (datetime.now() - timedelta(days=7)).isoformat()
            cursor = conn.execute('''
                SELECT COUNT(*) as recent_activity
                FROM sessions 
                WHERE created_at > ?
            ''', (one_week_ago,))
            recent_activity = cursor.fetchone()['recent_activity']
            
            thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
            cursor = conn.execute('''
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as sessions,
                    SUM(file_count) as files,
                    SUM(total_amount) as amount
                FROM sessions 
                WHERE created_at > ?
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            ''', (thirty_days_ago,))
            
            daily_stats = []
            for row in cursor.fetchall():
                daily_stats.append({
                    'date': row['date'],
                    'sessions': row['sessions'],
                    'files': row['files'] or 0,
                    'amount': round(row['amount'] or 0, 2)
                })
            
            return jsonify({
                "totalEmployees": totals['total_employees'] or 0,
                "totalSessions": totals['total_sessions'] or 0,
                "totalFiles": totals['total_files'] or 0,
                "totalAmount": round(totals['total_amount'] or 0, 2),
                "recentActivity": recent_activity,
                "dailyStats": daily_stats
            })
            
    except Exception as e:
        print(f"Analytics failed: {e}")
        return jsonify({
            "totalEmployees": 0,
            "totalSessions": 0,
            "totalFiles": 0,
            "totalAmount": 0,
            "recentActivity": 0,
            "dailyStats": [],
            "error": "Analytics unavailable"
        })

@app.get('/api/search/employees')
def search_employees():
    query = request.args.get('q', '').strip().lower()
    limit = request.args.get('limit', type=int) or 20
    
    if not query:
        return jsonify({"employees": []})
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            
            cursor = conn.execute('''
                SELECT name, total_sessions, total_files, total_amount, last_activity
                FROM employees 
                WHERE LOWER(name) LIKE ? 
                ORDER BY 
                    CASE WHEN LOWER(name) LIKE ? THEN 1 ELSE 2 END,
                    total_sessions DESC
                LIMIT ?
            ''', (f'%{query}%', f'{query}%', limit))
            
            employees = []
            for row in cursor.fetchall():
                employees.append({
                    'name': row['name'],
                    'sessionCount': row['total_sessions'],
                    'fileCount': row['total_files'],
                    'totalAmount': row['total_amount'],
                    'lastActivity': row['last_activity'],
                    'relevance': 1 if row['name'].lower().startswith(query) else 0.5
                })
            
            return jsonify({"employees": employees})
            
    except Exception as e:
        return jsonify({"error": f"Search failed: {str(e)}"}), 500

@app.route('/api/sync', methods=['POST'])
def sync_database():
    try:
        changes_made = sync_database_with_filesystem()
        return jsonify({
            "status": "success",
            "message": "Database synchronized with filesystem",
            "changes_made": changes_made
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/cleanup', methods=['POST'])
def cleanup_database():
    try:
        remove_empty_dirs = request.get_json().get('removeEmptyDirs', False) if request.is_json else False
        
        changes_made = sync_database_with_filesystem()
        
        removed_dirs = 0
        if remove_empty_dirs:
            dataset_dir = os.path.join(BASE_DIR, 'dataset')
            if os.path.exists(dataset_dir):
                for item in os.listdir(dataset_dir):
                    item_path = os.path.join(dataset_dir, item)
                    if os.path.isdir(item_path):
                        try:
                            os.rmdir(item_path)
                            removed_dirs += 1
                        except OSError:
                            pass
        
        return jsonify({
            "status": "success", 
            "message": "Database cleanup completed",
            "database_changes": changes_made,
            "removed_directories": removed_dirs
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/sw.js')
def service_worker():
    return send_from_directory('static', 'sw.js', mimetype='application/javascript')

@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json', mimetype='application/json')

@app.route('/api/performance', methods=['POST'])
def track_performance():
    try:
        data = request.get_json()
        print(f"Performance data: {data}")
        return jsonify({"status": "recorded"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)