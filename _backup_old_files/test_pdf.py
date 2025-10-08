#!/usr/bin/env python3
"""
Simple test script to verify PDF processing capabilities
"""

import sys

def test_pdf_libraries():
    """Test which PDF processing libraries are available"""
    results = {}
    
    # Test PyMuPDF
    try:
        import fitz
        results['PyMuPDF'] = {
            'available': True,
            'version': fitz.version,
            'note': 'Fastest option, no external dependencies'
        }
    except ImportError as e:
        results['PyMuPDF'] = {
            'available': False,
            'error': str(e),
            'note': 'DLL load issues on some Windows systems'
        }
    
    # Test pdf2image
    try:
        from pdf2image import convert_from_bytes
        results['pdf2image'] = {
            'available': True,
            'note': 'Requires Poppler to be installed'
        }
        
        # Try to check if Poppler is available
        try:
            from pdf2image.exceptions import PDFInfoNotInstalledError
            # If we can import this, the library is working
            results['pdf2image']['poppler'] = 'Checking requires a test PDF'
        except:
            pass
            
    except ImportError as e:
        results['pdf2image'] = {
            'available': False,
            'error': str(e)
        }
    
    # Test PyPDF2
    try:
        import PyPDF2
        results['PyPDF2'] = {
            'available': True,
            'version': PyPDF2.__version__ if hasattr(PyPDF2, '__version__') else 'unknown',
            'note': 'Fallback for PDF info, cannot extract images'
        }
    except ImportError as e:
        results['PyPDF2'] = {
            'available': False,
            'error': str(e)
        }
    
    # Test PIL/Pillow
    try:
        from PIL import Image
        results['Pillow'] = {
            'available': True,
            'note': 'Required for image processing'
        }
    except ImportError as e:
        results['Pillow'] = {
            'available': False,
            'error': str(e)
        }
    
    return results

def print_results(results):
    """Print test results in a readable format"""
    print("\n" + "="*60)
    print("PDF PROCESSING LIBRARIES TEST")
    print("="*60 + "\n")
    
    any_working = False
    
    for lib_name, info in results.items():
        status = "✓" if info['available'] else "✗"
        print(f"{status} {lib_name}")
        
        if info['available']:
            any_working = True
            if 'version' in info:
                print(f"  Version: {info['version']}")
            if 'note' in info:
                print(f"  Note: {info['note']}")
            if 'poppler' in info:
                print(f"  Poppler: {info['poppler']}")
        else:
            print(f"  Error: {info.get('error', 'Not installed')}")
            if 'note' in info:
                print(f"  Note: {info['note']}")
        print()
    
    print("="*60)
    print("SUMMARY")
    print("="*60)
    
    if results['PyMuPDF']['available']:
        print("\n✓ PDF processing is ready (using PyMuPDF)")
        print("  This is the fastest option with best quality.")
        return 0
    elif results['pdf2image']['available']:
        print("\n✓ PDF processing is ready (using pdf2image)")
        print("  Make sure Poppler is installed on your system.")
        print("  Download from: https://github.com/oschwartz10612/poppler-windows/releases/")
        return 0
    else:
        print("\n✗ PDF processing is NOT available")
        print("\nTo enable PDF support, install one of the following:")
        print("\n1. PyMuPDF (recommended):")
        print("   pip install PyMuPDF")
        print("\n2. pdf2image + Poppler:")
        print("   pip install pdf2image")
        print("   Download Poppler: https://github.com/oschwartz10612/poppler-windows/releases/")
        print("   Add Poppler's bin folder to your PATH")
        return 1

def main():
    """Main test function"""
    try:
        results = test_pdf_libraries()
        return print_results(results)
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
