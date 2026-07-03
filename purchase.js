/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — purchase.js
   ============================================================ */

'use strict';

const Purchase = (() => {

  // ── State ────────────────────────────────────────────────
  let _purchases = [];
  let _editId    = null;
  let _filter    = { category: 'all', status: 'all', search: '' };

  // ── Render ───────────────────────────────────────────────
  async function render() {
    _purchases = await API.getPurchases();
    _renderShell();
    _applyFilter();
    _ensureModal();
  }

  function _renderShell() {
    const el = document.getElementById('content');

    const total    = _purchases.reduce((s,p) => s + (parseFloat(p.totalAmount)||0), 0);
    const totGST   = _purchases.reduce((s,p) => s + (parseFloat(p.cgst)||0) + (parseFloat(p.sgst)||0) + (parseFloat(p.igst)||0), 0);
    const unpaid   = _purchases.filter(p => p.paymentStatus === 'Unpaid').reduce((s,p) => s + (parseFloat(p.totalAmount)||0), 0);
    const withGST  = _purchases.filter(p => parseFloat(p.gstRate) > 0).length;

    // Category breakdown
    const cats = {};
    _purchases.forEach(p => {
      const c = p.expenseCategory || 'Other';
      cats[c] = (cats[c] || 0) + (parseFloat(p.totalAmount) || 0);
    });
    const topCat = Object.entries(cats).sort((a,b) => b[1]-a[1]).slice(0,1)[0];

    el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card" style="--c:var(--orange)">
        <div class="s-icon">🛒</div>
        <div class="s-label">Total Purchases</div>
        <div class="s-value">${fmtCur(total)}</div>
        <div class="s-sub">${_purchases.length} entr${_purchases.length!==1?'ies':'y'}</div>
      </div>
      <div class="stat-card" style="--c:var(--navy-400)">
        <div class="s-icon">🧾</div>
        <div class="s-label">Total ITC (GST Paid)</div>
        <div class="s-value">${fmtCur(totGST)}</div>
        <div class="s-sub">${withGST} GST invoice${withGST!==1?'s':''} → GSTR-2A</div>
      </div>
      <div class="stat-card" style="--c:var(--red)">
        <div class="s-icon">⏳</div>
        <div class="s-label">Payables Outstanding</div>
        <div class="s-value" style="color:var(--red)">${fmtCur(unpaid)}</div>
        <div class="s-sub">${_purchases.filter(p=>p.paymentStatus==='Unpaid').length} unpaid</div>
      </div>
      <div class="stat-card" style="--c:var(--purple)">
        <div class="s-icon">📂</div>
        <div class="s-label">Top Expense Head</div>
        <div class="s-value" style="font-size:14px">${topCat ? topCat[0] : '—'}</div>
        <div class="s-sub">${topCat ? fmtCur(topCat[1]) : ''}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Purchases & Expenses</h2>
        <div class="card-actions">
          <select class="form-control" style="width:auto;padding:6px 10px" id="pur-cat-filter"
            onchange="Purchase._setCatFilter(this.value)">
            <option value="all">All Categories</option>
            ${EXPENSE_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}
          </select>
          <select class="form-control" style="width:auto;padding:6px 10px" id="pur-status-filter"
            onchange="Purchase._setStatusFilter(this.value)">
            <option value="all">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>
          <input class="form-control" style="width:180px;padding:6px 10px" type="text"
            placeholder="Search…" id="pur-search"
            oninput="Purchase._setSearch(this.value)"/>
          <button class="btn btn-outline np" onclick="Purchase.exportExcelData()">⬇️ Export</button>
          <button class="btn btn-primary np" onclick="Purchase.openNew()">+ Add Purchase</button>
        </div>
      </div>
      <div id="pur-table-wrap"></div>
    </div>

    <!-- Category breakdown -->
    <div class="card">
      <div class="card-header"><h2>📂 Expense Category Breakdown</h2></div>
      <div id="cat-breakdown"></div>
    </div>`;

    _renderCategoryBreakdown();
  }

  function _applyFilter() {
    let list = [..._purchases];
    if (_filter.category !== 'all') list = list.filter(p => p.expenseCategory === _filter.category);
    if (_filter.status   !== 'all') list = list.filter(p => p.paymentStatus   === _filter.status);
    if (_filter.search) {
      const q = _filter.search.toLowerCase();
      list = list.filter(p =>
        (p.vendorName      || '').toLowerCase().includes(q) ||
        (p.vendorInvoiceNo || '').toLowerCase().includes(q) ||
        (p.vendorGSTIN     || '').toLowerCase().includes(q) ||
        (p.description     || '').toLowerCase().includes(q)
      );
    }
    list.sort((a,b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
    _renderTable(list);
  }

  function _renderTable(list) {
    const wrap = document.getElementById('pur-table-wrap');
    if (!wrap) return;

    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-state">
        <span class="es-icon">🛒</span>
        <h3>No purchases found</h3>
        <p>Add your first purchase or expense entry.</p>
        <button class="btn btn-primary np" onclick="Purchase.openNew()">+ Add Purchase</button>
      </div>`;
      return;
    }

    wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Vendor</th>
            <th>GSTIN</th>
            <th>Inv No.</th>
            <th>Category</th>
            <th>Taxable</th>
            <th>GST</th>
            <th>Total</th>
            <th>2A Status</th>
            <th>Pmt</th>
            <th class="np">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(p => {
            const gst = (parseFloat(p.cgst)||0) + (parseFloat(p.sgst)||0) + (parseFloat(p.igst)||0);
            const has2a = parseFloat(p.gstRate) > 0 && p.vendorGSTIN;
            return `<tr>
              <td style="white-space:nowrap">${fmtDate(p.purchaseDate)}</td>
              <td style="font-weight:600">${trunc(p.vendorName, 22)}</td>
              <td style="font-size:11px;font-family:monospace;color:var(--muted)">${p.vendorGSTIN || '—'}</td>
              <td style="font-size:11.5px">${esc(p.vendorInvoiceNo || '—')}</td>
              <td><span class="badge badge-gray">${esc(p.expenseCategory || '—')}</span></td>
              <td>${fmtCur(p.taxableValue)}</td>
              <td>${gst > 0 ? fmtCur(gst) : '<span style="color:var(--muted)">—</span>'}</td>
              <td style="font-weight:700">${fmtCur(p.totalAmount)}</td>
              <td>${has2a ? _gstr2aBadge(p.gstr2aStatus) : '<span style="color:var(--muted);font-size:11px">N/A</span>'}</td>
              <td>${badge(p.paymentStatus || 'Unpaid')}</td>
              <td class="np" style="white-space:nowrap">
                <button class="btn btn-ghost btn-icon btn-sm" title="Edit"   onclick="Purchase.openEdit('${p.id}')">✏️</button>
                <button class="btn btn-danger btn-icon btn-sm" title="Delete" onclick="Purchase.delete('${p.id}')">🗑</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5">Total (${list.length} records)</td>
            <td>${fmtCur(list.reduce((s,p)=>s+(parseFloat(p.taxableValue)||0),0))}</td>
            <td>${fmtCur(list.reduce((s,p)=>s+(parseFloat(p.cgst)||0)+(parseFloat(p.sgst)||0)+(parseFloat(p.igst)||0),0))}</td>
            <td>${fmtCur(list.reduce((s,p)=>s+(parseFloat(p.totalAmount)||0),0))}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }

  function _gstr2aBadge(status) {
    const map = {
      'Matched':       'badge-green',
      'Pending':       'badge-yellow',
      'Mismatch':      'badge-red',
      'Not Available': 'badge-orange',
      'Ineligible ITC':'badge-purple'
    };
    const s = status || 'Pending';
    return `<span class="badge ${map[s] || 'badge-gray'}">${s}</span>`;
  }

  function _renderCategoryBreakdown() {
    const wrap = document.getElementById('cat-breakdown');
    if (!wrap) return;

    const cats = {};
    _purchases.forEach(p => {
      const c = p.expenseCategory || 'Other';
      if (!cats[c]) cats[c] = { total: 0, gst: 0, count: 0 };
      cats[c].total += parseFloat(p.totalAmount) || 0;
      cats[c].gst   += (parseFloat(p.cgst)||0) + (parseFloat(p.sgst)||0) + (parseFloat(p.igst)||0);
      cats[c].count++;
    });

    const sorted = Object.entries(cats).sort((a,b) => b[1].total - a[1].total);
    if (!sorted.length) {
      wrap.innerHTML = `<div class="table-empty">No data yet</div>`;
      return;
    }

    const grandTotal = sorted.reduce((s,[,v]) => s + v.total, 0);

    wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Category</th><th>Entries</th><th>Taxable</th><th>GST</th><th>Total</th><th>% of Spend</th></tr>
        </thead>
        <tbody>
          ${sorted.map(([cat, v]) => {
            const pct = grandTotal > 0 ? ((v.total / grandTotal) * 100).toFixed(1) : 0;
            return `<tr>
              <td style="font-weight:600">${esc(cat)}</td>
              <td>${v.count}</td>
              <td>${fmtCur(v.total - v.gst)}</td>
              <td>${fmtCur(v.gst)}</td>
              <td style="font-weight:700">${fmtCur(v.total)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="flex:1;height:6px;background:var(--border);border-radius:99px;min-width:60px">
                    <div style="width:${pct}%;height:100%;background:var(--navy-400);border-radius:99px"></div>
                  </div>
                  <span style="font-size:11px;color:var(--muted);width:36px">${pct}%</span>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>${_purchases.length}</td>
            <td>${fmtCur(sorted.reduce((s,[,v])=>s+v.total-v.gst,0))}</td>
            <td>${fmtCur(sorted.reduce((s,[,v])=>s+v.gst,0))}</td>
            <td>${fmtCur(grandTotal)}</td>
            <td>100%</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  }

  // ── Filter handlers ──────────────────────────────────────
  function _setCatFilter(v)    { _filter.category = v; _applyFilter(); }
  function _setStatusFilter(v) { _filter.status   = v; _applyFilter(); }
  function _setSearch(q)       { _filter.search   = q; _applyFilter(); }

  // ── Modal ────────────────────────────────────────────────
  function _ensureModal() {
    if (document.getElementById('modal-purchase')) return;

    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal-overlay" id="modal-purchase">
      <div class="modal">
        <div class="modal-header">
          <h3 id="pur-modal-title">Add Purchase</h3>
          <button class="modal-close" onclick="closeModal('modal-purchase')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">

            <div class="form-section">Vendor Details</div>
            <div class="form-group">
              <label>Vendor / Supplier Name <span class="req">*</span></label>
              <input class="form-control" id="p-vendor" placeholder="Vendor name"/>
            </div>
            <div class="form-group">
              <label>Vendor GSTIN</label>
              <input class="form-control" id="p-gstin" placeholder="27AAAAA0000A1Z5"
                oninput="this.value=this.value.toUpperCase()"
                onblur="Purchase._onGSTINBlur()"/>
              <span class="form-hint">Required for GSTR-2A matching</span>
            </div>
            <div class="form-group">
              <label>Vendor Invoice No.</label>
              <input class="form-control" id="p-invno" placeholder="Vendor's bill number"/>
            </div>
            <div class="form-group">
              <label>Invoice Date <span class="req">*</span></label>
              <input class="form-control" id="p-date" type="date"/>
            </div>

            <div class="form-section">Purchase Details</div>
            <div class="form-group full">
              <label>Description</label>
              <textarea class="form-control" id="p-desc" rows="2"
                placeholder="Description of goods / services purchased"></textarea>
            </div>
            <div class="form-group">
              <label>Expense Category <span class="req">*</span></label>
              <select class="form-control" id="p-cat">
                ${EXPENSE_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Payment Status</label>
              <select class="form-control" id="p-pmtst">
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            <div class="form-section">GST Details</div>
            <div class="form-group">
              <label>Taxable Value (₹) <span class="req">*</span></label>
              <input class="form-control" id="p-taxable" type="number" step="0.01"
                placeholder="0.00" oninput="Purchase._calcPur()"/>
            </div>
            <div class="form-group">
              <label>GST Rate (%)</label>
              <select class="form-control" id="p-grate" onchange="Purchase._calcPur()">
                ${gstRateOptions('18')}
              </select>
            </div>
            <div class="form-group">
              <label>CGST (₹)</label>
              <input class="form-control" id="p-cgst" readonly/>
            </div>
            <div class="form-group">
              <label>SGST (₹)</label>
              <input class="form-control" id="p-sgst" readonly/>
            </div>
            <div class="form-group">
              <label>IGST (₹)</label>
              <input class="form-control" id="p-igst" readonly/>
            </div>
            <div class="form-group">
              <label>Total Amount (₹)</label>
              <input class="form-control" id="p-total" readonly
                style="font-weight:800;font-size:14px"/>
            </div>

            <div class="form-section">Additional</div>
            <div class="form-group full">
              <label>Attachment URL (Drive / Doc link)</label>
              <input class="form-control" id="p-attach"
                placeholder="Paste Google Drive link to scanned bill"/>
            </div>

            <!-- GSTR-2A auto note -->
            <div class="form-group full" id="gstr2a-note" style="display:none">
              <div style="padding:10px 14px;background:#DBEAFE;border-radius:var(--radius-sm);
                font-size:12px;color:var(--navy-600);display:flex;align-items:center;gap:8px">
                <span>🔍</span>
                <span>This purchase has a GSTIN and GST rate — it will automatically appear in
                <strong>GSTR-2A Matching</strong> for reconciliation.</span>
              </div>
            </div>

          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeModal('modal-purchase')">Cancel</button>
          <button class="btn btn-primary" onclick="Purchase.save()">💾 Save Purchase</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div);
  }

  // ── GST Calc ─────────────────────────────────────────────
  function _calcPur() {
    const taxable = parseFloat(document.getElementById('p-taxable')?.value) || 0;
    const rate    = parseFloat(document.getElementById('p-grate')?.value)   || 0;
    const gst     = taxable * rate / 100;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v.toFixed(2);
    };
    // Assume intra-state for purchases (CGST + SGST)
    set('p-cgst',  gst / 2);
    set('p-sgst',  gst / 2);
    set('p-igst',  0);
    set('p-total', taxable + gst);

    // Show 2A note if GSTIN entered and rate > 0
    _toggle2ANote();
  }

  function _onGSTINBlur() { _toggle2ANote(); }

  function _toggle2ANote() {
    const gstin  = document.getElementById('p-gstin')?.value || '';
    const rate   = parseFloat(document.getElementById('p-grate')?.value) || 0;
    const note   = document.getElementById('gstr2a-note');
    if (note) note.style.display = (gstin && rate > 0) ? '' : 'none';
  }

  // ── Open New / Edit ──────────────────────────────────────
  function openNew() {
    _editId = null;
    _resetModal();
    document.getElementById('pur-modal-title').textContent = 'Add Purchase';
    document.getElementById('p-date').value = today();
    openModal('modal-purchase');
  }

  function openEdit(id) {
    _editId = id;
    const p = _purchases.find(x => x.id === id);
    if (!p) return;

    _resetModal();
    document.getElementById('pur-modal-title').textContent = 'Edit Purchase';
    document.getElementById('p-vendor').value  = p.vendorName      || '';
    document.getElementById('p-gstin').value   = p.vendorGSTIN     || '';
    document.getElementById('p-invno').value   = p.vendorInvoiceNo || '';
    document.getElementById('p-date').value    = p.purchaseDate    || '';
    document.getElementById('p-desc').value    = p.description     || '';
    document.getElementById('p-cat').value     = p.expenseCategory || 'Other';
    document.getElementById('p-pmtst').value   = p.paymentStatus   || 'Unpaid';
    document.getElementById('p-taxable').value = p.taxableValue    || '';
    document.getElementById('p-grate').value   = p.gstRate         || '18';
    document.getElementById('p-attach').value  = p.attachmentUrl   || '';
    _calcPur();
    openModal('modal-purchase');
  }

  function _resetModal() {
    ['p-vendor','p-gstin','p-invno','p-date','p-desc','p-taxable',
     'p-cgst','p-sgst','p-igst','p-total','p-attach'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('p-grate').value  = '18';
    document.getElementById('p-pmtst').value  = 'Unpaid';
    document.getElementById('p-cat').value    = EXPENSE_CATEGORIES[0];
    const note = document.getElementById('gstr2a-note');
    if (note) note.style.display = 'none';
  }

  // ── Save ─────────────────────────────────────────────────
  async function save() {
    const vendor  = document.getElementById('p-vendor').value.trim();
    const date    = document.getElementById('p-date').value;
    const taxable = document.getElementById('p-taxable').value;

    if (!vendor)  { toast('Vendor name is required', 'warning');  return; }
    if (!date)    { toast('Invoice date is required', 'warning');  return; }
    if (!taxable) { toast('Taxable value is required', 'warning'); return; }

    const btn = document.querySelector('#modal-purchase .btn-primary');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    try {
      await API.savePurchase({
        id:              _editId || null,
        vendorName:      vendor,
        vendorGSTIN:     document.getElementById('p-gstin').value.toUpperCase(),
        vendorInvoiceNo: document.getElementById('p-invno').value,
        purchaseDate:    date,
        description:     document.getElementById('p-desc').value,
        expenseCategory: document.getElementById('p-cat').value,
        paymentStatus:   document.getElementById('p-pmtst').value,
        taxableValue:    taxable,
        gstRate:         document.getElementById('p-grate').value,
        attachmentUrl:   document.getElementById('p-attach').value
      });

      toast('✅ Purchase saved — auto-added to GSTR-2A Matching', 'success');
      closeModal('modal-purchase');
      render();
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = '💾 Save Purchase';
    }
  }

  // ── Delete ───────────────────────────────────────────────
  async function del(id) {
    const p  = _purchases.find(x => x.id === id);
    const ok = await confirm(
      `Delete purchase from "${p?.vendorName || 'this vendor'}"? This will also remove it from GSTR-2A matching.`,
      'Delete Purchase'
    );
    if (!ok) return;
    try {
      await API.deletePurchase(id);
      toast('🗑 Purchase deleted', 'success');
      render();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  }

  // ── Excel Export ─────────────────────────────────────────
  function exportExcelData() {
    if (!_purchases.length) { toast('No purchases to export', 'warning'); return; }
    const rows = [[
      'Date','Vendor Name','Vendor GSTIN','Vendor Invoice No','Category',
      'Description','Taxable Value','GST Rate%','CGST','SGST','IGST',
      'Total Amount','Payment Status','GSTR-2A Status'
    ]];
    [..._purchases]
      .sort((a,b) => new Date(a.purchaseDate) - new Date(b.purchaseDate))
      .forEach(p => rows.push([
        p.purchaseDate, p.vendorName, p.vendorGSTIN || '', p.vendorInvoiceNo || '',
        p.expenseCategory || '', p.description || '',
        p.taxableValue, (p.gstRate || '0') + '%',
        p.cgst || 0, p.sgst || 0, p.igst || 0,
        p.totalAmount, p.paymentStatus || '',
        p.gstr2aStatus || 'Pending'
      ]));
    exportExcel(rows, 'Purchases', `PurchaseRegister_${getCurrentFY()}.xlsx`);
  }

  // ── Public ───────────────────────────────────────────────
  return {
    render,
    openNew,
    openEdit,
    save,
    delete:         del,
    exportExcelData,
    _setCatFilter,
    _setStatusFilter,
    _setSearch,
    _calcPur,
    _onGSTINBlur
  };

})();
