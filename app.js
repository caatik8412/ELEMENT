/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — app.js
   Core: API, Auth, Router, Shell, Utilities
   Powered by CA Atik Bhayani Associates
   ============================================================ */

'use strict';

// ════════════════════════════════════════════════════════════
// CONFIG — hardcoded, never via settings or localStorage
// ════════════════════════════════════════════════════════════

const APP = {
  API_URL:  'https://script.google.com/macros/s/AKfycbypOXkGXOPqq2w2_CcPraWRYscChLfSEqHATCtz7FFpcaRHoD2g89b5dB7oj9s5vjgSAA/exec',
  VERSION:  '1.0',
  NAME:     'The Element Environment Office Manager',
  COMPANY: {
    name:    'THE ELEMENT ENVIRONMENT PRIVATE LIMITED',
    addr1:   'SR. NO. 43/76, FLAT NO. 1, Chidanand Heights,',
    addr2:   'Narhe, Vadgaon Budruk, Pune City, Pune - 411041, Maharashtra',
    gstin:   '27AAMCT9717A1Z5',
    cin:     'U74909PN2026PTC253784',
    pan:     'AAMCT9717A',
    state:   'Maharashtra',
    sc:      '27',
    bank:    'HDFC Bank',
    acc:     '50200028138853',
    ifsc:    'HDFC0003721',
    branch:  'Narhe, Pune',
    email:   'accounts@elementconsultancy.in',
    web:     'www.elementconsultancy.in',
    terms: [
      'Payment should be made by A/c Payee Cheque/D.D. or NEFT Only.',
      'All our transactions are subject to Pune jurisdiction only.',
      '18% interest will be charged on all invoices not paid within 30 days from date of invoice.'
    ]
  }
};

// ════════════════════════════════════════════════════════════
// SESSION — in-memory only, cleared on page reload
// ════════════════════════════════════════════════════════════

const SESSION = {
  token:  null,
  user:   null,
  role:   null,

  set(data) {
    this.token = data.token;
    this.user  = { userId: data.userId, name: data.name, email: data.email };
    this.role  = data.role;
  },

  clear() {
    this.token = null;
    this.user  = null;
    this.role  = null;
  },

  isAdmin()    { return this.role === 'Admin'; },
  isLoggedIn() { return !!this.token; }
};

// ════════════════════════════════════════════════════════════
// API LAYER
// ════════════════════════════════════════════════════════════

const API = {
  _pending: 0,

  async call(action, data = {}) {
    this._pending++;
    try {
      const body = { action, data };
      if (SESSION.token) body.token = SESSION.token;

      const res  = await fetch(APP.API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Server error');
      return json.result;

    } finally {
      this._pending--;
    }
  },

  // Auth
  login:    (d) => API.call('login', d),
  ping:     ()  => API.call('ping'),
  setup:    ()  => API.call('setupSheets'),

  // Settings
  getSettings:  ()  => API.call('getSettings'),
  saveSettings: (d) => API.call('saveSettings', d),

  // Clients
  getClients:    ()  => API.call('getClients'),
  saveClient:    (d) => API.call('saveClient', d),
  deleteClient:  (id)=> API.call('deleteClient', { id }),

  // Employees
  getEmployees:   ()  => API.call('getEmployees'),
  saveEmployee:   (d) => API.call('saveEmployee', d),
  deleteEmployee: (id)=> API.call('deleteEmployee', { id }),

  // Invoices
  getInvoices:   ()       => API.call('getInvoices'),
  saveInvoice:   (d)      => API.call('saveInvoice', d),
  deleteInvoice: (id)     => API.call('deleteInvoice', { id }),
  getNextInvNo:  (docType)=> API.call('getNextInvNo', { docType }),
  markPaid:      (d)      => API.call('markPaid', d),

  // Purchases
  getPurchases:   ()  => API.call('getPurchases'),
  savePurchase:   (d) => API.call('savePurchase', d),
  deletePurchase: (id)=> API.call('deletePurchase', { id }),

  // Outstanding
  getOutstanding: ()  => API.call('getOutstanding'),
  recordPayment:  (d) => API.call('recordPayment', d),

  // GSTR-2A
  getGSTR2A:      ()  => API.call('getGSTR2A'),
  updateGSTR2A:   (d) => API.call('updateGSTR2AStatus', d),

  // Due Dates
  getDueDates:   ()  => API.call('getDueDates'),
  saveDueDate:   (d) => API.call('saveDueDate', d),
  deleteDueDate: (id)=> API.call('deleteDueDate', { id }),
  seedDueDates:  (d) => API.call('seedDueDates', d),

  // PF / ESI
  getPFWorking:   ()  => API.call('getPFWorking'),
  savePFEntry:    (d) => API.call('savePFEntry', d),
  deletePFEntry:  (id)=> API.call('deletePFEntry', { id }),
  getESIWorking:  ()  => API.call('getESIWorking'),
  saveESIEntry:   (d) => API.call('saveESIEntry', d),
  deleteESIEntry: (id)=> API.call('deleteESIEntry', { id }),

  // Reports
  getSalesRegister:    (d) => API.call('getSalesRegister', d),
  getPurchaseRegister: (d) => API.call('getPurchaseRegister', d),
  getGSTSummary:       (d) => API.call('getGSTSummary', d),
  getPFRegister:       ()  => API.call('getPFRegister'),
  getESIRegister:      ()  => API.call('getESIRegister'),

  // Users
  getUsers:    ()  => API.call('getUsers'),
  saveUser:    (d) => API.call('saveUser', d),
  deleteUser:  (id)=> API.call('deleteUser', { id }),

  // Activity
  getActivity: ()  => API.call('getActivity')
};

// ════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════

const ROUTES = {
  dashboard:   { title: 'Dashboard',            icon: '🏠', fn: () => Dashboard.render(),   section: 'main' },
  billing:     { title: 'Billing',              icon: '🧾', fn: () => Billing.render(),     section: 'main' },
  purchase:    { title: 'Purchases',            icon: '🛒', fn: () => Purchase.render(),    section: 'main' },
  outstanding: { title: 'Outstanding',          icon: '⚠️', fn: () => Outstanding.render(), section: 'main' },
  gstr2a:      { title: 'GSTR-2A Matching',     icon: '🔍', fn: () => Gstr2a.render(),     section: 'gst'  },
  gstr3b:      { title: 'Est. GSTR-3B',         icon: '🧮', fn: () => Gstr3b.render(),     section: 'gst'  },
  duedates:    { title: 'Due Dates',            icon: '📅', fn: () => DueDates.render(),   section: 'compliance' },
  clients:     { title: 'Clients',              icon: '🏢', fn: () => Clients.render(),    section: 'masters' },
  employees:   { title: 'Employees',            icon: '🪪', fn: () => Employees.render(),  section: 'masters' },
  pfesi:       { title: 'PF & ESI Working',     icon: '👥', fn: () => PfEsi.render(),      section: 'masters' },
  reports:     { title: 'Reports',              icon: '📊', fn: () => Reports.render(),    section: 'reports' },
  settings:    { title: 'Settings',             icon: '⚙️', fn: () => Settings.render(),   section: 'settings' },
};

let _currentRoute = null;

async function navigateTo(route) {
  if (!ROUTES[route]) return;
  const cfg = ROUTES[route];

  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + route);
  if (navEl) navEl.classList.add('active');

  // Update title
  document.getElementById('page-title').textContent = cfg.title;

  // Render
  const content = document.getElementById('content');
  content.innerHTML = `<div class="page-loader"><span class="spinner"></span>Loading ${cfg.title}...</div>`;

  try {
    await cfg.fn();
    _currentRoute = route;
  } catch (e) {
    content.innerHTML = `<div class="card">
      <p style="color:var(--red);font-weight:600">⚠️ Error loading ${cfg.title}: ${e.message}</p>
      <button class="btn btn-outline" style="margin-top:12px" onclick="navigateTo('${route}')">↩ Retry</button>
    </div>`;
    console.error(route, e);
  }
}

// ════════════════════════════════════════════════════════════
// AUTH — LOGIN / LOGOUT
// ════════════════════════════════════════════════════════════

async function doLogin() {
  const userId = document.getElementById('login-userid').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl  = document.getElementById('login-error');
  const btn    = document.getElementById('login-btn');

  errEl.style.display = 'none';
  btn.textContent = 'Signing in…';
  btn.disabled    = true;

  try {
    const result = await API.login({ userId, password });
    SESSION.set(result);
    showApp();
  } catch (e) {
    errEl.textContent  = '⚠️ ' + (e.message.includes('Invalid') ? 'Invalid User ID or Password.' : e.message);
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Sign In →';
    btn.disabled    = false;
  }
}

function doLogout() {
  SESSION.clear();
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-userid').value   = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
}

// ════════════════════════════════════════════════════════════
// SHELL — build sidebar, topbar, then navigate
// ════════════════════════════════════════════════════════════

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  buildSidebar();
  buildTopbar();
  navigateTo('dashboard');
}

function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const sections = {
    main:       { label: 'Main',       items: ['dashboard','billing','purchase','outstanding'] },
    gst:        { label: 'GST',        items: ['gstr2a','gstr3b'] },
    compliance: { label: 'Compliance', items: ['duedates'] },
    masters:    { label: 'Masters',    items: ['clients','employees','pfesi'] },
    reports:    { label: 'Reports',    items: ['reports'] },
    settings:   { label: 'Settings',   items: ['settings'] },
  };

  let html = '';
  Object.entries(sections).forEach(([, sec]) => {
    html += `<div class="nav-section">${sec.label}</div>`;
    sec.items.forEach(key => {
      const r = ROUTES[key];
      html += `<div class="nav-item" id="nav-${key}" data-label="${r.title}" onclick="navigateTo('${key}')">
        <span class="ni">${r.icon}</span>
        <span class="nl">${r.title}</span>
      </div>`;
    });
  });
  nav.innerHTML = html;

  // User footer
  const u = SESSION.user;
  const initials = (u.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('sb-avatar').textContent  = initials;
  document.getElementById('sb-uname').textContent   = u.name;
  document.getElementById('sb-urole').textContent   = SESSION.role;
}

function buildTopbar() {
  // Date
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });

  // FY
  document.getElementById('topbar-fy').textContent = 'FY ' + getCurrentFY();
}

// ── Sidebar toggle ──────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    sb.classList.toggle('mobile-open');
  } else {
    sb.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed');
  }
}

// ════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════

function toast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  el.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    el.style.transition = 'all .3s ease';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ════════════════════════════════════════════════════════════
// MODAL SYSTEM
// ════════════════════════════════════════════════════════════

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Generic confirm dialog
function confirm(msg, title = 'Confirm') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="cd-icon">⚠️</div>
        <h3>${title}</h3>
        <p>${msg}</p>
        <div class="cd-btns">
          <button class="btn btn-outline" id="cd-cancel">Cancel</button>
          <button class="btn btn-danger"  id="cd-ok">Confirm</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cd-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('#cd-ok').onclick     = () => { overlay.remove(); resolve(true); };
    overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

// Status popup (used in GSTR-2A)
function showStatusPopup(anchorEl, options, onSelect) {
  // Remove any existing popup
  document.querySelectorAll('.status-popup').forEach(p => p.remove());

  const popup = document.createElement('div');
  popup.className = 'status-popup';
  popup.style.top  = (anchorEl.offsetTop + anchorEl.offsetHeight + 4) + 'px';
  popup.style.left = anchorEl.offsetLeft + 'px';

  options.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'status-popup-item';
    item.innerHTML = `<span>${opt.icon || ''}</span><span>${opt.label}</span>`;
    item.onclick = () => { popup.remove(); onSelect(opt.value); };
    popup.appendChild(item);
  });

  // Position relative to parent
  anchorEl.parentElement.style.position = 'relative';
  anchorEl.parentElement.appendChild(popup);

  // Click outside to close
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', handler); }
    });
  }, 0);
}

// ════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════

// Format number Indian style
function fmtNum(n, decimals = 2) {
  if (n === null || n === undefined || n === '') return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Format currency
function fmtCur(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '₹0.00';
  return '₹' + fmtNum(num);
}

// Format date
function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) { return d; }
}

// Format datetime
function fmtDT(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return d; }
}

// Today's date as YYYY-MM-DD
function today() {
  return new Date().toISOString().split('T')[0];
}

// Get FY string like "26-27"
function getCurrentFY() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1;
  return m >= 4
    ? `${String(y).slice(2)}-${String(y + 1).slice(2)}`
    : `${String(y - 1).slice(2)}-${String(y).slice(2)}`;
}

// Days since a date
function daysSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.floor((now - d) / 86400000);
}

// Days until a date
function daysUntil(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.ceil((d - now) / 86400000);
}

// Number to Indian words
function numToWords(n) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  function w(n) {
    if (n < 20)       return ones[n];
    if (n < 100)      return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
    if (n < 1000)     return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + w(n%100) : '');
    if (n < 100000)   return w(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + w(n%1000) : '');
    if (n < 10000000) return w(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + w(n%100000) : '');
    return w(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + w(n%10000000) : '');
  }

  const num = Math.abs(+n || 0);
  const int = Math.floor(num);
  const dec = Math.round((num - int) * 100);
  let result = w(int) + ' Rupees';
  if (dec > 0) result += ' and ' + w(dec) + ' Paise';
  return result + ' Only';
}

// Badge HTML
function badge(text, color) {
  const map = {
    // Status
    'Paid': 'green', 'Unpaid': 'red', 'Partial': 'yellow', 'Overdue': 'red',
    'Done': 'green', 'Pending': 'yellow', 'NA': 'gray',
    'Completed': 'green',
    // Supply type
    'Intra-State': 'green', 'Inter-State': 'blue',
    // Doc type
    'Invoice': 'navy', 'Proforma': 'blue', 'Quotation': 'purple',
    // Employee
    'Active': 'green', 'Inactive': 'gray', 'Left': 'red',
    // GSTR-2A
    'Matched': 'green', 'Mismatch': 'red', 'Not Available': 'orange',
    'Ineligible ITC': 'purple',
    // Due dates
    'Overdue': 'red', 'Due Soon': 'yellow',
    // Payment
    'Unpaid': 'red',
  };
  const c = color || map[text] || 'gray';
  return `<span class="badge badge-${c}">${text || '—'}</span>`;
}

// Aging badge
function ageBadge(days) {
  if (days <= 0)  return `<span class="badge age-ok">Current</span>`;
  if (days <= 30) return `<span class="badge age-ok">${days}d</span>`;
  if (days <= 60) return `<span class="badge age-30">${days}d</span>`;
  if (days <= 90) return `<span class="badge age-60">${days}d</span>`;
  return `<span class="badge age-90">${days}d — Critical</span>`;
}

// Due date class
function ddClass(days, status) {
  if (status === 'Done' || status === 'Completed') return 'dd-done';
  if (days < 0)  return 'dd-overdue';
  if (days <= 7) return 'dd-soon';
  return 'dd-ok';
}

// Truncate text
function trunc(s, n = 40) {
  if (!s) return '—';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// Escape HTML
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

// State list
const STATES = [
  {n:'Andaman & Nicobar Islands',c:'35'},{n:'Andhra Pradesh',c:'37'},{n:'Arunachal Pradesh',c:'12'},
  {n:'Assam',c:'18'},{n:'Bihar',c:'10'},{n:'Chandigarh',c:'04'},{n:'Chhattisgarh',c:'22'},
  {n:'Dadra & Nagar Haveli & Daman & Diu',c:'26'},{n:'Delhi',c:'07'},{n:'Goa',c:'30'},
  {n:'Gujarat',c:'24'},{n:'Haryana',c:'06'},{n:'Himachal Pradesh',c:'02'},
  {n:'Jammu & Kashmir',c:'01'},{n:'Jharkhand',c:'20'},{n:'Karnataka',c:'29'},
  {n:'Kerala',c:'32'},{n:'Ladakh',c:'38'},{n:'Lakshadweep',c:'31'},
  {n:'Madhya Pradesh',c:'23'},{n:'Maharashtra',c:'27'},{n:'Manipur',c:'14'},
  {n:'Meghalaya',c:'17'},{n:'Mizoram',c:'15'},{n:'Nagaland',c:'13'},{n:'Odisha',c:'21'},
  {n:'Puducherry',c:'34'},{n:'Punjab',c:'03'},{n:'Rajasthan',c:'08'},{n:'Sikkim',c:'11'},
  {n:'Tamil Nadu',c:'33'},{n:'Telangana',c:'36'},{n:'Tripura',c:'16'},
  {n:'Uttar Pradesh',c:'09'},{n:'Uttarakhand',c:'05'},{n:'West Bengal',c:'19'}
];

function stateOptions(selected = '') {
  return STATES.map(s =>
    `<option value="${s.n}" data-code="${s.c}" ${s.n === selected ? 'selected' : ''}>${s.n}</option>`
  ).join('');
}

function stateCode(name) {
  return (STATES.find(s => s.n === name) || {}).c || '';
}

// Populate a <select> with state options
function populateStateSelect(elId, selected = '') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `<option value="">-- Select State --</option>` + stateOptions(selected);
}

// GST rate options
function gstRateOptions(selected = '18') {
  return [0, 5, 12, 18, 28].map(r =>
    `<option value="${r}" ${String(r) === String(selected) ? 'selected' : ''}>${r}%${r === 0 ? ' (Exempt)' : ''}</option>`
  ).join('');
}

// Expense categories
const EXPENSE_CATEGORIES = [
  'Office Supplies', 'Travel & Conveyance', 'Professional Fees', 'Rent',
  'Utilities', 'Repairs & Maintenance', 'Advertisement', 'Printing & Stationery',
  'Staff Welfare', 'Bank Charges', 'Insurance', 'Subscription', 'Other'
];

// Excel export using SheetJS (loaded in index.html)
function exportExcel(data, sheetName, filename) {
  if (typeof XLSX === 'undefined') { toast('Excel library not loaded', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
  toast(`✅ ${filename} downloaded`, 'success');
}

// ════════════════════════════════════════════════════════════
// INVOICE PRINT
// ════════════════════════════════════════════════════════════

function printInvoice(inv) {
  let items = [];
  try { items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []); }
  catch (e) {}

  const isInter   = inv.supplyType === 'Inter-State';
  const docTitle  = inv.docType === 'Proforma' ? 'PROFORMA INVOICE'
                  : inv.docType === 'Quotation' ? 'QUOTATION'
                  : 'TAX INVOICE';
  const co        = APP.COMPANY;
  const taxable   = parseFloat(inv.taxableValue) || 0;
  const gstRate   = parseFloat(inv.gstRate) || 18;
  const halfRate  = gstRate / 2;

  const itemRows  = items.map((it, i) => {
    const amt = (parseFloat(it.qty) || 1) * (parseFloat(it.rate) || 0);
    return `<tr>
      <td style="text-align:center">${String.fromCharCode(64 + i + 1)}</td>
      <td>${esc(it.description || it.desc || '')}</td>
      <td style="text-align:center">${esc(it.sacCode || it.sac || '—')}</td>
      <td style="text-align:center">${parseFloat(it.qty || 1).toFixed(2)}</td>
      <td style="text-align:right">${fmtNum(it.rate || 0)}</td>
      <td style="text-align:right">${fmtNum(amt)}</td>
    </tr>`;
  }).join('');

  const gstRows = isInter
    ? `<tr><td colspan="5" style="text-align:right;font-weight:700">IGST (${gstRate}%)</td>
         <td style="text-align:right;font-weight:700">${fmtNum(inv.igst)}</td></tr>`
    : `<tr><td colspan="5" style="text-align:right">CGST (${halfRate}%)</td>
         <td style="text-align:right">${fmtNum(inv.cgst)}</td></tr>
       <tr><td colspan="5" style="text-align:right">SGST (${halfRate}%)</td>
         <td style="text-align:right">${fmtNum(inv.sgst)}</td></tr>`;

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
  <title>${docTitle} — ${inv.invoiceNo}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Times New Roman',Times,serif;font-size:11pt;color:#000;padding:14px}
    .outer{border:2px solid #000;max-width:820px;margin:0 auto}
    .hdr{text-align:center;padding:10px 14px;border-bottom:1px solid #000}
    .hdr .co{font-size:14pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    .hdr .addr{font-size:9pt;margin-top:3px;color:#222;line-height:1.5}
    .title-bar{text-align:center;font-weight:700;font-size:12pt;border-bottom:1px solid #000;padding:6px;text-transform:uppercase;letter-spacing:.1em;background:#f5f5f5}
    .meta{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000}
    .meta-l{padding:8px 12px;border-right:1px solid #000;font-size:10pt}
    .meta-r{padding:8px 12px;font-size:10pt}
    .meta-r table{width:100%;border-collapse:collapse}
    .meta-r td{padding:3px 0;vertical-align:top}
    .meta-r td:first-child{font-weight:700;width:50%;padding-right:8px}
    table.items{width:100%;border-collapse:collapse;font-size:10pt}
    table.items th{border:1px solid #000;padding:5px 7px;text-align:center;font-weight:700;background:#f0f0f0}
    table.items td{border:1px solid #000;padding:4px 7px}
    .footer{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000}
    .fl{padding:8px 12px;border-right:1px solid #000;font-size:9.5pt;line-height:1.7}
    .fr{padding:8px 12px;font-size:9.5pt;line-height:1.7}
    .sig{text-align:right;padding:36px 14px 10px;font-size:10pt;font-weight:700}
    .terms{border-top:1px solid #000;padding:6px 12px;font-size:9pt;line-height:1.6}
    .terms b{display:block;margin-bottom:2px;font-size:9.5pt}
    .powered{text-align:center;font-size:8.5pt;color:#666;padding:6px;border-top:1px solid #eee}
    @media print{body{padding:0}.outer{max-width:100%}button{display:none!important}}
  </style>
  </head><body>
  <div style="text-align:right;margin-bottom:8px">
    <button onclick="window.print()" style="padding:6px 16px;background:#1A3A5C;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px">🖨️ Print</button>
  </div>
  <div class="outer">
    <div class="hdr">
      <div class="co">${co.name}</div>
      <div class="addr">${co.addr1} ${co.addr2}<br>
        E-mail: ${co.email} | Website: ${co.web}
      </div>
    </div>
    <div class="title-bar">${docTitle}</div>
    <div class="meta">
      <div class="meta-l">
        <div style="font-weight:700;margin-bottom:4px">To,</div>
        <div style="font-weight:700;font-size:11pt">${esc(inv.clientName || '')}</div>
        <div style="white-space:pre-line;margin-top:3px;font-size:9.5pt">${esc(inv.clientAddress || '')}</div>
        ${inv.clientGSTIN ? `<div style="margin-top:6px"><strong>Customer GST No.: ${inv.clientGSTIN}</strong></div>` : ''}
      </div>
      <div class="meta-r">
        <table>
          <tr><td>Invoice No.:</td><td><strong>${esc(inv.invoiceNo || '')}</strong></td></tr>
          <tr><td>Date:</td><td>${fmtDate(inv.invoiceDate)}</td></tr>
          ${inv.orderNo ? `<tr><td>Order No.:</td><td>${esc(inv.orderNo)}</td></tr>
                          <tr><td>Order Date:</td><td>${fmtDate(inv.orderDate)}</td></tr>` : ''}
        </table>
      </div>
    </div>
    <table class="items">
      <thead>
        <tr>
          <th style="width:5%">SR.</th>
          <th style="width:38%">DESCRIPTION</th>
          <th style="width:10%">SAC</th>
          <th style="width:8%">QTY</th>
          <th style="width:12%">PRICE</th>
          <th style="width:12%">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr>
          <td colspan="5" style="text-align:right;font-weight:700;border-top:2px solid #000">SUB TOTAL</td>
          <td style="text-align:right;font-weight:700;border-top:2px solid #000">${fmtNum(taxable)}</td>
        </tr>
        ${gstRows}
        ${parseFloat(inv.roundOff) !== 0 ? `<tr><td colspan="5" style="text-align:right">Round Off</td>
          <td style="text-align:right">${fmtNum(inv.roundOff)}</td></tr>` : ''}
        <tr style="background:#f5f5f5">
          <td colspan="5" style="text-align:right;font-weight:700;font-size:11pt;border-top:2px solid #000">Total Amount</td>
          <td style="text-align:right;font-weight:700;font-size:11pt;border-top:2px solid #000">${fmtNum(inv.totalAmount)}</td>
        </tr>
        <tr style="background:#f5f5f5">
          <td colspan="5" style="text-align:right;font-weight:700">Payable Amount</td>
          <td style="text-align:right;font-weight:700">${fmtNum(inv.totalAmount)}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">
      <div class="fl">
        <strong>Company Details</strong><br>
        PAN No.: ${co.pan}<br>
        GST No.: ${co.gstin}<br>
        CIN: ${co.cin}<br><br>
        <strong>Bank Details (For RTGS / NEFT)</strong><br>
        ${co.bank}, ${co.branch}<br>
        A/c No.: ${co.acc}<br>
        IFSC Code: ${co.ifsc}
      </div>
      <div class="fr">
        <strong>Amount in Words</strong><br>
        <em>${inv.amountWords || numToWords(parseFloat(inv.totalAmount) || 0)}</em>
        ${inv.notes ? `<br><br><strong>Notes</strong><br>${esc(inv.notes)}` : ''}
        <div class="sig">For, ${co.name}<br><br><br>Authorised Signatory</div>
      </div>
    </div>
    <div class="terms">
      <b>Terms &amp; Conditions:</b>
      ${co.terms.map((t, i) => `${i + 1}. ${t}`).join('<br>')}
    </div>
    <div class="powered">Powered by CA Atik Bhayani Associates</div>
  </div>
  </body></html>`);
  w.document.close();
}

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════

async function init() {
  // Setup sheets silently on first load
  try { await API.setup(); } catch (e) { console.warn('Setup:', e.message); }

  // Bind login form
  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', doLogout);

  // Close modals on overlay click
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
    }
  });

  // Close mobile sidebar on nav click
  document.addEventListener('click', e => {
    if (window.innerWidth <= 768 && e.target.closest('.nav-item')) {
      document.getElementById('sidebar').classList.remove('mobile-open');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
