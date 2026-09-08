// ══════════════════════════════════════════════════════════════════════
// FIREBASE INIT — Firestore for trial abuse prevention
// ══════════════════════════════════════════════════════════════════════
let _db = null;  // Firestore instance — null until Firebase loads

(function initFirebase(){
  try{
    if(typeof firebase !== 'undefined'){
      firebase.initializeApp(firebaseConfig);
      _db = firebase.firestore();
      console.log('[ClassCore][Firebase] ✅ Firestore ready');
    } else {
      // Retry up to 5 seconds (Electron CDN load can be slow)
      let tries = 0;
      const iv = setInterval(()=>{
        tries++;
        if(typeof firebase !== 'undefined'){
          clearInterval(iv);
          firebase.initializeApp(firebaseConfig);
          _db = firebase.firestore();
          console.log('[ClassCore][Firebase] ✅ Firestore ready (deferred)');
        } else if(tries > 10){
          clearInterval(iv);
          console.warn('[ClassCore][Firebase] ⚠️ Firebase SDK not loaded — trial checks will use local storage only');
        }
      }, 500);
    }
  }catch(e){ console.error('[ClassCore][Firebase] ❌ Init error:', e.message); }
})();

// Clean up legacy mobile sync key if present
try { localStorage.removeItem('cc_sync_key'); } catch(_) {}

// ── Firestore helpers ──────────────────────────────────────────────────────────

/**
 * Check if email OR mobile already has a trial in Firestore.
 * Returns { used: boolean, reason: string }
 * Falls back gracefully if offline or Firestore unavailable.
 */
async function fsCheckTrialUsed(email, mobile){
  if(!_db) return { used: false, reason: 'offline' };
  try{
    const col = _db.collection('trial_users');
    const [byEmail, byMobile] = await Promise.all([
      col.where('email',  '==', email.toLowerCase().trim()).limit(1).get(),
      col.where('mobile', '==', mobile.trim()).limit(1).get(),
    ]);
    if(!byEmail.empty)  return { used: true, reason: 'email' };
    if(!byMobile.empty) return { used: true, reason: 'mobile' };
    return { used: false };
  }catch(e){
    console.warn('[ClassCore][Firebase] fsCheckTrialUsed error:', e.message);
    return { used: false, reason: 'error' }; // fail-open on network error
  }
}

/**
 * Save a new trial user record to Firestore.
 */
async function fsSaveTrialUser(name, email, mobile, institute, trialStart, trialEnd){
  if(!_db) return;
  try{
    await _db.collection('trial_users').add({
      name:       name       || '',
      email:      email.toLowerCase().trim(),
      mobile:     mobile.trim(),
      institute:  institute  || '',
      trialStart: trialStart,
      trialEnd:   trialEnd,
      createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
      deviceId:   localStorage.getItem('cc_device_id') || '',
    });
    console.log('[ClassCore][Firebase] ✅ Trial user saved to Firestore');
  }catch(e){
    console.warn('[ClassCore][Firebase] fsSaveTrialUser error:', e.message);
    // Non-fatal — local lock is already set
  }
}

const BUILTIN_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAE0UlEQVR4nO2dT4scRRyG60/39PzbRbIkYlajoK5GPIiwGFEUPXrIfgX16CleRMRD8IN49AvkkIPxoPHgsqIRI4uiYowaTXazWc06Mz3dVV7rbcGwLNq9vu9ze+mu7t8MzxRUVU+1MUIIIYQQQgghhGDBtl3Af80nm5uQT5082VIl3cC1XYBoFwlAjgQgRwKQIwHIkQDk/O+GgSuvvgHZDT3k3vIYjw9yzDZC9rGGvHHmrYOW2CnUA5AjAciRAORIAHIkADkSgBwJQM6hnwe49/RrkEfHFvpp9gP3eJr7xwZHsUE+SKPz7lqabQyf4x3tNE0bZ97cX8EdQz0AORKAHAlAjgQgRwKQIwHIydou4KBYa2HYN5tUr6S5P+o/nebJ9T+301w7B+vF4+VxmWZfuMfghiG81yhhsr+Ku4V6AHIkADkSgBwJQI4EIEcCkCMByDn08wB1WT+RZlvVK2kO8/r9NN/ty9/T/MjRYjHNlzM7gusb+2yancu+aJTw6f4q7hbqAciRAORIAHIkADkSgBwJQM6hHwaGKp5Ic6wjPLVb3pz+Cg2OhIfSuFj0YDl5JZudS/PXZnghzT1rfztAuZ1DPQA5EoAcCUCOBCBHApAjAciRAOQc+nmAGCI8ll1P5ih1kS1ArKvv0nx1p4R/SF8ZjpbTXBXxqTQHF883SvhyfxV3C/UA5EgAciQAORKAHAlAjgQgp/PDwJdffxvyvEZnP7h87VKa7ax8GK8QT6Xp2y37Q5p7VYTdoYul+QNpzsf2D7hcP8N8yFEPQI4EIEcCkCMByJEA5EgAciQAOa1vFr38AmzqZYLBlzyZxkucKozGDI5AHJXbD6a5tv4+OKHInkujH+XwHQyXRh+muTfwV+H+jx6H5eTejRtYrsWv1OImZCZMZpA/O/uOaRP1AORIAHIkADkSgBwJQI4EIKf15WDrcNxkQw3v+LHGLqV54HBz5ljuwDt+qmhvN673FZw/jd+nuX//4jDNxYnxcWgfa9g8utjavgeuZ0wwSPNHheO+zN00HUI9ADkSgBwJQI4EIEcCkCMByJEA5LQ+D+CsgxqCDU+m2UbzCxw35pk0xxibEuP6awwV5CrAuD1WVQ7Hrb2Ezc3zjeOwvBych/u5GPE7jfHnNI7y/N1GvbVpEfUA5EgAciQAORKAHAlAjgQgp/VhYKxKGKb1Mr+R5sLiZtDOVB+nuQz2rjTXVQ2bRTuLn9FbA88VZzu7cL7f68Ow0E5nW1Bwnu9A+9n0FpzvPbQPgz6cX+RFc/m4VdQDkCMByJEA5EgAciQAORKAHAlATvvzAAF36Xpx4cdv0rwbBvCuX+s8SDubTiGXZjZPs/N4vs8yWL4Nt67D/csLm/AYt/VZAe2dvZLmeR1wniHD5WF/e+8nOP/0S83/N7eKegByJAA5EoAcCUCOBCBHApDT+iZRTdbW1iA3N10K+FCvqWt8qHZ3dxdyluFItyhgVPe39mUJfwY2pjFoGy+MIe/t7UHOc3zIeDbD6128+JHpEuoByJEA5EgAciQAORKAHAlAjgQgp3PzAOvr65Cb43jvG5svN+YFmvMGd2I+n/9jbt7fOfzNRFzNvuPx1dXVfdX3b6MegBwJQI4EIEcCkCMByJEAQgghhBBCCCGEECT8BZt+FXBqUbAOAAAAAElFTkSuQmCC";
const BASE_CLASSES=['Jr.KG','Sr.KG','1','2','3','4','5','6','7','8','9','10','11','12'];
function getClasses(){
  try{
    const custom=JSON.parse(localStorage.getItem('cc_custom_classes')||'[]');
    return [...BASE_CLASSES,...custom.filter(c=>!BASE_CLASSES.includes(c))];
  }catch(e){return BASE_CLASSES;}
}
function addCustomClass(name){
  if(!name)return;
  try{
    const custom=JSON.parse(localStorage.getItem('cc_custom_classes')||'[]');
    if(!custom.includes(name)&&!BASE_CLASSES.includes(name)){
      custom.push(name);
      localStorage.setItem('cc_custom_classes',JSON.stringify(custom));
    }
  }catch(e){}
}
// Keep CLASSES as computed for compatibility
let CLASSES=getClasses();
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const AVC=['avc0','avc1','avc2','avc3','avc4','avc5','avc6','avc7'];
const BATCH_COLORS=['#E8622A','#2A9D8F','#18181B','#E9C46A','#264653','#E76F51','#457B9D','#6D6875'];

const SEED_S=[
  {id:'s1',name:'Rahul Sharma',cls:'10',subject:'Math',parent:'Mr. Sharma',mobile:'9876543210',batch:'Morning Batch',admDate:'2025-01-10',feeType:'monthly',monthlyFees:1500,annualFees:0,totalFees:18000,discount:500,finalFees:17500,paid:9000,history:[],inactive:false},
  {id:'s2',name:'Priya Patel',cls:'9',subject:'Science',parent:'Mrs. Patel',mobile:'9123456780',batch:'Evening Batch A',admDate:'2025-02-01',feeType:'monthly',monthlyFees:1200,annualFees:0,totalFees:14400,discount:0,finalFees:14400,paid:7200,history:[],inactive:false},
];
const SEED_B=[
  {id:'b1',name:'Morning Batch',startTime:'07:00',endTime:'08:00',days:['Mon','Wed','Fri'],subject:'Mathematics',maxStudents:20,color:'#E8622A'},
  {id:'b2',name:'Evening Batch A',startTime:'16:00',endTime:'17:00',days:['Mon','Tue','Wed','Thu','Fri'],subject:'Science',maxStudents:15,color:'#2A9D8F'},
  {id:'b3',name:'Evening Batch B',startTime:'18:00',endTime:'19:00',days:['Mon','Tue','Wed','Thu','Fri'],subject:'All Subjects',maxStudents:25,color:'#18181B'},
];

// ── File-based storage (Electron) with localStorage fallback ──────────────
// Check IS_ELECTRON lazily so preload has time to expose the API
function IS_ELECTRON(){ return typeof window.classcore !== 'undefined'; }

function hideStartupLoader(){
  const loader = document.getElementById('startup-loader');
  if(!loader) return;
  loader.style.opacity = '0';
  setTimeout(()=>{ if(loader) loader.style.display = 'none'; }, 350);
}
function hideStartupLoaderIfVisible(){
  const loader = document.getElementById('startup-loader');
  if(loader && loader.style.display !== 'none') hideStartupLoader();
}

function ld(k,fb){try{const d=localStorage.getItem(k);return d?JSON.parse(d):fb;}catch(e){console.warn('ld parse error',k,e.message);return fb;}}
function sv(k,v){localStorage.setItem(k,JSON.stringify(v));}

let students=[];
let courses=[];
let batches=[];
let classFees={};
let stuFeeOvr={};
let attData={};
let monthFees={};
let expenses=[];     // {id, date, category, desc, amount, paidTo}
let salaries=[];     // {id, userId, month, year, amount, paid, paidDate}
let announcements=[]; // {id, date, text, sentWA}
let exams=[];        // {id, name, date, totalMarks, cls, subject, marks:{studentId->obtained}}
let _dataLoaded = false;
let _dataLoadPromise = Promise.resolve();

function buildPayload(){
  let licenseStatus = 'active';
  try {
    if (typeof checkLicense === 'function') {
      const licStat = checkLicense();
      if (licStat === 'none' || (licStat && (licStat.status === 'trial_expired' || licStat.status === 'expired'))) {
        licenseStatus = 'expired';
      }
    }
  } catch(e) {}

  return {
    licenseStatus,
    students,batches,courses,classFees,stuFeeOvr,attData,monthFees,
    expenses,salaries,announcements,exams,
    cc_users:      localStorage.getItem('cc_users')||'',
    username:      localStorage.getItem('username')||'admin',
    password:      localStorage.getItem('password')||'1234',
    tuitionName:   localStorage.getItem('tuitionName')||'',
    tuitionAddress:localStorage.getItem('tuitionAddress')||'',
    tuitionMobile: localStorage.getItem('tuitionMobile')||'',
    rcptNo:        localStorage.getItem('rcptNo')||'1000',
    // NOTE: tuitionLogo excluded — it is a large base64 string that exceeds
    // Electron's IPC message size limit (~16MB but JSON.stringify overhead is real).
    // The logo is saved separately via saveLogo() and loaded via loadLogo().
    // NOTE: ops_logged intentionally excluded — prevents auto-login after logout.
  };
}

// ── Logo saved/loaded separately to avoid IPC size issues ──────────────────
async function saveLogo(){
  if(!IS_ELECTRON()) return;
  const logo = localStorage.getItem('tuitionLogo')||'';
  try{ await window.classcore.saveData({ _logo: logo }); }catch(_){}
}
async function loadLogoFromFile(){
  if(!IS_ELECTRON()) return;
  try{
    const d = await window.classcore.loadData();
    if(d && d._logo) localStorage.setItem('tuitionLogo', d._logo);
  }catch(_){}
}

// ── PERFORMANCE: debounce helper ──────────────────────────────────────────
function debounce(fn, ms){
  let t;
  return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}

// ── Payload size guard — strip tuitionLogo if payload is too large ────────────
function buildPayloadSafe(){
  const payload = buildPayload();

  // Estimate size — if > 8MB, strip logo to stay under Electron IPC limit
  const rough = JSON.stringify(payload).length;
  if(rough > 8_000_000){
    console.warn(`[ClassCore] Payload too large (${Math.round(rough/1024)}KB) — stripping logo`);
    delete payload.tuitionLogo;
  }
  return payload;
}

let _persistFailCount = 0;   // track consecutive failures

async function persist(){
  showSaveChip('saving');
  try {
    if(IS_ELECTRON()){
      let payload;
      try {
        payload = buildPayloadSafe();
      } catch(e){
        console.error('[ClassCore] buildPayload error:', e);
        showSaveChip('error');
        return { ok: false };
      }

      const result = await window.classcore.saveData(payload);

      if(!result || !result.ok){
        _persistFailCount++;
        console.error(`[ClassCore] Save failed (attempt ${_persistFailCount}):`, result?.error);

        if(_persistFailCount >= 3){
          // Only show error chip after 3 consecutive failures
          showSaveChip('error');
        } else {
          // Transient failure — show saved anyway (data is in memory)
          showSaveChip('saved');
        }
        return result || { ok: false };
      }

      _persistFailCount = 0;
      showSaveChip('saved');
      return result;

    } else {
      // Web/browser fallback
      try {
        sv('ops_s', students); sv('ops_b', batches);
        sv('ops_cf', classFees); sv('ops_sfo', stuFeeOvr);
        sv('ops_att', attData); sv('ops_mf', monthFees);
        sv('ops_exams', exams);
        sv('ops_c', courses); sv('ops_exp', expenses);
        sv('ops_sal', salaries); sv('ops_ann', announcements);
      } catch(e){
        console.error('[ClassCore] localStorage save error:', e);
      }
      _persistFailCount = 0;
      showSaveChip('saved');
      return { ok: true };
    }
  } catch(e) {
    _persistFailCount++;
    console.error('[ClassCore] persist exception:', e);
    if(_persistFailCount >= 3) showSaveChip('error');
    else showSaveChip('saved'); // data in memory is fine
    return { ok: false };
  }
}
// Debounced version for rapid changes (search, input)
const persistDebounced=debounce(persist, 600);

let saveChipTimer;
function showSaveChip(state){
  const chip = document.getElementById('save-chip');
  if(!chip) return;
  clearTimeout(saveChipTimer);
  if(state==='saving'){
    chip.style.display='inline-block';
    chip.style.background='#FEF9C3';chip.style.color='#92400E';chip.style.border='1px solid #FDE047';
    chip.textContent='💾 Saving...';
  } else if(state==='saved'){
    chip.style.display='inline-block';
    chip.style.background='#DCFCE7';chip.style.color='#16A34A';chip.style.border='1px solid #BBF7D0';
    chip.textContent='✅ Saved';
    saveChipTimer=setTimeout(()=>{chip.style.display='none';},2000);
  } else if(state==='error'){
    chip.style.display='inline-block';
    chip.style.background='#FEE2E2';chip.style.color='#DC2626';chip.style.border='1px solid #FECACA';
    chip.textContent='❌ Save failed!';
  }
}

// Save data when app is closing — use SYNCHRONOUS save so it completes before close
window.addEventListener('beforeunload', (e)=>{
  // Skip saving if we're logging out — doLogout() already saved without ops_logged
  if(window._loggingOut) return;
  const payload = buildPayload();
  if(IS_ELECTRON()){
    try { window.classcore.saveDataSync(payload); } catch(err) { console.error('Sync save failed', err); }
  } else {
    sv('ops_s',students);sv('ops_b',batches);sv('ops_cf',classFees);
    sv('ops_exams',exams);
    sv('ops_sfo',stuFeeOvr);sv('ops_att',attData);sv('ops_mf',monthFees);
    sv('ops_c',courses);sv('ops_exp',expenses);
    sv('ops_sal',salaries);sv('ops_ann',announcements);
  }
});

// Load all data from SSD file on startup
async function loadAllData(){
  if(IS_ELECTRON()){
    const d=await window.classcore.loadData();
    if(d){
      students=d.students||SEED_S;
      batches=d.batches||SEED_B;
      courses=d.courses||[];
      classFees=d.classFees||{};
      stuFeeOvr=d.stuFeeOvr||{};
      attData=d.attData||{};
      monthFees=d.monthFees||{};
      expenses=d.expenses||[];
      salaries=d.salaries||[];
      announcements=d.announcements||[];
      exams=d.exams||[];
      if(d.cc_users)       localStorage.setItem('cc_users',d.cc_users);
      if(d.username)       localStorage.setItem('username',d.username);
      if(d.password)       localStorage.setItem('password',d.password);
      if(d.tuitionName)    localStorage.setItem('tuitionName',d.tuitionName);
      if(d.tuitionAddress) localStorage.setItem('tuitionAddress',d.tuitionAddress);
      if(d.tuitionMobile)  localStorage.setItem('tuitionMobile',d.tuitionMobile);
      if(d.tuitionLogo)    localStorage.setItem('tuitionLogo',d.tuitionLogo); // legacy compat
      if(d.rcptNo)         localStorage.setItem('rcptNo',d.rcptNo);
      // ops_logged deliberately NOT restored — prevents auto-login after logout.
    } else {
      students=SEED_S;batches=SEED_B;courses=[];classFees={};stuFeeOvr={};attData={};monthFees={};
    }
  } else {
    students=ld('ops_s',SEED_S);
    batches=ld("ops_b",SEED_B);
    courses=ld("ops_c",[]);
    classFees=ld('ops_cf',{});
    stuFeeOvr=ld('ops_sfo',{});
    attData=ld('ops_att',{});
    monthFees=ld('ops_mf',{});
    expenses=ld('ops_exp',[]);
    salaries=ld('ops_sal',[]);
    announcements=ld('ops_ann',[]);
    exams=ld('ops_exams',[]);
  }
}

const uid=()=>Date.now()+'_'+Math.random().toString(36).slice(2,5);
const todayStr=()=>new Date().toLocaleDateString('en-IN');
const todayISO=()=>new Date().toISOString().slice(0,10);
const fmt=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const ini=n=>(n||'?').split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2)||'?';
const avcC=i=>AVC[i%AVC.length];
const fmt12=t=>{if(!t)return'';const[h,m]=t.split(':').map(Number);return(h%12||12)+':'+(m+'').padStart(2,'0')+(h>=12?' PM':' AM');};
// effFee = annual fee for student
const effFee=s=>{
  if(stuFeeOvr[s.id]!=null) return +stuFeeOvr[s.id];
  // classFees stores MONTHLY rate; annual = × 12
  if(classFees[s.cls]!=null) return (+classFees[s.cls])*12;
  return +(s.finalFees||0);
};
// Get total monthly course fees for a student
const courseFeeMonthly=s=>{
  if(!s.courseIds||!s.courseIds.length)return 0;
  return s.courseIds.reduce((total,cid)=>{
    const course=courses.find(c=>c.id===cid);
    return total+(course&&course.fee?+course.fee:0);
  },0);
};
// Monthly fee for a student (base fee + course fees)
const monthlyFee=s=>{
  let base=0;
  if(stuFeeOvr[s.id]!=null) base=Math.round(+stuFeeOvr[s.id]/12);
  else if(classFees[s.cls]!=null) base=+classFees[s.cls];
  else if(s.feeType==='annual'){
    const ann=+(s.finalFees||s.annualFees||0);
    base=ann>0?Math.round(ann/12):0;
  } else {
    base=+(s.monthlyFees||0);
  }
  return base+courseFeeMonthly(s);
};