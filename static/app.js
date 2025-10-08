// Enhanced Medical Claims Processing - Frontend
// Handles intelligent matching display and admissibility reporting

(function() {
  'use strict';

  // DOM Elements
  const empNameInput = document.getElementById('employeeName');
  const empIdInput = document.getElementById('employeeId');
  const bulkInput = document.getElementById('bulkInput');
  const dropZone = document.getElementById('dropZone');
  const bulkThumbs = document.getElementById('bulkThumbs');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');
  const analysisSection = document.getElementById('analysisSection');
  const startAnalysisBtn = document.getElementById('startAnalysisBtn');
  const analysisResults = document.getElementById('analysisResults');
  const prescriptionResults = document.getElementById('prescriptionResults');
  const billResults = document.getElementById('billResults');
  const compareResults = document.getElementById('compareResults');
  const mappingResults = document.getElementById('mappingResults');
  const globalSummary = document.getElementById('globalSummary');
  const newAnalysisBtn = document.getElementById('newAnalysisBtn');

  // State
  let uploadedFiles = [];
  let analysisData = null;

  // Utility Functions
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatCurrency(amount) {
    return `₹${parseFloat(amount || 0).toFixed(2)}`;
  }

  function showNotification(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      top: 90px;
      right: 20px;
      padding: 16px 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      z-index: 1003;
      animation: slideIn 0.3s ease-out;
      max-width: 350px;
      font-weight: 500;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 4000);
  }

  function showConfirmDialog(message, onConfirm, onCancel) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    `;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 440px;
      width: 90%;
      overflow: hidden;
      animation: slideUp 0.3s ease-out;
    `;

    dialog.innerHTML = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; color: white;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <svg style="width: 28px; height: 28px; flex-shrink: 0;" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
          </svg>
          <h3 style="margin: 0; font-size: 20px; font-weight: 600; flex: 1;">Confirm Action</h3>
        </div>
      </div>
      <div style="padding: 24px;">
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">
          ${message}
        </p>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="cancelBtn" style="
            padding: 10px 24px;
            border: 2px solid #e5e7eb;
            background: white;
            color: #374151;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          ">Cancel</button>
          <button id="confirmBtn" style="
            padding: 10px 24px;
            border: none;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            transition: all 0.2s;
          ">OK</button>
        </div>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Add hover effects
    const confirmBtn = dialog.querySelector('#confirmBtn');
    const cancelBtn = dialog.querySelector('#cancelBtn');

    confirmBtn.addEventListener('mouseenter', () => {
      confirmBtn.style.transform = 'translateY(-2px)';
      confirmBtn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
    });
    confirmBtn.addEventListener('mouseleave', () => {
      confirmBtn.style.transform = 'translateY(0)';
      confirmBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = '#f3f4f6';
      cancelBtn.style.borderColor = '#d1d5db';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = 'white';
      cancelBtn.style.borderColor = '#e5e7eb';
    });

    // Handle button clicks
    const close = () => {
      overlay.style.opacity = '0';
      dialog.style.transform = 'scale(0.95)';
      setTimeout(() => document.body.removeChild(overlay), 200);
    };

    confirmBtn.addEventListener('click', () => {
      close();
      if (onConfirm) onConfirm();
    });

    cancelBtn.addEventListener('click', () => {
      close();
      if (onCancel) onCancel();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        close();
        if (onCancel) onCancel();
      }
    });

    // Add animation styles if not already present
    if (!document.getElementById('confirmDialogStyles')) {
      const style = document.createElement('style');
      style.id = 'confirmDialogStyles';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // File Upload Handling
  bulkInput.addEventListener('change', handleFileSelect);
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  });

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    handleFiles(files);
  }

  function handleFiles(files) {
    uploadedFiles = uploadedFiles.concat(files);
    displayThumbnails();
    
    if (uploadedFiles.length > 0) {
      analysisSection.style.display = 'block';
      startAnalysisBtn.disabled = false;
    }
  }

  function displayThumbnails() {
    bulkThumbs.innerHTML = '';
    
    uploadedFiles.forEach((file, index) => {
      const thumb = document.createElement('div');
      thumb.className = 'thumbnail-item';
      thumb.style.cssText = `
        background: white;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        position: relative;
        transition: all 0.2s;
      `;

      const img = document.createElement('img');
      img.className = 'thumbnail-image';
      img.style.cssText = `
        width: 100%;
        height: 120px;
        object-fit: cover;
        border-radius: 4px;
        margin-bottom: 8px;
      `;

      // Check if it's a PDF or image
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      
      if (isPDF) {
        // Show PDF icon
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">📑</text></svg>';
        
        // Add PDF badge
        const pdfBadge = document.createElement('div');
        pdfBadge.textContent = 'PDF';
        pdfBadge.style.cssText = `
          position: absolute;
          top: 16px;
          left: 16px;
          background: #dc2626;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          z-index: 1;
        `;
        thumb.appendChild(pdfBadge);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">📄</text></svg>';
      }

      const name = document.createElement('div');
      name.textContent = file.name;
      name.style.cssText = `
        font-size: 12px;
        font-weight: 600;
        color: #1f2937;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;

      const size = document.createElement('div');
      size.textContent = `${(file.size / 1024).toFixed(2)} KB`;
      size.style.cssText = `
        font-size: 11px;
        color: #6b7280;
      `;

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.className = 'remove-file-btn';
      removeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        cursor: pointer;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      removeBtn.onclick = () => removeFile(index);

      thumb.appendChild(img);
      thumb.appendChild(name);
      thumb.appendChild(size);
      thumb.appendChild(removeBtn);
      bulkThumbs.appendChild(thumb);
    });
  }

  function removeFile(index) {
    uploadedFiles.splice(index, 1);
    displayThumbnails();
    
    if (uploadedFiles.length === 0) {
      analysisSection.style.display = 'none';
      startAnalysisBtn.disabled = true;
    }
  }

  // Analysis Handling
  startAnalysisBtn.addEventListener('click', performAnalysis);

  async function performAnalysis() {
    const employeeName = empNameInput.value.trim();
    const employeeId = empIdInput.value.trim();

    if (!employeeName || !employeeId) {
      showNotification('error', 'Please enter both employee name and ID');
      return;
    }

    if (uploadedFiles.length === 0) {
      showNotification('error', 'Please upload at least one file');
      return;
    }

    startAnalysisBtn.disabled = true;
    uploadProgress.style.display = 'block';
    analysisResults.style.display = 'none';

    const formData = new FormData();
    formData.append('employee', `${employeeName}_${employeeId}`);
    
    uploadedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      // Show progress
      updateProgress(0, 'Uploading files...');

      const response = await fetch('/api/ocr/auto', {
        method: 'POST',
        body: formData
      });

      updateProgress(50, 'Processing documents...');

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      updateProgress(100, 'Analysis complete!');

      setTimeout(() => {
        uploadProgress.style.display = 'none';
        displayAnalysisResults(data);
      }, 500);

    } catch (error) {
      console.error('Analysis error:', error);
      showNotification('error', `Analysis failed: ${error.message}`);
      uploadProgress.style.display = 'none';
      startAnalysisBtn.disabled = false;
    }
  }

  function updateProgress(percent, text) {
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    progressText.textContent = text;
  }

  function displayAnalysisResults(data) {
    analysisData = data;
    analysisResults.style.display = 'block';

    // Display claim form if present
    if (data.claimForm) {
      displayClaimForm(data.claimForm, data.verification);
    }

    // Display file results
    displayFileResults(data.files || []);

    // Display matching results
    if (data.matching) {
      displayMatchingResults(data.matching);
    }

    // Enable export buttons
    document.getElementById('exportCsvBtn').disabled = false;
    document.getElementById('exportPdfBtn').disabled = false;
  }

  function displayClaimForm(claimForm, verification) {
    const claimFormSection = document.createElement('div');
    claimFormSection.id = 'claimFormSection';
    claimFormSection.style.cssText = `
      margin-bottom: 24px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    `;

    const empDetails = claimForm.employeeDetails || {};
    const declaredAmounts = claimForm.declaredAmounts || {};
    const treatments = claimForm.treatments || [];

    claimFormSection.innerHTML = `
      <div style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); padding: 20px; color: white;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">📋</span>
          <h3 style="margin: 0; font-size: 22px; font-weight: 600;">Claim Form Detected</h3>
        </div>
      </div>

      <div style="background: white; padding: 24px;">
        <!-- Employee Details -->
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #374151;">Employee Information</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            ${empDetails.name ? `
              <div>
                <div style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">Name</div>
                <div style="font-weight: 600;">${escapeHtml(empDetails.name)}</div>
              </div>
            ` : ''}
            ${empDetails.employeeNo ? `
              <div>
                <div style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">Employee No</div>
                <div style="font-weight: 600;">${escapeHtml(empDetails.employeeNo)}</div>
              </div>
            ` : ''}
            ${empDetails.designation ? `
              <div>
                <div style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">Designation</div>
                <div style="font-weight: 600;">${escapeHtml(empDetails.designation)}</div>
              </div>
            ` : ''}
            ${empDetails.department ? `
              <div>
                <div style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">Department</div>
                <div style="font-weight: 600;">${escapeHtml(empDetails.department)}</div>
              </div>
            ` : ''}
            ${empDetails.claimNo ? `
              <div>
                <div style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">Claim No</div>
                <div style="font-weight: 600;">${escapeHtml(empDetails.claimNo)}</div>
              </div>
            ` : ''}
            ${empDetails.claimDate ? `
              <div>
                <div style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">Claim Date</div>
                <div style="font-weight: 600;">${escapeHtml(empDetails.claimDate)}</div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Treatment Summary -->
        ${treatments.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #374151;">Claimed Treatments (${treatments.length})</h4>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Date</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Patient</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Hospital/Doctor</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Type</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${treatments.map(t => `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                      <td style="padding: 12px;">${escapeHtml(t.date || '-')}</td>
                      <td style="padding: 12px;">
                        ${escapeHtml(t.patientName || '-')}
                        ${t.relation ? `<br><span style="font-size: 12px; color: #6b7280;">(${escapeHtml(t.relation)})</span>` : ''}
                      </td>
                      <td style="padding: 12px;">${escapeHtml(t.hospital || '-')}</td>
                      <td style="padding: 12px;">
                        <span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                          ${escapeHtml(t.treatmentType || '-')}
                        </span>
                      </td>
                      <td style="padding: 12px; text-align: right; font-weight: 600;">${formatCurrency(t.amount)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

      </div>
    `;

    const resultsContainer = document.getElementById('analysisResults');
    resultsContainer.insertBefore(claimFormSection, resultsContainer.firstChild);
  }

  function displayFileResults(files) {
    const prescriptions = [];
    const bills = [];
    const filesByType = { 
      prescription: [], 
      bill: [], 
      consultation_receipt: [],
      test_report: [], 
      lab_report: [],
      claim_form: [],
      unknown: [] 
    };
    let hasPDFPages = false;
    let hasPDFErrors = false;
    const pdfErrors = [];

    files.forEach(file => {
      // Skip claim form files from classification
      if (file.isClaimForm || file.type === 'claim_form') {
        return;
      }
      
      // Check for PDF processing errors
      if (file.error === 'PDF_EXTRACTION_FAILED') {
        hasPDFErrors = true;
        pdfErrors.push(file);
      }
      
      if (file.isPDF && file.page) {
        hasPDFPages = true;
      }
      
      // Categorize files by type
      const fileType = file.type || 'unknown';
      if (filesByType[fileType]) {
        filesByType[fileType].push(file);
      } else {
        filesByType.unknown.push(file);
      }
      
      if (file.prescriptionNames && file.prescriptionNames.length > 0) {
        prescriptions.push(...file.prescriptionNames);
      }
      if (file.billItems && file.billItems.length > 0) {
        bills.push(...file.billItems);
      }
    });

    // Show document type summary
    const docTypeSummary = document.createElement('div');
    docTypeSummary.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      color: white;
      box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
    `;
    
    const prescCount = filesByType.prescription.length;
    const billCount = filesByType.bill.length + (filesByType.consultation_receipt?.length || 0);
    const testCount = filesByType.test_report.length + (filesByType.lab_report?.length || 0);
    
    docTypeSummary.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <span style="font-size: 28px;">📋</span>
        <h3 style="margin: 0; font-size: 20px; font-weight: 600;">Document Classification</h3>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
        <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700;">${prescCount}</div>
          <div style="font-size: 13px; opacity: 0.9;">📝 Prescription${prescCount !== 1 ? 's' : ''}</div>
        </div>
        <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700;">${billCount}</div>
          <div style="font-size: 13px; opacity: 0.9;">💰 Bill${billCount !== 1 ? 's' : ''}</div>
        </div>
        <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700;">${testCount}</div>
          <div style="font-size: 13px; opacity: 0.9;">🧪 Test Report${testCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `;
    
    const resultsContainer = document.getElementById('analysisResults');
    
    // Remove any existing classification sections first
    const existingClassifications = resultsContainer.querySelectorAll('[data-section="classification"]');
    existingClassifications.forEach(el => el.remove());
    
    // Mark this section so we can remove it later
    docTypeSummary.setAttribute('data-section', 'classification');
    
    resultsContainer.insertBefore(docTypeSummary, resultsContainer.firstChild);

    // Show error if PDF processing failed
    if (hasPDFErrors) {
      const pdfError = document.createElement('div');
      pdfError.style.cssText = `
        background: #fee2e2;
        border: 2px solid #dc2626;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      `;
      pdfError.innerHTML = `
        <div style="display: flex; align-items: start; gap: 12px;">
          <span style="font-size: 24px;">⚠️</span>
          <div style="flex: 1;">
            <h3 style="margin: 0 0 8px 0; color: #991b1b; font-size: 16px; font-weight: 600;">
              PDF Processing Failed
            </h3>
            <p style="margin: 0 0 12px 0; color: #7f1d1d;">
              <strong>Poppler is not installed.</strong> PDF files cannot be processed without it.
            </p>
            <div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #991b1b;">Quick Fix:</p>
              <ol style="margin: 0; padding-left: 20px; color: #7f1d1d;">
                <li>Download Poppler: <a href="https://github.com/oschwartz10612/poppler-windows/releases/latest" target="_blank" style="color: #2563eb;">Click here</a></li>
                <li>Extract to <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">C:\\poppler</code></li>
                <li>Add <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">C:\\poppler\\Library\\bin</code> to system PATH</li>
                <li>Restart the server</li>
              </ol>
            </div>
            <div style="background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e;">
                <strong>Workaround:</strong> Convert your PDF pages to JPG or PNG images and upload those instead.
              </p>
            </div>
          </div>
        </div>
      `;
      
      const resultsContainer = document.getElementById('analysisResults');
      resultsContainer.insertBefore(pdfError, resultsContainer.firstChild);
      
      showNotification('error', 'PDF processing failed - Poppler not installed');
    }

    // Show info if PDFs were processed successfully
    if (hasPDFPages) {
      const pdfInfo = document.createElement('div');
      pdfInfo.style.cssText = `
        background: #dbeafe;
        border: 1px solid #3b82f6;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      pdfInfo.innerHTML = `
        <span style="font-size: 20px;">📑</span>
        <span style="color: #1e40af; font-weight: 500;">
          PDF documents were processed - all pages extracted and analyzed
        </span>
      `;
      
      const resultsContainer = document.getElementById('analysisResults');
      resultsContainer.insertBefore(pdfInfo, resultsContainer.firstChild);
    }

    // Display prescriptions
    if (prescriptions.length > 0) {
      prescriptionResults.style.display = 'block';
      const content = document.getElementById('prescriptionResultsContent');
      content.innerHTML = `
        <div class="prescription-content">
          ${prescriptions.map((med, i) => `
            <div class="medicine-item">
              ${i + 1}. ${escapeHtml(med)}
            </div>
          `).join('')}
        </div>
      `;
    }

    // Display bills
    if (bills.length > 0) {
      billResults.style.display = 'block';
      const content = document.getElementById('billResultsContent');
      content.innerHTML = `
        <div class="bill-content">
          ${bills.map((item, i) => `
            <div class="list-row" style="background: white; padding: 8px; border-radius: 6px; margin: 4px 0;">
              <span>${i + 1}. ${escapeHtml(item.name)}</span>
              <span class="amount" style="font-weight: 600; color: #059669;">
                ${formatCurrency(item.amount || 0)}
              </span>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  function displayMatchingResults(matching) {
    document.getElementById('step-compare').style.display = 'block';
    compareResults.style.display = 'block';
    mappingResults.style.display = 'block';

    const summary = matching.summary || {};
    
    // Display summary statistics
    const summaryHTML = `
      <div class="results-header">
        <h3 class="results-title">📊 Analysis Summary</h3>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0;">
        <div class="stat">
          <div class="stat-label">💊 Medicines</div>
          <div class="stat-value">${summary.totalPrescriptions || 0}</div>
        </div>
        <div class="stat">
          <div class="stat-label">🧪 Tests</div>
          <div class="stat-value">${summary.totalTests || 0}</div>
        </div>
        <div class="stat">
          <div class="stat-label">💰 Bill Items</div>
          <div class="stat-value">${summary.totalBillItems || 0}</div>
        </div>
        <div class="stat">
          <div class="stat-label">✅ Matched</div>
          <div class="stat-value" style="color: #10b981;">${summary.matchedCount || 0}</div>
        </div>
        <div class="stat">
          <div class="stat-label">❌ Inadmissible</div>
          <div class="stat-value" style="color: #ef4444;">${summary.inadmissibleCount || 0}</div>
        </div>
        <div class="stat">
          <div class="stat-label">💵 Admissible</div>
          <div class="stat-value" style="color: #10b981;">${formatCurrency(summary.totalAdmissibleAmount)}</div>
        </div>
        <div class="stat">
          <div class="stat-label">🚫 Inadmissible</div>
          <div class="stat-value" style="color: #ef4444;">${formatCurrency(summary.totalInadmissibleAmount)}</div>
        </div>
      </div>
    `;

    globalSummary.innerHTML = summaryHTML;
    globalSummary.style.display = 'block';

    // Display detailed matching table
    displayMatchingTable(matching);
  }

  function displayMatchingTable(matching) {
    let tableHTML = `
      <div class="results-header" style="margin-top: 24px;">
        <h3 class="results-title">💊 Detailed Admissibility Report</h3>
      </div>
      <div class="table">
        <div class="tr th" style="grid-template-columns: 2fr 2fr 120px 100px 150px 2fr;">
          <div>Prescription Medicine</div>
          <div>Bill Item</div>
          <div>Amount</div>
          <div>Match Score</div>
          <div>Status</div>
          <div>Remarks</div>
        </div>
    `;

    // Add matched items
    (matching.matchedItems || []).forEach(item => {
      const statusClass = item.status === 'admissible' ? 'admissible' : 'inadmissible';
      let statusText = 'Admissible';
      let icon = '💊';
      let remarkText = 'Matches prescription';
      
      if (item.isConsultation) {
        statusText = 'Admissible (Consultation)';
        icon = '🩺';
        remarkText = 'Consultation fee within limit';
      } else if (item.isTest) {
        statusText = 'Admissible (Test)';
        icon = '🧪';
        remarkText = 'Medical test/investigation';
      }
      
      tableHTML += `
        <div class="tr" style="grid-template-columns: 2fr 2fr 120px 100px 150px 2fr;">
          <div style="font-weight: 500;">
            ${icon} ${escapeHtml(item.prescriptionName)}
          </div>
          <div>${escapeHtml(item.billItemName)}</div>
          <div class="amount" style="text-align: right; font-weight: 600;">${formatCurrency(item.amount)}</div>
          <div style="text-align: center;">
            <span class="pill" style="background: ${item.matchScore >= 90 ? '#dcfce7' : item.matchScore >= 75 ? '#fef3c7' : '#fecaca'}; 
                                       color: ${item.matchScore >= 90 ? '#166534' : item.matchScore >= 75 ? '#92400e' : '#991b1b'};">
              ${item.matchScore}%
            </span>
          </div>
          <div style="text-align: center;">
            <span class="badge ${statusClass}">${statusText}</span>
          </div>
          <div style="font-size: 13px; color: #059669;">
            ${remarkText}
          </div>
        </div>
      `;
    });

    // Add consultation adjustments
    (matching.consultationAdjustments || []).forEach(item => {
      tableHTML += `
        <div class="tr" style="grid-template-columns: 2fr 2fr 120px 100px 150px 2fr; background: #fef3c7;">
          <div style="font-weight: 500;">${item.prescriptionName ? escapeHtml(item.prescriptionName) : 'Consultation Fee'}</div>
          <div>${escapeHtml(item.itemName)}</div>
          <div style="text-align: right;">
            <div style="text-decoration: line-through; color: #6b7280;">${formatCurrency(item.billedAmount)}</div>
            <div class="amount" style="font-weight: 600;">${formatCurrency(item.admissibleAmount)}</div>
          </div>
          <div style="text-align: center;">
            <span class="pill" style="background: #fef3c7; color: #92400e;">Adjusted</span>
          </div>
          <div style="text-align: center;">
            <span class="badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fbbf24;">
              Partially Admissible
            </span>
          </div>
          <div style="font-size: 13px; color: #92400e;">
            ${escapeHtml(item.reason)}
          </div>
        </div>
      `;
    });

    // Add inadmissible items
    (matching.inadmissibleItems || []).forEach(item => {
      tableHTML += `
        <div class="tr" style="grid-template-columns: 2fr 2fr 120px 100px 150px 2fr;">
          <div style="color: #9ca3af;">—</div>
          <div>${escapeHtml(item.billItemName)}</div>
          <div class="amount" style="text-align: right; font-weight: 600; color: #ef4444;">${formatCurrency(item.amount)}</div>
          <div style="text-align: center;">
            <span class="pill" style="background: #fecaca; color: #991b1b;">0%</span>
          </div>
          <div style="text-align: center;">
            <span class="badge inadmissible">Inadmissible</span>
          </div>
          <div style="font-size: 13px; color: #dc2626;">
            ${escapeHtml(item.reason)}
          </div>
        </div>
      `;
    });

    // Add unmatched prescriptions
    (matching.unmatchedPrescriptions || []).forEach(item => {
      tableHTML += `
        <div class="tr" style="grid-template-columns: 2fr 2fr 120px 100px 150px 2fr; background: #f3f4f6;">
          <div style="font-weight: 500;">💊 ${escapeHtml(item.prescriptionName)}</div>
          <div style="color: #9ca3af;">Not billed</div>
          <div style="text-align: right; color: #9ca3af;">—</div>
          <div style="text-align: center; color: #9ca3af;">—</div>
          <div style="text-align: center;">
            <span class="badge" style="background: #f3f4f6; color: #6b7280; border: 1px solid #d1d5db;">
              Not Claimed
            </span>
          </div>
          <div style="font-size: 13px; color: #6b7280;">
            ${escapeHtml(item.reason)}
          </div>
        </div>
      `;
    });

    // Add unmatched tests
    (matching.unmatchedTests || []).forEach(item => {
      tableHTML += `
        <div class="tr" style="grid-template-columns: 2fr 2fr 120px 100px 150px 2fr; background: #f3f4f6;">
          <div style="font-weight: 500;">🧪 ${escapeHtml(item.testName)}</div>
          <div style="color: #9ca3af;">Not billed</div>
          <div style="text-align: right; color: #9ca3af;">—</div>
          <div style="text-align: center; color: #9ca3af;">—</div>
          <div style="text-align: center;">
            <span class="badge" style="background: #f3f4f6; color: #6b7280; border: 1px solid #d1d5db;">
              Not Claimed
            </span>
          </div>
          <div style="font-size: 13px; color: #6b7280;">
            ${escapeHtml(item.reason)}
          </div>
        </div>
      `;
    });

    tableHTML += '</div>';

    // Add totals row
    const summary = matching.summary || {};
    tableHTML += `
      <div style="margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #f8fafc 0%, #f0f9ff 100%); border-radius: 8px; border: 2px solid #3b82f6;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
          <div style="text-align: center;">
            <div style="font-size: 14px; color: #64748b; margin-bottom: 4px;">Total Admissible</div>
            <div style="font-size: 24px; font-weight: 700; color: #10b981;">${formatCurrency(summary.totalAdmissibleAmount)}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 14px; color: #64748b; margin-bottom: 4px;">Total Inadmissible</div>
            <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${formatCurrency(summary.totalInadmissibleAmount)}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 14px; color: #64748b; margin-bottom: 4px;">Consultation Excess</div>
            <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${formatCurrency(summary.totalConsultationExcess)}</div>
          </div>
        </div>
      </div>
    `;

    mappingResults.innerHTML = tableHTML;
  }

  // Export Functionality
  document.getElementById('exportCsvBtn').addEventListener('click', exportToExcel);
  document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);

  function exportToExcel() {
    if (!analysisData || !analysisData.matching) {
      showNotification('error', 'No analysis data available to export');
      return;
    }

    const matching = analysisData.matching;
    const summary = matching.summary || {};
    
    // Create CSV content
    let csv = 'Medical Claims Analysis Report\n\n';
    csv += `Employee: ${empNameInput.value} (${empIdInput.value})\n`;
    csv += `Date: ${new Date().toLocaleDateString()}\n\n`;
    
    // Summary section
    csv += 'SUMMARY\n';
    csv += `Total Prescriptions,${summary.totalPrescriptions || 0}\n`;
    csv += `Total Bill Items,${summary.totalBillItems || 0}\n`;
    csv += `Matched Items,${summary.matchedCount || 0}\n`;
    csv += `Inadmissible Items,${summary.inadmissibleCount || 0}\n`;
    csv += `Total Admissible Amount,${formatCurrency(summary.totalAdmissibleAmount)}\n`;
    csv += `Total Inadmissible Amount,${formatCurrency(summary.totalInadmissibleAmount)}\n`;
    csv += `Consultation Excess,${formatCurrency(summary.totalConsultationExcess)}\n\n`;
    
    // Detailed items
    csv += 'DETAILED REPORT\n';
    csv += 'Prescription Medicine,Bill Item,Amount,Match Score,Status,Remarks\n';
    
    // Matched items
    (matching.matchedItems || []).forEach(item => {
      const statusText = item.isConsultation ? 'Admissible (Consultation)' : 'Admissible';
      const remarks = item.isConsultation ? 'Consultation fee within limit' : 'Matches prescription';
      csv += `"${item.prescriptionName}","${item.billItemName}",${item.amount},${item.matchScore}%,${statusText},"${remarks}"\n`;
    });
    
    // Consultation adjustments
    (matching.consultationAdjustments || []).forEach(item => {
      const prescName = item.prescriptionName || 'Consultation Fee';
      csv += `"${prescName}","${item.itemName}",${item.admissibleAmount},Adjusted,Partially Admissible,"${item.reason}"\n`;
    });
    
    // Inadmissible items
    (matching.inadmissibleItems || []).forEach(item => {
      csv += `"—","${item.billItemName}",${item.amount},0%,Inadmissible,"${item.reason}"\n`;
    });
    
    // Unmatched prescriptions
    (matching.unmatchedPrescriptions || []).forEach(item => {
      csv += `"${item.prescriptionName}","Not billed",—,—,Not Claimed,"${item.reason}"\n`;
    });
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Medical_Claims_${empIdInput.value}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('success', 'Excel report downloaded successfully');
  }

  function exportToPDF() {
    if (!analysisData || !analysisData.matching) {
      showNotification('error', 'No analysis data available to export');
      return;
    }

    const matching = analysisData.matching;
    const summary = matching.summary || {};
    
    // Create a printable HTML version
    const printWindow = window.open('', '_blank');
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Medical Claims Report</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            max-width: 1200px;
            margin: 0 auto;
            background: white;
          }
          h1 {
            color: #1e293b;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          h2 {
            color: #475569;
            margin-top: 30px;
            margin-bottom: 15px;
          }
          .header-info {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .header-info p {
            margin: 5px 0;
            color: #64748b;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 30px;
          }
          .summary-card {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e2e8f0;
          }
          .summary-label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 5px;
          }
          .summary-value {
            font-size: 24px;
            font-weight: bold;
            color: #1e293b;
          }
          .summary-value.positive { color: #10b981; }
          .summary-value.negative { color: #ef4444; }
          .summary-value.warning { color: #f59e0b; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
          }
          th {
            background: #3b82f6;
            color: white;
            padding: 12px 8px;
            text-align: left;
            font-weight: 600;
          }
          td {
            padding: 10px 8px;
            border-bottom: 1px solid #e2e8f0;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .status-admissible {
            background: #dcfce7;
            color: #166534;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
          }
          .status-inadmissible {
            background: #fecaca;
            color: #991b1b;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
          }
          .status-partial {
            background: #fef3c7;
            color: #92400e;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
          }
          .status-notclaimed {
            background: #f3f4f6;
            color: #6b7280;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
          }
          .totals {
            margin-top: 30px;
            padding: 20px;
            background: #f0f9ff;
            border: 2px solid #3b82f6;
            border-radius: 8px;
          }
          .totals-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            text-align: center;
          }
          .total-item {
            padding: 15px;
          }
          .total-label {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 5px;
          }
          .total-value {
            font-size: 28px;
            font-weight: bold;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
          .print-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            margin-bottom: 20px;
          }
          .print-btn:hover {
            background: #2563eb;
          }
        </style>
      </head>
      <body>
        <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
        
        <h1>Medical Claims Analysis Report</h1>
        
        <div class="header-info">
          <p><strong>Employee Name:</strong> ${escapeHtml(empNameInput.value)}</p>
          <p><strong>Employee ID:</strong> ${escapeHtml(empIdInput.value)}</p>
          <p><strong>Report Date:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <h2>Executive Summary</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Total Prescriptions</div>
            <div class="summary-value">${summary.totalPrescriptions || 0}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Bill Items</div>
            <div class="summary-value">${summary.totalBillItems || 0}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Matched Items</div>
            <div class="summary-value positive">${summary.matchedCount || 0}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Inadmissible Items</div>
            <div class="summary-value negative">${summary.inadmissibleCount || 0}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Admissible Amount</div>
            <div class="summary-value positive">${formatCurrency(summary.totalAdmissibleAmount)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Inadmissible Amount</div>
            <div class="summary-value negative">${formatCurrency(summary.totalInadmissibleAmount)}</div>
          </div>
        </div>
        
        <h2>Detailed Admissibility Report</h2>
        <table>
          <thead>
            <tr>
              <th>Prescription Medicine</th>
              <th>Bill Item</th>
              <th style="text-align: right;">Amount</th>
              <th style="text-align: center;">Match Score</th>
              <th style="text-align: center;">Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    // Add matched items
    (matching.matchedItems || []).forEach(item => {
      const statusClass = item.isConsultation ? 'status-admissible' : 'status-admissible';
      const statusText = item.isConsultation ? 'Admissible (Consultation)' : 'Admissible';
      const remarks = item.isConsultation ? 'Consultation fee within limit' : 'Matches prescription';
      
      html += `
        <tr>
          <td><strong>${escapeHtml(item.prescriptionName)}</strong></td>
          <td>${escapeHtml(item.billItemName)}</td>
          <td style="text-align: right; font-weight: 600;">${formatCurrency(item.amount)}</td>
          <td style="text-align: center;">${item.matchScore}%</td>
          <td style="text-align: center;"><span class="${statusClass}">${statusText}</span></td>
          <td>${escapeHtml(remarks)}</td>
        </tr>
      `;
    });
    
    // Add consultation adjustments
    (matching.consultationAdjustments || []).forEach(item => {
      const prescName = item.prescriptionName || 'Consultation Fee';
      
      html += `
        <tr style="background: #fef3c7;">
          <td><strong>${escapeHtml(prescName)}</strong></td>
          <td>${escapeHtml(item.itemName)}</td>
          <td style="text-align: right;">
            <div style="text-decoration: line-through; color: #6b7280;">${formatCurrency(item.billedAmount)}</div>
            <div style="font-weight: 600;">${formatCurrency(item.admissibleAmount)}</div>
          </td>
          <td style="text-align: center;">Adjusted</td>
          <td style="text-align: center;"><span class="status-partial">Partially Admissible</span></td>
          <td>${escapeHtml(item.reason)}</td>
        </tr>
      `;
    });
    
    // Add inadmissible items
    (matching.inadmissibleItems || []).forEach(item => {
      html += `
        <tr>
          <td style="color: #9ca3af;">—</td>
          <td>${escapeHtml(item.billItemName)}</td>
          <td style="text-align: right; font-weight: 600; color: #ef4444;">${formatCurrency(item.amount)}</td>
          <td style="text-align: center;">0%</td>
          <td style="text-align: center;"><span class="status-inadmissible">Inadmissible</span></td>
          <td>${escapeHtml(item.reason)}</td>
        </tr>
      `;
    });
    
    // Add unmatched prescriptions
    (matching.unmatchedPrescriptions || []).forEach(item => {
      html += `
        <tr style="background: #f3f4f6;">
          <td><strong>${escapeHtml(item.prescriptionName)}</strong></td>
          <td style="color: #9ca3af;">Not billed</td>
          <td style="text-align: right; color: #9ca3af;">—</td>
          <td style="text-align: center; color: #9ca3af;">—</td>
          <td style="text-align: center;"><span class="status-notclaimed">Not Claimed</span></td>
          <td>${escapeHtml(item.reason)}</td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
        
        <div class="totals">
          <h2 style="margin-top: 0;">Financial Summary</h2>
          <div class="totals-grid">
            <div class="total-item">
              <div class="total-label">Total Admissible</div>
              <div class="total-value positive">${formatCurrency(summary.totalAdmissibleAmount)}</div>
            </div>
            <div class="total-item">
              <div class="total-label">Total Inadmissible</div>
              <div class="total-value negative">${formatCurrency(summary.totalInadmissibleAmount)}</div>
            </div>
            <div class="total-item">
              <div class="total-label">Consultation Excess</div>
              <div class="total-value warning">${formatCurrency(summary.totalConsultationExcess)}</div>
            </div>
          </div>
        </div>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px;">
          <p>This report was generated automatically by the Medical Claims Processing System</p>
          <p>Generated on: ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    showNotification('success', 'PDF preview opened. Use Print to save as PDF');
  }

  // New Analysis Button
  newAnalysisBtn.addEventListener('click', () => {
    showConfirmDialog(
      'Start a new analysis? This will clear all current data.',
      () => resetAnalysis()
    );
  });

  // Add More Files Button
  document.addEventListener('click', (e) => {
    if (e.target.id === 'addMoreFilesBtn') {
      bulkInput.click();
    }
  });

  // Re-Analyze All Button
  document.addEventListener('click', (e) => {
    if (e.target.id === 'reAnalyzeAllBtn') {
      if (uploadedFiles.length === 0) {
        showNotification('error', 'No files to re-analyze. Please upload files first.');
        return;
      }
      
      showConfirmDialog(
        'Re-analyze all documents? This may take a few moments.',
        () => {
          showNotification('info', 'Starting re-analysis...');
          // Hide current results
          analysisResults.style.display = 'none';
          compareResults.style.display = 'none';
          mappingResults.style.display = 'none';
          document.getElementById('step-compare').style.display = 'none';
          
          // Restart analysis
          startAnalysis();
        }
      );
    }
  });

  function resetAnalysis() {
    uploadedFiles = [];
    analysisData = null;
    
    empNameInput.value = '';
    empIdInput.value = '';
    bulkThumbs.innerHTML = '';
    analysisSection.style.display = 'none';
    analysisResults.style.display = 'none';
    compareResults.style.display = 'none';
    mappingResults.style.display = 'none';
    globalSummary.style.display = 'none';
    prescriptionResults.style.display = 'none';
    billResults.style.display = 'none';
    uploadProgress.style.display = 'none';
    document.getElementById('step-compare').style.display = 'none';
    
    startAnalysisBtn.disabled = true;
    document.getElementById('exportCsvBtn').disabled = true;
    document.getElementById('exportPdfBtn').disabled = true;
    
    showNotification('success', 'Ready for new analysis');
  }

  // Back to Top Button Functionality
  const backToTopBtn = document.getElementById('backToTopBtn');
  
  // Show/hide button based on scroll position
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      backToTopBtn.style.display = 'flex';
    } else {
      backToTopBtn.style.display = 'none';
    }
  });
  
  // Smooth scroll to top
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // Initialize
  console.log('Medical Claims Processor initialized');
})();