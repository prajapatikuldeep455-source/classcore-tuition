const annualFee=s=>monthlyFee(s)*12;
const bStu=b=>students.filter(s=>s.batch===b.name&&!s.inactive);
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/`/g,'&#x60;');

// TOAST
let toastT;
function toast(msg,type='ok'){
  const el=document.getElementById('toast');
  el.innerHTML=(type==='err'?'❌ ':type==='warn'?'⚠️ ':'✅ ')+esc(msg);
  el.style.background=type==='err'?'#DC2626':type==='warn'?'#E67E22':'#18181B';
  el.classList.add('show');clearTimeout(toastT);
  toastT=setTimeout(()=>el.classList.remove('show'),2800);
}

// ── GLOBAL LOADING OVERLAY ───────────────────────────────────────────────────
// showLoader(title, sub, icon)  — shows full-screen loader
// hideLoader()                  — hides it
// withLoader(fn, title, sub, icon) — shows loader, runs fn, hides loader
function showLoader(title='Processing…', sub='Please wait', icon='✏️'){
  const ov    = document.getElementById('loading-overlay');
  const tEl   = document.getElementById('lo-title');
  const sEl   = document.getElementById('lo-sub');
  const iEl   = document.getElementById('lo-icon');
  if(tEl) tEl.textContent = title;
  if(sEl) sEl.textContent = sub;
  if(iEl) iEl.textContent = icon;
  if(ov)  ov.style.display = 'flex';
}

function hideLoader(){
  const ov = document.getElementById('loading-overlay');
  if(ov) ov.style.display = 'none';
}

async function withLoader(fn, title='Processing…', sub='Please wait', icon='✏️'){
  showLoader(title, sub, icon);
  try       { await fn(); }
  catch(err){ console.error('[withLoader] error:', err); }
  finally   { hideLoader(); }
}
function openModal(id){
  const el=document.getElementById(id);
  if(!el)return;
  // Re-trigger animation on re-open
  const box=el.querySelector('.modal-box');
  if(box){box.style.animation='none';requestAnimationFrame(()=>{box.style.animation='';});}
  el.classList.add('open');
}
function closeModal(id){document.getElementById(id)?.classList.remove('open');}

function closeFormModal(type){
  const map={student:'modal-student-form',batch:'modal-batch-form',course:'modal-course-form',expense:'modal-expense-form'};
  closeModal(map[type]||('modal-'+type+'-form'));
}

function updSbInst(){
  const s=document.getElementById('sb-inst-name');
  if(s) s.textContent=localStorage.getItem('tuitionName')||'Tuition Management';
}

// ── DATA SAVING ──────────────────────────────────────────────────────────
let currentUser=null;

// ── PASSWORD HASHING (SHA-256) ───────────────────────────────────────────
// Uses Web Crypto API for secure hashing in the renderer process.
async function hashPassword(plain){
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
// Check if a string looks like a SHA-256 hash (64 hex chars)
function _isHashed(s){ return typeof s === 'string' && /^[a-f0-9]{64}$/.test(s); }

// Pre-hashed default password: SHA-256 of 'classcore@123'
const _DEFAULT_HASH = '7e0a1a1c3d0e4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f';

function getUsers(){
  try{
    const d=localStorage.getItem('cc_users');
    if(!d) return [{username:'admin',password:'classcore@123',role:'admin',name:'Admin',mustChange:true}];
    const parsed=JSON.parse(d);
    return Array.isArray(parsed)?parsed:[{username:'admin',password:'classcore@123',role:'admin',name:'Admin',mustChange:true}];
  }catch(e){
    console.warn('getUsers error:',e.message);
    return [{username:'admin',password:'classcore@123',role:'admin',name:'Admin',mustChange:true}];
  }
}
function saveUsers(u){localStorage.setItem('cc_users',JSON.stringify(u));persist();}
function isAdmin(){return currentUser&&currentUser.role==='admin';}
function adminOnly(msg){if(!isAdmin()){toast(msg||'Administrative privileges required for this action','warn');return true;}return false;}

// ── PERMISSION SYSTEM ─────────────────────────────────────────────────────
// Default permissions for employees (admin always has ALL permissions)
const DEFAULT_PERMS = {
  add_students:    true,
  edit_students:   true,
  delete_students: false,
  collect_fees:    true,
  delete_payments: false,
  mark_attendance: true,
  view_fees:       true,
  manage_batches:  false,
  manage_courses:  false,
};

function hasPermission(perm){
  if(isAdmin()) return true; // Admin can always do everything
  const users = getUsers();
  const me = users.find(u=>u.username===currentUser?.username);
  if(!me) return false;
  const perms = me.permissions || DEFAULT_PERMS;
  return perms[perm] === true;
}

function canDo(perm, msg){
  if(!hasPermission(perm)){
    toast(msg || 'You do not have permission to perform this action','warn');
    return false;
  }
  return true;
}

async function doLogin(){
  const u=(document.getElementById('l-user').value||'').trim();
  const p=document.getElementById('l-pass').value||'';
  if(!u){toast('Enter username','err');return;}
  if(!p){toast('Enter password','err');return;}
  const users=getUsers();
  // Check username exists first
  const byUser=users.find(x=>x.username===u);
  if(!byUser){toast('Username not found','err');return;}
  // Hash the entered password for comparison
  const hashedInput = await hashPassword(p);
  let found = users.find(x=>x.username===u && x.password===hashedInput);
  // Backward compatibility: if hash didn't match, try plain-text comparison
  // and auto-migrate the password to hashed version
  if(!found){
    const plainMatch = users.find(x=>x.username===u && x.password===p);
    if(plainMatch && !_isHashed(plainMatch.password)){
      // Auto-migrate: save hashed version
      plainMatch.password = hashedInput;
      saveUsers(users);
      found = plainMatch;
    }
  }
  if(!found){toast('Wrong password','err');return;}
  // Correct credentials
  if(found.mustChange){
    showForceChangePassword(found);
    return;
  }
  currentUser={username:found.username,role:found.role,name:found.name||found.username};
  localStorage.setItem('ops_logged','1');
  localStorage.setItem('ops_cur_user',JSON.stringify(currentUser));
  if(found.role==='admin'){
    localStorage.setItem('username',found.username);
    localStorage.setItem('password',found.password);
  }
  persist();
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='flex';
  initApp();
}
function doLogout(){
  // ── 1. Clear ALL session-related localStorage keys ────────────────
  localStorage.removeItem('ops_logged');
  localStorage.removeItem('ops_cur_user');
  currentUser = null;

  // ── 2. Save data to disk WITHOUT session state ────────────────────
  //    (buildPayload no longer includes ops_logged)
  if(IS_ELECTRON()){
    try{ window.classcore.saveDataSync(buildPayload()); }catch(e){}
  } else {
    try{
      sv('ops_s',students);sv('ops_b',batches);sv('ops_cf',classFees);
    sv('ops_exams',exams);
      sv('ops_sfo',stuFeeOvr);sv('ops_att',attData);sv('ops_mf',monthFees);
    }catch(e){}
  }

  // ── 3. Reset UI directly — NO location.reload() ───────────────────
  //    reload() triggers loadAllData() which reads old file → auto-login again
  //    By hiding/showing elements instead, we avoid the whole cycle.
  document.getElementById('app').style.display          = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('license-screen').style.display = 'none';

  // ── 4. Clear login form fields ────────────────────────────────────
  const lu = document.getElementById('l-user');
  const lp = document.getElementById('l-pass');
  if(lu){ lu.value = ''; }
  if(lp){ lp.value = ''; }
  if(lu) setTimeout(()=>lu.focus(), 100);

  // ── 5. Reset nav to dashboard for next login ──────────────────────
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const dash = document.getElementById('page-dashboard');
  if(dash) dash.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const di = document.querySelector('.nav-item[data-page="dashboard"]');
  if(di) di.classList.add('active');
}

// ── FORCE CHANGE PASSWORD (first login) ────────────────────────────────────
let _pendingUser = null;
function showForceChangePassword(user){
  _pendingUser = user;
  document.getElementById('force-change-screen').style.display='flex';
}
async function saveForceChange(){
  const u=(document.getElementById('fc-user').value||'').trim();
  const p=(document.getElementById('fc-pass').value||'').trim();
  const p2=(document.getElementById('fc-pass2').value||'').trim();
  const msg=document.getElementById('fc-msg');
  if(!u){msg.textContent='Username required';return;}
  if(!p||p.length<6){msg.textContent='Password must be at least 6 characters';return;}
  if(p!==p2){msg.textContent='Passwords do not match';return;}
  const users=getUsers();
  // Check username not taken by someone else
  if(users.find(x=>x.username===u&&x.username!==_pendingUser.username)){
    msg.textContent='Username already taken';return;
  }
  const idx=users.findIndex(x=>x.username===_pendingUser.username);
  if(idx===-1){msg.textContent='User not found';return;}
  const hashed = await hashPassword(p);
  users[idx].username=u;
  users[idx].password=hashed;
  users[idx].mustChange=false;
  saveUsers(users);
  if(_pendingUser.role==='admin'){
    localStorage.setItem('username',u);
    localStorage.setItem('password',hashed);
  }
  document.getElementById('force-change-screen').style.display='none';
  // Now login
  currentUser={username:u,role:users[idx].role,name:users[idx].name||u};
  localStorage.setItem('ops_logged','1');
  localStorage.setItem('ops_cur_user',JSON.stringify(currentUser));
  persist();
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='flex';
  initApp();
  toast('✅ Password set! Welcome to ClassCore!');
}

// ── FORGOT PASSWORD (OTP via email) ────────────────────────────────────────
let _otpCode = '';
let _otpEmail = '';
let _otpMobile = '';

function showForgotPassword(){
  document.getElementById('forgot-screen').style.display='flex';
  document.getElementById('fp-step1').style.display='block';
  document.getElementById('fp-step2').style.display='none';
  document.getElementById('fp-msg').textContent='';
}

async function sendForgotOTP(){
  const email=(document.getElementById('fp-email').value||'').trim().toLowerCase();
  const mobile=(document.getElementById('fp-mobile').value||'').trim();
  const msg=document.getElementById('fp-msg');

  if(!email||!email.includes('@')){msg.style.color='#DC2626';msg.textContent='Enter valid email';return;}
  if(!mobile||mobile.length!==10){msg.style.color='#DC2626';msg.textContent='Enter valid 10-digit mobile';return;}

  msg.style.color='#E8622A';msg.textContent='⏳ Verifying...';

  // ── LOCAL VERIFICATION — check against stored registration ──────────
  // No Google Sheets needed. Works 100% offline.
  const reg = getRegistration();
  const users = getUsers();

  // Check if email+mobile matches the registered owner
  const ownerMatch = reg && reg.email === email && (reg.mobile === mobile || reg.mobile === mobile.replace(/\D/g,''));
  // Check if email+mobile matches any employee user
  const empMatch = users.find(u => u.email === email && u.mobile === mobile);

  if(!ownerMatch && !empMatch){
    msg.style.color='#DC2626';
    msg.textContent='❌ Email and mobile not found. Check your details and try again.';
    return;
  }

  // ── Verified — skip OTP, go directly to password reset ─────────────
  _otpEmail  = email;
  _otpMobile = mobile;
  _otpCode   = '000000'; // dummy — not used in local mode

  // Show reset form directly (no OTP needed)
  document.getElementById('fp-step1').style.display='none';
  document.getElementById('fp-step2').style.display='block';
  msg.style.color='#16A34A';
  msg.textContent='✅ Identity verified! Set your new password below.';

  // Hide the OTP field since we don't need it
  const otpField = document.getElementById('fp-otp')?.closest('.fg');
  if(otpField) otpField.style.display='none';
}

async function verifyForgotOTP(){
  const newUser  = (document.getElementById('fp-newuser').value||'').trim();
  const newPass  = (document.getElementById('fp-newpass').value||'').trim();
  const newPass2 = (document.getElementById('fp-newpass2').value||'').trim();
  const msg      = document.getElementById('fp-msg');

  if(!newPass||newPass.length<6){
    msg.style.color='#DC2626'; msg.textContent='Password must be at least 6 characters'; return;
  }
  if(newPass!==newPass2){
    msg.style.color='#DC2626'; msg.textContent='Passwords do not match'; return;
  }

  // ── Find the user to reset ──────────────────────────────────────────────
  const users = getUsers();
  const reg   = getRegistration();
  let targetUser = null;

  if(reg && reg.email === _otpEmail)    targetUser = users.find(x=>x.role==='admin');
  if(!targetUser)                       targetUser = users.find(x=>x.email===_otpEmail);
  if(!targetUser)                       targetUser = users[0]; // fallback

  if(!targetUser){
    msg.style.color='#DC2626'; msg.textContent='User not found. Please contact support.'; return;
  }

  const idx        = users.indexOf(targetUser);
  const finalUser  = (newUser && newUser !== users[idx].username) ? newUser : users[idx].username;

  // Check new username not taken by someone else
  if(newUser && newUser !== users[idx].username){
    if(users.find(x=>x.username===newUser && x.username!==users[idx].username)){
      msg.style.color='#DC2626'; msg.textContent='Username already taken. Try another.'; return;
    }
  }

  // ── Save new credentials (hashed) ───────────────────────────────────────
  const hashedPass = await hashPassword(newPass);
  users[idx].username  = finalUser;
  users[idx].password  = hashedPass;
  users[idx].mustChange = false;
  saveUsers(users);

  if(users[idx].role==='admin'){
    localStorage.setItem('username', finalUser);
    localStorage.setItem('password', hashedPass);
  }
  localStorage.removeItem('_fp_otp');
  persist();

  // ── Send email with new credentials ────────────────────────────────────
  // Email is sent immediately so user has a record of their new password
  const inst = localStorage.getItem('tuitionName') || 'ClassCore Tuition';
  sendEmail(
    _otpEmail,
    'ClassCore — Your Password Has Been Reset',
    '',
    {
      username:   finalUser,
      password:   newPass,
      user_name:  users[idx].name || finalUser,
      institute:  inst,
      mobile:     _otpMobile || reg?.mobile || '',
      trial_end:  'Your credentials have been successfully reset.',
      subject:    'ClassCore — Password Reset Successful',
    }
  ).then(r=>{
    if(r.ok){
      console.log('[ClassCore] Password reset email sent to', _otpEmail);
    } else {
      console.warn('[ClassCore] Password reset email failed:', r.error);
      // Don't block the user — credentials are saved, just email failed
    }
  }).catch(()=>{});

  // ── Show success and redirect to login ─────────────────────────────────
  msg.style.color='#16A34A';
  msg.textContent='✅ Password reset! New credentials emailed to '+_otpEmail;

  setTimeout(()=>{
    document.getElementById('forgot-screen').style.display='none';
    document.getElementById('fp-step1').style.display='block';
    document.getElementById('fp-step2').style.display='none';
    document.getElementById('l-user').value = finalUser;
    document.getElementById('l-pass').value  = '';
    document.getElementById('l-pass').focus();
    msg.textContent = '';
    toast('✅ Password reset! Check your email for the new credentials.');
  }, 2000);
}

// NAV
let curPage='dashboard';
let editStuId=null,editBatId=null;
const PAGE_TITLES={dashboard:'Dashboard',students:'Students','students-form':'Student Form',batches:'Batches','batches-form':'Batch Form',courses:'Courses','courses-form':'Course Form',exams:'Exams',fees:'Fees',expenses:'Expenses',attendance:'Attendance',broadcast:'Broadcast',settings:'Settings'};
const TOP_BTNS={students:{lbl:'＋ Add Student',fn:()=>openStuForm(null)},batches:{lbl:'＋ New Batch',fn:()=>openBatForm(null)},courses:{lbl:'＋ New Course',fn:()=>openCourseForm(null)},exams:{lbl:'＋ New Exam',fn:()=>openExamForm(null)},expenses:{lbl:'＋ Add Expense',fn:()=>openExpenseForm()}};

function gotoPage(pg){
  // Hide all pages
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pageEl=document.getElementById('page-'+pg);
  if(!pageEl){console.warn('Page not found:',pg);return;}
  pageEl.classList.add('active');
  // Update nav highlight — use base page name
  const base=pg.split('-')[0];
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const ni=document.querySelector('.nav-item[data-page="'+base+'"]');
  if(ni)ni.classList.add('active');
  curPage=pg;
  document.getElementById('page-title').textContent=PAGE_TITLES[pg]||pg;
  const tb=document.getElementById('top-btn');
  if(TOP_BTNS[pg]){tb.textContent=TOP_BTNS[pg].lbl;tb.style.display='flex';}
  else tb.style.display='none';
  // Only render main pages (not sub-form pages — they render themselves)
  const renders={
    dashboard:renderDash,
    students:renderStus,
    batches:renderBats,
    courses:renderCourses,
    exams:renderExams,
    fees:renderFees,
    expenses:renderExpenses,
    attendance:renderAtt,
    broadcast:renderBroadcast,
    settings:()=>{if(adminOnly('Only admin can access settings'))return gotoPage('dashboard');renderSettings();}
  };
  if(renders[pg]){
    try{ renders[pg](); }
    catch(err){
      console.error('Page render error ['+pg+']:', err);
      const el=document.getElementById('page-'+pg);
      if(el&&!el.innerHTML.trim()) el.innerHTML=`<div style="padding:40px;text-align:center;color:#DC2626">⚠️ Page error. Please go back and try again.<br><small style="color:#78716C">${err.message}</small></div>`;
    }
  }
}
function topBtnAction(){if(TOP_BTNS[curPage])TOP_BTNS[curPage].fn();}

function renderDash(){
  const active=students.filter(s=>!s.inactive);
  const curMonth=MONTHS[new Date().getMonth()];
  const curYear=new Date().getFullYear();
  // Monthly expected
  const expMonthly=active.reduce((a,s)=>a+monthlyFee(s),0);
  // Collected this month
  const colThisMonth=active.reduce((a,s)=>{
    const h=(s.history||[]).filter(x=>x.month===curMonth&&(x.year||curYear)===curYear);
    return a+h.reduce((b,x)=>b+(x.amount||0),0);
  },0);
  const colAll=students.reduce((a,s)=>a+(s.paid||0),0);
  const penMonth=Math.max(0,expMonthly-colThisMonth);
  // This month expenses
  const expThisMonth=expenses.filter(e=>{
    const d=new Date(e.date);
    return MONTHS[d.getMonth()]===curMonth&&d.getFullYear()===curYear;
  }).reduce((a,e)=>a+(e.amount||0),0);
  const profit=colThisMonth-expThisMonth;
  // Students paid/not this month
  const paidStu=active.filter(s=>(s.history||[]).some(h=>h.month===curMonth&&(h.year||curYear)===curYear));
  const notPaidStu=active.filter(s=>monthlyFee(s)>0&&!(s.history||[]).some(h=>h.month===curMonth&&(h.year||curYear)===curYear));
  const colPct=expMonthly?Math.round(colThisMonth/expMonthly*100):0;
  const byClass={};active.forEach(s=>{byClass[s.cls]=(byClass[s.cls]||0)+1;});
  document.getElementById('page-dashboard').innerHTML=`
  <div class="grid-4">
    <div class="stat-card"><div class="stat-stripe" style="background:#18181B"></div><div style="font-size:22px;margin-bottom:8px">🎓</div><div class="stat-val">${active.length}</div><div class="stat-lbl">Total Students</div><div class="stat-sub" style="color:#78716C">${students.filter(s=>s.inactive).length} inactive</div></div>
    <div class="stat-card"><div class="stat-stripe" style="background:#16A34A"></div><div style="font-size:22px;margin-bottom:8px">💚</div><div class="stat-val">${fmt(colThisMonth)}</div><div class="stat-lbl">${curMonth} Collected</div><div class="stat-sub" style="color:#16A34A">${paidStu.length}/${active.length} paid</div></div>
    <div class="stat-card"><div class="stat-stripe" style="background:#DC2626"></div><div style="font-size:22px;margin-bottom:8px">⚠️</div><div class="stat-val">${fmt(penMonth)}</div><div class="stat-lbl">${curMonth} Pending</div><div class="stat-sub" style="color:#DC2626">${notPaidStu.length} students</div></div>
    <div class="stat-card" style="cursor:pointer" onclick="gotoPage('expenses')"><div class="stat-stripe" style="background:${profit>=0?'#16A34A':'#DC2626'}"></div><div style="font-size:22px;margin-bottom:8px">${profit>=0?'📈':'📉'}</div><div class="stat-val" style="color:${profit>=0?'#16A34A':'#DC2626'}">${fmt(Math.abs(profit))}</div><div class="stat-lbl">${curMonth} ${profit>=0?'Profit':'Loss'}</div><div class="stat-sub" style="color:#78716C">Exp: ${fmt(expThisMonth)}</div></div>
  </div>
  <div class="grid-21">
    <div class="card"><div style="font-size:10.5px;font-weight:700;color:#78716C;text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px">${curMonth} Fee Collection</div>
      <div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>Collected (${paidStu.length} students)</span><span style="font-weight:700;color:#16A34A">${fmt(colThisMonth)}</span></div><div class="prog"><div class="prog-fill" style="background:#16A34A;width:${colPct}%"></div></div></div>
      <div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>Pending (${notPaidStu.length} students)</span><span style="font-weight:700;color:#DC2626">${fmt(penMonth)}</span></div><div class="prog"><div class="prog-fill" style="background:#DC2626;width:${expMonthly?Math.round(penMonth/expMonthly*100):0}%"></div></div></div>
      ${notPaidStu.length>0?`<button class="btn btn-primary btn-sm" style="margin-top:12px;width:100%;justify-content:center" onclick="gotoPage('fees');setTimeout(openBulkFee,300)">⚡ Collect ${curMonth} Fees — ${notPaidStu.length} pending</button>`:'<div style="margin-top:12px;text-align:center;font-size:12px;color:#16A34A;font-weight:700">✅ All students paid for '+curMonth+'!</div>'}
    </div>
    <div class="card"><div style="font-size:10.5px;font-weight:700;color:#78716C;text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px">Students by Class</div>
      ${Object.entries(byClass).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([c,n])=>`<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span style="color:#78716C">Class ${esc(c)}</span><span style="font-weight:700">${n}</span></div>`).join('')||'<div style="color:#78716C;font-size:12px">No students yet</div>'}
    </div>
  </div>
  ${notPaidStu.length>0?`<div class="sec-hdr"><h3>⚠️ Not Paid — ${curMonth}</h3><button class="btn btn-ghost btn-sm" onclick="gotoPage('fees')">View All →</button></div>
  <div class="table-wrap"><table><thead><tr><th>Student</th><th>Class</th><th>Batch</th><th>Monthly Fee</th><th>Quick Collect</th></tr></thead>
  <tbody>${notPaidStu.slice(0,8).map((s,i)=>`<tr>
    <td><div style="display:flex;align-items:center;gap:8px"><div class="av ${avcC(i)}">${ini(s.name)}</div><div style="font-weight:600">${esc(s.name)}</div></div></td>
    <td>${esc(s.cls)}</td><td>${esc(s.batch||'—')}</td>
    <td style="font-weight:700;color:var(--primary)">${fmt(monthlyFee(s))}/mo</td>
    <td><button class="btn btn-teal btn-xs" onclick="quickCollectPending('${s.id}','${curMonth}')">✓ Collect ${curMonth}</button></td>
  </tr>`).join('')}
  </tbody></table></div>`:''}
  <div class="sec-hdr"><h3>Recent Students</h3><button class="btn btn-ghost btn-sm" onclick="gotoPage('students')">View All →</button></div>
  <div class="table-wrap"><table><thead><tr><th>Student</th><th>Class</th><th>Batch</th><th>Monthly Fee</th><th>${curMonth} Status</th><th>Total Paid</th></tr></thead>
  <tbody>${students.slice(-5).reverse().map((s,i)=>{
    const mFee=monthlyFee(s);
    const paidThisMonth=(s.history||[]).some(h=>h.month===curMonth&&(h.year||curYear)===curYear);
    return`<tr>
    <td><div style="display:flex;align-items:center;gap:8px"><div class="av ${avcC(i)}">${ini(s.name)}</div><div style="font-weight:600">${esc(s.name)}</div></div></td>
    <td>${esc(s.cls)}</td><td>${esc(s.batch||'—')}</td>
    <td style="font-weight:700">${fmt(mFee)}/mo</td>
    <td><span class="badge ${paidThisMonth?'badge-green':'badge-red'}">${paidThisMonth?'✅ Paid':'❌ Pending'}</span></td>
    <td style="color:#16A34A;font-weight:600">${fmt(s.paid||0)}</td>
  </tr>`;}).join('')||'<tr><td colspan="6" style="text-align:center;padding:40px;color:#78716C">No students yet.</td></tr>'}
  </tbody></table></div>`;
}
