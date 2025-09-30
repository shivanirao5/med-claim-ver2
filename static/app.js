// Enhanced Medical Claim Assistant - Modern JavaScript Application
// Version: 2.0 - Professional GenAI Developer Enhanced

// Performance monitoring
const performance_start = performance.now();

// Modern Theme Management
class ThemeManager {
  constructor() {
    this.theme = localStorage.getItem('theme') || 'light';
    this.init();
  }
  
  init() {
    document.documentElement.setAttribute('data-theme', this.theme);
    this.updateThemeButton();
  }
  
  toggle() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.theme);
    document.documentElement.setAttribute('data-theme', this.theme);
    this.updateThemeButton();
    this.showToast('Theme updated to ' + this.theme + ' mode');
  }
  
  updateThemeButton() {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
      themeIcon.textContent = this.theme === 'light' ? 'Dark' : 'Light';
    }
  }
  
  showToast(message) {
    // Simple toast for theme changes
    console.log(message);
  }
}

// Enhanced Progress Management
class ProgressManager {
  constructor(containerId, fillId, textId, percentId) {
    this.container = document.getElementById(containerId);
    this.fill = document.getElementById(fillId);
    this.text = document.getElementById(textId);
    this.percent = document.getElementById(percentId);
  }
  
  show() {
    if (this.container) this.container.style.display = 'block';
  }
  
  hide() {
    if (this.container) this.container.style.display = 'none';
  }
  
  update(percentage, text) {
    if (this.fill) this.fill.style.width = percentage + '%';
    if (this.text) this.text.textContent = text;
    if (this.percent) this.percent.textContent = Math.round(percentage) + '%';
  }
}

// Performance Analytics
class AnalyticsManager {
  constructor() {
    this.events = [];
    this.startTime = performance.now();
  }
  
  trackEvent(event, data = {}) {
    this.events.push({
      event,
      data,
      timestamp: performance.now() - this.startTime
    });
  }
  
  getMetrics() {
    return {
      totalEvents: this.events.length,
      sessionDuration: performance.now() - this.startTime,
      events: this.events
    };
  }
}

// Initialize managers
const themeManager = new ThemeManager();
const progressManager = new ProgressManager('uploadProgress', 'progressFill', 'progressText', 'progressPercent');
const analytics = new AnalyticsManager();

// DOM Elements with enhanced error handling
const prescriptionResults = document.getElementById('prescriptionResults');
const prescriptionResultsContent = document.getElementById('prescriptionResultsContent');
const reAnalyzeBillBtn = document.getElementById('reAnalyzeBill');
const billResults = document.getElementById('billResults');
const billResultsContent = document.getElementById('billResultsContent');

const compareBtn = document.getElementById('compareBtn');
const compareResults = document.getElementById('compareResults');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const mappingResults = document.getElementById('mappingResults');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const prescriptionEditor = document.getElementById('prescriptionEditor');
const addPrescriptionBtn = document.getElementById('addPrescription');
const billEditor = document.getElementById('billEditor');
const addBillItemBtn = document.getElementById('addBillItem');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');
const bulkInput = document.getElementById('bulkInput');
const bulkThumbs = document.getElementById('bulkThumbs');
const employeeNameInput = document.getElementById('employeeName');
const employeeIdInput = document.getElementById('employeeId');
const dropZone = document.getElementById('dropZone');
const globalSummary = document.getElementById('globalSummary');

// File info elements
const prescriptionFileInfo = document.getElementById('prescriptionFileInfo');
const prescriptionFileName = document.getElementById('prescriptionFileName');
const prescriptionFileSize = document.getElementById('prescriptionFileSize');
const removePrescriptionFile = document.getElementById('removePrescriptionFile');

const billFileInfo = document.getElementById('billFileInfo');
const billFileName = document.getElementById('billFileName');
const billFileSize = document.getElementById('billFileSize');
const removeBillFile = document.getElementById('removeBillFile');

// Progress elements removed (no fake progress bar)

// Popup elements
const customPopup = document.getElementById('customPopup');
const popupIcon = document.getElementById('popupIcon');
const popupTitle = document.getElementById('popupTitle');
const popupMessage = document.getElementById('popupMessage');
const popupConfirm = document.getElementById('popupConfirm');
const popupCancel = document.getElementById('popupCancel');

// Count elements
const prescriptionCount = document.getElementById('prescriptionCount');
const billCount = document.getElementById('billCount');

// Accumulated UI removed; we will show combined lists within existing sections

let state = {
  prescriptions: [], // Array of prescription objects
  bills: [], // Array of bill objects
  currentPrescriptionIndex: -1,
  currentBillIndex: -1,
};

// Keep last analyzed file signatures to warn on re-analysis
let lastPrescriptionSig = null;
let lastBillSig = null;

function fileSignature(file) {
  if (!file) return null;
  return `${file.name}|${file.size}|${file.lastModified}`;
}

function validateEmployeeInfo() {
  const name = (employeeNameInput?.value || '').trim();
  const id = (employeeIdInput?.value || '').trim();
  
  if (!name) {
    showPopup('error', 'Employee Name Required', 'Please enter the employee name before processing documents.');
    employeeNameInput?.focus();
    return false;
  }
  
  if (!id) {
    showPopup('error', 'Employee ID Required', 'Please enter the employee ID to avoid confusion with employees having similar names.');
    employeeIdInput?.focus();
    return false;
  }
  
  return true;
}

// Helper functions for state management
function getAllPrescriptionNames() {
  return state.prescriptions.flatMap(p => p.names || []);
}

function getAllBillItems() {
  return state.bills.flatMap(b => b.items || []);
}

// Flattened maps for editing combined lists
function getFlattenedPrescriptionMap() {
  const map = [];
  state.prescriptions.forEach((p, pIndex) => {
    (p.names || []).forEach((name, nIndex) => {
      map.push({ pIndex, nIndex, name });
    });
  });
  return map;
}

function getFlattenedBillMap() {
  const map = [];
  state.bills.forEach((b, bIndex) => {
    (b.items || []).forEach((item, iIndex) => {
      map.push({ bIndex, iIndex, item });
    });
  });
  return map;
}

function addPrescription(names) {
  state.prescriptions.push({ names: names || [] });
  state.currentPrescriptionIndex = state.prescriptions.length - 1;
}

function addBill(items) {
  state.bills.push({ items: items || [] });
  state.currentBillIndex = state.bills.length - 1;
}

function updateCurrentPrescription(names) {
  if (state.currentPrescriptionIndex >= 0) {
    state.prescriptions[state.currentPrescriptionIndex].names = names || [];
  }
}

function updateCurrentBill(items) {
  if (state.currentBillIndex >= 0) {
    state.bills[state.currentBillIndex].items = items || [];
  }
}

function updateCountBadges() {
  if (prescriptionCount) {
    prescriptionCount.textContent = `(${state.prescriptions.length})`;
  }
  if (billCount) {
    billCount.textContent = `(${state.bills.length})`;
  }
}
// No separate accumulated UI; we only keep counts

function updateCompareAvailability() {
  if (!compareBtn) return;
  const presCount = getAllPrescriptionNames().filter(n => typeof n === 'string' && n.trim().length > 0).length;
  const billValid = getAllBillItems().filter(it => it && typeof it.name === 'string' && it.name.trim().length > 0).length;
  compareBtn.disabled = !(presCount && billValid);
  // Auto compare when both sides have content
  if (presCount && billValid && compareBtn.disabled === false) {
    autoCompare();
  }
  renderGlobalSummary();
}

// Notification System - Reduced popups for better UX
function showPopup(type, title, message, onConfirm = null, onCancel = null, suppressSuccess = false) {
  // For success messages, show subtle notification instead of modal
  if (type === 'success' && !onConfirm && !onCancel && suppressSuccess) {
    showToast(type, title, message);
    return;
  }
  
  const icons = {
    success: 'SUCCESS',
    error: 'ERROR',
    warning: 'WARNING',
    info: 'INFO'
  };
  
  popupIcon.textContent = icons[type] || icons.info;
  popupTitle.textContent = title;
  popupMessage.textContent = message;
  
  customPopup.className = `popup-overlay ${type}`;
  customPopup.classList.remove('hidden');
  
  // Reset button states
  popupCancel.classList.add('hidden');
  popupConfirm.textContent = 'OK';
  
  // Set up event listeners
  popupConfirm.onclick = () => {
    hidePopup();
    if (onConfirm) onConfirm();
  };
  
  if (onCancel) {
    popupCancel.classList.remove('hidden');
    popupCancel.onclick = () => {
      hidePopup();
      onCancel();
    };
  }
}

// Toast notification for non-critical success messages
function showToast(type, title, message) {
  const toast = document.createElement('div');
  const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
  
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#ef4444'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1001;
    max-width: 300px;
    font-size: 14px;
    animation: slideIn 0.3s ease;
  `;
  
  toast.innerHTML = `${icons[type]} <strong>${title}</strong><br>${message}`;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function hidePopup() {
  customPopup.classList.add('hidden');
}

// Close popup when clicking outside
customPopup.addEventListener('click', (e) => {
  if (e.target === customPopup) {
    hidePopup();
  }
});

// Close popup with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !customPopup.classList.contains('hidden')) {
    hidePopup();
  }
});

// File size formatter
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Progress removed

// Show file info
function showFileInfo(file, fileInfoElement, fileNameElement, fileSizeElement) {
  fileNameElement.textContent = file.name;
  fileSizeElement.textContent = formatFileSize(file.size);
  fileInfoElement.classList.remove('hidden');
}

// Hide file info
function hideFileInfo(fileInfoElement) {
  fileInfoElement.classList.add('hidden');
}

// No API key save button

// Startup health check for API key presence
(async function initHealthCheck(){
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (!data?.hasKey) {
      // Disable actionable controls
      if (analyzePrescriptionBtn) analyzePrescriptionBtn.disabled = true;
      if (analyzeBillBtn) analyzeBillBtn.disabled = true;
      if (compareBtn) compareBtn.disabled = true;
      if (exportCsvBtn) exportCsvBtn.disabled = true;
      // Show guidance popup
      showPopup(
        'error',
        'Server API Key Missing',
        'The backend is missing GEMINI_API_KEY.\n\nFix: Create a .env in the project root with\nGEMINI_API_KEY=YOUR_KEY\n\nOr in PowerShell before running: $env:GEMINI_API_KEY = "YOUR_KEY"\nThen restart the server.',
      );
    }
  } catch (e) {
    console.error('Health check failed', e);
  }
})();

// Individual file inputs removed - using bulk upload only



// Remove file buttons
removePrescriptionFile.addEventListener('click', () => {
  prescriptionInput.value = '';
  analyzePrescriptionBtn.disabled = true;
  reAnalyzePrescriptionBtn.disabled = true;
  hideFileInfo(prescriptionFileInfo);
  prescriptionResults.innerHTML = '';
  prescriptionResults.style.display = 'none';
  prescriptionEditor.innerHTML = '';
  
  // Remove current prescription if it exists
  if (state.currentPrescriptionIndex >= 0) {
    state.prescriptions.splice(state.currentPrescriptionIndex, 1);
    state.currentPrescriptionIndex = -1;
  }
  
  const allPrescriptions = getAllPrescriptionNames();
  const allBills = getAllBillItems();
  updateCompareAvailability();
  updateCountBadges();
});

removeBillFile.addEventListener('click', () => {
  billInput.value = '';
  analyzeBillBtn.disabled = true;
  reAnalyzeBillBtn.disabled = true;
  hideFileInfo(billFileInfo);
  billResults.innerHTML = '';
  billResults.style.display = 'none';
  billEditor.innerHTML = '';
  
  // Remove current bill if it exists
  if (state.currentBillIndex >= 0) {
    state.bills.splice(state.currentBillIndex, 1);
    state.currentBillIndex = -1;
  }
  
  const allPrescriptions = getAllPrescriptionNames();
  const allBills = getAllBillItems();
  updateCompareAvailability();
  updateCountBadges();
});

// New Analysis button - resets everything
newAnalysisBtn.addEventListener('click', () => {
  // provide OK and Cancel actions
  showPopup('warning', 'Reset Analysis', 'Are you sure you want to start a new analysis? This will clear all current data.', () => {
    // Reset file inputs
    if (bulkInput) bulkInput.value = '';
    
    // Reset state
    state.prescriptions = [];
    state.bills = [];
    state.currentPrescriptionIndex = -1;
    state.currentBillIndex = -1;
    state._rows = [];
    
    // Reset UI elements
    if (prescriptionResults) prescriptionResults.style.display = 'none';
    if (billResults) billResults.style.display = 'none';
    if (compareResults) compareResults.innerHTML = '';
    if (mappingResults) mappingResults.innerHTML = '';
    if (prescriptionEditor) prescriptionEditor.innerHTML = '';
    if (billEditor) billEditor.innerHTML = '';
    if (bulkThumbs) bulkThumbs.innerHTML = '';
    if (globalSummary) globalSummary.innerHTML = '';
    
    // Hide analysis sections
    const analysisSection = document.getElementById('analysisSection');
    const analysisResults = document.getElementById('analysisResults');
    if (analysisSection) analysisSection.style.display = 'none';
    if (analysisResults) analysisResults.style.display = 'none';
    
    // Reset button states
    if (exportCsvBtn) exportCsvBtn.disabled = true;
    if (exportPdfBtn) exportPdfBtn.disabled = true;
    if (employeeNameInput) employeeNameInput.value = '';
    if (employeeIdInput) employeeIdInput.value = '';
    
    // Update displays
    updateCountBadges();
    updateCompareAvailability();
    
    showToast('success', 'Data Cleared', 'Ready for new analysis');
  }, () => {
    // Cancel pressed: nothing to do
  });
});

// Individual analyze buttons removed - using bulk upload workflow only

async function analyzePrescriptionFile(file, isReAnalysis = false) {
  analyzePrescriptionBtn.disabled = true;
  reAnalyzePrescriptionBtn.disabled = true;
  
  prescriptionResults.style.display = 'block';
  if (prescriptionResultsContent) {
    prescriptionResultsContent.innerHTML = '<em>Analyzing prescription...</em>';
  } else {
    prescriptionResults.innerHTML = '<em>Analyzing prescription...</em>';
  }
  
  try {
    const employee = (employeeNameInput?.value || '').trim();
    const employeeId = (employeeIdInput?.value || '').trim();
    const employeeData = `${employee} (ID: ${employeeId})`;
    
    const { prescriptionNames } = await callServerWithEmployee('/api/ocr/prescription', file, employeeData);
    const names = prescriptionNames || [];
    
    if (isReAnalysis && state.currentPrescriptionIndex >= 0) {
      // Replace current prescription instead of adding new
      updateCurrentPrescription(names);
    } else {
      addPrescription(names);
    }
    
    // Render combined prescription list
    const targetElement = prescriptionResultsContent || prescriptionResults;
    renderList(targetElement, getAllPrescriptionNames());
    renderPrescriptionEditor();
    updateCountBadges();
    updateCompareAvailability();
    lastPrescriptionSig = fileSignature(file);
    
    const action = isReAnalysis ? 'Re-analysis' : 'Analysis';
    if (names.length > 0) {
      showToast('success', `${action} Complete`, `Found ${names.length} medicine(s). Total: ${state.prescriptions.length} prescriptions`);
    } else {
      showToast('warning', 'No Medicines Found', 'Use "Add Medicine" to add items manually');
    }
  } catch (e) {
    console.error(e);
    const targetElement = prescriptionResultsContent || prescriptionResults;
    targetElement.innerHTML = `<span style="color:red">${e.message}</span>`;
    showPopup('error', 'Analysis Failed', `Failed to analyze prescription: ${e.message}`);
  } finally {
    analyzePrescriptionBtn.disabled = false;
    reAnalyzePrescriptionBtn.disabled = false;
    updateCompareAvailability();
    if (exportCsvBtn) exportCsvBtn.disabled = true;
  }
}

analyzeBillBtn.addEventListener('click', async () => {
  if (!validateEmployeeInfo()) return;
  if (!billInput.files?.length) { 
    showPopup('error', 'No File Selected', 'Please choose a bill image first.');
    return; 
  }
  
  const file = billInput.files[0];
  const sig = fileSignature(file);
  if (sig && sig === lastBillSig) {
    showPopup('warning', 'Same Image Detected', 'You have already analyzed this same bill image. Proceed to analyze again?', async () => {
      await analyzeBillFile(file);
    }, () => {});
    return;
  }
  await analyzeBillFile(file);
});

// Re-analyze bill button
reAnalyzeBillBtn.addEventListener('click', async () => {
  if (!validateEmployeeInfo()) return;
  if (!billInput.files?.length) { 
    showPopup('error', 'No File Selected', 'Please choose a bill image first.');
    return; 
  }
  
  const file = billInput.files[0];
  showPopup('info', 'Re-analyzing Bill', 'Re-analyzing the bill with fresh extraction. This may yield different results.', async () => {
    lastBillSig = null; // Clear signature to force re-analysis
    await analyzeBillFile(file, true);
  }, () => {});
});

async function analyzeBillFile(file, isReAnalysis = false) {
  analyzeBillBtn.disabled = true;
  reAnalyzeBillBtn.disabled = true;
  
  billResults.style.display = 'block';
  if (billResultsContent) {
    billResultsContent.innerHTML = '<em>Analyzing bill...</em>';
  } else {
    billResults.innerHTML = '<em>Analyzing bill...</em>';
  }
  
  try {
    const employee = (employeeNameInput?.value || '').trim();
    const employeeId = (employeeIdInput?.value || '').trim();
    const employeeData = `${employee} (ID: ${employeeId})`;
    
    const { billItems } = await callServerWithEmployee('/api/ocr/bill', file, employeeData);
    const items = billItems || [];
    
    if (isReAnalysis && state.currentBillIndex >= 0) {
      // Replace current bill instead of adding new
      updateCurrentBill(items);
    } else {
      addBill(items);
    }
    
    // Render combined bills list
    const targetElement = billResultsContent || billResults;
    renderList(targetElement, getAllBillItems().map(i => `${i.name}${i.amount!=null?` - ₹${i.amount}`:''}`));
    renderBillEditor();
    updateCountBadges();
    updateCompareAvailability();
    lastBillSig = fileSignature(file);
    
    const action = isReAnalysis ? 'Re-analysis' : 'Analysis';
    if (items.length > 0) {
      const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
      showToast('success', `${action} Complete`, `Found ${items.length} item(s), ₹${totalAmount.toFixed(2)}. Total: ${state.bills.length} bills`);
    } else {
      showToast('warning', 'No Items Found', 'Use "Add Item" to add items manually');
    }
  } catch (e) {
    console.error(e);
    const targetElement = billResultsContent || billResults;
    targetElement.innerHTML = `<span style="color:red">${e.message}</span>`;
    showPopup('error', 'Analysis Failed', `Failed to analyze bill: ${e.message}`);
  } finally {
    analyzeBillBtn.disabled = false;
    reAnalyzeBillBtn.disabled = false;
    updateCompareAvailability();
    if (exportCsvBtn) exportCsvBtn.disabled = true;
  }
}

function autoCompare() { doCompare(true); }

compareBtn.addEventListener('click', () => { doCompare(false); });

function doCompare(silent) {
  const prescribed = getAllPrescriptionNames().map(n => n.toLowerCase());
  const allBillItems = getAllBillItems();
  
  // Only process items that were actually extracted from bills
  const validBillItems = allBillItems.filter(item => {
    // Ensure item has required properties and is from bill data
    return item && item.name && typeof item.name === 'string' && item.name.trim().length > 0;
  });
  
  console.log(`Processing ${validBillItems.length} valid bill items for analysis`);
  
  const rows = validBillItems.map(item => {
    const billLower = (item.name || '').toLowerCase().trim();
    let matchedWith = null;
    let matchedBy = null;
    for (const p of prescribed) {
      const method = matchMethod(billLower, p);
      if (method) { matchedWith = p; matchedBy = method; break; }
    }
    const match = Boolean(matchedWith);
    const isConsultation = isConsultationItem(billLower);
    
    // Log consultation detection for debugging
    if (isConsultation) {
      console.log(`Consultation item detected: "${item.name}" with amount ₹${item.amount || 0}`);
    }
    
    // Apply consultation limit of ₹300 - only for items extracted from bills
    let status = 'inadmissible';
    let amount = Number(item.amount ?? 0);
    let admissibleAmount = amount;
    
    if (isConsultation && amount > 300) {
      // For consultation, make admissible only up to ₹300 regardless of prescription match
      status = 'admissible';
      admissibleAmount = 300;
      console.log(`Consultation fee limited: ${item.name} from ₹${amount} to ₹300`);
    } else if (isConsultation) {
      // Consultation within limit
      status = 'admissible';
      admissibleAmount = amount;
    } else if (match) {
      status = 'admissible';
      admissibleAmount = amount;
    }
    
    const reason = isConsultation && amount > 300
      ? `Consultation limited to ₹300 (original: ₹${amount})`
      : isConsultation
        ? 'Consultation fee (within limit)'
        : match
          ? `Matches prescription: "${matchedWith}" via ${matchedBy}`
          : `No prescription match for "${item.name}"`;

    return {
      bill: item.name,
      status: status,
      amount: amount,
      admissibleAmount: admissibleAmount,
      isConsultation: isConsultation,
      reason: reason,
      matchedWith: matchedWith,
      matchedBy: matchedBy
    };
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const admissible = rows.filter(r => r.status==='admissible').reduce((s, r) => s + (r.admissibleAmount || r.amount), 0);
  const inadmissible = total - admissible;
  
  // Show result sections
  compareResults.style.display = 'block';
  mappingResults.style.display = 'block';
  
  compareResults.innerHTML = renderCompareTable(rows, { total, admissible, inadmissible });
  mappingResults.innerHTML = renderMapping(rows);
  if (exportCsvBtn) exportCsvBtn.disabled = false;
  if (exportPdfBtn) exportPdfBtn.disabled = false;
  state._rows = rows;
  
  // Show comparison results popup
  const admissibleCount = rows.filter(r => r.status === 'admissible').length;
  const inadmissibleCount = rows.filter(r => r.status === 'inadmissible').length;
  
  if (!silent) {
    if (admissibleCount > 0) {
      showToast('success', 'Analysis Complete', 
        `✅ ${admissibleCount} admissible (₹${admissible.toFixed(2)}) • ❌ ${inadmissibleCount} inadmissible (₹${inadmissible.toFixed(2)})`);
    } else {
      showToast('warning', 'No Matches Found', 
        `All ${inadmissibleCount} item(s) are inadmissible (₹${inadmissible.toFixed(2)})`);
    }
  }
}

async function callServer(path, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(path, { method: 'POST', body: form });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`API error: ${t}`);
  }
  return res.json();
}

async function callServerWithEmployee(path, file, employee) {
  const form = new FormData();
  form.append('file', file);
  if (employee) form.append('employee', employee);
  const res = await fetch(path, { method: 'POST', body: form });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`API error: ${t}`);
  }
  return res.json();
}

function renderList(container, items) {
  if (!items?.length) { container.innerHTML = '<em>No items detected.</em>'; return; }
  container.innerHTML = items.map(i => `<span class="pill">${i}</span>`).join(' ');
}

// Editors
if (addPrescriptionBtn) {
  addPrescriptionBtn.addEventListener('click', () => {
    if (state.currentPrescriptionIndex >= 0) {
      state.prescriptions[state.currentPrescriptionIndex].names.push('');
    } else {
      addPrescription(['']);
    }
    renderPrescriptionEditor();
    updateCompareAvailability();
    if (exportCsvBtn) exportCsvBtn.disabled = true;
  });
}

if (addBillItemBtn) {
  addBillItemBtn.addEventListener('click', () => {
    if (state.currentBillIndex >= 0) {
      state.bills[state.currentBillIndex].items.push({ name: '', amount: 0 });
    } else {
      addBill([{ name: '', amount: 0 }]);
    }
    renderBillEditor();
    updateCompareAvailability();
    if (exportCsvBtn) exportCsvBtn.disabled = true;
  });
}

function renderPrescriptionEditor() {
  if (!prescriptionEditor) return;
  prescriptionEditor.innerHTML = '';
  const flat = getFlattenedPrescriptionMap();
  flat.forEach(({ pIndex, nIndex, name }, idx) => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `<input type="text" value="${escapeHtml(name)}" /> <div class="row"><button class="btn" data-del style="background:#ef4444">Delete</button><button class="btn" data-save style="background:#10b981">Save</button></div>`;
    const input = row.querySelector('input');
    input.addEventListener('input', (e) => { state.prescriptions[pIndex].names[nIndex] = e.target.value; updateCompareAvailability(); });
    row.querySelector('[data-del]').addEventListener('click', () => { 
      state.prescriptions[pIndex].names.splice(nIndex,1);
      if (state.prescriptions[pIndex].names.length === 0) state.prescriptions.splice(pIndex,1);
      renderPrescriptionEditor();
      const targetElement = prescriptionResultsContent || prescriptionResults;
      renderList(targetElement, getAllPrescriptionNames());
      updateCountBadges();
    });
    row.querySelector('[data-save]')?.addEventListener('click', () => { flashSaved(row); });
    prescriptionEditor.appendChild(row);
  });
}

function renderBillEditor() {
  if (!billEditor) return;
  billEditor.innerHTML = '';
  const flat = getFlattenedBillMap();
  flat.forEach(({ bIndex, iIndex, item }) => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.style.gridTemplateColumns = '1fr 140px auto';
    row.innerHTML = `<input type="text" value="${escapeHtml(item.name||'')}" /> <input type="number" class="amount" value="${Number(item.amount||0)}" /> <div class="row"><button class="btn" data-del style="background:#ef4444">Delete</button><button class="btn" data-save style="background:#10b981">Save</button></div>`;
    const [nameInput, amtInput] = row.querySelectorAll('input');
    nameInput.addEventListener('input', (e) => { state.bills[bIndex].items[iIndex].name = e.target.value; updateCompareAvailability(); });
    amtInput.addEventListener('input', (e) => { state.bills[bIndex].items[iIndex].amount = Number(e.target.value||0); updateCompareAvailability(); });
    row.querySelector('[data-del]').addEventListener('click', () => { 
      state.bills[bIndex].items.splice(iIndex,1);
      if (state.bills[bIndex].items.length === 0) state.bills.splice(bIndex,1);
      renderBillEditor();
      const targetElement = billResultsContent || billResults;
      renderList(targetElement, getAllBillItems().map(i => `${i.name}${i.amount!=null?` - ₹${i.amount}`:''}`));
      updateCountBadges();
    });
    row.querySelector('[data-save]')?.addEventListener('click', () => { flashSaved(row); });
    billEditor.appendChild(row);
  });
}

if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', () => {
    const rows = state._rows || [];
    const inad = rows.filter(r=>r.status==='inadmissible');
    const adm = rows.filter(r=>r.status==='admissible');
    const totalAmt = rows.reduce((s,r)=>s+r.amount,0);
    const admAmt = adm.reduce((s,r)=>s+(r.admissibleAmount || r.amount),0);
    const inadAmt = inad.reduce((s,r)=>s+r.amount,0);
    
    // Get unique prescription items to avoid repetition
    const allPrescriptionNames = [...new Set(getAllPrescriptionNames())];
    
    const sections = [];
    
    // Employee info header
    const employeeName = document.getElementById('employeeName')?.value || 'Unknown';
    const employeeId = document.getElementById('employeeId')?.value || 'Unknown';
    sections.push(`Employee Name,${escapeCsv(employeeName)}`);
    sections.push(`Employee ID,${escapeCsv(employeeId)}`);
    sections.push(`Report Generated,${new Date().toLocaleString()}`);
    sections.push('');
    
    // Prescription summary
    sections.push('PRESCRIPTION MEDICINES');
    if (allPrescriptionNames.length > 0) {
      allPrescriptionNames.forEach((medicine, index) => {
        sections.push(`${index + 1},${escapeCsv(medicine)}`);
      });
    } else {
      sections.push('1,No prescriptions analyzed');
    }
    sections.push('');
    
    // Analysis results
    sections.push('CLAIM ANALYSIS RESULTS');
    sections.push('Status,Bill Item,Amount (INR),Admissible Amount (INR),Match Details');
    
    // Sort results: Admissible first, then inadmissible
    [...adm, ...inad].forEach(r => {
      const matchedWith = r.matchedWith ? escapeCsv(r.matchedWith) : 'No match';
      sections.push(`${r.status},${escapeCsv(r.bill)},${Number(r.amount).toFixed(2)},${Number(r.admissibleAmount || r.amount).toFixed(2)},"${matchedWith}"`);
    });
    
    sections.push('');
    sections.push('SUMMARY');
    sections.push(`Total Amount,${Number(totalAmt).toFixed(2)}`);
    sections.push(`Admissible Amount,${Number(admAmt).toFixed(2)}`);
    sections.push(`Inadmissible Amount,${Number(inadAmt).toFixed(2)}`);
    sections.push(`Admissible Percentage,${totalAmt > 0 ? ((admAmt/totalAmt)*100).toFixed(1) : 0}%`);
    
    const csv = sections.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `Medical_Claim_Analysis_${employeeName.replace(/\s+/g, '_')}_${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('success', 'Excel Export Complete', `Report saved with ${rows.length} items`);
  });
}

// Professional PDF export with proper formatting and text wrapping
if (exportPdfBtn) {
  exportPdfBtn.addEventListener('click', async () => {
    const rows = state._rows || [];
    if (!rows.length) return;
    
    // Try dynamic import of jsPDF from CDN; fallback to printable window
    try {
      const jsPdfUrl = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = jsPdfUrl; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
      });
      
      const { jsPDF } = window.jspdf || window.jspdf_umd || window.jspdf || {};
      if (!jsPDF) throw new Error('jsPDF unavailable');
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let y = margin;
      
      // Header
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('MEDICAL CLAIM ANALYSIS REPORT', pageWidth/2, y, { align: 'center' });
      y += 10;
      
      // Employee information
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const employeeName = document.getElementById('employeeName')?.value || 'Unknown';
      const employeeId = document.getElementById('employeeId')?.value || 'Unknown';
      const reportDate = new Date().toLocaleDateString();
      
      doc.text(`Employee: ${employeeName}`, margin, y);
      doc.text(`Employee ID: ${employeeId}`, margin, y + 5);
      doc.text(`Report Date: ${reportDate}`, margin, y + 10);
      y += 20;
      
      // Summary statistics
      const admissible = rows.filter(r=>r.status==='admissible').reduce((s,r)=>s+(r.admissibleAmount||r.amount||0),0);
      const total = rows.reduce((s,r)=>s+(r.amount||0),0);
      const inadmissible = total - admissible;
      
      doc.setFont(undefined, 'bold');
      doc.text('SUMMARY', margin, y);
      doc.setFont(undefined, 'normal');
      y += 8;
      
      doc.text(`Total Claim Amount: ₹${total.toFixed(2)}`, margin, y);
      doc.text(`Admissible Amount: ₹${admissible.toFixed(2)}`, margin, y + 5);
      doc.text(`Inadmissible Amount: ₹${inadmissible.toFixed(2)}`, margin, y + 10);
      doc.text(`Approval Rate: ${total > 0 ? ((admissible/total)*100).toFixed(1) : 0}%`, margin, y + 15);
      y += 25;
      
      // Prescription medicines
      const allPrescriptionNames = [...new Set(getAllPrescriptionNames())];
      if (allPrescriptionNames.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('PRESCRIBED MEDICINES', margin, y);
        doc.setFont(undefined, 'normal');
        y += 8;
        
        allPrescriptionNames.slice(0, 15).forEach((medicine, index) => {
          const text = `${index + 1}. ${medicine}`;
          const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
          doc.text(lines, margin, y);
          y += lines.length * 5;
        });
        
        if (allPrescriptionNames.length > 15) {
          doc.text(`... and ${allPrescriptionNames.length - 15} more medicines`, margin, y);
          y += 5;
        }
        y += 10;
      }
      
      // Check if we need a new page
      if (y > pageHeight - 60) {
        doc.addPage();
        y = margin;
      }
      
      // Analysis results table
      doc.setFont(undefined, 'bold');
      doc.text('DETAILED ANALYSIS', margin, y);
      y += 10;
      
      // Table headers
      const colWidths = [60, 25, 30, 30, 45];
      const colPositions = [margin];
      for (let i = 1; i < colWidths.length; i++) {
        colPositions.push(colPositions[i-1] + colWidths[i-1]);
      }
      
      doc.text('Item Description', colPositions[0], y);
      doc.text('Status', colPositions[1], y);
      doc.text('Amount', colPositions[2], y);
      doc.text('Approved', colPositions[3], y);
      doc.text('Match Details', colPositions[4], y);
      
      doc.setFont(undefined, 'normal');
      y += 8;
      
      // Draw line under headers
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 3;
      
      // Table rows
      rows.forEach((r, index) => {
        // Check if we need a new page
        if (y > pageHeight - 30) {
          doc.addPage();
          y = margin + 10;
        }
        
        const billText = doc.splitTextToSize(String(r.bill || ''), colWidths[0] - 2);
        const matchText = doc.splitTextToSize(String(r.matchedWith || 'No match'), colWidths[4] - 2);
        const maxLines = Math.max(billText.length, matchText.length, 1);
        
        // Item description with text wrapping
        doc.text(billText, colPositions[0], y);
        
        // Status
        doc.text(String(r.status || ''), colPositions[1], y);
        
        // Original amount
        doc.text(`₹${Number(r.amount).toFixed(2)}`, colPositions[2], y);
        
        // Admissible amount
        doc.text(`₹${Number(r.admissibleAmount || r.amount).toFixed(2)}`, colPositions[3], y);
        
        // Match details with text wrapping
        doc.text(matchText, colPositions[4], y);
        
        y += maxLines * 5 + 2;
        
        // Draw separator line every few rows for readability
        if ((index + 1) % 5 === 0 && index < rows.length - 1) {
          doc.line(margin, y - 1, pageWidth - margin, y - 1);
          y += 2;
        }
      });
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        doc.text('Generated by Medical Claim Assistant', margin, pageHeight - 10);
      }
      
      const timestamp = new Date().toISOString().slice(0, 10);
      doc.save(`Medical_Claim_Report_${employeeName.replace(/\s+/g, '_')}_${timestamp}.pdf`);
      
      showToast('success', 'PDF Export Complete', 'Professional report generated successfully');
      
    } catch (e) {
      console.error('PDF generation failed:', e);
      
      // Enhanced fallback: create a professional print-friendly window
      const w = window.open('', '_blank');
      if (!w) {
        showToast('error', 'Export Failed', 'Please allow popups to export PDF');
        return;
      }
      
      const employeeName = document.getElementById('employeeName')?.value || 'Unknown';
      const employeeId = document.getElementById('employeeId')?.value || 'Unknown';
      const reportDate = new Date().toLocaleDateString();
      const admissible = rows.filter(r=>r.status==='admissible').reduce((s,r)=>s+(r.admissibleAmount||r.amount||0),0);
      const total = rows.reduce((s,r)=>s+(r.amount||0),0);
      
      const printContent = `
        <html>
        <head>
          <title>Medical Claim Analysis Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #2563eb; margin: 0; }
            .info-section { margin: 20px 0; }
            .summary { background: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #3b82f6; color: white; }
            .admissible { color: #059669; font-weight: bold; }
            .inadmissible { color: #dc2626; font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>MEDICAL CLAIM ANALYSIS REPORT</h1>
          </div>
          
          <div class="info-section">
            <p><strong>Employee:</strong> ${escapeHtml(employeeName)}</p>
            <p><strong>Employee ID:</strong> ${escapeHtml(employeeId)}</p>
            <p><strong>Report Date:</strong> ${reportDate}</p>
          </div>
          
          <div class="summary">
            <h3>Summary</h3>
            <p><strong>Total Claim:</strong> ₹${total.toFixed(2)}</p>
            <p><strong>Admissible:</strong> ₹${admissible.toFixed(2)}</p>
            <p><strong>Inadmissible:</strong> ₹${(total - admissible).toFixed(2)}</p>
            <p><strong>Approval Rate:</strong> ${total > 0 ? ((admissible/total)*100).toFixed(1) : 0}%</p>
          </div>
          
          <table class="export-table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Approved Amount</th>
                <th>Match Details</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${escapeHtml(r.bill)}</td>
                  <td class="${r.status}">${r.status}</td>
                  <td>₹${Number(r.amount).toFixed(2)}</td>
                  <td>₹${Number(r.admissibleAmount || r.amount).toFixed(2)}</td>
                  <td>${escapeHtml(r.matchedWith || 'No match')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;
      
      w.document.write(printContent);
      w.document.close();
      w.focus();
      w.print();
    }
  });
}

function escapeCsv(s) { return '"' + String(s).replace(/"/g,'""') + '"'; }
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function flashSaved(row) {
  row.style.outline = '2px solid #10b981';
  setTimeout(()=>{ row.style.outline = 'none'; }, 600);
}

function renderCompareTable(rows, totals) {
  const header = `<div class="row" style="gap:16px; flex-wrap:wrap">
    <div class="stat"><div class="stat-label">Total Amount</div><div class="stat-value">₹${totals.total.toFixed(2)}</div></div>
    <div class="stat positive"><div class="stat-label">Admissible</div><div class="stat-value">₹${totals.admissible.toFixed(2)}</div></div>
    <div class="stat negative"><div class="stat-label">Inadmissible</div><div class="stat-value">₹${totals.inadmissible.toFixed(2)}</div></div>
  </div>`;
  
  const allPrescriptionNames = getAllPrescriptionNames();
  const prescriptionContent = allPrescriptionNames.length > 0 ? 
    allPrescriptionNames.map(name => `<span class="pill">${escapeHtml(name)}</span>`).join(' ') : 
    '<em>No prescriptions analyzed</em>';
    
  const table = `<div class="table">
    <div class="tr th" style="grid-template-columns: 1fr 1fr 100px 140px 1fr;">
      <div>Bill Item</div>
      <div>Prescription Content</div>
      <div>Status</div>
      <div class="right">Amount (₹)</div>
      <div>Match Details</div>
    </div>
    ${rows.map(r=>`<div class=\"tr\" style="grid-template-columns: 1fr 1fr 100px 140px 1fr;">
      <div style="font-weight:600;">${escapeHtml(r.bill)}</div>
      <div style="font-size:12px;">${prescriptionContent}</div>
      <div><span class=\"badge ${r.status}\">${r.status}</span></div>
      <div class=\"right\">${Number(r.admissibleAmount || r.amount || 0).toFixed(2)}${r.admissibleAmount && r.admissibleAmount !== r.amount ? `<br><small style="color:#666;">(orig: ₹${Number(r.amount||0).toFixed(2)})</small>` : ''}</div>
      <div style="font-size:11px; color:#666;">${escapeHtml(r.reason || '')}</div>
    </div>`).join('')}
  </div>`;
  return header + table;
}

function renderMapping(rows) {
  if (!rows?.length) return '';
  const items = rows.map(r => {
    const left = escapeHtml(r.matchedWith || '—');
    const mid = r.matchedBy ? `<span class="badge admissible">${escapeHtml(r.matchedBy)}</span>` : '<span class="badge inadmissible">no match</span>';
    const right = escapeHtml(r.bill || '');
    return `<div class="tr"><div>${left}</div><div style="text-align:center">${mid}</div><div>${right}</div></div>`;
  }).join('');
  return `<div class="table">
    <div class="tr th"><div>Prescription Term</div><div>Mapping</div><div>Bill Item</div></div>
    ${items}
  </div>`;
}

function levenshteinWithinOne(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la > lb) { i++; }
    else if (lb > la) { j++; }
    else { i++; j++; }
  }
  if (i < la || j < lb) edits++;
  return edits <= 1;
}

// Admissible iff strong match with small tolerance:
// - First words match (<=1 edit) OR
// - Prescription is a single token prefix of bill first token OR
// - Whole strings are within 1 edit (after stripping spaces/punct)
const STOPWORDS = new Set(['tab','tablet','cap','capsule','cream','ointment','inj','injection','syrup','suspension','susp','drop','drops','gel','lotion','solution','sol','mg','mcg','gm','g','ml','%','xr','sr','er','od','bd','tds','qd','qds','once','twice','thrice','tab.','cap.','inj.','cream.']);

function filterTokens(tokens) {
  return tokens.filter(t => {
    if (!t) return false;
    if (STOPWORDS.has(t)) return false;
    if (/^[0-9]+([a-z%]+)?$/.test(t)) return false; // pure numbers or numbers with units
    if (t.length < 3) return false; // avoid tiny common fragments
    return true;
  });
}

function firstMeaningful(tokens) {
  const filtered = filterTokens(tokens);
  return filtered.length ? filtered[0] : (tokens[0] || '');
}

// Function to detect consultation items - stricter logic to avoid false positives
function isConsultationItem(billLower) {
  if (!billLower || typeof billLower !== 'string') return false;

  const text = billLower.trim();
  // Strong phrase matches
  const strongPhrases = [
    'consultation fee', 'doctor fee', 'physician fee', 'specialist fee',
    'opd fee', 'outpatient fee', 'emergency fee', 'visit fee'
  ];
  if (strongPhrases.some(p => text.includes(p))) return true;

  // Token based checks
  const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
  const meaningful = tokens.filter(w => w.length >= 4 && !STOPWORDS.has(w));
  const hasConsultRoot = meaningful.some(w => w.startsWith('consult'));
  if (hasConsultRoot) return true;

  const actorTokens = new Set(['doctor','physician','specialist','opd','outpatient','emergency','visit','checkup']);
  const hasActor = meaningful.some(w => actorTokens.has(w));
  const hasFee = tokens.includes('fee');
  // Consider consultation only if an actor token appears with the word fee somewhere
  if (hasActor && hasFee) return true;

  return false;
}

// Enhanced matching algorithm with higher accuracy
function fuzzyAdmissible(billLower, prescLower) {
  if (!billLower || !prescLower) return false;

  const billTokens = billLower.split(/[^a-z0-9]+/).filter(Boolean);
  const prescTokens = prescLower.split(/[^a-z0-9]+/).filter(Boolean);
  if (!billTokens.length || !prescTokens.length) return false;

  // 1. Exact match
  if (billLower === prescLower) return true;

  // 2. First meaningful token match (enhanced)
  const b0 = firstMeaningful(billTokens);
  const p0 = firstMeaningful(prescTokens);
  if (b0 === p0 || levenshteinWithinOne(b0, p0)) return true;

  // 3. Prefix/suffix matching (more flexible)
  if (prescTokens.length === 1 && (b0.startsWith(p0) || p0.startsWith(b0))) return true;
  if (billTokens.length === 1 && (p0.startsWith(b0) || b0.startsWith(p0))) return true;

  // 4. Normalized string matching (enhanced)
  const normBill = filterTokens(billTokens).join('');
  const normPresc = filterTokens(prescTokens).join('');
  if (levenshteinWithinOne(normBill, normPresc)) return true;

  // 5. Partial word matching (new)
  const billWords = billLower.split(/\s+/);
  const prescWords = prescLower.split(/\s+/);
  
  // Check if any significant words from prescription appear in bill
  const significantPrescWords = prescWords.filter(word => 
    word.length >= 3 && !STOPWORDS.has(word.toLowerCase())
  );
  
  for (const prescWord of significantPrescWords) {
    for (const billWord of billWords) {
      if (billWord.length >= 3 && !STOPWORDS.has(billWord.toLowerCase())) {
        // Check for partial matches or close matches
        if (billWord.includes(prescWord) || 
            prescWord.includes(billWord) || 
            levenshteinWithinOne(billWord, prescWord)) {
          return true;
        }
      }
    }
  }

  // 6. Soundex-like matching for common medicine name variations
  if (soundexMatch(billLower, prescLower)) return true;

  return false;
}

// Simple soundex-like matching for medicine names
function soundexMatch(str1, str2) {
  const normalize = (str) => str.toLowerCase()
    .replace(/[aeiou]/g, '')
    .replace(/[^a-z]/g, '')
    .substring(0, 4);
  
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  return s1.length >= 3 && s2.length >= 3 && 
         (s1 === s2 || levenshteinWithinOne(s1, s2));
}

// Explain which method matched for personalization
function matchMethod(billLower, prescLower) {
  if (!billLower || !prescLower) return null;
  if (billLower === prescLower) return 'exact match';
  const billTokens = billLower.split(/[^a-z0-9]+/).filter(Boolean);
  const prescTokens = prescLower.split(/[^a-z0-9]+/).filter(Boolean);
  const b0 = firstMeaningful(billTokens);
  const p0 = firstMeaningful(prescTokens);
  if (b0 === p0) return 'first word match';
  if (levenshteinWithinOne(b0, p0)) return 'near first-word match';
  if (prescTokens.length === 1 && (b0.startsWith(p0) || p0.startsWith(b0))) return 'prefix match';
  if (billTokens.length === 1 && (p0.startsWith(b0) || b0.startsWith(p0))) return 'prefix match';
  const normBill = filterTokens(billTokens).join('');
  const normPresc = filterTokens(prescTokens).join('');
  if (levenshteinWithinOne(normBill, normPresc)) return 'normalized near match';
  const billWords = billLower.split(/\s+/);
  const prescWords = prescLower.split(/\s+/);
  const significantPrescWords = prescWords.filter(word => word.length >= 3 && !STOPWORDS.has(word.toLowerCase()));
  for (const prescWord of significantPrescWords) {
    for (const billWord of billWords) {
      if (billWord.length >= 3 && !STOPWORDS.has(billWord.toLowerCase())) {
        if (billWord.includes(prescWord) || prescWord.includes(billWord) || levenshteinWithinOne(billWord, prescWord)) {
          return 'partial word match';
        }
      }
    }
  }
  if (soundexMatch(billLower, prescLower)) return 'phonetic match';
  return null;
}

// Bulk upload handler to auto categorize and process
if (bulkInput) {
  bulkInput.addEventListener('change', async () => {
    const files = Array.from(bulkInput.files || []);
    if (!files.length) return;
    
    if (!validateEmployeeInfo()) {
      bulkInput.value = ''; // Clear the file input
      return;
    }
    
    const employee = (employeeNameInput?.value || '').trim();
    const employeeId = (employeeIdInput?.value || '').trim();
    const employeeData = `${employee} (ID: ${employeeId})`;
    // Render thumbnails with pending status
    if (bulkThumbs) {
      bulkThumbs.innerHTML = '';
      files.forEach((f, idx) => {
        const row = document.createElement('div');
        row.className = 'list-row';
        const url = URL.createObjectURL(f);
        row.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><img src="${url}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb"/><span>${escapeHtml(f.name)}</span></div><span data-status style="font-size:12px;color:#64748b;">Pending…</span>`;
        bulkThumbs.appendChild(row);
      });
    }
    try {
      const form = new FormData();
      files.forEach(f => form.append('files', f));
      form.append('employee', employeeData);
      const res = await fetch('/api/ocr/auto', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const agg = data.aggregated || {};
      // Update per-file status if available
      if (bulkThumbs && Array.isArray(data.files)) {
        const rows = Array.from(bulkThumbs.children);
        data.files.forEach((fileResult, i) => {
          const row = rows[i];
          if (!row) return;
          const statusEl = row.querySelector('[data-status]');
          const typ = fileResult.type || 'unknown';
          if (fileResult.error) {
            statusEl.textContent = `Error: ${fileResult.error}`;
            statusEl.style.color = '#b91c1c';
          } else {
            statusEl.textContent = typ === 'prescription' ? 'Prescription ✓' : (typ === 'bill' ? 'Bill ✓' : 'Unknown');
            statusEl.style.color = typ === 'unknown' ? '#92400e' : '#166534';
          }
        });
      }
      // Merge prescriptions
      (agg.prescriptions || []).forEach(p => addPrescription(p.names || []));
      (agg.bills || []).forEach(b => addBill(b.items || []));
      // Render
      const prescriptionTarget = prescriptionResultsContent || prescriptionResults;
      const billTarget = billResultsContent || billResults;
      
      renderList(prescriptionTarget, getAllPrescriptionNames());
      renderPrescriptionEditor();
      renderList(billTarget, getAllBillItems().map(i => `${i.name}${i.amount!=null?` - ₹${i.amount}`:''}`));
      renderBillEditor();
      
      // Show result sections if they have content
      if (getAllPrescriptionNames().length > 0) {
        prescriptionResults.style.display = 'block';
      }
      if (getAllBillItems().length > 0) {
        billResults.style.display = 'block';
      }
      updateCountBadges();
      updateCompareAvailability();
      showToast('success', 'Bulk Analysis Complete', `📁 ${files.length} files processed • 💊 ${getAllPrescriptionNames().length} prescriptions • 🧾 ${getAllBillItems().length} bill items`);
    } catch (e) {
      console.error(e);
      showPopup('error', 'Bulk Analysis Failed', String(e.message || e));
    }
  });
}

// Drag & drop support for bulk upload
if (dropZone && bulkInput) {
  const dz = dropZone;
  const prevent = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => dz.addEventListener(ev, prevent));
  dz.addEventListener('dragover', ()=>{ 
    dz.style.background = '#dbeafe'; 
    dz.style.borderColor = '#2563eb';
    dz.style.transform = 'scale(1.02)';
  });
  dz.addEventListener('dragleave', ()=>{ 
    dz.style.background = ''; 
    dz.style.borderColor = '';
    dz.style.transform = '';
  });
  dz.addEventListener('drop', (e)=>{
    dz.style.background = '';
    dz.style.borderColor = '';
    dz.style.transform = '';
    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    bulkInput.files = dt.files;
    const changeEvent = new Event('change');
    bulkInput.dispatchEvent(changeEvent);
  });
  dz.addEventListener('click', ()=> bulkInput.click());
}

function renderGlobalSummary() {
  if (!globalSummary) return;
  const totalPres = getAllPrescriptionNames().length;
  const totalBillItems = getAllBillItems().length;
  const sum = getAllBillItems().reduce((s, it)=> s + Number(it.amount||0), 0);
  
  if (totalPres > 0 || totalBillItems > 0) {
    globalSummary.style.display = 'block';
    globalSummary.innerHTML = `
      <div class="results-header">
        <h3 class="results-title">Processing Summary</h3>
        <span class="results-count">${totalPres + totalBillItems} items</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--spacing-md);">
        <div class="stat">
          <div class="stat-label">Prescriptions</div>
          <div class="stat-value">${totalPres}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Bill Items</div>
          <div class="stat-value">${totalBillItems}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Total Amount</div>
          <div class="stat-value">₹${sum.toFixed(2)}</div>
        </div>
      </div>
    `;
  } else {
    globalSummary.style.display = 'none';
  }
}

// Enhanced Bulk Upload with Progress Tracking
function createThumbnailElement(file, index) {
  const thumbnail = document.createElement('div');
  thumbnail.className = 'thumbnail-item';
  thumbnail.setAttribute('role', 'listitem');
  
  const isImage = file.type.startsWith('image/');
  const icon = isImage ? '🖼️' : '📄';
  
  thumbnail.innerHTML = `
    <div style="font-size: 2rem; margin-bottom: var(--spacing-sm);">${icon}</div>
    <div style="font-weight: 600; margin-bottom: var(--spacing-xs); font-size: 0.8rem;">${escapeHtml(file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name)}</div>
    <div style="color: var(--text-secondary); font-size: 0.75rem;">${formatFileSize(file.size)}</div>
    <div class="pill" id="status-${index}">Pending</div>
  `;
  
  return thumbnail;
}

function handleBulkUploadResults(data, files) {
  // Update file statuses
  if (Array.isArray(data.files)) {
    data.files.forEach((fileResult, i) => {
      const statusElement = document.getElementById(`status-${i}`);
      if (!statusElement) return;
      
      if (fileResult.error) {
        statusElement.textContent = 'Error';
        statusElement.className = 'pill pill-error';
      } else {
        const type = fileResult.type || 'unknown';
        statusElement.textContent = type === 'prescription' ? 'Prescription ✓' : 
                                  type === 'bill' ? 'Bill ✓' : 'Unknown';
        statusElement.className = type === 'unknown' ? 'pill pill-warning' : 'pill pill-success';
      }
    });
  }
  
  // Merge results
  (data.aggregated?.prescriptions || []).forEach(p => addPrescription(p.names || []));
  (data.aggregated?.bills || []).forEach(b => addBill(b.items || []));
  
  // Render results
  updateAllDisplays();
  
  // Show analysis section if files are processed
  showAnalysisSection();
  
  showToast('success', 'Upload Complete', 
    `${files.length} files uploaded • ${getAllPrescriptionNames().length} prescriptions • ${getAllBillItems().length} bill items`);
}

function updateAllDisplays() {
  const prescriptionTarget = prescriptionResultsContent || prescriptionResults;
  const billTarget = billResultsContent || billResults;
  
  renderList(prescriptionTarget, getAllPrescriptionNames());
  renderPrescriptionEditor();
  renderList(billTarget, getAllBillItems().map(i => `${i.name}${i.amount!=null?` - ₹${i.amount}`:''}`));
  renderBillEditor();
  
  // Show result sections if they have content
  if (getAllPrescriptionNames().length > 0) {
    prescriptionResults.style.display = 'block';
  }
  if (getAllBillItems().length > 0) {
    billResults.style.display = 'block';
  }
  
  updateCountBadges();
  updateCompareAvailability();
}

// Theme Toggle Event Listener
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => themeManager.toggle());
}

// Enhanced Accessibility - Keyboard Navigation for Drop Zone
if (dropZone) {
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      bulkInput?.click();
    }
  });
}

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful');
        analytics.trackEvent('pwa_registered');
      })
      .catch(err => console.log('ServiceWorker registration failed'));
  });
}

// Performance Monitoring
window.addEventListener('load', () => {
  const loadTime = performance.now() - performance_start;
  analytics.trackEvent('page_loaded', { loadTime });
  console.log(`Page loaded in ${loadTime.toFixed(2)}ms`);
});

// Analysis Section Management
function showAnalysisSection() {
  const analysisSection = document.getElementById('analysisSection');
  const startBtn = document.getElementById('startAnalysisBtn');
  
  if (analysisSection && startBtn) {
    analysisSection.style.display = 'block';
    
    // Enable button if we have files uploaded
    const hasFiles = bulkInput?.files?.length > 0;
    
    startBtn.disabled = !hasFiles;
    
    // Add event listener if not already added
    if (!startBtn.hasAttribute('data-listener')) {
      startBtn.addEventListener('click', startAnalysis);
      startBtn.setAttribute('data-listener', 'true');
    }
  }
}

// Process bulk uploaded files
async function processBulkFiles() {
  if (!bulkInput || !bulkInput.files || bulkInput.files.length === 0) return;
  
  const files = Array.from(bulkInput.files);
  const employeeName = document.getElementById('employeeName')?.value?.trim();
  const employeeId = document.getElementById('employeeId')?.value?.trim();
  const employee = `${employeeName} (ID: ${employeeId})`;
  
  // Hide analysis section and show progress
  const analysisSection = document.getElementById('analysisSection');
  if (analysisSection) analysisSection.style.display = 'none';
  
  progressManager.show();
  progressManager.update(0, 'Starting analysis...');
  
  try {
    // Process files using the existing bulk API
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('employee', employee);
    
    const response = await fetch('/api/ocr/auto', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    progressManager.update(100, 'Analysis complete!');
    
    // Process and display results
    handleBulkAnalysisResults(data, files);
    
    setTimeout(() => {
      progressManager.hide();
      showAnalysisResults();
    }, 1000);
    
  } catch (error) {
    console.error('Analysis failed:', error);
    progressManager.hide();
    showPopup('error', 'Analysis Failed', `Failed to analyze files: ${error.message}`);
  }
}

function handleBulkAnalysisResults(data, files) {
  // Clear existing data
  state.prescriptions = [];
  state.bills = [];
  
  // Process aggregated results
  if (data.aggregated?.prescriptions) {
    data.aggregated.prescriptions.forEach(p => {
      if (p.names && p.names.length > 0) {
        addPrescription(p.names);
      }
    });
  }
  
  if (data.aggregated?.bills) {
    data.aggregated.bills.forEach(b => {
      if (b.items && b.items.length > 0) {
        addBill(b.items);
      }
    });
  }
  
  // Update displays
  updateAllDisplays();
  
  // Update file statuses in thumbnails
  if (Array.isArray(data.files)) {
    data.files.forEach((fileResult, i) => {
      const statusElement = document.getElementById(`status-${i}`);
      if (statusElement) {
        if (fileResult.error) {
          statusElement.textContent = 'Error';
          statusElement.className = 'pill pill-error';
        } else {
          const type = fileResult.type || 'unknown';
          statusElement.textContent = type === 'prescription' ? 'Prescription' : 
                                    type === 'bill' ? 'Bill' : 'Unknown';
          statusElement.className = type === 'unknown' ? 'pill pill-warning' : 'pill pill-success';
        }
      }
    });
  }
}

function showAnalysisResults() {
  const analysisResults = document.getElementById('analysisResults');
  const prescriptionResults = document.getElementById('prescriptionResults');
  const billResults = document.getElementById('billResults');
  
  if (analysisResults) {
    analysisResults.style.display = 'block';
    
    // Show prescription results if we have any
    if (getAllPrescriptionNames().length > 0 && prescriptionResults) {
      prescriptionResults.style.display = 'block';
      renderPrescriptionContent();
    }
    
    // Show bill results if we have any
    if (getAllBillItems().length > 0 && billResults) {
      billResults.style.display = 'block';
      const billTarget = document.getElementById('billResultsContent');
      if (billTarget) {
        renderList(billTarget, getAllBillItems().map(i => `${i.name}${i.amount!=null?` - ₹${i.amount}`:''}`));
      }
    }
    
    // Auto-compare if we have both prescriptions and bills
    if (getAllPrescriptionNames().length > 0 && getAllBillItems().length > 0) {
      setTimeout(() => {
        autoCompare();
      }, 500);
    }
    
    // Show success message
    const totalPrescriptions = getAllPrescriptionNames().length;
    const totalBills = getAllBillItems().length;
    showToast('success', 'Analysis Complete', 
      `Found ${totalPrescriptions} medicines and ${totalBills} bill items`);
  }
}

function startAnalysis() {
  const employeeName = document.getElementById('employeeName')?.value?.trim();
  const employeeId = document.getElementById('employeeId')?.value?.trim();
  
  if (!employeeName || !employeeId) {
    showPopup('error', 'Missing Information', 'Please enter both employee name and ID before starting analysis.');
    return;
  }
  
  // Process all uploaded files using bulk upload
  if (bulkInput && bulkInput.files && bulkInput.files.length > 0) {
    processBulkFiles();
  } else {
    showPopup('warning', 'No Files', 'Please upload some files first before starting analysis.');
  }
}

// Enhanced prescription content display to avoid duplicates
function renderPrescriptionContent() {
  const prescriptionContent = document.getElementById('prescriptionResultsContent');
  if (!prescriptionContent) return;
  
  const allMedicines = getAllPrescriptionNames();
  const uniqueMedicines = [...new Set(allMedicines)]; // Remove duplicates
  
  if (uniqueMedicines.length === 0) {
    prescriptionContent.innerHTML = '<em>No medicines extracted yet.</em>';
    return;
  }
  
  prescriptionContent.innerHTML = uniqueMedicines.map((medicine, index) => 
    `<div class="medicine-item">${index + 1}. ${escapeHtml(medicine)}</div>`
  ).join('');
}

// Update the existing renderList function to handle prescription content better
function renderList(container, items) {
  if (!container) return;
  
  // Special handling for prescription content
  if (container.classList && container.classList.contains('prescription-content')) {
    renderPrescriptionContent();
    return;
  }
  
  // Regular list rendering with deduplication
  if (!items || !Array.isArray(items)) { 
    container.innerHTML = '<em>No items detected.</em>'; 
    return; 
  }
  
  // Remove duplicates for cleaner display
  const uniqueItems = [...new Set(items)];
  
  if (uniqueItems.length === 0) {
    container.innerHTML = '<em>No items detected.</em>';
    return;
  }
  
  container.innerHTML = uniqueItems.map((item, index) => 
    `<span class="pill">${index + 1}. ${escapeHtml(item)}</span>`
  ).join(' ');
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  analytics.trackEvent('app_initialized');
  renderGlobalSummary();
  
  // Set up bulk input handler to show analysis section
  const bulkInput = document.getElementById('bulkInput');
  if (bulkInput) {
    bulkInput.addEventListener('change', () => {
      if (bulkInput.files && bulkInput.files.length > 0) {
        showAnalysisSection();
        // Update thumbnails
        updateBulkThumbnails();
      }
    });
  }
  
  // Add More Files button
  const addMoreFilesBtn = document.getElementById('addMoreFilesBtn');
  if (addMoreFilesBtn) {
    addMoreFilesBtn.addEventListener('click', () => {
      bulkInput?.click();
    });
  }
  
  // Re-analyze All button
  const reAnalyzeAllBtn = document.getElementById('reAnalyzeAllBtn');
  if (reAnalyzeAllBtn) {
    reAnalyzeAllBtn.addEventListener('click', () => {
      if (bulkInput?.files?.length > 0) {
        showPopup('info', 'Re-analyzing All Files', 
          'This will re-process all uploaded files. Continue?', 
          () => {
            processBulkFiles();
          });
      } else {
        showToast('warning', 'No Files', 'Please upload files first');
      }
    });
  }
});

// Update bulk thumbnails display
function updateBulkThumbnails() {
  if (!bulkInput || !bulkThumbs) return;
  
  bulkThumbs.innerHTML = '';
  
  if (bulkInput.files && bulkInput.files.length > 0) {
    Array.from(bulkInput.files).forEach((file, index) => {
      const thumbnail = createThumbnailElement(file, index);
      bulkThumbs.appendChild(thumbnail);
    });
  }
}

