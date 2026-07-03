/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — gstr2a.js
   ============================================================ */

'use strict';

const Gstr2a = (() => {

  let _records = [];
  let _filter  = { status: 'all', search: '' };

  const STATUS_OPTIONS = [
    { value: 'Pending',        label: 'Pending',         icon: '⏳', badge: 'badge-yellow'  },
    { value: 'Matched',        label: 'Matched',         icon: '✅', badge: 'badge-green'   },
    { value: 'Mismatch',       label: 'Mismatch',        icon: '❌', badge: 'badge-red'     },
    { value: 'Not Available',  label: 'Not Available',   icon: '🚫', badge: 'badge-orange'  },
    { value: 'Ineligible ITC', label: 'Ineligible ITC',  icon: '🔒', badge: 'badge-purple'  },
  ];

  async function render() {
    _records = await API.getGSTR2A();
    _renderShell();
    _applyFilter();
  }

  function _renderShell() {
    const el      = document.getElementById('content');
    const matched = _records.filter(r => r.status === 'Matched');
    const pending = _records.filter(r => r.status === 'Pending' || !r.status);
    const mismat  = _records.filter(r => r.status === 'Mismatch');
    const inelig  = _records.filter(r => r.status === 'Ineligible ITC');
    const itcAvail= matched.reduce((s,r) => s + (parseFloat(r.gstAmount)||0), 0);
    const itcPend = pending.reduce((s,r) => s + (parseFloat(r.gstAmount)||0), 0);

    el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card" style="--c:var(--navy-400)">
        <div class="s-icon">🔍</div>
        <div class="s-label">Total Records</div>
        <div class="s-value">${_records.length}</div>
        <div class="s-sub">Auto-added from purchases</div>
      </div>
      <div class="stat-card" style="--c:var(--green)">
        <div class="s-icon">✅</div>
        <div class="s-label">Matched — ITC Available</div>
        <div class="s-value" style="color:var(--green)">${fmtCur(itcAvail)}</div>
        <div class="s-sub">${matched.length} invoices</div>
      </div>
      <div class="stat-card" style="--c:var(--yellow)">
        <div class="s-icon">⏳</div>
        <div class="s-label">Pending Verification</div>
        <div class="s-value" style="color:var(--yellow)">${fmtCur(itcPend)}</div>
        <div class="s-sub">${pending.length} invoices</div>
      </div>
      <div class="stat-card" style="--c:var(--red)">
        <div class="s-icon">⚠️</div>
        <div class="s-label">Mismatch / Ineligible</div>
        <div class="s-value" style="color:var(--red)">${mismat.length + inelig.length}</div>
        <div class="s-sub">${fmtCur((mismat.concat(inelig)).reduce((s,r)=>s+(parseFloat(r.gstAmount)||0),0))}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>GSTR-2A Matching</h2>
        <div class="card-actions">
          <div class="pill-group">
            ${['all','Pending','Matched','Mismatch','Not Available','Ineligible ITC'].map((s,i) =>
              `<button class="pill-btn ${i===0?'active':''}" id="g2a-pill-${s.replace(/\s/g,'_')}"
                onclick="Gstr2a._setFilter('${s}')">${i===0?'All':s}</button>`
            ).join('')}
          </div>
          <input class="form-control" style="width:180px;padding:6px 10px" type="text"
            placeholder="Search vendor…" oninput="Gstr2a._setSearch(this.value)"/>
          <button class="btn btn-outline np" onclick="Gstr2a.exportData()">⬇️ Export</button>
        </div>
      </div>
      <div style="padding:8px 0 12px;font-size:12px;color:var(--muted)">
        💡 Every GST purchase with a GSTIN is auto-added here. Use <strong>Change Status</strong> to mark each invoice after checking on the GST portal.
      </div>
      <div id="g2a-table-wrap"></div>
    </div>

    <!-- ITC Summary -->
    <div class="card">
      <div class="card-header"><h2>ITC Summary</h2></div>
      <div class="gst3b-grid">
        <div class="gst3b-box">
          <h3>✅ Eligible ITC (Matched)</h3>
          ${_itcBox(matched)}
        </div>
        <div class="gst3b-box">
          <h3>⏳ Pending ITC</h3>
          ${_itcBox(pending)}
        </div>
      </div>
    </div>`;
  }

  function _itcBox(rows) {
    const cgst = rows.reduce((s,r)=>s+(parseFloat(r.cgst)||0),0);
    const sgst = rows.reduce((s,r)=>s+(parseFloat(r.sgst)||0),0);
    const igst = rows.reduce((s,r)=>s+(parseFloat(r.igst)||0),0);
    return `
      <div class="gst3b-row"><span>CGST</span><span>${fmtCur(cgst)}</span></div>
      <div class="gst3b-row"><span>SGST</span><span>${fmtCur(sgst)}</span></div>
      <div class="gst3b-row"><span>IGST</span><span>${fmtCur(igst)}</span></div>
      <div class="gst3b-row"><span>Total ITC</span><span>${fmtCur(cgst+sgst+igst)}</span></div>`;
  }

  function _applyFilter() {
    let list = [..._records];
    if (_filter.status !== 'all') list = list.filter(r => (r.status||'Pending') === _filter.status);
    if (_filter.search) {
      const q = _filter.search.toLowerCase();
      list = list.filter(r =>
        (r.vendorName  || '').toLowerCase().includes(q) ||
        (r.vendorGSTIN || '').toLowerCase().includes(q) ||
        (r.invoiceNo   || '').toLowerCase().includes(q)
      );
    }
    list.sort((a,b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
    _renderTable(list);

    // Sync pills
    ['all','Pending','Matched','Mismatch','Not Available','Ineligible ITC'].forEach(s => {
      const el = document.getElementById('g2a-pill-' + s.replace(/\s/g,'_'));
      if (el) el.classList.toggle('active', _filter.status === s);
    });
  }

  function _renderTable(list) {
    const wrap = document.getElementById('g2a-table-wrap');
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state">
        <span class="es-icon">🔍</span>
        <h3>No records</h3>
        <p>Add purchases with a GSTIN to populate this list automatically.</p>
      </div>`;
      return;
    }
    wrap.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Vendor Name</th><th>GSTIN</th><th>Inv No.</th><th>Inv Date</th>
        <th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total GST</th>
        <th>Status</th><th>Updated By</th><th>Updated On</th><th class="np">Action</th>
      </tr></thead>
      <tbody>
        ${list.map(r => {
          const st  = r.status || 'Pending';
          const opt = STATUS_OPTIONS.find(o => o.value === st) || STATUS_OPTIONS[0];
          return `<tr style="background:${st==='Matched'?'#F0FDF4':st==='Mismatch'||st==='Ineligible ITC'?'#FFF7ED':''}">
            <td style="font-weight:600">${trunc(r.vendorName,22)}</td>
            <td style="font-family:monospace;font-size:11px">${r.vendorGSTIN||'—'}</td>
            <td style="font-size:11.5px">${esc(r.invoiceNo||'—')}</td>
            <td style="white-space:nowrap">${fmtDate(r.invoiceDate)}</td>
            <td>${fmtCur(r.taxableValue)}</td>
            <td>${fmtCur(r.cgst)}</td>
            <td>${fmtCur(r.sgst)}</td>
            <td>${fmtCur(r.igst)}</td>
            <td style="font-weight:700">${fmtCur(r.gstAmount)}</td>
            <td><span class="badge ${opt.badge}">${opt.icon} ${st}</span></td>
            <td style="font-size:11px;color:var(--muted)">${r.updatedBy||'—'}</td>
            <td style="font-size:11px;color:var(--muted)">${r.updatedOn?fmtDate(r.updatedOn):'—'}</td>
            <td class="np">
              <button class="btn btn-outline btn-sm"
                onclick="Gstr2a._openStatusMenu(this,'${r.id}','${st}')">
                Change Status ▾
              </button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }

  function _openStatusMenu(btn, id, current) {
    showStatusPopup(btn,
      STATUS_OPTIONS.map(o => ({ ...o, label: (o.value === current ? '✓ ' : '    ') + o.label })),
      async (value) => {
        if (value === current) return;
        try {
          await API.updateGSTR2A({ id, status: value });
          toast(`✅ Status updated to "${value}"`, 'success');
          render();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
      }
    );
  }

  function _setFilter(s) { _filter.status = s; _applyFilter(); }
  function _setSearch(q) { _filter.search = q; _applyFilter(); }

  function exportData() {
    if (!_records.length) { toast('No data to export', 'warning'); return; }
    const rows = [['Vendor Name','Vendor GSTIN','Invoice No','Invoice Date','Taxable Value','CGST','SGST','IGST','Total GST','Status','Updated By','Updated On']];
    _records.forEach(r => rows.push([r.vendorName,r.vendorGSTIN||'',r.invoiceNo||'',r.invoiceDate,r.taxableValue,r.cgst||0,r.sgst||0,r.igst||0,r.gstAmount||0,r.status||'Pending',r.updatedBy||'',r.updatedOn||'']));
    exportExcel(rows, 'GSTR2A', `GSTR2A_Matching_${getCurrentFY()}.xlsx`);
  }

  return { render, exportData, _setFilter, _setSearch, _openStatusMenu };
})();
