/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — settings.js
   ============================================================ */

'use strict';

const Settings = (() => {

  let _section  = 'company';
  let _settings = {};
  let _users    = [];

  async function render() {
    [_settings, _users] = await Promise.all([API.getSettings(), API.getUsers()]);
    _renderShell();
    _renderSection();
  }

  function _renderShell() {
    document.getElementById('content').innerHTML = `
    <div class="settings-grid">
      <div class="settings-nav">
        ${[
          ['company',  '🏢', 'Company Profile'],
          ['invoice',  '🧾', 'Invoice Series'],
          ['users',    '👤', 'User Management'],
          ['activity', '📋', 'Activity Log'],
          ['backup',   '💾', 'Backup & Reset'],
        ].map(([k,ic,l])=>`<div class="settings-nav-item ${k===_section?'active':''}"
          onclick="Settings._setSection('${k}')">
          <span class="si">${ic}</span>${l}</div>`).join('')}
      </div>
      <div id="settings-panel"></div>
    </div>`;
    _renderSection();
  }

  function _renderSection() {
    const panel = document.getElementById('settings-panel');
    if(!panel) return;

    if(_section==='company')  _renderCompany(panel);
    else if(_section==='invoice') _renderInvoice(panel);
    else if(_section==='users')   _renderUsers(panel);
    else if(_section==='activity')_renderActivity(panel);
    else if(_section==='backup')  _renderBackup(panel);
  }

  function _renderCompany(panel) {
    const s = _settings;
    panel.innerHTML=`
    <div class="card">
      <div class="card-header"><h2>Company Profile</h2></div>
      <div class="form-grid">
        <div class="form-section">Company Details</div>
        <div class="form-group full"><label>Company Name</label><input class="form-control" id="s-coname" value="${esc(s.companyName||APP.COMPANY.name)}"/></div>
        <div class="form-group"><label>GSTIN</label><input class="form-control" id="s-gstin" value="${esc(s.gstin||APP.COMPANY.gstin)}" oninput="this.value=this.value.toUpperCase()"/></div>
        <div class="form-group"><label>CIN</label><input class="form-control" id="s-cin" value="${esc(s.cin||APP.COMPANY.cin)}"/></div>
        <div class="form-group"><label>PAN</label><input class="form-control" id="s-pan" value="${esc(s.pan||APP.COMPANY.pan)}"/></div>
        <div class="form-group full"><label>Address Line 1</label><input class="form-control" id="s-addr1" value="${esc(s.address1||APP.COMPANY.addr1)}"/></div>
        <div class="form-group full"><label>Address Line 2</label><input class="form-control" id="s-addr2" value="${esc(s.address2||APP.COMPANY.addr2)}"/></div>
        <div class="form-group"><label>Email</label><input class="form-control" id="s-email" type="email" value="${esc(s.email||APP.COMPANY.email)}"/></div>
        <div class="form-group"><label>Website</label><input class="form-control" id="s-web" value="${esc(s.website||APP.COMPANY.web)}"/></div>
        <div class="form-section">Bank Details</div>
        <div class="form-group"><label>Bank Name</label><input class="form-control" id="s-bnk" value="${esc(s.bankName||APP.COMPANY.bank)}"/></div>
        <div class="form-group"><label>Account Number</label><input class="form-control" id="s-bacc" value="${esc(s.bankAcc||APP.COMPANY.acc)}"/></div>
        <div class="form-group"><label>IFSC Code</label><input class="form-control" id="s-bifsc" value="${esc(s.bankIFSC||APP.COMPANY.ifsc)}" oninput="this.value=this.value.toUpperCase()"/></div>
        <div class="form-group"><label>Branch</label><input class="form-control" id="s-bbranch" value="${esc(s.bankBranch||APP.COMPANY.branch)}"/></div>
        <div class="form-group full" style="margin-top:8px">
          <button class="btn btn-primary np" onclick="Settings._saveCompany()">💾 Save Company Profile</button>
        </div>
      </div>
    </div>`;
  }

  async function _saveCompany() {
    const g=id=>document.getElementById(id)?.value||'';
    const btn=document.querySelector('.settings-panel .btn-primary, #settings-panel .btn-primary');
    try {
      await API.saveSettings({
        companyName:g('s-coname'),gstin:g('s-gstin'),cin:g('s-cin'),pan:g('s-pan'),
        address1:g('s-addr1'),address2:g('s-addr2'),email:g('s-email'),website:g('s-web'),
        bankName:g('s-bnk'),bankAcc:g('s-bacc'),bankIFSC:g('s-bifsc'),bankBranch:g('s-bbranch')
      });
      toast('✅ Company profile saved','success');
    } catch(e){toast('Error: '+e.message,'error');}
  }

  function _renderInvoice(panel) {
    const s=_settings;
    panel.innerHTML=`
    <div class="card">
      <div class="card-header"><h2>Invoice Series</h2></div>
      <div class="form-grid">
        <div class="form-group">
          <label>Invoice Prefix</label>
          <input class="form-control" id="s-ipfx" value="${esc(s.invoicePrefix||'ECS')}"/>
          <span class="form-hint">e.g. ECS → ECS/26-27/001</span>
        </div>
        <div class="form-group">
          <label>Current FY</label>
          <input class="form-control" id="s-fy" value="${esc(s.currentFY||getCurrentFY())}"/>
          <span class="form-hint">Format: 26-27</span>
        </div>
        <div class="form-group full" style="margin-top:8px">
          <button class="btn btn-primary np" onclick="Settings._saveInvoice()">💾 Save</button>
        </div>
        <div class="form-section" style="margin-top:16px">Preview</div>
        <div class="form-group full">
          <div style="padding:12px 16px;background:var(--bg);border-radius:var(--radius);font-family:monospace;font-size:14px;font-weight:700;color:var(--navy-600)">
            ${esc(s.invoicePrefix||'ECS')}/${esc(s.currentFY||getCurrentFY())}/001
          </div>
        </div>
      </div>
    </div>`;
  }

  async function _saveInvoice() {
    try {
      await API.saveSettings({
        invoicePrefix: document.getElementById('s-ipfx')?.value||'ECS',
        currentFY:     document.getElementById('s-fy')?.value||getCurrentFY()
      });
      toast('✅ Invoice settings saved','success');
      _settings = await API.getSettings();
      _renderInvoice(document.getElementById('settings-panel'));
    } catch(e){toast('Error: '+e.message,'error');}
  }

  function _renderUsers(panel) {
    panel.innerHTML=`
    <div class="card">
      <div class="card-header">
        <h2>User Management</h2>
        ${SESSION.isAdmin()?`<button class="btn btn-primary btn-sm np" onclick="Settings.openNewUser()">+ Add User</button>`:''}
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>User ID</th><th>Name</th><th>Email</th><th>Role</th><th>Active</th>${SESSION.isAdmin()?'<th class="np">Actions</th>':''}</tr></thead>
        <tbody>
          ${_users.map(u=>`<tr>
            <td style="font-weight:700;font-family:monospace">${esc(u.userId)}</td>
            <td>${esc(u.name)}</td>
            <td style="font-size:11.5px">${esc(u.email||'—')}</td>
            <td>${badge(u.role)}</td>
            <td>${u.active==='true'?`<span class="badge badge-green">Active</span>`:`<span class="badge badge-gray">Inactive</span>`}</td>
            ${SESSION.isAdmin()?`<td class="np" style="white-space:nowrap">
              <button class="btn btn-ghost btn-icon btn-sm" onclick="Settings.openEditUser('${u.id}')">✏️</button>
              ${u.userId!==SESSION.user?.userId?`<button class="btn btn-danger btn-icon btn-sm" onclick="Settings.deleteUser('${u.id}')">🗑</button>`:'<span style="font-size:10px;color:var(--muted)">You</span>'}
            </td>`:''}
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
    <!-- User Modal -->
    <div class="modal-overlay" id="modal-user">
      <div class="modal modal-sm">
        <div class="modal-header"><h3 id="user-modal-title">Add User</h3>
          <button class="modal-close" onclick="closeModal('modal-user')">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full"><label>User ID <span class="req">*</span></label><input class="form-control" id="u-uid" placeholder="Unique login ID"/></div>
            <div class="form-group full"><label>Full Name</label><input class="form-control" id="u-name" placeholder="Display name"/></div>
            <div class="form-group full"><label>Email</label><input class="form-control" id="u-email" type="email"/></div>
            <div class="form-group"><label>Role</label>
              <select class="form-control" id="u-role">
                <option value="Admin">Admin</option>
                <option value="Staff">Staff</option>
                <option value="View">View Only</option>
              </select>
            </div>
            <div class="form-group"><label>Active</label>
              <select class="form-control" id="u-active">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div class="form-group full"><label>Password</label><input class="form-control" id="u-pw" type="password" placeholder="Leave blank to keep existing"/></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeModal('modal-user')">Cancel</button>
          <button class="btn btn-primary" onclick="Settings.saveUser()">💾 Save</button>
        </div>
      </div>
    </div>`;
  }

  let _editUserId = null;

  function openNewUser() {
    _editUserId=null;
    document.getElementById('user-modal-title').textContent='Add User';
    ['u-uid','u-name','u-email','u-pw'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('u-role').value='Staff';
    document.getElementById('u-active').value='true';
    openModal('modal-user');
  }

  function openEditUser(id) {
    _editUserId=id;
    const u=_users.find(x=>x.id===id);
    if(!u) return;
    document.getElementById('user-modal-title').textContent='Edit User';
    document.getElementById('u-uid').value    = u.userId||'';
    document.getElementById('u-name').value   = u.name||'';
    document.getElementById('u-email').value  = u.email||'';
    document.getElementById('u-role').value   = u.role||'Staff';
    document.getElementById('u-active').value = u.active||'true';
    document.getElementById('u-pw').value     = '';
    openModal('modal-user');
  }

  async function saveUser() {
    const uid=document.getElementById('u-uid').value.trim();
    if(!uid){toast('User ID required','warning');return;}
    const btn=document.querySelector('#modal-user .btn-primary');
    btn.disabled=true;btn.textContent='Saving…';
    try {
      const d={id:_editUserId||null,userId:uid,name:document.getElementById('u-name').value,
        email:document.getElementById('u-email').value,role:document.getElementById('u-role').value,
        active:document.getElementById('u-active').value};
      const pw=document.getElementById('u-pw').value;
      if(pw) d.password=pw;
      await API.saveUser(d);
      toast('✅ User saved','success');
      closeModal('modal-user');
      _users=await API.getUsers();
      _renderUsers(document.getElementById('settings-panel'));
    } catch(e){toast('Error: '+e.message,'error');}
    finally{btn.disabled=false;btn.textContent='💾 Save';}
  }

  async function deleteUser(id) {
    const ok=await confirm('Delete this user?','Delete User');
    if(!ok) return;
    try {
      await API.deleteUser(id);
      toast('🗑 User deleted','success');
      _users=await API.getUsers();
      _renderUsers(document.getElementById('settings-panel'));
    } catch(e){toast('Error: '+e.message,'error');}
  }

  async function _renderActivity(panel) {
    panel.innerHTML=`<div class="card"><div class="card-header"><h2>Activity Log</h2></div>
      <div class="page-loader"><span class="spinner"></span>Loading…</div></div>`;
    try {
      const rows=await API.getActivity();
      panel.innerHTML=`<div class="card"><div class="card-header"><h2>Activity Log</h2>
        <span style="font-size:11px;color:var(--muted)">Last 200 entries</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>${rows.map(r=>`<tr>
            <td style="font-size:11px;white-space:nowrap">${fmtDT(r.timestamp)}</td>
            <td style="font-family:monospace;font-size:11.5px">${esc(r.userId||'System')}</td>
            <td><span class="badge badge-blue">${esc(r.action)}</span></td>
            <td style="font-size:11.5px;color:var(--muted)">${esc(r.detail||'—')}</td>
          </tr>`).join('')||'<tr><td colspan="4" class="table-empty">No activity yet</td></tr>'}
          </tbody>
        </table></div>
      </div>`;
    } catch(e){panel.innerHTML=`<div class="card"><p style="color:var(--red)">⚠️ ${e.message}</p></div>`;}
  }

  function _renderBackup(panel) {
    panel.innerHTML=`
    <div class="card">
      <div class="card-header"><h2>Backup & Reset</h2></div>
      <div style="display:flex;flex-direction:column;gap:16px;max-width:480px">
        <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius)">
          <div style="font-weight:700;margin-bottom:6px">📥 Re-run Setup</div>
          <div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">
            Recreates any missing sheets without deleting existing data. Safe to run anytime.
          </div>
          <button class="btn btn-outline np" onclick="Settings.runSetup()">🔄 Run Setup</button>
        </div>
        <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius)">
          <div style="font-weight:700;margin-bottom:6px">📊 Open Google Sheet</div>
          <div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">
            Open the underlying Google Sheet to view or manually manage data.
          </div>
          <button class="btn btn-outline np" onclick="window.open('https://docs.google.com/spreadsheets','_blank')">Open Sheets</button>
        </div>
        <div style="padding:16px;border:1px solid #FECACA;border-radius:var(--radius);background:#FFF5F5">
          <div style="font-weight:700;color:var(--red);margin-bottom:6px">⚠️ About Data</div>
          <div style="font-size:12.5px;color:var(--muted)">
            All data is stored in your Google Sheet. To backup, download the Sheet as Excel from Google Drive. No data is stored in this browser.
          </div>
        </div>
      </div>
    </div>`;
  }

  async function runSetup() {
    try {
      const r=await API.setup();
      toast(`✅ Setup complete — ${r.sheets} sheets verified`,'success');
    } catch(e){toast('Error: '+e.message,'error');}
  }

  function _setSection(s){_section=s;
    document.querySelectorAll('.settings-nav-item').forEach((el,i)=>el.classList.toggle('active',Object.keys({company:1,invoice:1,users:1,activity:1,backup:1})[i]===s));
    _renderSection();}

  return { render, _setSection, _saveCompany, _saveInvoice,
           openNewUser, openEditUser, saveUser, deleteUser, runSetup };
})();
