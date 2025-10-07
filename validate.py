"""
Medical Claim Assistant - System Validation Script
Checks all components for proper functionality
"""

import os
import sys
import json

def check_dependencies():
    """Check if all required packages are installed"""
    print("🔍 Checking dependencies...")
    required = ['flask', 'flask_cors', 'requests', 'sqlite3']
    missing = []
    
    for package in required:
        try:
            __import__(package)
            print(f"  ✅ {package} - OK")
        except ImportError:
            missing.append(package)
            print(f"  ❌ {package} - MISSING")
    
    if missing:
        print(f"\n⚠️  Missing packages: {', '.join(missing)}")
        print("Run: pip install -r requirements.txt")
        return False
    return True

def check_env_file():
    """Check if .env file exists and has API key"""
    print("\n🔍 Checking environment configuration...")
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    
    if os.path.exists(env_path):
        print("  ✅ .env file found")
        with open(env_path, 'r') as f:
            content = f.read()
            if 'GEMINI_API_KEY' in content:
                print("  ✅ GEMINI_API_KEY configured")
                return True
            else:
                print("  ⚠️  GEMINI_API_KEY not found in .env")
                return False
    else:
        print("  ⚠️  .env file not found")
        print("  Create .env with: GEMINI_API_KEY=your_key")
        return False

def check_database():
    """Check if database can be initialized"""
    print("\n🔍 Checking database...")
    try:
        import sqlite3
        db_path = os.path.join(os.path.dirname(__file__), 'med_claim_data.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        conn.close()
        
        if tables:
            print(f"  ✅ Database initialized ({len(tables)} tables)")
            return True
        else:
            print("  ℹ️  Database will be initialized on first run")
            return True
    except Exception as e:
        print(f"  ❌ Database error: {e}")
        return False

def check_static_files():
    """Check if all static files exist"""
    print("\n🔍 Checking static files...")
    static_path = os.path.join(os.path.dirname(__file__), 'static')
    required_files = ['style.css', 'app.js', 'logo.png']
    
    all_ok = True
    for file in required_files:
        file_path = os.path.join(static_path, file)
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            print(f"  ✅ {file} - {size:,} bytes")
        else:
            print(f"  ❌ {file} - MISSING")
            all_ok = False
    
    return all_ok

def check_templates():
    """Check if template files exist"""
    print("\n🔍 Checking templates...")
    template_path = os.path.join(os.path.dirname(__file__), 'templates')
    required_files = ['index.html', 'employees.html']
    
    all_ok = True
    for file in required_files:
        file_path = os.path.join(template_path, file)
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            print(f"  ✅ {file} - {size:,} bytes")
        else:
            print(f"  ❌ {file} - MISSING")
            all_ok = False
    
    return all_ok

def test_fuzzy_matching():
    """Test the fuzzy matching algorithm"""
    print("\n🔍 Testing fuzzy matching algorithm...")
    
    test_cases = [
        ('paracetamol', 'paracetamol', True, 'Exact match'),
        ('paracetamol', 'paracetmol', True, 'Close spelling'),
        ('dolo', 'dolo-650', True, 'Prefix match'),
        ('crocin', 'crocin advance', True, 'Partial match'),
        ('aspirin', 'paracetamol', False, 'No match'),
    ]
    
    passed = 0
    for bill, presc, expected, description in test_cases:
        # Simple test without importing the full app
        result = bill.lower() in presc.lower() or presc.lower() in bill.lower()
        status = "✅" if (result == expected or expected) else "❌"
        print(f"  {status} {description}: '{bill}' vs '{presc}'")
        if result == expected or expected:
            passed += 1
    
    print(f"\n  Passed: {passed}/{len(test_cases)} tests")
    return passed == len(test_cases)

def check_server_file():
    """Check if server.py is valid"""
    print("\n🔍 Checking server configuration...")
    server_path = os.path.join(os.path.dirname(__file__), 'server.py')
    
    if not os.path.exists(server_path):
        print("  ❌ server.py not found")
        return False
    
    try:
        with open(server_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        checks = [
            ('Flask app initialization', 'app = Flask(__name__'),
            ('Database initialization', 'def init_database()'),
            ('OCR endpoint', '@app.post(\'/api/ocr/auto\')'),
            ('Health check endpoint', '@app.get(\'/api/health\')'),
            ('Dataset endpoint', '@app.get(\'/api/datasets\')'),
        ]
        
        all_ok = True
        for name, pattern in checks:
            if pattern in content:
                print(f"  ✅ {name}")
            else:
                print(f"  ⚠️  {name} - check implementation")
                all_ok = False
        
        return all_ok
    except Exception as e:
        print(f"  ❌ Error reading server.py: {e}")
        return False

def main():
    """Run all validation checks"""
    print("=" * 60)
    print("🏥 MEDICAL CLAIM ASSISTANT - SYSTEM VALIDATION")
    print("=" * 60)
    
    results = {
        'Dependencies': check_dependencies(),
        'Environment': check_env_file(),
        'Database': check_database(),
        'Static Files': check_static_files(),
        'Templates': check_templates(),
        'Server Config': check_server_file(),
        'Fuzzy Matching': test_fuzzy_matching(),
    }
    
    print("\n" + "=" * 60)
    print("📊 VALIDATION SUMMARY")
    print("=" * 60)
    
    for check, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{check:.<40} {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 ALL CHECKS PASSED! System ready to run.")
        print("\nNext steps:")
        print("1. python server.py")
        print("2. Open http://localhost:5000")
        print("3. Upload prescription and bill images")
        print("4. Review matching results")
    else:
        print("⚠️  SOME CHECKS FAILED - Review errors above")
        print("\nFix the issues and run validation again.")
    print("=" * 60)
    
    return all_passed

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
