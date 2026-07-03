/* ============================================================
   THE ELEMENT ENVIRONMENT PRIVATE LIMITED
   Office Manager V1 — dashboard.js
   ============================================================ */

'use strict';

const Dashboard = (() => {

  // ── Render ───────────────────────────────────────────────
  async function render() {
    const el = document.getElementById('content');

    // Fetch all data in parallel
    const [invoices, purchases, outstanding, dueDates, employees] = await Promise.all([
      API.getInvoices(),
      API.getPurchases(),
      API.getOutstanding(),
      API.getDueDates(),
      API.getEmployees()
    ]);

    // ── Compute this month's figures ──
    const now   = new Date();
    const thisM = now.getMonth();
    const thisY = now.getFullYear();

    const inMonth = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === thisM && d.getFullYear() === thisY;
    };

    // Sales this month (Tax Invoices only)
    const salesInvs   = invoices.filter(i => (i.docType || 'Invoice') === 'Invoice' && inMonth(i.invoiceDate));
    const salesMonth  = salesInvs.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);
    const salesGST    = salesInvs.reduce((s, i) => s + (parseFloat(i.cgst) || 0) + (parseFloat(i.sgst) || 0) + (parseFloat(i.igst) || 0), 0);

    // Purchases this month
    const purMonth    = purchases.filter(p => inMonth(p.purchaseDate));
    const purTotal    = purMonth.reduce((s, p) => s + (parseFloat(p.totalAmount) || 0), 0);
    const purGST      = purMonth.reduce((s, p) => s + (parseFloat(p.cgst) || 0) + (parseFloat(p.sgst) || 0) + (parseFloat(p.igst) || 0), 0);

    // Estimated GST liability (output - eligible ITC)
    const estGST      = Math.max(0, salesGST - purGST);

    // Outstanding receivables
    const outRec      = outstanding.filter(o => o.status !== 'Paid');
    const totalRec    = outRec.reduce((s, o) => s + (parseFloat(o.balance) || 0), 0);

    // Active employees
    const activeEmp   = employees.filter(e => e.status === 'Active').length;

    // Due dates — upcoming (next 30 days) and overdue
    const today       = new Date(); today.setHours(0, 0, 0, 0);
    const pending     = dueDates.filter(d => d.status !== 'Done' && d.status !== 'Completed');
    const overdue     = pending.filter(d => daysUntil(d.dueDate) < 0);
    const upcoming    = pending
      .filter(d => daysUntil(d.dueDate) >= 0 && daysUntil(d.dueDate) <= 30)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 6);

    // Recent invoices (last 5)
    const recentInvs  = [...invoices]
      .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate))
      .slice(0, 5);

    // Recent purchases (last 5)
    const recentPurs  = [...purchases]
      .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
      .slice(0, 5);

    // Month name
    const monthName   = now.toLocaleString('en-IN', { month: 'long' });

    el.innerHTML = `
    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card" style="--c:var(--navy-400)">
        <div class="s-icon">🧾</div>
        <div class="s-label">Sales — ${monthName}</div>
        <div class="s-value">${fmtCur(salesMonth)}</div>
        <div class="s-sub">${salesInvs.length} invoice${salesInvs.length !== 1 ? 's' : ''} · GST ${fmtCur(salesGST)}</div>
      </div>
      <div class="stat-card" style="--c:var(--orange)">
        <div class="s-icon">🛒</div>
        <div class="s-label">Purchases — ${monthName}</div>
        <div class="s-value">${fmtCur(purTotal)}</div>
        <div class="s-sub">${purMonth.length} entr${purMonth.length !== 1 ? 'ies' : 'y'} · ITC ${fmtCur(purGST)}</div>
      </div>
      <div class="stat-card" style="--c:${estGST > 0 ? 'var(--red)' : 'var(--green)'}">
        <div class="s-icon">🧮</div>
        <div class="s-label">Est. GST Liability</div>
        <div class="s-value" style="color:${estGST > 0 ? 'var(--red)' : 'var(--green)'}">${fmtCur(estGST)}</div>
        <div class="s-sub">Output ${fmtCur(salesGST)} − ITC ${fmtCur(purGST)}</div>
      </div>
      <div class="stat-card" style="--c:var(--red)">
        <div class="s-icon">⚠️</div>
        <div class="s-label">Outstanding Receivables</div>
        <div class="s-value" style="color:var(--red)">${fmtCur(totalRec)}</div>
        <div class="s-sub">${outRec.length} unpaid invoice${outRec.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-card" style="--c:var(--green)">
        <div class="s-icon">👥</div>
        <div class="s-label">Active Employees</div>
        <div class="s-value">${activeEmp}</div>
        <div class="s-sub">${employees.length} total registered</div>
      </div>
      <div class="stat-card" style="--c:${overdue.length > 0 ? 'var(--red)' : 'var(--yellow)'}">
        <div class="s-icon">📅</div>
        <div class="s-label">Pending Compliances</div>
        <div class="s-value" style="color:${overdue.length > 0 ? 'var(--red)' : 'var(--navy-600)'}">${pending.length}</div>
        <div class="s-sub">${overdue.length > 0 ? `⚠️ ${overdue.length} overdue` : 'All on track'}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

      <!-- Upcoming Due Dates -->
      <div class="card" style="margin-bottom:0">
        <div class="card-header">
          <h2>📅 Upcoming Compliances</h2>
          <div class="card-actions">
            ${overdue.length > 0 ? `<span class="badge badge-red">⚠️ ${overdue.length} overdue</span>` : ''}
            <button class="btn btn-outline btn-sm np" onclick="navigateTo('duedates')">View All →</button>
          </div>
        </div>
        ${upcoming.length === 0
          ? `<div class="table-empty"><span class="empty-icon">✅</span>No compliances due in next 30 days</div>`
          : `<div class="table-wrap">
              <table>
                <thead><tr><th>Compliance</th><th>Period</th><th>Due Date</th><th>Days</th></tr></thead>
                <tbody>
                  ${upcoming.map(d => {
                    const days = daysUntil(d.dueDate);
                    const cls  = days < 0 ? 'dd-overdue' : days <= 3 ? 'dd-overdue' : days <= 7 ? 'dd-soon' : 'dd-ok';
                    const lbl  = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'TODAY' : `${days}d`;
                    return `<tr>
                      <td style="font-weight:600">${esc(d.compliance)}</td>
                      <td style="font-size:11px;color:var(--muted)">${esc(d.period || '—')}</td>
                      <td>${fmtDate(d.dueDate)}</td>
                      <td class="${cls}">${lbl}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`
        }
        ${overdue.length > 0
          ? `<div style="margin-top:12px;padding:10px 14px;background:var(--red-bg);border-radius:var(--radius-sm);font-size:12.5px;color:var(--red);font-weight:600">
              ⚠️ ${overdue.length} compliance${overdue.length > 1 ? 's' : ''} overdue:
              ${overdue.slice(0, 3).map(d => `<strong>${d.compliance}</strong> (${d.period || '—'})`).join(', ')}
              ${overdue.length > 3 ? ` and ${overdue.length - 3} more…` : ''}
            </div>`
          : ''
        }
      </div>

      <!-- Outstanding Receivables -->
      <div class="card" style="margin-bottom:0">
        <div class="card-header">
          <h2>⚠️ Outstanding Receivables</h2>
          <button class="btn btn-outline btn-sm np" onclick="navigateTo('outstanding')">View All →</button>
        </div>
        ${outRec.length === 0
          ? `<div class="table-empty"><span class="empty-icon">✅</span>No outstanding receivables</div>`
          : `<div class="table-wrap">
              <table>
                <thead><tr><th>Client</th><th>Invoice</th><th>Balance</th><th>Age</th></tr></thead>
                <tbody>
                  ${[...outRec]
                    .sort((a, b) => (parseFloat(b.balance) || 0) - (parseFloat(a.balance) || 0))
                    .slice(0, 6)
                    .map(o => `<tr>
                      <td style="font-weight:600">${trunc(o.clientName, 20)}</td>
                      <td style="font-size:11px">${esc(o.invoiceNo)}</td>
                      <td style="font-weight:700;color:var(--red)">${fmtCur(o.balance)}</td>
                      <td>${ageBadge(parseInt(o.daysOutstanding) || 0)}</td>
                    </tr>`)
                    .join('')
                  }
                </tbody>
                ${outRec.length > 6
                  ? `<tfoot><tr><td colspan="4" style="text-align:right;font-size:11px;color:var(--muted)">+ ${outRec.length - 6} more · Total: ${fmtCur(totalRec)}</td></tr></tfoot>`
                  : `<tfoot><tr><td colspan="3" style="font-weight:700">Total</td><td style="font-weight:700;color:var(--red)">${fmtCur(totalRec)}</td></tr></tfoot>`
                }
              </table>
            </div>`
        }
      </div>
    </div>

    <!-- Recent Bills & Purchases -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">

      <!-- Recent Bills -->
      <div class="card" style="margin-bottom:0">
        <div class="card-header">
          <h2>🧾 Recent Bills</h2>
          <button class="btn btn-outline btn-sm np" onclick="navigateTo('billing')">View All →</button>
        </div>
        ${recentInvs.length === 0
          ? `<div class="table-empty"><span class="empty-icon">🧾</span>No invoices yet<br>
              <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="navigateTo('billing')">Create First Invoice</button></div>`
          : `<div class="table-wrap">
              <table>
                <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  ${recentInvs.map(i => `<tr>
                    <td>
                      <div style="font-weight:700;font-size:12px">${esc(i.invoiceNo)}</div>
                      <div style="font-size:10.5px;color:var(--muted)">${fmtDate(i.invoiceDate)}</div>
                    </td>
                    <td>${trunc(i.clientName, 18)}</td>
                    <td style="font-weight:700">${fmtCur(i.totalAmount)}</td>
                    <td>${badge(i.status)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>

      <!-- Recent Purchases -->
      <div class="card" style="margin-bottom:0">
        <div class="card-header">
          <h2>🛒 Recent Purchases</h2>
          <button class="btn btn-outline btn-sm np" onclick="navigateTo('purchase')">View All →</button>
        </div>
        ${recentPurs.length === 0
          ? `<div class="table-empty"><span class="empty-icon">🛒</span>No purchases yet<br>
              <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="navigateTo('purchase')">Add Purchase</button></div>`
          : `<div class="table-wrap">
              <table>
                <thead><tr><th>Vendor</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  ${recentPurs.map(p => `<tr>
                    <td>
                      <div style="font-weight:600">${trunc(p.vendorName, 18)}</div>
                      <div style="font-size:10.5px;color:var(--muted)">${esc(p.expenseCategory || '—')}</div>
                    </td>
                    <td style="font-size:11.5px">${fmtDate(p.purchaseDate)}</td>
                    <td style="font-weight:700">${fmtCur(p.totalAmount)}</td>
                    <td>${badge(p.paymentStatus)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    </div>

    <!-- GST Snapshot this month -->
    <div class="card" style="margin-top:16px">
      <div class="card-header">
        <h2>🧮 GST Snapshot — ${monthName} ${thisY}</h2>
        <button class="btn btn-outline btn-sm np" onclick="navigateTo('gstr3b')">Full 3B Estimate →</button>
      </div>
      <div class="gst3b-net-grid">
        <div class="gst3b-net-box">
          <div class="nl">Output CGST</div>
          <div class="nv" style="color:var(--navy-600)">${fmtCur(salesInvs.reduce((s,i)=>s+(parseFloat(i.cgst)||0),0))}</div>
        </div>
        <div class="gst3b-net-box">
          <div class="nl">Output SGST</div>
          <div class="nv" style="color:var(--navy-600)">${fmtCur(salesInvs.reduce((s,i)=>s+(parseFloat(i.sgst)||0),0))}</div>
        </div>
        <div class="gst3b-net-box">
          <div class="nl">Output IGST</div>
          <div class="nv" style="color:var(--navy-600)">${fmtCur(salesInvs.reduce((s,i)=>s+(parseFloat(i.igst)||0),0))}</div>
        </div>
        <div class="gst3b-net-box" style="border-left:2px solid var(--border);padding-left:12px">
          <div class="nl">Less: ITC (Est.)</div>
          <div class="nv" style="color:var(--green)">${fmtCur(purGST)}</div>
        </div>
        <div class="gst3b-net-box" style="border-left:2px solid var(--border);padding-left:12px">
          <div class="nl">Net Payable</div>
          <div class="nv" style="color:${estGST > 0 ? 'var(--red)' : 'var(--green)'};font-size:24px">${fmtCur(estGST)}</div>
        </div>
      </div>
    </div>`;
  }

  return { render };

})();
