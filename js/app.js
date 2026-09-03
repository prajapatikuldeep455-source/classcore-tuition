window.addEventListener('error', event => {
  console.error('[ClassCore][window.error]', event.message, event.filename, event.lineno, event.colno, event.error);
});
window.addEventListener('unhandledrejection', event => {
  console.error('[ClassCore][unhandledrejection]', event.reason);
});
window.addEventListener('beforeunload', () => {
  console.log('[ClassCore] beforeunload fired');
});

function showBootFallbackScreen(){
  hideStartupLoaderIfVisible();
  const screens = ['reg-screen', 'license-screen', 'login-screen', 'app'];
  const anyVisible = screens.some(id => {
    const el = document.getElementById(id);
    return el && el.style.display && el.style.display !== 'none';
  });
  if(anyVisible) return;
  console.warn('[ClassCore] Boot fallback — showing login screen');
  const login = document.getElementById('login-screen');
  if(login) login.style.display = 'flex';
}

// If boot hangs (e.g. shortcut launch / slow disk), show login instead of white screen
setTimeout(showBootFallbackScreen, 8000);

window.addEventListener('DOMContentLoaded',async ()=>{
  console.log('[ClassCore] Boot: DOMContentLoaded fired');

  try { loadSavedTheme(); } catch(e) { console.error('[ClassCore] Theme load error:', e); }

  // Clear any leftover lifetime unlock flag from localStorage (migrate to sessionStorage)
  try { localStorage.removeItem('cc_lt_unlocked'); } catch(_){}

  _dataLoadPromise = loadAllData()
    .then(()=>{ console.log('[ClassCore] Boot: Data loaded'); _dataLoaded = true; })
    .catch(e => {
      console.error('[ClassCore] loadAllData crashed:', e);
      // Continue anyway — show login at minimum
    });

  hideStartupLoaderIfVisible();

  // Step 1: Check if registered
  let reg = null;
  try { reg = getRegistration(); } catch(e) { console.error('[ClassCore] getRegistration error:', e); }

  if(!reg){
    console.log('[ClassCore] Boot: No registration → show reg screen');
    document.getElementById('reg-screen').style.display = 'flex';
    document.getElementById('login-screen').style.display = 'none';
    return;
  }
  console.log('[ClassCore] Boot: Registration found');

  // Step 2: Check license status
  let licStatus = null;
  try { licStatus = checkLicense(); } catch(e) { console.error('[ClassCore] checkLicense error:', e); }
  console.log('[ClassCore] Boot: License status =', licStatus);

  // Determine if user should have access
  // Active if: paid active, OR trial with ANY days left (> 0)
  let isActive = false;
  if(licStatus && typeof licStatus === 'object'){
    isActive = licStatus.status === 'active' || (licStatus.status === 'trial' && licStatus.daysLeft > 0);
  }

  if(!isActive){
    console.log('[ClassCore] Boot: License not active → show license screen');
    try { showLicenseScreen(); } catch(e) {
      console.error('[ClassCore] showLicenseScreen crash:', e);
      // Fallback: at least show the license screen div
      try { document.getElementById('license-screen').style.display='flex'; } catch(_){}
    }
    document.getElementById('login-screen').style.display = 'none';
    return;
  }

  console.log('[ClassCore] Boot: License active → check login');

  // Step 3: Show login or app
  if(localStorage.getItem('ops_logged')){
    console.log('[ClassCore] Boot: Already logged in → show app');
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='flex';
    try { initApp(); } catch(e) { console.error('[ClassCore] initApp crash:', e); }
  } else {
    console.log('[ClassCore] Boot: Not logged in → show login screen');
    document.getElementById('login-screen').style.display='flex';
  }

  try {
    document.getElementById('l-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
    document.getElementById('l-user').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
  } catch(e) { console.error('[ClassCore] Login keydown bind error:', e); }

  if(IS_ELECTRON()){
    try {
      const p=await window.classcore.getDataPath();
      window._dataPath=p;
    } catch(e) { console.error('[ClassCore] getDataPath error:', e); }
  }

  hideStartupLoaderIfVisible();

  console.log('[ClassCore] Boot: Complete');
});