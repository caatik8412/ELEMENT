/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — duedates.js
   ============================================================ */

'use strict';

const DueDates = (() => {

  let _records = [];
  let _filter  = { category: 'all', status: 'all', search: '' };

  const CATEGORIES = ['GST','TDS','PF','ESIC','Income Tax','ROC','Other'];
  const COMPLIANCES = {
    GST:        ['GSTR-1','GSTR-3B','GSTR-9 (Annual Return)','GSTR-9C'],
    TDS:        ['TDS Payment','TDS Return (24Q)','TDS Return (26Q)'],
    PF:         ['PF Payment','PF Annual Return (ECR)'],
    ESIC:       ['ESIC Payment','ESIC Half-Yearly Return'],
    'Income Tax':['Advance Tax (15%)','Advance Tax (45%)','Advance Tax (75%)','Advance Tax (100%)','Income Tax Return','Tax Audit (Form 3CD)'],
    ROC:        ['ROC — AOC-4','ROC — MGT-7A'],
    Other:      ['Other']
  };

  async function render() {
    _records = await API.getDueDates();
    _renderShell();
    _applyFilter();
    _ensureModal();
  }

  function _renderShell() {
    const el      = document.getElementById('content');
    const today0  = new Date(); today0.setHours(0,0,0,0);
    const pending = _records.filter(r => r.status !== 'Done' && r.status !== 'Completed');
    const overdue = pending.filter(r => daysUntil(r.dueDate) < 0);
    const due7    = pending.filter(r => { const d=daysUntil(r.dueDate); return d>=0&&d<=7; });
    const due30   = pending.filter(r => { const d=daysUntil(r.dueDate); return d>7&&d<=30; });

    el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card" style="--c:var(--red)">
        <div class="s-icon">🚨</div>
        <div class="s-label">Overdue</div>
        <div class="s-value" style="color:var(--red)">${overdue.length}</div>
        <div class="s-sub">Past due date</div>
      </div>
      <div class="stat-card" style="--c:var(--yellow)">
        <div class="s-icon">⚠️</div>
        <div class="s-label">Due in 7 Days</div>
        <div class="s-value" style="color:var(--yellow)">${due7.length}</div>
        <div class="s-sub">Immediate action needed</div>
      </div>
      <div class="stat-card" style="--c:var(--orange)">
        <div class="s-icon">📅</div>
        <div class="s-label">Due in 30 Days</div>
        <div class="s-value">${due30.length}</div>
        <div class="s-sub">Plan ahead</div>
      </div>
      <div class="stat-card" style="--c:var(--green)">
        <div class="s-icon">✅</div>
        <div class="s-label">Completed</div>
        <div class="s-value" style="color:var(--green)">${_records.filter(r=>r.status==='Done'||r.status==='Completed').length}</div>
        <div class="s-sub">of ${_records.length} total</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Compliance Calendar</h2>
        <div class="card-actions">
          <div class="pill-group">
            ${['all',...CATEGORIES].map((c,i)=>
              `<button class="pill-btn ${i===0?'active':''}" id="dd-cat-${c.replace(/\s/g,'_')}"
                onclick="DueDates._setCat('${c}')">${i===0?'All':c}</button>`
            ).join('')}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <div class="pill-group">
          ${['all','Pending','Done'].map((s,i)=>
            `<button class="pill-btn ${i===0?'active':''}" id="dd-st-${s}"
              onclick="DueDates._setSt('${s}')">${i===0?'All Status':s}</button>`
          ).join('')}
        </div>
        <input class="form-control" style="width:180px;padding:6px 10px" type="text"
          placeholder="Search…" oninput="DueDates._setSearch(this.value)"/>
        <button class="btn btn-warning btn-sm np" onclick="DueDates.seed()">🔁 Load FY Defaults</button>
        <button class="btn btn-outline btn-sm np"  onclick="DueDates.exportData()">⬇️ Export</button>
        <button class="btn btn-primary btn-sm np"  onclick="DueDates.openNew()">+ Add</button>
      </div>
      <div id="dd-table-wrap"></div>
    </div>`;
  }

  function _applyFilter() {
    let list = [..._records];
    if (_filter.category !== 'all') list = list.filter(r => r.category === _filter.category);
    if (_filter.status   !== 'all') {
      if (_filter.status === 'Done') list = list.filter(r => r.status === 'Done' || r.status === 'Completed');
      else                           list = list.filter(r => r.status === 'Pending' || !r.status);
    }
    if (_filter.search) {
      const q = _filter.search.toLowerCase();
      list = list.filter(r => (r.compliance||'').toLowerCase().includes(q) || (r.period||'').toLowerCase().includes(q));
    }
    list.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    _renderTable(list);
  }

  function _renderTable(list) {
    const wrap = document.getElementById('dd-table-wrap');
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state"><span class="es-icon">📅</span>
        <h3>No due dates found</h3>
        <p>Click "Load FY Defaults" to populate the full compliance calendar.</p>
        <button class="btn btn-warning np" onclick="DueDates.seed()">🔁 Load FY Defaults</button>
      </div>`;
      return;
    }
    wrap.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Compliance</th><th>Category</th><th>Period</th>
        <th>Due Date</th><th>Days</th><th>Status</th>
        <th>Completed By</th><th>Remarks</th>
        <th class="np">Actions</th>
      </tr></thead>
      <tbody>
        ${list.map(r => {
          const days  = daysUntil(r.dueDate);
          const done  = r.status === 'Done' || r.status === 'Completed';
          const cls   = done ? 'dd-done' : days < 0 ? 'dd-overdue' : days <= 7 ? 'dd-soon' : 'dd-ok';
          const lbl   = done ? '✅ Done' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'TODAY' : `${days}d`;
          const rowBg = done ? '' : days < 0 ? 'background:#FEF2F2' : days <= 7 ? 'background:#FEFCE8' : '';
          return `<tr style="${rowBg}">
            <td style="font-weight:600">${esc(r.compliance)}</td>
            <td><span class="badge badge-blue">${esc(r.category||'—')}</span></td>
            <td style="font-size:11.5px;color:var(--muted)">${esc(r.period||'—')}</td>
            <td style="white-space:nowrap;font-weight:600">${fmtDate(r.dueDate)}</td>
            <td class="${cls}">${lbl}</td>
            <td>${done
              ? `<span class="badge badge-green">✅ Done</span>`
              : `<span class="badge badge-yellow">Pending</span>`
            }</td>
            <td style="font-size:11.5px;color:var(--muted)">${esc(r.completedBy||'—')}</td>
            <td style="font-size:11.5px;color:var(--muted)">${trunc(r.remarks||'—',30)}</td>
            <td class="np" style="white-space:nowrap">
              <button class="btn btn-${done?'outline':'success'} btn-sm"
                onclick="DueDates.toggleDone('${r.id}','${r.status||'Pending'}')">
                ${done ? '↩ Reopen' : '✅ Mark Done'}
              </button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="DueDates.openEdit('${r.id}')">✏️</button>
              <button class="btn btn-danger btn-icon btn-sm" onclick="DueDates.delete('${r.id}')">🗑</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }

  function _ensureModal() {
    if (document.getElementById('modal-duedate')) return;
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal-overlay" id="modal-duedate">
      <div class="modal modal-sm">
        <div class="modal-header">
          <h3 id="dd-modal-title">Add Due Date</h3>
          <button class="modal-close" onclick="closeModal('modal-duedate')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group full">
              <label>Category <span class="req">*</span></label>
              <select class="form-control" id="dd-cat" onchange="DueDates._onCatChange()">
                ${CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group full">
              <label>Compliance <span class="req">*</span></label>
              <select class="form-control" id="dd-comp">
                <option value="">— Select —</option>
              </select>
            </div>
            <div class="form-group">
              <label>Period</label>
              <input class="form-control" id="dd-period" placeholder="e.g. Apr 2025 / Q1 FY25-26"/>
            </div>
            <div class="form-group">
              <label>Due Date <span class="req">*</span></label>
              <input class="form-control" id="dd-date" type="date"/>
            </div>
            <div class="form-group full">
              <label>Status</label>
              <select class="form-control" id="dd-status">
                <option value="Pending">Pending</option>
                <option value="Done">Done</option>
                <option value="NA">N/A</option>
              </select>
            </div>
            <div class="form-group full">
              <label>Completed By</label>
              <input class="form-control" id="dd-by" placeholder="Name of person"/>
            </div>
            <div class="form-group full">
              <label>Remarks</label>
              <input class="form-control" id="dd-rem" placeholder="Any notes"/>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeModal('modal-duedate')">Cancel</button>
          <button class="btn btn-primary" onclick="DueDates.save()">💾 Save</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div);
    _onCatChange();
  }

  let _editId = null;

  function _onCatChange() {
    const cat  = document.getElementById('dd-cat')?.value || CATEGORIES[0];
    const comp = document.getElementById('dd-comp');
    if (!comp) return;
    const opts = COMPLIANCES[cat] || ['Other'];
    comp.innerHTML = opts.map(c=>`<option value="${c}">${c}</option>`).join('');
  }

  function openNew() {
    _editId = null;
    document.getElementById('dd-modal-title').textContent = 'Add Due Date';
    ['dd-period','dd-date','dd-by','dd-rem'].forEach(id => { const el=document.getElementById(id); if(el)el.value=''; });
    document.getElementById('dd-cat').value    = CATEGORIES[0];
    document.getElementById('dd-status').value = 'Pending';
    _onCatChange();
    openModal('modal-duedate');
  }

  function openEdit(id) {
    _editId = id;
    const r = _records.find(x => x.id === id);
    if (!r) return;
    document.getElementById('dd-modal-title').textContent = 'Edit Due Date';
    document.getElementById('dd-cat').value    = r.category   || CATEGORIES[0];
    _onCatChange();
    document.getElementById('dd-comp').value   = r.compliance || '';
    document.getElementById('dd-period').value = r.period     || '';
    document.getElementById('dd-date').value   = r.dueDate    || '';
    document.getElementById('dd-status').value = r.status     || 'Pending';
    document.getElementById('dd-by').value     = r.completedBy|| '';
    document.getElementById('dd-rem').value    = r.remarks    || '';
    openModal('modal-duedate');
  }

  async function save() {
    const date = document.getElementById('dd-date').value;
    const comp = document.getElementById('dd-comp').value;
    if (!date) { toast('Due date is required', 'warning'); return; }
    if (!comp) { toast('Select a compliance type', 'warning'); return; }
    const btn = document.querySelector('#modal-duedate .btn-primary');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await API.saveDueDate({
        id:          _editId || null,
        compliance:  comp,
        category:    document.getElementById('dd-cat').value,
        period:      document.getElementById('dd-period').value,
        dueDate:     date,
        status:      document.getElementById('dd-status').value,
        completedBy: document.getElementById('dd-by').value,
        remarks:     document.getElementById('dd-rem').value
      });
      toast('✅ Due date saved', 'success');
      closeModal('modal-duedate');
      render();
    } catch(e) { toast('Error: '+e.message, 'error'); }
    finally { btn.disabled=false; btn.textContent='💾 Save'; }
  }

  async function toggleDone(id, currentStatus) {
    const done    = currentStatus === 'Done' || currentStatus === 'Completed';
    const newSt   = done ? 'Pending' : 'Done';
    const newBy   = done ? '' : (SESSION.user?.name || SESSION.user?.userId || '');
    try {
      await API.saveDueDate({ id, status: newSt, completedBy: newBy });
      toast(done ? '↩ Reopened' : '✅ Marked as Done', 'success');
      render();
    } catch(e) { toast('Error: '+e.message, 'error'); }
  }

  async function del(id) {
    const ok = await confirm('Delete this due date?', 'Delete');
    if (!ok) return;
    try { await API.deleteDueDate(id); toast('🗑 Deleted', 'success'); render(); }
    catch(e) { toast('Error: '+e.message, 'error'); }
  }

  async function seed() {
    const ok = await confirm(`Load all standard compliance dates for FY ${getCurrentFY()}?\nExisting entries will not be overwritten.`, 'Load FY Defaults');
    if (!ok) return;
    try {
      const r = await API.seedDueDates({ fy: getCurrentFY() });
      toast(`✅ ${r.seeded} due dates loaded for FY ${r.fy}`, 'success');
      render();
    } catch(e) { toast('Error: '+e.message, 'error'); }
  }

  function exportData() {
    if (!_records.length) { toast('No data to export', 'warning'); return; }
    const rows=[['Compliance','Category','Period','Due Date','Status','Completed By','Remarks']];
    _records.forEach(r=>rows.push([r.compliance,r.category||'',r.period||'',r.dueDate,r.status||'Pending',r.completedBy||'',r.remarks||'']));
    exportExcel(rows,'DueDates',`ComplianceCalendar_${getCurrentFY()}.xlsx`);
  }

  function _setCat(v)    { _filter.category = v; _applyFilter();
    ['all',...CATEGORIES].forEach(c=>{const el=document.getElementById('dd-cat-'+c.replace(/\s/g,'_'));if(el)el.classList.toggle('active',_filter.category===c);}); }
  function _setSt(v)     { _filter.status   = v; _applyFilter();
    ['all','Pending','Done'].forEach(s=>{const el=document.getElementById('dd-st-'+s);if(el)el.classList.toggle('active',_filter.status===s);}); }
  function _setSearch(q) { _filter.search   = q; _applyFilter(); }

  return { render, openNew, openEdit, save, toggleDone, delete: del, seed, exportData,
           _setCat, _setSt, _setSearch, _onCatChange };
})();
