# Medical Claim Assistant - Testing Guide

## ✅ Complete Functionality Checklist

### 1. **Setup & Configuration**
- [ ] Server starts without errors
- [ ] Gemini API key is properly configured
- [ ] Database initializes correctly
- [ ] All static files load properly

### 2. **Upload Functionality** 
- [ ] Employee name and ID validation works
- [ ] Drag & drop file upload works
- [ ] File selection dialog works
- [ ] Multiple files can be uploaded
- [ ] File thumbnails display correctly
- [ ] File size and type validation works

### 3. **OCR & Gemini Analysis**
- [ ] Prescription images are analyzed correctly
- [ ] Bill/receipt images are analyzed correctly
- [ ] API errors are handled gracefully
- [ ] Progress indicators work during analysis
- [ ] Results are displayed in tables

### 4. **Results Display**
- [ ] Prescriptions shown in clean table format
- [ ] Bill items shown with amounts in table format
- [ ] No duplicate entries in results
- [ ] Data persists correctly

### 5. **Fuzzy Matching Algorithm**
- [ ] Exact matches detected correctly
- [ ] Close spelling variants matched (e.g., Paracetamol/Paracetmol)
- [ ] Brand vs generic names matched
- [ ] Prefix matching works (e.g., Dolo/Dolo-650)
- [ ] Phonetic similarities detected
- [ ] Consultation fees identified and capped at ₹300

### 6. **Analysis Results Table**
- [ ] Professional table format displayed
- [ ] All columns properly aligned
- [ ] Status badges (Admissible/Inadmissible) shown correctly
- [ ] Amount calculations accurate
- [ ] Match details clearly explained
- [ ] Summary statistics displayed correctly

### 7. **Export Functionality**
- [ ] Excel export works with all data
- [ ] PDF export generates proper document
- [ ] Employee information included in exports
- [ ] Tables formatted correctly in exports
- [ ] File naming convention correct

### 8. **User Interface**
- [ ] No dark/light theme toggle (removed as requested)
- [ ] Clean, professional appearance
- [ ] Responsive on mobile devices
- [ ] All buttons work correctly
- [ ] Error messages are user-friendly

### 9. **Data Persistence**
- [ ] Data saved to database correctly
- [ ] Session data retrievable
- [ ] Employee records maintained
- [ ] File metadata stored properly

### 10. **Error Handling**
- [ ] Missing API key shows clear error
- [ ] Network errors handled gracefully
- [ ] Invalid files rejected with message
- [ ] Server errors displayed to user
- [ ] Validation errors prevent bad data

## 🧪 Test Scenarios

### Scenario 1: Basic Workflow
1. Enter employee name: "Rahul Sharma"
2. Enter employee ID: "EMP001"
3. Upload 2 prescription images
4. Upload 2 bill images
5. Click "Begin Analysis"
6. Verify results display in tables
7. Export to Excel and PDF

### Scenario 2: Fuzzy Matching Test
Test with these medicine pairs:
- Prescription: "Paracetamol 500mg" → Bill: "Paracetamol Tab"
- Prescription: "Dolo" → Bill: "Dolo-650"
- Prescription: "Crocin" → Bill: "Crocin Advance"
- Prescription: "Combiflam" → Bill: "Combiflame" (spelling variant)

Expected: All should match with appropriate match method explanation

### Scenario 3: Consultation Fee Handling
- Upload bill with "Doctor Consultation Fee: ₹500"
- Verify it's detected as consultation
- Verify admissible amount capped at ₹300
- Verify original amount shown in results

### Scenario 4: Error Recovery
1. Start analysis without employee info → Error shown
2. Upload empty files → Gracefully handled
3. Network disconnected → Clear error message
4. Missing API key → Setup instructions shown

### Scenario 5: Multiple Sessions
1. Complete one full analysis
2. Click "New Analysis"
3. Verify all data cleared
4. Start fresh analysis
5. Verify no data contamination

## 🔧 Common Issues & Solutions

### Issue: API Key Not Detected
**Solution:** Create `.env` file in project root:
```
GEMINI_API_KEY=your_actual_api_key_here
```

### Issue: No Results from OCR
**Solution:** 
- Verify image quality (clear, well-lit)
- Check Gemini API quota
- Ensure proper internet connection

### Issue: Matching Not Working
**Solution:**
- Check medicine name format
- Verify fuzzy matching algorithm enabled
- Review console logs for matching details

### Issue: Database Errors
**Solution:**
- Delete `med_claim_data.db` to reset
- Restart server to reinitialize
- Check file permissions

## 📊 Expected Behavior

### Upload Phase:
1. User enters employee details
2. Uploads multiple files via drag-drop or selection
3. Files show thumbnails with status "Pending"
4. "Begin Analysis" button becomes enabled

### Analysis Phase:
1. Progress bar shows 0-100%
2. Status messages update during processing
3. Each file analyzed by Gemini AI
4. Results extracted and categorized

### Results Phase:
1. Prescriptions table shows all medicines (no duplicates)
2. Bills table shows all items with amounts
3. Analysis table shows matching results
4. Each row has clear status and match explanation
5. Summary statistics accurate

### Export Phase:
1. Excel file contains all data in readable format
2. PDF has professional formatting
3. Employee info included in header
4. Date/time stamp present

## 🎯 Success Criteria

✅ **100% Working** when:
- All uploads process without errors
- OCR extracts data accurately
- Fuzzy matching identifies correct matches
- Results display in clean tables
- Exports generate properly formatted files
- UI is responsive and professional
- No console errors during operation
- Data persists across sessions

## 📝 Notes for Testing

1. Use clear, readable images for best OCR results
2. Test with various medicine name formats
3. Include both prescriptions and bills in same session
4. Try different file formats (JPG, PNG, PDF if supported)
5. Test on different browsers (Chrome, Firefox, Edge)
6. Verify mobile responsiveness
7. Check accessibility features

## 🚀 Performance Expectations

- Upload response: < 2 seconds per file
- OCR analysis: 3-10 seconds per image (depends on Gemini API)
- Matching algorithm: < 1 second
- Table rendering: < 500ms
- Export generation: < 3 seconds

## 🔍 Debug Mode

To enable detailed logging:
1. Open browser console (F12)
2. Check for detailed match explanations
3. Review API calls in Network tab
4. Monitor performance metrics
5. Check for any JavaScript errors

---

**Last Updated:** December 2024
**Version:** 3.0 - Production Ready
