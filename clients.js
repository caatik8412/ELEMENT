/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — clients.js
   ============================================================ */

'use strict';

const Clients = (() => {

  let _clients = [];
  let _editId  = null;
  let _search  = '';

  async function render() {
    _clients = await API.getClients();
    _renderShell();
    _applyFilter();
    _ensureModal();
  }

  function _renderShell() {
    document.getElementById('content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card" style="--c:var(--navy-400)"><div class="s-icon">🏢</div>
        <div class="s-label">Total Clients</div><div class="s-value">${_clients.length}</div></div>
      <div class="stat-card" style="--c:var(--green)"><div class="s-icon">✅</div>
        <div class="s-label">With GSTIN</div>
        <div class="s-value">${_clients.filter(c=>c.gstin).length}</div>
        <div class="s-sub">GST registered</div></div>
      <div class="stat-card" style="--c:var(--yellow)"><div class="s-icon">🔖</div>
        <div class="s-label">Without GSTIN</div>
        <div class="s-value">${_clients.filter(c=>!c.gstin).length}</div>
        <div class="s-sub">B2C / unregistered</div></div>
    </div>
    <div class="card">
      <div class="card-header">
        <h2>Client Master</h2>
        <div class="card-actions">
          <input class="form-control" style="width:200px;padding:6px 10px" type="text"
            placeholder="Search…" oninput="Clients._setSearch(this.value)"/>
          <button class="btn btn-outline np" onclick="Clients.exportData()">⬇️ Export</button>
          <button class="btn btn-primary np" onclick="Clients.openNew()">+ Add Client</button>
        </div>
      </div>
      <div id="cl-table-wrap"></div>
    </div>`;
  }

  function _applyFilter() {
    let list = [..._clients];
    if (_search) {
      const q = _search.toLowerCase();
      list = list.filter(c =>
        (c.name||'').toLowerCase().includes(q) ||
        (c.gstin||'').toLowerCase().includes(q) ||
        (c.contactPerson||'').toLowerCase().includes(q)
      );
    }
    _renderTable(list.sort((a,b)=>a.name.localeCompare(b.name)));
  }

  function _renderTable(list) {
    const wrap = document.getElementById('cl-table-wrap');
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state"><span class="es-icon">🏢</span>
        <h3>No clients found</h3><p>Add your first client.</p>
        <button class="btn btn-primary np" onclick="Clients.openNew()">+ Add Client</button></div>`;
      return;
    }
    wrap.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Company Name</th><th>GSTIN</th><th>PAN</th><th>State</th>
        <th>Contact Person</th><th>Phone</th><th>Email</th><th class="np">Actions</th></tr></thead>
      <tbody>
        ${list.map(c=>`<tr>
          <td style="font-weight:700">${esc(c.name)}</td>
          <td style="font-family:monospace;font-size:11px">${c.gstin||'—'}</td>
          <td style="font-family:monospace;font-size:11px">${c.pan||'—'}</td>
          <td>${c.state||'—'}</td>
          <td>${c.contactPerson||'—'}</td>
          <td>${c.phone||'—'}</td>
          <td style="font-size:11.5px">${c.email||'—'}</td>
          <td class="np" style="white-space:nowrap">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="Clients.openEdit('${c.id}')">✏️</button>
            <button class="btn btn-danger btn-icon btn-sm" onclick="Clients.delete('${c.id}')">🗑</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  function _ensureModal() {
    if (document.getElementById('modal-client')) return;
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal-overlay" id="modal-client">
      <div class="modal">
        <div class="modal-header">
          <h3 id="cl-modal-title">Add Client</h3>
          <button class="modal-close" onclick="closeModal('modal-client')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-section">Company Details</div>
            <div class="form-group full">
              <label>Company / Client Name <span class="req">*</span></label>
              <input class="form-control" id="cl-name" placeholder="Full legal name"/>
            </div>
            <div class="form-group">
              <label>GSTIN</label>
              <input class="form-control" id="cl-gstin" placeholder="27AAAAA0000A1Z5"
                oninput="this.value=this.value.toUpperCase()" maxlength="15"/>
            </div>
            <div class="form-group">
              <label>PAN</label>
              <input class="form-control" id="cl-pan" placeholder="AAAAA0000A"
                oninput="this.value=this.value.toUpperCase()" maxlength="10"/>
            </div>
            <div class="form-group">
              <label>State</label>
              <select class="form-control" id="cl-state"
                onchange="document.getElementById('cl-sc').value=stateCode(this.value)">
                <option value="">— Select —</option>
              </select>
            </div>
            <div class="form-group">
              <label>State Code</label>
              <input class="form-control" id="cl-sc" readonly/>
            </div>
            <div class="form-group">
              <label>City</label>
              <input class="form-control" id="cl-city" placeholder="City"/>
            </div>
            <div class="form-group full">
              <label>Address</label>
              <textarea class="form-control" id="cl-addr" rows="2" placeholder="Full billing address"></textarea>
            </div>
            <div class="form-section">Contact</div>
            <div class="form-group">
              <label>Contact Person</label>
              <input class="form-control" id="cl-cp" placeholder="Name"/>
            </div>
            <div class="form-group">
              <label>Mobile</label>
              <input class="form-control" id="cl-ph" type="tel" placeholder="10-digit"/>
            </div>
            <div class="form-group">
              <label>Email</label>
              <input class="form-control" id="cl-em" type="email" placeholder="email@company.com"/>
            </div>
            <div class="form-section">Bank Details</div>
            <div class="form-group">
              <label>Bank Name</label>
              <input class="form-control" id="cl-bnk" placeholder="e.g. HDFC Bank"/>
            </div>
            <div class="form-group">
              <label>Account Number</label>
              <input class="form-control" id="cl-bacc"/>
            </div>
            <div class="form-group">
              <label>IFSC Code</label>
              <input class="form-control" id="cl-ifsc"
                oninput="this.value=this.value.toUpperCase()" placeholder="HDFC0001234"/>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeModal('modal-client')">Cancel</button>
          <button class="btn btn-primary" onclick="Clients.save()">💾 Save Client</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div);
    populateStateSelect('cl-state');
  }

  function openNew() {
    _editId = null;
    document.getElementById('cl-modal-title').textContent = 'Add Client';
    ['cl-name','cl-gstin','cl-pan','cl-city','cl-addr','cl-cp','cl-ph','cl-em','cl-bnk','cl-bacc','cl-ifsc','cl-sc'].forEach(id=>{
      const el=document.getElementById(id); if(el)el.value='';});
    document.getElementById('cl-state').value='';
    openModal('modal-client');
  }

  function openEdit(id) {
    _editId = id;
    const c = _clients.find(x=>x.id===id);
    if (!c) return;
    document.getElementById('cl-modal-title').textContent = 'Edit Client';
    const map = {
      'cl-name':c.name,'cl-gstin':c.gstin,'cl-pan':c.pan,'cl-city':c.city,
      'cl-addr':c.address,'cl-cp':c.contactPerson,'cl-ph':c.phone,'cl-em':c.email,
      'cl-bnk':c.bankName,'cl-bacc':c.bankAcc,'cl-ifsc':c.bankIFSC,'cl-sc':c.stateCode
    };
    Object.entries(map).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v||'';});
    document.getElementById('cl-state').value = c.state || '';
    openModal('modal-client');
  }

  async function save() {
    const name = document.getElementById('cl-name').value.trim();
    if (!name) { toast('Client name is required', 'warning'); return; }
    const btn = document.querySelector('#modal-client .btn-primary');
    btn.disabled=true; btn.textContent='Saving…';
    try {
      await API.saveClient({
        id:            _editId||null,
        name,
        gstin:         document.getElementById('cl-gstin').value,
        pan:           document.getElementById('cl-pan').value,
        state:         document.getElementById('cl-state').value,
        stateCode:     document.getElementById('cl-sc').value,
        city:          document.getElementById('cl-city').value,
        address:       document.getElementById('cl-addr').value,
        contactPerson: document.getElementById('cl-cp').value,
        phone:         document.getElementById('cl-ph').value,
        email:         document.getElementById('cl-em').value,
        bankName:      document.getElementById('cl-bnk').value,
        bankAcc:       document.getElementById('cl-bacc').value,
        bankIFSC:      document.getElementById('cl-ifsc').value
      });
      toast('✅ Client saved', 'success');
      closeModal('modal-client');
      render();
    } catch(e) { toast('Error: '+e.message, 'error'); }
    finally { btn.disabled=false; btn.textContent='💾 Save Client'; }
  }

  async function del(id) {
    const c=_clients.find(x=>x.id===id);
    const ok=await confirm(`Delete client "${c?.name}"?`, 'Delete Client');
    if(!ok) return;
    try { await API.deleteClient(id); toast('🗑 Client deleted','success'); render(); }
    catch(e) { toast('Error: '+e.message,'error'); }
  }

  function exportData() {
    if(!_clients.length){toast('No clients','warning');return;}
    const rows=[['Name','GSTIN','PAN','State','City','Address','Contact Person','Phone','Email','Bank Name','Account','IFSC']];
    _clients.forEach(c=>rows.push([c.name,c.gstin||'',c.pan||'',c.state||'',c.city||'',c.address||'',c.contactPerson||'',c.phone||'',c.email||'',c.bankName||'',c.bankAcc||'',c.bankIFSC||'']));
    exportExcel(rows,'Clients','ClientMaster.xlsx');
  }

  function _setSearch(q) { _search=q; _applyFilter(); }

  return { render, openNew, openEdit, save, delete: del, exportData, _setSearch };
})();
