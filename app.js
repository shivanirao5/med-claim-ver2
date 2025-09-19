// Using server-side API key; API key UI removed

const prescriptionInput = document.getElementById('prescriptionInput');
const analyzePrescriptionBtn = document.getElementById('analyzePrescription');
const prescriptionResults = document.getElementById('prescriptionResults');

const billInput = document.getElementById('billInput');
const analyzeBillBtn = document.getElementById('analyzeBill');
const billResults = document.getElementById('billResults');

const compareBtn = document.getElementById('compareBtn');
const compareResults = document.getElementById('compareResults');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const prescriptionEditor = document.getElementById('prescriptionEditor');
const addPrescriptionBtn = document.getElementById('addPrescription');
const billEditor = document.getElementById('billEditor');
const addBillItemBtn = document.getElementById('addBillItem');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');

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
}

// Custom Popup System
function showPopup(type, title, message, onConfirm = null, onCancel = null) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
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

prescriptionInput.addEventListener('change', () => {
  const hasFile = prescriptionInput.files?.length;
  analyzePrescriptionBtn.disabled = !hasFile;
  
  if (hasFile) {
    showFileInfo(prescriptionInput.files[0], prescriptionFileInfo, prescriptionFileName, prescriptionFileSize);
  } else {
    hideFileInfo(prescriptionFileInfo);
  }
  updateCompareAvailability();
});

billInput.addEventListener('change', () => {
  const hasFile = billInput.files?.length;
  analyzeBillBtn.disabled = !hasFile;
  
  if (hasFile) {
    showFileInfo(billInput.files[0], billFileInfo, billFileName, billFileSize);
  } else {
    hideFileInfo(billFileInfo);
  }
  updateCompareAvailability();
});

// Remove file buttons
removePrescriptionFile.addEventListener('click', () => {
  prescriptionInput.value = '';
  analyzePrescriptionBtn.disabled = true;
  hideFileInfo(prescriptionFileInfo);
  prescriptionResults.innerHTML = '';
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
  hideFileInfo(billFileInfo);
  billResults.innerHTML = '';
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
    prescriptionInput.value = '';
    billInput.value = '';
    
    // Reset state
    state.prescriptions = [];
    state.bills = [];
    state.currentPrescriptionIndex = -1;
    state.currentBillIndex = -1;
    
    // Reset UI elements
    prescriptionResults.innerHTML = '';
    billResults.innerHTML = '';
    compareResults.innerHTML = '';
    prescriptionEditor.innerHTML = '';
    billEditor.innerHTML = '';
    
    // Hide file info and progress
    hideFileInfo(prescriptionFileInfo);
    hideFileInfo(billFileInfo);
    // no progress elements
    
    // Reset button states
    analyzePrescriptionBtn.disabled = true;
    analyzeBillBtn.disabled = true;
    compareBtn.disabled = true;
    if (exportCsvBtn) exportCsvBtn.disabled = true;
    
    // Update count badges and accumulated data
    updateCountBadges();
    renderAccumulatedData();
    
    showPopup('success', 'Analysis Reset', 'All data has been cleared. You can now start a new analysis.');
  }, () => {
    // Cancel pressed: nothing to do
  });
});

analyzePrescriptionBtn.addEventListener('click', async () => {
  if (!prescriptionInput.files?.length) { 
    showPopup('error', 'No File Selected', 'Please choose a prescription image first.');
    return; 
  }
  
  const file = prescriptionInput.files[0];
  const sig = fileSignature(file);
  if (sig && sig === lastPrescriptionSig) {
    showPopup('warning', 'Same Image Detected', 'You have already analyzed this same prescription image. Proceed to analyze again?', async () => {
      await analyzePrescriptionFile(file);
    }, () => {});
    return;
  }
  await analyzePrescriptionFile(file);
});

async function analyzePrescriptionFile(file) {
  analyzePrescriptionBtn.disabled = true;
  
  prescriptionResults.innerHTML = '<em>Analyzing prescription...</em>';
  
  try {
    const { prescriptionNames } = await callServer('/api/ocr/prescription', file);
    const names = prescriptionNames || [];
    addPrescription(names);
    // Render combined prescription list
    renderList(prescriptionResults, getAllPrescriptionNames());
    renderPrescriptionEditor();
    updateCountBadges();
    updateCompareAvailability();
    lastPrescriptionSig = fileSignature(file);
    
    const allPrescriptions = getAllPrescriptionNames();
    if (names.length > 0) {
      showPopup('success', 'Analysis Complete', `Successfully detected ${names.length} medicine(s) from the prescription. Total prescriptions: ${state.prescriptions.length}`);
    } else {
      showPopup('warning', 'No Medicines Found', 'No medicines were detected in the prescription. You can manually add them using the "Add Medicine" button.');
    }
  } catch (e) {
    console.error(e);
    prescriptionResults.innerHTML = `<span style="color:red">${e.message}</span>`;
    showPopup('error', 'Analysis Failed', `Failed to analyze prescription: ${e.message}`);
  } finally {
    analyzePrescriptionBtn.disabled = false;
    updateCompareAvailability();
    if (exportCsvBtn) exportCsvBtn.disabled = true;
  }
}

analyzeBillBtn.addEventListener('click', async () => {
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

async function analyzeBillFile(file) {
  analyzeBillBtn.disabled = true;
  
  billResults.innerHTML = '<em>Analyzing bill...</em>';
  
  try {
    const { billItems } = await callServer('/api/ocr/bill', file);
    const items = billItems || [];
    addBill(items);
    // Render combined bills list
    renderList(billResults, getAllBillItems().map(i => `${i.name}${i.amount!=null?` - ₹${i.amount}`:''}`));
    renderBillEditor();
    updateCountBadges();
    updateCompareAvailability();
    lastBillSig = fileSignature(file);
    
    const allBills = getAllBillItems();
    if (items.length > 0) {
      const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
      showPopup('success', 'Analysis Complete', `Successfully detected ${items.length} item(s) from the bill with total amount ₹${totalAmount.toFixed(2)}. Total bills: ${state.bills.length}`);
    } else {
      showPopup('warning', 'No Items Found', 'No items were detected in the bill. You can manually add them using the "Add Bill Item" button.');
    }
  } catch (e) {
    console.error(e);
    billResults.innerHTML = `<span style="color:red">${e.message}</span>`;
    showPopup('error', 'Analysis Failed', `Failed to analyze bill: ${e.message}`);
  } finally {
    analyzeBillBtn.disabled = false;
    updateCompareAvailability();
    if (exportCsvBtn) exportCsvBtn.disabled = true;
  }
}

compareBtn.addEventListener('click', () => {
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
    const match = prescribed.some(p => fuzzyAdmissible(billLower, p));
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
          ? 'Matches prescription'
          : 'No prescription match';

    return {
      bill: item.name,
      status: status,
      amount: amount,
      admissibleAmount: admissibleAmount,
      isConsultation: isConsultation,
      reason: reason
    };
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const admissible = rows.filter(r => r.status==='admissible').reduce((s, r) => s + (r.admissibleAmount || r.amount), 0);
  const inadmissible = total - admissible;
  compareResults.innerHTML = renderCompareTable(rows, { total, admissible, inadmissible });
  if (exportCsvBtn) exportCsvBtn.disabled = false;
  state._rows = rows;
  
  // Show comparison results popup
  const admissibleCount = rows.filter(r => r.status === 'admissible').length;
  const inadmissibleCount = rows.filter(r => r.status === 'inadmissible').length;
  
  if (admissibleCount > 0) {
    showPopup('success', 'Comparison Complete', 
      `Analysis completed! ${admissibleCount} item(s) are admissible (₹${admissible.toFixed(2)}) and ${inadmissibleCount} item(s) are inadmissible (₹${inadmissible.toFixed(2)}).`);
  } else {
    showPopup('warning', 'No Admissible Items', 
      `No items match the prescription. All ${inadmissibleCount} item(s) are inadmissible (₹${inadmissible.toFixed(2)}).`);
  }
});

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
      renderList(prescriptionResults, getAllPrescriptionNames());
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
      renderList(billResults, getAllBillItems().map(i => `${i.name}${i.amount!=null?` - ₹${i.amount}`:''}`));
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
    const sections = [];
    sections.push('Category,Bill Item,Admissible Amount,Original Amount,Reason');
    // Inadmissible first for readability
    sections.push(...inad.map(r=>`${'Inadmissible'},${escapeCsv(r.bill)},,${Number(r.amount).toFixed(2)},${escapeCsv(r.reason||'')}`));
    // Admissible
    sections.push(...adm.map(r=>`${'Admissible'},${escapeCsv(r.bill)},${Number(r.admissibleAmount || r.amount).toFixed(2)},${Number(r.amount).toFixed(2)},${escapeCsv(r.reason||'')}`));
    sections.push('');
    sections.push('Totals,,,');
    sections.push(`,Total,${Number(admAmt+inadAmt).toFixed(2)},`);
    sections.push(`,Admissible,${Number(admAmt).toFixed(2)},`);
    sections.push(`,Inadmissible,${Number(inadAmt).toFixed(2)},`);
    const csv = sections.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
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
    <div class="stat"><div class="stat-label">Total</div><div class="stat-value">₹${totals.total.toFixed(2)}</div></div>
    <div class="stat positive"><div class="stat-label">Admissible</div><div class="stat-value">₹${totals.admissible.toFixed(2)}</div></div>
    <div class="stat negative"><div class="stat-label">Inadmissible</div><div class="stat-value">₹${totals.inadmissible.toFixed(2)}</div></div>
  </div>`;
  const table = `<div class="table">
    <div class="tr th"><div>Bill Item</div><div>Status</div><div class="right">Amount (₹)</div><div>Reason</div></div>
    ${rows.map(r=>`<div class=\"tr\">
      <div>${escapeHtml(r.bill)}</div>
      <div><span class=\"badge ${r.status}\">${r.status}</span></div>
      <div class=\"right\">${Number(r.admissibleAmount || r.amount || 0).toFixed(2)}${r.admissibleAmount && r.admissibleAmount !== r.amount ? `<br><small style="color:#666;">(orig: ₹${Number(r.amount||0).toFixed(2)})</small>` : ''}</div>
      <div style="font-size:12px; color:#666;">${escapeHtml(r.reason || '')}</div>
    </div>`).join('')}
  </div>`;
  return header + table;
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

