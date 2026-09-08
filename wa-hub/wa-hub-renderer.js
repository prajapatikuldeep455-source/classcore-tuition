// wa-hub-renderer.js — WhatsApp Hub popup window renderer for ClassCore
// ---------- Tab switching ----------

const navItems = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.panel');

navItems.forEach((btn) => {
  btn.addEventListener('click', () => {
    navItems.forEach((b) => b.classList.remove('is-active'));
    panels.forEach((p) => p.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.getElementById(`panel-${btn.dataset.panel}`).classList.add('is-active');
  });
});

// ---------- Connection status ----------

const connDot = document.getElementById('connDot');
const connLabel = document.getElementById('connLabel');
const connSub = document.getElementById('connSub');
const qrBox = document.getElementById('qrBox');
const qrImage = document.getElementById('qrImage');
const qrPlaceholder = document.getElementById('qrPlaceholder');
const connectedBox = document.getElementById('connectedBox');
const connectedNumber = document.getElementById('connectedNumber');

function setStatus(status, info) {
  connDot.classList.remove('is-connected', 'is-off');

  if (status === 'connected') {
    connDot.classList.add('is-connected');
    connLabel.textContent = 'Connected';
    connSub.textContent = info?.number ? info.number.split(':')[0] : '';
    qrBox.hidden = true;
    connectedBox.hidden = false;
    connectedNumber.textContent = info?.number ? `Linked as ${info.number.split(':')[0]}` : '';
  } else if (status === 'qr') {
    connLabel.textContent = 'Scan QR to connect';
    connSub.textContent = '';
    qrBox.hidden = false;
    connectedBox.hidden = true;
  } else if (status === 'reconnecting') {
    connLabel.textContent = 'Reconnecting…';
    connSub.textContent = '';
    qrBox.hidden = false;
    connectedBox.hidden = true;
    qrPlaceholder.hidden = false;
    qrImage.hidden = true;
    qrPlaceholder.textContent = 'Reconnecting…';
  } else if (status === 'logged-out') {
    connDot.classList.add('is-off');
    connLabel.textContent = 'Disconnected';
    connSub.textContent = '';
    qrBox.hidden = false;
    connectedBox.hidden = true;
    qrPlaceholder.hidden = false;
    qrImage.hidden = true;
    qrPlaceholder.textContent = 'Waiting for QR code…';
  }
}

window.waHub.onStatus(({ status, info }) => setStatus(status, info));

window.waHub.onQr((dataUrl) => {
  qrPlaceholder.hidden = true;
  qrImage.hidden = false;
  qrImage.src = dataUrl;
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  window.waHub.logout();
});

document.getElementById('resetConnBtn').addEventListener('click', () => {
  qrPlaceholder.hidden = false;
  qrImage.hidden = true;
  qrPlaceholder.textContent = 'Resetting…';
  window.waHub.logout();
});

// ---------- Activity log ----------

const activityLog = document.getElementById('activityLog');

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function addActivityRow({ text, type, time }) {
  const empty = activityLog.querySelector('.log-empty');
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className = `log-row type-${type}`;
  row.innerHTML = `<span class="log-time">${formatTime(time)}</span><span>${escapeHtml(text)}</span>`;
  activityLog.prepend(row);

  while (activityLog.children.length > 300) {
    activityLog.removeChild(activityLog.lastChild);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.waHub.onLog((entry) => addActivityRow(entry));

// ---------- Bulk send ----------

const sendBtn = document.getElementById('sendBtn');
const messageEl = document.getElementById('messageTemplate');
const sendAtEl = document.getElementById('sendAt');
const progressLog = document.getElementById('progressLog');

// Spreadsheet elements
const spreadsheet = document.getElementById('spreadsheet');
const spreadsheetHead = document.getElementById('spreadsheetHead');
const spreadsheetBody = document.getElementById('spreadsheetBody');
const addRowBtn = document.getElementById('addRowBtn');
const addColBtn = document.getElementById('addColBtn');
const clearGridBtn = document.getElementById('clearGridBtn');

let columnCount = 3; // A, B, C initially

function colLetter(index) {
  // 0=A, 1=B, ... 25=Z
  return String.fromCharCode(65 + index);
}

function getColumnCount() {
  return spreadsheetHead.querySelectorAll('th').length - 1; // minus row-num header
}

function addRow() {
  const cols = getColumnCount();
  const rowCount = spreadsheetBody.rows.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = `<td class="row-num">${rowCount}</td>` +
    Array.from({ length: cols }, (_, i) =>
      `<td contenteditable="true" data-col="${colLetter(i)}" data-placeholder=""></td>`
    ).join('');
  spreadsheetBody.appendChild(tr);
}

function addColumn() {
  const cols = getColumnCount();
  if (cols >= 10) return; // max 10 columns
  const letter = colLetter(cols);
  // Add header
  const th = document.createElement('th');
  th.textContent = letter;
  spreadsheetHead.appendChild(th);
  // Add cell to each existing row
  for (const row of spreadsheetBody.rows) {
    const td = document.createElement('td');
    td.contentEditable = 'true';
    td.dataset.col = letter;
    td.dataset.placeholder = '';
    row.appendChild(td);
  }
}

function clearGrid() {
  // Reset to 3 rows, keep current columns
  const cols = getColumnCount();
  spreadsheetBody.innerHTML = '';
  for (let r = 1; r <= 3; r++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="row-num">${r}</td>` +
      Array.from({ length: cols }, (_, i) =>
        `<td contenteditable="true" data-col="${colLetter(i)}" data-placeholder=""></td>`
      ).join('');
    spreadsheetBody.appendChild(tr);
  }
}

function renumberRows() {
  const rows = spreadsheetBody.querySelectorAll('tr');
  rows.forEach((row, i) => {
    const numCell = row.querySelector('.row-num');
    if (numCell) numCell.textContent = i + 1;
  });
}

/** Collects grid data into an array of {phone, fields} objects */
function collectGridData() {
  const contacts = [];
  for (const row of spreadsheetBody.rows) {
    const cells = row.querySelectorAll('td[data-col]');
    const fields = {};
    let hasData = false;
    cells.forEach((cell, i) => {
      const val = cell.textContent.trim();
      const colName = colLetter(i);
      fields[colName] = val;
      // Also support numeric references
      fields[String(i + 1)] = val;
      if (val) hasData = true;
    });
    if (hasData && fields.A) {
      contacts.push({ phone: fields.A.replace(/[^0-9]/g, ''), fields });
    }
  }
  return contacts;
}

// Handle paste from Excel (tab-separated)
spreadsheetBody.addEventListener('paste', (e) => {
  const clipText = (e.clipboardData || window.clipboardData).getData('text');
  if (!clipText || !clipText.includes('\t')) return; // not a spreadsheet paste
  e.preventDefault();

  const rows = clipText.split(/\r?\n/).filter((r) => r.trim());
  const cols = getColumnCount();

  // Add columns if pasted data has more
  const maxPasteCols = Math.max(...rows.map((r) => r.split('\t').length));
  while (getColumnCount() < maxPasteCols) addColumn();

  // Clear existing data and fill
  spreadsheetBody.innerHTML = '';
  rows.forEach((rowText, ri) => {
    const values = rowText.split('\t');
    const totalCols = getColumnCount();
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="row-num">${ri + 1}</td>` +
      Array.from({ length: totalCols }, (_, ci) =>
        `<td contenteditable="true" data-col="${colLetter(ci)}" data-placeholder="">${escapeHtml(values[ci] || '')}</td>`
      ).join('');
    spreadsheetBody.appendChild(tr);
  });
  // Add 2 extra empty rows at the bottom
  addRow();
  addRow();
});

// Auto-add row when typing in the last row
spreadsheetBody.addEventListener('input', (e) => {
  const rows = spreadsheetBody.querySelectorAll('tr');
  const lastRow = rows[rows.length - 1];
  if (lastRow && lastRow.contains(e.target)) {
    const cells = lastRow.querySelectorAll('td[data-col]');
    const hasContent = Array.from(cells).some((c) => c.textContent.trim());
    if (hasContent) addRow();
  }
});

addRowBtn.addEventListener('click', addRow);
addColBtn.addEventListener('click', addColumn);
clearGridBtn.addEventListener('click', clearGrid);

sendAtEl.addEventListener('change', () => {
  sendBtn.textContent = sendAtEl.value ? 'Schedule' : 'Send now';
});

function addProgressRow(text, type = 'info') {
  const row = document.createElement('div');
  row.className = `log-row type-${type}`;
  row.innerHTML = `<span class="log-time">${formatTime(new Date().toISOString())}</span><span>${escapeHtml(text)}</span>`;
  progressLog.prepend(row);
}

sendBtn.addEventListener('click', async () => {
  const contacts = collectGridData();
  const message = messageEl.value.trim();
  const sendAt = sendAtEl.value;

  if (contacts.length === 0 || !message) {
    addProgressRow('Add at least one number (column A) and a message first.', 'warning');
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = sendAt ? 'Scheduled…' : 'Sending…';
  progressLog.innerHTML = '';

  window.waHub.sendBulk({ contacts, message, sendAt: sendAt || null });
});

window.waHub.onBulkProgress((progress) => {
  if (progress.type === 'sent') {
    addProgressRow(`Sent to ${progress.number}`, 'success');
  } else if (progress.type === 'skipped') {
    addProgressRow(`Skipped ${progress.number} — ${progress.reason}`, 'warning');
  } else if (progress.type === 'failed') {
    addProgressRow(`Failed for ${progress.number} — ${progress.reason}`, 'failed');
  } else if (progress.type === 'status') {
    addProgressRow(progress.text, 'info');
  } else if (progress.type === 'done') {
    addProgressRow(
      `Done — ${progress.sent} sent, ${progress.skipped} skipped, ${progress.failed} failed.`,
      'success'
    );
    sendBtn.disabled = false;
    sendBtn.textContent = sendAtEl.value ? 'Schedule' : 'Send now';
  }
});

// ---------- Auto-reply ----------

const autoReplyEnabled = document.getElementById('autoReplyEnabled');
const autoReplyMessage = document.getElementById('autoReplyMessage');
const saveAutoReplyBtn = document.getElementById('saveAutoReplyBtn');
const autoReplySaved = document.getElementById('autoReplySaved');

const modeSimple = document.getElementById('modeSimple');
const modeAi = document.getElementById('modeAi');
const simpleFields = document.getElementById('simpleFields');
const aiFields = document.getElementById('aiFields');

const aiApiKey = document.getElementById('aiApiKey');
const aiProviderDetected = document.getElementById('aiProviderDetected');
const aiModel = document.getElementById('aiModel');
const aiPersona = document.getElementById('aiPersona');
const aiBusinessInfo = document.getElementById('aiBusinessInfo');
const aiMenuPricing = document.getElementById('aiMenuPricing');
const aiHistoryTurns = document.getElementById('aiHistoryTurns');
const aiMaxPerDay = document.getElementById('aiMaxPerDay');

// Working hours elements
const workingHoursEnabled = document.getElementById('workingHoursEnabled');
const workingHoursStart = document.getElementById('workingHoursStart');
const workingHoursEnd = document.getElementById('workingHoursEnd');
const workingHoursOfflineMsg = document.getElementById('workingHoursOfflineMsg');

const aiPreviewInput = document.getElementById('aiPreviewInput');
const aiPreviewBtn = document.getElementById('aiPreviewBtn');
const aiPreviewBox = document.getElementById('aiPreviewBox');

function updateModeVisibility() {
  const isAi = modeAi.checked;
  simpleFields.style.display = isAi ? 'none' : 'block';
  aiFields.style.display = isAi ? 'block' : 'none';
}

modeSimple.addEventListener('change', updateModeVisibility);
modeAi.addEventListener('change', updateModeVisibility);

// ---------- AI provider auto-detection ----------
// As soon as the user pastes a key, ask the main process (which owns the
// single source-of-truth detection logic in ai-reply.js) what provider it
// looks like, and show it right under the field.
let detectDebounce;
let lastDetectedProvider = null;
async function updateDetectedProvider() {
  const key = aiApiKey.value.trim();
  if (!key) {
    aiProviderDetected.textContent = 'No key entered yet.';
    aiProviderDetected.style.color = '';
    lastDetectedProvider = null;
    return;
  }
  const result = await window.waHub.detectProvider(key);
  if (!result.provider || result.provider === 'unknown') {
    aiProviderDetected.textContent =
      "Key format not recognized. Please enter a valid AI API key.";
    aiProviderDetected.style.color = '#b5460c';
    lastDetectedProvider = null;
  } else {
    aiProviderDetected.textContent = `Detected: ${result.label}${result.defaultModel ? ` — will use "${result.defaultModel}" unless you set a model below` : ''}`;
    aiProviderDetected.style.color = '#1a7d3a';

    // Auto-clear the Model field when the provider changes so that a
    // leftover model name from a different provider (e.g. "claude-sonnet-5"
    // sitting in the field while a Google key is pasted) doesn't cause
    // "model not found" errors.  Only reset if the provider actually changed
    // and the current value looks like it belongs to the OLD provider.
    if (lastDetectedProvider && lastDetectedProvider !== result.provider) {
      const currentModel = aiModel.value.trim().toLowerCase();
      const looksLikeOldProvider =
        (currentModel.includes('claude') && result.provider !== 'anthropic') ||
        (currentModel.includes('gemini') && result.provider !== 'google') ||
        ((currentModel.includes('gpt') || currentModel.includes('o1') || currentModel.includes('o3') || currentModel.includes('o4')) && result.provider !== 'openai');
      if (looksLikeOldProvider) {
        aiModel.value = '';
      }
    }
    lastDetectedProvider = result.provider;
  }
}
aiApiKey.addEventListener('input', () => {
  clearTimeout(detectDebounce);
  detectDebounce = setTimeout(updateDetectedProvider, 200);
});

async function loadAutoReply() {
  const settings = await window.waHub.getAutoReply();
  autoReplyEnabled.checked = !!settings.enabled;
  autoReplyMessage.value = settings.message || '';

  const mode = settings.mode || 'simple';
  modeSimple.checked = mode === 'simple';
  modeAi.checked = mode === 'ai';

  const ai = settings.ai || {};
  aiApiKey.value = ai.apiKey || '';
  aiModel.value = ai.model || '';
  aiPersona.value = ai.persona || '';
  aiBusinessInfo.value = ai.businessInfo || '';
  if (aiMenuPricing) aiMenuPricing.value = ai.menuPricing || '';
  aiHistoryTurns.value = ai.historyTurns ?? 12;
  aiMaxPerDay.value = ai.maxRepliesPerContactPerDay ?? 100;

  const wh = settings.workingHours || {};
  if (workingHoursEnabled) workingHoursEnabled.checked = !!wh.enabled;
  if (workingHoursStart) workingHoursStart.value = wh.startTime || '08:00';
  if (workingHoursEnd) workingHoursEnd.value = wh.endTime || '22:30';
  if (workingHoursOfflineMsg) workingHoursOfflineMsg.value = wh.offlineMessage || '';

  updateModeVisibility();
  updateDetectedProvider();
}

function collectAiSettings() {
  return {
    apiKey: aiApiKey.value.trim(),
    model: aiModel.value,
    persona: aiPersona.value.trim(),
    businessInfo: aiBusinessInfo.value.trim(),
    menuPricing: aiMenuPricing ? aiMenuPricing.value.trim() : '',
    historyTurns: parseInt(aiHistoryTurns.value, 10) || 12,
    maxRepliesPerContactPerDay: parseInt(aiMaxPerDay.value, 10) || 100,
  };
}

saveAutoReplyBtn.addEventListener('click', async () => {
  await window.waHub.saveAutoReply({
    enabled: autoReplyEnabled.checked,
    mode: modeAi.checked ? 'ai' : 'simple',
    message: autoReplyMessage.value.trim(),
    workingHours: {
      enabled: !!workingHoursEnabled?.checked,
      startTime: workingHoursStart?.value || '08:00',
      endTime: workingHoursEnd?.value || '22:30',
      offlineMessage: workingHoursOfflineMsg?.value?.trim() || '',
    },
    ai: collectAiSettings(),
  });
  autoReplySaved.hidden = false;
  setTimeout(() => { autoReplySaved.hidden = true; }, 2000);
});

aiPreviewBtn.addEventListener('click', async () => {
  const sampleText = aiPreviewInput.value.trim();
  if (!sampleText) return;

  aiPreviewBox.hidden = false;
  aiPreviewBox.classList.remove('is-error');
  aiPreviewBox.textContent = 'Thinking…';
  aiPreviewBtn.disabled = true;

  const result = await window.waHub.previewAiReply({ ai: collectAiSettings(), sampleText });

  aiPreviewBtn.disabled = false;
  if (result.ok) {
    aiPreviewBox.textContent = result.replyText;
  } else {
    aiPreviewBox.classList.add('is-error');
    aiPreviewBox.textContent = result.error;
  }
});

loadAutoReply();

// ---------- Orders ----------

const ordersList = document.getElementById('ordersList');
const ordersToolbar = document.querySelector('.orders-toolbar');
let allOrders = [];
let orderFilter = 'all';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const STATUS_CYCLE = ['new', 'confirmed', 'delivered', 'rejected'];
const STATUS_LABELS = {
  new: '⏳ Pending Approval',
  confirmed: '✅ Confirmed',
  delivered: '📦 Delivered',
  rejected: '❌ Rejected',
};

function renderOrders() {
  const filtered = orderFilter === 'all' ? allOrders : allOrders.filter((o) => o.status === orderFilter);
  if (filtered.length === 0) {
    ordersList.innerHTML = '<p class="log-empty">No orders found.</p>';
    return;
  }
  ordersList.innerHTML = filtered.map((order) => `
    <div class="order-card" data-order-id="${order.id}">
      <div class="order-card-header">
        <div>
          <div class="order-customer">${order.customerName ? escapeHtml(order.customerName) : '<span style="color:#b5460c;">👤 Customer (Name pending)</span>'}</div>
          <div class="order-phone">📱 ${escapeHtml(order.phone)}</div>
        </div>
        <span class="order-badge status-${order.status}" data-order-id="${order.id}">
          ${STATUS_LABELS[order.status] || order.status}
        </span>
      </div>
      <div class="order-summary">${escapeHtml(order.summary)}</div>
      ${order.items && order.items.length > 0 ? `
        <div class="order-items">
          ${order.items.map((item) => `<span class="order-item-chip">${escapeHtml(String(item.quantity || ''))} ${escapeHtml(item.name || '')}</span>`).join('')}
        </div>
      ` : ''}
      <div class="order-meta">
        <span>📍 ${order.deliveryLocation ? `<strong>${escapeHtml(order.deliveryLocation)}</strong>` : '<span style="color:#b5460c;">Address: Pending</span>'}</span>
        <span>🕐 ${formatDate(order.timestamp)}</span>
      </div>
      <div class="order-actions">
        ${order.status === 'new' ? `
          <button class="btn-order-confirm" data-action="confirm" data-order-id="${order.id}">✅ Confirm Order${order.deliveryLocation ? ` (${escapeHtml(order.deliveryLocation)})` : ''} (Notify on WA)</button>
          <button class="btn-order-reject" data-action="reject" data-order-id="${order.id}">❌ Reject</button>
          <button class="btn-small btn-small-danger" data-action="delete" data-order-id="${order.id}" style="margin-left:auto;">🗑️ Delete</button>
        ` : order.status === 'confirmed' ? `
          <button class="btn-small" data-action="delivered" data-order-id="${order.id}">Mark Delivered 📦</button>
          <button class="btn-order-reject" data-action="reject" data-order-id="${order.id}">Cancel</button>
          <button class="btn-small btn-small-danger" data-action="delete" data-order-id="${order.id}" style="margin-left:auto;">🗑️ Delete</button>
        ` : order.status === 'delivered' ? `
          <button class="btn-small" data-action="reopen" data-order-id="${order.id}">↺ Move back to Pending</button>
          <button class="btn-small btn-small-danger" data-action="delete" data-order-id="${order.id}" style="margin-left:auto;">🗑️ Delete</button>
        ` : order.status === 'rejected' ? `
          <button class="btn-small" data-action="reopen" data-order-id="${order.id}">↺ Reopen to Pending</button>
          <button class="btn-small btn-small-danger" data-action="delete" data-order-id="${order.id}" style="margin-left:auto;">🗑️ Delete</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Handle action buttons
ordersList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const orderId = btn.dataset.orderId;
  const order = allOrders.find((o) => o.id === orderId);
  if (!order) return;

  if (action === 'delete') {
    if (confirm('Are you sure you want to delete this order?')) {
      await window.waHub.deleteOrder(orderId);
      allOrders = allOrders.filter((o) => o.id !== orderId);
      renderOrders();
    }
    return;
  }

  btn.disabled = true;

  try {
    if (action === 'confirm') {
      btn.textContent = 'Sending WhatsApp…';
      await window.waHub.confirmOrder(orderId);
      order.status = 'confirmed';
    } else if (action === 'reject') {
      btn.textContent = 'Rejecting…';
      await window.waHub.rejectOrder(orderId);
      order.status = 'rejected';
    } else if (action === 'delivered') {
      await window.waHub.updateOrderStatus(orderId, 'delivered');
      order.status = 'delivered';
    } else if (action === 'reopen') {
      await window.waHub.updateOrderStatus(orderId, 'new');
      order.status = 'new';
    }
  } catch (err) {
    alert(`Action failed: ${err.message}`);
  }
  renderOrders();
});

// Filter buttons
if (ordersToolbar) {
  ordersToolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-small');
    if (!btn || !btn.dataset.filter) return;
    ordersToolbar.querySelectorAll('.btn-small').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    orderFilter = btn.dataset.filter;
    renderOrders();
  });
}

// Live updates
function playOrderChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // First tone (D5 = 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second tone (A5 = 880 Hz) — cheerful alert
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch {
    // Autoplay restrictions or unavailable audio device
  }
}

window.waHub.onOrderSummary((order) => {
  // Play order alert chime
  playOrderChime();

  // Add to top or update existing
  const idx = allOrders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    allOrders[idx] = { ...allOrders[idx], ...order, status: allOrders[idx].status || order.status };
  } else {
    allOrders.unshift(order);
  }
  renderOrders();
});

// CSV Export
const exportOrdersBtn = document.getElementById('exportOrdersBtn');
function exportOrdersToCsv() {
  if (!allOrders || allOrders.length === 0) {
    alert('No orders to export!');
    return;
  }

  const headers = ['Order ID', 'Date & Time', 'Customer Name', 'Phone', 'Items', 'Delivery Location', 'Status', 'Summary', 'Special Instructions'];

  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = allOrders.map((o) => {
    const itemsStr = (o.items || []).map((i) => `${i.quantity || ''} ${i.name || ''}`.trim()).join('; ');
    return [
      escapeCsv(o.id),
      escapeCsv(o.timestamp),
      escapeCsv(o.customerName || ''),
      escapeCsv(o.phone || ''),
      escapeCsv(itemsStr),
      escapeCsv(o.deliveryLocation || ''),
      escapeCsv(o.status || ''),
      escapeCsv(o.summary || ''),
      escapeCsv(o.specialInstructions || ''),
    ].join(',');
  });

  // UTF-8 BOM (\uFEFF) ensures Excel opens Hindi / Gujarati / special characters properly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  a.download = `orders_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

if (exportOrdersBtn) {
  exportOrdersBtn.addEventListener('click', exportOrdersToCsv);
}

// Load existing orders on startup
async function loadOrders() {
  try {
    allOrders = await window.waHub.getOrders();
    renderOrders();
  } catch {
    // ignore — orders tab just stays empty
  }
}
loadOrders();

// ---------- Owner Permission Alerts ----------

const permissionAlertsContainer = document.getElementById('permissionAlertsContainer');
const permissionAlertsList = document.getElementById('permissionAlertsList');
const permissionAlertsCount = document.getElementById('permissionAlertsCount');
const navAlertBadge = document.getElementById('navAlertBadge');
let allAlerts = [];

function renderAlerts() {
  if (!permissionAlertsContainer || !permissionAlertsList) return;

  const count = allAlerts.length;
  if (permissionAlertsCount) permissionAlertsCount.textContent = count;

  if (navAlertBadge) {
    if (count > 0) {
      navAlertBadge.hidden = false;
      navAlertBadge.textContent = count;
    } else {
      navAlertBadge.hidden = true;
    }
  }

  if (count === 0) {
    permissionAlertsContainer.hidden = true;
    permissionAlertsList.innerHTML = '';
    return;
  }

  permissionAlertsContainer.hidden = false;
  permissionAlertsList.innerHTML = allAlerts.map((alert) => `
    <div class="permission-alert-card" data-alert-id="${escapeHtml(alert.id)}">
      <div class="alert-top">
        <div class="alert-contact">
          <span>👤 ${escapeHtml(alert.customerName || 'Customer')}</span>
          <span style="color:var(--text-muted); font-weight:normal; margin-left:6px;">(${escapeHtml(alert.phone)})</span>
        </div>
        <span class="alert-reason">${escapeHtml(alert.reason || 'Permission Needed')}</span>
      </div>
      <div class="alert-customer-msg">"${escapeHtml(alert.customerMessage || '')}"</div>
      <div class="alert-action-row">
        <input type="text" class="alert-reply-input" placeholder="Aapka seedha reply (e.g. Haan hum 10% discount de denge)..." />
        <button class="btn-alert-send" data-alert-id="${escapeHtml(alert.id)}" data-jid="${escapeHtml(alert.jid)}">Send Reply</button>
        <button class="btn-alert-dismiss" data-alert-id="${escapeHtml(alert.id)}">Dismiss</button>
      </div>
    </div>
  `).join('');
}

if (permissionAlertsList) {
  permissionAlertsList.addEventListener('click', async (e) => {
    const sendBtn = e.target.closest('.btn-alert-send');
    const dismissBtn = e.target.closest('.btn-alert-dismiss');

    if (sendBtn) {
      const card = sendBtn.closest('.permission-alert-card');
      const input = card ? card.querySelector('.alert-reply-input') : null;
      const text = input ? input.value.trim() : '';

      if (!text) {
        input?.focus();
        input?.style.setProperty('border-color', 'var(--error)');
        return;
      }

      const alertId = sendBtn.dataset.alertId;
      const jid = sendBtn.dataset.jid;

      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';

      try {
        const res = await window.waHub.replyToAlert({ jid, text, alertId });
        if (res.ok) {
          allAlerts = allAlerts.filter((a) => a.id !== alertId);
          renderAlerts();
        } else {
          alert(`Reply failed: ${res.error || 'Unknown error'}`);
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send Reply';
        }
      } catch (err) {
        alert(`Error: ${err.message}`);
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Reply';
      }
      return;
    }

    if (dismissBtn) {
      const alertId = dismissBtn.dataset.alertId;
      dismissBtn.disabled = true;
      try {
        await window.waHub.dismissAlert(alertId);
        allAlerts = allAlerts.filter((a) => a.id !== alertId);
        renderAlerts();
      } catch (err) {
        alert(`Failed to dismiss: ${err.message}`);
        dismissBtn.disabled = false;
      }
    }
  });
}

// Listen for incoming alerts
window.waHub.onAlerts?.((alerts) => {
  // Can be full replacement or append
  allAlerts = alerts;
  renderAlerts();
});

// Load existing alerts on startup
async function loadAlerts() {
  try {
    if (window.waHub.getAlerts) {
      allAlerts = await window.waHub.getAlerts();
      renderAlerts();
    }
  } catch {
    // ignore
  }
}
loadAlerts();
