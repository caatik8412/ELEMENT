/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — employee.js
   ============================================================ */

'use strict';

const Employees = (() => {

  let _employees = [];
  let _editId    = null;
  let _search    = '';

  async function render() {
    _employees = await API.getEmployees();
    _renderShell();
    _applyFilter();
    _ensureModal();
  }

  function _renderShell() {
    document.getElementById('content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card" style="--c:var(--green)"><div class="s-icon">👥</div>
        <div class="s-label">Active</div>
        <div class="s-value">${_employees.filter(e=>e.status==='Active').length}</div></div>
      <div class="stat-card" style="--c:var(--navy-400)"><div class="s-icon">🪪</div>
        <div class="s-label">Total</div><div class="s-value">${_employees.length}</div></div>
      <div class="stat-card" style="--c:var(--purple)"><div class="s-icon">🔖</div>
        <div class="s-label">With UAN (PF)</div>
        <div class="s-value">${_employees.filter(e=>e.uan).length}</div></div>
      <div class="stat-card" style="--c:var(--accent-2)"><div class="s-icon">🏥</div>
        <div class="s-label">With ESIC</div>
        <div class="s-value">${_employees.filter(e=>e.esicNumber).length}</div></div>
    </div>
    <div class="card">
      <div class="card-header">
        <h2>Employee Master</h2>
        <div class="card-actions">
          <input class="form-control" style="width:200px;padding:6px 10px" type="text"
            placeholder="Search…" oninput="Employees._setSearch(this.value)"/>
          <button class="btn btn-outline np" onclick="Employees.exportData()">⬇️ Export</button>
          <button class="btn btn-primary np" onclick="Employees.openNew()">+ Add Employee</button>
        </div>
      </div>
      <div id="emp-table-wrap"></div>
    </div>`;
  }

  function _applyFilter() {
    let list = [..._employees];
    if (_search) {
      const q=_search.toLowerCase();
      list=list.filter(e=>(e.name||'').toLowerCase().includes(q)||(e.empId||'').toLowerCase().includes(q)||(e.designation||'').toLowerCase().includes(q));
    }
    _renderTable(list.sort((a,b)=>(a.name||'').localeCompare(b.name||'')));
  }

  function _renderTable(list) {
    const wrap=document.getElementById('emp-table-wrap');
    if(!wrap) return;
    if(!list.length) {
      wrap.innerHTML=`<div class="empty-state"><span class="es-icon">🪪</span>
        <h3>No employees found</h3><p>Add employees to manage PF/ESI.</p>
        <button class="btn btn-primary np" onclick="Employees.openNew()">+ Add Employee</button></div>`;
      return;
    }
    wrap.innerHTML=`
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Emp ID</th><th>Name</th><th>Designation</th><th>Dept</th>
        <th>DOJ</th><th>UAN</th><th>ESIC No.</th><th>Status</th>
        <th class="np">Actions</th>
      </tr></thead>
      <tbody>
        ${list.map(e=>`<tr>
          <td style="font-weight:600;font-family:monospace;font-size:11.5px">${e.empId||'—'}</td>
          <td style="font-weight:700">${esc(e.name)}</td>
          <td>${e.designation||'—'}</td>
          <td>${e.department||'—'}</td>
          <td>${fmtDate(e.doj)}</td>
          <td style="font-family:monospace;font-size:11px">${e.uan||'—'}</td>
          <td style="font-family:monospace;font-size:11px">${e.esicNumber||'—'}</td>
          <td>${badge(e.status||'Active')}</td>
          <td class="np" style="white-space:nowrap">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="Employees.openEdit('${e.id}')">✏️</button>
            <button class="btn btn-danger btn-icon btn-sm" onclick="Employees.delete('${e.id}')">🗑</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  function _ensureModal() {
    if(document.getElementById('modal-employee')) return;
    const div=document.createElement('div');
    div.innerHTML=`
    <div class="modal-overlay" id="modal-employee">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3 id="emp-modal-title">Add Employee</h3>
          <button class="modal-close" onclick="closeModal('modal-employee')">✕</button>
        </div>
        <div class="modal-body">
          <div class="tab-strip">
            <button class="tab-btn active" onclick="Employees._tab(this,'emp-personal')">Personal</button>
            <button class="tab-btn" onclick="Employees._tab(this,'emp-employment')">Employment</button>
            <button class="tab-btn" onclick="Employees._tab(this,'emp-pf')">PF</button>
            <button class="tab-btn" onclick="Employees._tab(this,'emp-esic')">ESIC</button>
            <button class="tab-btn" onclick="Employees._tab(this,'emp-kyc')">KYC & Bank</button>
          </div>

          <!-- Personal -->
          <div class="tab-panel active" id="emp-personal">
            <div class="form-grid">
              <div class="form-group"><label>Employee ID</label><input class="form-control" id="e-id" placeholder="EMP001"/></div>
              <div class="form-group"><label>Full Name <span class="req">*</span></label><input class="form-control" id="e-name" placeholder="As per Aadhaar"/></div>
              <div class="form-group"><label>Date of Birth</label><input class="form-control" id="e-dob" type="date"/></div>
              <div class="form-group"><label>Gender</label>
                <select class="form-control" id="e-gender"><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div class="form-group"><label>Mobile</label><input class="form-control" id="e-mob" type="tel" placeholder="10-digit"/></div>
              <div class="form-group"><label>Email</label><input class="form-control" id="e-email" type="email"/></div>
              <div class="form-group full"><label>Address</label><textarea class="form-control" id="e-addr" rows="2"></textarea></div>
            </div>
          </div>

          <!-- Employment -->
          <div class="tab-panel" id="emp-employment">
            <div class="form-grid">
              <div class="form-group"><label>Date of Joining</label><input class="form-control" id="e-doj" type="date"/></div>
              <div class="form-group"><label>Department</label><input class="form-control" id="e-dept" placeholder="e.g. Operations"/></div>
              <div class="form-group"><label>Designation</label><input class="form-control" id="e-desg" placeholder="e.g. Site Engineer"/></div>
              <div class="form-group"><label>Monthly Salary (₹)</label><input class="form-control" id="e-sal" type="number" step="0.01" placeholder="0.00"/></div>
              <div class="form-group"><label>Status</label>
                <select class="form-control" id="e-status">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Left">Left</option>
                </select>
              </div>
            </div>
          </div>

          <!-- PF -->
          <div class="tab-panel" id="emp-pf">
            <div class="form-grid">
              <div class="form-group"><label>UAN (Universal Account No.)</label><input class="form-control" id="e-uan" placeholder="12-digit UAN" maxlength="12"/></div>
              <div class="form-group"><label>PF Number</label><input class="form-control" id="e-pfno" placeholder="MH/PUN/XXXXX"/></div>
              <div class="form-group"><label>PF Nominee Name</label><input class="form-control" id="e-pfnom" placeholder="Full name"/></div>
              <div class="form-group"><label>Nominee Relation (PF)</label><input class="form-control" id="e-pfnomr" placeholder="e.g. Wife, Son"/></div>
              <div class="form-group"><label>Previous PF Balance (₹)</label><input class="form-control" id="e-prevpf" type="number" step="0.01" placeholder="0.00"/></div>
              <div class="form-group"><label>Previous Employer</label><input class="form-control" id="e-prevempl" placeholder="Previous company name"/></div>
            </div>
          </div>

          <!-- ESIC -->
          <div class="tab-panel" id="emp-esic">
            <div class="form-grid">
              <div class="form-group"><label>ESIC IP Number</label><input class="form-control" id="e-esic" placeholder="17-digit IP No." maxlength="17"/></div>
              <div class="form-group"><label>ESIC Nominee Name</label><input class="form-control" id="e-esicnom" placeholder="Full name"/></div>
              <div class="form-group"><label>Nominee Relation (ESIC)</label><input class="form-control" id="e-esicnomr" placeholder="e.g. Wife"/></div>
            </div>
          </div>

          <!-- KYC & Bank -->
          <div class="tab-panel" id="emp-kyc">
            <div class="form-grid">
              <div class="form-section">KYC</div>
              <div class="form-group"><label>Aadhaar Number</label><input class="form-control" id="e-aadhar" placeholder="12-digit" maxlength="12"/></div>
              <div class="form-group"><label>PAN Number</label><input class="form-control" id="e-pan" placeholder="AAAAA0000A" oninput="this.value=this.value.toUpperCase()" maxlength="10"/></div>
              <div class="form-section">Bank Details</div>
              <div class="form-group"><label>Bank Name</label><input class="form-control" id="e-bnk" placeholder="e.g. SBI"/></div>
              <div class="form-group"><label>Account Number</label><input class="form-control" id="e-bacc"/></div>
              <div class="form-group"><label>IFSC Code</label><input class="form-control" id="e-ifsc" oninput="this.value=this.value.toUpperCase()"/></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeModal('modal-employee')">Cancel</button>
          <button class="btn btn-primary" onclick="Employees.save()">💾 Save Employee</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div);
  }

  function _tab(btn, panelId) {
    document.querySelectorAll('#modal-employee .tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('#modal-employee .tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(panelId)?.classList.add('active');
  }

  const FIELDS = {
    'e-id':SESSION,'e-name':'name','e-dob':'dob','e-gender':'gender','e-mob':'mobile',
    'e-email':'email','e-addr':'address','e-doj':'doj','e-dept':'department',
    'e-desg':'designation','e-sal':'salary','e-status':'status',
    'e-uan':'uan','e-pfno':'pfNumber','e-pfnom':'pfNominee','e-pfnomr':'pfNomineeRel',
    'e-prevpf':'prevPF','e-prevempl':'prevEmployer',
    'e-esic':'esicNumber','e-esicnom':'esicNominee','e-esicnomr':'esicNomineeRel',
    'e-aadhar':'aadhaar','e-pan':'pan','e-bnk':'bankName','e-bacc':'bankAcc','e-ifsc':'bankIFSC'
  };

  function openNew() {
    _editId = null;
    document.getElementById('emp-modal-title').textContent = 'Add Employee';
    Object.keys(FIELDS).filter(k=>k!=='e-id').forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('e-id').value     = '';
    document.getElementById('e-status').value = 'Active';
    document.getElementById('e-gender').value = '';
    // Reset to first tab
    document.querySelectorAll('#modal-employee .tab-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
    document.querySelectorAll('#modal-employee .tab-panel').forEach((p,i)=>p.classList.toggle('active',i===0));
    openModal('modal-employee');
  }

  function openEdit(id) {
    _editId = id;
    const e = _employees.find(x=>x.id===id);
    if (!e) return;
    document.getElementById('emp-modal-title').textContent = 'Edit — ' + e.name;
    const revMap = {
      'e-id':e.empId,'e-name':e.name,'e-dob':e.dob,'e-gender':e.gender,'e-mob':e.mobile,
      'e-email':e.email,'e-addr':e.address,'e-doj':e.doj,'e-dept':e.department,
      'e-desg':e.designation,'e-sal':e.salary,'e-status':e.status||'Active',
      'e-uan':e.uan,'e-pfno':e.pfNumber,'e-pfnom':e.pfNominee,'e-pfnomr':e.pfNomineeRel,
      'e-prevpf':e.prevPF,'e-prevempl':e.prevEmployer,
      'e-esic':e.esicNumber,'e-esicnom':e.esicNominee,'e-esicnomr':e.esicNomineeRel,
      'e-aadhar':e.aadhaar,'e-pan':e.pan,'e-bnk':e.bankName,'e-bacc':e.bankAcc,'e-ifsc':e.bankIFSC
    };
    Object.entries(revMap).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v||'';});
    document.querySelectorAll('#modal-employee .tab-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
    document.querySelectorAll('#modal-employee .tab-panel').forEach((p,i)=>p.classList.toggle('active',i===0));
    openModal('modal-employee');
  }

  async function save() {
    const name=document.getElementById('e-name').value.trim();
    if(!name){toast('Employee name is required','warning');return;}
    const btn=document.querySelector('#modal-employee .btn-primary');
    btn.disabled=true;btn.textContent='Saving…';
    const g=id=>{const el=document.getElementById(id);return el?el.value:'';};
    try {
      await API.saveEmployee({
        id:_editId||null,empId:g('e-id'),name,dob:g('e-dob'),gender:g('e-gender'),
        mobile:g('e-mob'),email:g('e-email'),address:g('e-addr'),doj:g('e-doj'),
        department:g('e-dept'),designation:g('e-desg'),salary:g('e-sal'),
        status:g('e-status'),uan:g('e-uan'),pfNumber:g('e-pfno'),
        pfNominee:g('e-pfnom'),pfNomineeRel:g('e-pfnomr'),
        prevPF:g('e-prevpf'),prevEmployer:g('e-prevempl'),
        esicNumber:g('e-esic'),esicNominee:g('e-esicnom'),esicNomineeRel:g('e-esicnomr'),
        aadhaar:g('e-aadhar'),pan:g('e-pan'),
        bankName:g('e-bnk'),bankAcc:g('e-bacc'),bankIFSC:g('e-ifsc')
      });
      toast('✅ Employee saved','success');
      closeModal('modal-employee');
      render();
    } catch(e){toast('Error: '+e.message,'error');}
    finally{btn.disabled=false;btn.textContent='💾 Save Employee';}
  }

  async function del(id) {
    const e=_employees.find(x=>x.id===id);
    const ok=await confirm(`Delete employee "${e?.name}"?`,'Delete Employee');
    if(!ok)return;
    try{await API.deleteEmployee(id);toast('🗑 Employee deleted','success');render();}
    catch(e){toast('Error: '+e.message,'error');}
  }

  function exportData() {
    if(!_employees.length){toast('No employees','warning');return;}
    const rows=[['Emp ID','Name','DOB','Gender','DOJ','Dept','Designation','Salary','UAN','PF No','ESIC No','Aadhaar','PAN','Status']];
    _employees.forEach(e=>rows.push([e.empId||'',e.name,e.dob||'',e.gender||'',e.doj||'',e.department||'',e.designation||'',e.salary||'',e.uan||'',e.pfNumber||'',e.esicNumber||'',e.aadhaar||'',e.pan||'',e.status||'']));
    exportExcel(rows,'Employees','EmployeeMaster.xlsx');
  }

  function _setSearch(q){_search=q;_applyFilter();}

  return { render, openNew, openEdit, save, delete: del, exportData, _setSearch, _tab };
})();
