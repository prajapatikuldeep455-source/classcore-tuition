// ════════════════════════════════════════════════════════════════════════════
// ATTENDANCE MODULE  v2.0 — Real-time state updates
// No Firebase/onSnapshot needed — in-memory `attState` IS the real-time source.
// Toggle → instant UI update. Save → persists to disk in background.
// ════════════════════════════════════════════════════════════════════════════

let attState  = {};   // { studentId: true/false } — single source of truth
let attSearch = '';   // preserved across re-renders

// ── Render the attendance page shell (once per navigation) ────────────────────
function renderAtt(){
  const pageEl = document.getElementById('page-attendance');
  pageEl.innerHTML = `
  <div class="flex-wrap-start" style="margin-bottom:18px;align-items:flex-end">
    <div>
      <div style="font-size:10px;font-weight:700;color:#78716C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Date</div>
      <input type="date" id="att-date" value="${todayISO()}" onchange="loadAtt()"
        style="padding:9px 12px;background:var(--input-bg);border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;width:160px">
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;color:#78716C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Batch</div>
      <select id="att-bat" onchange="loadAtt()"
        style="padding:9px 12px;background:var(--input-bg);border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;width:190px;color:var(--text-main)">
        <option value="">All Active Students</option>
        ${batches.map(b=>`<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('')}
      </select>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;color:#78716C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Search</div>
      <div style="display:flex;align-items:center;gap:6px;background:var(--input-bg);border:1.5px solid var(--border);border-radius:8px;padding:0 10px;width:190px">
        <span style="color:#78716C">Search</span>
        <input id="att-search" placeholder="Search student…" value="${esc(attSearch)}"
          oninput="attSearch=this.value.toLowerCase();filterAttGrid()"
          style="border:none;background:transparent;outline:none;font-size:13px;padding:9px 0;width:100%;color:var(--text-main)">
      </div>
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap">
      <button class="btn btn-green btn-sm" onclick="markAll(true)">Mark All Present</button>
      <button class="btn btn-red btn-sm"   onclick="markAll(false)">Mark All Absent</button>
      <button class="btn btn-primary"      onclick="saveAtt()">Save Attendance</button>
      <button class="btn btn-ghost btn-sm" onclick="printAttReport()">Print</button>
      <button class="btn btn-teal btn-sm"  onclick="saveAttPDF()">PDF</button>
      <button class="btn btn-pdf btn-sm"   onclick="sendAttPDF()">Send PDF</button>
    </div>
  </div>

  <!-- Stat cards — updated by stable ID, never by position -->
  <div class="stat-grid">
    <div class="card" style="padding:13px 15px">
      <div style="font-size:10px;font-weight:700;color:#78716C">PRESENT</div>
      <div id="att-p" style="font-size:24px;font-weight:800;color:#16A34A">0</div>
    </div>
    <div class="card" style="padding:13px 15px">
      <div style="font-size:10px;font-weight:700;color:#78716C">ABSENT</div>
      <div id="att-a" style="font-size:24px;font-weight:800;color:#DC2626">0</div>
    </div>
    <div class="card" style="padding:13px 15px">
      <div style="font-size:10px;font-weight:700;color:#78716C">TOTAL</div>
      <div id="att-t" style="font-size:24px;font-weight:800">0</div>
    </div>
    <div class="card" style="padding:13px 15px">
      <div style="font-size:10px;font-weight:700;color:#78716C">RATE</div>
      <div id="att-r" style="font-size:24px;font-weight:800;color:#E8622A">—</div>
    </div>
  </div>
  <div class="att-grid" id="att-grid"></div>`;

  attSearch = '';
  loadAtt();
}

// ── Load attendance state for selected date + batch ───────────────────────────
function loadAtt(){
  const date  = document.getElementById('att-date')?.value  || todayISO();
  const batch = document.getElementById('att-bat')?.value   || '';
  const key   = `${date}__${batch||'ALL'}`;
  const saved = attData[key];

  let list = students.filter(s=>!s.inactive);
  if(batch) list = list.filter(s=>s.batch===batch);

  // Build attState from saved data or default to Present
  attState = {};
  list.forEach(s=>{
    if(saved && s.id in saved){
      attState[s.id] = saved[s.id];
    } else if(!batch){
      // "All students" view — check individual batch key first
      const bk      = `${date}__${s.batch||''}`;
      const bkSaved = attData[bk];
      attState[s.id] = (bkSaved && s.id in bkSaved) ? bkSaved[s.id] : true;
    } else {
      attState[s.id] = true; // default: present
    }
  });

  filterAttGrid(); // renders grid + updates stats
}

// ── Render the attendance card grid ──────────────────────────────────────────
function renderAttGrid(list){
  const grid = document.getElementById('att-grid');
  if(!grid) return;

  if(!list || !list.length){
    grid.innerHTML = `<div style="text-align:center;padding:50px;color:#78716C">
      <div style="font-size:44px;margin-bottom:12px">No Users</div>
      <p>No students found</p></div>`;
    updAttStats();
    return;
  }

  grid.innerHTML = list.map((s,i)=>{
    const isP = attState[s.id] !== false;
    return `
    <div class="att-card ${isP?'present':'absent'}" id="atc-${s.id}" onclick="togAtt('${s.id}')">
      <div class="av ${avcC(students.indexOf(s))}">${ini(s.name)}</div>
      <div class="att-info">
        <h4>${esc(s.name)}</h4>
        <p>${esc(s.cls)} · ${esc(s.batch||'No batch')}</p>
      </div>
      <div class="toggle${isP?' on':''}" id="tog-${s.id}"></div>
    </div>`;
  }).join('');

  updAttStats();
}

// ── Toggle a student's attendance — INSTANT UI update ────────────────────────
function togAtt(sid){
  // 1. Flip state in memory
  attState[sid] = !attState[sid];

  // 2. Update ONLY the two elements for this student — no full re-render
  const card   = document.getElementById('atc-'+sid);
  const toggle = document.getElementById('tog-'+sid);
  if(card)   card.className   = 'att-card ' + (attState[sid] ? 'present' : 'absent');
  if(toggle) toggle.className = 'toggle'    + (attState[sid] ? ' on' : '');

  // 3. Update stat cards instantly — runs in <1ms
  updAttStats();
}

// ── Update stat cards — pure DOM write, no re-render ─────────────────────────
function updAttStats(){
  const vals  = Object.values(attState);
  const total = vals.length;
  const pres  = vals.filter(Boolean).length;
  const rate  = total ? Math.round((pres/total)*100) : 0;

  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  set('att-p', pres);
  set('att-a', total - pres);
  set('att-t', total);
  set('att-r', total ? rate+'%' : '—');

  // Update rate card color: green ≥75%, orange 50–74%, red <50%
  const rEl = document.getElementById('att-r');
  if(rEl) rEl.style.color = rate>=75 ? '#16A34A' : rate>=50 ? '#E8622A' : '#DC2626';
}

// ── Filter grid by search / batch ─────────────────────────────────────────────
function filterAttGrid(){
  const batch = document.getElementById('att-bat')?.value || '';
  let list = students.filter(s=>!s.inactive);
  if(batch)     list = list.filter(s=>s.batch===batch);
  if(attSearch) list = list.filter(s=>
    (s.name||'').toLowerCase().includes(attSearch) ||
    (s.cls||'').toLowerCase().includes(attSearch)
  );
  renderAttGrid(list);
}

// ── Mark all present or all absent ────────────────────────────────────────────
function markAll(v){
  // Update state
  Object.keys(attState).forEach(k=>attState[k]=v);

  // Update each card in-place (no full grid rebuild = instant)
  Object.keys(attState).forEach(sid=>{
    const card   = document.getElementById('atc-'+sid);
    const toggle = document.getElementById('tog-'+sid);
    if(card)   card.className   = 'att-card ' + (v ? 'present' : 'absent');
    if(toggle) toggle.className = 'toggle'    + (v ? ' on' : '');
  });

  updAttStats();
}

// ── Save attendance — async, non-blocking, proper error handling ──────────────
function saveAtt(){
  const btn = document.querySelector('#page-attendance .btn-primary');
  triggerAction(btn, async ()=>{
    const date  = document.getElementById('att-date')?.value  || todayISO();
    const batch = document.getElementById('att-bat')?.value   || '';
    const key   = date+'__'+(batch||'ALL');
    attData[key] = { ...attState };
    if(!batch){
      const byBatch = {};
      Object.keys(attState).forEach(sid=>{
        const s = students.find(x=>x.id===sid); if(!s) return;
        const bk = s.batch||'';
        if(!byBatch[bk]) byBatch[bk]={};
        byBatch[bk][sid] = attState[sid];
      });
      Object.entries(byBatch).forEach(([bk,data])=>{
        attData[date+'__'+bk] = {...(attData[date+'__'+bk]||{}),...data};
      });
    }
    await persist();
    if (typeof cloudSyncMarkDirty === 'function') cloudSyncMarkDirty('attendance');
  }, { type:'save', label:'💾 Save', onDone:()=>{ updAttStats(); toast('✅ Attendance saved!'); } });
}



// ═══════════════════════════════════════════════════════
// FEATURE: STUDENT ID CARD
// ═══════════════════════════════════════════════════════
function showIDCard(sid){
  const s=students.find(x=>x.id===sid);if(!s)return;
  const inst=localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const addr=localStorage.getItem('tuitionAddress')||'';
  const mobile=localStorage.getItem('tuitionMobile')||'';
  const logo=localStorage.getItem('tuitionLogo')||'';
  const primary='#1B3154';const gold='#C9A84C';
  document.getElementById('idcard-body').innerHTML=`
  <div id="id-card-print" style="width:300px;margin:12px auto;border-radius:14px;overflow:hidden;border:2px solid ${primary};font-family:'Segoe UI',Arial,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.18)">
    <div style="background:${primary};padding:14px 16px;text-align:center;position:relative">
      ${logo?`<img src="${logo}" style="height:34px;border-radius:6px;background:#fff;padding:2px;margin-bottom:6px;display:block;margin-inline:auto">`:''}
      <div style="font-size:15px;font-weight:900;color:#fff">${esc(inst)}</div>
      ${addr?`<div style="font-size:9px;color:rgba(255,255,255,.7);margin-top:2px">${esc(addr)}</div>`:''}
      ${mobile?`<div style="font-size:10px;font-weight:700;color:${gold};margin-top:4px">📞 ${esc(mobile)}</div>`:''}
      <div style="position:absolute;bottom:-1px;left:0;right:0;height:14px;background:#fff;border-radius:50% 50% 0 0 / 100% 100% 0 0"></div>
    </div>
    <div style="background:#fff;padding:14px 16px 6px;text-align:center">
      <div style="width:88px;height:100px;border-radius:8px;border:3px solid ${primary};overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:#F7F5F0">
        ${s.photo?`<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover">`:`<div style="font-size:30px;font-weight:800;color:${primary}">${ini(s.name)}</div>`}
      </div>
      <div style="font-size:16px;font-weight:800;color:#18181B;margin-top:8px">${esc(s.name)}</div>
    </div>
    <div style="background:#fff;padding:0 16px 10px">
      ${[[s.parent?'Father/Guardian':null,s.parent],[s.mobile?'Contact No.':null,s.mobile],['Class',s.cls+(s.medium?' ('+s.medium+')':'')],[s.batch?'Batch':null,s.batch],[s.roll?'Roll No.':null,s.roll],[s.admDate?'Adm. Date':null,s.admDate],[s.addr?'Address':null,s.addr]].filter(([l])=>l).map(([l,v])=>`<div style="display:flex;border-bottom:1px solid #F0EAE0;padding:4px 0;font-size:10.5px"><span style="color:#5A6A7E;width:88px;flex-shrink:0">${l}</span><span style="font-weight:600;color:#18181B;flex:1">${esc(v)}</span></div>`).join('')}
    </div>
    <div style="background:${primary};padding:8px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:9px;color:rgba(255,255,255,.7)">STUDENT ID · ${new Date().getFullYear()}-${new Date().getFullYear()+1}</div>
      <div style="font-size:9px;color:rgba(255,255,255,.7)">Principal Sign. ________</div>
    </div>
  </div>
  ${!s.photo?'<div style=\'text-align:center;margin-top:6px;font-size:11px;color:#78716C\'>💡 Edit student → upload photo for better ID card</div>':''}`;
  openModal('modal-idcard');
}
function printIDCard(){
  const card=document.getElementById('id-card-print');
  if(!card)return;
  const inst=localStorage.getItem('tuitionName')||'ClassCore';
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ID Card</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff;}@media print{body{padding:0;}}</style></head><body>${card.outerHTML}</body></html>`;
  if(IS_ELECTRON()){window.classcore.printContent(html,'A6');}
  else{const w=window.open('','_blank');w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
}

// ═══════════════════════════════════════════════════════
// FEATURE: BULK FEE COLLECTION
// ═══════════════════════════════════════════════════════
function openBulkFee(){
  const selMonth=document.getElementById('fee-month-filter')?.value||MONTHS[new Date().getMonth()];
  const curYear=new Date().getFullYear();
  const unpaid=students.filter(s=>!s.inactive&&monthlyFee(s)>0&&!(s.history||[]).some(h=>h.month===selMonth&&(h.year||curYear)===curYear));
  document.getElementById('bulk-fee-body').innerHTML=`
  <div style="background:#FEF9C3;border:1.5px solid #FDE047;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;font-weight:600;color:#92400E">
    📅 Month: <b>${selMonth}</b> — ${unpaid.length} students not yet paid
  </div>
  <div style="margin-bottom:10px;display:flex;gap:8px">
    <button class="btn btn-ghost btn-sm" onclick="bulkSelectAll(true)">☑ Select All</button>
    <button class="btn btn-ghost btn-sm" onclick="bulkSelectAll(false)">☐ Deselect All</button>
  </div>
  <div style="max-height:360px;overflow-y:auto">
    ${unpaid.length===0?'<div style="text-align:center;padding:30px;color:#16A34A;font-weight:700">✅ All students paid for '+selMonth+'!</div>':
    unpaid.map(s=>`<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid #E7E2D9;border-radius:10px;margin-bottom:8px;cursor:pointer;background:#fff">
      <input type="checkbox" class="bulk-chk" data-sid="${s.id}" data-fee="${monthlyFee(s)}" checked style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer">
      <div style="flex:1">
        <div style="font-weight:700">${esc(s.name)}</div>
        <div style="font-size:11px;color:#78716C">${esc(s.cls)} · ${esc(s.batch||'No batch')}</div>
      </div>
      <div style="font-weight:700;color:var(--primary)">${fmt(monthlyFee(s))}</div>
    </label>`).join('')}
  </div>`;
  openModal('modal-bulk-fee');
}
function bulkSelectAll(val){
  document.querySelectorAll('.bulk-chk').forEach(c=>c.checked=val);
}
function collectBulkFees(){
  const selMonth=document.getElementById('fee-month-filter')?.value||MONTHS[new Date().getMonth()];
  const curYear=new Date().getFullYear();
  const checked=[...document.querySelectorAll('.bulk-chk:checked')];
  if(!checked.length){toast('No students selected','err');return;}
  let collected=0,totalAmt=0;
  checked.forEach(chk=>{
    const sid=chk.getAttribute('data-sid');
    const fee=parseFloat(chk.getAttribute('data-fee')||0);
    if(!fee)return;
    const paidAlready=(students.find(s=>s.id===sid)?.history||[]).some(h=>h.month===selMonth&&(h.year||curYear)===curYear);
    if(paidAlready)return;
    const rcptNo=(parseInt(localStorage.getItem('rcptNo')||1000))+1;
    localStorage.setItem('rcptNo',rcptNo);
    students=students.map(s=>{
      if(s.id!==sid)return s;
      const history=[...(s.history||[]),{amount:fee,date:todayStr(),receiptNo:rcptNo,month:selMonth,year:curYear}];
      return{...s,paid:(s.paid||0)+fee,history};
    });
    collected++;totalAmt+=fee;
  });
  persist();
  closeModal('modal-bulk-fee');
  renderFees();
  toast(`✅ Collected ${selMonth} fees from ${collected} students — ${fmt(totalAmt)}`);
}

// ═══════════════════════════════════════════════════════
// FEATURE: EXPENSE TRACKING
// ═══════════════════════════════════════════════════════
const EXP_CATS=['Rent','Salary','Electricity','Water','Internet','Stationery','Furniture','Maintenance','Advertising','Other'];
let editExpId=null;
function renderExpenses(){
  const curMonth=MONTHS[new Date().getMonth()];
  const curYear=new Date().getFullYear();
  // FIX: was d.getMonth()===curYear (wrong) — should compare month name
  const thisMonthExp=expenses.filter(e=>{
    const d=new Date(e.date);
    return MONTHS[d.getMonth()]===curMonth&&d.getFullYear()===curYear;
  }).reduce((a,e)=>a+(e.amount||0),0);
  const feesCol=students.reduce((a,s)=>a+(s.paid||0),0);
  const profit=feesCol-thisMonthExp;

  // Only rebuild if page not yet rendered (avoid full re-render)
  const page=document.getElementById('page-expenses');
  const alreadyBuilt=page.querySelector('#exp-table-body');

  if(!alreadyBuilt){
    page.innerHTML=`
    <div class="grid-3" style="margin-bottom:16px">
      <div class="card" style="text-align:center"><div style="font-size:20px">Exp</div><div id="exp-stat-month" style="font-size:22px;font-weight:800;color:#DC2626;margin:4px 0">${fmt(thisMonthExp)}</div><div style="font-size:11px;color:#78716C">${curMonth} Expenses</div></div>
      <div class="card" style="text-align:center"><div style="font-size:20px">Fee</div><div style="font-size:22px;font-weight:800;color:#16A34A;margin:4px 0">${fmt(feesCol)}</div><div style="font-size:11px;color:#78716C">Total Fees Collected</div></div>
      <div class="card" style="text-align:center"><div style="font-size:20px">Trend</div><div id="exp-stat-profit" style="font-size:22px;font-weight:800;color:${profit>=0?'#16A34A':'#DC2626'};margin:4px 0">${fmt(Math.abs(profit))}</div><div style="font-size:11px;color:#78716C">${profit>=0?'Net Profit':'Net Loss'}</div></div>
    </div>
    <div id="exp-form-wrap"></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid To</th><th>Amount</th><th>Actions</th></tr></thead>
      <tbody id="exp-table-body"></tbody>
    </table></div>`;
  } else {
    // Just update stats
    const sm=document.getElementById('exp-stat-month');
    const sp=document.getElementById('exp-stat-profit');
    if(sm) sm.textContent=fmt(thisMonthExp);
    if(sp){ sp.textContent=fmt(Math.abs(profit)); sp.style.color=profit>=0?'#16A34A':'#DC2626'; }
  }

  // Always refresh table body
  const tbody=document.getElementById('exp-table-body');
  if(tbody){
    tbody.innerHTML=expenses.length===0
      ?'<tr><td colspan="6" style="text-align:center;padding:30px;color:#78716C">No expenses yet. Add one!</td></tr>'
      :[...expenses].reverse().map(e=>`<tr data-exp-id="${esc(e.id)}">
        <td style="color:#78716C;font-size:12px">${e.date}</td>
        <td><span class="badge badge-gray">${esc(e.category)}</span></td>
        <td style="font-weight:600">${esc(e.desc)}</td>
        <td style="color:#78716C">${esc(e.paidTo||'—')}</td>
        <td style="font-weight:700;color:#DC2626">${fmt(e.amount)}</td>
        <td><div style="display:flex;gap:5px">
          <button class="btn btn-ghost btn-xs" onclick="editExpense('${e.id}')">Edit</button>
          <button class="btn btn-red btn-xs" onclick="delExpense('${e.id}')">Del</button>
        </div></td>
      </tr>`).join('');
  }
}

function openExpenseForm(id){
  const e=id?expenses.find(x=>x.id===id):null;
  editExpId=id||null;
  document.getElementById('modal-exp-title').textContent=e?'Edit Expense':'Add Expense';
  document.getElementById('modal-exp-body').innerHTML=`
  <div class="form-grid">
    <div class="fg"><label>Date ★</label><input type="date" id="ef-date" value="${e?.date||todayISO()}"></div>
    <div class="fg"><label>Category ★</label><select id="ef-cat">${EXP_CATS.map(c=>`<option${e?.category===c?' selected':''}>${c}</option>`).join('')}</select></div>
    <div class="fg"><label>Description ★</label><input id="ef-desc" placeholder="e.g. Monthly rent" value="${esc(e?.desc||'')}"></div>
    <div class="fg"><label>Paid To</label><input id="ef-to" placeholder="Person/company name" value="${esc(e?.paidTo||'')}"></div>
    <div class="fg full"><label>Amount (₹) ★</label><input type="number" id="ef-amt" placeholder="0" value="${e?.amount||''}"></div>
  </div>
  <div class="modal-foot">
    <button class="btn btn-ghost" onclick="closeFormModal('expense')">Cancel</button>
    <button class="btn btn-primary" onclick="saveExpense()">${e?'Update':'Save'} Expense</button>
  </div>`;
  openModal('modal-expense-form');
}

function closeExpenseForm(){
  const wrap=document.getElementById('exp-form-wrap');
  if(wrap) wrap.innerHTML='';
  editExpId=null;
}

async function saveExpense(){
  const btn  = document.querySelector('#modal-exp-body .modal-foot .btn-primary');
  const date = document.getElementById('ef-date')?.value||todayISO();
  const category = document.getElementById('ef-cat')?.value||'Other';
  const desc = (document.getElementById('ef-desc')?.value||'').trim();
  const paidTo = (document.getElementById('ef-to')?.value||'').trim();
  const amount = parseFloat(document.getElementById('ef-amt')?.value||0);
  if(!desc){toast('Enter description','err');return;}
  if(!amount||amount<=0){toast('Enter a valid amount','err');return;}

  await triggerAction(btn, async ()=>{
    if(editExpId){
      expenses=expenses.map(e=>e.id===editExpId?{...e,date,category,desc,paidTo,amount}:e);
    } else {
      expenses.push({id:uid(),date,category,desc,paidTo,amount});
    }
    await persist();
  }, {
    type:'save', label: editExpId ? '💾 Update' : '💾 Save',
    onDone:()=>{
      const wasEdit = !!editExpId;
      closeFormModal('expense');
      editExpId = null;
      renderExpenses();
      toast(wasEdit ? '✅ Expense updated!' : '✅ Expense added!');
    }
  });
}

function editExpense(id){ openExpenseForm(id); }

function delExpense(id){
  if(!confirm('Delete this expense?')) return;
  const row=document.querySelector(`tr[data-exp-id="${id}"]`);
  if(row) row.className='row-just-deleted';
  showLoader('Deleting Expense…','Removing record','\uD83D\uDDD1\uFE0F');
  setTimeout(async()=>{
    expenses=expenses.filter(e=>e.id!==id);
    await persist();
    hideLoader();renderExpenses();toast('Expense deleted','err');
  },800);
}

// ═══════════════════════════════════════════════════════
// FEATURE: BROADCAST / ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════
function renderBroadcast(){
  const page=document.getElementById('page-broadcast');
  const alreadyBuilt=page.querySelector('#bc-list-body');

  if(!alreadyBuilt){
    const active=students.filter(s=>!s.inactive&&s.mobile);
    page.innerHTML=`
    <div class="card" style="margin-bottom:18px">
      <h3 style="font-size:15px;font-weight:700;margin-bottom:14px">Send Announcement to Parents</h3>
      <div class="form-grid">
        <div class="fg full"><label>Message ★</label>
          <textarea id="bc-msg" rows="4" placeholder="Type your announcement here…&#10;e.g. Dear Parents, school will be closed on 15th April due to holiday." style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;resize:vertical;outline:none;font-family:inherit;background:var(--input-bg);color:var(--text-main)"></textarea>
        </div>
        <div class="fg"><label>Send To</label>
          <select id="bc-target" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--input-bg);color:var(--text-main);outline:none;width:100%">
            <option value="all">All Students (${active.length} parents)</option>
            ${batches.map(b=>`<option value="bat_${b.id}">Batch: ${esc(b.name)}</option>`).join('')}
            ${getClasses().map(c=>`<option value="cls_${c}">Class: ${c}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>Sending</label>
          <div style="background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:8px;padding:10px 12px;font-size:12px;color:#16A34A;font-weight:600">${active.length} parents have mobile numbers</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;align-items:center">
        <button class="btn btn-green" onclick="sendBroadcast()">Send via WhatsApp</button>
        <span style="font-size:11px;color:#78716C">WhatsApp opens for each parent. Press send for each one.</span>
      </div>
    </div>
    <div class="sec-hdr"><h3>📜 Previous Announcements</h3></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Message</th><th>Sent To</th><th>Actions</th></tr></thead>
      <tbody id="bc-list-body"></tbody>
    </table></div>`;
  }

  // Always refresh just the list
  refreshBroadcastList();
}

function refreshBroadcastList(){
  const tbody=document.getElementById('bc-list-body');
  if(!tbody)return;
  tbody.innerHTML=announcements.length===0
    ?'<tr><td colspan="4" style="text-align:center;padding:30px;color:#78716C">No announcements yet.</td></tr>'
    :[...announcements].reverse().map(a=>`<tr>
      <td style="color:#78716C;font-size:12px">${a.date}</td>
      <td style="font-size:12px;max-width:300px">${esc(a.text).substring(0,80)}${a.text.length>80?'…':''}</td>
      <td><span class="badge badge-gray">${a.sentTo||'All'} (${a.recipients||0})</span></td>
      <td><div style="display:flex;gap:5px">
        <button class="btn btn-green btn-xs" onclick="reSendBroadcast('${a.id}')">Resend</button>
        <button class="btn btn-red btn-xs" onclick="delAnnouncement('${a.id}')">Del</button>
      </div></td>
    </tr>`).join('');
}

let _bcQueue=[];
let _bcIdx=0;
let _bcMsg='';
let _bcInst='';

async function sendBroadcast(){
  const msg=(document.getElementById('bc-msg')?.value||'').trim();
  if(!msg){toast('Type a message first','err');return;}
  const target=document.getElementById('bc-target')?.value||'all';
  const inst=localStorage.getItem('tuitionName')||'ClassCore Tuition';
  let targets=students.filter(s=>!s.inactive&&s.mobile);
  if(target.startsWith('bat_')){const bid=target.slice(4);const b=batches.find(x=>x.id===bid);if(b)targets=targets.filter(s=>s.batch===b.name);}
  if(target.startsWith('cls_')){const cls=target.slice(4);targets=targets.filter(s=>s.cls===cls);}
  if(!targets.length){toast('No students with mobile numbers in this group','err');return;}

  // Save to history
  announcements.unshift({id:uid(),date:todayStr(),text:msg,sentTo:target==='all'?'All':'Group',recipients:targets.length});
  persist();
  refreshBroadcastList();

  // Check if WhatsApp Hub is connected for direct sending
  if (typeof window.classcore !== 'undefined' && window.classcore.waHub) {
    try {
      const waStatus = await window.classcore.waHub.isConnected();
      if (waStatus && waStatus.connected) {
        // Direct background sending via WhatsApp Hub
        const contacts = targets.map(s => {
          const mobile = (s.mobile || '').replace(/\D/g, '');
          const num = mobile.length === 10 ? '91' + mobile : mobile;
          return {
            phone: num,
            fields: {
              A: num,
              B: s.parentName || s.name || '',
            }
          };
        }).filter(c => c.phone);

        const template = 'Dear {B},\n\n📢 *' + (inst || 'Institute') + '*\n\n' + msg + '\n\n_Sent via ClassCore_';

        // Show progress UI
        toast('📤 Sending broadcast to ' + contacts.length + ' recipients...', 'info');
        
        // Track progress
        const progressHandler = (prog) => {
          if (prog.done) {
            toast('✅ Broadcast complete: ' + (prog.sent || 0) + ' sent, ' + (prog.failed || 0) + ' failed', prog.failed > 0 ? 'warning' : 'success');
          }
        };
        window.classcore.waHub.onBulkProgress(progressHandler);

        await window.classcore.waHub.sendBulk({
          contacts: contacts,
          message: template,
        });
        return;
      }
    } catch (e) {
      console.warn('WhatsApp Hub send failed, falling back to manual queue:', e);
    }
  }

  // Start queue
  _bcQueue=[...targets];
  _bcIdx=0;
  _bcMsg=msg;
  _bcInst=inst;
  showSendQueue();
}

function showSendQueue(){
  if(_bcIdx>=_bcQueue.length){
    // Done
    const qEl=document.getElementById('bc-queue-wrap');
    if(qEl) qEl.innerHTML=`
      <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:20px;text-align:center">
        <div style="font-size:36px;margin-bottom:8px">Done</div>
        <div style="font-size:16px;font-weight:800;color:#16A34A">All ${_bcQueue.length} messages sent!</div>
        <div style="font-size:12px;color:#78716C;margin-top:6px">All parents have been messaged.</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:14px" onclick="closeSendQueue()">Close</button>
      </div>`;
    toast(`✅ All ${_bcQueue.length} messages sent!`);
    return;
  }

  const s=_bcQueue[_bcIdx];
  const total=_bcQueue.length;
  const done=_bcIdx;
  const pct=Math.round((done/total)*100);
  const mobile=(s.mobile||'').replace(/\D/g,'');
  const num=mobile.length===10?'91'+mobile:mobile;
  const fullMsg=`Dear ${s.parent||s.name},\n\n📢 *${_bcInst}*\n\n${_bcMsg}\n\n_Sent via ClassCore_`;
  const waUrl='https://wa.me/'+num+'?text='+encodeURIComponent(fullMsg);

  // Render queue UI
  let qEl=document.getElementById('bc-queue-wrap');
  if(!qEl){
    const card=document.createElement('div');
    card.id='bc-queue-wrap';
    card.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    document.body.appendChild(card);
    qEl=card;
  }

  qEl.innerHTML=`
  <div style="background:#fff;border-radius:20px;padding:28px 32px;width:420px;max-width:95vw;box-shadow:0 24px 60px rgba(0,0,0,.25)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div style="font-size:15px;font-weight:800">💬 Sending Messages</div>
      <button onclick="closeSendQueue()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#78716C;line-height:1">×</button>
    </div>

    <!-- Progress bar -->
    <div style="background:#E7E2D9;border-radius:10px;height:8px;margin-bottom:6px;overflow:hidden">
      <div style="background:var(--primary);height:100%;width:${pct}%;border-radius:10px;transition:width .4s"></div>
    </div>
    <div style="font-size:11px;color:#78716C;margin-bottom:20px">${done} of ${total} sent</div>

    <!-- Current student -->
    <div style="background:#F7F5F0;border-radius:12px;padding:14px 16px;margin-bottom:20px">
      <div style="font-size:11px;color:#78716C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Sending to:</div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="av avc${_bcIdx%6}" style="width:40px;height:40px;font-size:14px">${ini(s.name)}</div>
        <div>
          <div style="font-weight:700;font-size:14px">${esc(s.name)}</div>
          <div style="font-size:12px;color:#78716C">${s.parent?'Guardian: '+esc(s.parent)+' · ':''} 📱 ${esc(s.mobile)}</div>
          <div style="font-size:11px;color:#78716C">Class ${esc(s.cls)}${s.batch?' · '+esc(s.batch):''}</div>
        </div>
      </div>
    </div>

    <!-- Message preview -->
    <div style="background:#DCF8C6;border-radius:10px;padding:10px 14px;font-size:12px;color:#18181B;margin-bottom:20px;white-space:pre-wrap;max-height:100px;overflow-y:auto;line-height:1.5">Dear ${esc(s.parent||s.name)},

📢 *${esc(_bcInst)}*

${esc(_bcMsg)}</div>

    <!-- Action buttons -->
    <div style="display:flex;gap:10px">
      <button onclick="sendQueueCurrent('${waUrl.replace(/'/g,"\\'")}')" 
        style="flex:1;background:#25D366;color:#fff;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
        Open WhatsApp
      </button>
      <button onclick="nextInQueue()" 
        style="background:#F7F5F0;color:#18181B;border:1.5px solid #E7E2D9;border-radius:10px;padding:13px 18px;font-size:13px;font-weight:600;cursor:pointer">
        Skip →
      </button>
    </div>
    <div style="font-size:10px;color:#78716C;margin-top:10px;text-align:center">
      After pressing Send in WhatsApp, click "Next →" or come back here
    </div>
    <button onclick="nextInQueue()" 
      style="width:100%;margin-top:10px;background:var(--primary);color:#fff;border:none;border-radius:10px;padding:11px;font-size:13px;font-weight:700;cursor:pointer">
      ✅ Sent! Next → (${_bcIdx+1}/${total})
    </button>
  </div>`;

  // Auto-open WhatsApp for this person
  window.open(waUrl);
}

function sendQueueCurrent(url){
  window.open(url);
}

function nextInQueue(){
  _bcIdx++;
  showSendQueue();
}

function closeSendQueue(){
  const el=document.getElementById('bc-queue-wrap');
  if(el) el.remove();
  _bcQueue=[];_bcIdx=0;
}

function reSendBroadcast(id){
  const a=announcements.find(x=>x.id===id);if(!a)return;
  const textarea=document.getElementById('bc-msg');
  if(textarea){
    textarea.value=a.text;
    textarea.focus();
    textarea.scrollIntoView({behavior:'smooth',block:'center'});
  }
}

function delAnnouncement(id){
  if(!confirm('Delete this announcement?'))return;
  announcements=announcements.filter(a=>a.id!==id);
  persist();
  refreshBroadcastList();
  toast('Deleted','err');
}

// ═══════════════════════════════════════════════════════
// FEATURE: TEACHER SALARY (in Settings)
// ═══════════════════════════════════════════════════════
function renderSalaries(){
  const users=getUsers().filter(u=>u.role!=='admin');
  const curMonth=MONTHS[new Date().getMonth()];
  const curYear=new Date().getFullYear();
  const el=document.getElementById('salary-section');
  if(!el)return;
  el.innerHTML=`
  <div class="sec-hdr"><h3>💵 Teacher Salaries — ${curMonth} ${curYear}</h3></div>
  ${users.length===0?'<div style="color:#78716C;font-size:13px">No employees added yet.</div>':
  users.map(u=>{
    const paid=salaries.some(s=>s.userId===u.username&&s.month===curMonth&&s.year===curYear);
    const salRec=salaries.find(s=>s.userId===u.username&&s.month===curMonth&&s.year===curYear);
    return`<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:#F7F5F0;border-radius:10px;margin-bottom:10px;border:1.5px solid ${paid?'#BBF7D0':'#E7E2D9'}">
      <div class="av avc1" style="width:36px;height:36px;font-size:13px">${ini(u.name||u.username)}</div>
      <div style="flex:1">
        <div style="font-weight:700">${esc(u.name||u.username)}</div>
        <div style="font-size:11px;color:#78716C">${esc(u.role||'Employee')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="number" id="sal-${u.username}" placeholder="Salary ₹" value="${salRec?.amount||''}" style="width:100px;padding:6px 10px;border:1.5px solid #E7E2D9;border-radius:7px;font-size:12px;outline:none">
        ${paid
          ?`<span style="background:#DCFCE7;color:#16A34A;border:1.5px solid #86EFAC;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700">✅ Paid ${fmt(salRec?.amount||0)}</span>
             <button class="btn btn-ghost btn-xs" onclick="undoSalary('${u.username}')">Undo</button>`
          :`<button class="btn btn-teal btn-sm" onclick="markSalaryPaid('${u.username}')">✓ Mark Paid</button>`
        }
      </div>
    </div>`;
  }).join('')}`;
}
function markSalaryPaid(username){
  const curMonth=MONTHS[new Date().getMonth()];
  const curYear=new Date().getFullYear();
  const amt=parseFloat(document.getElementById('sal-'+username)?.value||0);
  if(!amt){toast('Enter salary amount first','err');return;}

  showLoader('Paying Salary…','Saving payment record','💵');
  setTimeout(async ()=>{
    salaries=salaries.filter(s=>!(s.userId===username&&s.month===curMonth&&s.year===curYear));
    salaries.push({id:uid(),userId:username,month:curMonth,year:curYear,amount:amt,paidDate:todayStr()});
    await persist();
    hideLoader();
    toast('✅ Salary marked as paid!');
    renderSalaries();
  }, 1200);
}

function undoSalary(username){
  const curMonth=MONTHS[new Date().getMonth()];
  const curYear=new Date().getFullYear();
  showLoader('Undoing Salary…','Removing payment record','↩️');
  setTimeout(async ()=>{
    salaries=salaries.filter(s=>!(s.userId===username&&s.month===curMonth&&s.year===curYear));
    await persist();
    hideLoader();
    renderSalaries();
    toast('Salary payment undone');
  }, 1000);
}
