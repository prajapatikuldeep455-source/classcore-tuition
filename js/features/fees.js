// Scope: ONLY affects page-fees. Zero side-effects on Dashboard/Students/Settings.
// No Firebase/onSnapshot — uses in-memory `students[]` (same as all other modules).
// Conflict check: no new global variables overlap with existing ones.
// ════════════════════════════════════════════════════════════════════════════

const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
let curReceipt=null;

// ── Fees-scoped state (private — no collision with other modules) ─────────────
let _feesBuilt    = false;
let _feesSearch   = '';
let _feesSelMonth = '';

// ════════════════════════════════════════════════════════════════════════════
// renderFees — smart: builds shell once, then patches only changed DOM nodes
// ════════════════════════════════════════════════════════════════════════════
function renderFees(){
  const pageEl = document.getElementById('page-fees');
  if(!pageEl) return;

  // Read month from DOM first (user may have changed it), then fall back to state
  const existingFilter = document.getElementById('fee-month-filter');
  if(existingFilter?.value) _feesSelMonth = existingFilter.value;
  if(!_feesSelMonth) _feesSelMonth = MONTHS[new Date().getMonth()];

  const selM    = _feesSelMonth;
  const curYear = new Date().getFullYear();
  const list    = students.filter(s => !s.inactive);
  const stats   = _computeFeeStats(list, selM, curYear);

  // First visit to fees page → build full shell
  if(!_feesBuilt || !document.getElementById('fee-tbody')){
    _buildFeesShell(pageEl, stats, selM);
    _feesBuilt = true;
  } else {
    // Already built → only patch stat cards (by stable ID, not fragile position)
    _patchFeeStats(stats, selM);
  }

  // Always refresh table rows (preserves search filter)
  const searchList = _feesSearch
    ? list.filter(s => (s.name||''). toLowerCase().includes(_feesSearch))
    : list;

  const tbody = document.getElementById('fee-tbody');
  if(tbody) tbody.innerHTML = _buildFeeRows(searchList, selM, curYear);

  _renderPendingAlert(list, selM, curYear);
}

// ── Build full page shell — runs once ─────────────────────────────────────────
function _buildFeesShell(pageEl, stats, selM){
  const curYear = new Date().getFullYear();
  const list    = students.filter(s => !s.inactive);
  pageEl.innerHTML = `
  <div class="grid-3" style="margin-bottom:16px">
    <div class="card fee-stat" id="fee-stat-col" style="text-align:center">
      <div style="font-size:20px">💚</div>
      <div style="font-size:22px;font-weight:800;color:#16A34A;margin:4px 0">${fmt(stats.colMonth)}</div>
      <div style="font-size:11px;color:#78716C">${selM} Collected</div>
    </div>
    <div class="card fee-stat" id="fee-stat-pen" style="text-align:center">
      <div style="font-size:20px">🔴</div>
      <div style="font-size:22px;font-weight:800;color:#DC2626;margin:4px 0">${fmt(stats.penMonth)}</div>
      <div style="font-size:11px;color:#78716C">${selM} Pending (${stats.notPaidCount} students)</div>
    </div>
    <div class="card fee-stat" id="fee-stat-exp" style="text-align:center">
      <div style="font-size:20px">💰</div>
      <div style="font-size:22px;font-weight:800;margin:4px 0">${fmt(stats.expMonth)}</div>
      <div style="font-size:11px;color:#78716C">${selM} Expected</div>
    </div>
  </div>
  <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
    <div class="search-box" style="flex:1">
      <span>🔍</span>
      <input id="fee-srch" placeholder="Search student…" value="${esc(_feesSearch)}"
        oninput="_feesSearch=this.value.toLowerCase();filterFees(this.value)">
    </div>
    <select id="fee-month-filter" onchange="_feesSelMonth=this.value;renderFees()"
      style="padding:7px 14px;font-size:13px;font-weight:600;border-radius:8px;border:1.5px solid #E7E2D9;background:#fff;cursor:pointer">
      ${MONTHS.map(m=>`<option value="${m}"${m===selM?' selected':''}>${m}</option>`).join('')}
    </select>
    <button class="btn btn-ink btn-sm" onclick="openClassFeesMod()">⚙️ Set Class Fees</button>
    <button class="btn btn-primary btn-sm" onclick="openBulkFee()">⚡ Bulk Collect</button>
  </div>
  <div id="fee-pending-alert"></div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Student</th><th>Class</th><th>Fee</th>
        <th>Status</th><th>Collect</th><th>History</th><th>💬</th>
      </tr></thead>
      <tbody id="fee-tbody">${_buildFeeRows(list, selM, curYear)}</tbody>
    </table>
  </div>`;
}

// ── Patch only stat cards (stable IDs — no position dependency) ───────────────
function _patchFeeStats(stats, selM){
  const c = document.getElementById('fee-stat-col');
  const p = document.getElementById('fee-stat-pen');
  const e = document.getElementById('fee-stat-exp');
  if(c) c.innerHTML = `<div style="font-size:20px">💚</div><div style="font-size:22px;font-weight:800;color:#16A34A;margin:4px 0">${fmt(stats.colMonth)}</div><div style="font-size:11px;color:#78716C">${selM} Collected</div>`;
  if(p) p.innerHTML = `<div style="font-size:20px">🔴</div><div style="font-size:22px;font-weight:800;color:#DC2626;margin:4px 0">${fmt(stats.penMonth)}</div><div style="font-size:11px;color:#78716C">${selM} Pending (${stats.notPaidCount} students)</div>`;
  if(e) e.innerHTML = `<div style="font-size:20px">💰</div><div style="font-size:22px;font-weight:800;margin:4px 0">${fmt(stats.expMonth)}</div><div style="font-size:11px;color:#78716C">${selM} Expected</div>`;
}

// ── Pure stat computation — no DOM reads, no side-effects ─────────────────────
function _computeFeeStats(list, selM, curYear){
  const colMonth = list.reduce((a,s)=>
    a + (s.history||[]).filter(h=>h.month===selM&&(h.year||curYear)===curYear)
                       .reduce((b,h)=>b+(h.amount||0),0), 0);
  const expMonth     = list.reduce((a,s)=>a+monthlyFee(s), 0);
  const penMonth     = Math.max(0, expMonth - colMonth);
  const notPaidCount = list.filter(s=>
    monthlyFee(s)>0 &&
    !(s.history||[]).some(h=>h.month===selM&&(h.year||curYear)===curYear)
  ).length;
  return { colMonth, expMonth, penMonth, notPaidCount };
}

// ── Overdue pending alert ─────────────────────────────────────────────────────
function _renderPendingAlert(list, selMonth, curYear){
  const el = document.getElementById('fee-pending-alert');
  if(!el) return;
  const curMonthIdx = MONTHS.indexOf(selMonth);
  const overdue = [];
  list.forEach(s=>{
    if(!monthlyFee(s)) return;
    const paidThisYear = (s.history||[])
      .filter(h=>h.month&&(h.year||curYear)===curYear).map(h=>h.month);
    const admDate      = s.admDate ? new Date(s.admDate) : null;
    const admMonthIdx  = (admDate && admDate.getFullYear()===curYear) ? admDate.getMonth() : 0;
    const unpaid = [];
    for(let i=admMonthIdx; i<curMonthIdx; i++){
      if(!paidThisYear.includes(MONTHS[i])) unpaid.push(MONTHS[i]);
    }
    if(unpaid.length) overdue.push({s, unpaid});
  });
  if(!overdue.length){ el.innerHTML=''; return; }
  el.innerHTML = `<div style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:10px;padding:12px 16px;margin-bottom:14px">
    <div style="font-size:13px;font-weight:700;color:#DC2626;margin-bottom:8px">
      ⚠️ ${overdue.length} student${overdue.length>1?'s':''} with previous months pending:
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${overdue.map(({s,unpaid})=>`
        <div style="background:#fff;border:1.5px solid #FECACA;border-radius:8px;padding:7px 12px;font-size:12px">
          <b>${esc(s.name)}</b> <span style="color:#78716C">(${fmt(monthlyFee(s))}/mo)</span>
          — <span style="color:#DC2626;font-weight:600">${unpaid.join(', ')}</span>
          <button onclick="quickCollectPending('${s.id}','${unpaid[0]}')"
            style="margin-left:8px;background:#DC2626;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;cursor:pointer;font-family:inherit">
            Collect ${unpaid[0]} (${fmt(monthlyFee(s))})
          </button>
        </div>`).join('')}
    </div>
  </div>`;
}
// Backward-compat alias — Dashboard + Reports call renderPendingAlert()
function renderPendingAlert(list, selMonth){
  _renderPendingAlert(
    list,
    selMonth||_feesSelMonth||MONTHS[new Date().getMonth()],
    new Date().getFullYear()
  );
}

// ── Build table rows — year-aware paid check ──────────────────────────────────
function _buildFeeRows(list, selMonth, curYear){
  if(!list.length) return `<tr><td colspan="7" style="text-align:center;padding:40px;color:#78716C">No students found</td></tr>`;
  return list.map(s=>{
    const idx          = students.indexOf(s);
    const mFee         = monthlyFee(s);
    // Year-aware: Jan 2025 does NOT block Jan 2026
    const paidThisYear = (s.history||[])
      .filter(h=>h.month&&(h.year||curYear)===curYear).map(h=>h.month);
    const alreadyPaid  = paidThisYear.includes(selMonth);
    const nextUnpaid   = MONTHS.find(m=>!paidThisYear.includes(m))||'';
    const totalPaid    = s.paid||0;
    const monthsPaid   = paidThisYear.length;
    return `<tr style="${alreadyPaid?'background:rgba(22,163,74,.05)':''}" id="fee-row-${s.id}">
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="av ${avcC(idx)}">${ini(s.name)}</div>
          <div>
            <div style="font-weight:600;font-size:13px">${esc(s.name)}</div>
            <div style="font-size:11px;color:#78716C">${esc(s.batch||'No Batch')}${s.subject?' · '+esc(s.subject):''}</div>
          </div>
        </div>
      </td>
      <td>${esc(s.cls)}</td>
      <td style="font-weight:700;color:var(--primary)">
        ${s.feeType==='annual'
          ? `${fmt(s.annualFees||s.finalFees||0)}<span style="font-size:10px;color:#78716C;font-weight:400">/yr</span><div style="font-size:10px;color:#78716C">${fmt(mFee)}/mo</div>`
          : `${fmt(mFee)}<span style="font-size:10px;color:#78716C;font-weight:400">/mo</span>`
        }
        <div style="font-size:10px;color:#78716C">${monthsPaid} month${monthsPaid!==1?'s':''} paid</div>
      </td>
      <td>
        ${alreadyPaid
          ? `<div style="font-size:12px;font-weight:700;color:#16A34A">✅ ${selMonth} Paid</div>
             ${nextUnpaid?`<div style="font-size:10px;color:var(--primary);margin-top:2px">Next: <b>${nextUnpaid}</b></div>`:''}`
          : `<div>
               <select id="month-${s.id}" style="padding:4px 7px;font-size:12px;border-radius:7px;border:1.5px solid #E7E2D9;background:#F7F5F0;width:110px">
                 ${MONTHS.map(m=>`<option value="${m}"${m===selMonth?' selected':''}>${m}${paidThisYear.includes(m)?' ✅':''}</option>`).join('')}
               </select>
               <div style="font-size:10px;color:#DC2626;margin-top:2px;font-weight:600">Not paid</div>
             </div>`
        }
      </td>
      <td>
        ${alreadyPaid
          ? `<span style="font-size:11px;color:#16A34A">—</span>`
          : `<div style="display:flex;gap:4px;align-items:center">
               <input type="number" id="pay-${s.id}" placeholder="${mFee}"
                 style="width:75px;padding:5px 8px;border:1.5px solid #E7E2D9;border-radius:7px;font-size:12px;background:#F7F5F0;outline:none">
               <button class="btn btn-teal btn-xs" onclick="collectFee('${s.id}')">✓ Collect</button>
             </div>`
        }
        <div style="font-size:10px;color:#78716C;margin-top:3px">Total: <b style="color:#16A34A">${fmt(totalPaid)}</b></div>
      </td>
      <td>${(s.history||[]).length>0
        ? `<button class="btn btn-ghost btn-xs" onclick="openHist('${s.id}')">📋 ${(s.history||[]).length}</button>`
        : `<span style="font-size:11px;color:#78716C">—</span>`}
      </td>
      <td>${s.mobile
        ? `<button class="btn btn-green btn-xs" onclick="sendWA('${s.id}')" title="WhatsApp reminder">💬</button>`
        : `<span style="font-size:10px;color:#78716C">No mobile</span>`}
      </td>
    </tr>`;
  }).join('');
}
// Backward-compat alias used by bulk-fee modal
function makeFeeRows(list, selMonth){
  return _buildFeeRows(list, selMonth||_feesSelMonth||MONTHS[new Date().getMonth()], new Date().getFullYear());
}

// ── Search: only rebuilds tbody, preserves everything else ────────────────────
function filterFees(q){
  _feesSearch = (q||''). toLowerCase();
  const selM  = _feesSelMonth || MONTHS[new Date().getMonth()];
  const curYear = new Date().getFullYear();
  const list  = students.filter(s =>
    !s.inactive && (!_feesSearch || (s.name||''). toLowerCase().includes(_feesSearch))
  );
  const tbody = document.getElementById('fee-tbody');
  if(!tbody){ renderFees(); return; }
  requestAnimationFrame(()=>{
    tbody.innerHTML = _buildFeeRows(list, selM, curYear);
    _renderPendingAlert(students.filter(s=>!s.inactive), selM, curYear);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// collectFee — the core transaction
// Pre-simulation result: mutates students[] → renderFees() → persist()
// Side-effects on other modules: NONE (sidebar/header never touched)
// Error fallback: in-memory state stays correct even if persist() fails
// ════════════════════════════════════════════════════════════════════════════
function collectFee(sid){
  const inp        = document.getElementById('pay-'+sid);
  const monthEl    = document.getElementById('month-'+sid);
  const collectBtn = document.querySelector('#fee-row-'+sid+' .btn-teal');
  const selMonth   = monthEl?.value || _feesSelMonth || MONTHS[new Date().getMonth()];
  const curYear    = new Date().getFullYear();

  const stu0 = students.find(s=>s.id===sid);
  if(!stu0){ toast('Student not found','err'); return; }

  // Guard: duplicate payment for same month+year
  const alreadyPaid = (stu0.history||[]).some(
    h => h.month===selMonth && (h.year||curYear)===curYear
  );
  if(alreadyPaid){
    toast('\u274C '+selMonth+' already collected!','err');
    const next = MONTHS.find(m=>!(stu0.history||[]).some(h=>h.month===m&&(h.year||curYear)===curYear));
    if(next && monthEl) monthEl.value = next;
    return;
  }

  // Guard: permissions
  if(!isAdmin() && !hasPermission('collect_fees')){
    toast('No permission to collect fees','err'); return;
  }

  // Guard: amount
  const mFee       = monthlyFee(stu0);
  const enteredAmt = parseFloat(inp?.value||0);
  const amt        = enteredAmt > 0 ? enteredAmt : mFee;
  if(!amt || amt <= 0){
    toast('Enter fee amount or set monthly fee for this student','err'); return;
  }

  // ── STEP 1: Show pencil animation immediately ─────────────────────────────
  if(collectBtn){
    collectBtn.className = 'btn btn-xs btn-collecting';
    collectBtn.innerHTML = '<span class="pencil-icon">\u270F\uFE0F</span> Processing\u2026';
    collectBtn.disabled  = true;
  }
  if(inp) inp.disabled = true;

  // ── STEP 2: Receipt number ────────────────────────────────────────────────
  const rcptNo = (parseInt(localStorage.getItem('rcptNo')||1000)) + 1;
  localStorage.setItem('rcptNo', rcptNo);

  // ── STEP 3: Mutate in-memory data immediately ─────────────────────────────
  students = students.map(s=>{
    if(s.id !== sid) return s;
    return {
      ...s,
      paid:    (s.paid||0) + amt,
      history: [...(s.history||[]), {
        amount: amt, date: todayStr(),
        receiptNo: rcptNo, month: selMonth, year: curYear,
      }],
    };
  });

  // ── STEP 4: After 2s animation → update only this row surgically ──────────
  setTimeout(()=>{
    // Brief "Saved!" state
    if(collectBtn){
      collectBtn.className = 'btn btn-xs btn-saved';
      collectBtn.innerHTML = '\u2705 Saved!';
    }

    setTimeout(()=>{
      // ── Surgically patch only this row — zero full page re-render ──────
      const row = document.getElementById('fee-row-'+sid);
      if(row){
        const updStu = students.find(s=>s.id===sid);
        if(updStu){
          const nextUnpaid = MONTHS.find(m=>
            !(updStu.history||[]).some(h=>h.month===m&&(h.year||curYear)===curYear)
          );
          // Status cell
          const sc = row.cells[3];
          if(sc) sc.innerHTML =
            '<div style="font-size:12px;font-weight:700;color:#16A34A">\u2705 '+selMonth+' Paid</div>'+
            (nextUnpaid ? '<div style="font-size:10px;color:var(--primary);margin-top:2px">Next: <b>'+nextUnpaid+'</b></div>' : '');
          // Collect cell
          const cc = row.cells[4];
          if(cc) cc.innerHTML =
            '<span style="font-size:11px;color:#16A34A">\u2014</span>'+
            '<div style="font-size:10px;color:#78716C;margin-top:3px">Total: <b style="color:#16A34A">'+fmt(updStu.paid||0)+'</b></div>';
          // History cell
          const hc = row.cells[5];
          if(hc) hc.innerHTML =
            '<button class="btn btn-ghost btn-xs" onclick="openHist(\\"'+sid+'\\")">&#128203; '+(updStu.history||[]).length+'</button>';
          // Row flash
          row.className = 'row-just-paid';
          setTimeout(()=>{ row.className=''; row.style.background='rgba(22,163,74,.05)'; }, 1200);
        }
      }

      // Patch stat cards only — no full renderFees()
      const list  = students.filter(s=>!s.inactive);
      const stats = _computeFeeStats(list, selMonth, curYear);
      _patchFeeStats(stats, selMonth);
      _renderPendingAlert(list, selMonth, curYear);

      // Show receipt
      const updStu2 = students.find(s=>s.id===sid);
      if(updStu2) showReceiptPrev(updStu2, amt, rcptNo, null, selMonth);
      toast('\u2705 '+selMonth+' collected \u2014 '+fmt(amt));

      if(curPage==='dashboard') renderDash();

      // Persist to disk in background
      persist().catch(err=>{
        console.error('[Fees] persist error:', err);
        toast('\u26A0\uFE0F Recorded in memory. Disk save will retry.','warn');
      });

    }, 600);
  }, 2000);
}

function quickCollectPending(sid, month){
  const s       = students.find(x=>x.id===sid);
  if(!s) return;
  const mFee    = monthlyFee(s);
  const curYear = new Date().getFullYear();
  if(!mFee){ toast('Set monthly fee first','err'); return; }
  if((s.history||[]).some(h=>h.month===month&&(h.year||curYear)===curYear)){
    toast(month+' already collected','err'); return;
  }
  const rcptNo = (parseInt(localStorage.getItem('rcptNo')||1000))+1;
  localStorage.setItem('rcptNo', rcptNo);
  students = students.map(x=>{
    if(x.id!==sid) return x;
    return { ...x, paid:(x.paid||0)+mFee,
             history:[...(x.history||[]),{amount:mFee,date:todayStr(),receiptNo:rcptNo,month,year:curYear}] };
  });
  toast(`✅ ${month} collected — ${fmt(mFee)}`);
  if(curPage==='fees') renderFees();
  if(curPage==='dashboard') renderDash();
  showReceiptPrev(students.find(x=>x.id===sid), mFee, rcptNo, null, month);
  persist().catch(e=>console.error('[Fees] quickCollect persist:',e));
}

function sendWA(sid){
  const s=students.find(x=>x.id===sid);if(!s)return;
  const mFee=monthlyFee(s);
  const selMonth=document.getElementById('fee-month-filter')?.value||MONTHS[new Date().getMonth()];
  const inst=localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const mobile=(s.mobile||'').replace(/\D/g,'');
  const num=mobile.length===10?'91'+mobile:mobile;
  const cFee=courseFeeMonthly(s);
  const baseFee=mFee-cFee;
  const enrolledCourses=(s.courseIds||[]).map(cid=>courses.find(c=>c.id===cid)).filter(Boolean);
  const courseLines=enrolledCourses.length>0
    ? '\n'+enrolledCourses.map(c=>`  📚 ${c.name}: ₹${(c.fee||0).toLocaleString('en-IN')}/mo`).join('\n')
    : '';
  window.open('https://wa.me/'+num+'?text='+encodeURIComponent(
    `Dear ${s.parent||s.name},\n\nReminder from ${inst}.\n\nStudent: ${s.name}\nClass: ${s.cls}${s.batch?' | Batch: '+s.batch:''}\nMonth Due: ${selMonth}\n\nFee Details:\n  Base Fee: ₹${baseFee.toLocaleString('en-IN')}/mo${courseLines}${cFee>0?'\n  ──────────\n  Total: ₹'+mFee.toLocaleString('en-IN')+'/mo':''}\n\nKindly pay the ${selMonth} fees at the earliest.\n\nThank you!`
  ));
}
function deletePayment(sid, histIdx){
  if(!canDo('delete_payments','You do not have permission to delete payments')) return;
  if(!confirm('Delete this payment record?')) return;

  showLoader('Deleting Receipt…', 'Updating your records', '🗑️');

  setTimeout(async ()=>{
    // Delete the payment from in-memory data
    students = students.map(s=>{
      if(s.id !== sid) return s;
      const history = [...(s.history||[])];
      history.splice(histIdx, 1);
      const paid = history.reduce((a,h)=>a+(h.amount||0), 0);
      return { ...s, paid, history };
    });

    // Save to disk
    await persist().catch(e=>console.error('[deletePayment] persist error:',e));

    hideLoader();
    toast('Receipt deleted');

    // Refresh history modal in-place so deleted row disappears immediately
    openHist(sid);

    // Refresh fees page stats + rows
    renderFees();

    // Refresh dashboard if it's the active page
    if(curPage==='dashboard') renderDash();
  }, 1800);
}
function openHist(sid){
  const s=students.find(x=>x.id===sid);if(!s)return;
  const mFee=monthlyFee(s);
  const totalPaid=s.paid||0;
  const totalMonthsPaid=(s.history||[]).filter(h=>h.month).length;
  document.getElementById('hist-title').textContent='Payment History — '+s.name;
  document.getElementById('hist-body').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
      <div style="background:#F7F5F0;border-radius:10px;padding:12px;text-align:center"><div style="font-size:11px;color:#78716C">Monthly Fee</div><div style="font-size:16px;font-weight:800">${fmt(mFee)}/mo</div></div>
      <div style="background:#F0FDF4;border-radius:10px;padding:12px;text-align:center"><div style="font-size:11px;color:#78716C">Total Paid</div><div style="font-size:16px;font-weight:800;color:#16A34A">${fmt(totalPaid)}</div></div>
      <div style="background:#EFF6FF;border-radius:10px;padding:12px;text-align:center"><div style="font-size:11px;color:#78716C">Months Paid</div><div style="font-size:16px;font-weight:800;color:#1D4ED8">${totalMonthsPaid}</div></div>
    </div>
    <table><thead><tr><th>Receipt #</th><th>Month</th><th>Amount</th><th>Date</th><th>Action</th></tr></thead>
    <tbody>${(s.history||[]).slice().reverse().map((h,i)=>`<tr>
      <td style="font-weight:700;color:var(--primary)">#${h.receiptNo||'—'}</td>
      <td><span class="badge badge-gray" style="font-size:10px">${h.month||'—'} ${h.year||''}</span></td>
      <td style="font-weight:700;color:#16A34A">${fmt(h.amount)}</td>
      <td style="color:#78716C;font-size:12px">${h.date}</td>
      <td style="display:flex;gap:5px">
        <button class="btn btn-ghost btn-xs" onclick="showReceiptPrev(students.find(x=>x.id==='${s.id}'),${h.amount},${h.receiptNo||0},'${h.date}','${h.month||''}')">🧾</button>
        ${isAdmin()?`<button class="btn btn-red btn-xs" onclick="deletePayment('${s.id}',${(s.history||[]).length-1-i})">🗑️</button>`:''}
      </td>
    </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:#78716C;padding:20px">No payments yet</td></tr>'}
    </tbody></table>`;
  openModal('modal-history');
}

// RECEIPT PREVIEW
function showReceiptPrev(s,amount,rcptNo,payDate,month){
  if(!s)return;
  curReceipt={s,amount,rcptNo,payDate,month};
  const inst=localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const addr=localStorage.getItem('tuitionAddress')||'';
  const logo=localStorage.getItem('tuitionLogo')||BUILTIN_LOGO;
  const dispDate=payDate||todayStr();
  const totalPaid=s.paid||0;
  const mFee=monthlyFee(s);
  const paidCount=(s.history||[]).filter(h=>h.month).length;
  const isPaid=true; // each collected month is paid
  document.getElementById('receipt-body').innerHTML=`
  <div style="background:#F4F2EE;border-radius:12px;padding:20px">
  <div class="receipt-paper">
    <div class="receipt-hdr">
      <div style="position:relative;z-index:1">
        ${logo?`<img src="${logo}" style="height:44px;border-radius:8px;margin-bottom:8px;background:#fff;padding:3px">`:''}
        <div style="font-size:20px;font-weight:900;color:#fff">${esc(inst)}</div>
        ${addr?`<div style="font-size:11.5px;color:rgba(255,255,255,.75);margin-top:2px">${esc(addr)}</div>`:''}
        <div style="display:flex;justify-content:space-between;margin-top:18px;align-items:flex-end">
          <div><div style="font-size:10px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:2px">Fee Receipt</div><div style="font-size:22px;font-weight:800;color:#fff">#${rcptNo}</div></div>
          <div style="text-align:right"><div style="font-size:10px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Date</div><div style="font-size:13px;font-weight:700;color:#fff">${dispDate}</div></div>
        </div>
      </div>
    </div>
    <div class="receipt-amount">
      <div><div style="font-size:10.5px;color:#78716C;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Amount Paid</div><div style="font-size:34px;font-weight:900;color:#E8622A;letter-spacing:-.5px">₹${Number(amount).toLocaleString('en-IN')}</div></div>
      <div style="background:${isPaid?'#DCFCE7':'#FEF9C3'};border:2px solid ${isPaid?'#86EFAC':'#FDE047'};border-radius:12px;padding:10px 16px;text-align:center">
        <div style="font-size:18px">${isPaid?'✅':'⏳'}</div>
        <div style="font-size:11px;font-weight:800;color:${isPaid?'#16A34A':'#A16207'};margin-top:3px">${isPaid?'FULLY PAID':'PARTIAL'}</div>
      </div>
    </div>
    <div style="padding:18px 28px 0">
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#F7F5F0;border-radius:10px;margin-bottom:16px">
        <div class="av av-lg avc0">${ini(s.name)}</div>
        <div style="flex:1"><div style="font-size:15px;font-weight:700">${esc(s.name)}</div><div style="font-size:12px;color:#78716C">Class ${esc(s.cls)}${s.batch?' · '+esc(s.batch):''}${s.medium?' · '+esc(s.medium)+' Medium':''}${s.school?' · '+esc(s.school):''}${s.subject?' · '+esc(s.subject):''}</div></div>
        ${s.parent?`<div style="text-align:right"><div style="font-size:10.5px;color:#78716C">Guardian</div><div style="font-size:12px;font-weight:600">${esc(s.parent)}</div></div>`:''}
      </div>
    </div>
    <div class="receipt-rows">
      ${(()=>{
        const baseFee=mFee-courseFeeMonthly(s);
        const cFee=courseFeeMonthly(s);
        const enrolledCourses=(s.courseIds||[]).map(cid=>courses.find(c=>c.id===cid)).filter(Boolean);
        return `
        <div class="receipt-row"><span style="font-size:12.5px;color:#78716C">Base Monthly Fee</span><span style="font-size:13px;font-weight:600">${fmt(baseFee)}/month</span></div>
        ${enrolledCourses.map(c=>`<div class="receipt-row"><span style="font-size:12.5px;color:#78716C">📚 ${esc(c.name)}</span><span style="font-size:13px;font-weight:600;color:#1D4ED8">${fmt(c.fee||0)}/month</span></div>`).join('')}
        ${cFee>0?`<div class="receipt-row" style="border-top:1px solid #E7E2D9;margin-top:4px;padding-top:8px"><span style="font-size:12.5px;font-weight:700">Total Monthly Fee</span><span style="font-size:14px;font-weight:800;color:var(--primary)">${fmt(mFee)}/month</span></div>`:''}
        `;
      })()}
      ${month?`<div class="receipt-row"><span style="font-size:12.5px;color:#78716C">Fee Month</span><span style="font-size:13px;font-weight:700;color:var(--primary)">${month}</span></div>`:''}
      <div class="receipt-row"><span style="font-size:12.5px;color:#78716C">This Payment</span><span style="font-size:14px;font-weight:700;color:var(--primary)">${fmt(amount)}</span></div>
      <div class="receipt-row"><span style="font-size:12.5px;color:#78716C">Total Paid (all months)</span><span style="font-size:13px;font-weight:600;color:#16A34A">${fmt(totalPaid)}</span></div>
      <div class="receipt-row"><span style="font-size:12.5px;color:#78716C">Months Paid</span><span style="font-size:13px;font-weight:600">${paidCount} month${paidCount!==1?'s':''}</span></div>
      <div style="background:#F0FDF4;border-radius:10px;padding:10px 14px;margin:10px 0;border:1.5px solid #86EFAC;text-align:center">
        <span style="font-size:13px;font-weight:700;color:#16A34A">✅ Payment Recorded Successfully</span>
      </div>
      ${s.mobile?`<div class="receipt-row"><span style="font-size:12.5px;color:#78716C">Mobile</span><span style="font-size:13px;font-weight:600">${esc(s.mobile)}</span></div>`:''}
    </div>
    <div class="receipt-cut"><span>✂</span></div>
    <div class="receipt-foot">
      <div style="font-size:12.5px;color:#78716C;margin-bottom:6px">Thank you for your payment! 🙏</div>
      <div style="font-size:11px;color:#A8A099">${esc(inst)}${addr?' · '+esc(addr):''}</div>
      <div style="margin-top:8px;font-size:10px;color:#C4BAB0">Generated by ClassCore · ${dispDate}</div>
    </div>
  </div></div>`;
  openModal('modal-receipt');
}

function buildReceiptHTML(s,amount,rcptNo,payDate,month,size){
  const inst=localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const addr=localStorage.getItem('tuitionAddress')||'';
  const logo=localStorage.getItem('tuitionLogo')||'';
  const dispDate=payDate||todayStr();
  const totalPaid=s.paid||0;
  const mFee=monthlyFee(s);
  const paidCount=(s.history||[]).filter(h=>h.month).length;
  const isPaid=true;

  // Adjust font sizes and padding per paper size
  const SZ = {
    'A4': { pad:'32px', h1:'22px', amt:'36px', row:'13px', lbl:'11px', max:'540px' },
    'A5': { pad:'24px', h1:'19px', amt:'32px', row:'12.5px', lbl:'10.5px', max:'440px' },
    'A6': { pad:'16px', h1:'15px', amt:'26px', row:'11px', lbl:'9.5px', max:'320px' },
    'A7': { pad:'12px', h1:'13px', amt:'22px', row:'10px', lbl:'9px', max:'250px' },
  };
  const f = SZ[size] || SZ['A4'];
  const accentColor = '#1B3154';
  const goldColor = '#C9A84C';

  return`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt #${rcptNo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,sans-serif;padding:${f.pad};max-width:${f.max};margin:auto;color:#18181B;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .hdr{background:linear-gradient(135deg,${accentColor},#243d5c);padding:20px 24px;border-radius:12px 12px 0 0;color:#fff;}
    .hdr h1{font-size:${f.h1};font-weight:900;margin-bottom:2px;}
    .hdr .sub{font-size:10px;opacity:.7;margin-top:2px;}
    .rcpt-row{display:flex;justify-content:space-between;margin-top:14px;align-items:flex-end;}
    .lbl{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;opacity:.6;}
    .rcpt-num{font-size:${f.h1};font-weight:800;}
    .gold{color:${goldColor};}
    .amount-box{background:#FBF6E9;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px dashed #E0D5B5;}
    .amount{font-size:${f.amt};font-weight:900;color:${accentColor};}
    .status{padding:7px 12px;border-radius:10px;font-size:10px;font-weight:800;text-align:center;}
    .paid-s{background:#DCFCE7;color:#16A34A;border:1.5px solid #86EFAC;}
    .part-s{background:#FEF9C3;color:#A16207;border:1.5px solid #FDE047;}
    .stu-box{display:flex;align-items:center;gap:10px;padding:12px 24px;background:#F5F4F0;margin:14px 24px;border-radius:10px;}
    .av{width:38px;height:38px;border-radius:50%;background:${accentColor};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0;}
    .stu-name{font-size:${f.row};font-weight:700;}
    .stu-sub{font-size:10px;color:#5A6A7E;margin-top:2px;}
    .tbl{padding:0 24px 8px;}
    table{width:100%;border-collapse:collapse;}
    td{padding:7px 0;border-bottom:1px dashed #E5DFC8;font-size:${f.row};}
    td:first-child{color:#5A6A7E;width:50%;}
    td:last-child{font-weight:600;}
    tr:last-child td{border:none;}
    .bal-row{margin:10px 24px;padding:11px 16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;}
    .paid-bg{background:#F0FDF4;border:1.5px solid #86EFAC;}
    .due-bg{background:#FEF2F2;border:1.5px solid #FECACA;}
    .footer{padding:14px 24px;text-align:center;color:#9A9080;font-size:10px;border-top:1px solid #E5DFC8;margin-top:10px;}
    .cut{margin:8px 24px;border-top:2px dashed #D5CCB8;text-align:center;}
    .cut span{background:#fff;padding:0 10px;font-size:13px;color:#C4BAB0;position:relative;top:-10px;}
    .logo-img{max-height:36px;border-radius:6px;margin-bottom:6px;background:#fff;padding:2px;}
    @media print{body{padding:6px;}@page{size:${size||'A4'};margin:6mm;}}
  </style></head><body>
  <div class="hdr">
    ${logo?`<img src="${logo}" class="logo-img">`:''}
    <h1>${esc(inst)}</h1>
    ${addr?`<div class="sub">${esc(addr)}</div>`:''}
    <div class="rcpt-row">
      <div><div class="lbl">Fee Receipt</div><div class="rcpt-num gold">#${rcptNo}</div></div>
      <div style="text-align:right"><div class="lbl">Date</div><div style="font-size:${f.row};font-weight:700;margin-top:4px">${dispDate}</div></div>
    </div>
  </div>
  <div class="amount-box">
    <div>
      <div style="font-size:9px;color:#5A6A7E;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Amount Paid${month?' — <b>'+month+'</b>':''}</div>
      <div class="amount">&#8377;${Number(amount).toLocaleString('en-IN')}</div>
    </div>
    <div class="status ${isPaid?'paid-s':'part-s'}">${isPaid?'✅ FULLY PAID':'⏳ PARTIAL'}</div>
  </div>
  <div class="stu-box">
    <div class="av">${ini(s.name)}</div>
    <div style="flex:1">
      <div class="stu-name">${esc(s.name)}</div>
      <div class="stu-sub">Class ${esc(s.cls)}${s.medium?' · '+esc(s.medium):''} ${s.batch?'· '+esc(s.batch):''}${s.school?'· '+esc(s.school):''}</div>
    </div>
    ${s.parent?`<div style="text-align:right"><div style="font-size:9px;color:#5A6A7E">Guardian</div><div style="font-size:${f.lbl};font-weight:600">${esc(s.parent)}</div></div>`:''}
  </div>
  <div class="tbl"><table>
    ${(()=>{
      const baseFee=mFee-courseFeeMonthly(s);
      const cFee=courseFeeMonthly(s);
      const enrolledCourses=(s.courseIds||[]).map(cid=>courses.find(c=>c.id===cid)).filter(Boolean);
      let rows=`<tr><td>Base Monthly Fee</td><td>${fmt(baseFee)}/month</td></tr>`;
      enrolledCourses.forEach(c=>{rows+=`<tr><td>📚 ${esc(c.name)}</td><td style="color:#1D4ED8">${fmt(c.fee||0)}/month</td></tr>`;});
      if(cFee>0) rows+=`<tr style="border-top:2px solid #E0D9C8"><td style="font-weight:700">Total Monthly Fee</td><td style="font-weight:800;color:${accentColor}">${fmt(mFee)}/month</td></tr>`;
      return rows;
    })()}
    ${month?`<tr><td>Fee Month</td><td style="color:${accentColor};font-weight:700">${month}</td></tr>`:''}
    <tr><td>This Payment</td><td style="color:${accentColor};font-weight:700">${fmt(amount)}</td></tr>
    <tr><td>Total Paid (all months)</td><td style="color:#16A34A">${fmt(totalPaid)}</td></tr>
    <tr><td>Months Paid</td><td>${paidCount} month${paidCount!==1?'s':''}</td></tr>
    ${s.mobile?`<tr><td>Mobile</td><td>${esc(s.mobile)}</td></tr>`:''}
    ${s.roll?`<tr><td>Roll No.</td><td>${esc(s.roll)}</td></tr>`:''}
  </table></div>
  <div class="bal-row paid-bg">
    <span style="font-weight:700;color:#16A34A">✅ Payment Recorded</span>
    <span style="font-size:${f.h1};font-weight:900;color:#16A34A">&#8377;${Number(amount).toLocaleString('en-IN')}</span>
  </div>
  <div class="cut"><span>✂</span></div>
  <div class="footer">
    <div style="margin-bottom:3px">Thank you for your payment! 🙏</div>
    <div>${esc(inst)}${addr?' · '+esc(addr):''}</div>
    <div style="margin-top:3px">Generated by ClassCore v${localStorage.getItem('cc_app_version')||'—'} · ${dispDate}</div>
  </div>
  </body></html>`;
}
function getReceiptSize(){ return document.getElementById('receipt-size')?.value || 'A4'; }

async function printCurrentReceipt(){
  if(!curReceipt)return;
  const{s,amount,rcptNo,payDate,month}=curReceipt;
  const size = getReceiptSize();
  const html=buildReceiptHTML(s,amount,rcptNo,payDate,month,size);
  if(IS_ELECTRON()){
    const r=await window.classcore.printContent(html, size);
    if(!r?.ok) toast('Print error — check printer connection','err');
  } else {
    const w=window.open('','_blank','width=800,height=700');
    w.document.write(html);
    w.document.close();
    setTimeout(()=>{ w.focus(); w.print(); },600);
  }
}

async function saveReceiptPDF(){
  if(!curReceipt)return;
  const{s,amount,rcptNo,payDate,month}=curReceipt;
  const size = getReceiptSize();
  const html=buildReceiptHTML(s,amount,rcptNo,payDate,month,size);
  const name='Receipt_'+rcptNo+'_'+(s.name||'').replace(/\s+/g,'_');
  if(IS_ELECTRON()){
    const r=await window.classcore.savePDF(html,name,size);
    if(r?.ok) toast('\u2705 PDF saved!');
    else toast('PDF save failed','err');
  } else {
    const w=window.open('','_blank','width=800,height=700');
    w.document.write(html);
    w.document.close();
    setTimeout(()=>w.print(),600);
  }
}

async function sendReceiptAsPDF(){
  if(!curReceipt){ toast('No receipt open','err'); return; }
  const {s, amount, rcptNo, payDate, month} = curReceipt;
  if(!s){ toast('No student data','err'); return; }
  const size = getReceiptSize();
  const html = buildReceiptHTML(s, amount, rcptNo, payDate, month, size);
  const inst = localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const filename = 'Receipt_'+rcptNo+'_'+(s.name||'').replace(/\s+/g,'_');
  const mob = (s.mobile||'').replace(/\D/g,'');
  const num = mob.length===10 ? '91'+mob : mob;
  const waMsg = '\uD83E\uDDFE *Fee Receipt \u2014 '+inst+'*\n\n'
    + 'Student: *'+s.name+'*\n'
    + 'Receipt #'+rcptNo+'\n'
    + (month ? 'Month: '+month+'\n' : '')
    + 'Amount: *\u20B9'+Number(amount).toLocaleString('en-IN')+'*\n\n'
    + '\u2705 Payment recorded.\n\uD83C\uDFEB '+inst;
  showSendPDFModal(html, filename, mob.length>=10?num:'', s.email||'', waMsg, size);
}

async function sendReceiptWA(){
  if(!curReceipt){toast('No receipt to share','err');return;}
  const{s,amount,rcptNo,payDate,month}=curReceipt;
  if(!s.mobile){toast('No mobile number for this student','err');return;}
  const mobile=(s.mobile||'').replace(/\D/g,'');
  const num=mobile.length===10?'91'+mobile:mobile;
  if(!num||num.length<10){toast('Invalid mobile number','err');return;}

  const inst=localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const dispDate=payDate||todayStr();
  const totalPaid=s.paid||0;
  const mFee=monthlyFee(s);
  const paidCount=(s.history||[]).filter(h=>h.month).length;
  const cFee=courseFeeMonthly(s);
  const baseFee=mFee-cFee;
  const enrolledCourses=(s.courseIds||[]).map(cid=>courses.find(c=>c.id===cid)).filter(Boolean);
  const courseLines=enrolledCourses.length>0
    ?'\n'+enrolledCourses.map(c=>`  📚 ${c.name}: ₹${(c.fee||0).toLocaleString('en-IN')}/mo`).join('\n'):'';

  const msg=
`🧾 *Fee Receipt — ${inst}*

📋 *Receipt #${rcptNo}*
📅 Date: ${dispDate}${month?'\n📆 Month: *'+month+'*':''}

👤 *Student: ${s.name}*
Class: ${s.cls}${s.batch?' | Batch: '+s.batch:''}${s.roll?' | Roll: '+s.roll:''}

💰 *Payment Details*
  Base Fee: ₹${baseFee.toLocaleString('en-IN')}/mo${courseLines}${cFee>0?'\n  Total Fee: ₹'+mFee.toLocaleString('en-IN')+'/mo':''}
Amount Paid: *₹${Number(amount).toLocaleString('en-IN')}*
Total Paid: ₹${totalPaid.toLocaleString('en-IN')} (${paidCount} months)

✅ Payment recorded successfully!
🏫 ${inst}`;

  // In Electron: save PDF silently → open folder → open WhatsApp
  if(IS_ELECTRON()){
    toast('Saving PDF receipt…');
    const size=getReceiptSize();
    const html=buildReceiptHTML(s,amount,rcptNo,payDate,month,size);
    const fname='Receipt_'+rcptNo+'_'+(s.name||'').replace(/\s+/g,'_');
    const r=await window.classcore.savePDFSilent(html,fname,size);
    if(r?.ok){
      toast('📁 PDF saved! Attach it on WhatsApp.');
      // Open WhatsApp after short delay
      setTimeout(()=>{
        window.open('https://wa.me/'+num+'?text='+encodeURIComponent(msg));
      },800);
    } else {
      toast('PDF save failed — sending text only','warn');
      window.open('https://wa.me/'+num+'?text='+encodeURIComponent(msg));
    }
  } else {
    window.open('https://wa.me/'+num+'?text='+encodeURIComponent(msg));
  }
}

function buildStudentListHTML(){
  const inst=localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const list=students.filter(s=>!s.inactive);
  return`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Student List</title><style>body{font-family:'Segoe UI',sans-serif;padding:24px;color:#18181B;}h2{margin-bottom:4px;}p{color:#666;font-size:12px;margin-bottom:16px;}table{width:100%;border-collapse:collapse;}th{background:#18181B;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;}td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;}@media print{body{padding:10px;}}</style></head><body>
  <h2>${esc(inst)}</h2><p>Student List — ${todayStr()} — Total: ${list.length} active students</p>
  <table><thead><tr><th>#</th><th>Name</th><th>Class</th><th>School</th><th>Batch</th><th>Mobile</th><th>Guardian</th><th>Monthly Fee</th><th>Total Paid</th><th>Months Paid</th></tr></thead>
  <tbody>${list.map((s,i)=>{const mFee=monthlyFee(s);const mPaid=(s.history||[]).filter(h=>h.month).length;return`<tr><td>${i+1}</td><td><b>${esc(s.name)}</b></td><td>${esc(s.cls)}</td><td>${esc(s.school||'-')}</td><td>${esc(s.batch||'-')}</td><td>${esc(s.mobile||'-')}</td><td>${esc(s.parent||'-')}</td><td style="font-weight:700">${fmt(mFee)}/mo</td><td style="color:#16A34A">${fmt(s.paid||0)}</td><td style="color:#1D4ED8">${mPaid} mo</td></tr>`;}).join('')}</tbody></table>
  <p style="margin-top:16px;text-align:right">Generated by ClassCore — ${todayStr()}</p></body></html>`;
}
async function printStudentList(){
  const html=buildStudentListHTML();
  if(IS_ELECTRON()){const r=await window.classcore.printContent(html);if(!r.ok)toast('Print failed','err');}
  else{const w=window.open('','_blank');w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
}
async function saveStudentListPDF(){
  const html=buildStudentListHTML();
  if(IS_ELECTRON()){const r=await window.classcore.savePDF(html,'ClassCore_Students_'+todayISO());if(r.ok)toast('PDF saved!');else toast('PDF failed','err');}
  else{const w=window.open('','_blank');w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
}
function buildAttHTML(){
  const inst=localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const date=document.getElementById('att-date')?.value||todayISO();
  const batch=document.getElementById('att-bat')?.value||'All';
  let list=students.filter(s=>!s.inactive);
  if(batch&&batch!=='All')list=list.filter(s=>s.batch===batch);
  const total=list.length;
  const present=list.filter(s=>attState[s.id]!==false).length;
  return`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Attendance Report</title><style>body{font-family:'Segoe UI',sans-serif;padding:24px;color:#18181B;}h2{margin-bottom:4px;}p{color:#666;font-size:12px;margin-bottom:16px;}.stats{display:flex;gap:16px;margin-bottom:16px;}.stat{background:#F7F5F0;padding:10px 16px;border-radius:8px;text-align:center;min-width:80px;}.stat b{display:block;font-size:22px;}.stat span{font-size:10px;color:#666;text-transform:uppercase;}table{width:100%;border-collapse:collapse;}th{background:#18181B;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;}td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;}.p{color:#16A34A;font-weight:700;}.a{color:#DC2626;font-weight:700;}@media print{body{padding:10px;}}</style></head><body>
  <h2>${esc(inst)}</h2><p>Attendance Report - ${date} - Batch: ${esc(batch||'All')}</p>
  <div class="stats"><div class="stat"><b style="color:#16A34A">${present}</b><span>Present</span></div><div class="stat"><b style="color:#DC2626">${total-present}</b><span>Absent</span></div><div class="stat"><b>${total}</b><span>Total</span></div><div class="stat"><b style="color:#E8622A">${total?Math.round(present/total*100):0}%</b><span>Rate</span></div></div>
  <table><thead><tr><th>#</th><th>Name</th><th>Class</th><th>Batch</th><th>Status</th></tr></thead>
  <tbody>${list.map((s,i)=>`<tr><td>${i+1}</td><td><b>${esc(s.name)}</b></td><td>${esc(s.cls)}</td><td>${esc(s.batch||'-')}</td><td class="${attState[s.id]!==false?'p':'a'}">${attState[s.id]!==false?'Present':'Absent'}</td></tr>`).join('')}</tbody></table>
  <p style="margin-top:16px;text-align:right">Generated by ClassCore - ${todayStr()}</p></body></html>`;
}
async function printAttReport(){
  const html=buildAttHTML();
  if(IS_ELECTRON()){const r=await window.classcore.printContent(html);if(!r.ok)toast('Print failed','err');}
  else{const w=window.open('','_blank');w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
}
async function saveAttPDF(){
  const html=buildAttHTML();
  if(IS_ELECTRON()){const r=await window.classcore.savePDF(html,'ClassCore_Attendance_'+todayISO());if(r.ok)toast('PDF saved!');else toast('PDF failed','err');}
  else{const w=window.open('','_blank');w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
}

// Send attendance PDF to parent/teacher via Email or WhatsApp
async function sendAttPDF(){
  const html     = buildAttHTML();
  const date     = document.getElementById('att-date')?.value || todayISO();
  const batch    = document.getElementById('att-bat')?.value  || 'All Students';
  const inst     = localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const filename = 'Attendance_'+date+'_'+(batch||'All').replace(/\s+/g,'_');

  const vals    = Object.values(attState);
  const total   = vals.length;
  const present = vals.filter(Boolean).length;
  const rate    = total ? Math.round((present/total)*100) : 0;

  const waMsg =
    '📋 *Attendance Report — '+inst+'*\n\n'
    +'📅 Date: '+date+'\n'
    +'🏫 Batch: '+batch+'\n'
    +'✅ Present: '+present+' | ❌ Absent: '+(total-present)+' | 📊 Rate: '+rate+'%\n\n'
    +'_Generated by ClassCore_';

  // No individual parent — show send modal with no mobile/email pre-filled
  showSendPDFModal(html, filename, '', '', waMsg, 'A4');
}

function openClassFeesMod(){
  document.getElementById('classfees-body').innerHTML=`
    <p style="font-size:12px;color:#78716C;margin-bottom:16px">Set monthly fee per class. Click "Apply" to update all students in that class.</p>
    ${CLASSES.map(c=>`<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;padding:10px;background:#F7F5F0;border-radius:9px">
      <span style="background:#18181B;color:#fff;padding:4px 13px;border-radius:20px;font-size:11.5px;font-weight:700;min-width:70px;text-align:center">${c}</span>
      <input type="number" id="cf-${c}" placeholder="Monthly fee" value="${classFees[c]||''}" style="flex:1;padding:7px 10px;border:1.5px solid #E7E2D9;border-radius:7px;font-size:13px;background:#fff;outline:none">
      <button class="btn btn-ink btn-xs" onclick="applyClsFee('${c}')">Apply</button>
    </div>`).join('')}
    <button class="btn btn-ghost" style="margin-top:10px" onclick="closeModal('modal-classfees')">Close</button>`;
  openModal('modal-classfees');
}
function applyClsFee(cls){
  const v=parseFloat(document.getElementById('cf-'+cls)?.value||0);
  if(!v){toast('Enter a fee amount','err');return;}
  classFees[cls]=v;
  students=students.map(s=>{
    if(s.cls!==cls)return s;
    // v is always a monthly rate; annual = monthly * 12
    const total=v*12;const final=total-(s.discount||0);
    const monthly=v;
    return{...s,monthlyFees:monthly,totalFees:total,finalFees:final};
  });
  persist();toast('Fees applied for Class '+cls);renderFees();
}
