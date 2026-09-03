// ── COURSES ────────────────────────────────────────────────────────────────
let editCourseId=null;
const COURSE_DURATIONS=['1 Week','2 Weeks','1 Month','2 Months','3 Months','6 Months','1 Year','Self-paced'];

function renderCourses(){
  const el=document.getElementById('page-courses');
  if(!courses.length){
    el.innerHTML=`<div style="text-align:center;padding:80px;color:#78716C"><div style="font-size:52px;margin-bottom:14px">📚</div><p style="font-size:15px;margin-bottom:16px">No courses yet!</p><button class="btn btn-primary" onclick="openCourseForm(null)">＋ Create Course</button></div>`;
    return;
  }
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">${courses.map(c=>makeCourseCard(c)).join('')}</div>`;
  }

function makeCourseCard(c){
  const enrolled=(c.students||[]).length;
  const teacher=c.teacher?getUsers().find(u=>u.username===c.teacher):null;
  const color=c.color||'#E8622A';
  return`<div class="card-fluid">
    <div style="background:linear-gradient(135deg,${color},${color}cc);padding:18px 20px 14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div style="font-size:17px;font-weight:800;color:#fff">${esc(c.name)}</div>${c.duration?`<div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:3px">⏱️ ${esc(c.duration)}</div>`:''}</div>
        <div style="display:flex;gap:5px">
          <button onclick="openCourseForm('${c.id}')" style="background:rgba(255,255,255,.2);border:none;border-radius:6px;padding:5px 9px;color:#fff;cursor:pointer;font-size:12px">✏️</button>
          <button onclick="delCourse('${c.id}')" style="background:rgba(255,255,255,.2);border:none;border-radius:6px;padding:5px 9px;color:#fff;cursor:pointer;font-size:12px">🗑️</button>
        </div>
        </div>
        </div>
    <div style="padding:14px 20px 18px">
      ${c.description?`<p style="font-size:12.5px;color:#78716C;margin-bottom:10px;line-height:1.5">${esc(c.description)}</p>`:''}
      <div class="stat-grid" style="margin-bottom:12px">
        ${c.fee?`<div style="background:#FFF4EE;border-radius:8px;padding:8px 10px"><div style="font-size:9px;color:#78716C;text-transform:uppercase;letter-spacing:1px">Course Fee</div><div style="font-size:15px;font-weight:800;color:#E8622A">${fmt(c.fee)}</div></div>`:''}
        <div style="background:#F7F5F0;border-radius:8px;padding:8px 10px"><div style="font-size:9px;color:#78716C;text-transform:uppercase;letter-spacing:1px">Enrolled</div><div style="font-size:15px;font-weight:800;color:#18181B">${enrolled} Students</div></div>
        ${teacher?`<div style="background:#F0FDF4;border-radius:8px;padding:8px 10px;grid-column:1/-1"><div style="font-size:9px;color:#78716C;text-transform:uppercase;letter-spacing:1px">Teacher</div><div style="font-size:13px;font-weight:700;color:#16A34A">👨‍🏫 ${esc(teacher.name||teacher.username)}</div></div>`:''}
        </div>
      <div style="display:flex;gap:7px">
        <button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center" onclick="openCourseStudents('${c.id}')">👥 Students</button>
        <button class="btn btn-ink btn-sm" style="flex:1;justify-content:center" onclick="openCourseEnroll('${c.id}')">＋ Enroll</button>
        </div>
        </div>
  </div>`;
  }

function openCourseForm(id){
  editCourseId=id;
  const c=id?courses.find(x=>x.id===id):null;
  const teachers=getUsers().filter(u=>u.role!=='admin');
  const teacherOpts=`<option value="">— No Teacher —</option>`+teachers.map(t=>`<option value="${esc(t.username)}"${c?.teacher===t.username?' selected':''}>${esc(t.name||t.username)} (${esc(t.role||'')})</option>`).join('');
  const colors=['#E8622A','#2A9D8F','#457B9D','#6D6875','#E9C46A','#264653','#E76F51','#18181B'];
  const selColor=c?.color||'#E8622A';
  document.getElementById('modal-crs-title').textContent=id?'Edit Course':'Create New Course';
  document.getElementById('modal-crs-body').innerHTML=`
  <div class="form-grid">
    <div class="fg full"><label>Course Name ★</label><input id="cf2-name" value="${esc(c?.name||'')}" placeholder="e.g. Python Programming, Drawing, Yoga"></div>
    <div class="fg full"><label>Description</label><textarea id="cf2-desc" style="background:var(--input-bg);border:1.5px solid var(--border);border-radius:8px;padding:9px 12px;font-size:13px;width:100%;outline:none;resize:none;height:72px;font-family:inherit;color:var(--text-main)">${esc(c?.description||'')}</textarea></div>
    <div class="fg"><label>Course Fee (₹)</label><input id="cf2-fee" type="number" value="${c?.fee||''}" placeholder="e.g. 5000"></div>
    <div class="fg"><label>Duration</label><select id="cf2-duration">
      <option value="">— Select —</option>
      ${COURSE_DURATIONS.map(d=>`<option value="${d}"${c?.duration===d?' selected':''}>${d}</option>`).join('')}
    </select></div>
    <div class="fg"><label>Start Date</label><input id="cf2-start" type="date" value="${c?.startDate||''}"></div>
    <div class="fg"><label>Max Students</label><input id="cf2-max" type="number" value="${c?.maxStudents||''}" placeholder="Unlimited"></div>
    <div class="fg full"><label>Assign Teacher</label><select id="cf2-teacher">${teacherOpts}</select></div>
    <div class="fg full"><label>Course Color</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
        ${colors.map(col=>`<div onclick="document.querySelectorAll('.ccsw').forEach(x=>x.style.border='3px solid transparent');this.style.border='3px solid #18181B';document.getElementById('cf2-color').value='${col}'" class="ccsw" style="width:32px;height:32px;border-radius:50%;background:${col};cursor:pointer;border:${selColor===col?'3px solid #18181B':'3px solid transparent'};transition:.15s"></div>`).join('')}
        <input type="hidden" id="cf2-color" value="${selColor}">
        </div>
        </div>
    <div class="fg full"><label>Notes</label><input id="cf2-notes" value="${esc(c?.notes||'')}" placeholder="Additional information"></div>
        </div>
  <div class="modal-foot">
    <button class="btn btn-ghost" onclick="closeFormModal('course')">Cancel</button>
    <button class="btn btn-primary" onclick="saveCourse()">💾 ${id?'Update Course':'Create Course'}</button>
  </div>`;
  openModal('modal-course-form');
  }

async function saveCourse(){
  const btn=document.querySelector('#modal-crs-body .modal-foot .btn-primary');
  const name=(document.getElementById('cf2-name')?.value||'').trim();
  if(!name){toast('Course name required','err');return;}

  if(btn){btn.textContent='⏳ Saving…';btn.disabled=true;}
  try{
    const obj={
      id:editCourseId||uid(),name,
      description:document.getElementById('cf2-desc')?.value||'',
      fee:parseFloat(document.getElementById('cf2-fee')?.value||0)||0,
      duration:document.getElementById('cf2-duration')?.value||'',
      startDate:document.getElementById('cf2-start')?.value||'',
      maxStudents:parseInt(document.getElementById('cf2-max')?.value||0)||0,
      teacher:document.getElementById('cf2-teacher')?.value||'',
      color:document.getElementById('cf2-color')?.value||'#E8622A',
      notes:document.getElementById('cf2-notes')?.value||'',
      students:editCourseId?courses.find(x=>x.id===editCourseId)?.students||[]:[],
    };
    if(editCourseId){courses=courses.map(x=>x.id===editCourseId?obj:x);}
    else{courses.push(obj);}
    closeFormModal('course');
    renderCourses();
    await persist();
    toast(editCourseId?'✅ Course updated!':'✅ Course created: '+obj.name);
  }catch(err){
    console.error('saveCourse error:',err);
    toast('Save failed: '+err.message,'err');
    if(btn){btn.textContent='💾 Save';btn.disabled=false;}
  }
  }

function delCourse(id){
  if(adminOnly('Only admin can delete courses')) return;
  if(!confirm('Delete this course?')) return;
  showLoader('Deleting Course…','Removing course','\uD83D\uDDD1\uFE0F');
  setTimeout(async()=>{
    courses=courses.filter(x=>x.id!==id);
    await persist();
    hideLoader();renderCourses();toast('Deleted','err');
  },1000);
  }

function openCourseStudents(cid){
  const c=courses.find(x=>x.id===cid);if(!c)return;
  const enrolled=(c.students||[]).map(sid=>students.find(s=>s.id===sid)).filter(Boolean);
  document.getElementById('assign-title').textContent=c.name+' — Enrolled Students';
  document.getElementById('assign-body').innerHTML=`
    <div style="background:#F7F5F0;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#78716C">
      📚 <b>${c.name}</b> · ${enrolled.length} student${enrolled.length!==1?'s':''} enrolled${c.fee?` · ${fmt(c.fee)} fee`:''}
        </div>
    ${!enrolled.length?`<div style="text-align:center;padding:30px;color:#78716C"><div style="font-size:28px;margin-bottom:8px">👥</div><p>No students enrolled yet.</p></div>`:`
    <table><thead><tr><th>#</th><th>Student</th><th>Class</th><th>Mobile</th><th>Remove</th></tr></thead>
    <tbody>${enrolled.map((s,i)=>`<tr>
      <td style="font-size:11px;color:#78716C">${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:7px"><div class="av ${avcC(i)}" style="width:26px;height:26px;font-size:10px">${ini(s.name)}</div><span style="font-weight:600;font-size:12.5px">${esc(s.name)}</span></div></td>
      <td>${esc(s.cls)}</td><td style="color:#78716C">${esc(s.mobile||'—')}</td>
      <td><button class="btn btn-red btn-xs" onclick="unenrollStudent('${cid}','${s.id}')">Remove</button></td>
    </tr>`).join('')}</tbody></table>`}`;
  openModal('modal-assign');
  }

function openCourseEnroll(cid){
  const c=courses.find(x=>x.id===cid);if(!c)return;
  const enrolled=c.students||[];
  const avail=students.filter(s=>!s.inactive&&!enrolled.includes(s.id));
  document.getElementById('assign-title').textContent='Enroll Students — '+c.name;
  document.getElementById('assign-body').innerHTML=`
    <div style="background:#F7F5F0;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#78716C">
      📚 <b>${c.name}</b>${c.fee?` · ${fmt(c.fee)} fee`:''}${c.duration?` · ${c.duration}`:''}
        </div>
    <div class="search-box" style="margin-bottom:14px"><span>🔍</span><input placeholder="Search students…" oninput="filterCourseEnroll('${cid}',this.value)" style="width:100%"></div>
    <div id="enroll-list">${renderEnrollList(avail,cid)}</div>`;
  openModal('modal-assign');
  }

function renderEnrollList(list,cid){
  if(!list.length) return`<div style="text-align:center;padding:30px;color:#78716C">No students available to enroll.</div>`;
  return list.map((s,i)=>`<div style="display:flex;align-items:center;gap:10px;background:#F7F5F0;border-radius:10px;padding:10px 14px;border:1.5px solid #E7E2D9;margin-bottom:8px">
    <div class="av ${avcC(i)}" style="width:32px;height:32px">${ini(s.name)}</div>
    <div style="flex:1"><div style="font-weight:600;font-size:13px">${esc(s.name)}</div><div style="font-size:11px;color:#78716C">Class ${esc(s.cls)}${s.batch?' · '+esc(s.batch):''}</div></div>
    <button class="btn btn-ink btn-xs" onclick="enrollStudent('${cid}','${s.id}')">＋ Enroll</button>
  </div>`).join('');
  }

function filterCourseEnroll(cid,q){
  const c=courses.find(x=>x.id===cid);if(!c)return;
  const enrolled=c.students||[];
  const avail=students.filter(s=>!s.inactive&&!enrolled.includes(s.id)&&(!q||s.name.toLowerCase().includes(q.toLowerCase())));
  const el=document.getElementById('enroll-list');
  if(el)el.innerHTML=renderEnrollList(avail,cid);
  }

function enrollStudent(cid,sid){
  courses=courses.map(c=>{
    if(c.id!==cid)return c;
    const studs=[...(c.students||[])];
    if(!studs.includes(sid))studs.push(sid);
    return{...c,students:studs};
  });
  persist();toast('Student enrolled! ✅');openCourseEnroll(cid);
  }

function unenrollStudent(cid,sid){
  courses=courses.map(c=>{
    if(c.id!==cid)return c;
    return{...c,students:(c.students||[]).filter(x=>x!==sid)};
  });
  persist();toast('Student removed');openCourseStudents(cid);renderCourses();
  }
// ── END COURSES ─────────────────────────────────────────────────────────────

// ── THEME SYSTEM ──────────────────────────────────────────────────────────
const THEMES = {
  'navy-gold': {
    name: '🏛️ Navy & Gold (ClassCore)',
    primary: '#C9A84C', primaryDark: '#A8873A', primaryLight: '#FBF6E9',
    sidebar: '#1B3154', sidebarActive: '#C9A84C',
    bodyBg: '#F5F4F0', cardBg: '#fff', textMain: '#1B2E4B',
    textMuted: '#5A6A7E', border: '#E0D9C8', inputBg: '#F5F4F0',
    topbar: '#fff', scrollbar: '#C9A84C'
  },
  'orange': {
    name: '🔶 Orange',
    primary: '#E8622A', primaryDark: '#CF5522', primaryLight: '#FFF4EE',
    sidebar: '#18181B', sidebarActive: '#E8622A',
    bodyBg: '#F7F5F0', cardBg: '#fff', textMain: '#18181B',
    textMuted: '#78716C', border: '#E7E2D9', inputBg: '#F7F5F0',
    topbar: '#fff', scrollbar: '#D4CCBF'
  },
  'deep-blue': {
    name: '🔵 Deep Blue & Light Blue',
    primary: '#1D4ED8', primaryDark: '#1E40AF', primaryLight: '#EFF6FF',
    sidebar: '#1E3A5F', sidebarActive: '#1D4ED8',
    bodyBg: '#F0F4FF', cardBg: '#fff', textMain: '#1E293B',
    textMuted: '#64748B', border: '#DBEAFE', inputBg: '#F0F4FF',
    topbar: '#fff', scrollbar: '#BFDBFE'
  },
  'charcoal': {
    name: '⚫ Charcoal & Sky Blue',
    primary: '#0EA5E9', primaryDark: '#0284C7', primaryLight: '#F0F9FF',
    sidebar: '#334155', sidebarActive: '#0EA5E9',
    bodyBg: '#F8FAFC', cardBg: '#fff', textMain: '#0F172A',
    textMuted: '#64748B', border: '#E2E8F0', inputBg: '#F1F5F9',
    topbar: '#fff', scrollbar: '#CBD5E1'
  },
  'navy-mint': {
    name: '🌊 Navy & Mint/Teal',
    primary: '#14B8A6', primaryDark: '#0D9488', primaryLight: '#F0FDFA',
    sidebar: '#0F172A', sidebarActive: '#14B8A6',
    bodyBg: '#F0FDFA', cardBg: '#fff', textMain: '#134E4A',
    textMuted: '#6B7280', border: '#CCFBF1', inputBg: '#F0FDFA',
    topbar: '#fff', scrollbar: '#99F6E4'
  },
  'purple': {
    name: '💜 Purple & Lavender',
    primary: '#7C3AED', primaryDark: '#6D28D9', primaryLight: '#F5F3FF',
    sidebar: '#2E1065', sidebarActive: '#7C3AED',
    bodyBg: '#FAF5FF', cardBg: '#fff', textMain: '#1E1B4B',
    textMuted: '#6B7280', border: '#EDE9FE', inputBg: '#FAF5FF',
    topbar: '#fff', scrollbar: '#DDD6FE'
  },
  'dark': {
    name: '🌙 Dark Mode',
    primary: '#E8622A', primaryDark: '#CF5522', primaryLight: '#2D1A0E',
    sidebar: '#111111', sidebarActive: '#E8622A',
    bodyBg: '#1A1A1A', cardBg: '#242424', textMain: '#F5F5F5',
    textMuted: '#A0A0A0', border: '#333333', inputBg: '#2A2A2A',
    topbar: '#1E1E1E', scrollbar: '#444444'
  },
  'green': {
    name: '🌿 Forest Green',
    primary: '#16A34A', primaryDark: '#15803D', primaryLight: '#F0FDF4',
    sidebar: '#14532D', sidebarActive: '#16A34A',
    bodyBg: '#F0FDF4', cardBg: '#fff', textMain: '#14532D',
    textMuted: '#6B7280', border: '#DCFCE7', inputBg: '#F0FDF4',
    topbar: '#fff', scrollbar: '#BBF7D0'
  },
  'rose': {
    name: '🌹 Rose & Pink',
    primary: '#E11D48', primaryDark: '#BE123C', primaryLight: '#FFF1F2',
    sidebar: '#881337', sidebarActive: '#E11D48',
    bodyBg: '#FFF1F2', cardBg: '#fff', textMain: '#1F0A0F',
    textMuted: '#6B7280', border: '#FECDD3', inputBg: '#FFF1F2',
    topbar: '#fff', scrollbar: '#FDA4AF'
  },
  'dark_gold': {
    name: '🌙 Dark Mode',
    primary: '#C9A84C', primaryDark: '#A8873A', primaryLight: '#2A2416',
    sidebar: '#111827', sidebarActive: '#C9A84C',
    bodyBg: '#1F2937', cardBg: '#111827', textMain: '#F9FAFB',
    textMuted: '#9CA3AF', border: '#374151', inputBg: '#1F2937',
    topbar: '#111827', scrollbar: '#4B5563'
  }
    };

function applyTheme(themeKey){
  const t = THEMES[themeKey] || THEMES['orange'];
  const r = document.documentElement.style;
  r.setProperty('--primary', t.primary);
  r.setProperty('--primary-dark', t.primaryDark);
  r.setProperty('--primary-light', t.primaryLight);
  r.setProperty('--sidebar-bg', t.sidebar);
  r.setProperty('--sidebar-active', t.sidebarActive);
  r.setProperty('--body-bg', t.bodyBg);
  r.setProperty('--card-bg', t.cardBg);
  r.setProperty('--text-main', t.textMain);
  r.setProperty('--text-muted', t.textMuted);
  r.setProperty('--border', t.border);
  r.setProperty('--input-bg', t.inputBg);
  r.setProperty('--topbar-bg', t.topbar);
  r.setProperty('--scrollbar', t.scrollbar);
  localStorage.setItem('cc_theme', themeKey);
  // Update body background
  document.body.style.background = t.bodyBg;
  document.body.style.color = t.textMain;
  }

function loadSavedTheme(){
  const saved = localStorage.getItem('cc_theme') || 'navy-gold';
  applyTheme(saved);
  }

function renderThemePicker(){
  const cur = localStorage.getItem('cc_theme') || 'orange';
  return `<div class="card" style="margin-bottom:18px">
    <div style="font-size:13px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:7px">🎨 Color Theme</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
      ${Object.entries(THEMES).map(([key, t])=>`
        <div onclick="applyTheme('${key}');renderSettings();" style="border:2px solid ${cur===key?t.primary:'var(--border)'};border-radius:12px;padding:12px 14px;cursor:pointer;background:${cur===key?t.primaryLight:'var(--card-bg)'};transition:.15s;display:flex;align-items:center;gap:10px">
          <div style="display:flex;gap:4px">
            <div style="width:18px;height:18px;border-radius:50%;background:${t.sidebar}"></div>
            <div style="width:18px;height:18px;border-radius:50%;background:${t.primary}"></div>
        </div>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--text-main)">${t.name}</div>
            ${cur===key?`<div style="font-size:10px;color:${t.primary};font-weight:700">✓ Active</div>`:''}
        </div>
        </div>
      `).join('')}
        </div>
  </div>`;
  }
// ── END THEME SYSTEM ──────────────────────────────────────────────────────

// INIT
async function initApp(){
  if(!_dataLoaded){
    _dataLoadPromise.catch(e => console.error('[ClassCore] Data load failed before initApp:', e));
    _dataLoadPromise.then(()=>{
      if(document.getElementById('app')?.style.display === 'flex'){
        console.log('[ClassCore] Data loaded after initApp, refreshing UI');
  loadSavedTheme();
        renderDash();
        const activePage = document.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
        gotoPage(activePage);
  }
  });
  }
  loadSavedTheme();
  document.getElementById('today-chip').textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});

  // Load and display version — listen for push from main process first
  if(IS_ELECTRON()){
    // Listen for push event (sent immediately on window ready)
    window.classcore.onAppVersion(v => {
      const ver = v || '—';
      localStorage.setItem('cc_app_version', ver);
      const el = document.getElementById('sb-version');
      if(el) el.textContent = 'ClassCore v' + ver;
  });
    // Also invoke directly as fallback
    window.classcore.getAppVersion().then(v => {
      if(!v) return;
      localStorage.setItem('cc_app_version', v);
      const el = document.getElementById('sb-version');
      if(el) el.textContent = 'ClassCore v' + v;
    }).catch(() => {});
  } else {
    // Web fallback: read version.json
    fetch('version.json?t=' + Date.now())
      .then(r => r.json())
      .then(d => {
        const ver = d.version || '—';
      localStorage.setItem('cc_app_version', ver);
      const el = document.getElementById('sb-version');
      if(el) el.textContent = 'ClassCore v' + ver;
    }).catch(() => {});
  }
  // Check if we just updated — show success message with data confirmation
  if(IS_ELECTRON()){
    window.classcore.getUpdateMeta().then(meta=>{
      if(meta&&meta.justUpdated){
        // Show a nice success banner
        setTimeout(()=>{
          const total=students.length;
          toast(`✅ Updated to v${meta.version}! All ${total} student records are safe.`,'ok');
          // Also show a more prominent notification
          showUpdateBanner(
            `🎉 Successfully updated to v${meta.version}!`,
            `All your data is safe — ${total} students, all fees and attendance records preserved.`
          );
          // Auto hide after 5 seconds
          setTimeout(()=>hideUpdateBanner(),6000);
  },1000);
  }
  });
  }
  // Restore current user from storage
  if(!currentUser){
    try{const c=localStorage.getItem('ops_cur_user');if(c)currentUser=JSON.parse(c);}catch{}
  }
  if(!currentUser)currentUser={username:'admin',role:'admin',name:'Admin'};
  // Show/hide settings nav for employees
  const settNav=document.querySelector('.nav-item[data-page="settings"]');
  if(settNav)settNav.style.display=isAdmin()?'flex':'none';
  // Update sidebar user info using IDs
  const av=document.getElementById('sb-user-av');
  const nm=document.getElementById('sb-user-name');
  const rl=document.getElementById('sb-user-role');
  if(av)av.textContent=(currentUser.name||'A').slice(0,2).toUpperCase();
  if(nm)nm.textContent=currentUser.name||'Admin';
  if(rl)rl.textContent=isAdmin()?'👑 Administrator':'👤 Employee';
  
  // Mobile App Sync Listener
  const syncKey = localStorage.getItem('cc_sync_key');
  if (syncKey && typeof _db !== 'undefined' && _db) {
    if (!window._ccClientId) window._ccClientId = Math.random().toString(36).substring(2, 15);
    console.log('[ClassCore][Firebase] Setting up sync listener for:', syncKey);
    
    _db.collection(syncKey).doc("data").onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data && data._sender === window._ccClientId) {
           console.log('[ClassCore][Firebase] Ignoring own sync echo.');
    return;
  }
        console.log('[ClassCore][Firebase] Received sync update from mobile!');
        if (data) {
          window._isIncomingSync = true;
          // Update local arrays
          if(data.students) students = data.students;
          if(data.batches) batches = data.batches;
          if(data.courses) courses = data.courses;
          if(data.classFees) classFees = data.classFees;
          if(data.stuFeeOvr) stuFeeOvr = data.stuFeeOvr;
          if(data.attData) attData = data.attData;
          if(data.monthFees) monthFees = data.monthFees;
          if(data.expenses) expenses = data.expenses;
          if(data.salaries) salaries = data.salaries;
          if(data.announcements) announcements = data.announcements;
          if(data.exams) exams = data.exams;
          
          // Re-render current page
          renderDash();
          const activePage = document.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
          try {
            if(activePage === 'students') renderStus();
            if(activePage === 'batches') renderBats();
            if(activePage === 'fees') renderFees();
            if(activePage === 'expenses') renderExpenses();
            if(activePage === 'exams') renderExams();
            if(activePage === 'courses') renderCourses();
          } catch(e) {}
          
          // Save to local storage silently
          setTimeout(async () => {
            window._isIncomingSync = true;
    await persist();
            window._isIncomingSync = false;
          }, 500);
  }
  }
    }, (error) => {
      console.error('[ClassCore][Firebase] Sync listener error:', error);
  });
  }

  updSbInst();renderDash();
  }

// ════════════════════════════════════════════════════════════════════════════
// EXAMS MODULE  v1.0
// Data: exams[] = {id, name, date, totalMarks, cls, subject, marks:{sid->obtained}}
// ════════════════════════════════════════════════════════════════════════════

let _editExamId = null;

// ── Render exams list ─────────────────────────────────────────────────────────
function renderExams(){
  const el = document.getElementById('page-exams');
  if(!exams.length){
    el.innerHTML = `<div style="text-align:center;padding:80px;color:#78716C">
      <div style="font-size:52px;margin-bottom:14px">📝</div>
      <p style="font-size:15px;margin-bottom:16px">No exams yet!</p>
      <button class="btn btn-primary" onclick="openExamForm(null)">＋ Create Exam</button>
  </div>`;
    return;
  }
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
    ${exams.map(e=>makeExamCard(e)).join('')}
  </div>`;
  }

function makeExamCard(e){
  const stuList = students.filter(s=>!s.inactive && s.cls===e.cls);
  const marked  = Object.keys(e.marks||{}).length;
  const avgMark = marked > 0
    ? Math.round(Object.values(e.marks).reduce((a,v)=>a+(v||0),0) / marked)
    : 0;
  const avgPct  = e.totalMarks > 0 ? Math.round((avgMark/e.totalMarks)*100) : 0;
  const color   = avgPct>=75?'#16A34A':avgPct>=50?'#E8622A':'#DC2626';
  return `<div class="card-fluid">
    <div style="background:linear-gradient(135deg,#1B3154,#243d5c);padding:18px 20px 14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
          <div style="font-size:17px;font-weight:800;color:#fff">${esc(e.name)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:3px">
            📅 ${e.date} · Class ${esc(e.cls)} · ${esc(e.subject||'General')}
        </div>
        </div>
        <div style="display:flex;gap:5px">
          <button onclick="openExamForm('${e.id}')" style="background:rgba(255,255,255,.2);border:none;border-radius:6px;padding:5px 9px;color:#fff;cursor:pointer;font-size:12px">✏️</button>
          <button onclick="delExam('${e.id}')" style="background:rgba(255,255,255,.2);border:none;border-radius:6px;padding:5px 9px;color:#fff;cursor:pointer;font-size:12px">🗑️</button>
        </div>
        </div>
        </div>
    <div style="padding:14px 20px 18px">
      <div class="stat-grid" style="margin-bottom:14px">
        <div style="background:#F7F5F0;border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:10px;color:#78716C">Total Marks</div>
          <div style="font-size:16px;font-weight:800">${e.totalMarks}</div>
        </div>
        <div style="background:#F7F5F0;border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:10px;color:#78716C">Marked</div>
          <div style="font-size:16px;font-weight:800">${marked}/${stuList.length}</div>
        </div>
        <div style="background:#F7F5F0;border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:10px;color:#78716C">Avg %</div>
          <div style="font-size:16px;font-weight:800;color:${color}">${marked?avgPct+'%':'—'}</div>
        </div>
        </div>
      <div style="display:flex;gap:7px">
        <button class="btn btn-primary btn-sm" style="flex:1;justify-content:center"
          onclick="openMarksEntry('${e.id}')">?? Record Marks</button>
        ${marked>0?`<button class="btn btn-teal btn-sm" style="flex:1;justify-content:center"
          onclick="downloadAllReportCards('${e.id}')">?? Export All Reports</button>`:''}
        </div>
        </div>
  </div>`;
  }

// ── Exam Form ─────────────────────────────────────────────────────────────────
function openExamForm(id){
  _editExamId = id;
  const e = id ? exams.find(x=>x.id===id) : null;
  document.getElementById('modal-exam-title').textContent = id ? 'Edit Exam' : 'Create New Exam';
  document.getElementById('modal-exam-body').innerHTML = `
  <div class="form-grid">
    <div class="fg full"><label>Exam Name ★</label>
      <input id="ef2-name" value="${esc(e?.name||'')}" placeholder="e.g. Unit Test 1, Mid-Term 2025"></div>
    <div class="fg"><label>Date ★</label>
      <input id="ef2-date" type="date" value="${e?.date||todayISO()}"></div>
    <div class="fg"><label>Class ★</label>
      <select id="ef2-cls">
        <option value="">— Select Class —</option>
        ${getClasses().map(c=>`<option${e?.cls===c?' selected':''}>${c}</option>`).join('')}
    </select></div>
    <div class="fg"><label>Subject</label>
      <input id="ef2-subj" value="${esc(e?.subject||'')}" placeholder="e.g. Mathematics"></div>
    <div class="fg"><label>Total Marks ★</label>
      <input id="ef2-total" type="number" value="${e?.totalMarks||100}" placeholder="100"></div>
    <div class="fg"><label>Pass Marks</label>
      <input id="ef2-pass" type="number" value="${e?.passMark||35}" placeholder="35"></div>
        </div>
  <div class="modal-foot">
    <button class="btn btn-ghost" onclick="closeModal('modal-exam-form')">Cancel</button>
    <button class="btn btn-primary" id="save-exam-btn" onclick="saveExam()">💾 ${id?'Update':'Create'} Exam</button>
  </div>`;
  openModal('modal-exam-form');
  }

async function saveExam(){
  const btn      = document.getElementById('save-exam-btn');
  const name     = (document.getElementById('ef2-name')?.value||'').trim();
  const date     = document.getElementById('ef2-date')?.value || todayISO();
  const cls      = document.getElementById('ef2-cls')?.value  || '';
  const subject  = (document.getElementById('ef2-subj')?.value||'').trim();
  const total    = parseInt(document.getElementById('ef2-total')?.value||100);
  const passMark = parseInt(document.getElementById('ef2-pass')?.value||35);
  if(!name){ toast('Exam name required','err'); return; }
  if(!cls){  toast('Select a class','err');     return; }
  if(!total||total<=0){ toast('Enter total marks','err'); return; }

  await triggerAction(btn, async ()=>{
    const obj = {
      id: _editExamId || uid(),
      name, date, cls, subject, totalMarks:total, passMark,
      marks: _editExamId ? (exams.find(x=>x.id===_editExamId)?.marks||{}) : {},
    };
    if(_editExamId){ exams = exams.map(x=>x.id===_editExamId?obj:x); }
    else           { exams.push(obj); }
    await persist();
  }, {
    type:'save', label:'💾 Save',
    onDone:()=>{
      closeModal('modal-exam-form');
      renderExams();
      toast(`✅ Exam ${_editExamId?'updated':'created'}: ${name}`);
  }
  });
  }

function delExam(id){
  if(!confirm('Delete this exam and all marks?')) return;
  showLoader('Deleting Exam…','Removing exam data','\uD83D\uDDD1\uFE0F');
  setTimeout(async()=>{
    exams=exams.filter(x=>x.id!==id);
    await persist();
    hideLoader();renderExams();toast('Exam deleted','err');
  },1000);
  }

// ── Marks Entry ───────────────────────────────────────────────────────────────
let _currentExamId  = '';  // active exam in marks-entry modal
let _reportExamId   = '';  // active exam in student report modal
let _reportStudentId= '';  // active student in student report modal

// ── Class-wide marks entry (quick numeric entry for all students) ──────────────
function openMarksEntry(examId){
  const e = exams.find(x=>x.id===examId);
  if(!e){ toast('Exam not found','err'); return; }
  _currentExamId = examId;
  const stuList = students.filter(s=>!s.inactive && s.cls===e.cls);

  document.getElementById('modal-marks-title').textContent = e.name+' — Class '+e.cls+' Marks';
  document.getElementById('modal-marks-body').innerHTML = `
  <div style="background:#F0F4FF;border:1.5px solid #BFDBFE;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;gap:20px;flex-wrap:wrap">
    <div><div style="font-size:10px;color:#78716C">Exam</div><div style="font-weight:700">${esc(e.name)}</div></div>
    <div><div style="font-size:10px;color:#78716C">Date</div><div style="font-weight:700">${e.date}</div></div>
    <div><div style="font-size:10px;color:#78716C">Class</div><div style="font-weight:700">${esc(e.cls)}</div></div>
    <div><div style="font-size:10px;color:#78716C">Total Marks</div><div style="font-weight:700">${e.totalMarks}</div></div>
    <div><div style="font-size:10px;color:#78716C">Pass Marks</div><div style="font-weight:700">${e.passMark||35}</div></div>
        </div>
  ${!stuList.length ? '<div style="text-align:center;padding:30px;color:#78716C">No active students in Class '+esc(e.cls)+'</div>' : `
  <div class="table-wrap"><table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="text-align:left;padding:8px 12px;font-size:10.5px;font-weight:700;color:#78716C;text-transform:uppercase;border-bottom:1px solid #E7E2D9">#</th>
      <th style="text-align:left;padding:8px 12px;font-size:10.5px;font-weight:700;color:#78716C;text-transform:uppercase;border-bottom:1px solid #E7E2D9">Student</th>
      <th style="text-align:left;padding:8px 12px;font-size:10.5px;font-weight:700;color:#78716C;text-transform:uppercase;border-bottom:1px solid #E7E2D9">Marks (/${e.totalMarks})</th>
      <th style="text-align:left;padding:8px 12px;font-size:10.5px;font-weight:700;color:#78716C;text-transform:uppercase;border-bottom:1px solid #E7E2D9">%</th>
      <th style="text-align:left;padding:8px 12px;font-size:10.5px;font-weight:700;color:#78716C;text-transform:uppercase;border-bottom:1px solid #E7E2D9">Report</th>
    </tr></thead>
    <tbody>
      ${stuList.map((s,i)=>{
        const obtained = e.marks&&e.marks[s.id]!==undefined ? e.marks[s.id] : '';
        const pct      = (obtained!==''&&e.totalMarks>0) ? Math.round((+obtained/e.totalMarks)*100) : null;
        const pass     = pct!==null && pct>=(Math.round(((e.passMark||35)/e.totalMarks)*100));
        return `<tr style="border-bottom:1px solid #F7F5F0">
          <td style="padding:8px 12px;font-size:11px;color:#78716C">${i+1}</td>
          <td style="padding:8px 12px">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="av ${avcC(students.indexOf(s))}" style="width:28px;height:28px;font-size:10px">${ini(s.name)}</div>
              <div><div style="font-weight:600;font-size:13px">${esc(s.name)}</div>
              <div style="font-size:10px;color:#78716C">${esc(s.roll||'')}${s.batch?' · '+esc(s.batch):''}</div></div>
        </div>
          </td>
          <td style="padding:8px 12px">
            <input type="number" id="mark-${s.id}" value="${obtained}"
              min="0" max="${e.totalMarks}" placeholder="—"
              oninput="updateMarkPct('${s.id}','${e.id}',${e.totalMarks})"
              class="input-fluid" style="padding:6px 10px;border:1.5px solid #E7E2D9;border-radius:7px;font-size:13px;font-weight:700;outline:none;background:#F7F5F0">
          </td>
          <td style="padding:8px 12px">
            <span id="mark-pct-${s.id}" style="font-size:13px;font-weight:700;color:${pct!==null?(pass?'#16A34A':'#DC2626'):'#78716C'}">
              ${pct!==null ? pct+'%' : '—'}
            </span>
          </td>
          <td style="padding:8px 12px">
            <button class="btn btn-primary btn-xs" onclick="openStudentReport('${e.id}','${s.id}')">📝 Report</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`}`;
  openModal('modal-exam-marks');
  }

function updateMarkPct(sid, examId, totalMarks){
  const inp   = document.getElementById('mark-'+sid);
  const pctEl = document.getElementById('mark-pct-'+sid);
  const e     = exams.find(x=>x.id===examId);
  if(!inp||!pctEl||!e) return;
  const val   = parseFloat(inp.value);
  if(isNaN(val)||inp.value===''){
    pctEl.textContent='—'; pctEl.style.color='#78716C'; return;
  }
  const pct  = Math.round((val/totalMarks)*100);
  const pass = pct >= Math.round(((e.passMark||35)/e.totalMarks)*100);
  pctEl.textContent = pct+'%';
  pctEl.style.color = pass ? '#16A34A' : '#DC2626';
  }

async function saveMarks(){
  const btn     = document.getElementById('save-marks-btn');
  const e       = exams.find(x=>x.id===_currentExamId);
  if(!e){ toast('Exam not found','err'); return; }
  const stuList = students.filter(s=>!s.inactive && s.cls===e.cls);
  const newMarks = {};
  stuList.forEach(s=>{
    const inp = document.getElementById('mark-'+s.id);
    if(inp&&inp.value!==''){
      const v = parseFloat(inp.value);
      if(!isNaN(v)&&v>=0&&v<=e.totalMarks) newMarks[s.id]=v;
  }
  });
  await triggerAction(btn, async ()=>{
    exams = exams.map(x=>x.id===_currentExamId ? {...x, marks:{...x.marks,...newMarks}} : x);
    await persist();
  }, {
    type:'save', label:'💾 Save Marks',
    onDone:()=>{ openMarksEntry(_currentExamId); renderExams(); toast('✅ Marks saved for '+Object.keys(newMarks).length+' students!'); }
  });
  }

// ════════════════════════════════════════════════════════════════════════════
// STUDENT REPORT MODAL — Dynamic multi-subject marks entry + PDF
// ════════════════════════════════════════════════════════════════════════════

function openStudentReport(examId, studentId){
  const e = exams.find(x=>x.id===examId);
  const s = students.find(x=>x.id===studentId);
  if(!e||!s){ toast('Data not found','err'); return; }

  _reportExamId    = examId;
  _reportStudentId = studentId;

  // ── FIX Bug 2: Reset row counter on EVERY open so IDs are always fresh ──
  _srmRowCount = 0;

  // Load previously saved subjects for this student — always from latest data
  const saved = (e.subjectMarks && e.subjectMarks[studentId] && e.subjectMarks[studentId].length)
    ? JSON.parse(JSON.stringify(e.subjectMarks[studentId])) // deep clone — no stale refs
    : (e.subject
        ? [{ name: e.subject, obtained: (e.marks && e.marks[studentId] !== undefined ? e.marks[studentId] : ''), max: e.totalMarks }]
        : [{ name: '', obtained: '', max: 100 }]);

  document.getElementById('srm-title').textContent = '📝 Report — ' + s.name;
  document.getElementById('srm-body').innerHTML = `
  <!-- Student info -->
  <div style="display:flex;align-items:center;gap:12px;background:#F7F5F0;border-radius:12px;padding:12px 16px;margin-bottom:18px">
    <div class="av ${avcC(students.indexOf(s))}" style="width:42px;height:42px;font-size:15px">${ini(s.name)}</div>
          <div>
      <div style="font-weight:700;font-size:15px">${esc(s.name)}</div>
      <div style="font-size:12px;color:#78716C">Class ${esc(s.cls)} · ${esc(e.name)} · ${e.date}</div>
        </div>
        </div>
  <!-- Dynamic subjects table -->
  <div style="font-size:11px;font-weight:700;color:#78716C;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Subjects &amp; Marks</div>
  <div id="srm-subjects-container">${_buildSubjectRows(saved)}</div>
  <!-- Add Subject button -->
  <button class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%;justify-content:center;border-style:dashed" onclick="addSubjectRow()">＋ Add Subject</button>
  <!-- Live total display -->
  <div id="srm-totals" style="margin-top:14px;background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:10px;padding:12px 16px;font-size:13px">
    <div style="display:flex;justify-content:space-between;font-weight:700">
      <span>Total</span><span id="srm-total-display">—</span>
        </div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px;color:#78716C">
      <span>Percentage</span><span id="srm-pct-display" style="font-weight:700">—</span>
        </div>
  </div>`;

  // ── FIX Bug 3: Calculate totals AFTER DOM is fully painted ──────────────
  requestAnimationFrame(()=>{ setTimeout(updateSrmTotals, 0); });
  openModal('studentReportModal');
  }

function _buildSubjectRows(subjects){
  if(!subjects || !subjects.length) subjects = [{ name:'', obtained:'', max:100 }];
  // ── FIX: assign sequential indices starting from current _srmRowCount ──
  return subjects.map((sub)=>{
    const idx = _srmRowCount++;
    return _subjectRowHTML(idx, sub.name||'', sub.obtained!==undefined?sub.obtained:'', sub.max||100);
  }).join('');
  }

function _subjectRowHTML(idx, name, obtained, max){
  return `<div id="srm-row-${idx}" style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;margin-bottom:8px;align-items:center">
    <input placeholder="Subject name (e.g. Maths)" value="${esc(String(name))}"
      class="srm-subj-input"
      oninput="updateSrmTotals()"
      style="padding:8px 10px;border:1.5px solid #E7E2D9;border-radius:8px;font-size:13px;outline:none;background:#F7F5F0;color:var(--text-main);width:100%">
    <input type="number" placeholder="Obtained" value="${obtained!==''?obtained:''}"
      class="srm-obt-input" min="0"
      oninput="updateSrmTotals()"
      style="padding:8px 10px;border:1.5px solid #E7E2D9;border-radius:8px;font-size:13px;outline:none;background:#F7F5F0;color:var(--text-main);text-align:center;width:80px">
    <input type="number" placeholder="Max" value="${max||100}"
      class="srm-max-input" min="1"
      oninput="updateSrmTotals()"
      style="padding:8px 10px;border:1.5px solid #E7E2D9;border-radius:8px;font-size:13px;outline:none;background:#F7F5F0;color:var(--text-main);text-align:center;width:80px">
    <button onclick="this.closest('[id^=srm-row]').remove();updateSrmTotals()"
      style="background:#FEE2E2;border:none;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#DC2626;display:flex;align-items:center;justify-content:center">
      âœ•
    </button>
  </div>`;
  }

let _srmRowCount = 0;

function addSubjectRow(){
  const container = document.getElementById('srm-subjects-container');
  if(!container) return;
    const idx = _srmRowCount++;
  const div = document.createElement('div');
  div.innerHTML = _subjectRowHTML(idx, '', '', 100);
  container.appendChild(div.firstElementChild);
  updateSrmTotals();
  }

function removeSubjectRow(idx){
  const row = document.getElementById('srm-row-'+idx);
  if(row){ row.remove(); updateSrmTotals(); }
  }

// ── FIX Bug 3: Use class-based selectors — not fragile ID-based ones ─────────
function _collectSubjectRows(){
  const container = document.getElementById('srm-subjects-container');
  if(!container) return [];
  const rows     = container.querySelectorAll('[id^="srm-row-"]');
  const subjects = [];
  rows.forEach(row=>{
    const nameEl = row.querySelector('.srm-subj-input');
    const obtEl  = row.querySelector('.srm-obt-input');
    const maxEl  = row.querySelector('.srm-max-input');
    if(!nameEl || !obtEl || !maxEl) return;
    const name     = (nameEl.value||'').trim();
    const obtained = obtEl.value !== '' ? parseFloat(obtEl.value) : '';
    const max      = parseFloat(maxEl.value) || 100;
    subjects.push({ name: name||'Subject', obtained, max });
  });
  return subjects;
  }

// ── FIX Bug 3: Live totals always read from DOM fresh ─────────────────────────
function updateSrmTotals(){
  const subjects = _collectSubjectRows();
  const filled   = subjects.filter(s=>s.obtained!=='');
  const totalMax = subjects.reduce((a,s)=>a+(s.max||0), 0);
  const totalObt = filled.reduce((a,s)=>a+(+s.obtained||0), 0);
  const allFilled= subjects.length>0 && subjects.every(s=>s.obtained!=='');
  const pct      = (allFilled && totalMax>0) ? Math.round((totalObt/totalMax)*100) : null;

  const totEl = document.getElementById('srm-total-display');
  const pctEl = document.getElementById('srm-pct-display');
  if(totEl) totEl.textContent = allFilled ? `${totalObt} / ${totalMax}` : `— / ${totalMax}`;
  if(pctEl){
    pctEl.textContent = pct!==null ? pct+'%' : '—';
    pctEl.style.color = pct!==null ? (pct>=50?'#16A34A':'#DC2626') : '#78716C';
  }
  }

async function saveStudentReport(){
  const subjects = _collectSubjectRows();
  if(!subjects.length){ toast('Add at least one subject','err'); return; }

  const e = exams.find(x=>x.id===_reportExamId);
  if(!e){ toast('Exam not found','err'); return; }

  showLoader('Saving Marks…', 'Updating student record', '✏️');

  await new Promise(resolve=>setTimeout(resolve, 1800));

  try{
    if(!e.subjectMarks) e.subjectMarks = {};
    e.subjectMarks[_reportStudentId] = subjects;
    exams = exams.map(x=>x.id===_reportExamId ? {...x, subjectMarks:e.subjectMarks} : x);
    await persist();
  }catch(err){
    console.error('[saveStudentReport] error:', err);
  }

  hideLoader();

  // Close the student report modal
  closeModal('studentReportModal');

  // Refresh the class-wide marks modal in-place (shows updated % etc.)
  if(_currentExamId === _reportExamId){
    openMarksEntry(_currentExamId);
  }

  // Refresh exam cards so "marked X/Y" count updates instantly
      renderExams();

  toast('✅ Marks saved for ' + (students.find(s=>s.id===_reportStudentId)?.name || 'student') + '!');
  }

async function saveAndGenerateReportPDF(){
  const btn      = document.getElementById('srm-pdf-btn');
  const subjects = _collectSubjectRows();
  if(!subjects.length){ toast('Add at least one subject','err'); return; }

  const e = exams.find(x=>x.id===_reportExamId);
  const s = students.find(x=>x.id===_reportStudentId);
  if(!e||!s){ toast('Data not found','err'); return; }

  // Save first
  if(!e.subjectMarks) e.subjectMarks={};
    e.subjectMarks[_reportStudentId] = subjects;
    exams = exams.map(x=>x.id===_reportExamId ? {...x, subjectMarks:e.subjectMarks} : x);
  persist().catch(err=>console.error('[Exams] persist error:',err));

  // Generate PDF
  const inst      = localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const addr      = localStorage.getItem('tuitionAddress')||'';
  const logo      = localStorage.getItem('tuitionLogo')||'';
  const totalMax  = subjects.reduce((a,s)=>a+(s.max||0),0);
  const totalObt  = subjects.reduce((a,s)=>a+(s.obtained!==''?+s.obtained:0),0);
  const pct       = totalMax>0 ? Math.round((totalObt/totalMax)*100) : 0;
  const grade     = pct>=90?'A+':pct>=80?'A':pct>=70?'B+':pct>=60?'B':pct>=50?'C':pct>=35?'D':'F';
  const pass      = pct>=35;
  const gradeColor= pct>=60?'#16A34A':pct>=35?'#E8622A':'#DC2626';
  const filename  = 'ReportCard_'+s.name.replace(/\s+/g,'_')+'_'+e.name.replace(/\s+/g,'_');

  const subjectRows = subjects.map(sub=>{
    const sp   = sub.max>0&&sub.obtained!=='' ? Math.round((+sub.obtained/sub.max)*100) : null;
    const sc   = sp!==null ? (sp>=50?'#16A34A':'#DC2626') : '#78716C';
    return `<tr>
      <td style="padding:9px 16px;border-bottom:1px dashed #E0D9C8;font-size:13px">${esc(sub.name||'Subject')}</td>
      <td style="padding:9px 16px;border-bottom:1px dashed #E0D9C8;font-size:13px;text-align:center;font-weight:700;color:#1B3154">${sub.obtained!==''?sub.obtained:'—'}</td>
      <td style="padding:9px 16px;border-bottom:1px dashed #E0D9C8;font-size:13px;text-align:center;color:#78716C">${sub.max}</td>
      <td style="padding:9px 16px;border-bottom:1px dashed #E0D9C8;font-size:13px;text-align:center;font-weight:700;color:${sc}">${sp!==null?sp+'%':'—'}</td>
        </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Performance Report</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,sans-serif;padding:28px;max-width:580px;margin:auto;color:#18181B;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .hdr{background:linear-gradient(135deg,#1B3154,#243d5c);border-radius:14px 14px 0 0;padding:22px 26px;color:#fff}
    .inst-name{font-size:21px;font-weight:900}
    .inst-addr{font-size:11px;opacity:.65;margin-top:3px}
    .rc-banner{background:#C9A84C;color:#1B3154;text-align:center;padding:8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
    .stu-box{display:flex;align-items:center;gap:14px;background:#F5F4F0;border:1px solid #E0D9C8;border-radius:10px;padding:14px 18px;margin:18px 0}
    .stu-av{width:52px;height:52px;border-radius:50%;background:#1B3154;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;flex-shrink:0}
    .stu-name{font-size:17px;font-weight:800}
    .stu-sub{font-size:12px;color:#5A6A7E;margin-top:3px}
    .marks-box{border:2px solid #E0D9C8;border-radius:10px;overflow:hidden;margin-bottom:16px}
    .marks-hdr{background:#1B3154;color:#fff;padding:8px 16px}
    .marks-hdr th{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:4px 0;text-align:center}
    .marks-hdr th:first-child{text-align:left}
    .total-row{background:#F0F4FF;padding:10px 16px;display:flex;justify-content:space-between;font-weight:700;font-size:13px;border-top:2px solid #1B3154}
    .result-box{text-align:center;padding:20px;border-radius:12px;margin-bottom:18px;border:2px solid ${pass?'#16A34A':'#DC2626'};background:${pass?'#F0FDF4':'#FEF2F2'}}
    .grade{font-size:56px;font-weight:900;color:${gradeColor};line-height:1}
    .pct{font-size:24px;font-weight:800;color:${gradeColor};margin:4px 0}
    .status{font-size:15px;font-weight:700;color:${pass?'#16A34A':'#DC2626'}}
    .sign-row{display:flex;justify-content:space-between;margin-top:24px}
    .sign-line{border-top:1px solid #78716C;padding-top:4px;min-width:130px;text-align:center;font-size:11px;color:#5A6A7E}
    .footer{text-align:center;font-size:10px;color:#9A9080;margin-top:16px;border-top:1px solid #E5DFC8;padding-top:10px}
    @media print{body{padding:6px;}@page{size:A4;margin:8mm;}}
  </style></head><body>
  <div class="hdr">
    ${logo?`<img src="${logo}" style="max-height:40px;border-radius:6px;background:#fff;padding:2px;margin-bottom:8px;display:block">`:''}
    <div class="inst-name">${esc(inst)}</div>
    ${addr?`<div class="inst-addr">${esc(addr)}</div>`:''}
        </div>
  <div class="rc-banner">📝 Student Performance Report</div>
  <div class="stu-box">
    <div class="stu-av">${ini(s.name)}</div>
          <div>
      <div class="stu-name">${esc(s.name)}</div>
      <div class="stu-sub">Class ${esc(s.cls)}${s.batch?' · '+esc(s.batch):''}${s.roll?' · Roll: '+esc(s.roll):''}</div>
      <div class="stu-sub">Exam: <b>${esc(e.name)}</b> · Date: ${e.date}</div>
        </div>
        </div>
  <div class="marks-box">
  <table style="width:100%;border-collapse:collapse">
      <thead class="marks-hdr"><tr>
        <th style="text-align:left;padding:8px 16px">Subject</th>
        <th style="padding:8px">Obtained</th>
        <th style="padding:8px">Max</th>
        <th style="padding:8px">%</th>
    </tr></thead>
      <tbody>${subjectRows}</tbody>
    </table>
    <div class="total-row">
      <span>Total</span>
      <span style="color:#1B3154">${totalObt} / ${totalMax}</span>
        </div>
        </div>
  <div class="result-box">
    <div class="grade">${grade}</div>
    <div class="pct">${pct}%</div>
    <div class="status">${pass?'✅ PASS':'❌ FAIL'}</div>
        </div>
  <div class="sign-row">
    <div class="sign-line">Class Teacher</div>
    <div class="sign-line">Principal / Director</div>
        </div>
  <div class="footer">Generated by ClassCore · ${esc(inst)} · ${new Date().toLocaleDateString('en-IN')}</div>
  </body></html>`;

  if(btn){ btn.disabled=true; btn.innerHTML='<span class="pencil-icon">✏️</span> Generating…'; btn.className='btn btn-xs btn-collecting'; }

  await generatePDF(html, filename, 'A4', true);

  if(btn){ btn.innerHTML='✅ Downloaded!'; btn.className='btn btn-xs btn-saved'; }
        setTimeout(()=>{
    if(btn){ btn.disabled=false; btn.innerHTML='📄 Generate PDF'; btn.className='btn btn-primary'; }
  }, 2000);

  toast('✅ Performance Report PDF downloaded!');
  }

async function downloadAllReportCards(examId){
  const e = exams.find(x=>x.id===examId);
  if(!e){ toast('Exam not found','err'); return; }
  const stuList = students.filter(s=>!s.inactive && s.cls===e.cls && (e.marks&&e.marks[s.id]!==undefined || (e.subjectMarks&&e.subjectMarks[s.id])));
  if(!stuList.length){ toast('No marks entered yet','warn'); return; }
  toast('⏳ Generating '+stuList.length+' Performance Reports…');
  for(let i=0;i<stuList.length;i++){
    const s=stuList[i];
    _reportExamId=examId; _reportStudentId=s.id;
    const subs=e.subjectMarks&&e.subjectMarks[s.id]
      ? e.subjectMarks[s.id]
      : (e.marks&&e.marks[s.id]!==undefined ? [{name:e.subject||'Subject',obtained:e.marks[s.id],max:e.totalMarks}] : []);
    if(!subs.length) continue;
    // Build quick rows for PDF generation
    await new Promise(resolve=>{
      setTimeout(async ()=>{
    _reportExamId=examId; _reportStudentId=s.id;
        await saveAndGenerateReportPDF_direct(e,s,subs);
        resolve();
      }, i*900);
  });
  }
  }

async function saveAndGenerateReportPDF_direct(e,s,subjects){
  const inst=localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const addr=localStorage.getItem('tuitionAddress')||'';
  const logo=localStorage.getItem('tuitionLogo')||'';
  const totalMax=subjects.reduce((a,s)=>a+(s.max||0),0);
  const totalObt=subjects.reduce((a,s)=>a+(s.obtained!==''?+s.obtained:0),0);
  const pct=totalMax>0?Math.round((totalObt/totalMax)*100):0;
  const grade=pct>=90?'A+':pct>=80?'A':pct>=70?'B+':pct>=60?'B':pct>=50?'C':pct>=35?'D':'F';
  const pass=pct>=35;
  const gradeColor=pct>=60?'#16A34A':pct>=35?'#E8622A':'#DC2626';
  const filename='ReportCard_'+s.name.replace(/\s+/g,'_')+'_'+e.name.replace(/\s+/g,'_');
  const subjectRows=subjects.map(sub=>{
    const sp=sub.max>0&&sub.obtained!==''?Math.round((+sub.obtained/sub.max)*100):null;
    const sc=sp!==null?(sp>=50?'#16A34A':'#DC2626'):'#78716C';
    return`<tr><td style="padding:9px 16px;border-bottom:1px dashed #E0D9C8;font-size:13px">${esc(sub.name||'Subject')}</td><td style="padding:9px 16px;border-bottom:1px dashed #E0D9C8;font-size:13px;text-align:center;font-weight:700;color:#1B3154">${sub.obtained!==''?sub.obtained:'—'}</td><td style="padding:9px 16px;border-bottom:1px dashed #E0D9C8;font-size:13px;text-align:center;color:#78716C">${sub.max}</td><td style="padding:9px 16px;border-bottom:1px dashed #E0D9C8;font-size:13px;text-align:center;font-weight:700;color:${sc}">${sp!==null?sp+'%':'—'}</td></tr>`;
  }).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Arial,sans-serif;padding:28px;max-width:580px;margin:auto;-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style></head><body><h2>${esc(inst)}</h2><h3>${esc(s.name)} — ${esc(e.name)}</h3><table style="width:100%;border-collapse:collapse;margin-top:12px"><thead><tr><th>Subject</th><th>Obtained</th><th>Max</th><th>%</th></tr></thead><tbody>${subjectRows}</tbody></table><p style="margin-top:12px;font-weight:700">Total: ${totalObt}/${totalMax} — ${pct}% — Grade ${grade} — ${pass?'PASS':'FAIL'}</p></body></html>`;
  await generatePDF(html,filename,'A4',true);
  }

