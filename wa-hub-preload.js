// wa-hub-preload.js — Preload bridge for WhatsApp Hub popup window
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('waHub', {
  // Event listeners (Main → Renderer push)
  onQr: (cb) => ipcRenderer.on('wa:qr', (_e, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('wa:status', (_e, data) => cb(data)),
  onLog: (cb) => ipcRenderer.on('wa:log', (_e, data) => cb(data)),
  onBulkProgress: (cb) => ipcRenderer.on('wa:bulk-progress', (_e, data) => cb(data)),
  onOrderSummary: (cb) => ipcRenderer.on('wa:order-summary', (_e, data) => cb(data)),
  onOwnerAlert: (cb) => ipcRenderer.on('wa:owner-alert', (_e, data) => cb(data)),

  // Connection
  logout: () => ipcRenderer.invoke('wa:logout'),

  // Bulk sending
  sendBulk: (payload) => ipcRenderer.invoke('wa:send-bulk', payload),

  // Auto-reply / Smart Reply
  getAutoReply: () => ipcRenderer.invoke('wa:get-auto-reply'),
  saveAutoReply: (settings) => ipcRenderer.invoke('wa:save-auto-reply', settings),
  detectProvider: (apiKey) => ipcRenderer.invoke('wa:detect-provider', { apiKey }),
  previewAiReply: (payload) => ipcRenderer.invoke('wa:preview-ai-reply', payload),

  // Orders / Order Desk
  getOrders: () => ipcRenderer.invoke('wa:get-orders'),
  updateOrderStatus: (orderId, status) => ipcRenderer.invoke('wa:update-order-status', { orderId, status }),
  confirmOrder: (orderId) => ipcRenderer.invoke('wa:confirm-order', { orderId }),
  rejectOrder: (orderId, reason) => ipcRenderer.invoke('wa:reject-order', { orderId, reason }),
  deleteOrder: (orderId) => ipcRenderer.invoke('wa:delete-order', { orderId }),

  // Alerts / Action Required
  getAlerts: () => ipcRenderer.invoke('wa:get-alerts'),
  dismissAlert: (alertId) => ipcRenderer.invoke('wa:dismiss-alert', { alertId }),
  replyToAlert: (payload) => ipcRenderer.invoke('wa:reply-to-alert', payload),
});
