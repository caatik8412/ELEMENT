/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — billing.js
   Modules: Invoice / Proforma / Quotation
   ============================================================ */

'use strict';

const Billing = (() => {

  // ── State ────────────────────────────────────────────────
  let _invoices = [];
  let _clients  = [];
  let _editId   = null;
  let _filter   = { docType: 'all', status: 'all', search: '' };

  // ── Render ───────────────────────────────────────────────
  async function render() {
    [_invoices, _clients] = await Promise.all([API.getInvoices(), API.getClients()]);
    _renderShell();
    _applyFilter();
    _ensureModal();
  }

  function _renderShell() {
    const el = document.getElementById('content');

    // Summary stats across all doc types
    const invOnly  = _invoices.filter(i => (i.docType || 'Invoice') === 'Invoice');
    const totBill  = invOnly.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);
    const totUnpd  = invOnly.filter(i => i.status === 'Unpaid').reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);
    const totPaid  = invOnly.filter(i => i.status === 'Paid').reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);

    el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card" style="--c:var(--navy-400)">
        <div class="s-icon">🧾</div>
        <div class="s-label">Total Billed</div>
        <div class="s-value">${fmtCur(totBill)}</div>
        <div class="s-sub">${invOnly.length} Tax Invoice${invOnly.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-card" style="--c:var(--green)">
        <div class="s-icon">✅</div>
        <div class="s-label">Received</div>
        <div class="s-value" style="color:var(--green)">${fmtCur(totPaid)}</div>
        <div class="s-sub">${invOnly.filter(i=>i.status==='Paid').length} paid</div>
      </div>
      <div class="stat-card" style="--c:var(--red)">
        <div class="s-icon">⏳</div>
        <div class="s-label">Outstanding</div>
        <div class="s-value" style="color:var(--red)">${fmtCur(totUnpd)}</div>
        <div class="s-sub">${invOnly.filter(i=>i.status==='Unpaid').length} unpaid</div>
      </div>
      <div class="stat-card" style="--c:var(--purple)">
        <div class="s-icon">📋</div>
        <div class="s-label">Proforma / Quotations</div>
        <div class="s-value">${_invoices.filter(i=>i.docType==='Proforma'||i.docType==='Quotation').length}</div>
        <div class="s-sub">pending conversion</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Billing</h2>
        <div class="card-actions">
          <div class="pill-group">
            <button class="pill-btn active" id="dt-all"       onclick="Billing._setDocFilter('all')">All</button>
            <button class="pill-btn"        id="dt-Invoice"   onclick="Billing._setDocFilter('Invoice')">Invoices</button>
            <button class="pill-btn"        id="dt-Proforma"  onclick="Billing._setDocFilter('Proforma')">Proforma</button>
            <button class="pill-btn"        id="dt-Quotation" onclick="Billing._setDocFilter('Quotation')">Quotations</button>
          </div>
          <select class="form-control" style="width:auto;padding:6px 10px" id="status-filter" onchange="Billing._setStatusFilter(this.value)">
            <option value="all">All Status</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
          </select>
          <input class="form-control" style="width:180px;padding:6px 10px" type="text"
            placeholder="Search…" id="bill-search"
            oninput="Billing._setSearch(this.value)"/>
          <button class="btn btn-primary np" onclick="Billing.openNew()">+ New Bill</button>
        </div>
      </div>
      <div id="bill-table-wrap"></div>
    </div>

    <!-- GSTR-1 quick export -->
    <div class="card">
      <div class="card-header">
        <h2>📊 GSTR-1 Quick Export</h2>
        <div class="card-actions">
          <button class="btn btn-accent np" onclick="Billing.exportGSTR1()">⬇️ Download Excel</button>
          <button class="btn btn-outline np" onclick="navigateTo('gstr2a')">GSTR-2A →</button>
        </div>
      </div>
      <div id="gstr1-summary"></div>
    </div>`;

    _renderGSTR1Summary();
  }

  function _applyFilter() {
    let list = [..._invoices];
    if (_filter.docType !== 'all') list = list.filter(i => (i.docType || 'Invoice') === _filter.docType);
    if (_filter.status  !== 'all') list = list.filter(i => i.status === _filter.status);
    if (_filter.search) {
      const q = _filter.search.toLowerCase();
      list = list.filter(i =>
        (i.invoiceNo   || '').toLowerCase().includes(q) ||
        (i.clientName  || '').toLowerCase().includes(q) ||
        (i.clientGSTIN || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
    _renderTable(list);

    // Sync pill buttons
    ['all','Invoice','Proforma','Quotation'].forEach(t => {
      const el = document.getElementById('dt-' + t);
      if (el) el.classList.toggle('active', _filter.docType === t);
    });
  }

  function _renderTable(list) {
    const wrap = document.getElementById('bill-table-wrap');
    if (!wrap) return;

    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-state">
        <span class="es-icon">🧾</span>
        <h3>No bills found</h3>
        <p>Create your first invoice, proforma, or quotation.</p>
        <button class="btn btn-primary np" onclick="Billing.openNew()">+ New Bill</button>
      </div>`;
      return;
    }

    wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Doc No.</th>
            <th>Date</th>
            <th>Client</th>
            <th>GSTIN</th>
            <th>Taxable</th>
            <th>GST</th>
            <th>Total</th>
            <th>Supply</th>
            <th>Type</th>
            <th>Status</th>
            <th class="np">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(i => {
            const gst = (parseFloat(i.cgst)||0) + (parseFloat(i.sgst)||0) + (parseFloat(i.igst)||0);
            return `<tr>
              <td style="font-weight:700;font-size:12px;font-family:monospace">${esc(i.invoiceNo)}</td>
              <td style="white-space:nowrap">${fmtDate(i.invoiceDate)}</td>
              <td style="font-weight:600">${trunc(i.clientName, 22)}</td>
              <td style="font-size:11px;font-family:monospace;color:var(--muted)">${i.clientGSTIN || '—'}</td>
              <td>${fmtCur(i.taxableValue)}</td>
              <td>${fmtCur(gst)}</td>
              <td style="font-weight:800">${fmtCur(i.totalAmount)}</td>
              <td>${badge(i.supplyType || '—')}</td>
              <td>${badge(i.docType || 'Invoice')}</td>
              <td>${badge(i.status)}</td>
              <td class="np" style="white-space:nowrap">
                <button class="btn btn-ghost btn-icon btn-sm" title="Print" onclick="Billing.print('${i.id}')">🖨️</button>
                <button class="btn btn-ghost btn-icon btn-sm" title="Edit"  onclick="Billing.openEdit('${i.id}')">✏️</button>
                ${(i.docType === 'Proforma' || i.docType === 'Quotation')
                  ? `<button class="btn btn-accent btn-sm" onclick="Billing.convert('${i.id}')" title="Convert to Invoice">→ Invoice</button>`
                  : `<button class="btn btn-success btn-icon btn-sm" title="Record Payment" onclick="Billing.openPayment('${i.id}')">💰</button>`
                }
                <button class="btn btn-danger btn-icon btn-sm" title="Delete" onclick="Billing.delete('${i.id}')">🗑</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4">Total (${list.length} records)</td>
            <td>${fmtCur(list.reduce((s,i)=>s+(parseFloat(i.taxableValue)||0),0))}</td>
            <td>${fmtCur(list.reduce((s,i)=>s+(parseFloat(i.cgst)||0)+(parseFloat(i.sgst)||0)+(parseFloat(i.igst)||0),0))}</td>
            <td>${fmtCur(list.reduce((s,i)=>s+(parseFloat(i.totalAmount)||0),0))}</td>
            <td colspan="4"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }

  function _renderGSTR1Summary() {
    const wrap = document.getElementById('gstr1-summary');
    if (!wrap) return;
    const invs = _invoices.filter(i => (i.docType || 'Invoice') === 'Invoice');
    const b2b  = invs.filter(i => i.clientGSTIN);
    const b2c  = invs.filter(i => !i.clientGSTIN);
    const rw   = {};
    invs.forEach(i => {
      const r = i.gstRate || '18';
      if (!rw[r]) rw[r] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      rw[r].taxable += parseFloat(i.taxableValue) || 0;
      rw[r].cgst    += parseFloat(i.cgst) || 0;
      rw[r].sgst    += parseFloat(i.sgst) || 0;
      rw[r].igst    += parseFloat(i.igst) || 0;
    });

    wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:14px">
      <div class="pf-box"><div class="pb-label">B2B (with GSTIN)</div><div class="pb-value">${b2b.length}</div></div>
      <div class="pf-box"><div class="pb-label">B2C (no GSTIN)</div><div class="pb-value">${b2c.length}</div></div>
      <div class="pf-box"><div class="pb-label">Inter-State</div><div class="pb-value">${invs.filter(i=>i.supplyType==='Inter-State').length}</div></div>
      <div class="pf-box"><div class="pb-label">Intra-State</div><div class="pb-value">${invs.filter(i=>i.supplyType==='Intra-State').length}</div></div>
      <div class="pf-box"><div class="pb-label">Total Taxable</div><div class="pb-value" style="font-size:13px">${fmtCur(invs.reduce((s,i)=>s+(parseFloat(i.taxableValue)||0),0))}</div></div>
      <div class="pf-box"><div class="pb-label">Total GST</div><div class="pb-value" style="font-size:13px">${fmtCur(invs.reduce((s,i)=>s+(parseFloat(i.cgst)||0)+(parseFloat(i.sgst)||0)+(parseFloat(i.igst)||0),0))}</div></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>GST Rate</th><th>Taxable Value</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total GST</th></tr></thead>
        <tbody>
          ${Object.entries(rw).sort((a,b)=>+a[0]-+b[0]).map(([r,v]) => `<tr>
            <td style="font-weight:700">${r}%</td>
            <td>${fmtCur(v.taxable)}</td>
            <td>${fmtCur(v.cgst)}</td>
            <td>${fmtCur(v.sgst)}</td>
            <td>${fmtCur(v.igst)}</td>
            <td style="font-weight:700">${fmtCur(v.cgst+v.sgst+v.igst)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>${fmtCur(invs.reduce((s,i)=>s+(parseFloat(i.taxableValue)||0),0))}</td>
            <td>${fmtCur(invs.reduce((s,i)=>s+(parseFloat(i.cgst)||0),0))}</td>
            <td>${fmtCur(invs.reduce((s,i)=>s+(parseFloat(i.sgst)||0),0))}</td>
            <td>${fmtCur(invs.reduce((s,i)=>s+(parseFloat(i.igst)||0),0))}</td>
            <td>${fmtCur(invs.reduce((s,i)=>s+(parseFloat(i.cgst)||0)+(parseFloat(i.sgst)||0)+(parseFloat(i.igst)||0),0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }

  // ── Filter handlers ──────────────────────────────────────
  function _setDocFilter(t)    { _filter.docType = t; _applyFilter(); }
  function _setStatusFilter(s) { _filter.status  = s; _applyFilter(); }
  function _setSearch(q)       { _filter.search  = q; _applyFilter(); }

  // ── Modal ────────────────────────────────────────────────
  function _ensureModal() {
    if (document.getElementById('modal-billing')) return;

    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal-overlay" id="modal-billing">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3 id="bill-modal-title">New Invoice</h3>
          <button class="modal-close" onclick="closeModal('modal-billing')">✕</button>
        </div>
        <div class="modal-body">

          <!-- Doc type selector -->
          <div style="margin-bottom:16px">
            <div class="pill-group" id="doctype-pills">
              <button class="pill-btn active" id="pill-Invoice"   onclick="Billing._setDocType('Invoice')">🧾 Tax Invoice</button>
              <button class="pill-btn"        id="pill-Proforma"  onclick="Billing._setDocType('Proforma')">📋 Proforma Invoice</button>
              <button class="pill-btn"        id="pill-Quotation" onclick="Billing._setDocType('Quotation')">💬 Quotation</button>
            </div>
            <input type="hidden" id="b-doctype" value="Invoice"/>
          </div>

          <div class="form-grid">
            <div class="form-section">Document Details</div>
            <div class="form-group">
              <label>Doc Number</label>
              <input class="form-control" id="b-no" readonly placeholder="Auto-generated"/>
            </div>
            <div class="form-group">
              <label>Date <span class="req">*</span></label>
              <input class="form-control" id="b-date" type="date"/>
            </div>
            <div class="form-group">
              <label>Order / PO No.</label>
              <input class="form-control" id="b-ordno" placeholder="Optional"/>
            </div>
            <div class="form-group">
              <label>Order Date</label>
              <input class="form-control" id="b-orddate" type="date"/>
            </div>

            <div class="form-section">Client</div>
            <div class="form-group">
              <label>Select Client <span class="req">*</span></label>
              <select class="form-control" id="b-client" onchange="Billing._onClientChange()">
                <option value="">— Select Client —</option>
              </select>
            </div>
            <div class="form-group">
              <label>Client GSTIN</label>
              <input class="form-control" id="b-gstin" placeholder="Auto-filled" oninput="this.value=this.value.toUpperCase()"/>
            </div>
            <div class="form-group">
              <label>Client State</label>
              <select class="form-control" id="b-cstate" onchange="Billing._calcGST()">
                <option value="">— Select —</option>
              </select>
            </div>
            <div class="form-group">
              <label>Place of Supply</label>
              <select class="form-control" id="b-pos" onchange="Billing._calcGST()">
                <option value="">— Select —</option>
              </select>
            </div>
            <div class="form-group full">
              <label>Client Address (for invoice print)</label>
              <textarea class="form-control" id="b-caddr" rows="2" placeholder="Full billing address"></textarea>
            </div>
          </div>

          <!-- Line Items -->
          <div class="form-section" style="margin:16px 0 8px">Line Items</div>
          <table class="line-items-table" id="line-items-tbl">
            <thead>
              <tr>
                <th style="width:4%">#</th>
                <th style="width:36%">Description</th>
                <th style="width:10%">SAC Code</th>
                <th style="width:9%">Qty</th>
                <th style="width:13%">Rate (₹)</th>
                <th style="width:13%">Amount (₹)</th>
                <th style="width:4%" class="np"></th>
              </tr>
            </thead>
            <tbody id="line-items-body"></tbody>
            <tfoot>
              <tr>
                <td colspan="5" style="text-align:right;font-weight:700">Sub Total</td>
                <td id="li-subtotal" style="font-weight:700">0.00</td>
                <td class="np"></td>
              </tr>
            </tfoot>
          </table>
          <button class="add-line-btn np" onclick="Billing._addRow()">+ Add Row</button>

          <!-- GST Summary -->
          <div class="form-grid" style="margin-top:16px">
            <div class="form-section">GST</div>
            <div class="form-group">
              <label>GST Rate</label>
              <select class="form-control" id="b-grate" onchange="Billing._calcGST()">
                ${gstRateOptions('18')}
              </select>
            </div>
            <div class="form-group">
              <label>Supply Type</label>
              <input class="form-control" id="b-stype" readonly/>
            </div>
            <div class="form-group">
              <label>CGST (₹)</label>
              <input class="form-control" id="b-cgst" readonly/>
            </div>
            <div class="form-group">
              <label>SGST (₹)</label>
              <input class="form-control" id="b-sgst" readonly/>
            </div>
            <div class="form-group">
              <label>IGST (₹)</label>
              <input class="form-control" id="b-igst" readonly/>
            </div>
            <div class="form-group">
              <label>Round Off (₹)</label>
              <input class="form-control" id="b-roff" readonly/>
            </div>
            <div class="form-group">
              <label>Total Amount (₹)</label>
              <input class="form-control" id="b-total" readonly style="font-weight:800;font-size:14px"/>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select class="form-control" id="b-status">
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
                <option value="Partial">Partial</option>
              </select>
            </div>
            <div class="form-group full">
              <label>Amount in Words</label>
              <input class="form-control" id="b-words" readonly/>
            </div>
            <div class="form-group full">
              <label>Notes / Remarks</label>
              <input class="form-control" id="b-notes" placeholder="Optional internal notes"/>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline"  onclick="closeModal('modal-billing')">Cancel</button>
          <button class="btn btn-warning np" onclick="Billing._printCurrent()">🖨️ Print Preview</button>
          <button class="btn btn-primary"   onclick="Billing.save()">💾 Save</button>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <div class="modal-overlay modal-sm" id="modal-payment">
      <div class="modal modal-sm">
        <div class="modal-header">
          <h3>Record Payment</h3>
          <button class="modal-close" onclick="closeModal('modal-payment')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full">
              <label>Invoice</label>
              <input class="form-control" id="pay-invno" readonly/>
            </div>
            <div class="form-group full">
              <label>Outstanding Balance</label>
              <input class="form-control" id="pay-balance" readonly style="font-weight:700;color:var(--red)"/>
            </div>
            <div class="form-group full">
              <label>Payment Amount (₹) <span class="req">*</span></label>
              <input class="form-control" id="pay-amount" type="number" step="0.01" min="0" placeholder="0.00"/>
            </div>
            <div class="form-group full">
              <label>Payment Date</label>
              <input class="form-control" id="pay-date" type="date"/>
            </div>
            <div class="form-group full">
              <label>Remarks</label>
              <input class="form-control" id="pay-remarks" placeholder="NEFT / Cheque no. etc."/>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeModal('modal-payment')">Cancel</button>
          <button class="btn btn-success" onclick="Billing.savePayment()">💰 Record Payment</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div);

    // Populate state dropdowns
    populateStateSelect('b-cstate');
    populateStateSelect('b-pos');
  }

  // ── Doc type ─────────────────────────────────────────────
  function _setDocType(t) {
    document.getElementById('b-doctype').value = t;
    ['Invoice','Proforma','Quotation'].forEach(x => {
      document.getElementById('pill-' + x)?.classList.toggle('active', x === t);
    });
    // Quotation/Proforma don't need status
    const statusGrp = document.getElementById('b-status')?.closest('.form-group');
    if (statusGrp) statusGrp.style.display = t === 'Invoice' ? '' : 'none';
  }

  // ── Client auto-fill ─────────────────────────────────────
  function _onClientChange() {
    const id = document.getElementById('b-client').value;
    const cl = _clients.find(c => c.id === id);
    if (!cl) return;
    document.getElementById('b-gstin').value = cl.gstin || '';
    document.getElementById('b-caddr').value =
      [cl.address, cl.city, cl.state].filter(Boolean).join(', ');

    // Set state dropdowns
    const cstate = document.getElementById('b-cstate');
    const pos    = document.getElementById('b-pos');
    [...cstate.options].forEach(o => { if (o.value === cl.state) cstate.value = cl.state; });
    [...pos.options].forEach(o    => { if (o.value === cl.state) pos.value    = cl.state; });
    _calcGST();
  }

  // ── Line items ───────────────────────────────────────────
  function _addRow(desc = '', sac = '', qty = 1, rate = 0) {
    const tbody = document.getElementById('line-items-body');
    const idx   = tbody.children.length + 1;
    const tr    = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;color:var(--muted);font-size:11px">${String.fromCharCode(64 + idx)}</td>
      <td><input placeholder="Description of service" value="${esc(desc)}" oninput="Billing._calcGST()"/></td>
      <td><input placeholder="SAC" value="${esc(sac)}" style="font-family:monospace;font-size:11.5px"/></td>
      <td><input type="number" min="0" step="0.01" value="${qty}" oninput="Billing._calcGST()"/></td>
      <td><input type="number" min="0" step="0.01" value="${rate}" oninput="Billing._calcGST()"/></td>
      <td class="row-amt" style="font-weight:700;text-align:right">${fmtNum((+qty)*(+rate))}</td>
      <td class="np" style="text-align:center">
        <button onclick="this.closest('tr').remove();Billing._calcGST()"
          style="background:none;border:none;cursor:pointer;color:var(--red);font-size:14px;padding:2px 4px">✕</button>
      </td>`;
    tbody.appendChild(tr);
    _calcGST();
  }

  function _getItems() {
    const rows = document.getElementById('line-items-body')?.querySelectorAll('tr') || [];
    return [...rows].map((tr, i) => {
      const inputs = tr.querySelectorAll('input');
      const qty    = parseFloat(inputs[2].value) || 0;
      const rate   = parseFloat(inputs[3].value) || 0;
      const amt    = qty * rate;
      // Update row amount display
      const amtEl  = tr.querySelector('.row-amt');
      if (amtEl) amtEl.textContent = fmtNum(amt);
      return {
        description: inputs[0].value,
        sacCode:     inputs[1].value,
        qty,
        rate,
        amount:      amt
      };
    });
  }

  // ── GST Calculation ──────────────────────────────────────
  function _calcGST() {
    const items   = _getItems();
    const subTotal = items.reduce((s, i) => s + i.amount, 0);
    const rate     = parseFloat(document.getElementById('b-grate')?.value) || 0;
    const pos      = document.getElementById('b-pos')?.value || '';
    const isInter  = pos && pos !== APP.COMPANY.state;
    const gst      = subTotal * rate / 100;
    const raw      = subTotal + gst;
    const rnd      = Math.round(raw) - raw;
    const total    = Math.round(raw);

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = typeof v === 'number' ? v.toFixed(2) : v;
    };

    const sub = document.getElementById('li-subtotal');
    if (sub) sub.textContent = fmtNum(subTotal);

    set('b-stype', isInter ? 'Inter-State' : 'Intra-State');
    set('b-cgst',  isInter ? 0 : gst / 2);
    set('b-sgst',  isInter ? 0 : gst / 2);
    set('b-igst',  isInter ? gst : 0);
    set('b-roff',  rnd);
    set('b-total', total);
    if (document.getElementById('b-words')) {
      document.getElementById('b-words').value = total > 0 ? numToWords(total) : '';
    }
  }

  // ── Open new / edit ──────────────────────────────────────
  async function openNew() {
    _editId = null;
    _resetModal();
    document.getElementById('bill-modal-title').textContent = 'New Invoice';

    // Populate clients
    _populateClientDropdown();

    // Get next invoice number
    try {
      const r = await API.getNextInvNo('Invoice');
      document.getElementById('b-no').value = r.invoiceNo;
    } catch (e) { document.getElementById('b-no').value = ''; }

    document.getElementById('b-date').value = today();
    _addRow(); // start with one row
    openModal('modal-billing');
  }

  function openEdit(id) {
    _editId = id;
    const inv = _invoices.find(i => i.id === id);
    if (!inv) return;

    _resetModal();
    document.getElementById('bill-modal-title').textContent = 'Edit — ' + inv.invoiceNo;
    _populateClientDropdown(inv.clientId);

    _setDocType(inv.docType || 'Invoice');
    document.getElementById('b-no').value      = inv.invoiceNo || '';
    document.getElementById('b-date').value    = inv.invoiceDate || '';
    document.getElementById('b-ordno').value   = inv.orderNo || '';
    document.getElementById('b-orddate').value = inv.orderDate || '';
    document.getElementById('b-gstin').value   = inv.clientGSTIN || '';
    document.getElementById('b-caddr').value   = inv.clientAddress || '';
    document.getElementById('b-grate').value   = inv.gstRate || '18';
    document.getElementById('b-status').value  = inv.status || 'Unpaid';
    document.getElementById('b-notes').value   = inv.notes || '';

    // State dropdowns
    const cstate = document.getElementById('b-cstate');
    const pos    = document.getElementById('b-pos');
    [...cstate.options].forEach(o => { if (o.value === inv.clientState)    cstate.value = inv.clientState; });
    [...pos.options].forEach(o    => { if (o.value === inv.placeOfSupply)  pos.value    = inv.placeOfSupply; });

    // Line items
    const items = Array.isArray(inv.items) ? inv.items : [];
    items.forEach(it => _addRow(it.description || it.desc || '', it.sacCode || it.sac || '', it.qty || 1, it.rate || 0));
    if (items.length === 0) _addRow();

    _calcGST();
    openModal('modal-billing');
  }

  function _resetModal() {
    ['b-no','b-date','b-ordno','b-orddate','b-gstin','b-caddr','b-stype',
     'b-cgst','b-sgst','b-igst','b-roff','b-total','b-words','b-notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('b-grate').value  = '18';
    document.getElementById('b-status').value = 'Unpaid';
    document.getElementById('b-client').value = '';
    document.getElementById('line-items-body').innerHTML = '';
    const sub = document.getElementById('li-subtotal');
    if (sub) sub.textContent = '0.00';
    _setDocType('Invoice');
  }

  function _populateClientDropdown(selectedId = null) {
    const sel = document.getElementById('b-client');
    if (!sel) return;
    sel.innerHTML = `<option value="">— Select Client —</option>` +
      _clients.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    if (selectedId) _onClientChange();
  }

  // ── Convert Proforma / Quotation → Invoice ───────────────
  async function convert(id) {
    const ok = await confirm('Convert this document to a Tax Invoice?', 'Convert to Invoice');
    if (!ok) return;
    const inv = _invoices.find(i => i.id === id);
    if (!inv) return;

    try {
      const r = await API.getNextInvNo('Invoice');
      await API.saveInvoice({
        ...inv,
        id:        inv.id,      // update same record
        docType:   'Invoice',
        invoiceNo: r.invoiceNo,
        status:    'Unpaid'
      });
      toast('✅ Converted to Invoice ' + r.invoiceNo, 'success');
      render();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  }

  // ── Save ─────────────────────────────────────────────────
  async function save() {
    const items = _getItems();
    if (!items.length || !items[0].description) { toast('Add at least one line item', 'warning'); return; }

    const clientSel = document.getElementById('b-client');
    const docType   = document.getElementById('b-doctype').value;

    const invDate   = document.getElementById('b-date').value;
    if (!invDate) { toast('Invoice date is required', 'warning'); return; }

    const clientId   = clientSel.value;
    const clientName = clientSel.options[clientSel.selectedIndex]?.text || '';
    if (!clientId) { toast('Please select a client', 'warning'); return; }

    const btn = document.querySelector('#modal-billing .btn-primary');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    try {
      const result = await API.saveInvoice({
        id:            _editId || null,
        docType,
        invoiceNo:     document.getElementById('b-no').value,
        invoiceDate:   invDate,
        orderNo:       document.getElementById('b-ordno').value,
        orderDate:     document.getElementById('b-orddate').value,
        clientId,
        clientName,
        clientGSTIN:   document.getElementById('b-gstin').value,
        clientAddress: document.getElementById('b-caddr').value,
        clientState:   document.getElementById('b-cstate').value,
        clientStateCode: stateCode(document.getElementById('b-cstate').value),
        placeOfSupply: document.getElementById('b-pos').value,
        gstRate:       document.getElementById('b-grate').value,
        notes:         document.getElementById('b-notes').value,
        status:        docType === 'Invoice' ? document.getElementById('b-status').value : 'NA',
        items
      });

      toast(`✅ ${docType} ${result.invoiceNo || ''} saved`, 'success');
      closeModal('modal-billing');
      render();
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = '💾 Save';
    }
  }

  // ── Print ─────────────────────────────────────────────────
  function print(id) {
    const inv = _invoices.find(i => i.id === id);
    if (inv) printInvoice(inv);
  }

  function _printCurrent() {
    const items = _getItems();
    const clientSel = document.getElementById('b-client');
    printInvoice({
      docType:       document.getElementById('b-doctype').value,
      invoiceNo:     document.getElementById('b-no').value,
      invoiceDate:   document.getElementById('b-date').value,
      orderNo:       document.getElementById('b-ordno').value,
      orderDate:     document.getElementById('b-orddate').value,
      clientName:    clientSel.options[clientSel.selectedIndex]?.text || '',
      clientGSTIN:   document.getElementById('b-gstin').value,
      clientAddress: document.getElementById('b-caddr').value,
      supplyType:    document.getElementById('b-stype').value,
      gstRate:       document.getElementById('b-grate').value,
      taxableValue:  items.reduce((s, i) => s + i.amount, 0),
      cgst:          document.getElementById('b-cgst').value,
      sgst:          document.getElementById('b-sgst').value,
      igst:          document.getElementById('b-igst').value,
      roundOff:      document.getElementById('b-roff').value,
      totalAmount:   document.getElementById('b-total').value,
      amountWords:   document.getElementById('b-words').value,
      notes:         document.getElementById('b-notes').value,
      items
    });
  }

  // ── Payment ──────────────────────────────────────────────
  let _payInvoiceId = null;

  function openPayment(id) {
    _payInvoiceId = id;
    const inv = _invoices.find(i => i.id === id);
    if (!inv) return;

    // Find outstanding record for this invoice
    document.getElementById('pay-invno').value   = inv.invoiceNo;
    document.getElementById('pay-balance').value = '—';
    document.getElementById('pay-amount').value  = '';
    document.getElementById('pay-date').value    = today();
    document.getElementById('pay-remarks').value = '';

    // Fetch outstanding to get balance
    API.getOutstanding().then(rows => {
      const rec = rows.find(r => r.invoiceId === id);
      if (rec) document.getElementById('pay-balance').value = fmtCur(rec.balance);
    });

    openModal('modal-payment');
  }

  async function savePayment() {
    const amount = parseFloat(document.getElementById('pay-amount').value);
    if (!amount || amount <= 0) { toast('Enter a valid payment amount', 'warning'); return; }

    const btn = document.querySelector('#modal-payment .btn-success');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    try {
      await API.recordPayment({ invoiceId: _payInvoiceId, amount });
      toast('✅ Payment recorded', 'success');
      closeModal('modal-payment');
      render();
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = '💰 Record Payment';
    }
  }

  // ── Delete ───────────────────────────────────────────────
  async function del(id) {
    const inv = _invoices.find(i => i.id === id);
    const ok  = await confirm(`Delete ${inv?.invoiceNo || 'this bill'}? This cannot be undone.`, 'Delete Bill');
    if (!ok) return;
    try {
      await API.deleteInvoice(id);
      toast('🗑 Bill deleted', 'success');
      render();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  }

  // ── GSTR-1 Excel Export ───────────────────────────────────
  function exportGSTR1() {
    const invs = _invoices.filter(i => (i.docType || 'Invoice') === 'Invoice');
    if (!invs.length) { toast('No Tax Invoices to export', 'warning'); return; }

    const XLSX = window.XLSX;
    if (!XLSX) { toast('Excel library not loaded', 'error'); return; }

    const wb = XLSX.utils.book_new();

    // B2B sheet
    const b2bRows = [['Invoice No','Invoice Date','Receiver Name','Receiver GSTIN','Place of Supply','Invoice Value','Taxable Value','GST Rate','IGST','CGST','SGST']];
    invs.filter(i => i.clientGSTIN).forEach(i =>
      b2bRows.push([i.invoiceNo, i.invoiceDate, i.clientName, i.clientGSTIN,
        i.placeOfSupply || i.clientState, i.totalAmount, i.taxableValue,
        (i.gstRate || '') + '%', i.igst || 0, i.cgst || 0, i.sgst || 0])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2bRows), 'B2B');

    // B2C sheet
    const b2cRows = [['Invoice No','Invoice Date','Client Name','Invoice Value','Taxable Value','GST Rate','CGST','SGST','IGST']];
    invs.filter(i => !i.clientGSTIN).forEach(i =>
      b2cRows.push([i.invoiceNo, i.invoiceDate, i.clientName, i.totalAmount,
        i.taxableValue, (i.gstRate||'') + '%', i.cgst||0, i.sgst||0, i.igst||0])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2cRows), 'B2C');

    // Rate-wise summary
    const rw = {};
    invs.forEach(i => {
      const r = i.gstRate || '18';
      if (!rw[r]) rw[r] = { taxable:0, cgst:0, sgst:0, igst:0 };
      rw[r].taxable += parseFloat(i.taxableValue)||0;
      rw[r].cgst    += parseFloat(i.cgst)||0;
      rw[r].sgst    += parseFloat(i.sgst)||0;
      rw[r].igst    += parseFloat(i.igst)||0;
    });
    const rwRows = [['GST Rate','Taxable Value','CGST','SGST','IGST','Total GST']];
    Object.entries(rw).sort((a,b)=>+a[0]-+b[0]).forEach(([r,v]) =>
      rwRows.push([r+'%', v.taxable, v.cgst, v.sgst, v.igst, v.cgst+v.sgst+v.igst])
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rwRows), 'Rate Summary');

    XLSX.writeFile(wb, `GSTR1_TheElementEnvironment_${getCurrentFY()}.xlsx`);
    toast('✅ GSTR-1 Excel downloaded', 'success');
  }

  // ── Public API ───────────────────────────────────────────
  return {
    render,
    openNew,
    openEdit,
    convert,
    save,
    print,
    delete:      del,
    openPayment,
    savePayment,
    exportGSTR1,
    // filter handlers (called from inline onclick)
    _setDocFilter,
    _setStatusFilter,
    _setSearch,
    _setDocType,
    _onClientChange,
    _addRow,
    _calcGST,
    _printCurrent
  };

})();
