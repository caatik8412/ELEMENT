/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — reports.js
   ============================================================ */

'use strict';

const Reports = (() => {

  let _activeReport = 'sales';
  let _from = '', _to = '';

  async function render() {
    const now  = new Date();
    const y    = now.getFullYear();
    const m    = now.getMonth() + 1;
    _from = m >= 4 ? `${y}-04-01` : `${y-1}-04-01`;
    _to   = today();

    document.getElementById('content').innerHTML = `
    <div class="card" style="padding:14px 20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="pill-group">
          ${[
            ['sales','Sales Register'],['purchase','Purchase Register'],
            ['gst','GST Summary'],['outstanding','Outstanding'],
            ['pfReg','PF Register'],['esiReg','ESI Register']
          ].map(([k,l])=>`<button class="pill-btn ${k===_activeReport?'active':''}"
            id="rep-pill-${k}" onclick="Reports._setReport('${k}')">${l}</button>`).join('')}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap">
        <label style="font-size:11px;font-weight:700;color:var(--muted)">FROM</label>
        <input class="form-control" style="width:150px;padding:6px 10px" type="date" id="rep-from" value="${_from}" onchange="Reports._onDateChange()"/>
        <label style="font-size:11px;font-weight:700;color:var(--muted)">TO</label>
        <input class="form-control" style="width:150px;padding:6px 10px" type="date" id="rep-to" value="${_to}" onchange="Reports._onDateChange()"/>
        <button class="btn btn-outline btn-sm np" onclick="Reports._load()">Apply</button>
        <button class="btn btn-accent btn-sm np" onclick="Reports._export()">⬇️ Export Excel</button>
        <button class="btn btn-outline btn-sm np" onclick="window.print()">🖨️ Print</button>
      </div>
    </div>
    <div id="rep-content"><div class="page-loader"><span class="spinner"></span>Loading…</div></div>`;

    await _load();
  }

  async function _load() {
    _from = document.getElementById('rep-from')?.value || _from;
    _to   = document.getElementById('rep-to')?.value   || _to;
    const wrap = document.getElementById('rep-content');
    if(!wrap) return;
    wrap.innerHTML = `<div class="page-loader"><span class="spinner"></span>Loading…</div>`;
    try {
      if(_activeReport==='sales')      await _renderSales(wrap);
      else if(_activeReport==='purchase') await _renderPurchase(wrap);
      else if(_activeReport==='gst')    await _renderGST(wrap);
      else if(_activeReport==='outstanding') await _renderOutstanding(wrap);
      else if(_activeReport==='pfReg')  await _renderPFReg(wrap);
      else if(_activeReport==='esiReg') await _renderESIReg(wrap);
    } catch(e){ wrap.innerHTML=`<div class="card"><p style="color:var(--red)">⚠️ ${e.message}</p></div>`; }
  }

  async function _renderSales(wrap) {
    const rows = await API.getSalesRegister({ from:_from, to:_to });
    const tot  = rows.reduce((s,r)=>s+(parseFloat(r.totalAmount)||0),0);
    const totTx= rows.reduce((s,r)=>s+(parseFloat(r.taxableValue)||0),0);
    const totGST=rows.reduce((s,r)=>s+(parseFloat(r.cgst)||0)+(parseFloat(r.sgst)||0)+(parseFloat(r.igst)||0),0);
    wrap.innerHTML=`
    <div class="stats-grid">
      <div class="stat-card" style="--c:var(--navy-400)"><div class="s-label">Total Invoices</div><div class="s-value">${rows.length}</div></div>
      <div class="stat-card" style="--c:var(--navy-400)"><div class="s-label">Taxable Value</div><div class="s-value">${fmtCur(totTx)}</div></div>
      <div class="stat-card" style="--c:var(--navy-400)"><div class="s-label">Total GST</div><div class="s-value">${fmtCur(totGST)}</div></div>
      <div class="stat-card" style="--c:var(--navy-400)"><div class="s-label">Invoice Value</div><div class="s-value">${fmtCur(tot)}</div></div>
    </div>
    <div class="card"><div class="card-header"><h2>Sales Register — ${fmtDate(_from)} to ${fmtDate(_to)}</h2></div>
    ${!rows.length?`<div class="table-empty">No invoices in this period</div>`:
    `<div class="table-wrap"><table>
      <thead><tr><th>Invoice No</th><th>Date</th><th>Type</th><th>Client</th><th>GSTIN</th><th>Supply</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td style="font-weight:700;font-family:monospace;font-size:11.5px">${esc(r.invoiceNo)}</td>
        <td>${fmtDate(r.invoiceDate)}</td>
        <td>${badge(r.docType||'Invoice')}</td>
        <td>${trunc(r.clientName,20)}</td>
        <td style="font-size:11px;font-family:monospace">${r.clientGSTIN||'—'}</td>
        <td>${badge(r.supplyType||'—')}</td>
        <td>${fmtCur(r.taxableValue)}</td>
        <td>${fmtCur(r.cgst)}</td>
        <td>${fmtCur(r.sgst)}</td>
        <td>${fmtCur(r.igst)}</td>
        <td style="font-weight:700">${fmtCur(r.totalAmount)}</td>
        <td>${badge(r.status)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="6">Total</td><td>${fmtCur(totTx)}</td>
        <td>${fmtCur(rows.reduce((s,r)=>s+(parseFloat(r.cgst)||0),0))}</td>
        <td>${fmtCur(rows.reduce((s,r)=>s+(parseFloat(r.sgst)||0),0))}</td>
        <td>${fmtCur(rows.reduce((s,r)=>s+(parseFloat(r.igst)||0),0))}</td>
        <td>${fmtCur(tot)}</td><td></td>
      </tr></tfoot>
    </table></div>`}
    </div>`;
  }

  async function _renderPurchase(wrap) {
    const rows = await API.getPurchaseRegister({ from:_from, to:_to });
    const tot  = rows.reduce((s,r)=>s+(parseFloat(r.totalAmount)||0),0);
    const totGST=rows.reduce((s,r)=>s+(parseFloat(r.cgst)||0)+(parseFloat(r.sgst)||0)+(parseFloat(r.igst)||0),0);
    wrap.innerHTML=`
    <div class="card"><div class="card-header"><h2>Purchase Register — ${fmtDate(_from)} to ${fmtDate(_to)}</h2></div>
    ${!rows.length?`<div class="table-empty">No purchases in this period</div>`:
    `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Vendor</th><th>GSTIN</th><th>Inv No</th><th>Category</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th><th>Pmt</th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td>${fmtDate(r.purchaseDate)}</td>
        <td style="font-weight:600">${trunc(r.vendorName,20)}</td>
        <td style="font-size:11px;font-family:monospace">${r.vendorGSTIN||'—'}</td>
        <td style="font-size:11.5px">${r.vendorInvoiceNo||'—'}</td>
        <td><span class="badge badge-gray">${r.expenseCategory||'—'}</span></td>
        <td>${fmtCur(r.taxableValue)}</td>
        <td>${fmtCur(r.cgst)}</td><td>${fmtCur(r.sgst)}</td><td>${fmtCur(r.igst)}</td>
        <td style="font-weight:700">${fmtCur(r.totalAmount)}</td>
        <td>${badge(r.paymentStatus||'Unpaid')}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5">Total (${rows.length})</td>
        <td>${fmtCur(rows.reduce((s,r)=>s+(parseFloat(r.taxableValue)||0),0))}</td>
        <td>${fmtCur(rows.reduce((s,r)=>s+(parseFloat(r.cgst)||0),0))}</td>
        <td>${fmtCur(rows.reduce((s,r)=>s+(parseFloat(r.sgst)||0),0))}</td>
        <td>${fmtCur(rows.reduce((s,r)=>s+(parseFloat(r.igst)||0),0))}</td>
        <td>${fmtCur(tot)}</td><td></td>
      </tr></tfoot>
    </table></div>`}
    </div>`;
  }

  async function _renderGST(wrap) {
    const s = await API.getGSTSummary({ from:_from, to:_to });
    wrap.innerHTML=`
    <div class="gst3b-grid">
      <div class="gst3b-box">
        <h3>📤 Output Tax</h3>
        <div class="gst3b-row"><span>CGST</span><span>${fmtCur(s.output.cgst)}</span></div>
        <div class="gst3b-row"><span>SGST</span><span>${fmtCur(s.output.sgst)}</span></div>
        <div class="gst3b-row"><span>IGST</span><span>${fmtCur(s.output.igst)}</span></div>
        <div class="gst3b-row"><span>Total Output</span><span>${fmtCur(s.output.total)}</span></div>
        <div style="font-size:11px;color:var(--muted);margin-top:8px">${s.invoiceCount} invoice${s.invoiceCount!==1?'s':''}</div>
      </div>
      <div class="gst3b-box">
        <h3>📥 ITC (Matched Purchases)</h3>
        <div class="gst3b-row"><span>CGST</span><span>${fmtCur(s.itc.cgst)}</span></div>
        <div class="gst3b-row"><span>SGST</span><span>${fmtCur(s.itc.sgst)}</span></div>
        <div class="gst3b-row"><span>IGST</span><span>${fmtCur(s.itc.igst)}</span></div>
        <div class="gst3b-row"><span>Total ITC</span><span style="color:var(--green)">${fmtCur(s.itc.total)}</span></div>
        <div style="font-size:11px;color:var(--muted);margin-top:8px">${s.eligibleCount} matched purchase${s.eligibleCount!==1?'s':''}</div>
      </div>
    </div>
    <div class="gst3b-net-grid">
      <div class="gst3b-net-box"><div class="nl">Net CGST</div><div class="nv" style="color:${s.net.cgst>0?'var(--red)':'var(--green)'}">${fmtCur(s.net.cgst)}</div></div>
      <div class="gst3b-net-box"><div class="nl">Net SGST</div><div class="nv" style="color:${s.net.sgst>0?'var(--red)':'var(--green)'}">${fmtCur(s.net.sgst)}</div></div>
      <div class="gst3b-net-box"><div class="nl">Net IGST</div><div class="nv" style="color:${s.net.igst>0?'var(--red)':'var(--green)'}">${fmtCur(s.net.igst)}</div></div>
      <div class="gst3b-net-box" style="border-left:2px solid var(--border)">
        <div class="nl">Total GST Payable</div>
        <div class="nv" style="font-size:26px;color:${s.net.total>0?'var(--red)':'var(--green)'}">${fmtCur(s.net.total)}</div>
      </div>
    </div>`;
  }

  async function _renderOutstanding(wrap) {
    const rows = await API.getOutstanding();
    const tot  = rows.reduce((s,r)=>s+(parseFloat(r.balance)||0),0);
    wrap.innerHTML=`
    <div class="card"><div class="card-header"><h2>Outstanding Report</h2></div>
    ${!rows.length?`<div class="table-empty">No outstanding records</div>`:
    `<div class="table-wrap"><table>
      <thead><tr><th>Invoice No</th><th>Client</th><th>Date</th><th>Total</th><th>Received</th><th>Balance</th><th>Days</th><th>Status</th></tr></thead>
      <tbody>${rows.filter(r=>r.status!=='Paid').sort((a,b)=>(parseFloat(b.balance)||0)-(parseFloat(a.balance)||0)).map(r=>`<tr>
        <td style="font-weight:700;font-family:monospace;font-size:11.5px">${esc(r.invoiceNo)}</td>
        <td style="font-weight:600">${trunc(r.clientName,22)}</td>
        <td>${fmtDate(r.invoiceDate)}</td>
        <td>${fmtCur(r.totalAmount)}</td>
        <td style="color:var(--green)">${fmtCur(r.received)}</td>
        <td style="font-weight:700;color:var(--red)">${fmtCur(r.balance)}</td>
        <td>${ageBadge(parseInt(r.daysOutstanding)||0)}</td>
        <td>${badge(r.status)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">Total Outstanding</td><td></td><td></td><td style="font-weight:700;color:var(--red)">${fmtCur(tot)}</td><td colspan="2"></td></tr></tfoot>
    </table></div>`}
    </div>`;
  }

  async function _renderPFReg(wrap) {
    const rows = await API.getPFRegister();
    wrap.innerHTML=`
    <div class="card"><div class="card-header"><h2>PF Register</h2></div>
    ${!rows.length?`<div class="table-empty">No PF entries</div>`:
    `<div class="table-wrap"><table>
      <thead><tr><th>Month</th><th>Year</th><th>Employee</th><th>UAN</th><th>PF Wages</th><th>Emp PF</th><th>Emplr EPF</th><th>EPS</th><th>EDLI</th><th>Admin</th><th>Total</th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td>${r.month}</td><td>${r.year}</td>
        <td style="font-weight:600">${esc(r.empName)}</td>
        <td style="font-family:monospace;font-size:11px">${r.uan||'—'}</td>
        <td>${fmtCur(r.pfWages)}</td><td>${fmtCur(r.empPF)}</td><td>${fmtCur(r.emplrEPF)}</td>
        <td>${fmtCur(r.emplrEPS)}</td><td>${fmtCur(r.edli)}</td><td>${fmtCur(r.adminCharges)}</td>
        <td style="font-weight:700">${fmtCur(r.totalPF)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`}
    </div>`;
  }

  async function _renderESIReg(wrap) {
    const rows = await API.getESIRegister();
    wrap.innerHTML=`
    <div class="card"><div class="card-header"><h2>ESI Register</h2></div>
    ${!rows.length?`<div class="table-empty">No ESI entries</div>`:
    `<div class="table-wrap"><table>
      <thead><tr><th>Month</th><th>Year</th><th>Employee</th><th>ESIC No</th><th>ESI Wages</th><th>Emp ESI</th><th>Emplr ESI</th><th>Total</th><th>Eligible</th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td>${r.month}</td><td>${r.year}</td>
        <td style="font-weight:600">${esc(r.empName)}</td>
        <td style="font-family:monospace;font-size:11px">${r.esicNo||'—'}</td>
        <td>${fmtCur(r.esicWages)}</td><td>${fmtCur(r.empESIC)}</td>
        <td>${fmtCur(r.emplrESIC)}</td>
        <td style="font-weight:700">${fmtCur(r.totalESIC)}</td>
        <td>${badge(r.eligible==='Yes'?'Active':'Inactive')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`}
    </div>`;
  }

  async function _export() {
    if(_activeReport==='gst'){toast('Use browser print for GST Summary','info');return;}
    const wrap=document.getElementById('rep-content');
    const rows=[...wrap.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim()));
    const hdrs=[...wrap.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    if(!rows.length){toast('No data to export','warning');return;}
    exportExcel([hdrs,...rows],_activeReport,`${_activeReport}_report_${getCurrentFY()}.xlsx`);
  }

  function _setReport(r){_activeReport=r;
    document.querySelectorAll('[id^="rep-pill-"]').forEach(el=>el.classList.remove('active'));
    document.getElementById('rep-pill-'+r)?.classList.add('active');
    _load();
  }
  function _onDateChange(){_from=document.getElementById('rep-from')?.value||_from;_to=document.getElementById('rep-to')?.value||_to;}

  return { render, _setReport, _onDateChange, _load, _export };
})();
