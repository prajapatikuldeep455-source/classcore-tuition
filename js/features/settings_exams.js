// ═══════════════════════════════════════════════════════════════════
// SUBSCRIPTION & PLAN STATUS CARD
// ═══════════════════════════════════════════════════════════════════
function renderSubscriptionCard(){
  const lic    = getLicense();
  const status = checkLicense();
  const reg    = getRegistration();
  const now    = Date.now();

  // ── Derive display values ────────────────────────────────────────
  let planLabel='Free Trial', planColor='#92400E', planIcon='⏳';
  let expiryStr='', daysLeft=0, daysTotal=30, progressPct=0;
  let statusBadge='', statusColor='', statusBg='';
  let alertHtml='', barColor='#16A34A';

  if(status==='none'){
    planLabel='No Plan'; planColor='#78716C'; planIcon='⚪';
    statusBadge='Not Started'; statusColor='#78716C'; statusBg='#F4F4F5';
    daysLeft=30; daysTotal=30; progressPct=0;
    expiryStr='Not started';
  } else if(status.status==='trial'){
    planLabel='Free Trial'; planColor='#92400E'; planIcon='⏳';
    daysLeft=status.daysLeft; daysTotal=30;
    progressPct=Math.round(((30-daysLeft)/30)*100);
    barColor=daysLeft<=7?'#DC2626':daysLeft<=15?'#E9C46A':'#16A34A';
    const ts=parseInt(localStorage.getItem('cc_trial_start')||'0')+30*86400000;
    expiryStr=new Date(ts).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    statusBadge='Trial Active'; statusColor='#92400E'; statusBg='#FEF9C3';
    if(daysLeft<=7) alertHtml=`<div style="background:#FEE2E2;border:1.5px solid #FECACA;border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px"><span style="font-size:22px">⚠️</span><div><div style="font-size:12px;font-weight:700;color:#DC2626">Trial expires in ${daysLeft} day${daysLeft===1?'':'s'}!</div><div style="font-size:11px;color:#DC2626;margin-top:2px">Activate a license key to keep your data and continue using ClassCore.</div></div></div>`;
  } else if(status.status==='active'){
    if(lic.plan==='lifetime'){
      planLabel='Lifetime'; planColor='#1D4ED8'; planIcon='♾️';
      expiryStr='Never expires'; daysLeft=9999; daysTotal=9999; progressPct=100; barColor='#1D4ED8';
      statusBadge='Active — Lifetime'; statusColor='#1D4ED8'; statusBg='#EFF6FF';
    } else if(lic.plan==='yearly'){
      planLabel='Yearly'; planColor='#16A34A'; planIcon='📅';
      daysLeft=status.daysLeft; daysTotal=365;
      progressPct=Math.round(((365-daysLeft)/365)*100);
      barColor=daysLeft<=30?'#DC2626':daysLeft<=90?'#E9C46A':'#16A34A';
      expiryStr=new Date(lic.expiry).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
      statusBadge='Active — Yearly'; statusColor='#16A34A'; statusBg='#DCFCE7';
      if(daysLeft<=30) alertHtml=`<div style="background:#FEF9C3;border:1.5px solid #FDE047;border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px"><span style="font-size:22px">⏰</span><div><div style="font-size:12px;font-weight:700;color:#92400E">License renews in ${daysLeft} days</div><div style="font-size:11px;color:#92400E;margin-top:2px">Renew your key before ${expiryStr} to avoid any interruption.</div></div></div>`;
    } else {
      planLabel='Monthly'; planColor='#2A9D8F'; planIcon='🗓️';
    daysLeft=status.daysLeft; daysTotal=30;
    progressPct=Math.round(((30-daysLeft)/30)*100);
      barColor=daysLeft<=7?'#DC2626':'#2A9D8F';
      expiryStr=new Date(lic.expiry).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
      statusBadge='Active — Monthly'; statusColor='#2A9D8F'; statusBg='#CCFBF1';
      if(daysLeft<=7) alertHtml=`<div style="background:#FEF9C3;border:1.5px solid #FDE047;border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px"><span style="font-size:22px">⏰</span><div><div style="font-size:12px;font-weight:700;color:#92400E">License expires in ${daysLeft} days</div><div style="font-size:11px;color:#92400E;margin-top:2px">Renew now to avoid any interruption.</div></div></div>`;
    }
    } else {
    planLabel='Expired'; planColor='#DC2626'; planIcon='❌';
    expiryStr=lic?.expiry?new Date(lic.expiry).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—';
    progressPct=100; barColor='#DC2626'; daysLeft=0;
    statusBadge='Expired'; statusColor='#DC2626'; statusBg='#FEE2E2';
    alertHtml=`<div style="background:#FEE2E2;border:1.5px solid #FECACA;border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px"><span style="font-size:22px">❌</span><div><div style="font-size:12px;font-weight:700;color:#DC2626">Your license has expired</div><div style="font-size:11px;color:#DC2626;margin-top:2px">Activate a new license key to continue using ClassCore.</div></div></div>`;
    }

  // ── Registered user info ──────────────────────────────────────────
  const regHtml = reg ? `
    <div style="background:#F7F5F0;border-radius:10px;padding:12px 14px;margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;color:#78716C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">👤 Registered Account</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${reg.name?`<div><div style="font-size:10px;color:#78716C">Name</div><div style="font-size:12.5px;font-weight:600">${esc(reg.name)}</div></div>`:''}
        ${reg.email?`<div><div style="font-size:10px;color:#78716C">Email</div><div style="font-size:12px;font-weight:600;word-break:break-all">${esc(reg.email)}</div></div>`:''}
        ${reg.mobile?`<div><div style="font-size:10px;color:#78716C">Mobile</div><div style="font-size:12.5px;font-weight:600">${esc(reg.mobile)}</div></div>`:''}
        ${reg.institute?`<div><div style="font-size:10px;color:#78716C">Institute</div><div style="font-size:12.5px;font-weight:600">${esc(reg.institute)}</div></div>`:''}
      </div>
    </div>` : '';

  // ── Current license key ───────────────────────────────────────────
  const keyHtml = lic?.key ? `
    <div style="background:#F7F5F0;border-radius:10px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div>
        <div style="font-size:10px;color:#78716C;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Current License Key</div>
        <div style="font-size:12px;font-weight:700;font-family:monospace;color:#18181B;letter-spacing:1px">${esc(lic.key)}</div>
      </div>
      <span style="font-size:20px">🔑</span>
    </div>` : '';

  // ── Plan comparison ───────────────────────────────────────────────
  // Lifetime card is ALWAYS hidden unless the user already has a lifetime license
  // OR has entered the correct reveal code this session (stored in sessionStorage not localStorage)
  const lifetimeUnlocked = (lic?.plan === 'lifetime' && status.status==='active')
                        || sessionStorage.getItem('cc_lt_unlocked') === '1';

  const plansRows = [
    {key:'monthly', icon:'🗓️', name:'Monthly', price:'₹499',    sub:'/month',  color:'#2A9D8F', note:'30 days'},
    {key:'yearly',  icon:'📅', name:'Yearly',  price:'₹4,499',  sub:'/year',   color:'#E8622A', note:'365 days', popular:true},
    {key:'lifetime',icon:'♾️', name:'Lifetime',price:'₹19,999', sub:' once',   color:'#1D4ED8', note:'Forever', hidden:!lifetimeUnlocked},
  ].map(p=>`
    <div id="plan-card-${p.key}" style="border:2px solid ${lic?.plan===p.key?p.color:'#E7E2D9'};border-radius:12px;padding:12px 8px;text-align:center;background:${lic?.plan===p.key?p.color+'15':'#fff'};position:relative;${p.hidden?'display:none;opacity:0;transform:scale(0.8);':''}transition:all .4s cubic-bezier(.34,1.56,.64,1);">
      ${p.popular&&lic?.plan!==p.key?`<div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#E8622A;color:#fff;font-size:8px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap">POPULAR</div>`:''}
      ${lic?.plan===p.key?`<div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:${p.color};color:#fff;font-size:8px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap">✓ YOUR PLAN</div>`:''}
      <div style="font-size:20px;margin-bottom:4px">${p.icon}</div>
      <div style="font-size:11px;font-weight:700;color:#78716C">${p.name}</div>
      <div style="font-size:16px;font-weight:900;color:${p.color};margin:4px 0">${p.price}</div>
      <div style="font-size:10px;color:#78716C">${p.sub}</div>
      <div style="font-size:9px;color:#A0A0A0;margin-top:3px">${p.note}</div>
    </div>`).join('');

  // ── Activate section ──────────────────────────────────────────────
  const isLifetime = lic?.plan==='lifetime' && status.status==='active';
  const activateHtml = isLifetime ? `
    <div style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:10px;padding:12px 14px;text-align:center">
      <div style="font-size:14px;font-weight:700;color:#1D4ED8">♾️ Lifetime License — No Renewal Needed</div>
      <div style="font-size:11px;color:#1D4ED8;margin-top:4px">You have permanent access to all ClassCore features.</div>
    </div>` : `
    <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:4px">
      <div style="font-size:11px;font-weight:700;color:#78716C;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🔑 Activate or Renew License Key</div>
      <div style="display:flex;gap:8px">
        <input id="set-lic-key" placeholder="CCTR-XXXX-XXXX-XXXX"
          style="flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;background:var(--input-bg);outline:none;color:var(--text-main);font-family:monospace"
          oninput="this.value=this.value.toUpperCase();checkLifetimeRevealKey(this.value)">
        <button class="btn btn-primary" onclick="activateLicenseFromSettings()">✅ Activate</button>
      </div>
      <div id="set-lic-msg" style="margin-top:8px;font-size:12px;font-weight:600;min-height:18px"></div>
      <div style="margin-top:10px;font-size:11px;color:#78716C;text-align:center">
        Don't have a key? Contact us at
        <a href="mailto:coreclass.2025@gmail.com" style="color:var(--primary);font-weight:700;text-decoration:none">coreclass.2025@gmail.com</a>
      </div>
    </div>`;

  return `<div class="card" style="margin-bottom:18px;border:2px solid ${planColor}33;overflow:visible">

    <!-- Card Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div style="font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px">💎 Subscription &amp; Plan</div>
      <span style="background:${statusBg};color:${statusColor};font-size:11px;font-weight:700;padding:5px 13px;border-radius:20px;border:1.5px solid ${statusColor}44">
        ${planIcon} ${statusBadge}
      </span>
      </div>

    ${alertHtml}

    <!-- Plan Status Box -->
    <div style="background:linear-gradient(135deg,${planColor}18,${planColor}08);border:1.5px solid ${planColor}44;border-radius:12px;padding:18px;margin-bottom:16px">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;margin-bottom:${lic?.plan==='lifetime'?'0':'14px'}">
      <div>
          <div style="font-size:9.5px;color:#78716C;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">Plan</div>
          <div style="font-size:22px;margin-bottom:3px">${planIcon}</div>
          <div style="font-size:13px;font-weight:800;color:${planColor}">${planLabel}</div>
      </div>
      <div>
          <div style="font-size:9.5px;color:#78716C;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">${status.status==='trial'?'Trial Ends':lic?.plan==='lifetime'?'Validity':'Expires On'}</div>
          <div style="font-size:13px;font-weight:700;color:#18181B;margin-top:10px">${expiryStr}</div>
      </div>
      <div>
          <div style="font-size:9.5px;color:#78716C;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">${lic?.plan==='lifetime'?'Access':'Days Left'}</div>
          ${lic?.plan==='lifetime'
            ? `<div style="font-size:13px;font-weight:700;color:#1D4ED8;margin-top:10px">✅ Forever</div>`
            : `<div style="font-size:26px;font-weight:900;color:${planColor};line-height:1.1">${daysLeft}</div><div style="font-size:10px;color:#78716C">days</div>`}
      </div>
      </div>

      ${lic?.plan!=='lifetime' ? `
      <div style="margin-top:4px">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#78716C;margin-bottom:5px">
          <span>${status.status==='trial'?'Trial progress':'Plan period used'}</span>
          <span style="font-weight:700;color:${barColor}">${progressPct}% used — ${daysLeft} day${daysLeft!==1?'s':''} left</span>
      </div>
        <div style="height:8px;background:#E7E2D9;border-radius:6px;overflow:hidden">
          <div style="height:100%;background:${barColor};border-radius:6px;width:${progressPct}%;transition:width .6s"></div>
      </div>
      </div>` : ''}
      </div>

    ${regHtml}
    ${keyHtml}

    <!-- Plan Comparison -->
    <div style="margin-bottom:16px">
      <div style="font-size:10.5px;font-weight:700;color:#78716C;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Available Plans</div>
      <div id="plans-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${plansRows}</div>
      <!-- Secret reveal row — hidden until lifetime is unlocked -->
      <div id="lt-reveal-row" style="display:${lifetimeUnlocked?'none':'flex'};align-items:center;gap:8px;margin-top:10px;background:#F7F5F0;border:1.5px dashed #E7E2D9;border-radius:10px;padding:10px 12px;">
        <span style="font-size:16px">🔓</span>
        <input id="lt-secret-input" placeholder="Enter special access code…"
          style="flex:1;background:transparent;border:none;outline:none;font-size:12px;font-weight:600;color:var(--text-main);font-family:monospace;letter-spacing:1px"
          oninput="this.value=this.value.toUpperCase();checkLifetimeRevealKey(this.value)"
          onkeydown="if(event.key==='Enter')checkLifetimeRevealKey(this.value)">
        <span style="font-size:10px;color:#78716C">Special plans available for eligible users</span>
      </div>
      <div id="lt-reveal-msg" style="font-size:11px;margin-top:6px;font-weight:600;min-height:14px"></div>
      </div>

    ${activateHtml}
    </div>`;
    }

// Activate key directly from Settings page
async function activateLicenseFromSettings(){
  const inp = document.getElementById('set-lic-key');
  const msg = document.getElementById('set-lic-msg');
  if(!inp||!msg) return;
  const key=(inp.value||'').trim().toUpperCase();
  if(!key||key.length<15||!key.startsWith('CCTR-')){
    msg.style.color='#DC2626'; msg.textContent='❌ Enter a valid key — format: CCTR-XXXX-XXXX-XXXX'; return;
    }
  msg.style.color='#E8622A'; msg.textContent='⏳ Verifying key with server…';
  try{
    const result=await verifyKeyOnline(key);
    if(result.valid){
      saveLicense({
        key,
        plan: result.plan,
        expiry: result.expiry,
        name: result.name || '',
        institute: result.institute || '',
        mobile: result.mobile || '',
        email: result.email || '',
        expiryDate: result.expiryDate || ''
      });
      let reg = (typeof getRegistration === 'function' ? getRegistration() : null) || {};
      reg = {
        ...reg,
        name: result.name || reg.name || '',
        email: result.email || reg.email || '',
        mobile: result.mobile || reg.mobile || '',
        institute: result.institute || reg.institute || ''
      };
      if(typeof saveRegistration === 'function') saveRegistration(reg);
      const planLabel=result.plan==='lifetime'?'Lifetime ♾️':result.plan==='yearly'?'Yearly 📅':'Monthly 🗓️';
      msg.style.color='#16A34A'; msg.textContent='✅ License activated! Plan: '+planLabel;
      if(reg) sendToSheets('activate_key',{email:reg.email,mobile:reg.mobile,name:reg.name,key,plan:result.plan,status:'active'});
      toast('✅ License activated! Plan: '+planLabel);
      setTimeout(()=>renderSettings(),1200);
    } else {
      // Key found on server but invalid/expired
      msg.style.color='#DC2626'; msg.textContent='❌ '+(result.reason||'Invalid or expired key. Contact support.');
    }
  }catch(err){
    // Real network error — show actual error message
    if(err.message&&err.message.includes('404')){
      msg.style.color='#DC2626';
      msg.textContent='❌ Key not found on server. Please verify your license key.';
    } else if(err.message&&(err.message.includes('NetworkError')||err.message.includes('Failed to fetch')||err.message.includes('net::'))){
      msg.style.color='#E8622A';
      msg.textContent='⚠️ No internet connection. Check your WiFi and try again.';
    } else {
      msg.style.color='#DC2626';
      msg.textContent='❌ Verification error: '+(err.message||'Unknown error');
    }
    console.error('activateLicenseFromSettings error:',err);
    }
    }

// ── LIFETIME PLAN REVEAL ──────────────────────────────────────────────────
// The secret code to reveal the Lifetime plan card.
// Change this to whatever you want — it is NOT the same as a license key.
// It just makes the card visible. User still needs a valid CCTR- key to activate.
const LIFETIME_REVEAL_CODE = 'CLASSCORE-LIFETIME-2026';

function checkLifetimeRevealKey(val){
  if(!val) return;
  const clean = (val||'').trim().toUpperCase();

  // Check both inputs (the separate reveal box AND the license key input)
  if(clean === LIFETIME_REVEAL_CODE.toUpperCase()){
    _revealLifetimePlan();
    return;
    }

  // Also: if the user typed a CCTR- key that starts with the lifetime prefix, reveal it too
  // This lets the license key box double as a reveal trigger
  if(clean.startsWith('CCTR-') && clean.length >= 15){
    // peek at licenses to see if it might be lifetime — just reveal the card
    const lic = getLicense();
    if(lic?.plan === 'lifetime') _revealLifetimePlan();
    }
    }

function _revealLifetimePlan(){
  const card      = document.getElementById('plan-card-lifetime');
  const revealRow = document.getElementById('lt-reveal-row');
  const msg       = document.getElementById('lt-reveal-msg');

  if(card && card.style.display !== 'none') return; // already visible

  // Use sessionStorage — only lasts for this session, resets on app restart
  sessionStorage.setItem('cc_lt_unlocked','1');
  // Also clear old localStorage flag if it exists
  localStorage.removeItem('cc_lt_unlocked');

  if(card){
    card.style.display    = 'block';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(0.7)';
    requestAnimationFrame(()=>{
      card.style.transition = 'all .45s cubic-bezier(.34,1.56,.64,1)';
      card.style.opacity    = '1';
      card.style.transform  = 'scale(1)';
    });
    }
  if(revealRow) revealRow.style.display = 'none';
  if(msg){
    msg.style.color  = '#1D4ED8';
    msg.textContent  = '♾️ Lifetime plan unlocked! Enter a Lifetime key below to activate.';
    setTimeout(()=>{ if(msg) msg.textContent=''; }, 4000);
    }
  toast('♾️ Lifetime plan is now visible!');
    }

function renderSettings(){
  const tName = localStorage.getItem('tuitionName')||'ClassCore Tuition';
  const tAddr  = localStorage.getItem('tuitionAddress')||'';
  const tLogo  = localStorage.getItem('tuitionLogo')||BUILTIN_LOGO;
  const logoHTML = tLogo
    ? '<img src="'+tLogo+'" style="max-height:80px;max-width:200px;border-radius:8px;object-fit:contain;margin-bottom:4px">'
    : '<div style="font-size:36px;margin-bottom:4px">🖼️</div><div style="font-size:12px;color:#78716C">Click to upload your logo</div>';
  const removeBtn = tLogo
    ? '<button type="button" class="btn btn-red btn-xs" style="margin-left:6px" onclick="removeLogo()">✕ Remove Logo</button>'
    : '';

  document.getElementById('page-settings').innerHTML =
    '<div style="max-width:520px">' +
    renderThemePicker() +
    '<div class="card" style="margin-bottom:18px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">' +
        '<span style="font-size:22px">💬</span>' +
        '<div>' +
          '<div style="font-size:14px;font-weight:700">WhatsApp Hub</div>' +
          '<div style="font-size:12px;color:var(--text-muted,#888)" id="wa-hub-status-text">Not connected</div>' +
        '</div>' +
        '<span id="wa-hub-dot" style="margin-left:auto;width:10px;height:10px;border-radius:50%;background:#ccc"></span>' +
      '</div>' +
      '<p style="font-size:12.5px;color:var(--text-muted,#666);margin-bottom:14px">' +
        'Connect your WhatsApp Business account to send broadcasts, fee reminders, ' +
        'and receipts directly — no more manual copy-paste.' +
      '</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-teal" onclick="openWaHub()">🔗 Open WhatsApp Hub</button>' +
        '<button class="btn btn-ghost" id="wa-hub-disconnect-btn" style="display:none" onclick="disconnectWaHub()">Disconnect</button>' +
      '</div>' +
    '</div>' +
    renderSubscriptionCard() +

    '<div class="card" style="margin-bottom:18px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
        '<span style="font-size:22px">📱</span>' +
        '<div>' +
          '<div style="font-size:14px;font-weight:700">Mobile Companion App</div>' +
          '<div style="font-size:12px;color:var(--text-muted,#888)">Connect your Android phone to manage fees and attendance on the go</div>' +
        '</div>' +
      '</div>' +
      '<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">' +
        '<div>' +
          '<div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px">Institute Sync Code</div>' +
          '<div style="font-size:16px;font-weight:900;color:#1B3154;font-family:monospace;margin-top:2px">'+(typeof getInstituteSyncCode === "function" ? getInstituteSyncCode() : "CC-INST1000")+'</div>' +
        '</div>' +
        '<button class="btn btn-primary btn-sm" onclick="openPairModal()">📲 Pair Phone / QR</button>' +
      '</div>' +
    '</div>' +

    '<div class="card" style="margin-bottom:18px">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:7px">🔐 Change Login Credentials</div>' +
      '<div style="background:#FEF9C3;border:1.5px solid #FDE047;border-radius:10px;padding:11px 14px;font-size:12px;color:#92400E;margin-bottom:14px">⚠️ Current login: <b>'+(localStorage.getItem('username')||'admin')+'</b> / <b>••••••••</b></div>' +
      '<div class="form-grid">' +
        '<div class="fg"><label>New Username</label><input id="set-user" placeholder="Leave blank to keep current"></div>' +
        '<div class="fg"><label>New Password</label><input id="set-pass" type="password" placeholder="Leave blank to keep current"></div>' +
      '</div>' +
      '<button class="btn btn-ink btn-sm" style="margin-top:12px" onclick="saveLogin()">🔐 Update Login</button>' +
      '</div>' +

    '<div class="card" style="margin-bottom:18px">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:7px">🏫 Institute Details</div>' +
      '<div class="fg" style="margin-bottom:12px"><label>Tuition / Institute Name</label><input id="set-name" value="'+tName+'"></div>' +
      '<div class="fg" style="margin-bottom:12px"><label>Address</label><input id="set-addr" value="'+tAddr+'"></div>' +
      '<div class="fg" style="margin-bottom:4px"><label>Logo (shows in sidebar &amp; receipts)</label></div>' +
      '<div style="border:2px dashed #E7E2D9;border-radius:12px;padding:20px;text-align:center;background:#FAF8F5;cursor:pointer;margin-bottom:12px" onclick="document.getElementById(\'set-logo\').click()">' +
        '<div id="logo-prev" style="margin-bottom:10px">'+logoHTML+'</div>' +
        '<input type="file" id="set-logo" accept="image/*" onchange="prevLogo(this)" style="display:none">' +
        '<button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();document.getElementById(\'set-logo\').click()">📂 Choose Logo Image</button>' +
        removeBtn +
      '</div>' +
      '<button class="btn btn-primary" style="width:100%;justify-content:center" onclick="saveInstitute()">💾 Save Institute Details</button>' +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-ghost" onclick="exportData()">📥 Export Backup</button>' +
        (IS_ELECTRON()
          ? '<button class="btn btn-teal" onclick="importData()">📤 Import Backup</button>'
          : '<button class="btn btn-teal" onclick="document.getElementById(\'import-file\').click()">📤 Import Backup</button><input type="file" id="import-file" accept=".json" style="display:none" onchange="importData(this)">') +
        '<button class="btn btn-red" onclick="clearAll()">🗑️ Clear All Data</button>' +
      '</div>' +
        (IS_ELECTRON()
        ? '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn-ink btn-sm" onclick="manualCheckUpdate()">🔄 Check for Updates</button>' +
          '<span id="update-check-msg" style="font-size:11px;color:#78716C;align-self:center"></span>' +
          '</div>'
        : '') +
      (IS_ELECTRON() && window._dataPath ? '<div style="margin-top:12px;font-size:11px;color:#78716C;background:#F7F5F0;padding:8px 12px;border-radius:8px;word-break:break-all">💾 Data saved at: <b>'+window._dataPath+'</b></div>' : '') +
      '</div>' +

    (isAdmin() ? '<div class="card" style="margin-bottom:18px">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between"><span>👥 User Management</span><button class="btn btn-primary btn-sm" onclick="openAddUser()">＋ Add Employee</button></div>' +
      '<div id="user-list-wrap">' + renderUserList() + '</div>' +
    '</div>' : '') +

    (isAdmin() ? '<div class="card" style="margin-bottom:18px"><div id="salary-section"></div></div>' : '') +

    '<div class="card" style="margin-bottom:18px">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:7px">💬 Contact Support</div>' +
      '<div style="font-size:12px;color:#78716C;margin-bottom:14px">Send a message to ClassCore support team. We respond within 24 hours.</div>' +
      '<div class="form-grid">' +
        '<div class="fg"><label>Subject</label><input id="sup-subject" placeholder="e.g. Payment issue, Bug report"></div>' +
        '<div class="fg full"><label>Message</label><textarea id="sup-msg" rows="3" placeholder="Describe your issue..." style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;resize:vertical;outline:none;font-family:inherit;background:var(--input-bg);color:var(--text-main)"></textarea></div>' +
      '</div>' +
      '<button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="sendSupportMessage()">📨 Send to Support</button>' +
      '</div>' +

    '</div>';
  if(isAdmin()) setTimeout(()=>renderSalaries(),50);
  setTimeout(() => initWaHubStatusListener(), 100);
}
async function sendSupportMessage(){
  const subject=(document.getElementById('sup-subject')?.value||'').trim();
  const message=(document.getElementById('sup-msg')?.value||'').trim();
  if(!message){toast('Write your message first','err');return;}
  
      const reg=getRegistration();
  if(!reg || !reg.email) {
    toast('You must register with an email to use Contact Support.', 'err');
    return;
    }
  
  const institute = localStorage.getItem('tuitionName')||'';
  const bodyText = `Message:\n${message}\n\n---\nUser Details:\nRegistered Email: ${reg.email}\nName: ${reg.name||'User'}\nMobile: ${reg.mobile||'N/A'}\nInstitute: ${institute}`;
  
  window.location.href = `mailto:coreclass.2025@gmail.com?subject=${encodeURIComponent(subject || 'Support Request')}&body=${encodeURIComponent(bodyText)}`;
  
  toast('✅ Opened your email app to send the message!');
  if(document.getElementById('sup-subject')) document.getElementById('sup-subject').value='';
  if(document.getElementById('sup-msg')) document.getElementById('sup-msg').value='';
    }

function prevLogo(inp){
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{
    document.getElementById('logo-prev').innerHTML=`<img src="${e.target.result}" style="max-height:80px;max-width:200px;border-radius:8px;object-fit:contain;margin-bottom:4px">`;
  };
  r.readAsDataURL(f);
    }
function saveLogin(){
  const u=(document.getElementById('set-user')?.value||'').trim();
  const p=(document.getElementById('set-pass')?.value||'').trim();
  if(!u&&!p){toast('Enter a new username or password','warn');return;}
  if(p&&p.length<6){toast('Password must be at least 6 characters','warn');return;}

  const users=getUsers();
  const adminIdx=users.findIndex(x=>x.role==='admin');
  if(adminIdx===-1){toast('Admin user not found','err');return;}

  const oldUsername=users[adminIdx].username;
  const newU = u || users[adminIdx].username;
  const newP = p || users[adminIdx].password;

  if(u && u !== oldUsername && users.find(x=>x.username===u)){
    toast('Username already taken — choose another','err');return;
    }

  showLoader('Updating Credentials…','Saving your new login details','\uD83D\uDD10');

  setTimeout(async ()=>{
    const hashedP = await hashPassword(newP);
    users[adminIdx].username  = newU;
    users[adminIdx].password  = newU === oldUsername && !p ? users[adminIdx].password : hashedP;
    users[adminIdx].mustChange = false;

    localStorage.setItem('cc_users', JSON.stringify(users));
    localStorage.setItem('username', newU);
    localStorage.setItem('password', users[adminIdx].password);

    if(currentUser && currentUser.role==='admin'){
      currentUser.username = newU;
      localStorage.setItem('ops_cur_user', JSON.stringify(currentUser));
    }

    if(IS_ELECTRON()){
      try{ window.classcore.saveDataSync(buildPayload()); }catch(e){}
    }
    await persist();

    const reg = getRegistration();
    const adminEmail = reg?.email || users[adminIdx]?.email;
    if(adminEmail){
      sendEmail(adminEmail,'ClassCore \u2014 Login Credentials Updated','',{
        username:  newU,
        password:  p ? newP : '(unchanged)',
        user_name: users[adminIdx].name||newU,
        institute: localStorage.getItem('tuitionName')||'',
        mobile:    reg?.mobile||'',
        trial_end: (u&&u!==oldUsername?'Username: '+newU:'')+(p?' | Password updated':''),
        subject:   'ClassCore \u2014 Login Credentials Updated',
      }).catch(()=>{});
    }

    hideLoader();
    toast('\u2705 Login credentials updated!');
    renderSettings();
  }, 1200);
    }
function saveInstitute(){
  const name=document.getElementById('set-name')?.value||'ClassCore Tuition';
  const addr=document.getElementById('set-addr')?.value||'';
  const li=document.getElementById('set-logo');
  showLoader('Saving Institute…','Updating your details','\uD83C\uDFEB');
  const doSave = async ()=>{
    localStorage.setItem('tuitionName', name);
    localStorage.setItem('tuitionAddress', addr);
    await persist();
    updSbInst();
    hideLoader();
    toast('\u2705 Institute details saved!');
    renderSettings();
  };
  if(li?.files[0]){
  const r=new FileReader();
    r.onload=async e=>{
      localStorage.setItem('tuitionLogo',e.target.result);
      await doSave();
  };
    r.readAsDataURL(li.files[0]);
    } else {
    setTimeout(doSave, 1000);
    }
    }
function removeLogo(){
  if(!confirm('Remove the logo?'))return;
  localStorage.removeItem('tuitionLogo');
    updSbInst();
  toast('Logo removed');
    renderSettings();
    }
function saveSettings(){
  saveLogin();
  saveInstitute();
    }
async function exportData(){
  const data=buildPayload();
  data.exported=new Date().toISOString();
    if(IS_ELECTRON()){
    const r=await window.classcore.exportBackup(data);
    if(r.ok) toast('Backup exported!');
    else if(r.error) toast('Export failed: '+r.error,'err');
    } else {
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    a.download='ClassCore_Backup_'+todayISO()+'.json';a.click();toast('Backup exported!');
    }
    }
async function importData(inp){
    if(IS_ELECTRON()){
    if(!confirm('Import a backup? Current data will be replaced.'))return;
    const r=await window.classcore.importBackup();
    if(!r.ok){toast(r.error||'Import cancelled','warn');return;}
    const d=r.data;
    if(!d.students||!d.batches){toast('Invalid backup file','err');return;}
    students=d.students||[];batches=d.batches||[];
    classFees=d.classFees||{};stuFeeOvr=d.stuFeeOvr||{};attData=d.attData||{};
    await persist();toast('Backup imported!');location.reload();
    } else {
    const f=inp?.files[0];if(!f)return;
    if(!confirm('Import this backup? Current data will be replaced.'))return;
  const r=new FileReader();
    r.onload=async e=>{
  try{
        const d=JSON.parse(e.target.result);
    if(!d.students||!d.batches){toast('Invalid backup file','err');return;}
    students=d.students||[];batches=d.batches||[];
    classFees=d.classFees||{};stuFeeOvr=d.stuFeeOvr||{};attData=d.attData||{};
        await persist();toast('Backup imported successfully!');location.reload();
      }catch{toast('Failed to read backup file','err');}
  };
    r.readAsText(f);
    if(inp) inp.value='';
    }
    }
function clearAll(){
  if(!confirm('Delete ALL data?'))return;if(!confirm('Are you really sure?'))return;
  ['ops_s','ops_b','ops_cf','ops_sfo','ops_att'].forEach(k=>localStorage.removeItem(k));
  location.reload();
    }

// ── USER MANAGEMENT ──────────────────────────────────────────────────────
function renderUserList(){
  const users=getUsers();
  const ROLE_COLORS={'admin':'#E8622A','Teacher':'#2A9D8F','Receptionist':'#457B9D','Accountant':'#6D6875','Assistant Teacher':'#E9C46A'};
  const ROLE_LABELS={'admin':'👑 Admin','Teacher':'👨‍🏫 Teacher','Receptionist':'📞 Receptionist','Accountant':'💼 Accountant','Assistant Teacher':'👨‍🎓 Asst. Teacher'};
  return users.map((u,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#F7F5F0;border-radius:10px;border:1.5px solid #E7E2D9;margin-bottom:8px">
      <div class="av ${u.role==='admin'?'avc0':'avc1'}" style="width:36px;height:36px;font-size:12px">${(u.name||u.username).slice(0,2).toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:13px">${esc(u.name||u.username)}</div>
        <div style="font-size:11px;color:#78716C;margin-top:2px">
          @${esc(u.username)}
          ${u.mobile?` · 📱 ${esc(u.mobile)}`:''}
      </div>
        <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
          <span style="background:${ROLE_COLORS[u.role]||'#78716C'}22;color:${ROLE_COLORS[u.role]||'#78716C'};font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">${ROLE_LABELS[u.role]||u.role}</span>
          <span style="background:#F4F4F5;color:#78716C;font-size:10px;padding:2px 8px;border-radius:10px">ID: ${esc(u.empId||'—')}</span>
      </div>
      </div>
      <div style="display:flex;gap:5px">
        ${u.role!=='admin'?`<button class="btn btn-ghost btn-xs" onclick="openEditUser('${u.username}')">✏️</button>`:''}
        ${u.role!=='admin'?`<button class="btn btn-red btn-xs" onclick="deleteUser('${u.username}')">🗑️</button>`:'<span style="font-size:11px;color:#78716C">Owner</span>'}
      </div>
    </div>`).join('');
    }

const EMP_ROLES=['Teacher','Receptionist','Accountant','Assistant Teacher'];

function genEmpId(){
  const users=getUsers();
  const empCount=users.filter(u=>u.role!=='admin').length+1;
  return 'EMP'+empCount.toString().padStart(3,'0');
    }
function genUsername(name){
  const base=(name||'emp').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'emp';
  const num=Math.floor(100+Math.random()*900);
  return base+num;
    }
function genPassword(){
  const chars='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({length:8},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
    }

function permCheckboxes(perms){
  const p = perms || DEFAULT_PERMS;
  const items = [
    ['add_students',    '➕ Add Students'],
    ['edit_students',   '✏️ Edit Students'],
    ['delete_students', '🗑️ Delete Students'],
    ['collect_fees',    '💰 Collect Fees'],
    ['delete_payments', '❌ Delete Payments'],
    ['mark_attendance', '✅ Mark Attendance'],
    ['view_fees',       '👁️ View Fees'],
    ['manage_batches',  '🕐 Manage Batches'],
    ['manage_courses',  '📚 Manage Courses'],
  ];
  return `<div style="background:#F7F5F0;border:1.5px solid #E7E2D9;border-radius:12px;padding:14px;margin-top:12px">
    <div style="font-size:11px;font-weight:700;color:#78716C;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">🔐 Permissions — What can this employee do?</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${items.map(([key,label])=>`
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:#fff;border:1.5px solid #E7E2D9;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:500;transition:.15s">
          <input type="checkbox" id="perm-${key}" ${p[key]?' checked':''} style="width:15px;height:15px;accent-color:#E8622A;cursor:pointer">
          ${label}
        </label>`).join('')}
      </div>
    </div>`;
    }

function getPermissionsFromForm(){
  const keys=['add_students','edit_students','delete_students','collect_fees','delete_payments','mark_attendance','view_fees','manage_batches','manage_courses'];
  const perms={};
  keys.forEach(k=>{
    const el=document.getElementById('perm-'+k);
    perms[k]=el?el.checked:DEFAULT_PERMS[k];
    });
  return perms;
    }

function openAddUser(){
  const empId=genEmpId();
  const html=`<div style="max-width:520px;margin:20px auto">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <button class="btn btn-ghost btn-sm" onclick="renderSettings()">← Back</button>
      <h2 style="font-size:17px;font-weight:700">➕ Add Employee</h2>
      </div>
    <div class="card">
      <div class="form-grid">
        <div class="fg full"><label>Full Name ★</label><input id="nu-name" placeholder="e.g. Ravi Patel" oninput="autoFillEmpCreds(this.value)"></div>
        <div class="fg"><label>Mobile Number</label><input id="nu-mobile" placeholder="9876543210" maxlength="10" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10)"></div>
        <div class="fg"><label>Role ★</label><select id="nu-role">${EMP_ROLES.map(r=>`<option value="${r}">${r}</option>`).join('')}</select></div>
        <div class="fg full" style="background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:10px;padding:12px 14px">
          <div style="font-size:11px;font-weight:700;color:#16A34A;margin-bottom:4px">🪪 Auto-Generated Employee ID</div>
          <div style="font-size:16px;font-weight:800;color:#18181B;letter-spacing:1px">${empId}</div>
      </div>
        <div class="fg"><label>Username ★</label>
          <input id="nu-user" placeholder="Auto-generated" style="font-family:monospace">
          <div class="hint">Auto-generated from name. You can change it.</div>
      </div>
        <div class="fg"><label>Password ★</label>
          <div style="display:flex;gap:6px">
            <input id="nu-pass" placeholder="Auto-generated" style="font-family:monospace;flex:1">
            <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('nu-pass').value=genPassword()">🔄</button>
      </div>
      </div>
      </div>
      ${permCheckboxes(DEFAULT_PERMS)}
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-ghost" onclick="renderSettings()">Cancel</button>
        <button class="btn btn-primary" onclick="saveNewUser('${empId}')">💾 Create Account</button>
      </div>
      </div>
    </div>`;
  document.getElementById('page-settings').innerHTML=html;
  document.getElementById('nu-pass').value=genPassword();
    }

function autoFillEmpCreds(name){
  const userEl=document.getElementById('nu-user');
  if(userEl&&!userEl.dataset.manual) userEl.value=genUsername(name);
    }

function openEditUser(username){
  const users=getUsers();
  const u=users.find(x=>x.username===username);
  if(!u)return;
  const html=`<div style="max-width:520px;margin:20px auto">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <button class="btn btn-ghost btn-sm" onclick="renderSettings()">← Back</button>
      <h2 style="font-size:17px;font-weight:700">✏️ Edit Employee — ${esc(u.name||u.username)}</h2>
      </div>
    <div class="card">
      <div class="form-grid">
        <div class="fg full"><label>Full Name</label><input id="eu-name" value="${esc(u.name||'')}"></div>
        <div class="fg"><label>Mobile Number</label><input id="eu-mobile" value="${esc(u.mobile||'')}" maxlength="10" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10)"></div>
        <div class="fg"><label>Role</label><select id="eu-role">${EMP_ROLES.map(r=>`<option value="${r}"${u.role===r?' selected':''}>${r}</option>`).join('')}</select></div>
        <div class="fg full" style="background:#F0F9FF;border:1.5px solid #BAE6FD;border-radius:10px;padding:12px 14px">
          <div style="font-size:11px;font-weight:700;color:#0369A1;margin-bottom:4px">🪪 Employee ID</div>
          <div style="font-size:15px;font-weight:800;color:#18181B">${esc(u.empId||'—')}</div>
      </div>
        <div class="fg"><label>New Username</label><input id="eu-user" placeholder="Leave blank to keep: ${esc(u.username)}" style="font-family:monospace"></div>
        <div class="fg"><label>New Password</label>
          <div style="display:flex;gap:6px">
            <input id="eu-pass" placeholder="Leave blank to keep current" style="font-family:monospace;flex:1">
            <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('eu-pass').value=genPassword()">🔄</button>
      </div>
      </div>
      </div>
      ${permCheckboxes(u.permissions)}
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-ghost" onclick="renderSettings()">Cancel</button>
        <button class="btn btn-primary" onclick="saveEditUser('${username}')">💾 Save Changes</button>
      </div>
      </div>
    </div>`;
  document.getElementById('page-settings').innerHTML=html;
    }

function saveEditUser(oldUsername){
  const users=getUsers();
  const idx=users.findIndex(x=>x.username===oldUsername);
  if(idx===-1) return;
  const name=(document.getElementById('eu-name')?.value||'').trim();
  const mobile=(document.getElementById('eu-mobile')?.value||'').trim();
  const role=document.getElementById('eu-role')?.value||'Teacher';
  const newUser=(document.getElementById('eu-user')?.value||'').trim();
  const newPass=(document.getElementById('eu-pass')?.value||'').trim();
  if(newUser&&newUser!==oldUsername&&users.find(x=>x.username===newUser)){toast('Username already taken','err');return;}
  if(newPass&&newPass.length<6){toast('Password must be at least 6 characters','err');return;}
  const finalUser=newUser||users[idx].username;
  const finalPass=newPass||users[idx].password;
  const empEmail=users[idx].email||'';
  showLoader('Saving Employee…','Updating account','\uD83D\uDC64');
  setTimeout(async()=>{
    users[idx]={...users[idx],name:name||users[idx].name,mobile:mobile||users[idx].mobile||'',role,username:finalUser,password:finalPass,permissions:getPermissionsFromForm()};
    saveUsers(users);
    if(empEmail&&(newUser||newPass)){
      sendEmail(empEmail,'ClassCore \u2014 Account Updated','',{username:finalUser,password:newPass||'(unchanged)',user_name:users[idx].name||finalUser,institute:localStorage.getItem('tuitionName')||'',mobile:mobile||'',trial_end:(newUser?'Username: '+finalUser:'')+(newPass?' | Password updated':''),subject:'ClassCore \u2014 Account Updated'}).catch(()=>{});
    }
    hideLoader();
    toast('\u2705 Employee updated!');
    renderSettings();
  },1000);
    }

function saveNewUser(empId){
  const name=(document.getElementById('nu-name')?.value||'').trim();
  const mobile=(document.getElementById('nu-mobile')?.value||'').trim();
  const role=document.getElementById('nu-role')?.value||'Teacher';
  let u=(document.getElementById('nu-user')?.value||'').trim();
  let p=(document.getElementById('nu-pass')?.value||'').trim();
  if(!name){toast('Full name required','err');return;}
  if(!u) u=genUsername(name);
  if(!p) p=genPassword();
  const users=getUsers();
  if(users.find(x=>x.username===u)){toast('Username already exists \u2014 try another','err');return;}
  showLoader('Creating Account…','Setting up employee login','\uD83D\uDC64');
  setTimeout(async()=>{
    users.push({username:u,password:p,role,name,mobile:mobile||'',empId:empId||genEmpId(),joinDate:todayStr(),permissions:getPermissionsFromForm()});
    saveUsers(users);
    hideLoader();
    toast('\u2705 '+name+' added! Login: '+u+' / '+p);
    renderSettings();
  },1000);
    }

function deleteUser(username){
  if(!confirm('Remove this employee account?')) return;
  showLoader('Deleting Account…','Removing employee','\uD83D\uDDD1\uFE0F');
  setTimeout(async()=>{
    const users=getUsers().filter(u=>u.username!==username);
    saveUsers(users);
    hideLoader();
    toast('Account removed');
    const wrap=document.getElementById('user-list-wrap');
    if(wrap) wrap.innerHTML=renderUserList();
  },800);
    }

// ── GOOGLE SHEETS CONFIG ─────────────────────────────────────────────────
// Replace this URL with your Google Apps Script Web App URL after setup
// ═══════════════════════════════════════════════════════════════════
// EMAIL SYSTEM — EmailJS (free, no backend needed, works in Electron)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// EMAIL SYSTEM — EmailJS Configuration
// ═══════════════════════════════════════════════════════════════════
// STEP 1: Replace YOUR_SERVICE_ID  → emailjs.com → Email Services → Copy ID
// STEP 2: Replace YOUR_TEMPLATE_ID → emailjs.com → Email Templates → Copy ID
// STEP 3: Replace YOUR_PUBLIC_KEY  → emailjs.com → Account → API Keys → Public Key
// ═══════════════════════════════════════════════════════════════════
const EMAILJS_SERVICE_ID  = 'service_ci0s1je';
const EMAILJS_TEMPLATE_ID = 'template_r8k4w5p';
const EMAILJS_PUBLIC_KEY  = 'YdR9wbP3wK0rUyA77';

// Auto-init EmailJS with retry (Electron CDN load can be slow)
(function initEmailJS(){
  function tryInit(attempts){
    if(typeof emailjs !== 'undefined'){
      if(EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY'){
        console.warn('[ClassCore][EmailJS] ⚠️ Public key not set. Replace YOUR_PUBLIC_KEY in index.html');
    return;
    }
  try{
        emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
        console.log('[ClassCore][EmailJS] ✅ Ready | Service:', EMAILJS_SERVICE_ID, '| Template:', EMAILJS_TEMPLATE_ID);
      }catch(e){
        console.error('[ClassCore][EmailJS] ❌ init() failed:', e.message);
    }
    } else if(attempts > 0){
      setTimeout(()=>tryInit(attempts - 1), 500); // retry every 500ms, up to 5s
    } else {
      console.error('[ClassCore][EmailJS] ❌ SDK failed to load from CDN.\nFix: Check internet connection, or add https://cdn.jsdelivr.net to Electron CSP.');
    }
    }
  tryInit(10); // 10 × 500ms = 5 second max wait
})();

async function sendEmail(toEmail, subject, body, extraVars){
  // Pre-flight checks with specific error messages
  if(typeof emailjs === 'undefined'){
    console.error('[ClassCore][EmailJS] ❌ SDK not loaded');
    return { ok: false, error: 'EmailJS not loaded' };
    }
  if(EMAILJS_SERVICE_ID  === 'YOUR_SERVICE_ID' ||
     EMAILJS_TEMPLATE_ID === 'YOUR_TEMPLATE_ID' ||
     EMAILJS_PUBLIC_KEY  === 'YOUR_PUBLIC_KEY'){
    console.error('[ClassCore][EmailJS] ❌ Credentials not configured.\nOpen index.html and replace YOUR_SERVICE_ID, YOUR_TEMPLATE_ID, YOUR_PUBLIC_KEY');
    return { ok: false, error: 'EmailJS not configured' };
    }
  if(!toEmail || !toEmail.includes('@')){
    console.error('[ClassCore][EmailJS] ❌ Invalid email:', toEmail);
    return { ok: false, error: 'Invalid email address' };
    }

  const params = { to_email: toEmail, subject: subject||'ClassCore', body: body||'', ...(extraVars||{}) };
  console.log('[ClassCore][EmailJS] 📧 Sending to:', toEmail);

  try{
    const result = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
    console.log('[ClassCore][EmailJS] ✅ Sent! Status:', result.status);
    return { ok: true };
  }catch(err){
    const msg = err?.text || err?.message || JSON.stringify(err) || 'Unknown';
    console.error('[ClassCore][EmailJS] ❌ Failed:', msg);
    if(msg.includes('400')) console.error('  → Template var mismatch. Ensure {{to_email}}, {{subject}} exist in template.');
    if(msg.includes('401')) console.error('  → Wrong Public Key.');
    if(msg.includes('404')) console.error('  → Service ID or Template ID not found.');
    if(msg.includes('limit')) console.error('  → 200/month free limit reached.');
    return { ok: false, error: msg };
  }
}

// ── WhatsApp Hub integration ──
function openWaHub() {
  if (typeof window.classcore !== 'undefined' && window.classcore.waHub) {
    window.classcore.waHub.openHubWindow();
  } else {
    toast('WhatsApp Hub is only available in the desktop app', 'warning');
  }
}

async function disconnectWaHub() {
  if (!confirm('Disconnect your WhatsApp account? You will need to scan the QR code again to reconnect.')) return;
  try {
    await window.classcore.waHub.logout();
    toast('WhatsApp disconnected');
  } catch (e) {
    toast('Failed to disconnect: ' + e.message, 'error');
  }
}

function initWaHubStatusListener() {
  if (typeof window.classcore === 'undefined' || !window.classcore.waHub) return;
  
  // Check initial status
  window.classcore.waHub.isConnected().then(result => {
    updateWaHubSettingsStatus(result.connected ? 'connected' : 'disconnected');
  }).catch(() => {});
  
  // Listen for status changes
  window.classcore.waHub.onStatus((data) => {
    updateWaHubSettingsStatus(data.status, data.info);
  });
}

function updateWaHubSettingsStatus(status, info) {
  const dot = document.getElementById('wa-hub-dot');
  const text = document.getElementById('wa-hub-status-text');
  const dcBtn = document.getElementById('wa-hub-disconnect-btn');
  if (!dot || !text) return;
  
  if (status === 'connected') {
    dot.style.background = '#22c55e';
    text.textContent = 'Connected' + (info && info.number ? ' — ' + info.number : '');
    if (dcBtn) dcBtn.style.display = '';
  } else if (status === 'qr' || status === 'reconnecting') {
    dot.style.background = '#f59e0b';
    text.textContent = status === 'qr' ? 'Scan QR in WhatsApp Hub' : 'Reconnecting...';
    if (dcBtn) dcBtn.style.display = 'none';
  } else {
    dot.style.background = '#ccc';
    text.textContent = 'Not connected';
    if (dcBtn) dcBtn.style.display = 'none';
  }
}

// Google Sheets — for data logging only
const GSHEET_URL = 'https://script.google.com/macros/library/d/1NNJtHeLenk6yXZP2yDKJwcqn6lqieZpHnB9OmdePCeZ_J1Snv_1Gj4L5/2';