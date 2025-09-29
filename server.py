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
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Database setup for improved performance and scalability
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
            # Calculate totals from sessions
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
                
                # Insert or update employee record
                conn.execute('''
                    INSERT OR REPLACE INTO employees 
                    (name, total_sessions, total_files, total_amount, last_activity)
                    VALUES (?, ?, ?, ?, ?)
                ''', (employee_name, total_sessions or 0, total_files or 0, 
                      total_amount or 0.0, last_activity or datetime.now().isoformat()))
                
                conn.commit()

def record_session(employee_name, session_id, summary_data):
    """Record session data in database"""
    with db_lock:
        with sqlite3.connect(DB_PATH) as conn:
            file_count = len(summary_data.get('files', []))
            
            # Count prescriptions and bills
            aggregated = summary_data.get('aggregated', {})
            prescription_count = len(aggregated.get('prescriptions', []))
            bill_count = len(aggregated.get('bills', []))
            
            # Calculate total amount
            total_amount = 0
            for bill in aggregated.get('bills', []):
                for item in bill.get('items', []):
                    total_amount += item.get('amount', 0)
            
            # Insert or update session
            conn.execute('''
                INSERT OR REPLACE INTO sessions 
                (employee_name, session_id, file_count, prescription_count, bill_count, total_amount)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (employee_name, session_id, file_count, prescription_count, bill_count, total_amount))
            
            conn.commit()
    
    # Update employee stats
    update_employee_stats(employee_name)

# Initialize database on startup
init_database()

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"
def get_api_key() -> str:
    # Load .env once at startup if available
    global _ENV_LOADED
    if load_dotenv and not globals().get('_ENV_LOADED'):
        load_dotenv(os.path.join(BASE_DIR, '.env'))
        _ENV_LOADED = True
    return os.getenv('GEMINI_API_KEY')



def build_prompt(kind: str) -> str:
    if kind == 'prescription':
        return (
            "Analyze this image of a handwritten prescription.\n"
            "1. Identify all medicine names, including any dosage information.\n"
            "2. Return a JSON array of objects: {\"name\": string, \"box_2d\": [ymin,xmin,ymax,xmax] normalized 0-1000}.\n"
            "3. Only return medicine names, exclude doctor/clinic headers, addresses, dates, signatures.\n"
            "Return [] if none."
        )
    return (
        "Analyze this image of a medical bill/receipt.\n"
        "1. Extract each billed medicine/item and its total amount if present.\n"
        "2. Return a JSON array: {\"name\": string, \"amount\": number?}.\n"
        "Return [] if none."
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
            # Retry on 5xx
            if 500 <= r.status_code < 600:
                raise requests.HTTPError(f"{r.status_code} Server Error", response=r)
            r.raise_for_status()
            data = r.json()
            text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '[]')
            cleaned = text.strip().replace('```json', '').replace('```', '')
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                return []
        except requests.RequestException as e:
            last_error = e
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise last_error


# Simple in-memory LRU-like cache for OCR results
_OCR_CACHE: dict[str, dict] = {}
_OCR_CACHE_KEYS: list[str] = []
_OCR_CACHE_MAX = 128

def _hash_bytes(data: bytes) -> str:
    return hashlib.sha1(data).hexdigest()

def _cache_get(cache_key: str):
    return _OCR_CACHE.get(cache_key)

def _cache_set(cache_key: str, value: dict):
    if cache_key in _OCR_CACHE:
        # move to end (most recent)
        try:
            _OCR_CACHE_KEYS.remove(cache_key)
        except ValueError:
            pass
    _OCR_CACHE[cache_key] = value
    _OCR_CACHE_KEYS.append(cache_key)
    # evict oldest
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

def build_auto_prompt() -> str:
    return (
        "You are given one medical document image. Classify it and extract data.\n"
        "1) Determine type: 'prescription' or 'bill'. If unclear, use 'unknown'.\n"
        "2) If prescription: extract medicine names only (exclude headers/doctors/addresses/dates/signatures).\n"
        "3) If bill: extract billed item names and amounts if present.\n"
        "Return a JSON object with this exact shape:\n"
        "{\n"
        "  \"type\": \"prescription|bill|unknown\",\n"
        "  \"prescriptionNames\": string[],\n"
        "  \"billItems\": {name: string, amount?: number}[]\n"
        "}\n"
        "Rules:\n"
        "- Use empty arrays for unused fields.\n"
        "- Medicine names must be clean strings without dosage units or prefixes like 'Tab.' when possible.\n"
        "- For bills, 'amount' is numeric if visible; omit otherwise.\n"
    )

# -------- Persistence helpers --------
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

@app.post('/api/ocr/prescription')
def ocr_prescription():
    file = request.files['file']
    employee = request.form.get('employee')
    api_key = get_api_key()
    if not api_key:
        return ("Missing API key", 400)
    try:
        data = file.read()
        items = fetch_with_cache('prescription', data, file.mimetype, build_prompt('prescription'), api_key)
    except requests.RequestException as e:
        return jsonify({"error": "Upstream model temporarily unavailable", "detail": str(e)}), 503
    names = [i.get('name') for i in items if isinstance(i, dict) and i.get('name')]
    # filter common headers
    blacklist = ['dr ', 'clinic', 'medical', 'hospital', 'chemist', 'address']
    names = [n for n in names if not any(b in n.lower() for b in blacklist)]
    resp = {"prescriptionNames": names}
    if employee:
        session_dir = _new_session_dir(employee)
        fname = _sanitize_name(getattr(file, 'filename', 'prescription.jpg') or 'prescription.jpg')
        _save_binary(os.path.join(session_dir, fname), data)
        _save_json(os.path.join(session_dir, 'prescription.json'), resp)
        resp['saved'] = {"employee": employee, "sessionDir": os.path.relpath(session_dir, BASE_DIR)}
    return jsonify(resp)


@app.post('/api/ocr/bill')
def ocr_bill():
    file = request.files['file']
    employee = request.form.get('employee')
    api_key = get_api_key()
    if not api_key:
        return ("Missing API key", 400)
    try:
        data = file.read()
        items = fetch_with_cache('bill', data, file.mimetype, build_prompt('bill'), api_key)
    except requests.RequestException as e:
        return jsonify({"error": "Upstream model temporarily unavailable", "detail": str(e)}), 503
    out = []
    for i in items if isinstance(items, list) else []:
        if isinstance(i, dict) and i.get('name'):
            entry = {"name": str(i['name']).strip()}
            if isinstance(i.get('amount'), (int, float)):
                entry['amount'] = float(i['amount'])
            out.append(entry)
    resp = {"billItems": out}
    if employee:
        session_dir = _new_session_dir(employee)
        fname = _sanitize_name(getattr(file, 'filename', 'bill.jpg') or 'bill.jpg')
        _save_binary(os.path.join(session_dir, fname), data)
        _save_json(os.path.join(session_dir, 'bill.json'), resp)
        resp['saved'] = {"employee": employee, "sessionDir": os.path.relpath(session_dir, BASE_DIR)}
    return jsonify(resp)


@app.post('/api/ocr/auto')
def ocr_auto():
    api_key = get_api_key()
    employee = request.form.get('employee')
    files = request.files.getlist('files')
    if not files:
        return jsonify({"error": "No files provided"}), 400

    results = []
    all_presc = []
    all_bill = []
    session_dir = None
    if employee:
        session_dir = _new_session_dir(employee)
    for f in files:
        filename = getattr(f, 'filename', '')
        file_bytes = f.read()
        # Fallback mock mode when API key is missing: categorize by filename and synthesize minimal items
        if not api_key:
            fname_lower = (filename or '').lower()
            mock_type = 'bill' if any(k in fname_lower for k in ['bill', 'receipt', 'invoice']) else (
                'prescription' if any(k in fname_lower for k in ['pres', 'rx', 'doctor']) else 'unknown'
            )
            # Deterministic values from hash
            h = int(_hash_bytes(file_bytes)[:6], 16)
            presc_names = [f"Medicine-{h % 97}"] if mock_type == 'prescription' else []
            bill_items = ([{"name": f"Item-{h % 89}", "amount": float((h % 5000) / 10.0)}] if mock_type == 'bill' else [])
            data = {"type": mock_type, "prescriptionNames": presc_names, "billItems": bill_items}
        else:
            try:
                data = fetch_with_cache('auto', file_bytes, f.mimetype, build_auto_prompt(), api_key)
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
        bill_items = []
        if isinstance(data, dict):
            if isinstance(data.get('prescriptionNames'), list):
                presc_names = [str(n).strip() for n in data.get('prescriptionNames') if isinstance(n, str) and n.strip()]
            if isinstance(data.get('billItems'), list):
                for it in data.get('billItems'):
                    if isinstance(it, dict) and it.get('name'):
                        entry = {"name": str(it['name']).strip()}
                        if isinstance(it.get('amount'), (int, float)):
                            entry['amount'] = float(it['amount'])
                        bill_items.append(entry)

        # basic blacklist for prescription names
        if presc_names:
            blacklist = ['dr ', 'clinic', 'medical', 'hospital', 'chemist', 'address']
            presc_names = [n for n in presc_names if not any(b in n.lower() for b in blacklist)]

        file_result = {
            "filename": filename,
            "type": typ or ('bill' if bill_items else ('prescription' if presc_names else 'unknown')),
            "prescriptionNames": presc_names,
            "billItems": bill_items,
        }
        # Persist per-file if requested
        if session_dir:
            safe_name = _sanitize_name(filename or 'image.jpg')
            _save_binary(os.path.join(session_dir, safe_name), file_bytes)
            meta = {
                "type": file_result["type"],
                "prescriptionNames": presc_names,
                "billItems": bill_items,
            }
            base_no_ext = os.path.splitext(safe_name)[0]
            _save_json(os.path.join(session_dir, f"{base_no_ext}.json"), meta)
        results.append(file_result)
        if presc_names:
            all_presc.append({"names": presc_names})
        if bill_items:
            all_bill.append({"items": bill_items})

    summary = {
        "files": results,
        "aggregated": {
            "prescriptions": all_presc,
            "bills": all_bill
        }
    }
    if session_dir:
        full_summary = {
            "employee": employee,
            "createdAt": datetime.now().isoformat(),
            **summary
        }
        _save_json(os.path.join(session_dir, 'summary.json'), full_summary)
        
        # Record in database for fast querying
        session_id = os.path.basename(session_dir)
        record_session(employee, session_id, full_summary)
        
        summary['saved'] = {"employee": employee, "sessionDir": os.path.relpath(session_dir, BASE_DIR)}
    return jsonify(summary)


# Always-available routes for both development and production
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
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row  # Enable dict-like access
            
            if not employee:
                # List employees with stats from database
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
                
                # Get total count
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
                # Get sessions for specific employee from database
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
                    # Still need to load full summary from file for complete data
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
                                print(f"Error loading summary for {emp_dir}/{row['session_id']}: {e}")
                    
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
                
                # Get total session count
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
        # Fallback to file system method
        print(f"Database query failed, falling back to filesystem: {e}")
        return list_datasets_filesystem(employee, limit, offset)

def list_datasets_filesystem(employee, limit, offset):
    """Fallback filesystem-based listing for when database fails"""
    if not os.path.isdir(DATASET_DIR):
        return jsonify({"employees": [], "sessions": [], "total": 0, "hasMore": False})
    
    if not employee:
        try:
            all_employees = [d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))]
            all_employees.sort()
            total = len(all_employees)
            employees = all_employees[offset:offset + limit]
            has_more = offset + limit < total
            
            return jsonify({
                "employees": employees, 
                "sessions": [], 
                "total": total,
                "hasMore": has_more,
                "offset": offset,
                "limit": limit
            })
        except Exception as e:
            return jsonify({"error": f"Failed to list employees: {str(e)}"}), 500
    
    emp_dir = os.path.join(DATASET_DIR, _sanitize_name(employee))
    if not os.path.isdir(emp_dir):
        return jsonify({"employees": [], "sessions": [], "total": 0, "hasMore": False})
    
    try:
        all_sessions = [sess for sess in os.listdir(emp_dir) if os.path.isdir(os.path.join(emp_dir, sess))]
        all_sessions.sort(reverse=True)
        total_sessions = len(all_sessions)
        session_subset = all_sessions[offset:offset + limit]
        
        sessions = []
        for sess in session_subset:
            sdir = os.path.join(emp_dir, sess)
            summary_path = os.path.join(sdir, 'summary.json')
            summary = None
            try:
                if os.path.isfile(summary_path):
                    with open(summary_path, 'r', encoding='utf-8') as f:
                        summary = json.load(f)
            except Exception as e:
                print(f"Error loading summary for {emp_dir}/{sess}: {e}")
            
            sessions.append({"session": sess, "summary": summary})
        
        return jsonify({
            "employees": [employee], 
            "sessions": sessions,
            "total": total_sessions,
            "hasMore": offset + limit < total_sessions,
            "offset": offset,
            "limit": limit
        })
        
    except Exception as e:
        return jsonify({"error": f"Failed to list sessions: {str(e)}"}), 500


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
    # Also list files
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
    """Get high-level analytics for the entire system using database for performance"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            
            # Basic totals
            cursor = conn.execute('''
                SELECT 
                    COUNT(DISTINCT name) as total_employees,
                    SUM(total_sessions) as total_sessions,
                    SUM(total_files) as total_files,
                    SUM(total_amount) as total_amount
                FROM employees
            ''')
            totals = cursor.fetchone()
            
            # Recent activity (last 7 days)
            one_week_ago = (datetime.now() - timedelta(days=7)).isoformat()
            cursor = conn.execute('''
                SELECT COUNT(*) as recent_activity
                FROM sessions 
                WHERE created_at > ?
            ''', (one_week_ago,))
            recent_activity = cursor.fetchone()['recent_activity']
            
            # Daily stats for last 30 days
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
        # Fallback to filesystem method if database fails
        print(f"Database analytics failed, using fallback: {e}")
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
    """Search employees by name with fuzzy matching"""
    query = request.args.get('q', '').strip().lower()
    limit = request.args.get('limit', type=int) or 20
    
    if not query:
        return jsonify({"employees": []})
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            
            # Search in database first
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
        # Fallback to filesystem search
        if not os.path.isdir(DATASET_DIR):
            return jsonify({"employees": []})
            
        try:
            all_employees = []
            for emp_name in os.listdir(DATASET_DIR):
                emp_dir = os.path.join(DATASET_DIR, emp_name)
                if not os.path.isdir(emp_dir):
                    continue
                
                if query in emp_name.lower():
                    session_count = sum(1 for item in os.listdir(emp_dir) 
                                      if os.path.isdir(os.path.join(emp_dir, item)))
                    
                    all_employees.append({
                        'name': emp_name,
                        'sessionCount': session_count,
                        'relevance': 1 if emp_name.lower().startswith(query) else 0.5
                    })
            
            all_employees.sort(key=lambda x: (-x['relevance'], -x['sessionCount']))
            return jsonify({"employees": all_employees[:limit]})
            
        except Exception as fs_error:
            return jsonify({"error": f"Search failed: {str(fs_error)}"}), 500


# Auto-migrate data on startup if needed
def auto_migrate_on_startup():
    """Automatically migrate existing data on server startup"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.execute('SELECT COUNT(*) FROM sessions')
            db_sessions = cursor.fetchone()[0]
        
        # Count filesystem sessions
        fs_sessions = 0
        if os.path.isdir(DATASET_DIR):
            for emp_name in os.listdir(DATASET_DIR):
                emp_dir = os.path.join(DATASET_DIR, emp_name)
                if os.path.isdir(emp_dir):
                    fs_sessions += sum(1 for item in os.listdir(emp_dir) 
                                     if os.path.isdir(os.path.join(emp_dir, item)))
        
        # If filesystem has more data, migrate automatically
        if fs_sessions > db_sessions:
            print(f"Auto-migrating data: {fs_sessions} filesystem sessions vs {db_sessions} database sessions")
            
            migrated_sessions = 0
            for emp_name in os.listdir(DATASET_DIR):
                emp_dir = os.path.join(DATASET_DIR, emp_name)
                if not os.path.isdir(emp_dir):
                    continue
                
                for sess_name in os.listdir(emp_dir):
                    sess_dir = os.path.join(emp_dir, sess_name)
                    if not os.path.isdir(sess_dir):
                        continue
                    
                    summary_path = os.path.join(sess_dir, 'summary.json')
                    if os.path.isfile(summary_path):
                        try:
                            with open(summary_path, 'r', encoding='utf-8') as f:
                                summary = json.load(f)
                            
                            record_session(emp_name, sess_name, summary)
                            migrated_sessions += 1
                            
                        except Exception as e:
                            print(f"Error migrating session {emp_name}/{sess_name}: {e}")
                            continue
            
            print(f"Auto-migration completed: {migrated_sessions} sessions migrated")
        
    except Exception as e:
        print(f"Auto-migration failed: {e}")

# Run auto-migration on startup
auto_migrate_on_startup()


# No need for a custom static route; Flask serves /static/* automatically

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)


