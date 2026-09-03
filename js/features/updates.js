// ═══════════════════════════════════════════════════════════════
// UPDATE SYSTEM  v3.0  — Fast banner, speed display, ETA, no stuck 0%
// ═══════════════════════════════════════════════════════════════
let _updateVersion = '';
let _downloadStartTime = 0;

// Show the slim banner at top
function showUpdateBanner(msg, sub){
  const b = document.getElementById('update-banner');
  if(!b) return;
  const title = document.getElementById('update-title');
  const subt  = document.getElementById('update-sub');
  if(title) title.textContent = msg  || 'New version available!';
  if(subt)  subt.textContent  = sub  || 'Click Update Now to download and install';
  b.style.display = 'block';
  const app = document.getElementById('app');
  if(app) app.style.paddingTop = '64px';
}

function hideUpdateBanner(){
  const b = document.getElementById('update-banner');
  if(b) b.style.display = 'none';
  const app = document.getElementById('app');
  if(app) app.style.paddingTop = '';
}

// Manual check from Settings
function manualCheckUpdate(){
  const msgEl = document.getElementById('update-check-msg');
  if(msgEl){ msgEl.style.color='#78716C'; msgEl.textContent='⏳ Checking for updates…'; }

  if(!IS_ELECTRON()){
    fetch('version.json?nocache='+Date.now(), {
      cache:'no-store',
      headers:{'Cache-Control':'no-cache','Pragma':'no-cache'}
    })
    .then(r=>r.json())
    .then(d=>{
      const cur    = localStorage.getItem('cc_app_version')||'0';
      const latest = d.version||'0';
      if(!msgEl) return;
      if(latest !== cur){
        msgEl.style.color   = '#16A34A';
        msgEl.textContent   = '✅ New version v'+latest+' available! Reload the app.';
      } else {
        msgEl.style.color   = '#78716C';
        msgEl.textContent   = '✅ You are on the latest version (v'+cur+')';
        setTimeout(()=>{ if(msgEl) msgEl.textContent=''; }, 4000);
      }
    })
    .catch(()=>{
      if(msgEl){ msgEl.style.color='#DC2626'; msgEl.textContent='❌ No internet. Check your connection.'; }
    });
    return;
  }

  window.classcore.checkUpdate()
    .then(r=>{
      if(r && !r.ok && msgEl){
        msgEl.style.color   = '#DC2626';
        msgEl.textContent   = '❌ Update check failed. Check your internet.';
      }
    })
    .catch(()=>{
      if(msgEl){ msgEl.style.color='#DC2626'; msgEl.textContent='❌ Cannot connect to update server.'; }
    });
}

// User clicked "Update Now" in banner
async function updStart(){
  const titleEl  = document.getElementById('update-title');
  const subEl    = document.getElementById('update-sub');
  const btn      = document.getElementById('update-btn');
  const later    = document.getElementById('update-later-btn');
  const progWrap = document.getElementById('update-progress-wrap');
  const speedWrap= document.getElementById('update-speed-wrap');
  const progBar  = document.getElementById('update-progress-bar');
  const pctEl    = document.getElementById('update-pct');
  const labelEl  = document.getElementById('update-progress-label');

  // ── Phase 1: Saving state ────────────────────────────────────────────────
  if(btn)     { btn.disabled=true; btn.textContent='⏳ Saving data…'; }
  if(titleEl)   titleEl.textContent = 'Saving your data…';
  if(subEl)     subEl.textContent   = 'Please wait a moment';
  if(progWrap)  progWrap.style.display   = 'block';
  if(speedWrap) speedWrap.style.display  = 'none'; // hide until download starts
  if(progBar)   progBar.style.width      = '0%';
  if(pctEl)     pctEl.textContent        = '0%';
  if(labelEl)   labelEl.textContent      = 'Preparing download…';

  _downloadStartTime = Date.now();

  // ── Phase 2: Call IPC — returns {ok:true} as soon as download fires ───────
  let r;
  try{
    r = await window.classcore.downloadUpdate(IS_ELECTRON() ? buildPayloadSafe() : null);
  }catch(e){
    r = { ok: false, error: e.message };
  }

  if(!r || !r.ok){
    // Download failed to start
    toast('❌ Update failed to start: '+(r?.error||'check your internet connection'), 'err');
    if(btn)     { btn.disabled=false; btn.textContent='⬇️ Try Again'; }
    if(titleEl)   titleEl.textContent = '🚀 New version v'+_updateVersion+' available!';
    if(subEl)     subEl.textContent   = 'Download failed — click to retry';
    if(progWrap)  progWrap.style.display  = 'none';
    if(speedWrap) speedWrap.style.display = 'none';
    return;
  }

  // ── Phase 3: Download started — update UI to downloading state ───────────
  if(btn)     { btn.disabled=true; btn.textContent='⬇️ Downloading…'; }
  if(titleEl)   titleEl.textContent = 'Downloading update v'+_updateVersion+'…';
  if(subEl)     subEl.textContent   = 'This takes 2–5 minutes. You can keep using the app.';
  if(speedWrap) speedWrap.style.display = 'block';
  if(labelEl)   labelEl.textContent = 'Download started…';
  if(pctEl)     pctEl.textContent   = '0%';

  // Fake starter tick at 1% so progress bar visibly starts moving
  setTimeout(()=>{
    if(progBar && progBar.style.width==='0%'){
      progBar.style.width='1%';
      if(pctEl) pctEl.textContent='1%';
      if(labelEl) labelEl.textContent='Connecting to server…';
    }
  }, 2000);
}

// Alias used by old code paths
async function doUpdate(){ return updStart(); }

// ── IPC EVENT HANDLERS ────────────────────────────────────────────────────────
if(IS_ELECTRON()){

  // 1. Update found
  window.classcore.onUpdateAvailable(version=>{
    _updateVersion = version;
    const msgEl = document.getElementById('update-check-msg');
    if(msgEl){ msgEl.style.color='#16A34A'; msgEl.textContent='✅ v'+version+' available! See banner.'; }
    showUpdateBanner('🚀 New version v'+version+' is ready!', 'Download is ~76 MB — takes 2–5 minutes on average internet');
  });

  // 2. Already latest
  window.classcore.onUpdateNotAvailable && window.classcore.onUpdateNotAvailable(version=>{
    const msgEl = document.getElementById('update-check-msg');
    if(msgEl){
      msgEl.style.color   = '#78716C';
      msgEl.textContent   = '✅ Already on latest version (v'+version+')';
      setTimeout(()=>{ if(msgEl) msgEl.textContent=''; }, 4000);
    }
  });

  // 3. Download progress — updates EVERY percent
  window.classcore.onUpdateProgress(pct=>{
    // Banner bar
    const bar     = document.getElementById('update-progress-bar');
    const pctEl   = document.getElementById('update-pct');
    const label   = document.getElementById('update-progress-label');
    const speedEl = document.getElementById('update-speed');
    const etaEl   = document.getElementById('update-eta');
    const titleEl = document.getElementById('update-title');
    const progWrap= document.getElementById('update-progress-wrap');
    const speedWrap=document.getElementById('update-speed-wrap');
    const btn     = document.getElementById('update-btn');

    if(progWrap)  progWrap.style.display  = 'block';
    if(speedWrap) speedWrap.style.display = 'block';
    if(btn)       btn.style.display       = 'none';  // hide Update Now while downloading

    if(bar)    bar.style.width   = pct+'%';
    if(pctEl)  pctEl.textContent = pct+'%';
    if(label)  label.textContent = pct < 100 ? 'Downloading v'+_updateVersion+'…' : '✅ Download complete! Finalising…';
    if(titleEl)titleEl.textContent = 'Downloading update… '+pct+'%';

    // Calculate speed and ETA
    if(_downloadStartTime > 0 && pct > 0){
      const elapsed   = (Date.now() - _downloadStartTime) / 1000; // seconds
      const totalSize = 76;  // MB approximate
      const downloaded= (pct/100) * totalSize;
      const speedMBps = elapsed > 0 ? downloaded / elapsed : 0;
      const remaining = speedMBps > 0 ? (totalSize - downloaded) / speedMBps : 0;

      if(speedEl){
        if(speedMBps >= 1) speedEl.textContent = speedMBps.toFixed(1)+' MB/s';
        else               speedEl.textContent = (speedMBps*1024).toFixed(0)+' KB/s';
      }
      if(etaEl){
        if(remaining <= 0 || pct >= 99)     etaEl.textContent = 'Almost done…';
        else if(remaining < 60)              etaEl.textContent = Math.ceil(remaining)+'s left';
        else                                 etaEl.textContent = Math.ceil(remaining/60)+'m left';
      }
    }

    // Sync modal progress bar too
    const mFill = document.getElementById('upd-progress-fill');
    const mPct  = document.getElementById('upd-pct-label');
    const mLbl  = document.getElementById('upd-progress-label');
    const mBtn  = document.getElementById('upd-action-btn');
    if(mFill) mFill.style.width = pct+'%';
    if(mPct)  mPct.textContent  = pct+'%';
    if(mLbl)  mLbl.textContent  = pct<100 ? 'Downloading…' : '✅ Complete!';
    if(mBtn)  mBtn.innerHTML    = '⬇️ '+pct+'% downloading…';
  });

  // 4. Download complete
  window.classcore.onUpdateDownloaded(version=>{
    const bar      = document.getElementById('update-progress-bar');
    const titleEl  = document.getElementById('update-title');
    const subEl    = document.getElementById('update-sub');
    const btn      = document.getElementById('update-btn');
    const later    = document.getElementById('update-later-btn');
    const progWrap = document.getElementById('update-progress-wrap');
    const speedWrap= document.getElementById('update-speed-wrap');
    const label    = document.getElementById('update-progress-label');
    const pctEl    = document.getElementById('update-pct');

    if(bar)      { bar.style.width='100%'; bar.style.background='#16A34A'; }
    if(pctEl)      pctEl.textContent   = '100%';
    if(label)      label.textContent   = '✅ Download complete!';
    if(titleEl)    titleEl.textContent = '✅ v'+version+' downloaded & ready!';
    if(subEl)      subEl.textContent   = 'Click Restart & Install — takes 30 seconds';
    if(speedWrap)  speedWrap.style.display = 'none';

    // Show restart button
    if(btn){
      btn.style.display    = 'flex';
      btn.disabled         = false;
      btn.textContent      = '🔄 Restart & Install';
      btn.style.background = '#16A34A';
      btn.onclick          = ()=>window.classcore.installUpdate();
    }
    if(later)  later.style.display = 'none';  // no "later" after download

    // Settings message
    const msgEl = document.getElementById('update-check-msg');
    if(msgEl){ msgEl.style.color='#16A34A'; msgEl.textContent='✅ v'+version+' ready! Click Restart & Install.'; }

    toast('✅ Update downloaded! Click Restart & Install in the banner.');

    // Sync modal
    const mFill = document.getElementById('upd-progress-fill');
    const mPct  = document.getElementById('upd-pct-label');
    const mLbl  = document.getElementById('upd-progress-label');
    const mBtn  = document.getElementById('upd-action-btn');
    if(mFill){ mFill.style.width='100%'; mFill.style.background='#16A34A'; }
    if(mPct)   mPct.textContent = '100%';
    if(mLbl)   mLbl.textContent = '✅ Download complete!';
    if(mBtn){
      mBtn.innerHTML   = '🔄 Restart & Install';
      mBtn.disabled    = false;
      mBtn.style.background = 'linear-gradient(135deg,#16A34A,#15803D)';
      mBtn.onclick     = ()=>window.classcore.installUpdate();
    }
  });

  // 5. Error — suppress network errors silently
  window.classcore.onUpdateError && window.classcore.onUpdateError(msg=>{
    const isNetworkErr = msg && (
      msg.includes('net::') || msg.includes('ENOTFOUND') ||
      msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET')
    );
    const msgEl = document.getElementById('update-check-msg');
    if(isNetworkErr){
      console.warn('[Update] Network error (silent):', msg);
    } else if(msg){
      console.error('[Update] Error:', msg);
      if(msgEl){ msgEl.style.color='#DC2626'; msgEl.textContent='❌ Update error: '+msg; }
    }
  });

  // Fix 3: Show retry progress in banner
  window.classcore.onUpdateRetrying && window.classcore.onUpdateRetrying(data=>{
    const titleEl = document.getElementById('update-title');
    const subEl   = document.getElementById('update-sub');
    const msgEl   = document.getElementById('update-check-msg');
    if(titleEl) titleEl.textContent = `⏳ Retrying… (attempt ${data.attempt}/${data.max})`;
    if(subEl)   subEl.textContent   = `${data.reason} Retrying in ${data.delayMs/1000}s…`;
    if(msgEl){  msgEl.style.color='#E8622A'; msgEl.textContent=`⏳ Retry ${data.attempt}/${data.max} — ${data.reason}`; }
    console.warn('[Update] Retrying:', data);
  });

  // Fix 4: Manual fallback — show download link when all retries fail
  window.classcore.onUpdateManualFallback && window.classcore.onUpdateManualFallback(data=>{
    console.error('[Update] All retries failed. Showing manual fallback.');
    const msgEl   = document.getElementById('update-check-msg');
    const titleEl = document.getElementById('update-title');
    const subEl   = document.getElementById('update-sub');
    const btn     = document.getElementById('update-btn');

    if(titleEl) titleEl.textContent = '⚠️ Auto-update failed';
    if(subEl)   subEl.textContent   = data.instructions || 'Please download the update manually.';
    if(msgEl){
      msgEl.style.color='#DC2626';
      msgEl.innerHTML=`❌ ${data.msg} &nbsp;<a href="${data.manualUrl}" target="_blank" style="color:#E8622A;font-weight:700;text-decoration:underline">⬇️ Download Manually</a>`;
    }

    // Change Update Now button to open GitHub releases page
    if(btn){
      btn.style.display  = 'flex';
      btn.disabled       = false;
      btn.textContent    = '🌐 Download Manually';
      btn.style.background = '#DC2626';
      btn.onclick        = ()=>{ window.open(data.manualUrl); };
    }

    showUpdateBanner('⚠️ Auto-update failed — manual download required', data.msg);
    toast('⚠️ Auto-update failed. Click "Download Manually" in the banner.','warn');
  });
}


