/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — pfesi.js
   ============================================================ */

'use strict';

const PfEsi = (() => {

  let _pf   = [];
  let _esi  = [];
  let _emps = [];
  let _tab  = 'pf';
  let _selM = new Date().getMonth() + 1;
  let _selY = new Date().getFullYear();

  async function render() {
    [_pf, _esi, _emps] = await Promise.all([API.getPFWorking(), API.getESIWorking(), API.getEmployees()]);
    _renderShell();
    _renderContent();
    _ensureModal();
  }

  function _renderShell() {
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now   = new Date();
    const el    = document.getElementById('content');
    el.innerHTML=`
    <div class="card" style="padding:14px 20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="pill-group">
          <button class="pill-btn ${_tab==='pf'?'active':''}" onclick="PfEsi._setTab('pf')">PF Working</button>
          <button class="pill-btn ${_tab==='esi'?'active':''}" onclick="PfEsi._setTab('esi')">ESI Working</button>
        </div>
        <select class="form-control" style="width:auto;padding:6px 12px" id="pf-sel-m" onchange="PfEsi._onPeriod()">
          ${months.map((m,i)=>`<option value="${i+1}"${i+1===_selM?' selected':''}>${m}</option>`).join('')}
        </select>
        <select class="form-control" style="width:auto;padding:6px 12px" id="pf-sel-y" onchange="PfEsi._onPeriod()">
          ${[now.getFullYear()-1,now.getFullYear(),now.getFullYear()+1].map(y=>`<option value="${y}"${y===_selY?' selected':''}>${y}</option>`).join('')}
        </select>
        <button class="btn btn-outline btn-sm np" onclick="PfEsi.exportECR()">⬇️ ECR Excel</button>
        <button class="btn btn-primary btn-sm np" onclick="PfEsi.openNew()">+ Add Entry</button>
      </div>
    </div>
    <div id="pf-content"></div>`;
  }

  function _renderContent() {
    const wrap  = document.getElementById('pf-content');
    if(!wrap) return;
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const label = `${months[_selM-1]} ${_selY}`;

    if(_tab==='pf') {
      const rows = _pf.filter(r=>+r.month===_selM && +r.year===_selY);
      const tEPF  = rows.reduce((s,r)=>s+(parseFloat(r.empPF)||0),0);
      const tEEPF = rows.reduce((s,r)=>s+(parseFloat(r.emplrEPF)||0),0);
      const tEPS  = rows.reduce((s,r)=>s+(parseFloat(r.emplrEPS)||0),0);
      const tEDLI = rows.reduce((s,r)=>s+(parseFloat(r.edli)||0),0);
      const tAdm  = rows.reduce((s,r)=>s+(parseFloat(r.adminCharges)||0),0);
      const tPF   = rows.reduce((s,r)=>s+(parseFloat(r.totalPF)||0),0);

      wrap.innerHTML=`
      <div class="pf-summary-grid">
        <div class="pf-box"><div class="pb-label">Emp PF (12%)</div><div class="pb-value">${fmtCur(tEPF)}</div></div>
        <div class="pf-box"><div class="pb-label">Emplr EPF (3.67%)</div><div class="pb-value">${fmtCur(tEEPF)}</div></div>
        <div class="pf-box"><div class="pb-label">EPS (8.33%)</div><div class="pb-value">${fmtCur(tEPS)}</div></div>
        <div class="pf-box"><div class="pb-label">EDLI</div><div class="pb-value">${fmtCur(tEDLI)}</div></div>
        <div class="pf-box"><div class="pb-label">Admin Charges</div><div class="pb-value">${fmtCur(tAdm)}</div></div>
        <div class="pf-box" style="border:2px solid var(--navy-400)"><div class="pb-label">Total PF Challan</div><div class="pb-value" style="color:var(--navy-600)">${fmtCur(tPF)}</div></div>
      </div>
      <div class="card">
        <div class="card-header"><h2>PF Working — ${label}</h2></div>
        ${!rows.length
          ? `<div class="table-empty">No PF entries for ${label}. Click "+ Add Entry".</div>`
          : `<div class="table-wrap"><table>
              <thead><tr>
                <th>Emp</th><th>UAN</th><th>Days</th><th>PF Wages</th>
                <th>Emp PF</th><th>Emplr EPF</th><th>EPS</th><th>EDLI</th><th>Admin</th><th>Total</th>
                <th class="np">Del</th>
              </tr></thead>
              <tbody>
                ${rows.map(r=>`<tr>
                  <td style="font-weight:600">${esc(r.empName)}</td>
                  <td style="font-family:monospace;font-size:11px">${r.uan||'—'}</td>
                  <td>${r.presentDays||0}/${r.totalDays||30}</td>
                  <td>${fmtCur(r.pfWages)}</td>
                  <td>${fmtCur(r.empPF)}</td>
                  <td>${fmtCur(r.emplrEPF)}</td>
                  <td>${fmtCur(r.emplrEPS)}</td>
                  <td>${fmtCur(r.edli)}</td>
                  <td>${fmtCur(r.adminCharges)}</td>
                  <td style="font-weight:700">${fmtCur(r.totalPF)}</td>
                  <td class="np"><button class="btn btn-danger btn-icon btn-sm"
                    onclick="PfEsi.deleteEntry('pf','${r.id}')">🗑</button></td>
                </tr>`).join('')}
              </tbody>
              <tfoot><tr>
                <td colspan="3">Total</td>
                <td></td>
                <td>${fmtCur(tEPF)}</td><td>${fmtCur(tEEPF)}</td>
                <td>${fmtCur(tEPS)}</td><td>${fmtCur(tEDLI)}</td><td>${fmtCur(tAdm)}</td>
                <td>${fmtCur(tPF)}</td><td class="np"></td>
              </tr></tfoot>
            </table></div>`}
      </div>`;
    } else {
      const rows = _esi.filter(r=>+r.month===_selM && +r.year===_selY);
      const tEmp = rows.reduce((s,r)=>s+(parseFloat(r.empESIC)||0),0);
      const tEml = rows.reduce((s,r)=>s+(parseFloat(r.emplrESIC)||0),0);
      const tTot = rows.reduce((s,r)=>s+(parseFloat(r.totalESIC)||0),0);

      wrap.innerHTML=`
      <div class="pf-summary-grid">
        <div class="pf-box"><div class="pb-label">Emp ESI (0.75%)</div><div class="pb-value">${fmtCur(tEmp)}</div></div>
        <div class="pf-box"><div class="pb-label">Emplr ESI (3.25%)</div><div class="pb-value">${fmtCur(tEml)}</div></div>
        <div class="pf-box" style="border:2px solid var(--navy-400)"><div class="pb-label">Total ESI Challan</div><div class="pb-value" style="color:var(--navy-600)">${fmtCur(tTot)}</div></div>
        <div class="pf-box"><div class="pb-label">Eligible Employees</div><div class="pb-value">${rows.filter(r=>r.eligible==='Yes').length}</div></div>
      </div>
      <div class="card">
        <div class="card-header"><h2>ESI Working — ${label}</h2></div>
        ${!rows.length
          ? `<div class="table-empty">No ESI entries for ${label}. Click "+ Add Entry".</div>`
          : `<div class="table-wrap"><table>
              <thead><tr>
                <th>Emp</th><th>ESIC No</th><th>Days</th>
                <th>ESI Wages</th><th>Emp ESI</th><th>Emplr ESI</th><th>Total</th><th>Eligible</th>
                <th class="np">Del</th>
              </tr></thead>
              <tbody>
                ${rows.map(r=>`<tr>
                  <td style="font-weight:600">${esc(r.empName)}</td>
                  <td style="font-family:monospace;font-size:11px">${r.esicNo||'—'}</td>
                  <td>${r.presentDays||0}/${r.totalDays||30}</td>
                  <td>${fmtCur(r.esicWages)}</td>
                  <td>${fmtCur(r.empESIC)}</td>
                  <td>${fmtCur(r.emplrESIC)}</td>
                  <td style="font-weight:700">${fmtCur(r.totalESIC)}</td>
                  <td>${badge(r.eligible==='Yes'?'Active':'Inactive')}</td>
                  <td class="np"><button class="btn btn-danger btn-icon btn-sm"
                    onclick="PfEsi.deleteEntry('esi','${r.id}')">🗑</button></td>
                </tr>`).join('')}
              </tbody>
              <tfoot><tr>
                <td colspan="3">Total</td>
                <td></td><td>${fmtCur(tEmp)}</td><td>${fmtCur(tEml)}</td>
                <td>${fmtCur(tTot)}</td><td></td><td class="np"></td>
              </tr></tfoot>
            </table></div>`}
      </div>`;
    }
  }

  function _ensureModal() {
    if(document.getElementById('modal-pfesi')) return;
    const div=document.createElement('div');
    div.innerHTML=`
    <div class="modal-overlay" id="modal-pfesi">
      <div class="modal">
        <div class="modal-header">
          <h3 id="pf-modal-title">PF &amp; ESI Entry</h3>
          <button class="modal-close" onclick="closeModal('modal-pfesi')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-section">Period &amp; Employee</div>
            <div class="form-group">
              <label>Month</label>
              <select class="form-control" id="pf-m">
                ${['January','February','March','April','May','June','July','August','September','October','November','December'].map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>Year</label><input class="form-control" id="pf-y" type="number" value="${new Date().getFullYear()}"/></div>
            <div class="form-group full">
              <label>Employee <span class="req">*</span></label>
              <select class="form-control" id="pf-emp" onchange="PfEsi._onEmpChange()">
                <option value="">— Select Employee —</option>
              </select>
            </div>
            <div class="form-group"><label>UAN</label><input class="form-control" id="pf-uan" readonly/></div>
            <div class="form-group"><label>ESIC No.</label><input class="form-control" id="pf-esicno" readonly/></div>

            <div class="form-section">Attendance &amp; Salary</div>
            <div class="form-group"><label>Total Days</label><input class="form-control" id="pf-td" type="number" value="30" oninput="PfEsi._calc()"/></div>
            <div class="form-group"><label>Present Days</label><input class="form-control" id="pf-pd" type="number" placeholder="0" oninput="PfEsi._calc()"/></div>
            <div class="form-group"><label>Gross Monthly Salary (₹)</label><input class="form-control" id="pf-gross" type="number" step="0.01" placeholder="0" oninput="PfEsi._calc()"/></div>
            <div class="form-group"><label>PF Wages Ceiling (₹)</label><input class="form-control" id="pf-ceil" type="number" value="15000" oninput="PfEsi._calc()"/></div>

            <div class="form-section">Computed — PF</div>
            <div class="form-group"><label>Proportional Gross (₹)</label><input class="form-control" id="pf-pgross" readonly/></div>
            <div class="form-group"><label>PF Wages (₹)</label><input class="form-control" id="pf-pfwages" readonly/></div>
            <div class="form-group"><label>Emp PF 12% (₹)</label><input class="form-control" id="pf-epf" readonly/></div>
            <div class="form-group"><label>Emplr EPF 3.67% (₹)</label><input class="form-control" id="pf-repf" readonly/></div>
            <div class="form-group"><label>EPS 8.33% (₹)</label><input class="form-control" id="pf-eps" readonly/></div>
            <div class="form-group"><label>EDLI (₹)</label><input class="form-control" id="pf-edli" readonly/></div>
            <div class="form-group"><label>Admin Charges (₹)</label><input class="form-control" id="pf-adm" readonly/></div>
            <div class="form-group"><label>Total PF Challan (₹)</label><input class="form-control" id="pf-tot" readonly style="font-weight:800"/></div>

            <div class="form-section">Computed — ESI</div>
            <div class="form-group"><label>ESI Eligible? (≤₹21,000)</label><input class="form-control" id="pf-esielig" readonly/></div>
            <div class="form-group"><label>ESI Wages (₹)</label><input class="form-control" id="pf-esiwages" readonly/></div>
            <div class="form-group"><label>Emp ESI 0.75% (₹)</label><input class="form-control" id="pf-eesi" readonly/></div>
            <div class="form-group"><label>Emplr ESI 3.25% (₹)</label><input class="form-control" id="pf-resi" readonly/></div>
            <div class="form-group"><label>Total ESI Challan (₹)</label><input class="form-control" id="pf-esitot" readonly style="font-weight:800"/></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeModal('modal-pfesi')">Cancel</button>
          <button class="btn btn-primary" onclick="PfEsi.save()">💾 Save Entry</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div);
    _populateEmpSelect();
  }

  function _populateEmpSelect() {
    const sel=document.getElementById('pf-emp');
    if(!sel) return;
    sel.innerHTML=`<option value="">— Select Employee —</option>`+
      _emps.filter(e=>e.status==='Active').map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');
  }

  function _onEmpChange() {
    const id=document.getElementById('pf-emp').value;
    const emp=_emps.find(e=>e.id===id);
    if(emp){
      document.getElementById('pf-uan').value    = emp.uan        || '';
      document.getElementById('pf-esicno').value = emp.esicNumber || '';
      if(emp.salary) document.getElementById('pf-gross').value = emp.salary;
      _calc();
    }
  }

  function _calc() {
    const gross = parseFloat(document.getElementById('pf-gross')?.value)||0;
    const td    = parseInt(document.getElementById('pf-td')?.value)||30;
    const pd    = parseInt(document.getElementById('pf-pd')?.value)||0;
    const ceil  = parseFloat(document.getElementById('pf-ceil')?.value)||15000;

    const pg    = td>0 ? gross*pd/td : 0;
    const pfw   = Math.min(pg, ceil);
    const epf   = Math.round(pfw*0.12*100)/100;
    const eps   = Math.round(Math.min(pfw,15000)*0.0833*100)/100;
    const repf  = Math.round((pfw*0.12 - eps)*100)/100;
    const edli  = Math.round(Math.min(pfw,15000)*0.005*100)/100;
    const adm   = Math.round(pfw*0.01*100)/100;
    const totPF = epf + repf + eps + edli + adm;

    const esiElig = pg <= 21000;
    const esiwages= esiElig ? pg : 0;
    const eesi    = esiElig ? Math.round(esiwages*0.0075*100)/100 : 0;
    const resi    = esiElig ? Math.round(esiwages*0.0325*100)/100 : 0;
    const totESI  = eesi + resi;

    const sv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=typeof v==='number'?v.toFixed(2):v;};
    sv('pf-pgross',pg); sv('pf-pfwages',pfw); sv('pf-epf',epf);
    sv('pf-repf',repf); sv('pf-eps',eps); sv('pf-edli',edli);
    sv('pf-adm',adm); sv('pf-tot',totPF);
    document.getElementById('pf-esielig').value = esiElig ? `Yes (≤₹21,000)` : `No (>₹21,000)`;
    sv('pf-esiwages',esiwages); sv('pf-eesi',eesi); sv('pf-resi',resi); sv('pf-esitot',totESI);
  }

  function openNew() {
    document.getElementById('pf-modal-title').textContent = _tab==='pf'?'PF Working Entry':'ESI Working Entry';
    document.getElementById('pf-m').value   = _selM;
    document.getElementById('pf-y').value   = _selY;
    document.getElementById('pf-td').value  = 30;
    document.getElementById('pf-ceil').value= 15000;
    ['pf-emp','pf-uan','pf-esicno','pf-pd','pf-gross','pf-pgross','pf-pfwages',
     'pf-epf','pf-repf','pf-eps','pf-edli','pf-adm','pf-tot',
     'pf-esielig','pf-esiwages','pf-eesi','pf-resi','pf-esitot'].forEach(id=>{
      const el=document.getElementById(id);if(el&&id!=='pf-td'&&id!=='pf-ceil')el.value='';});
    _populateEmpSelect();
    openModal('modal-pfesi');
  }

  async function save() {
    const empId=document.getElementById('pf-emp').value;
    const emp=_emps.find(e=>e.id===empId);
    if(!empId||!emp){toast('Select an employee','warning');return;}
    const btn=document.querySelector('#modal-pfesi .btn-primary');
    btn.disabled=true;btn.textContent='Saving…';
    const g=id=>document.getElementById(id)?.value||'';
    const m=+g('pf-m'), y=+g('pf-y');
    try {
      await API.savePFEntry({
        month:m,year:y,empId,empName:emp.name,uan:g('pf-uan'),
        totalDays:g('pf-td'),presentDays:g('pf-pd'),grossSalary:g('pf-gross'),
        pfWages:g('pf-pfwages'),empPF:g('pf-epf'),emplrEPF:g('pf-repf'),
        emplrEPS:g('pf-eps'),edli:g('pf-edli'),adminCharges:g('pf-adm'),totalPF:g('pf-tot')
      });
      await API.saveESIEntry({
        month:m,year:y,empId,empName:emp.name,esicNo:g('pf-esicno'),
        totalDays:g('pf-td'),presentDays:g('pf-pd'),grossSalary:g('pf-gross'),
        esicWages:g('pf-esiwages'),empESIC:g('pf-eesi'),emplrESIC:g('pf-resi'),
        totalESIC:g('pf-esitot'),eligible:g('pf-esielig').startsWith('Yes')?'Yes':'No'
      });
      toast('✅ PF & ESI entry saved','success');
      closeModal('modal-pfesi');
      _selM=m; _selY=y;
      render();
    } catch(e){toast('Error: '+e.message,'error');}
    finally{btn.disabled=false;btn.textContent='💾 Save Entry';}
  }

  async function deleteEntry(type, id) {
    const ok=await confirm('Delete this entry?','Delete');
    if(!ok) return;
    try {
      if(type==='pf') await API.deletePFEntry(id);
      else            await API.deleteESIEntry(id);
      toast('🗑 Deleted','success');
      render();
    } catch(e){toast('Error: '+e.message,'error');}
  }

  function exportECR() {
    const rows=_pf.filter(r=>+r.month===_selM&&+r.year===_selY);
    if(!rows.length){toast('No PF data for this period','warning');return;}
    const data=[['UAN','Employee Name','Total Days','Present Days','PF Wages','Gross EPF (12%)','EPS Wages','Gross EPS (8.33%)','EPF Diff (3.67%)','Emp PF (12%)','NCP Days','EDLI','Admin Charges','Total PF']];
    rows.forEach(r=>data.push([r.uan||'',r.empName,+r.totalDays||30,+r.presentDays||0,r.pfWages,+r.emplrEPF+(+r.emplrEPS||0),Math.min(+r.pfWages,15000),r.emplrEPS,r.emplrEPF,(+r.empPF||0),(+r.totalDays||30)-(+r.presentDays||0),r.edli,r.adminCharges,r.totalPF]));
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    exportExcel(data,'ECR',`ECR_${months[_selM-1]}_${_selY}.xlsx`);
  }

  function _setTab(t){_tab=t;_renderShell();_renderContent();}
  function _onPeriod(){_selM=+document.getElementById('pf-sel-m').value;_selY=+document.getElementById('pf-sel-y').value;_renderContent();}

  return { render, openNew, save, deleteEntry, exportECR, _setTab, _onPeriod, _onEmpChange, _calc };
})();
