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

let state = {
  prescriptionNames: [],
  billItems: [],
};

// No API key save button

prescriptionInput.addEventListener('change', () => {
  analyzePrescriptionBtn.disabled = !prescriptionInput.files?.length;
});

billInput.addEventListener('change', () => {
  analyzeBillBtn.disabled = !billInput.files?.length;
});

analyzePrescriptionBtn.addEventListener('click', async () => {
  if (!prescriptionInput.files?.length) { alert('Please choose a prescription image.'); return; }
  const file = prescriptionInput.files[0];
  analyzePrescriptionBtn.disabled = true;
  prescriptionResults.innerHTML = '<em>Analyzing prescription...</em>';
  try {
    const { prescriptionNames } = await callServer('/api/ocr/prescription', file);
    state.prescriptionNames = prescriptionNames || [];
    renderList(prescriptionResults, state.prescriptionNames);
    renderPrescriptionEditor();
  } catch (e) {
    console.error(e);
    prescriptionResults.innerHTML = `<span style="color:red">${e.message}</span>`;
    alert(`Analyze failed: ${e.message}`);
  } finally {
    analyzePrescriptionBtn.disabled = false;
    compareBtn.disabled = !(state.prescriptionNames.length && state.billItems.length);
    if (exportCsvBtn) exportCsvBtn.disabled = true;
  }
});

analyzeBillBtn.addEventListener('click', async () => {
  if (!billInput.files?.length) { alert('Please choose a bill image.'); return; }
  const file = billInput.files[0];
  analyzeBillBtn.disabled = true;
  billResults.innerHTML = '<em>Analyzing bill...</em>';
  try {
    const { billItems } = await callServer('/api/ocr/bill', file);
    state.billItems = billItems || [];
    renderList(billResults, state.billItems.map(i => `${i.name}${i.amount!=null?` - ₹${i.amount}`:''}`));
    renderBillEditor();
  } catch (e) {
    console.error(e);
    billResults.innerHTML = `<span style="color:red">${e.message}</span>`;
    alert(`Analyze failed: ${e.message}`);
  } finally {
    analyzeBillBtn.disabled = false;
    compareBtn.disabled = !(state.prescriptionNames.length && state.billItems.length);
    if (exportCsvBtn) exportCsvBtn.disabled = true;
  }
});

compareBtn.addEventListener('click', () => {
  const prescribed = state.prescriptionNames.map(n => n.toLowerCase());
  const rows = state.billItems.map(item => {
    const billLower = item.name.toLowerCase();
    const match = prescribed.some(p => fuzzyAdmissible(billLower, p));
    return {
      bill: item.name,
      status: match ? 'admissible' : 'inadmissible',
      amount: item.amount ?? 0,
    };
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const admissible = rows.filter(r => r.status==='admissible').reduce((s, r) => s + r.amount, 0);
  const inadmissible = total - admissible;
  compareResults.innerHTML = renderCompareTable(rows, { total, admissible, inadmissible });
  if (exportCsvBtn) exportCsvBtn.disabled = false;
  state._rows = rows;
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
    state.prescriptionNames.push('');
    renderPrescriptionEditor();
    if (exportCsvBtn) exportCsvBtn.disabled = true;
  });
}

if (addBillItemBtn) {
  addBillItemBtn.addEventListener('click', () => {
    state.billItems.push({ name: '', amount: 0 });
    renderBillEditor();
    if (exportCsvBtn) exportCsvBtn.disabled = true;
  });
}

function renderPrescriptionEditor() {
  if (!prescriptionEditor) return;
  prescriptionEditor.innerHTML = '';
  state.prescriptionNames.forEach((name, idx) => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `<input type="text" value="${escapeHtml(name)}" /> <div class="row"><button class="btn" data-i="${idx}" style="background:#ef4444">Delete</button><button class="btn" data-save="${idx}" style="background:#10b981">Save</button></div>`;
    const input = row.querySelector('input');
    input.addEventListener('input', (e) => { state.prescriptionNames[idx] = e.target.value; });
    row.querySelector('button').addEventListener('click', () => { state.prescriptionNames.splice(idx,1); renderPrescriptionEditor(); });
    row.querySelector('[data-save]')?.addEventListener('click', () => { flashSaved(row); });
    prescriptionEditor.appendChild(row);
  });
}

function renderBillEditor() {
  if (!billEditor) return;
  billEditor.innerHTML = '';
  state.billItems.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `<input type="text" value="${escapeHtml(item.name||'')}" /> <input type="number" class="amount" value="${Number(item.amount||0)}" /> <div class="row"><button class="btn" data-i="${idx}" style="background:#ef4444">Delete</button><button class="btn" data-save="${idx}" style="background:#10b981">Save</button></div>`;
    const [nameInput, amtInput] = row.querySelectorAll('input');
    nameInput.addEventListener('input', (e) => { state.billItems[idx].name = e.target.value; });
    amtInput.addEventListener('input', (e) => { state.billItems[idx].amount = Number(e.target.value||0); });
    row.querySelector('button').addEventListener('click', () => { state.billItems.splice(idx,1); renderBillEditor(); });
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
    const admAmt = adm.reduce((s,r)=>s+r.amount,0);
    const inadAmt = inad.reduce((s,r)=>s+r.amount,0);
    const sections = [];
    sections.push('Inadmissible');
    sections.push('Bill Item,Amount');
    sections.push(...inad.map(r=>`${escapeCsv(r.bill)},${r.amount}`));
    sections.push('');
    sections.push('Admissible');
    sections.push('Bill Item,Amount');
    sections.push(...adm.map(r=>`${escapeCsv(r.bill)},${r.amount}`));
    sections.push('');
    sections.push('Totals');
    sections.push(`Total,${totalAmt}`);
    sections.push(`Admissible,${admAmt}`);
    sections.push(`Inadmissible,${inadAmt}`);
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
    <div class="tr th"><div>Bill Item</div><div>Status</div><div class="right">Amount (₹)</div></div>
    ${rows.map(r=>`<div class=\"tr\"><div>${escapeHtml(r.bill)}</div><div><span class=\"badge ${r.status}\">${r.status}</span></div><div class=\"right\">${Number(r.amount||0).toFixed(2)}</div></div>`).join('')}
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

function fuzzyAdmissible(billLower, prescLower) {
  if (!billLower || !prescLower) return false;

  const billTokens = billLower.split(/[^a-z0-9]+/).filter(Boolean);
  const prescTokens = prescLower.split(/[^a-z0-9]+/).filter(Boolean);
  if (!billTokens.length || !prescTokens.length) return false;

  const b0 = firstMeaningful(billTokens);
  const p0 = firstMeaningful(prescTokens);
  if (b0 === p0 || levenshteinWithinOne(b0, p0)) return true;

  if (prescTokens.length === 1 && (b0.startsWith(p0) || p0.startsWith(b0))) return true;

  const normBill = filterTokens(billTokens).join('');
  const normPresc = filterTokens(prescTokens).join('');
  if (levenshteinWithinOne(normBill, normPresc)) return true;

  return false;
}

