// ══════════════════════════════════════════════════════════════════════
// CLOUD SYNC ENGINE — ClassCore Desktop ↔ Mobile Companion (Firestore)
// ══════════════════════════════════════════════════════════════════════
'use strict';

const _cloudClientId = 'pc_' + Math.random().toString(36).substring(2, 9);
let _cloudSyncUnsubscribe = null;
let _cloudSyncStatus = 'init'; // 'init' | 'synced' | 'syncing' | 'offline' | 'error'
const _dirtyModules = new Set();
let _cloudPushTimer = null;
let _isIncomingCloudUpdate = false;

/**
 * Get or create a permanent, human-friendly Institute Sync Code.
 * Example: CC-PATEL7823
 */
function getInstituteSyncCode() {
  let code = localStorage.getItem('cc_sync_code');
  if (!code || !code.startsWith('CC-')) {
    const reg = (typeof getRegistration === 'function') ? getRegistration() : null;
    const rawName = (reg && reg.institute) || localStorage.getItem('tuitionName') || (reg && reg.name) || 'TUITION';
    const cleanName = rawName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'INST';
    const rand = Math.floor(1000 + Math.random() * 9000);
    code = `CC-${cleanName}${rand}`;
    localStorage.setItem('cc_sync_code', code);
  }
  return code;
}

/**
 * Initialize Cloud Sync on startup.
 * Waits for Firebase Firestore to be ready.
 */
function initCloudSync() {
  const syncCode = getInstituteSyncCode();
  console.log(`[ClassCore][CloudSync] Initializing with Sync Code: ${syncCode}`);

  updateCloudSyncUI('offline', 'Connecting...');

  // Wait for _db to initialize (from js/state.js)
  let tries = 0;
  const interval = setInterval(() => {
    tries++;
    if (typeof _db !== 'undefined' && _db) {
      clearInterval(interval);
      _setupCloudSyncListeners(syncCode);
      // Push initial state once connected
      cloudSyncMarkAllDirty();
    } else if (tries > 20) {
      clearInterval(interval);
      updateCloudSyncUI('offline', 'Offline (Saved on PC)');
      console.warn('[ClassCore][CloudSync] Firestore offline — changes saved locally.');
    }
  }, 500);

  // Network online/offline listeners
  window.addEventListener('online', () => {
    console.log('[ClassCore][CloudSync] Network online detected');
    if (_dirtyModules.size > 0) {
      _flushCloudSync();
    } else {
      updateCloudSyncUI('synced', 'Cloud Synced');
    }
  });

  window.addEventListener('offline', () => {
    updateCloudSyncUI('offline', 'Offline (Saved on PC)');
  });
}

/**
 * Listen for realtime updates from Mobile App.
 */
function _setupCloudSyncListeners(syncCode) {
  if (typeof _db === 'undefined' || !_db) return;
  if (_cloudSyncUnsubscribe) _cloudSyncUnsubscribe();

  try {
    const modulesRef = _db.collection('institutes').doc(syncCode).collection('modules');
    _cloudSyncUnsubscribe = modulesRef.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const modId = change.doc.id;
          const data = change.doc.data();
          if (!data) return;

          // Ignore echoes of our own desktop changes
          if (data._sender === _cloudClientId) return;

          console.log(`[ClassCore][CloudSync] 📲 Received delta from mobile: [${modId}]`);
          _applyIncomingModule(modId, data);
        }
      });
      updateCloudSyncUI('synced', 'Cloud Synced');
    }, (err) => {
      console.warn('[ClassCore][CloudSync] Listener warning:', err.message);
      updateCloudSyncUI('offline', 'Offline (Saved on PC)');
    });

    updateCloudSyncUI('synced', 'Cloud Synced');
  } catch (err) {
    console.error('[ClassCore][CloudSync] Listener setup error:', err);
    updateCloudSyncUI('offline', 'Offline (Saved on PC)');
  }
}

/**
 * Apply incoming changes from mobile into local memory and disk.
 */
function _applyIncomingModule(moduleId, data) {
  _isIncomingCloudUpdate = true;
  let changed = false;

  try {
    switch (moduleId) {
      case 'students':
        if (Array.isArray(data.list)) {
          students = data.list;
          changed = true;
        }
        break;
      case 'batches':
        if (Array.isArray(data.batches)) {
          batches = data.batches;
          changed = true;
        }
        if (Array.isArray(data.courses)) {
          courses = data.courses;
          changed = true;
        }
        break;
      case 'fees':
        if (data.classFees) classFees = data.classFees;
        if (data.stuFeeOvr) stuFeeOvr = data.stuFeeOvr;
        if (data.monthFees) monthFees = data.monthFees;
        changed = true;
        break;
      case 'attendance':
        if (data.attData) {
          attData = data.attData;
          changed = true;
        }
        break;
      case 'exams':
        if (Array.isArray(data.exams)) {
          exams = data.exams;
          changed = true;
        }
        break;
      case 'expenses':
        if (Array.isArray(data.expenses)) expenses = data.expenses;
        if (Array.isArray(data.salaries)) salaries = data.salaries;
        changed = true;
        break;
    }

    if (changed) {
      // 1. Silently write to PC hard drive without triggering outgoing sync loop
      if (IS_ELECTRON()) {
        try {
          const payload = typeof buildPayloadSafe === 'function' ? buildPayloadSafe() : buildPayload();
          window.classcore.saveDataSync(payload);
        } catch (e) {
          console.error('[ClassCore][CloudSync] Local sync write error:', e);
        }
      }

      // 2. Refresh active UI screen smoothly
      _refreshActiveScreen(moduleId);

      // 3. User feedback
      if (typeof toast === 'function') {
        const modLabels = {
          attendance: 'Attendance',
          fees: 'Fees',
          students: 'Students',
          exams: 'Exams',
          batches: 'Batches',
          expenses: 'Expenses'
        };
        toast(`📱 ${modLabels[moduleId] || 'Data'} updated from mobile`, 'info');
      }
    }
  } catch (err) {
    console.error('[ClassCore][CloudSync] Error applying module:', err);
  } finally {
    _isIncomingCloudUpdate = false;
  }
}

/**
 * Refresh current view when mobile sends updates.
 */
function _refreshActiveScreen(moduleId) {
  try {
    const activePage = document.querySelector('.page.active');
    const pageId = activePage ? activePage.id : '';

    if (moduleId === 'students' && (pageId === 'page-students' || pageId === 'page-dashboard')) {
      if (typeof renderStudents === 'function') renderStudents();
      if (typeof renderDashboard === 'function') renderDashboard();
    } else if (moduleId === 'attendance' && (pageId === 'page-attendance' || pageId === 'page-dashboard')) {
      if (typeof renderAttendance === 'function') renderAttendance();
      if (typeof renderDashboard === 'function') renderDashboard();
    } else if (moduleId === 'fees' && (pageId === 'page-fees' || pageId === 'page-dashboard')) {
      if (typeof renderFees === 'function') renderFees();
      if (typeof renderDashboard === 'function') renderDashboard();
    } else if (moduleId === 'batches' && (pageId === 'page-batches' || pageId === 'page-courses')) {
      if (typeof renderBatches === 'function') renderBatches();
      if (typeof renderCourses === 'function') renderCourses();
    } else if (moduleId === 'exams' && pageId === 'page-exams') {
      if (typeof renderExams === 'function') renderExams();
    } else if (moduleId === 'expenses' && pageId === 'page-expenses') {
      if (typeof renderExpenses === 'function') renderExpenses();
    }
  } catch (e) {
    console.warn('[ClassCore][CloudSync] UI refresh error:', e);
  }
}

/**
 * Mark a specific module dirty for background sync.
 */
function cloudSyncMarkDirty(moduleName) {
  if (_isIncomingCloudUpdate) return; // Don't push changes that just came from mobile
  _dirtyModules.add(moduleName);
  updateCloudSyncUI('syncing', 'Syncing…');

  clearTimeout(_cloudPushTimer);
  _cloudPushTimer = setTimeout(() => {
    _flushCloudSync();
  }, 1200);
}

/**
 * Mark all modules dirty (used on first connect or full save).
 */
function cloudSyncMarkAllDirty() {
  if (_isIncomingCloudUpdate) return;
  _dirtyModules.add('students');
  _dirtyModules.add('batches');
  _dirtyModules.add('fees');
  _dirtyModules.add('attendance');
  _dirtyModules.add('exams');
  _dirtyModules.add('expenses');

  clearTimeout(_cloudPushTimer);
  _cloudPushTimer = setTimeout(() => {
    _flushCloudSync();
  }, 1200);
}

/**
 * Push all dirty modules to Firestore in modular documents.
 */
async function _flushCloudSync() {
  if (_dirtyModules.size === 0) return;
  if (!navigator.onLine || typeof _db === 'undefined' || !_db) {
    updateCloudSyncUI('offline', 'Offline (Saved on PC)');
    return;
  }

  const syncCode = getInstituteSyncCode();
  const instDocRef = _db.collection('institutes').doc(syncCode);
  const modulesRef = instDocRef.collection('modules');

  updateCloudSyncUI('syncing', 'Syncing…');

  try {
    const modulesToSync = Array.from(_dirtyModules);
    const now = Date.now();

    const writePromises = modulesToSync.map((mod) => {
      let payload = null;
      switch (mod) {
        case 'students':
          payload = { list: students || [], count: (students || []).length, updatedAt: now, _sender: _cloudClientId };
          break;
        case 'batches':
          payload = { batches: batches || [], courses: courses || [], updatedAt: now, _sender: _cloudClientId };
          break;
        case 'fees':
          payload = { classFees: classFees || {}, stuFeeOvr: stuFeeOvr || {}, monthFees: monthFees || {}, updatedAt: now, _sender: _cloudClientId };
          break;
        case 'attendance':
          payload = { attData: attData || {}, updatedAt: now, _sender: _cloudClientId };
          break;
        case 'exams':
          payload = { exams: exams || [], updatedAt: now, _sender: _cloudClientId };
          break;
        case 'expenses':
          payload = { expenses: expenses || [], salaries: salaries || [], updatedAt: now, _sender: _cloudClientId };
          break;
      }
      if (payload) {
        return modulesRef.doc(mod).set(payload, { merge: true });
      }
      return Promise.resolve();
    });

    // Update institute meta
    const metaPromise = instDocRef.set({
      tuitionName: localStorage.getItem('tuitionName') || '',
      tuitionMobile: localStorage.getItem('tuitionMobile') || '',
      lastSync: now,
      activeSender: _cloudClientId,
      version: '2.0.0'
    }, { merge: true });

    await Promise.all([...writePromises, metaPromise]);

    // Clear synced modules
    modulesToSync.forEach((m) => _dirtyModules.delete(m));
    updateCloudSyncUI('synced', 'Cloud Synced');
    console.log(`[ClassCore][CloudSync] ✅ Synced ${modulesToSync.length} modules to cloud.`);
  } catch (err) {
    console.warn('[ClassCore][CloudSync] Sync error:', err.message);
    updateCloudSyncUI('offline', 'Offline (Saved on PC)');
  }
}

/**
 * Update the UI pill status in topbar.
 */
function updateCloudSyncUI(status, labelText) {
  _cloudSyncStatus = status;
  const chip = document.getElementById('sync-chip');
  const dot = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');
  if (!chip || !dot || !text) return;

  text.textContent = labelText || 'Cloud Synced';

  if (status === 'synced') {
    chip.style.background = '#ECFDF5';
    chip.style.border = '1px solid #A7F3D0';
    chip.style.color = '#065F46';
    dot.style.background = '#10B981';
  } else if (status === 'syncing') {
    chip.style.background = '#FFFBEB';
    chip.style.border = '1px solid #FDE68A';
    chip.style.color = '#92400E';
    dot.style.background = '#F59E0B';
  } else if (status === 'offline') {
    chip.style.background = '#F3F4F6';
    chip.style.border = '1px solid #E5E7EB';
    chip.style.color = '#6B7280';
    dot.style.background = '#9CA3AF';
  } else {
    chip.style.background = '#FEF2F2';
    chip.style.border = '1px solid #FECACA';
    chip.style.color = '#991B1B';
    dot.style.background = '#EF4444';
  }
}

/**
 * Open the Pair Mobile Modal with QR code and instructions.
 */
async function openPairModal() {
  const syncCode = getInstituteSyncCode();
  const instName = localStorage.getItem('tuitionName') || 'ClassCore Tuition';

  let modal = document.getElementById('modal-pair-mobile');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-pair-mobile';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  // Generate QR code data URL (offline via preload / main process)
  let qrDataUrl = '';
  const pairingPayload = JSON.stringify({
    app: 'ClassCore',
    code: syncCode,
    name: instName
  });

  if (typeof window.classcore !== 'undefined' && window.classcore.generateQR) {
    try {
      const res = await window.classcore.generateQR(pairingPayload);
      if (res && res.ok) qrDataUrl = res.dataUrl;
    } catch (e) {
      console.warn('QR generation error:', e);
    }
  }

  // Fallback to online QR if desktop QR generator is unavailable
  if (!qrDataUrl) {
    qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pairingPayload)}`;
  }

  const apkDownloadUrl = 'https://github.com/prajapatikuldeep455-source/classcore-tuition/releases/latest';

  modal.innerHTML = `
  <div class="modal-box" style="max-width:540px;border-radius:16px;padding:26px">
    <div class="modal-hdr" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:26px">📱</span>
        <div>
          <h3 style="margin:0;font-size:18px;font-weight:800">Mobile Companion App</h3>
          <div style="font-size:12px;color:#6B7280">Manage fees, attendance & students on your phone</div>
        </div>
      </div>
      <button class="x-btn" onclick="document.getElementById('modal-pair-mobile').classList.remove('open')">×</button>
    </div>

    <div style="text-align:center;background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:12px;padding:18px;margin-bottom:18px">
      <div style="font-size:12px;font-weight:700;color:#4B5563;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Your Institute Sync Code</div>
      <div style="display:inline-flex;align-items:center;gap:10px;background:#fff;border:2px dashed #1B3154;border-radius:8px;padding:8px 18px">
        <span style="font-size:22px;font-weight:900;letter-spacing:2px;color:#1B3154;font-family:monospace">${syncCode}</span>
        <button class="btn btn-xs btn-primary" onclick="copySyncCode('${syncCode}')" title="Copy code">📋 Copy</button>
      </div>
      <div style="font-size:11.5px;color:#9CA3AF;margin-top:6px">Type this code in your phone app or scan the QR code below</div>
    </div>

    <div style="display:flex;align-items:center;justify-content:center;margin-bottom:18px">
      <div style="background:#fff;padding:12px;border:1px solid #E5E7EB;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:center">
        <img src="${qrDataUrl}" alt="Pair QR Code" style="width:190px;height:190px;display:block;margin:auto" />
        <div style="font-size:11px;font-weight:600;color:#6B7280;margin-top:6px">Scan with Mobile App Camera</div>
      </div>
    </div>

    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:12px 16px;margin-bottom:18px">
      <div style="font-size:12.5px;font-weight:700;color:#166534;margin-bottom:4px">📥 Download Free Android App (.apk)</div>
      <div style="font-size:11.5px;color:#15803D;line-height:1.4">
        Install the ClassCore Android companion app on your phone to control everything on the go.
      </div>
      <div style="margin-top:10px">
        <button class="btn btn-teal btn-sm" onclick="openApkDownload('${apkDownloadUrl}')">📲 Download ClassCore.apk</button>
      </div>
    </div>

    <div style="display:flex;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="document.getElementById('modal-pair-mobile').classList.remove('open')">Close</button>
    </div>
  </div>`;

  modal.classList.add('open');
}

function copySyncCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    if (typeof toast === 'function') toast('✅ Sync Code copied to clipboard!');
  }).catch(() => {});
}

function openApkDownload(url) {
  if (typeof window.classcore !== 'undefined' && window.classcore.openExternal) {
    window.classcore.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

// Auto-start cloud sync when script loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => initCloudSync(), 800);
});
