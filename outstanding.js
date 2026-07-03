/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — outstanding.js
   ============================================================ */

'use strict';

const Outstanding = (() => {

  let _records  = [];
  let _filter   = { status: 'all', search: '' };

  async function render() {
    _records = await API.getOutstanding();
    _renderShell();
    _applyFilter();
    _ensureModal();
  }

  function _renderShell() {
    const el     = document.getElementById('content');
    const unpaid = _records.filter(r => r.status !== 'Paid');
    const total  = unpaid.reduce((s,r) => s + (parseFloat(r.balance)||0), 0);
    const over30 = unpaid.filter(r => (parseInt(r.daysOutstanding)||0) > 30).reduce((s,r)=>s+(parseFloat(r.balance)||0),0);
    const over60 = unpaid.filter(r => (parseInt(r.daysOutstanding)||0) > 60).reduce((s,r)=>s+(parseFloat(r.balance)||0),0);
    const over90 = unpaid.filter(r => (parseInt(r.daysOutstanding)||0) > 90).reduce((s,r)=>s+(parseFloat(r.balance)||0),0);

    el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card" style="--c:var(--red)">
        <div class="s-icon">💰</div>
        <div class="s-label">Total Receivable</div>
        <div class="s-value" style="color:var(--red)">${fmtCur(total)}</div>
        <div class="s-sub">${unpaid.length} invoice${unpaid.length!==1?'s':''}</div>
      </div>
      <div class="stat-card" style="--c:var(--yellow)">
        <div class="s-icon">⏱️</div>
        <div class="s-label">31–60 Days</div>
        <div class="s-value" style="color:var(--yellow)">${fmtCur(over30 - over60)}</div>
        <div class="s-sub">${unpaid.filter(r=>(parseInt(r.daysOutstanding)||0)>30&&(parseInt(r.daysOutstanding)||0)<=60).length} invoices</div>
      </div>
      <div class="stat-card" style="--c:var(--orange)">
        <div class="s-icon">⚠️</div>
        <div class="s-label">61–90 Days</div>
        <div class="s-value" style="color:var(--orange)">${fmtCur(over60 - over90)}</div>
        <div class="s-sub">${unpaid.filter(r=>(parseInt(r.daysOutstanding)||0)>60&&(parseInt(r.daysOutstanding)||0)<=90).length} invoices</div>
      </div>
      <div class="stat-card" style="--c:var(--red)">
        <div class="s-icon">🚨</div>
        <div class="s-label">90+ Days</div>
        <div class="s-value" style="color:var(--red)">${fmtCur(over90)}</div>
        <div class="s-sub">${unpaid.filter(r=>(parseInt(r.daysOutstanding)||0)>90).length} invoices</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Outstanding Receivables</h2>
        <div class="card-actions">
          <select class="form-control" style="width:auto;padding:6px 10px" onchange="Outstanding._setStatus(this.value)">
            <option value="all">All</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partial">Partial</option>
            <option value="Paid">Paid</option>
          </select>
          <input class="form-control" style="width:180px;padding:6px 10px" type="text"
            placeholder="Search client…" oninput="Outstanding._setSearch(this.value)"/>
          <button class="btn btn-outline np" onclick="Outstanding.exportData()">⬇️ Export</button>
        </div>
      </div>
      <div id="out-table-wrap"></div>
    </div>`;
  }

  function _applyFilter() {
    let list = [..._records];
    if (_filter.status !== 'all') list = list.filter(r => r.status === _filter.status);
    if (_filter.search) {
      const q = _filter.search.toLowerCase();
      list = list.filter(r =>
        (r.clientName || '').toLowerCase().includes(q) ||
        (r.invoiceNo  || '').toLowerCase().includes(q)
      );
    }
    list.sort((a,b) => (parseFloat(b.balance)||0) - (parseFloat(a.balance)||0));
    _renderTable(list);
  }

  function _renderTable(list) {
    const wrap = document.getElementById('out-table-wrap');
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state"><span class="es-icon">✅</span>
        <h3>All Clear!</h3><p>No outstanding receivables.</p></div>`;
      return;
    }
    wrap.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Invoice No.</th><th>Client</th><th>Invoice Date</th>
        <th>Amount</th><th>Received</th><th>Balance</th>
        <th>Days</th><th>Status</th><th class="np">Actions</th>
      </tr></thead>
      <tbody>
        ${list.map(r => {
          const days = parseInt(r.daysOutstanding) || 0;
          return `<tr>
            <td style="font-weight:700;font-size:12px;font-family:monospace">${esc(r.invoiceNo)}</td>
            <td style="font-weight:600">${trunc(r.clientName,24)}</td>
            <td>${fmtDate(r.invoiceDate)}</td>
            <td>${fmtCur(r.totalAmount)}</td>
            <td style="color:var(--green);font-weight:600">${fmtCur(r.received)}</td>
            <td style="font-weight:800;color:${parseFloat(r.balance)>0?'var(--red)':'var(--green)'}">${fmtCur(r.balance)}</td>
            <td>${ageBadge(days)}</td>
            <td>${badge(r.status)}</td>
            <td class="np" style="white-space:nowrap">
              ${r.status !== 'Paid'
                ? `<button class="btn btn-success btn-sm" onclick="Outstanding.openPayment('${r.id}','${r.invoiceId}','${esc(r.invoiceNo)}',${parseFloat(r.balance)||0})">💰 Pay</button>`
                : `<span style="color:var(--muted);font-size:11px">Paid ✓</span>`
              }
            </td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="3">Total</td>
        <td>${fmtCur(list.reduce((s,r)=>s+(parseFloat(r.totalAmount)||0),0))}</td>
        <td>${fmtCur(list.reduce((s,r)=>s+(parseFloat(r.received)||0),0))}</td>
        <td>${fmtCur(list.reduce((s,r)=>s+(parseFloat(r.balance)||0),0))}</td>
        <td colspan="3"></td>
      </tr></tfoot>
    </table></div>`;
  }

  function _ensureModal() {
    if (document.getElementById('modal-out-payment')) return;
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal-overlay" id="modal-out-payment">
      <div class="modal modal-sm">
        <div class="modal-header">
          <h3>Record Payment</h3>
          <button class="modal-close" onclick="closeModal('modal-out-payment')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full"><label>Invoice</label><input class="form-control" id="op-invno" readonly/></div>
            <div class="form-group full"><label>Outstanding Balance</label><input class="form-control" id="op-balance" readonly style="font-weight:700;color:var(--red)"/></div>
            <div class="form-group full"><label>Amount Received (₹) <span class="req">*</span></label><input class="form-control" id="op-amount" type="number" step="0.01" min="0" placeholder="0.00"/></div>
            <div class="form-group full"><label>Payment Date</label><input class="form-control" id="op-date" type="date"/></div>
            <div class="form-group full"><label>Remarks</label><input class="form-control" id="op-remarks" placeholder="NEFT / Cheque / UPI ref no."/></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeModal('modal-out-payment')">Cancel</button>
          <button class="btn btn-success" onclick="Outstanding.savePayment()">💰 Record</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div);
  }

  let _payInvId = null;

  function openPayment(recId, invoiceId, invoiceNo, balance) {
    _payInvId = invoiceId;
    document.getElementById('op-invno').value   = invoiceNo;
    document.getElementById('op-balance').value = fmtCur(balance);
    document.getElementById('op-amount').value  = '';
    document.getElementById('op-date').value    = today();
    document.getElementById('op-remarks').value = '';
    openModal('modal-out-payment');
  }

  async function savePayment() {
    const amt = parseFloat(document.getElementById('op-amount').value);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'warning'); return; }
    const btn = document.querySelector('#modal-out-payment .btn-success');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await API.recordPayment({ invoiceId: _payInvId, amount: amt });
      toast('✅ Payment recorded', 'success');
      closeModal('modal-out-payment');
      render();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '💰 Record'; }
  }

  function exportData() {
    if (!_records.length) { toast('No data to export', 'warning'); return; }
    const rows = [['Invoice No','Client','Invoice Date','Total Amount','Received','Balance','Days Outstanding','Status']];
    _records.forEach(r => rows.push([r.invoiceNo,r.clientName,r.invoiceDate,r.totalAmount,r.received,r.balance,r.daysOutstanding,r.status]));
    exportExcel(rows, 'Outstanding', `Outstanding_${getCurrentFY()}.xlsx`);
  }

  function _setStatus(v) { _filter.status = v; _applyFilter(); }
  function _setSearch(q) { _filter.search = q; _applyFilter(); }

  return { render, openPayment, savePayment, exportData, _setStatus, _setSearch };
})();
