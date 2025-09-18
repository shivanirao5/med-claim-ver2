import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import base64
import requests
import time
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)

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


@app.post('/api/ocr/prescription')
def ocr_prescription():
    file = request.files['file']
    api_key = get_api_key()
    if not api_key:
        return ("Missing API key", 400)
    try:
        items = call_gemini(file.read(), file.mimetype, build_prompt('prescription'), api_key)
    except requests.RequestException as e:
        return jsonify({"error": "Upstream model temporarily unavailable", "detail": str(e)}), 503
    names = [i.get('name') for i in items if isinstance(i, dict) and i.get('name')]
    # filter common headers
    blacklist = ['dr ', 'clinic', 'medical', 'hospital', 'chemist', 'address']
    names = [n for n in names if not any(b in n.lower() for b in blacklist)]
    return jsonify({"prescriptionNames": names})


@app.post('/api/ocr/bill')
def ocr_bill():
    file = request.files['file']
    api_key = get_api_key()
    if not api_key:
        return ("Missing API key", 400)
    try:
        items = call_gemini(file.read(), file.mimetype, build_prompt('bill'), api_key)
    except requests.RequestException as e:
        return jsonify({"error": "Upstream model temporarily unavailable", "detail": str(e)}), 503
    out = []
    for i in items if isinstance(items, list) else []:
        if isinstance(i, dict) and i.get('name'):
            entry = {"name": str(i['name']).strip()}
            if isinstance(i.get('amount'), (int, float)):
                entry['amount'] = float(i['amount'])
            out.append(entry)
    return jsonify({"billItems": out})


if __name__ == '__main__':
    @app.get('/api/health')
    def health():
        key_present = bool(get_api_key())
        return jsonify({"ok": True, "hasKey": key_present})

    @app.get('/')
    def index():
        return send_from_directory(BASE_DIR, 'index.html')

    # Serve assets (app.js, style.css, script.js if present)
    @app.get('/<path:path>')
    def static_proxy(path):
        return send_from_directory(BASE_DIR, path)

    app.run(host='0.0.0.0', port=5000, debug=True)


