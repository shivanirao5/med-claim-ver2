# 🚀 Quick Start Guide - Medical Claim Assistant

## Prerequisites
- Python 3.8 or higher
- Gemini API Key (get from https://makersuite.google.com/app/apikey)

## Setup (5 minutes)

### Step 1: Install Dependencies
```powershell
cd "c:\Users\Shivani\OneDrive - Karanji infotech pvt Ltd\Desktop\med-claim-ver2"
pip install -r requirements.txt
```

### Step 2: Configure API Key
Create a `.env` file in the project root:
```
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

**Alternative:** Set environment variable in PowerShell:
```powershell
$env:GEMINI_API_KEY = "your_actual_gemini_api_key_here"
```

### Step 3: Start Server
```powershell
python server.py
```

### Step 4: Open Application
Open browser and go to: **http://localhost:5000**

## Usage (Simple 5-Step Process)

### 1️⃣ Enter Employee Information
- **Employee Name:** Full name (e.g., "Rahul Sharma")
- **Employee ID:** Unique identifier (e.g., "EMP001")

### 2️⃣ Upload Documents
- **Drag & Drop** or **Click to Select** files
- Upload both:
  - 📄 Prescription images (doctor's prescriptions)
  - 🧾 Bill/Receipt images (medical bills)

### 3️⃣ Start Analysis
- Click **"Begin Analysis"** button
- Wait for AI processing (10-30 seconds depending on file count)

### 4️⃣ Review Results
- **Prescriptions Table:** All extracted medicines
- **Bills Table:** All billed items with amounts
- **Analysis Table:** Matching results with status

### 5️⃣ Export Reports
- **Excel Export:** Complete data in spreadsheet format
- **PDF Export:** Professional formatted report

## Features

### ✅ What This System Does

1. **Intelligent OCR:** Extracts text from prescription and bill images using Google Gemini AI
2. **Smart Matching:** Uses advanced fuzzy matching algorithm to match prescribed medicines with billed items
3. **Automatic Classification:** Identifies prescriptions vs bills automatically
4. **Consultation Fee Detection:** Automatically detects and caps consultation fees at ₹300
5. **Professional Reports:** Generates Excel and PDF reports with complete analysis
6. **Data Persistence:** All data saved to database for future reference

### 🎯 Fuzzy Matching Capabilities

The system can match medicines even with:
- **Spelling variations:** Paracetamol ↔ Paracetmol
- **Brand names:** Dolo ↔ Paracetamol
- **Different formats:** Crocin 500mg ↔ Tab Crocin
- **Prefixes/Suffixes:** Combiflam ↔ Combiflam-Plus
- **Phonetic similarities:** Cetrizine ↔ Cetirizine

### 📊 Results Display

All results shown in **professional table format** with:
- Serial numbers
- Medicine/Item names
- Status badges (Admissible/Inadmissible)
- Amount calculations
- Match explanations
- Summary statistics

## Troubleshooting

### Problem: "Missing API key" error
**Solution:** 
1. Ensure `.env` file exists in project root
2. Verify API key is correct
3. Restart the server

### Problem: No results from OCR
**Solution:**
1. Use clear, well-lit images
2. Ensure text is readable
3. Check internet connection
4. Verify Gemini API quota

### Problem: Database errors
**Solution:**
1. Delete `med_claim_data.db` file
2. Restart server to reinitialize

### Problem: Upload not working
**Solution:**
1. Check file format (JPG, PNG supported)
2. Verify file size < 10MB
3. Ensure employee info is filled

## Tips for Best Results

### 📸 Image Quality
- ✅ Clear, well-lit photos
- ✅ Straight orientation
- ✅ Full document visible
- ✅ Good resolution (min 1000px width)
- ❌ Avoid blurry images
- ❌ Avoid dark/shadowed areas

### 💊 Medicine Names
- System handles brand and generic names
- Works with abbreviations (Tab., Cap., Inj.)
- Recognizes dosage formats (500mg, 10ml, etc.)
- Understands common medical terminology

### 🧾 Bill Processing
- Itemized bills work best
- Consultation fees auto-detected
- Multiple items per bill supported
- Partial matches still considered

## Advanced Features

### Employee Records
- Access via **"📊 Employee Records"** button
- View all past sessions
- Search by employee name
- Analytics and statistics

### Data Export Options
- **Excel:** Editable spreadsheet with formulas
- **PDF:** Print-ready professional report
- Includes employee info, date, summary stats

### Batch Processing
- Upload multiple files at once
- System automatically categorizes each file
- Processes all files in single session

## System Architecture

```
User → Upload Files → Gemini AI OCR → Database Storage
                           ↓
                   Extract Medicines & Bills
                           ↓
                   Fuzzy Matching Algorithm
                           ↓
                Results Table Display ← Export (Excel/PDF)
```

## Security & Privacy

- ✅ Data stored locally in SQLite database
- ✅ No data sent to external servers (except Gemini API for OCR)
- ✅ Employee information encrypted in database
- ✅ Session-based processing
- ✅ All files processed server-side

## Performance

- **Upload:** < 2 seconds per file
- **OCR Analysis:** 3-10 seconds per image
- **Matching:** < 1 second
- **Export:** < 3 seconds

## Browser Compatibility

- ✅ Chrome (Recommended)
- ✅ Firefox
- ✅ Edge
- ✅ Safari
- 📱 Mobile responsive

## Support

For issues or questions:
1. Check `TEST_GUIDE.md` for detailed testing scenarios
2. Review console logs (F12 in browser)
3. Check server logs in terminal
4. Verify API key configuration

---

**Version:** 3.0 Production Ready
**Last Updated:** December 2024

🎉 **You're all set! Start processing medical claims with AI-powered accuracy.**
