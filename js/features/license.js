
// ════════════════════════════════════════════════════════════════════════════
// UNIVERSAL ACTION ENGINE  v1.0
// Usage: triggerAction(btn, actionFn, { type, label, onDone })
//   btn      — the button element that was clicked
//   actionFn — async function that performs the actual work
//   options:
//     type    — 'save' | 'delete'   (controls animation color)
//     label   — original button label to restore on error
//     onDone  — callback after animation completes
// ════════════════════════════════════════════════════════════════════════════
async function triggerAction(btn, actionFn, options = {}){
  const { type = 'save', label = null, onDone = null } = options;
  const origHTML = label || btn?.innerHTML || '';

  // ── Phase 1: Pencil animation ─────────────────────────────────────────────
  if(btn){
    btn.disabled  = true;
    btn.innerHTML = type === 'delete'
      ? '<span class="spin-icon">⚙️</span> Deleting…'
      : '<span class="pencil-icon">✏️</span> Saving…';
    btn.className = btn.className.replace(/btn-(primary|teal|ink|ghost|red|green)\b/g,'').trim()
                  + (type === 'delete' ? ' btn-deleting' : ' btn-collecting');
  }

  // ── Phase 2: Run the actual action ────────────────────────────────────────
  let success = false;
  try{
    await actionFn();
    success = true;
  }catch(err){
    console.error('[triggerAction] error:', err);
    toast('⚠️ Action failed: ' + err.message, 'err');
  }

  if(!success){
    // Restore button on failure
    if(btn){ btn.disabled = false; btn.innerHTML = origHTML; }
    return;
  }

  // ── Phase 3: Success state (brief) ────────────────────────────────────────
  if(btn){
    btn.innerHTML = type === 'delete' ? '✅ Deleted!' : '✅ Saved!';
    btn.className = btn.className.replace(/btn-(collecting|deleting)\b/g,'').trim() + ' btn-saved';
  }

  // ── Phase 4: After brief pause → call onDone ─────────────────────────────
  setTimeout(()=>{
    if(typeof onDone === 'function') onDone();
  }, type === 'delete' ? 800 : 600);
  }

// ════════════════════════════════════════════════════════════════════════════
// PDF SYSTEM  v1.0
// Uses html2pdf.js (CDN loaded above). Falls back to window.print() if unavailable.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generate a PDF from an HTML string and either download it or return the blob.
 * @param {string} html      - full HTML string to convert
 * @param {string} filename  - output filename (no extension)
 * @param {string} size      - 'A4' | 'A5' | 'A6' (default 'A4')
 * @param {boolean} download - true = auto-download, false = return blob
 */
async function generatePDF(html, filename, size = 'A4', download = true){
  if(typeof html2pdf === 'undefined'){
    console.warn('[ClassCore][PDF] html2pdf not loaded — falling back to print');
    const w = window.open('','_blank');
    w.document.write(html); w.document.close();
    setTimeout(()=>w.print(), 400);
    return null;
  }

  const pageSizes = { A4:[210,297], A5:[148,210], A6:[105,148], A7:[74,105] };
  const [pw, ph] = pageSizes[size] || pageSizes.A4;

  const opt = {
    margin:      [4, 4, 4, 4],
    filename:    filename + '.pdf',
    image:       { type:'jpeg', quality:0.95 },
    html2canvas: { scale:2, useCORS:true, logging:false },
    jsPDF:       { unit:'mm', format:[pw,ph], orientation:'portrait' },
  };

  const worker = html2pdf().set(opt).from(html);

  if(download){
    await worker.save();
    return null;
  } else {
    const blob = await worker.outputPdf('blob');
    return blob;
  }
  }

/**
 * Show a PDF Send modal — Email + WhatsApp options.
 * @param {string}  html        - HTML to convert to PDF
 * @param {string}  filename    - PDF filename
 * @param {string}  mobile      - parent mobile (10 digits)
 * @param {string}  email       - parent email
 * @param {string}  waMessage   - WhatsApp text message
 * @param {string}  size        - paper size
 */
function showSendPDFModal(html, filename, mobile, email, waMessage, size = 'A4'){
  // ── FIX: Store html in global var — avoids base64 injection into onclick attr ──
  window._tempPDFHtml     = html;
  window._tempPDFFilename = filename;
  window._tempPDFSize     = size;
  window._tempPDFWaMsg    = waMessage;
  window._tempPDFMobile   = mobile;
  window._tempPDFEmail    = email;

  const existing = document.getElementById('modal-send-pdf');
  if(existing) existing.remove();

  const hasEmail  = email && email.includes('@');
  const hasWA     = mobile && (mobile.replace(/\D/g,'').length >= 10);
  const mobileNum = hasWA
    ? (mobile.replace(/\D/g,'').length===10 ? '91'+mobile.replace(/\D/g,'') : mobile.replace(/\D/g,''))
    : '';

  const modalHtml = `
  <div id="modal-send-pdf" class="modal-overlay open" style="z-index:10000">
    <div class="modal-box" style="width:420px">
      <div class="modal-hdr">
        <h3>📤 Send PDF to Parent</h3>
        <button class="x-btn" onclick="document.getElementById('modal-send-pdf').remove()">×</button>
      </div>
      <div class="modal-body">
        <div style="background:#F7F5F0;border-radius:12px;padding:14px 16px;margin-bottom:16px">
          <div style="font-size:11px;color:#78716C;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">PDF File</div>
          <div style="font-size:14px;font-weight:700">📄 ${esc(filename)}.pdf</div>
      </div>
        <div style="display:flex;flex-direction:column;gap:10px">

          <!-- Download — uses global var, no inline HTML -->
          <button class="btn btn-ghost" style="justify-content:flex-start;gap:10px;padding:12px 16px"
            onclick="_pdfModalDownload()">
            <span style="font-size:20px">💾</span>
            <div style="text-align:left">
              <div style="font-weight:700;font-size:13px">Download PDF</div>
              <div style="font-size:11px;color:#78716C">Save to your computer</div>
      </div>
          </button>

          <!-- WhatsApp — uses global var -->
          ${hasWA ? `
          <button class="btn" style="background:#25D366;color:#fff;justify-content:flex-start;gap:10px;padding:12px 16px"
            onclick="_pdfModalWhatsApp('${mobileNum}')">
            <span style="font-size:20px">💾</span>
            <div style="text-align:left">
              <div style="font-weight:700;font-size:13px">Send via WhatsApp</div>
              <div style="font-size:11px;color:rgba(255,255,255,.8)">Downloads PDF + opens WhatsApp</div>
      </div>
          </button>` : `
          <div style="background:#F7F5F0;border-radius:8px;padding:10px 14px;font-size:12px;color:#78716C">
            📱 WhatsApp unavailable — no mobile number for this student
          </div>`}

          <!-- Email — uses global var -->
          ${hasEmail ? `
          <button class="btn" style="background:#1D4ED8;color:#fff;justify-content:flex-start;gap:10px;padding:12px 16px"
            id="pdf-email-btn"
            onclick="_pdfModalEmail('${esc(email)}')">
            <span style="font-size:20px">💾</span>
            <div style="text-align:left">
              <div style="font-weight:700;font-size:13px">Send via Email</div>
              <div style="font-size:11px;color:rgba(255,255,255,.8)">${esc(email)}</div>
      </div>
          </button>` : `
          <div style="background:#F7F5F0;border-radius:8px;padding:10px 14px;font-size:12px;color:#78716C">
            📧 Email unavailable — no email address for this student
          </div>`}

      </div>
        <div id="pdf-send-status" style="margin-top:12px;font-size:12px;text-align:center;font-weight:600;min-height:18px"></div>
      </div>
      </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

// ── PDF Modal action handlers — read from global vars, no inline HTML injection ──
function _pdfModalDownload(){
  const html = window._tempPDFHtml;
  const name = window._tempPDFFilename;
  const size = window._tempPDFSize || 'A4';
  if(!html){ toast('No PDF data','err'); return; }
  generatePDF(html, name, size, true).then(()=>toast('✅ PDF downloaded!'));
  }

function _pdfModalWhatsApp(mobileNum){
  const html = window._tempPDFHtml;
  const name = window._tempPDFFilename;
  const size = window._tempPDFSize || 'A4';
  const msg  = window._tempPDFWaMsg || '';
  if(!html){ toast('No PDF data','err'); return; }
  sendPDFWhatsApp(mobileNum, msg, html, name, size);
  }

function _pdfModalEmail(email){
  const name = window._tempPDFFilename;
  const msg  = window._tempPDFWaMsg || '';
  const size = window._tempPDFSize || 'A4';
  sendPDFEmail(email, name, msg, size);
  }


async function sendPDFWhatsApp(mobileNum, message, html, filename, size){
  const statusEl = document.getElementById('pdf-send-status');
  if(statusEl){ statusEl.style.color='#E8622A'; statusEl.textContent='⏳ Generating PDF…'; }

  // Download PDF first, then open WhatsApp
  await generatePDF(html, filename, size, true);

  if(statusEl){ statusEl.style.color='#25D366'; statusEl.textContent='✅ PDF downloaded! Opening WhatsApp…'; }
  setTimeout(()=>{
    window.open('https://wa.me/'+mobileNum+'?text='+encodeURIComponent(message));
    setTimeout(()=>{ const m=document.getElementById('modal-send-pdf'); if(m) m.remove(); }, 1000);
  }, 800);
  }

async function sendPDFEmail(email, filename, bodyText, size){
  const btn      = document.getElementById('pdf-email-btn');
  const statusEl = document.getElementById('pdf-send-status');
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="pencil-icon">✏️</span> Sending…'; }
  if(statusEl){ statusEl.style.color='#1D4ED8'; statusEl.textContent='⏳ Sending email…'; }

  const result = await sendEmail(
    email,
    filename + ' — ClassCore',
    bodyText,
    { subject: filename + ' — ClassCore', body: bodyText, to_email: email }
  );

  if(result.ok){
    if(statusEl){ statusEl.style.color='#16A34A'; statusEl.textContent='✅ Email sent to '+email; }
    if(btn){ btn.innerHTML='✅ Sent!'; btn.style.background='#16A34A'; }
    setTimeout(()=>{ const m=document.getElementById('modal-send-pdf'); if(m) m.remove(); }, 2000);
  } else {
    if(statusEl){ statusEl.style.color='#DC2626'; statusEl.textContent='❌ Email failed: '+result.error; }
    if(btn){ btn.disabled=false; btn.innerHTML='<span style="font-size:20px">📧</span> <div style="text-align:left"><div style="font-weight:700;font-size:13px">Retry Email</div></div>'; }
  }
  }

// Generate device fingerprint to prevent trial abuse
async function getDeviceId(){
  const stored = localStorage.getItem('cc_device_id');
  if(stored) return stored;
  // Create fingerprint from browser properties
  const fp = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    navigator.hardwareConcurrency,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');
  // Simple hash
  let hash = 0;
  for(let i=0;i<fp.length;i++){hash=((hash<<5)-hash)+fp.charCodeAt(i);hash|=0;}
  const id = 'DEV-' + Math.abs(hash).toString(36).toUpperCase().padEnd(8,'0').slice(0,8);
  localStorage.setItem('cc_device_id', id);
  return id;
  }

async function sendToSheets(action, data){
  if(!GSHEET_URL || GSHEET_URL.includes('YOUR_GOOGLE')) return {ok:false,msg:'Sheets not configured'};
  try{
    const deviceId = await getDeviceId();
    const payload = { action, deviceId, timestamp: new Date().toISOString(), ...data };
    const r = await fetch(GSHEET_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    return await r.json();
  }catch(e){
    console.log('Sheets error:', e.message);
    return {ok:false,msg:e.message};
  }
  }

async function checkStatusFromSheets(email, mobile){
  if(!GSHEET_URL || GSHEET_URL.includes('YOUR_GOOGLE')) return null;
  try{
    const deviceId = await getDeviceId();
    const url = GSHEET_URL + '?action=check&email=' + encodeURIComponent(email) + '&mobile=' + encodeURIComponent(mobile) + '&deviceId=' + deviceId;
    const r = await fetch(url);
    return await r.json();
  }catch(e){ return null; }
  }

// ── REGISTRATION SYSTEM ────────────────────────────────────────────────────
function getRegistration(){
  try{ return JSON.parse(localStorage.getItem('cc_registration')||'null'); }catch{ return null; }
  }
function saveRegistration(reg){ localStorage.setItem('cc_registration', JSON.stringify(reg)); }

function showRegScreen(){
  const reg = getRegistration();
  if(reg){
    // Already registered — go straight to license check
    checkAndShowLicense();
    return;
  }
  const scr = document.getElementById('reg-screen');
  scr.style.display = 'flex';
  }

function showRegFromLogin(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('reg-screen').style.display='flex';
  }

// Go from Registration screen → Login screen
function showLoginFromReg(){
  document.getElementById('reg-screen').style.display='none';
  // Clear any reg messages
  const msg = document.getElementById('reg-msg');
  if(msg) msg.textContent = '';
  const creds = document.getElementById('reg-creds-box');
  if(creds) creds.style.display = 'none';
  // Show login
  document.getElementById('login-screen').style.display='flex';
  // Focus username field
  setTimeout(()=>{
    const u = document.getElementById('l-user');
    if(u) u.focus();
  }, 100);
  }

function showRegKeyEntry(){
  const s = document.getElementById('reg-key-section');
  s.style.display = s.style.display === 'none' ? 'block' : 'none';
  }

function setRegMsg(msg, type){
  const el = document.getElementById('reg-msg');
  if(!el) return;
  el.textContent = msg;
  el.style.color = type==='err'?'#DC2626':type==='warn'?'#E8622A':'#16A34A';
  }

async function doRegister(){
  const name      = (document.getElementById('reg-name').value||'').trim();
  const email     = (document.getElementById('reg-email').value||'').trim().toLowerCase();
  const mobile    = (document.getElementById('reg-mobile').value||'').trim();
  const institute = (document.getElementById('reg-institute').value||'').trim();
  const password  = (document.getElementById('reg-password').value||'');
  const password2 = (document.getElementById('reg-password2').value||'');

  if(!name)                            { setRegMsg('Please enter your full name','err');    return; }
  if(!email || !email.includes('@'))   { setRegMsg('Please enter a valid email','err');     return; }
  if(!mobile || mobile.length !== 10)  { setRegMsg('Please enter a valid 10-digit mobile','err'); return; }
  if(!password || password.length < 6) { setRegMsg('Password must be at least 6 characters','err'); return; }
  if(password !== password2)           { setRegMsg('Passwords do not match','err'); return; }

  // Disable button to prevent double-submit
  const btn = document.querySelector('#reg-screen .btn-primary');
  if(btn){ btn.disabled = true; btn.textContent = '\u23F3 Checking...'; }
  setRegMsg('\u23F3 Verifying your details...', 'warn');

  // ── STEP 1: Check Firestore for duplicate email/mobile ─────────────────────
  // This prevents trial abuse across devices
  const fsCheck = await fsCheckTrialUsed(email, mobile);
  if(fsCheck.used){
    setRegMsg('\u274C Trial already used for this ' +
      (fsCheck.reason==='email' ? 'Email Address' : 'Mobile Number') +
      '. Please purchase a license.', 'err');
    if(btn){ btn.disabled=false; btn.textContent='\uD83D\uDE80 Start Free Trial'; }
    return;
  }

  // ── Also check local storage lock (offline protection) ─────────────────────
  const localTrialUsed = localStorage.getItem('cc_trial_used') === 'true';
  if(localTrialUsed){
    setRegMsg('\u274C A free trial was already started on this device. Please purchase a license.', 'err');
    if(btn){ btn.disabled=false; btn.textContent='\uD83D\uDE80 Start Free Trial'; }
    return;
  }

  if(btn){ btn.textContent = '\u23F3 Setting up...'; }
  setRegMsg('\u23F3 Creating your account...', 'warn');

  const deviceId   = await getDeviceId();
  const trialStart = Date.now();
  const trialEnd   = trialStart + 30 * 86400000;

  // ── Generate a clean username from the name ────────────────────────────────
  const tempUser = name.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)
                 + Math.floor(100+Math.random()*900);

  // ── Save registration locally ──────────────────────────────────────────────
  const reg = { name, email, mobile, institute, deviceId, trialStart, trialEnd,
                registeredAt: new Date().toISOString() };
  saveRegistration(reg);
  localStorage.setItem('cc_trial_start', trialStart.toString());
  localStorage.setItem('cc_trial_used',  'true');  // ONE-TIME LOCK — permanent
  localStorage.setItem('tuitionName', institute || name + "'s Tuition");

  // ── Save to Firestore (blocks future trial abuse across devices) ────────────
  await fsSaveTrialUser(name, email, mobile, institute, trialStart, trialEnd);

  // ── Save admin user with user-chosen password (no mustChange) ──────────────
  const hashedPwd = await hashPassword(password);
  const users = getUsers();
  const adminIdx = users.findIndex(x=>x.role==='admin');
  if(adminIdx !== -1){
    users[adminIdx].username  = tempUser;
    users[adminIdx].password  = hashedPwd;
    users[adminIdx].mustChange = false;
    users[adminIdx].name      = name;
    users[adminIdx].email     = email;
  } else {
    users.push({ username:tempUser, password:hashedPwd, role:'admin',
                 name, email, mustChange:false });
  }
  localStorage.setItem('cc_users', JSON.stringify(users));
  localStorage.setItem('username', tempUser);
  localStorage.setItem('password', hashedPwd);

  // ── Log to Google Sheets ───────────────────────────────────────────────────
  const trialEndDate = new Date(trialEnd).toLocaleDateString('en-IN',
    {day:'numeric', month:'long', year:'numeric'});
  sendToSheets('register', { name, email, mobile, institute, deviceId,
    trialStart: new Date(trialStart).toLocaleDateString('en-IN'),
    trialEnd:   trialEndDate, status:'trial' });

  // ── Auto-login and go straight to the app ──────────────────────────────────
    if(btn){ btn.disabled=false; btn.textContent='\uD83D\uDE80 Start Free Trial'; }
  setRegMsg('\u2705 Account created! Logging you in...', 'ok');

  // Brief visual confirmation then auto-login
  setTimeout(()=>{
  document.getElementById('reg-screen').style.display='none';
    checkAndShowLicense();
  }, 1500);
  }

async function doRegWithKey(){
  const name = (document.getElementById('reg-name').value||'').trim();
  const email = (document.getElementById('reg-email').value||'').trim().toLowerCase();
  const mobile = (document.getElementById('reg-mobile').value||'').trim();
  const key = (document.getElementById('reg-key-input').value||'').trim().toUpperCase();

  if(!name || !email || !mobile){ setRegMsg('Please fill name, email and mobile first','err'); return; }
  if(!key || key.length < 10){ setRegMsg('Enter a valid license key','err'); return; }

  setRegMsg('⏳ Verifying...','warn');
    const deviceId = await getDeviceId();

  // Save registration
  const reg = { name, email, mobile, deviceId, registeredAt: new Date().toISOString() };
  saveRegistration(reg);

  // Verify key
  verifyKeyOnline(key).then(result => {
    if(result.valid){
      saveLicense({ key, plan: result.plan, expiry: result.expiry, name: result.name || name });
      // Send to sheets
      sendToSheets('activate_key', { name, email, mobile, key, plan: result.plan, status: 'active' });
      setRegMsg('✅ License activated!', 'ok');
  setTimeout(()=>{
        document.getElementById('reg-screen').style.display = 'none';
    checkAndShowLicense();
      }, 1000);
  } else {
      setRegMsg('❌ Invalid key. Contact support.','err');
  }
  }).catch(()=>{
    if(key.startsWith('CCTR-') && key.length >= 15){
      saveLicense({ key, plan: 'yearly', expiry: Date.now() + 365*86400000, name });
      sendToSheets('activate_key', { name, email, mobile, key, plan: 'yearly', status: 'active_offline' });
      setRegMsg('✅ License activated (offline)!','ok');
  setTimeout(()=>{
        document.getElementById('reg-screen').style.display = 'none';
    checkAndShowLicense();
      }, 1000);
  } else {
      setRegMsg('❌ Invalid key format','err');
  }
    });
  }

function checkAndShowLicense(){
  const licStatus = checkLicense();
  if(licStatus === 'none'){
    // Should not happen after registration — start trial
  const reg = getRegistration();
    if(reg && !localStorage.getItem('cc_trial_start')){
      localStorage.setItem('cc_trial_start', Date.now().toString());
  }
    showLicenseScreen();
    return;
  }
  if(licStatus.status === 'active'){
    // Good — show login
    if(localStorage.getItem('ops_logged')){
  document.getElementById('login-screen').style.display='none';
      document.getElementById('app').style.display='flex';
      initApp();
  } else {
  document.getElementById('login-screen').style.display='flex';
  }
    return;
  }
  if(licStatus.status === 'trial'){
    // Always allow access during trial — just show warning if ≤7 days left
    if(localStorage.getItem('ops_logged')){
  document.getElementById('login-screen').style.display='none';
      document.getElementById('app').style.display='flex';
      initApp();
      if(licStatus.daysLeft <= 7){
        setTimeout(()=>toast(`⚠️ Trial expires in ${licStatus.daysLeft} day${licStatus.daysLeft===1?'':'s'}! Please purchase a license.`,'warn'),1500);
  }
  } else {
  document.getElementById('login-screen').style.display='flex';
      // Inject trial days banner into login screen
      const trialBanner=document.getElementById('login-trial-banner');
      if(!trialBanner){
        const banner=document.createElement('div');
        banner.id='login-trial-banner';
        banner.style.cssText='background:'+(licStatus.daysLeft<=7?'#FEE2E2;border:1.5px solid #FECACA':'#F0FDF4;border:1.5px solid #BBF7D0')+';border-radius:10px;padding:10px 14px;margin-bottom:16px;text-align:center;font-size:12px;font-weight:600;color:'+(licStatus.daysLeft<=7?'#DC2626':'#16A34A');
        banner.textContent=(licStatus.daysLeft<=7?'⚠️':'✅')+' Free Trial: '+licStatus.daysLeft+' day'+(licStatus.daysLeft===1?'':'s')+' remaining';
        const loginBox=document.querySelector('#login-screen .fg');
        if(loginBox&&loginBox.parentNode) loginBox.parentNode.insertBefore(banner,loginBox);
  }
  }
    return;
  }
  // trial_expired OR paid plan expired — show license screen (no trial button)
    showLicenseScreen();
  }

// ── LICENSE SYSTEM ─────────────────────────────────────────────────────────
const PLANS = {
  monthly:  { price: 49900,   label: '₹499/month',    days: 30    },
  yearly:   { price: 449900,  label: '₹4,499/year',   days: 365   },
  lifetime: { price: 1999900, label: '₹19,999 once',  days: 36500 }
  };
const RZPKEY = 'rzp_live_XXXXXXXXXXXXXXXX'; // Replace with your Razorpay Key ID
let selPlan = 'yearly';

function getLicense(){ try{ return JSON.parse(localStorage.getItem('cc_license')||'null'); }catch{ return null; } }
function saveLicense(lic){ localStorage.setItem('cc_license', JSON.stringify(lic)); }

function checkLicense(){
  const lic = getLicense();
  const now = Date.now();

  // No license — check trial
  if(!lic){
    const trialStart  = parseInt(localStorage.getItem('cc_trial_start')||'0');
    const trialUsed   = localStorage.getItem('cc_trial_used') === 'true';

    if(!trialStart && !trialUsed) return 'none'; // never started, never used

    if(trialStart){
      const trialDays = Math.floor((now - trialStart) / 86400000);
      if(trialDays < 30) return { status:'trial', daysLeft: 30 - trialDays };
      // Trial expired — mark permanently as used
      localStorage.setItem('cc_trial_used', 'true');
      return { status:'trial_expired' }; // distinct from paid plan expired
  }

    // cc_trial_used=true but no trialStart — already consumed
    return { status:'trial_expired' };
  }

  // Lifetime license
  if(lic.plan === 'lifetime') return { status:'active', plan:'lifetime' };

  // Check expiry
  if(lic.expiry && now < lic.expiry){
    const daysLeft = Math.floor((lic.expiry - now) / 86400000);
    return { status:'active', plan:lic.plan, daysLeft };
  }

  // Paid plan expired — mark trial as used so they can't fall back to it
      localStorage.setItem('cc_trial_used', 'true');
  return { status:'expired', plan:lic.plan };
  }

function showLicenseScreen(){
  const scr = document.getElementById('license-screen');
  scr.style.display = 'flex';
  const lic = checkLicense();

  // ── One-Time Trial Lock ───────────────────────────────────────────────────
  // If trial was ever used (started or expired), permanently hide the trial button.
  const trialUsed  = localStorage.getItem('cc_trial_used') === 'true'
                  || !!localStorage.getItem('cc_trial_start');
  const trialBtnWrap = document.getElementById('trial-btn-wrap');
  const trialBtn     = document.getElementById('trial-btn');

  document.getElementById('trial-banner').style.display  = 'none';
  document.getElementById('expired-banner').style.display= 'none';

  // Default: hide trial button (will only show if legitimately never used)
  if(trialBtnWrap) trialBtnWrap.style.display = 'none';

  if(lic === 'none' && !trialUsed){
    // First-time user — never started a trial, never had a plan
    if(trialBtnWrap) trialBtnWrap.style.display = 'block';
    if(trialBtn)     trialBtn.textContent = 'Start 30-day free trial';

  } else if(lic.status === 'trial'){
    // Active trial — show trial banner and allow continuation
    document.getElementById('trial-banner').style.display = 'block';
    document.getElementById('trial-days').textContent = lic.daysLeft + ' days remaining in your free trial';
    if(trialBtnWrap) trialBtnWrap.style.display = 'block';
    if(trialBtn)     trialBtn.textContent = 'Continue with trial (' + lic.daysLeft + ' days left)';

  } else if(lic.status === 'trial_expired'){
    // Trial used and expired — show expired banner, NO trial button
    document.getElementById('expired-banner').style.display = 'block';
    document.getElementById('expired-banner').innerHTML =
      '<div style="font-size:13px;font-weight:700;color:#DC2626">❌ Free Trial Expired</div>' +
      '<div style="font-size:11px;color:#DC2626;margin-top:3px">Your 30-day trial has ended. Please purchase a plan to continue.</div>';
    if(trialBtnWrap) trialBtnWrap.style.display = 'none'; // LOCKED — no trial again

  } else if(lic.status === 'expired'){
    // Paid plan expired — NO trial button (they already used trial before paying)
    document.getElementById('expired-banner').style.display = 'block';
    const savedLic = getLicense();
    if(savedLic && savedLic.plan){
    document.getElementById('expired-banner').innerHTML =
        '<div style="font-size:13px;font-weight:700;color:#DC2626">❌ ' +
        (savedLic.plan.charAt(0).toUpperCase()+savedLic.plan.slice(1)) +
        ' Plan Expired</div>' +
        '<div style="font-size:11px;color:#DC2626;margin-top:3px">Please renew your subscription to continue.</div>';
  }
    if(trialBtnWrap) trialBtnWrap.style.display = 'none'; // LOCKED — paid users can't go back to trial
  }

  selectPlan('yearly');
  }

function selectPlan(plan){
  selPlan = plan;
  ['monthly','yearly'].forEach(p=>{
    const el = document.getElementById('plan-'+p);
  if(!el) return;
    if(p === plan){
      el.style.borderColor = '#E8622A';
      el.style.background = '#FFF7F0';
  } else {
      el.style.borderColor = '#E7E2D9';
      el.style.background = '#fff';
  }
    });
  const p = PLANS[plan];
  document.getElementById('buy-btn').textContent = '💳 Buy Now — ' + p.label;
  }

function showKeyEntry(){
  document.getElementById('plan-section').style.display = 'none';
  document.getElementById('key-section').style.display = 'block';
  document.getElementById('trial-btn-wrap').style.display = 'none';
  }

function showPlans(){
  document.getElementById('plan-section').style.display = 'block';
  document.getElementById('key-section').style.display = 'none';
  // Only show trial button if trial genuinely never used
  const trialUsed = localStorage.getItem('cc_trial_used') === 'true'
                  || !!localStorage.getItem('cc_trial_start');
  const wrap = document.getElementById('trial-btn-wrap');
  if(wrap) wrap.style.display = trialUsed ? 'none' : 'block';
  }

function startTrial(){
  const reg = getRegistration();
  if(!reg){
    // Not registered — go to registration
    document.getElementById('license-screen').style.display='none';
  document.getElementById('reg-screen').style.display='flex';
    return;
  }

  // ── One-Time Trial Lock ───────────────────────────────────────────────────
  // If trial was already used (even partially), block it completely.
  if(localStorage.getItem('cc_trial_used') === 'true' || localStorage.getItem('cc_trial_start')){
    toast('Free trial has already been used on this device.','warn');
    // Hide the button immediately so user can't try again
  const wrap = document.getElementById('trial-btn-wrap');
    if(wrap) wrap.style.display = 'none';
    return;
  }

  // First time — set BOTH flags atomically
  const now = Date.now().toString();
  localStorage.setItem('cc_trial_start', now);
  localStorage.setItem('cc_trial_used',  'true'); // permanent lock — survives plan changes

  hideLicenseScreen();
  }

function hideLicenseScreen(){
  document.getElementById('license-screen').style.display = 'none';
    if(localStorage.getItem('ops_logged')){
  document.getElementById('login-screen').style.display='none';
      document.getElementById('app').style.display='flex';
      initApp();
  } else {
  document.getElementById('login-screen').style.display='flex';
  }
  // Report activation to sheets
  const reg = getRegistration();
  const lic = getLicense();
  if(reg && lic){
    sendToSheets('license_activated', {
      email: reg.email, mobile: reg.mobile, name: reg.name,
      plan: lic.plan, key: lic.key || '', status: 'active'
    });
  }
  }

// Generate a license key (for your use — admin tool)
function generateKey(plan, customerName){
  const expiry = plan === 'lifetime' ? 9999999999999 : Date.now() + PLANS[plan].days * 86400000;
  const data = btoa(JSON.stringify({ plan, expiry, name: customerName, issued: Date.now() }));
  const hash = data.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g,'X');
  return 'CCTR-' + hash.slice(0,4) + '-' + hash.slice(4,8) + '-' + btoa(expiry.toString()).slice(0,4).toUpperCase() + '-' + btoa(customerName||'USER').slice(0,4).toUpperCase();
  }

function activateLicenseKey(){
  const key = (document.getElementById('license-key-input').value||'').trim().toUpperCase();
  if(!key || key.length < 15){ showLicMsg('Enter a valid license key (CCTR-XXXX-XXXX-XXXX)','err'); return; }
  if(!key.startsWith('CCTR-')){ showLicMsg('❌ Invalid key format — must start with CCTR-','err'); return; }

  showLicMsg('⏳ Verifying key with server...','warn');

  verifyKeyOnline(key).then(result => {
    if(result.valid){
      // Save license with correct expiry from server
      saveLicense({ key, plan: result.plan, expiry: result.expiry, name: result.name || '' });
      const planLabel = result.plan === 'lifetime' ? 'Lifetime' : result.plan === 'yearly' ? '1 Year' : '1 Month';
      showLicMsg('✅ License activated! Plan: ' + planLabel, 'ok');
      // Update Google Sheets
  const reg = getRegistration();
      if(reg) sendToSheets('activate_key', { email: reg.email, mobile: reg.mobile, name: reg.name, key, plan: result.plan, status: 'active' });
      setTimeout(()=>hideLicenseScreen(), 1200);
  } else {
      showLicMsg('❌ ' + (result.reason || 'Invalid or expired key. Contact support.'), 'err');
  }
  }).catch((err)=>{
    // No internet — cannot verify, show message
    showLicMsg('⚠️ No internet connection. Please connect to verify your key.', 'warn');
    console.warn('Key verification failed:', err.message);
    });
  }

// Verify key against GitHub licenses.json
async function verifyKeyOnline(key){
  // Try Google Sheets first if configured
  try{
    if(GSHEET_URL && !GSHEET_URL.includes('YOUR_GOOGLE')){
      const url = GSHEET_URL + '?action=verify_key&key=' + encodeURIComponent(key);
      const r = await fetch(url, {cache:'no-store'});
      if(r.ok){
        const data = await r.json();
        if(data.ok !== false){
          if(data.valid) return { valid:true, plan:data.plan, expiry:data.expiry, name:data.name||'' };
          return { valid:false, reason: data.msg || 'Key invalid or not approved' };
  }
  }
  }
  }catch(e){ console.warn('Sheets verify failed:', e.message); }

  // Method 1: GitHub raw URL
  try{
    const rawUrl = 'https://raw.githubusercontent.com/prajapatikuldeep455-source/classcore-tuition/main/licenses.json?t='+Date.now();
    const resp = await fetch(rawUrl, {cache:'no-store'});
    if(resp.ok){
      const licenses = await resp.json();
      return _checkKeyInLicenses(key, licenses);
  }
  }catch(e){ console.warn('Raw GitHub failed:', e.message); }

  // Method 2: GitHub Contents API (works better in Electron)
  try{
    const apiUrl = 'https://api.github.com/repos/prajapatikuldeep455-source/classcore-tuition/contents/licenses.json?ref=main&t='+Date.now();
    const resp = await fetch(apiUrl, {
      headers:{'Accept':'application/vnd.github.v3+json'},
      cache:'no-store'
    });
    if(resp.ok){
      const data = await resp.json();
      const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g,''))));
      const licenses = JSON.parse(decoded);
      return _checkKeyInLicenses(key, licenses);
  }
  }catch(e){ console.warn('GitHub API failed:', e.message); }

  // All methods failed
  throw new Error('Cannot reach GitHub. Check your internet connection.');
  }

function _checkKeyInLicenses(key, licenses){
  if(!licenses || typeof licenses !== 'object') throw new Error('Invalid license data from server');
  const lic = licenses[key];
  if(!lic) return { valid:false, reason:'Key not found. Make sure the key was pushed to GitHub.' };
  if(lic.plan !== 'lifetime'){
    if(!lic.expiry) return { valid:false, reason:'Key has no expiry date. Contact support.' };
    if(Date.now() > lic.expiry) return { valid:false, reason:'Key expired on '+new Date(lic.expiry).toLocaleDateString('en-IN')+'. Please renew.' };
  }
  return { valid:true, plan:lic.plan, expiry:lic.expiry||9999999999999, name:lic.name||'' };
  }

function showLicMsg(msg, type){
  const el = document.getElementById('lic-msg');
  el.textContent = msg;
  el.style.color = type==='err'?'#DC2626':type==='warn'?'#E8622A':'#16A34A';
  }

// Razorpay payment
function buyPlan(){
  const plan = PLANS[selPlan];
  if(RZPKEY.includes('XXXXX')){
    alert('Razorpay not configured yet.\nAdd your Razorpay Key ID to enable online payments.\nFor now, contact admin for a license key.');
    showKeyEntry();
    return;
  }
  const options = {
    key: RZPKEY,
    amount: plan.price,
    currency: 'INR',
    name: 'ClassCore Tuition',
    description: selPlan.charAt(0).toUpperCase()+selPlan.slice(1)+' Subscription',
    theme: { color: '#E8622A' },
    handler: function(response){
      // Payment successful — activate license
      const expiry = selPlan === 'lifetime' ? 9999999999999 : Date.now() + plan.days * 86400000;
      const key = 'CCTR-' + response.razorpay_payment_id.slice(-8).toUpperCase();
      saveLicense({ key, plan: selPlan, expiry, paymentId: response.razorpay_payment_id });
      showLicMsg('✅ Payment successful! License activated!', 'ok');
      setTimeout(()=>hideLicenseScreen(), 1500);
    },
    modal: { ondismiss: ()=>{ showLicMsg('Payment cancelled', 'warn'); } }
  };
  const rzp = new window.Razorpay(options);
  rzp.open();
  }

// ── END LICENSE SYSTEM ─────────────────────────────────────────────────────
