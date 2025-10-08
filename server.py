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
import io
from PIL import Image
from claim_form_processor import (
    extract_claim_form_data,
    cross_verify_claim,
    format_verification_report
)

# PDF Processing - PyMuPDF only
try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    print("ERROR: PyMuPDF not installed. Install with: pip install PyMuPDF")

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Database setup with enhanced caching
DB_PATH = os.path.join(BASE_DIR, 'med_claim_data.db')
db_lock = threading.Lock()

def init_database():
    """Initialize SQLite database with enhanced caching tables"""
    with sqlite3.connect(DB_PATH) as conn:
        # Existing tables
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
        
        # NEW: Document cache table for persistent extraction results
        conn.execute('''
            CREATE TABLE IF NOT EXISTS document_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_hash TEXT UNIQUE NOT NULL,
                filename TEXT NOT NULL,
                file_type TEXT NOT NULL,
                extraction_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                access_count INTEGER DEFAULT 1
            )
        ''')
        
        # NEW: Extraction memory table for learning patterns
        conn.execute('''
            CREATE TABLE IF NOT EXISTS extraction_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_type TEXT NOT NULL,
                original_text TEXT NOT NULL,
                normalized_text TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                confidence REAL DEFAULT 1.0,
                times_seen INTEGER DEFAULT 1,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Indexes for performance
        conn.execute('CREATE INDEX IF NOT EXISTS idx_employee_name ON sessions(employee_name)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_created_at ON sessions(created_at)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_file_hash ON document_cache(file_hash)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_extraction_memory_type ON extraction_memory(document_type, entity_type)')
        
        conn.commit()

init_database()

# Enhanced API Configuration with Grounding
GEMINI_API_VERSION = "v1beta"
GEMINI_MODEL = "gemini-2.5-pro"
GEMINI_URL = f"https://generativelanguage.googleapis.com/{GEMINI_API_VERSION}/models/{GEMINI_MODEL}:generateContent"

# NEW: Grounding configuration for improved accuracy
GROUNDING_CONFIG = {
    "google_search_retrieval": {
        "dynamic_retrieval_config": {
            "mode": "MODE_DYNAMIC",
            "dynamic_threshold": 0.7
        }
    }
}

def get_api_key() -> str:
    global _ENV_LOADED
    if load_dotenv and not globals().get('_ENV_LOADED'):
        load_dotenv(os.path.join(BASE_DIR, '.env'))
        _ENV_LOADED = True
    api_key = os.getenv('GEMINI_API_KEY', '')
    # Remove quotes if present
    return api_key.strip('"').strip("'")

# Enhanced Document Hash with Persistent Memory
def _hash_document(data: bytes, filename: str = "") -> str:
    """Create a unique hash for a document including filename"""
    hasher = hashlib.sha256()
    hasher.update(data)
    if filename:
        hasher.update(filename.encode('utf-8'))
    return hasher.hexdigest()

# Document Cache Management
def get_cached_extraction(file_hash: str):
    """Retrieve cached extraction results from database"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute('''
                SELECT extraction_data, created_at 
                FROM document_cache 
                WHERE file_hash = ?
            ''', (file_hash,))
            
            row = cursor.fetchone()
            if row:
                # Update access stats
                conn.execute('''
                    UPDATE document_cache 
                    SET last_accessed = ?, access_count = access_count + 1
                    WHERE file_hash = ?
                ''', (datetime.now().isoformat(), file_hash))
                conn.commit()
                
                extraction_data = json.loads(row['extraction_data'])
                print(f"✅ Cache HIT for document {file_hash[:8]}...")
                return extraction_data
            
            print(f"❌ Cache MISS for document {file_hash[:8]}...")
            return None
    except Exception as e:
        print(f"Cache retrieval error: {e}")
        return None

def cache_extraction(file_hash: str, filename: str, file_type: str, extraction_data: dict):
    """Cache extraction results in database"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute('''
                INSERT OR REPLACE INTO document_cache 
                (file_hash, filename, file_type, extraction_data, created_at, last_accessed)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                file_hash,
                filename,
                file_type,
                json.dumps(extraction_data),
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            conn.commit()
            print(f"💾 Cached extraction for {filename}")
    except Exception as e:
        print(f"Cache storage error: {e}")

# Learning Memory System
def learn_from_extraction(document_type: str, entities: list, entity_type: str):
    """Learn and store extraction patterns for future improvements"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            for entity in entities:
                if isinstance(entity, dict):
                    entity_text = entity.get('name', str(entity))
                else:
                    entity_text = str(entity)
                
                normalized = normalize_medicine_name(entity_text)
                
                # Check if we've seen this before
                cursor = conn.execute('''
                    SELECT id, times_seen, confidence 
                    FROM extraction_memory 
                    WHERE document_type = ? AND normalized_text = ? AND entity_type = ?
                ''', (document_type, normalized, entity_type))
                
                row = cursor.fetchone()
                if row:
                    # Update existing entry
                    new_times = row[1] + 1
                    new_confidence = min(1.0, row[2] + 0.05)  # Increase confidence
                    conn.execute('''
                        UPDATE extraction_memory 
                        SET times_seen = ?, confidence = ?, last_seen = ?
                        WHERE id = ?
                    ''', (new_times, new_confidence, datetime.now().isoformat(), row[0]))
                else:
                    # Create new entry
                    conn.execute('''
                        INSERT INTO extraction_memory 
                        (document_type, original_text, normalized_text, entity_type, confidence)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (document_type, entity_text, normalized, entity_type, 0.8))
            
            conn.commit()
    except Exception as e:
        print(f"Learning error: {e}")

def get_learned_patterns(document_type: str, entity_type: str, limit: int = 100):
    """Retrieve learned patterns for better extraction"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute('''
                SELECT original_text, normalized_text, confidence, times_seen
                FROM extraction_memory 
                WHERE document_type = ? AND entity_type = ?
                ORDER BY confidence DESC, times_seen DESC
                LIMIT ?
            ''', (document_type, entity_type, limit))
            
            patterns = []
            for row in cursor.fetchall():
                patterns.append({
                    'original': row['original_text'],
                    'normalized': row['normalized_text'],
                    'confidence': row['confidence'],
                    'frequency': row['times_seen']
                })
            
            return patterns
    except Exception as e:
        print(f"Pattern retrieval error: {e}")
        return []

# Enhanced Prompt with Learning Integration
def build_enhanced_prompt_with_context(document_type_hint: str = None) -> str:
    """Build enhanced prompt with learned patterns and context"""
    
    base_prompt = """You are an expert medical document analyzer with advanced pattern recognition.

CRITICAL INSTRUCTIONS FOR CONSISTENT EXTRACTION:

1. ALWAYS extract the SAME information from the SAME document
2. Use EXACT text matching - don't paraphrase or reword
3. Extract ALL items even if similar to previous documents
4. Maintain consistency across multiple analyses

DOCUMENT CLASSIFICATION:
Carefully examine and classify as:
- 'claim_form' - Medical reimbursement form with employee details and claim table
- 'prescription' - Doctor's prescription with Rx symbol, medicine names WITHOUT prices
- 'bill' - Pharmacy/medical bill with items AND prices
- 'test_report' - Lab/diagnostic test results
- 'consultation_receipt' - Doctor consultation fee receipt

EXTRACTION RULES:

FOR CLAIM FORMS:
- Extract ALL text including table data
- Capture employee details, claim numbers, treatment dates
- Return in 'rawText' field for structured processing

FOR PRESCRIPTIONS:
- Extract EVERY medicine name mentioned
- Include brand names, generic names, and dosages
- EXCLUDE: doctor names, clinic info, addresses
- NO PRICES (if prices exist, it's a bill, not prescription)

FOR BILLS:
- Extract EVERY line item with its exact amount
- Mark consultation fees: "isConsultation": true
- Mark test fees: "isTest": true
- Include medicine names AS WRITTEN on bill
- Capture subtotals and totals

FOR TEST REPORTS:
- Extract all test names (CBC, Blood Sugar, X-Ray, etc.)
- Include diagnostic procedure names
- DO NOT confuse with test bills

CONSISTENCY GUARANTEE:
- Same document → Same extraction results ALWAYS
- Don't skip items you've seen before
- Use exact text from document
- Complete extraction every time

"""

    # Add learned patterns if available
    if document_type_hint:
        patterns = get_learned_patterns(document_type_hint, 'medicine', limit=20)
        if patterns:
            base_prompt += f"\n\nLEARNED PATTERNS for {document_type_hint}:\n"
            base_prompt += "Common medicine names you've seen before:\n"
            for p in patterns[:10]:
                base_prompt += f"- {p['original']} (confidence: {p['confidence']:.0%})\n"

    base_prompt += """

RETURN FORMAT - STRICT JSON:
{
  "type": "claim_form|prescription|bill|test_report|consultation_receipt|unknown",
  "rawText": "",
  "prescriptionNames": [],
  "testNames": [],
  "billItems": [
    {"name": "item", "amount": 0.0, "isConsultation": false, "isTest": false}
  ]
}

Extract NOW with maximum accuracy and consistency!"""

    return base_prompt

# Enhanced Gemini API call with Grounding
def call_gemini_with_grounding(image_bytes: bytes, mime: str, prompt: str, api_key: str, use_grounding: bool = True):
    """Enhanced Gemini API call with grounding support for medical accuracy"""
    image_b64 = base64.b64encode(image_bytes).decode('utf-8')
    
    body = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": mime or "image/jpeg", "data": image_b64}},
            ]
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,  # Lower temperature for consistency
            "topK": 1,
            "topP": 0.8
        }
    }
    
    # Add grounding for medical terminology accuracy
    if use_grounding:
        body["tools"] = [GROUNDING_CONFIG]
    
    last_error = None
    for attempt in range(3):
        try:
            r = requests.post(
                f"{GEMINI_URL}?key={api_key}",
                json=body,
                headers={"Content-Type": "application/json"},
                timeout=60,  # Increased timeout for grounding
            )
            
            if 500 <= r.status_code < 600:
                raise requests.HTTPError(f"{r.status_code} Server Error", response=r)
            
            r.raise_for_status()
            data = r.json()
            
            # Extract text from response
            text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
            cleaned = text.strip().replace('```json', '').replace('```', '')
            
            try:
                result = json.loads(cleaned)
                
                # Extract grounding metadata if available
                grounding_metadata = data.get('candidates', [{}])[0].get('groundingMetadata', {})
                if grounding_metadata:
                    result['_grounding'] = {
                        'used': True,
                        'citations': grounding_metadata.get('webSearchQueries', []),
                        'confidence': grounding_metadata.get('retrievalScore', 0)
                    }
                
                return result
            except json.JSONDecodeError:
                print(f"JSON decode error on attempt {attempt + 1}")
                if attempt == 2:
                    return {}
                continue
                
        except requests.RequestException as e:
            last_error = e
            print(f"❌ API Error (attempt {attempt + 1}/3): {str(e)[:100]}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"   Response: {e.response.text[:200]}")
            if attempt < 2:
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"   Retrying after {wait_time}s...")
                time.sleep(wait_time)
                continue
            print(f"❌ All retry attempts failed. Last error: {str(e)}")
            raise last_error

# Word Document Processing - Removed (not needed for medical claims)

# Enhanced PDF Processing
def extract_images_from_pdf(pdf_bytes: bytes) -> list:
    """Enhanced PDF extraction with better error handling"""
    images = []
    
    if PYMUPDF_AVAILABLE:
        try:
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                page = pdf_document[page_num]
                mat = fitz.Matrix(2.5, 2.5)  # Higher resolution
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                
                images.append({
                    'bytes': img_bytes,
                    'mime': 'image/png',
                    'page': page_num + 1,
                    'source': 'pymupdf'
                })
            
            pdf_document.close()
            print(f"✅ Extracted {len(images)} pages from PDF (PyMuPDF)")
            return images
            
        except Exception as e:
            print(f"PyMuPDF error: {e}")
            return []
    
    return images

# Enhanced File Processing with All Document Types
def process_file_universal(file_obj) -> list:
    """Universal file processor for images, PDFs, and Word documents"""
    filename = getattr(file_obj, 'filename', '')
    file_bytes = file_obj.read()
    mime_type = file_obj.mimetype or ''
    
    results = []
    file_hash = _hash_document(file_bytes, filename)
    
    # Check cache first
    cached = get_cached_extraction(file_hash)
    if cached:
        results.append({
            'bytes': file_bytes,
            'mime': mime_type,
            'filename': filename,
            'original_filename': filename,
            'file_hash': file_hash,
            'cached_data': cached,
            'from_cache': True
        })
        return results
    
    # PDF Processing
    if mime_type == 'application/pdf' or filename.lower().endswith('.pdf'):
        print(f"📄 Processing PDF: {filename}")
        images = extract_images_from_pdf(file_bytes)
        
        if not images:
            results.append({
                'bytes': None,
                'mime': 'application/pdf',
                'filename': filename,
                'original_filename': filename,
                'file_hash': file_hash,
                'error': 'PDF_EXTRACTION_FAILED'
            })
        else:
            for img_data in images:
                results.append({
                    'bytes': img_data['bytes'],
                    'mime': img_data['mime'],
                    'filename': f"{filename}_page_{img_data['page']}",
                    'original_filename': filename,
                    'page': img_data['page'],
                    'file_hash': f"{file_hash}_p{img_data['page']}",
                    'is_pdf': True
                })
    
    # Word Document Processing - Removed (not supported)
    
    # Regular Image Processing
    else:
        results.append({
            'bytes': file_bytes,
            'mime': mime_type,
            'filename': filename,
            'original_filename': filename,
            'file_hash': file_hash,
            'is_image': True
        })
    
    return results

# Normalized medicine matching (keeping from original)
def normalize_medicine_name(name):
    """Enhanced normalize medicine names for better matching"""
    if not name:
        return ""
    
    name = name.lower().strip()
    
    # Remove dosage and forms
    name = re.sub(r'\s*spf\s*\d+\s*%?\s*', ' ', name)
    name = re.sub(r'\s*\d+\s*%\s*', ' ', name)
    name = re.sub(r'\s*\d+\s*mg\s*', ' ', name)
    name = re.sub(r'\s*\d+\s*gm\s*', ' ', name)
    name = re.sub(r'\s*\d+\s*ml\s*', ' ', name)
    name = re.sub(r'\s*\d+\s*mcg\s*', ' ', name)
    
    # Remove product types
    product_types = ['tab', 'tablet', 'tabs', 'cap', 'capsule', 'caps', 'syrup', 'syp', 
                     'inj', 'injection', 'susp', 'suspension', 'drops', 'sol', 'solution', 
                     'cream', 'ointment', 'oint', 'lotion', 'gel', 'balm']
    
    words = name.split()
    words = [w for w in words if w not in product_types]
    name = ' '.join(words)
    
    # Remove special characters
    name = re.sub(r'[^\w\s]', ' ', name)
    name = ' '.join(name.split())
    
    return name

def fuzzy_match_score(str1, str2):
    """Enhanced fuzzy matching with learning"""
    if not str1 or not str2:
        return 0.0
    
    s1 = normalize_medicine_name(str1)
    s2 = normalize_medicine_name(str2)
    
    if s1 == s2:
        return 1.0
    
    if not s1 or not s2:
        return 0.0
    
    # Base similarity
    base_score = SequenceMatcher(None, s1, s2).ratio()
    
    # Word-level matching
    words1 = set(s1.split())
    words2 = set(s2.split())
    
    if words1 and words2:
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        jaccard_score = len(intersection) / len(union) if union else 0
        
        if len(intersection) > 0:
            word_overlap_ratio = len(intersection) / max(len(words1), len(words2))
            word_score = max(jaccard_score, word_overlap_ratio) * 0.95
            base_score = max(base_score, word_score)
    
    return base_score

def find_best_match(medicine_name, bill_items, threshold=0.55):
    """Find best matching bill item"""
    best_match = None
    best_score = 0.0
    
    for item in bill_items:
        item_name = item.get('name', '')
        score = fuzzy_match_score(medicine_name, item_name)
        
        if score > best_score and score >= threshold:
            best_score = score
            best_match = item
    
    return best_match, best_score

# Main OCR endpoint with all enhancements
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
    all_tests = []
    claim_form_data = None
    session_dir = None
    
    if employee:
        session_dir = _new_session_dir(employee)
    
    # Process each file
    for f in files:
        processed_files = process_file_universal(f)
        
        for proc_file in processed_files:
            filename = proc_file['filename']
            file_hash = proc_file.get('file_hash')
            
            # Check if we have cached data
            if proc_file.get('from_cache'):
                cached_data = proc_file['cached_data']
                results.append({
                    "filename": filename,
                    "type": cached_data.get('type'),
                    "prescriptionNames": cached_data.get('prescriptionNames', []),
                    "testNames": cached_data.get('testNames', []),
                    "billItems": cached_data.get('billItems', []),
                    "fromCache": True
                })
                
                # Add to aggregation
                if cached_data.get('prescriptionNames'):
                    all_prescriptions.extend(cached_data['prescriptionNames'])
                if cached_data.get('billItems'):
                    all_bills.extend(cached_data['billItems'])
                if cached_data.get('testNames'):
                    all_tests.extend(cached_data['testNames'])
                
                continue
            
            # Check for errors
            if 'error' in proc_file:
                results.append({
                    "filename": filename,
                    "error": proc_file['error'],
                    "prescriptionNames": [],
                    "testNames": [],
                    "billItems": []
                })
                continue
            
            file_bytes = proc_file.get('bytes')
            if not file_bytes:
                continue
            
            mime_type = proc_file['mime']
            
            # Build enhanced prompt
            enhanced_prompt = build_enhanced_prompt_with_context()
            
            # Call Gemini API (grounding disabled - not supported with all API keys)
            try:
                data = call_gemini_with_grounding(
                    file_bytes, 
                    mime_type, 
                    enhanced_prompt, 
                    api_key,
                    use_grounding=False  # Disabled: Search Grounding requires specific API access
                )
            except Exception as e:
                results.append({
                    "filename": filename,
                    "error": f"API Error: {str(e)}",
                    "prescriptionNames": [],
                    "testNames": [],
                    "billItems": []
                })
                continue
            
            # Process results
            typ = data.get('type', 'unknown')
            presc_names = data.get('prescriptionNames', [])
            test_names = data.get('testNames', [])
            bill_items = data.get('billItems', [])
            
            # Handle claim forms
            if typ == 'claim_form':
                raw_text = data.get('rawText', '')
                if raw_text and not claim_form_data:
                    claim_form_data = extract_claim_form_data(raw_text)
            
            # Cache the extraction
            cache_extraction(file_hash, filename, typ, {
                'type': typ,
                'prescriptionNames': presc_names,
                'testNames': test_names,
                'billItems': bill_items
            })
            
            # Learn from extraction
            if presc_names:
                learn_from_extraction('prescription', presc_names, 'medicine')
                all_prescriptions.extend(presc_names)
            if bill_items:
                learn_from_extraction('bill', bill_items, 'medicine')
                all_bills.extend(bill_items)
            if test_names:
                learn_from_extraction('test_report', test_names, 'test')
                all_tests.extend(test_names)
            
            results.append({
                "filename": filename,
                "type": typ,
                "prescriptionNames": presc_names,
                "testNames": test_names,
                "billItems": bill_items,
                "fromCache": False
            })
    
    # Perform matching
    matching_results = perform_intelligent_matching(all_prescriptions, all_bills, all_tests)
    
    # Cross-verify with claim form if present
    verification_results = None
    if claim_form_data:
        try:
            extracted_data = {
                'matching': matching_results,
                'prescriptions': all_prescriptions,
                'bills': all_bills,
                'tests': all_tests
            }
            verification_results = cross_verify_claim(claim_form_data, extracted_data)
        except Exception as e:
            print(f"Verification error: {e}")
    
    summary = {
        "files": results,
        "aggregated": {
            "prescriptions": [{"names": all_prescriptions}] if all_prescriptions else [],
            "tests": [{"names": all_tests}] if all_tests else [],
            "bills": [{"items": all_bills}] if all_bills else []
        },
        "matching": matching_results,
        "claimForm": claim_form_data,
        "verification": verification_results
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
    """Enhanced intelligent matching with deduplication and vaccination support"""
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
    
    # Filter out non-medicine bill items (totals, taxes, etc.)
    filtered_bills = []
    exclude_keywords = [
        'total', 'subtotal', 'sub total', 'grand total',
        'cgst', 'sgst', 'igst', 'gst', 'tax', 'vat',
        'amount before', 'net amount', 'round off', 'rounding',
        'discount', 'payment', 'balance', 'due'
    ]
    
    for item in bill_items:
        item_name_lower = item.get('name', '').lower()
        # Skip if it's a total/tax line
        if any(keyword in item_name_lower for keyword in exclude_keywords):
            continue
        # Skip empty or very short names
        if len(item_name_lower.strip()) < 3:
            continue
        filtered_bills.append(item)
    
    remaining_bills = list(filtered_bills)
    matched_prescription_names = set()
    matched_bill_names = set()
    
    # Remove duplicate prescriptions
    unique_prescriptions = []
    seen_normalized = set()
    for presc in prescriptions:
        normalized = normalize_medicine_name(presc)
        if normalized and normalized not in seen_normalized:
            unique_prescriptions.append(presc)
            seen_normalized.add(normalized)
    
    # Match prescriptions
    for prescription in unique_prescriptions:
        normalized_prescription = normalize_medicine_name(prescription)
        
        if normalized_prescription in matched_prescription_names:
            continue
        
        best_match, match_score = find_best_match(prescription, remaining_bills)
        
        if best_match:
            matched_prescription_names.add(normalized_prescription)
            normalized_bill = normalize_medicine_name(best_match['name'])
            matched_bill_names.add(normalized_bill)
            
            # Check consultation fee
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
                        "reason": f"Consultation fee capped at ₹300. Excess: ₹{excess:.2f}"
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
            
            remaining_bills.remove(best_match)
        else:
            if normalized_prescription not in matched_prescription_names:
                unmatched_prescriptions.append({
                    "prescriptionName": prescription,
                    "status": "not_billed",
                    "reason": "No matching bill found"
                })
                matched_prescription_names.add(normalized_prescription)
    
    # Match tests
    unique_tests = list(set(tests))
    matched_test_names = set()
    
    for test_name in unique_tests:
        normalized_test = normalize_medicine_name(test_name)
        
        if normalized_test in matched_test_names:
            continue
        
        best_match, match_score = find_best_match(test_name, remaining_bills, threshold=0.55)
        
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
                    "reason": "Test not found in bills"
                })
                matched_test_names.add(normalized_test)
    
    # Process remaining bills (remove duplicates)
    processed_bill_names = set()
    
    for bill_item in remaining_bills:
        normalized_bill = normalize_medicine_name(bill_item['name'])
        
        # Skip if already processed (remove duplicates)
        if normalized_bill in processed_bill_names or normalized_bill in matched_bill_names:
            continue
        
        processed_bill_names.add(normalized_bill)
        
        # Check if vaccination
        if is_vaccination(bill_item['name']):
            matched_items.append({
                "prescriptionName": "Vaccination",
                "billItemName": bill_item['name'],
                "amount": bill_item.get('amount', 0),
                "matchScore": 100,
                "status": "admissible",
                "isVaccination": True
            })
            total_admissible += bill_item.get('amount', 0)
            continue
        
        # Check if consultation fee
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
                    "reason": f"Consultation fee capped at ₹300. Excess: ₹{excess:.2f}"
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
                "reason": "Item not found in prescription"
            })
            total_inadmissible += bill_item.get('amount', 0)
    
    return {
        "matchedItems": matched_items,
        "unmatchedPrescriptions": unmatched_prescriptions,
        "unmatchedTests": unmatched_tests,
        "inadmissibleItems": inadmissible_items,
        "consultationAdjustments": consultation_adjustments,
        "summary": {
            "totalPrescriptions": len(unique_prescriptions),
            "totalTests": len(unique_tests),
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

def is_vaccination(item_name):
    """Check if item is a vaccination/vaccine"""
    vaccination_keywords = [
        'vaccin', 'vaccine', 'immunization', 'immunisation',
        'varilrix', 'influrate', 'fluarix', 'influvac',
        'pentavac', 'hexavac', 'tdap', 'mmr', 'bcg',
        'hepatitis', 'rotavirus', 'pneumococcal', 'hpv',
        'meningococcal', 'typhoid', 'cholera', 'rabies'
    ]
    
    normalized_name = normalize_medicine_name(item_name).lower()
    return any(keyword in normalized_name for keyword in vaccination_keywords)

def classify_consultation_fee(item_name, amount):
    """Check if consultation fee and validate amount"""
    consultation_keywords = [
        'consultation', 'doctor fee', 'doctor charge', 'consulting', 
        'visit', 'opd', 'dr fee', 'dr charge', 'physician fee'
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

# Helper functions
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

def _save_json(path: str, obj: dict):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

def update_employee_stats(employee_name):
    """Update employee statistics"""
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

def record_session(employee_name, session_id, summary_data):
    """Record session in database"""
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

DATASET_DIR = os.path.join(BASE_DIR, 'dataset')

# API Endpoints
@app.get('/api/health')
def health():
    key_present = bool(get_api_key())
    return jsonify({
        "ok": True, 
        "hasKey": key_present,
        "features": {
            "pdfSupport": PYMUPDF_AVAILABLE,
            "groundingEnabled": True,
            "cachingEnabled": True,
            "learningEnabled": True
        }
    })

@app.route('/')
def index():
    return render_template('index.html')

@app.get('/employees')
def employees_page():
    return render_template('employees.html')

@app.get('/api/cache/stats')
def cache_stats():
    """Get cache statistics"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.execute('''
                SELECT 
                    COUNT(*) as total_cached,
                    SUM(access_count) as total_accesses,
                    AVG(access_count) as avg_accesses
                FROM document_cache
            ''')
            stats = cursor.fetchone()
            
            return jsonify({
                "totalCached": stats[0] or 0,
                "totalAccesses": stats[1] or 0,
                "avgAccesses": round(stats[2] or 0, 2)
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post('/api/cache/clear')
def clear_cache():
    """Clear document cache"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute('DELETE FROM document_cache')
            conn.commit()
        return jsonify({"status": "success", "message": "Cache cleared"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.get('/api/memory/patterns')
def get_patterns():
    """Get learned extraction patterns"""
    doc_type = request.args.get('type', 'prescription')
    entity_type = request.args.get('entity', 'medicine')
    limit = request.args.get('limit', type=int, default=50)
    
    patterns = get_learned_patterns(doc_type, entity_type, limit)
    return jsonify({"patterns": patterns})

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 MEDICAL CLAIMS PROCESSING SERVER")
    print("="*60)
    print(f"✅ PDF Support: {PYMUPDF_AVAILABLE}")
    
    # Validate API Key
    api_key = get_api_key()
    if api_key and len(api_key) > 30:
        print(f"✅ Gemini API Key: Loaded ({api_key[:10]}...{api_key[-4:]})")
    else:
        print(f"⚠️  Gemini API Key: NOT FOUND or INVALID")
        print(f"   Please check your .env file")
    
    print(f"✅ Grounding: Disabled (requires paid API)")
    print(f"✅ Caching: Enabled")
    print(f"✅ Learning: Enabled")
    print("="*60 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=True)