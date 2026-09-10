// ══════════════════════════════════════════════════════════════════════
// ClassCore Mobile — Companion Application Engine
// ══════════════════════════════════════════════════════════════════════
'use strict';

const m_clientId = 'mob_' + Math.random().toString(36).substring(2, 9);
let m_db = null;
let m_unsubscribe = null;
let m_syncCode = localStorage.getItem('cc_mobile_sync_code') || '';

// In-Memory Data Store (Cached in localStorage for instant offline access)
let m_students = [];
let m_batches = [];
let m_courses = [];
let m_classFees = {};
let m_stuFeeOvr = {};
let m_monthFees = {};
let m_attData = {};
let m_exams = [];
let m_selectedStudent = null;

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  // Set default date to today
  const today = new Date().toISOString().slice(0, 10);
  const dateInput = document.getElementById('att-date');
  if (dateInput) dateInput.value = today;

  // Load cached data from local storage first (0ms latency offline)
  loadCachedData();

  // Initialize Firebase
  initMobileFirebase();

  // Register Service Worker for offline PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW error:', e));
  }
});

function loadCachedData() {
  try {
    m_students = JSON.parse(localStorage.getItem('m_cache_students') || '[]');
    m_batches = JSON.parse(localStorage.getItem('m_cache_batches') || '[]');
    m_courses = JSON.parse(localStorage.getItem('m_cache_courses') || '[]');
    m_classFees = JSON.parse(localStorage.getItem('m_cache_classFees') || '{}');
    m_stuFeeOvr = JSON.parse(localStorage.getItem('m_cache_stuFeeOvr') || '{}');
    m_monthFees = JSON.parse(localStorage.getItem('m_cache_monthFees') || '{}');
    m_attData = JSON.parse(localStorage.getItem('m_cache_attData') || '{}');
    m_exams = JSON.parse(localStorage.getItem('m_cache_exams') || '[]');
  } catch (e) {
    console.warn('Cache parse error:', e);
  }

  updateDashboardStats();
  populateBatchDropdown();
}

function saveCachedData() {
  try {
    localStorage.setItem('m_cache_students', JSON.stringify(m_students));
    localStorage.setItem('m_cache_batches', JSON.stringify(m_batches));
    localStorage.setItem('m_cache_courses', JSON.stringify(m_courses));
    localStorage.setItem('m_cache_classFees', JSON.stringify(m_classFees));
    localStorage.setItem('m_cache_stuFeeOvr', JSON.stringify(m_stuFeeOvr));
    localStorage.setItem('m_cache_monthFees', JSON.stringify(m_monthFees));
    localStorage.setItem('m_cache_attData', JSON.stringify(m_attData));
    localStorage.setItem('m_cache_exams', JSON.stringify(m_exams));
  } catch (e) {
    console.warn('Cache save error:', e);
  }
}

// ── FIREBASE & CLOUD SYNC ──────────────────────────────────────────────
function initMobileFirebase() {
  try {
    if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      m_db = firebase.firestore();
      console.log('[Mobile] Firestore ready');

      if (m_syncCode) {
        connectFirestoreSync(m_syncCode);
      } else {
        openPairScreen();
      }
    } else {
      showToast('Firebase not loaded — running offline');
    }
  } catch (err) {
    console.error('[Mobile] Firebase init error:', err);
    setSyncPill('offline', 'Offline');
  }
}

function connectFirestoreSync(code) {
  if (!m_db) return;
  if (m_unsubscribe) m_unsubscribe();

  m_syncCode = code.trim().toUpperCase();
  localStorage.setItem('cc_mobile_sync_code', m_syncCode);
  document.getElementById('set-current-code').textContent = m_syncCode;
  setSyncPill('syncing', 'Connecting…');

  try {
    const modulesRef = m_db.collection('institutes').doc(m_syncCode).collection('modules');
    m_unsubscribe = modulesRef.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const modId = change.doc.id;
        const data = change.doc.data();
        if (!data || data._sender === m_clientId) return;

        console.log(`[Mobile] Incoming delta: [${modId}]`);
        applyIncomingDelta(modId, data);
      });

      setSyncPill('synced', 'Synced');
      saveCachedData();
      updateDashboardStats();
      refreshActiveScreen();
    }, (err) => {
      console.warn('[Mobile] Sync warning:', err.message);
      setSyncPill('offline', 'Offline');
    });

    // Also get institute name
    m_db.collection('institutes').doc(m_syncCode).get().then((doc) => {
      if (doc.exists && doc.data()?.tuitionName) {
        document.getElementById('m-inst-name').textContent = doc.data().tuitionName;
      }
    }).catch(() => {});

  } catch (err) {
    console.error('[Mobile] Listener error:', err);
    setSyncPill('offline', 'Offline');
  }
}

function applyIncomingDelta(modId, data) {
  if (modId === 'students' && Array.isArray(data.list)) {
    m_students = data.list;
  } else if (modId === 'batches') {
    if (Array.isArray(data.batches)) m_batches = data.batches;
    if (Array.isArray(data.courses)) m_courses = data.courses;
    populateBatchDropdown();
  } else if (modId === 'fees') {
    if (data.classFees) m_classFees = data.classFees;
    if (data.stuFeeOvr) m_stuFeeOvr = data.stuFeeOvr;
    if (data.monthFees) m_monthFees = data.monthFees;
  } else if (modId === 'attendance' && data.attData) {
    m_attData = data.attData;
  } else if (modId === 'exams' && Array.isArray(data.exams)) {
    m_exams = data.exams;
  }
}

// ── NAVIGATION ──
function navTo(pageName) {
  document.querySelectorAll('.m-page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.m-nav-item').forEach((b) => b.classList.remove('active'));

  const targetPage = document.getElementById(`p-${pageName}`);
  const targetNav = document.querySelector(`.m-nav-item[data-page="${pageName}"]`);

  if (targetPage) targetPage.classList.add('active');
  if (targetNav) targetNav.classList.add('active');

  refreshActiveScreen();
}

function refreshActiveScreen() {
  const activePage = document.querySelector('.m-page.active');
  if (!activePage) return;
  const id = activePage.id;

  if (id === 'p-dashboard') updateDashboardStats();
  else if (id === 'p-attendance') renderAttendanceList();
  else if (id === 'p-fees') renderFeesList();
  else if (id === 'p-students') renderStudentsList();
}

// ── DASHBOARD ──
function updateDashboardStats() {
  // 1. Active students
  const activeStu = m_students.filter((s) => !s.inactive);
  document.getElementById('st-students').textContent = activeStu.length;
  document.getElementById('st-batches').textContent = m_batches.length;

  // 2. Attendance today
  const today = new Date().toISOString().slice(0, 10);
  const todayAtt = m_attData[today] || {};
  let presentCount = 0;
  Object.values(todayAtt).forEach((status) => {
    if (status === 'P') presentCount++;
  });
  document.getElementById('st-present').textContent = presentCount;

  // 3. Today's fee collection
  let todayCollection = 0;
  m_students.forEach((s) => {
    if (Array.isArray(s.history)) {
      s.history.forEach((h) => {
        if (h.date === today) todayCollection += (+h.amount || 0);
      });
    }
  });
  document.getElementById('st-collection').textContent = `₹${todayCollection.toLocaleString('en-IN')}`;
}

// ── ATTENDANCE ──
function populateBatchDropdown() {
  const select = document.getElementById('att-batch-select');
  if (!select) return;
  select.innerHTML = '<option value="all">All Batches</option>';
  m_batches.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.name;
    opt.textContent = `${b.name} (${b.subject || ''})`;
    select.appendChild(opt);
  });
}

function renderAttendanceList() {
  const listEl = document.getElementById('att-students-list');
  const dateVal = document.getElementById('att-date').value || new Date().toISOString().slice(0, 10);
  const batchVal = document.getElementById('att-batch-select').value || 'all';

  const dayAtt = m_attData[dateVal] || {};

  let filtered = m_students.filter((s) => !s.inactive);
  if (batchVal !== 'all') {
    filtered = filtered.filter((s) => s.batch === batchVal);
  }

  document.getElementById('att-count-label').textContent = `${filtered.length} Students`;

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:20px;font-size:13px">No students in this batch.</div>';
    return;
  }

  listEl.innerHTML = filtered.map((s) => {
    const cur = dayAtt[s.id] || 'P';
    return `
    <div class="m-att-row">
      <div class="m-att-info">
        <span class="m-stu-name">${escapeHtml(s.name)}</span>
        <span class="m-stu-sub">Class ${escapeHtml(s.cls || '')} · Roll: ${escapeHtml(s.roll || '—')}</span>
      </div>
      <div class="m-att-toggles">
        <button class="m-toggle-btn ${cur === 'P' ? 'is-p' : ''}" onclick="setStudentAtt('${dateVal}', '${s.id}', 'P')">P</button>
        <button class="m-toggle-btn ${cur === 'A' ? 'is-a' : ''}" onclick="setStudentAtt('${dateVal}', '${s.id}', 'A')">A</button>
        <button class="m-toggle-btn ${cur === 'L' ? 'is-l' : ''}" onclick="setStudentAtt('${dateVal}', '${s.id}', 'L')">L</button>
      </div>
    </div>`;
  }).join('');
}

function setStudentAtt(date, stuId, status) {
  if (!m_attData[date]) m_attData[date] = {};
  m_attData[date][stuId] = status;
  renderAttendanceList();
  saveCachedData();
}

function markAllPresent() {
  const dateVal = document.getElementById('att-date').value;
  const batchVal = document.getElementById('att-batch-select').value;
  if (!m_attData[dateVal]) m_attData[dateVal] = {};

  m_students.filter((s) => !s.inactive).forEach((s) => {
    if (batchVal === 'all' || s.batch === batchVal) {
      m_attData[dateVal][s.id] = 'P';
    }
  });

  renderAttendanceList();
  saveCachedData();
  showToast('Marked all as Present');
}

async function saveAttendance() {
  if (!m_db || !m_syncCode) {
    saveCachedData();
    showToast('Saved locally (Offline)');
    return;
  }

  setSyncPill('syncing', 'Syncing…');
  try {
    await m_db.collection('institutes').doc(m_syncCode).collection('modules').doc('attendance').set({
      attData: m_attData,
      updatedAt: Date.now(),
      _sender: m_clientId
    }, { merge: true });

    saveCachedData();
    setSyncPill('synced', 'Synced');
    showToast('✅ Attendance synced to Desktop!');
  } catch (err) {
    console.error('Save attendance error:', err);
    saveCachedData();
    showToast('Saved offline. Will sync when online.');
  }
}

// ── FEES ──
function renderFeesList() {
  const listEl = document.getElementById('fee-students-list');
  const q = (document.getElementById('fee-search').value || '').toLowerCase().trim();

  let filtered = m_students.filter((s) => !s.inactive);
  if (q) {
    filtered = filtered.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.mobile && s.mobile.includes(q))
    );
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:24px;font-size:13px">No students match search.</div>';
    return;
  }

  listEl.innerHTML = filtered.map((s) => {
    const total = +s.finalFees || +s.totalFees || 0;
    const paid = +s.paid || 0;
    const pending = Math.max(0, total - paid);
    const isPaid = pending === 0;

    return `
    <div class="m-list-card" onclick="openFeeModal('${s.id}')">
      <div>
        <div style="font-size:14.5px;font-weight:700">${escapeHtml(s.name)}</div>
        <div style="font-size:11.5px;color:var(--text-muted)">Class ${escapeHtml(s.cls || '')} · Paid: ₹${paid.toLocaleString('en-IN')}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:900;color:${isPaid ? 'var(--success)' : 'var(--danger)'}">
          ${isPaid ? 'PAID' : '₹' + pending.toLocaleString('en-IN')}
        </div>
        <div style="font-size:10.5px;color:#94A3B8">${isPaid ? 'No Due' : 'Due'}</div>
      </div>
    </div>`;
  }).join('');
}

function openFeeModal(stuId) {
  const s = m_students.find((x) => x.id === stuId);
  if (!s) return;
  m_selectedStudent = s;

  const total = +s.finalFees || +s.totalFees || 0;
  const paid = +s.paid || 0;
  const pending = Math.max(0, total - paid);

  document.getElementById('m-fee-stu-name').textContent = s.name;
  document.getElementById('m-fee-pending').textContent = `₹${pending.toLocaleString('en-IN')}`;
  document.getElementById('m-fee-amount').value = pending > 0 ? pending : '';
  document.getElementById('m-wa-receipt-btn').style.display = 'none';

  document.getElementById('modal-collect-fee').classList.add('open');
}

function closeFeeModal() {
  document.getElementById('modal-collect-fee').classList.remove('open');
}

async function saveFeePayment() {
  if (!m_selectedStudent) return;
  const amt = +(document.getElementById('m-fee-amount').value || 0);
  const mode = document.getElementById('m-fee-mode').value;

  if (amt <= 0) {
    showToast('Please enter a valid amount');
    return;
  }

  const s = m_selectedStudent;
  s.paid = (+s.paid || 0) + amt;
  if (!Array.isArray(s.history)) s.history = [];

  const rec = {
    amount: amt,
    date: new Date().toISOString().slice(0, 10),
    mode: mode,
    note: 'Collected via Mobile App'
  };
  s.history.push(rec);

  saveCachedData();
  renderFeesList();
  updateDashboardStats();

  // Show WhatsApp receipt button
  document.getElementById('m-wa-receipt-btn').style.display = 'block';

  // Push to Firestore
  if (m_db && m_syncCode) {
    setSyncPill('syncing', 'Syncing…');
    try {
      await m_db.collection('institutes').doc(m_syncCode).collection('modules').doc('students').set({
        list: m_students,
        updatedAt: Date.now(),
        _sender: m_clientId
      }, { merge: true });
      setSyncPill('synced', 'Synced');
      showToast(`✅ Collected ₹${amt} from ${s.name}!`);
    } catch (e) {
      console.warn('Fee sync error:', e);
      showToast('Saved offline. Will sync when online.');
    }
  } else {
    showToast(`✅ Collected ₹${amt} (Saved offline)`);
  }
}

function sendWhatsAppReceipt() {
  if (!m_selectedStudent) return;
  const s = m_selectedStudent;
  const mobile = (s.mobile || '').replace(/\D/g, '');
  if (!mobile || mobile.length < 10) {
    showToast('No valid mobile number found for student');
    return;
  }

  const num = mobile.length === 10 ? '91' + mobile : mobile;
  const lastPayment = (s.history && s.history[s.history.length - 1]) || {};
  const inst = document.getElementById('m-inst-name').textContent || 'ClassCore Tuition';

  const text = `Dear Parent,\n\nWe have received fee payment of *₹${lastPayment.amount || ''}* for *${s.name}* (Class ${s.cls || ''}) via ${lastPayment.mode || 'Cash'}.\n\nDate: ${lastPayment.date || ''}\nTotal Paid: ₹${s.paid || ''}\n\nThank you,\n*${inst}*`;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank');
}

// ── STUDENTS DIRECTORY ──
function renderStudentsList() {
  const listEl = document.getElementById('stu-list');
  const q = (document.getElementById('stu-search').value || '').toLowerCase().trim();

  let filtered = m_students.filter((s) => !s.inactive);
  if (q) {
    filtered = filtered.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.cls && s.cls.toLowerCase().includes(q)) ||
      (s.mobile && s.mobile.includes(q))
    );
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:24px;font-size:13px">No students found.</div>';
    return;
  }

  listEl.innerHTML = filtered.map((s) => {
    const rawMobile = (s.mobile || '').replace(/\D/g, '');
    const hasPhone = rawMobile.length >= 10;
    const num = rawMobile.length === 10 ? '91' + rawMobile : rawMobile;

    return `
    <div class="m-list-card" style="align-items:flex-start">
      <div>
        <div style="font-size:15px;font-weight:700">${escapeHtml(s.name)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
          Class ${escapeHtml(s.cls || '')} · ${escapeHtml(s.batch || 'No batch')}
        </div>
        <div style="font-size:11.5px;color:#64748B;margin-top:4px">
          Parent: ${escapeHtml(s.parent || s.parentName || '—')} (${escapeHtml(s.mobile || '—')})
        </div>
      </div>
      <div style="display:flex;gap:8px">
        ${hasPhone ? `<a href="tel:${rawMobile}" class="m-btn m-btn-primary" style="padding:8px 12px;text-decoration:none;font-size:12px">📞</a>` : ''}
        ${hasPhone ? `<a href="https://wa.me/${num}" target="_blank" class="m-btn m-btn-success" style="padding:8px 12px;text-decoration:none;font-size:12px">💬</a>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── PAIRING & STATUS ──
function openPairScreen() {
  document.getElementById('pair-code-input').value = m_syncCode;
  document.getElementById('modal-pair-input').classList.add('open');
}

function closePairScreen() {
  document.getElementById('modal-pair-input').classList.remove('open');
}

function connectSyncCode() {
  const code = (document.getElementById('pair-code-input').value || '').trim().toUpperCase();
  if (!code || !code.startsWith('CC-')) {
    showToast('Enter a valid code starting with CC-');
    return;
  }
  closePairScreen();
  connectFirestoreSync(code);
  showToast(`Connecting to ${code}…`);
}

function setSyncPill(status, label) {
  const dot = document.getElementById('m-sync-dot');
  const text = document.getElementById('m-sync-status');
  if (!dot || !text) return;

  text.textContent = label;
  if (status === 'synced') {
    dot.style.background = '#10B981';
  } else if (status === 'syncing') {
    dot.style.background = '#F59E0B';
  } else {
    dot.style.background = '#EF4444';
  }
}

function showToast(msg) {
  const t = document.getElementById('m-toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 2400);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
