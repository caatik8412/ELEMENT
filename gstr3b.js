/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — gstr3b.js
   ============================================================ */

'use strict';

const Gstr3b = (() => {

  let _invoices  = [];
  let _purchases = [];
  let _gstr2a    = [];
  let _selMonth  = new Date().getMonth();
  let _selYear   = new Date().getFullYear();

  async function render() {
    [_invoices, _purchases, _gstr2a] = await Promise.all([
      API.getInvoices(), API.getPurchases(), API.getGSTR2A()
    ]);
    _renderShell();
    _renderEstimate();
  }

  function _renderShell() {
    const el    = document.getElementById('content');
    const now   = new Date();
    const months= ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const years = [now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1];

    el.innerHTML = `
    <!-- Period selector -->
    <div class="card" style="padding:14px 20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="font-weight:700;color:var(--navy-600)">Period:</span>
        <select class="form-control" style="width:auto;padding:6px 12px" id="g3b-month"
          onchange="Gstr3b._onPeriodChange()">
          ${months.map((m,i)=>`<option value="${i}"${i===_selMonth?' selected':''}>${m}</option>`).join('')}
        </select>
        <select class="form-control" style="width:auto;padding:6px 12px" id="g3b-year"
          onchange="Gstr3b._onPeriodChange()">
          ${years.map(y=>`<option value="${y}"${y===_selYear?' selected':''}>${y}</option>`).join('')}
        </select>
        <span style="font-size:12px;color:var(--muted)">
          ITC = only <strong>Matched</strong> purchases (from GSTR-2A)
        </span>
        <button class="btn btn-outline btn-sm np" onclick="navigateTo('gstr2a')">Update 2A Status →</button>
      </div>
    </div>

    <!-- Estimate panels -->
    <div id="g3b-content"></div>`;

    _renderEstimate();
  }

  function _renderEstimate() {
    const m = _selMonth;
    const y = _selYear;

    // Outward — Tax Invoices only in this period
    const outInvs = _invoices.filter(i => {
      if ((i.docType || 'Invoice') !== 'Invoice') return false;
      const d = new Date(i.invoiceDate);
      return d.getMonth() === m && d.getFullYear() === y;
    });

    // Eligible ITC — Matched purchases in this period
    const eligIds  = _gstr2a.filter(g => g.status === 'Matched').map(g => g.purchaseId);
    const eligPurs = _purchases.filter(p => {
      if (!eligIds.includes(p.id)) return false;
      const d = new Date(p.purchaseDate);
      return d.getMonth() === m && d.getFullYear() === y;
    });

    // Pending ITC — Pending 2A purchases in this period
    const pendIds  = _gstr2a.filter(g => !g.status || g.status === 'Pending').map(g => g.purchaseId);
    const pendPurs = _purchases.filter(p => {
      if (!pendIds.includes(p.id)) return false;
      const d = new Date(p.purchaseDate);
      return d.getMonth() === m && d.getFullYear() === y;
    });

    // Ineligible
    const ineligIds  = _gstr2a.filter(g => g.status === 'Ineligible ITC').map(g => g.purchaseId);
    const ineligPurs = _purchases.filter(p => {
      if (!ineligIds.includes(p.id)) return false;
      const d = new Date(p.purchaseDate);
      return d.getMonth() === m && d.getFullYear() === y;
    });

    // Compute output tax
    const outTx  = outInvs.reduce((s,i)=>s+(parseFloat(i.taxableValue)||0),0);
    const outCGST= outInvs.reduce((s,i)=>s+(parseFloat(i.cgst)||0),0);
    const outSGST= outInvs.reduce((s,i)=>s+(parseFloat(i.sgst)||0),0);
    const outIGST= outInvs.reduce((s,i)=>s+(parseFloat(i.igst)||0),0);
    const outGST = outCGST + outSGST + outIGST;

    // Eligible ITC
    const itcCGST= eligPurs.reduce((s,p)=>s+(parseFloat(p.cgst)||0),0);
    const itcSGST= eligPurs.reduce((s,p)=>s+(parseFloat(p.sgst)||0),0);
    const itcIGST= eligPurs.reduce((s,p)=>s+(parseFloat(p.igst)||0),0);
    const itcTot = itcCGST + itcSGST + itcIGST;

    // Pending ITC
    const pndCGST= pendPurs.reduce((s,p)=>s+(parseFloat(p.cgst)||0),0);
    const pndSGST= pendPurs.reduce((s,p)=>s+(parseFloat(p.sgst)||0),0);
    const pndIGST= pendPurs.reduce((s,p)=>s+(parseFloat(p.igst)||0),0);
    const pndTot = pndCGST + pndSGST + pndIGST;

    // Ineligible
    const inlTot = ineligPurs.reduce((s,p)=>s+(parseFloat(p.cgst)||0)+(parseFloat(p.sgst)||0)+(parseFloat(p.igst)||0),0);

    // Net liability
    const netCGST= Math.max(0, outCGST - itcCGST);
    const netSGST= Math.max(0, outSGST - itcSGST);
    const netIGST= Math.max(0, outIGST - itcIGST);
    const netTot = netCGST + netSGST + netIGST;

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const wrap = document.getElementById('g3b-content');
    if (!wrap) return;

    wrap.innerHTML = `
    <div class="gst3b-grid">
      <!-- Output Tax -->
      <div class="gst3b-box">
        <h3>📤 Output Tax (Sales)</h3>
        <div class="gst3b-row"><span>Taxable Value</span><span>${fmtCur(outTx)}</span></div>
        <div class="gst3b-row"><span>CGST Collected</span><span>${fmtCur(outCGST)}</span></div>
        <div class="gst3b-row"><span>SGST Collected</span><span>${fmtCur(outSGST)}</span></div>
        <div class="gst3b-row"><span>IGST Collected</span><span>${fmtCur(outIGST)}</span></div>
        <div class="gst3b-row"><span>Total Output GST</span><span style="color:var(--navy-600)">${fmtCur(outGST)}</span></div>
        <div style="margin-top:8px;font-size:11px;color:var(--muted)">${outInvs.length} Tax Invoice${outInvs.length!==1?'s':''} in ${months[m]} ${y}</div>
      </div>
      <!-- ITC -->
      <div class="gst3b-box">
        <h3>📥 Input Tax Credit</h3>
        <div class="gst3b-row" style="font-weight:700;color:var(--green)">
          <span>✅ Eligible ITC (2A Matched)</span><span>${fmtCur(itcTot)}</span>
        </div>
        <div class="gst3b-row" style="padding-left:12px"><span>CGST</span><span>${fmtCur(itcCGST)}</span></div>
        <div class="gst3b-row" style="padding-left:12px"><span>SGST</span><span>${fmtCur(itcSGST)}</span></div>
        <div class="gst3b-row" style="padding-left:12px;border-bottom:1px solid var(--border);padding-bottom:8px"><span>IGST</span><span>${fmtCur(itcIGST)}</span></div>
        <div class="gst3b-row" style="color:var(--yellow);margin-top:8px">
          <span>⏳ Pending Verification</span><span>${fmtCur(pndTot)}</span>
        </div>
        <div class="gst3b-row" style="color:var(--red)">
          <span>🔒 Ineligible ITC</span><span>${fmtCur(inlTot)}</span>
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--muted)">${eligPurs.length} matched purchase${eligPurs.length!==1?'s':''} in ${months[m]} ${y}</div>
      </div>
    </div>

    <!-- Net Liability -->
    <div class="gst3b-net-grid">
      <div class="gst3b-net-box">
        <div class="nl">Output GST</div>
        <div class="nv" style="color:var(--navy-600)">${fmtCur(outGST)}</div>
      </div>
      <div class="gst3b-net-box">
        <div class="nl">Less: Eligible ITC</div>
        <div class="nv" style="color:var(--green)">${fmtCur(itcTot)}</div>
      </div>
      <div class="gst3b-net-box" style="border-left:2px solid var(--border)">
        <div class="nl">Net CGST Payable</div>
        <div class="nv" style="color:${netCGST>0?'var(--red)':'var(--green)'}">${fmtCur(netCGST)}</div>
      </div>
      <div class="gst3b-net-box">
        <div class="nl">Net SGST Payable</div>
        <div class="nv" style="color:${netSGST>0?'var(--red)':'var(--green)'}">${fmtCur(netSGST)}</div>
      </div>
      <div class="gst3b-net-box">
        <div class="nl">Net IGST Payable</div>
        <div class="nv" style="color:${netIGST>0?'var(--red)':'var(--green)'}">${fmtCur(netIGST)}</div>
      </div>
      <div class="gst3b-net-box" style="border-left:2px solid var(--border)">
        <div class="nl">Total GST Payable</div>
        <div class="nv" style="font-size:26px;color:${netTot>0?'var(--red)':'var(--green)'}">${fmtCur(netTot)}</div>
      </div>
    </div>

    ${pndTot > 0 ? `
    <div style="margin-top:12px;padding:11px 14px;background:var(--yellow-bg);border-radius:var(--radius-sm);font-size:12.5px;color:#92400E">
      ⏳ <strong>${fmtCur(pndTot)}</strong> ITC pending 2A verification.
      <span onclick="navigateTo('gstr2a')" style="text-decoration:underline;cursor:pointer;margin-left:6px">Update GSTR-2A status →</span>
    </div>` : ''}

    ${netTot === 0 && outGST > 0 ? `
    <div style="margin-top:12px;padding:11px 14px;background:var(--green-bg);border-radius:var(--radius-sm);font-size:12.5px;color:#15803D;font-weight:600">
      ✅ ITC fully covers GST liability for ${months[m]} ${y}
    </div>` : ''}

    <!-- Invoice breakup -->
    <div class="card" style="margin-top:16px">
      <div class="card-header"><h2>Invoice-wise Breakup — ${months[m]} ${y}</h2></div>
      ${outInvs.length === 0
        ? `<div class="table-empty">No Tax Invoices for this period</div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>Invoice No</th><th>Client</th><th>Date</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total GST</th><th>Type</th></tr></thead>
            <tbody>
              ${outInvs.map(i=>`<tr>
                <td style="font-weight:700;font-family:monospace;font-size:12px">${esc(i.invoiceNo)}</td>
                <td>${trunc(i.clientName,20)}</td>
                <td>${fmtDate(i.invoiceDate)}</td>
                <td>${fmtCur(i.taxableValue)}</td>
                <td>${fmtCur(i.cgst)}</td>
                <td>${fmtCur(i.sgst)}</td>
                <td>${fmtCur(i.igst)}</td>
                <td style="font-weight:700">${fmtCur((parseFloat(i.cgst)||0)+(parseFloat(i.sgst)||0)+(parseFloat(i.igst)||0))}</td>
                <td>${badge(i.supplyType||'—')}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot><tr>
              <td colspan="3">Total</td>
              <td>${fmtCur(outTx)}</td>
              <td>${fmtCur(outCGST)}</td>
              <td>${fmtCur(outSGST)}</td>
              <td>${fmtCur(outIGST)}</td>
              <td>${fmtCur(outGST)}</td>
              <td></td>
            </tr></tfoot>
          </table></div>`
      }
    </div>`;
  }

  function _onPeriodChange() {
    _selMonth = parseInt(document.getElementById('g3b-month').value);
    _selYear  = parseInt(document.getElementById('g3b-year').value);
    _renderEstimate();
  }

  return { render, _onPeriodChange };
})();
