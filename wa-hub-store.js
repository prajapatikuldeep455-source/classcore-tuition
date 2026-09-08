// wa-hub-store.js — WhatsApp Hub persistence layer for ClassCore
// Tiny JSON-file settings store.
// Keeps things like the auto-reply message on disk so they survive app restarts.
//
// NOTE ON THE API KEY: if you turn on AI auto-reply, your AI API key (Anthropic,
// Google Gemini, or OpenAI — auto-detected from the key's format, see
// wa-hub-ai.js) is saved in this same plaintext settings.json file (in the
// app's local data folder). That's normal for a desktop app like this one,
// but it does mean anyone with access to this computer/user account could
// read it from disk.

const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

function settingsPath() {
  return path.join(app.getPath('userData'), 'wa_hub_settings.json');
}

function historyPath() {
  return path.join(app.getPath('userData'), 'wa_hub_chat_history.json');
}

function encryptApiKey(key) {
  if (!key) return '';
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    try {
      return 'enc:' + safeStorage.encryptString(key).toString('base64');
    } catch {
      return key;
    }
  }
  return key;
}

function decryptApiKey(val) {
  if (!val) return '';
  if (typeof val === 'string' && val.startsWith('enc:')) {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      try {
        const buf = Buffer.from(val.slice(4), 'base64');
        return safeStorage.decryptString(buf);
      } catch {
        return '';
      }
    }
  }
  return val;
}

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeAll(data) {
  fs.writeFileSync(settingsPath(), JSON.stringify(data, null, 2));
}

const DEFAULT_WORKING_HOURS = {
  enabled: false,
  startTime: '08:00',
  endTime: '22:00',
  offlineMessage: 'Thank you for your message. We are currently closed and will respond during business hours.',
};

const DEFAULT_AUTO_REPLY = {
  enabled: false,
  mode: 'simple', // 'simple' | 'ai'
  message: '', // used when mode === 'simple'
  workingHours: DEFAULT_WORKING_HOURS,
  ai: {
    apiKey: '',
    model: '', // blank = auto
    persona: '',
    businessInfo: '',
    menuPricing: '', // Rate list / Menu card
    historyTurns: 12,
    maxRepliesPerContactPerDay: 100,
  },
};

function getAutoReply() {
  const all = readAll();
  const saved = all.autoReply || {};
  const res = {
    ...DEFAULT_AUTO_REPLY,
    ...saved,
    workingHours: {
      ...DEFAULT_WORKING_HOURS,
      ...(saved.workingHours || {}),
    },
    ai: {
      ...DEFAULT_AUTO_REPLY.ai,
      ...(saved.ai || {}),
    },
  };
  res.ai.apiKey = decryptApiKey(res.ai.apiKey);
  return res;
}

function saveAutoReply(settings) {
  const all = readAll();
  const toSave = JSON.parse(JSON.stringify(settings));
  if (toSave.ai && toSave.ai.apiKey) {
    toSave.ai.apiKey = encryptApiKey(toSave.ai.apiKey);
  }
  all.autoReply = toSave;
  writeAll(all);
}

function getOrders() {
  const all = readAll();
  return all.orders || [];
}

function saveOrder(order) {
  const all = readAll();
  if (!all.orders) all.orders = [];
  // Check if order with same id exists, update it; otherwise push new
  const idx = all.orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    all.orders[idx] = { ...all.orders[idx], ...order, status: all.orders[idx].status || order.status };
    const existing = all.orders[idx];
    all.orders[idx] = {
      ...existing,
      ...order,
      customerName: order.customerName || existing.customerName || '',
      deliveryLocation: order.deliveryLocation || existing.deliveryLocation || '',
      // Only preserve confirmed/rejected if owner explicitly acted on it; otherwise stay 'new'
      status: (existing.status === 'confirmed' || existing.status === 'rejected') ? existing.status : (order.status || 'new'),
    };
  } else {
    all.orders.unshift(order); // newest first
  }
  // Keep max 500 orders
  if (all.orders.length > 500) all.orders = all.orders.slice(0, 500);
  writeAll(all);
}

function updateOrderStatus(orderId, status) {
  const all = readAll();
  if (!all.orders) return null;
  const order = all.orders.find((o) => o.id === orderId);
  if (order) {
    order.status = status;
    writeAll(all);
  }
  return order;
}

function deleteOrder(orderId) {
  const all = readAll();
  if (!all.orders) return false;
  const initLen = all.orders.length;
  all.orders = all.orders.filter((o) => o.id !== orderId);
  if (all.orders.length !== initLen) {
    writeAll(all);
    return true;
  }
  return false;
}

function getChatHistory() {
  try {
    return JSON.parse(fs.readFileSync(historyPath(), 'utf-8'));
  } catch {
    return {};
  }
}

function saveChatHistory(historyMap) {
  try {
    fs.writeFileSync(historyPath(), JSON.stringify(historyMap, null, 2));
  } catch (err) {
    console.error('Failed to save chat history:', err);
  }
}

function getAlerts() {
  const all = readAll();
  return all.alerts || [];
}

function saveAlert(alert) {
  const all = readAll();
  if (!all.alerts) all.alerts = [];
  all.alerts.unshift(alert);
  if (all.alerts.length > 200) all.alerts = all.alerts.slice(0, 200);
  writeAll(all);
}

function dismissAlert(alertId) {
  const all = readAll();
  if (!all.alerts) return false;
  const initLen = all.alerts.length;
  all.alerts = all.alerts.filter((a) => a.id !== alertId);
  if (all.alerts.length !== initLen) {
    writeAll(all);
    return true;
  }
  return false;
}

module.exports = {
  getAutoReply,
  saveAutoReply,
  DEFAULT_AUTO_REPLY,
  getOrders,
  saveOrder,
  updateOrderStatus,
  deleteOrder,
  getAlerts,
  saveAlert,
  dismissAlert,
  getChatHistory,
  saveChatHistory,
};
