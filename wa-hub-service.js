// wa-hub-service.js — WhatsApp connection engine for ClassCore WhatsApp Hub
// Wraps Baileys (the unofficial WhatsApp Web library) so main.js doesn't need
// to know any WhatsApp-specific details.
//
// Baileys ships as an ESM-only package, so it's loaded with a dynamic import()
// even though this whole app is otherwise CommonJS. That works on every
// Electron/Node version, unlike require().

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const QRCode = require('qrcode');
const Store = require('./wa-hub-store');
const { generateReply, extractOrderFromConversation } = require('./wa-hub-ai');

const AUTH_FOLDER = () => path.join(app.getPath('userData'), 'auth_info_baileys');

// Per-contact cooldown for SIMPLE mode only (one fixed message, so once per
// hour is plenty — no point resending the same line over and over).
const SIMPLE_REPLY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// AI mode replies to every incoming message (that's the point — a real
// back-and-forth), so instead of an hourly cooldown it gets a few narrower
// safety brakes:
// - a short minimum gap, mostly to absorb duplicate delivery events from
//   WhatsApp rather than to throttle real conversation
const AI_MIN_GAP_MS = 1500;
// - a flood/loop guard: if a contact (or another bot) sends a burst of
//   messages, pause AI replies to them for a while instead of matching pace
const AI_FLOOD_WINDOW_MS = 60 * 1000;
const AI_FLOOD_MAX_MESSAGES = 8;
const AI_FLOOD_PAUSE_MS = 10 * 60 * 1000;

// Randomized delay between bulk messages. This is a deliberate safety brake:
// sending a burst of identical messages with no delay is exactly the pattern
// WhatsApp's spam detection looks for on unofficial connections.
const MIN_DELAY_MS = 4000;
const MAX_DELAY_MS = 9000;

function randomDelay() {
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

class WaHubService {
  constructor({ onQr, onStatus, onLog, onOrderSummary, onOwnerAlert }) {
    this.onQr = onQr;
    this.onStatus = onStatus;
    this.onLog = onLog;
    this.onOrderSummary = onOrderSummary;
    this.onOwnerAlert = onOwnerAlert;
    this.sock = null;
    this.autoReply = Store.getAutoReply();
    this.connecting = false;
    this.reconnectAttempts = 0;
    // Tracks whether THIS run has ever reached a fully open connection.
    // Used to tell apart "a real logout" (was connected, then logged out —
    // stop and wait for the user) from "stale/corrupt saved session from a
    // previous run" (never got connected, closes as loggedOut immediately —
    // safe to auto-clear and retry instead of dead-ending on a blank screen).
    this.everConnectedThisRun = false;

    // Simple-mode cooldown tracking
    this.lastSimpleReplyBySender = new Map();

    // AI-mode state, all keyed by jid
    this.aiHistoryByJid = new Map(); // jid -> [{role, content}]
    this.lastAiReplyTsByJid = new Map();
    this.incomingTimestampsByJid = new Map(); // jid -> number[] (for flood guard)
    this.pausedUntilByJid = new Map();
    this.aiRepliesTodayByJid = new Map(); // jid -> { day, count }

    // Message batching / debounce so rapid consecutive messages get 1 combined reply
    this.pendingMessagesByJid = new Map();
    this.batchTimerByJid = new Map();

    // Offline message debounce (max once per 6 hours per contact)
    this.lastOfflineReplyByJid = new Map();

    // Customer display name tracking from WhatsApp
    this.pushNameByJid = new Map();

    // Load persisted chat history from disk so memory survives app restarts
    const savedHistory = Store.getChatHistory();
    for (const [savedJid, turns] of Object.entries(savedHistory)) {
      this.aiHistoryByJid.set(savedJid, turns);
    }
  }

  log(text, type = 'info') {
    this.onLog?.({ text, type, time: new Date().toISOString() });
  }

  async connect() {
    if (this.connecting) return;
    this.connecting = true;

    try {
      const baileys = await import('@whiskeysockets/baileys');
      const makeWASocket = baileys.default;
      const { useMultiFileAuthState, DisconnectReason } = baileys;

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER());

      const sock = makeWASocket({
        auth: state,
        browser: ['ClassCore', 'Chrome', '1.0.0'],
        syncFullHistory: false,
      });

      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);
      this.registerMessageHandler(sock);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const dataUrl = await QRCode.toDataURL(qr);
            this.onQr?.(dataUrl);
            this.onStatus?.('qr');
          } catch (err) {
            this.log(`Couldn't render QR code: ${err.message}`, 'error');
          }
        }

        if (connection === 'open') {
          this.connecting = false;
          this.everConnectedThisRun = true;
          this.reconnectAttempts = 0;
          this.onStatus?.('connected', { number: sock.user?.id || '' });
          this.log('Connected to WhatsApp.', 'success');
        }

        if (connection === 'close') {
          this.connecting = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const errMsg = lastDisconnect?.error?.message || 'no details given';
          const loggedOut = statusCode === DisconnectReason.loggedOut;

          // Always log the real reason — this is what actually tells you
          // (or me) what's going wrong instead of guessing.
          this.log(`Connection closed (status ${statusCode ?? 'unknown'}): ${errMsg}`, 'warning');

          if (loggedOut && this.everConnectedThisRun) {
            this.onStatus?.('disconnected');
            this.log('Logged out from WhatsApp. Scan a new QR code to reconnect.', 'warning');
            return;
          }

          if (loggedOut && !this.everConnectedThisRun) {
            this.log('Saved session was rejected by WhatsApp. Resetting session folder for a clean start…', 'warning');
            try {
              fs.rmSync(AUTH_FOLDER(), { recursive: true, force: true });
            } catch {}
            this.onStatus?.('reconnecting');
            await sleep(1500);
            this.connect();
            return;
          }

          this.onStatus?.('reconnecting');
          const delay = Math.min(30000, 1500 * Math.pow(1.5, this.reconnectAttempts || 0));
          this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
          this.log(`Connection dropped, reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})...`, 'warning');
          await sleep(delay);
          this.connect();
        }
      });
    } catch (err) {
      this.connecting = false;
      this.log(`Couldn't start the WhatsApp connection: ${err.message}`, 'error');
      // Surface then retry with backoff in case of transient network hiccups
      this.onStatus?.('reconnecting');
      const delay = Math.min(30000, 2000 * Math.pow(1.5, this.reconnectAttempts || 0));
      this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
      await sleep(delay);
      this.connect();
    }
  }

  registerMessageHandler(sock) {
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        if (!msg.key.remoteJid || msg.key.remoteJid.endsWith('@g.us')) continue; // skip groups
        if (msg.key.remoteJid === 'status@broadcast') continue;

        if (msg.pushName) {
          this.pushNameByJid.set(msg.key.remoteJid, msg.pushName);
        }

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          '';

        if (!text.trim()) continue;

        this.log(`Incoming from ${msg.key.remoteJid}: ${text.slice(0, 80)}`, 'incoming');

        this.queueIncomingMessage(msg.key.remoteJid, text);
      }
    });
  }

  isWithinWorkingHours() {
    const wh = this.autoReply?.workingHours;
    if (!wh || !wh.enabled) return true;
    const now = new Date();
    const cur = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const start = wh.startTime || '08:00';
    const end = wh.endTime || '22:00';
    if (start <= end) {
      return cur >= start && cur <= end;
    }
    // spans overnight
    return cur >= start || cur <= end;
  }

  queueIncomingMessage(jid, text) {
    if (!this.autoReply?.enabled) return;

    // Working hours anti-ban check
    if (!this.isWithinWorkingHours()) {
      const lastOffline = this.lastOfflineReplyByJid.get(jid) || 0;
      // Send offline notification at most once every 6 hours per contact
      if (Date.now() - lastOffline > 6 * 60 * 60 * 1000) {
        this.lastOfflineReplyByJid.set(jid, Date.now());
        const offlineMsg =
          this.autoReply.workingHours?.offlineMessage ||
          'Thank you for your message. We are currently closed and will respond during business hours.';
        this.sock?.sendMessage(jid, { text: offlineMsg }).catch(() => {});
        this.log(`Outside working hours: sent offline notice to ${jid}`, 'info');
      }
      return;
    }

    if (this.autoReply.mode !== 'ai') {
      this.maybeSimpleReply(jid);
      return;
    }

    // Immediately trigger typing indicator so sender sees "typing..." right away
    try {
      this.sock?.sendPresenceUpdate('composing', jid).catch(() => {});
    } catch {}

    const pending = this.pendingMessagesByJid.get(jid) || [];
    pending.push(text.trim());
    this.pendingMessagesByJid.set(jid, pending);

    // If another message arrives while user is still typing, reset the debounce timer
    if (this.batchTimerByJid.has(jid)) {
      clearTimeout(this.batchTimerByJid.get(jid));
    }

    // Wait 2.5 seconds for user to finish their train of thought/sentences
    const timer = setTimeout(async () => {
      this.batchTimerByJid.delete(jid);
      const messages = this.pendingMessagesByJid.get(jid) || [];
      this.pendingMessagesByJid.delete(jid);
      if (messages.length === 0) return;

      // Combine multiple consecutive lines into one single message turn
      const combinedText = messages.join('\n');
      await this.maybeAiReply(jid, combinedText);
    }, 2500);

    this.batchTimerByJid.set(jid, timer);
  }

  async maybeSimpleReply(jid) {
    if (!this.autoReply?.message) return;

    const last = this.lastSimpleReplyBySender.get(jid) || 0;
    if (Date.now() - last < SIMPLE_REPLY_COOLDOWN_MS) return;

    try {
      await this.sock.sendMessage(jid, { text: this.autoReply.message });
      this.lastSimpleReplyBySender.set(jid, Date.now());
      this.log(`Auto-replied to ${jid}`, 'success');
    } catch (err) {
      this.log(`Auto-reply failed for ${jid}: ${err.message}`, 'error');
    }
  }

  async maybeAiReply(jid, incomingText) {
    const ai = this.autoReply.ai || {};
    if (!incomingText || !incomingText.trim()) return;

    if (!ai.apiKey || !ai.apiKey.trim()) {
      this.log('AI auto-reply is on but no AI API key is set — skipping reply.', 'warning');
      return;
    }

    const now = Date.now();

    // Flood / loop guard
    if ((this.pausedUntilByJid.get(jid) || 0) > now) return;

    const stamps = (this.incomingTimestampsByJid.get(jid) || []).filter((t) => now - t < AI_FLOOD_WINDOW_MS);
    stamps.push(now);
    this.incomingTimestampsByJid.set(jid, stamps);
    if (stamps.length > AI_FLOOD_MAX_MESSAGES) {
      this.pausedUntilByJid.set(jid, now + AI_FLOOD_PAUSE_MS);
      this.log(`Too many messages from ${jid} in a short time — pausing AI auto-reply to them for 10 min.`, 'warning');
      return;
    }

    // Minimum gap (mostly absorbs duplicate delivery events)
    const lastReplyTs = this.lastAiReplyTsByJid.get(jid) || 0;
    if (now - lastReplyTs < AI_MIN_GAP_MS) return;

    // Lock this contact BEFORE the async AI call so a second message arriving
    // while the first is still generating doesn't spawn a duplicate request.
    this.lastAiReplyTsByJid.set(jid, now);

    // Daily cap per contact
    const cap = ai.maxRepliesPerContactPerDay || 100;
    const today = todayKey();
    const counter = this.aiRepliesTodayByJid.get(jid);
    if (counter && counter.day === today && counter.count >= cap) {
      this.log(`Daily AI reply cap reached for ${jid} (${cap}) — skipping until tomorrow.`, 'warning');
      return;
    }

    // Start typing indicator immediately so customer sees "typing..." on WhatsApp right away
    try {
      this.sock.sendPresenceUpdate('composing', jid).catch(() => {});
    } catch {}

    const history = this.aiHistoryByJid.get(jid) || [];

    const startTime = Date.now();
    let replyText;
    let ownerAlert = null;
    try {
      const res = await generateReply({
        apiKey: ai.apiKey,
        model: ai.model,
        persona: ai.persona,
        businessInfo: ai.businessInfo,
        menuPricing: ai.menuPricing,
        history,
        incomingText,
      });
      replyText = typeof res === 'string' ? res : res.text;
      ownerAlert = res?.ownerAlert || null;
    } catch (err) {
      this.sock.sendPresenceUpdate('paused', jid).catch(() => {});
      this.log(`AI reply failed for ${jid}: ${err.message}`, 'error');
      return;
    }

    // Trigger owner alert if permission is needed
    if (ownerAlert) {
      const phone = jid.replace('@s.whatsapp.net', '');
      const alertObj = {
        id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        jid,
        phone,
        customerName: this.pushNameByJid.get(jid) || '',
        reason: ownerAlert,
        customerMessage: incomingText,
        timestamp: new Date().toISOString(),
        status: 'pending',
      };
      this.onOwnerAlert?.(alertObj);
      this.log(`⚡ Owner permission requested by ${phone}: ${ownerAlert}`, 'warning');
    }

    // The AI generation already took time (~0.8s-1.5s) while "typing..." was showing.
    // Keep only a tiny human pause (max 300ms) instead of the old 4.5s delay!
    const elapsed = Date.now() - startTime;
    if (elapsed < 300) {
      await sleep(300 - elapsed);
    }

    try {
      await this.sock.sendMessage(jid, { text: replyText });
      this.log(`AI auto-replied to ${jid}`, 'success');
    } catch (err) {
      this.log(`Sending AI reply to ${jid} failed: ${err.message}`, 'error');
      return;
    } finally {
      this.sock.sendPresenceUpdate('paused', jid).catch(() => {});
    }

    // Update timestamp again after completion for accurate cooldown tracking
    this.lastAiReplyTsByJid.set(jid, Date.now());

    if (counter && counter.day === today) {
      counter.count += 1;
    } else {
      this.aiRepliesTodayByJid.set(jid, { day: today, count: 1 });
    }

    const historyTurns = Math.max(2, ai.historyTurns || 12);
    const updatedHistory = [...history, { role: 'user', content: incomingText }, { role: 'assistant', content: replyText }];
    this.aiHistoryByJid.set(jid, updatedHistory.slice(-historyTurns));
    this.persistChatHistory();

    // Check if the conversation contains an order
    this.maybeExtractOrder(jid, updatedHistory).catch(() => {});
  }

  persistChatHistory() {
    const obj = {};
    for (const [k, v] of this.aiHistoryByJid.entries()) {
      obj[k] = v;
    }
    Store.saveChatHistory(obj);
  }

  async maybeExtractOrder(jid, history) {
    if (!this.onOrderSummary) return;
    const ai = this.autoReply.ai || {};
    if (!ai.apiKey || !ai.apiKey.trim()) return;

    // Check if conversation has at least 2 turns (customer + business)
    if (!history || history.length < 2) return;

    // Keyword check to avoid unnecessary API calls when someone just says hello
    const fullText = history.map((h) => h.content).join(' ').toLowerCase();
    const orderKeywords = [
      'order', 'book', 'need', 'want', 'buy', 'plate', 'theli', 'packet', 'kg',
      'piece', 'deliver', 'delivery', 'chahiye', 'mangta', 'bhej', 'dena', 'kitne',
      'quantity', 'price', 'rate', 'bhejo', 'pakodi', 'saree', 'address', 'market'
    ];
    const hasOrderIntent = orderKeywords.some((kw) => fullText.includes(kw));
    if (!hasOrderIntent) return;

    // Throttle: don't re-extract within 15 seconds for the same contact
    const now = Date.now();
    const lastExtract = this._lastOrderExtractByJid?.get(jid) || 0;
    if (now - lastExtract < 15 * 1000) return;
    if (!this._lastOrderExtractByJid) this._lastOrderExtractByJid = new Map();
    this._lastOrderExtractByJid.set(jid, now);

    try {
      const conversationText = history
        .map((h) => (h.role === 'user' ? 'Customer' : 'Business') + ': ' + h.content)
        .join('\n');

      const parsed = await extractOrderFromConversation({
        apiKey: ai.apiKey,
        model: ai.model,
        conversationText,
      });

      if (!parsed || !parsed.hasOrder) return;

      const ordersList = Array.isArray(parsed.orders) && parsed.orders.length > 0
        ? parsed.orders
        : [parsed];

      const phone = jid.split('@')[0];
      const pushName = this.pushNameByJid.get(jid) || '';

      for (let i = 0; i < ordersList.length; i++) {
        const item = ordersList[i];
        // Generate clean location-based unique suffix so multiple locations don't overwrite each other
        const locClean = (item.deliveryLocation || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 15);
        const suffix = locClean ? `_${locClean}` : (ordersList.length > 1 ? `_${i + 1}` : '');
        const orderId = `order_${phone}${suffix}`;

        const order = {
          id: orderId,
          subIndex: i + 1,
          jid,
          phone,
          timestamp: new Date().toISOString(),
          summary: item.summary || '',
          items: item.items || [],
          deliveryLocation: item.deliveryLocation || '',
          customerName: item.customerName || pushName || '',
          specialInstructions: item.specialInstructions || '',
          status: 'new',
        };

        this.onOrderSummary(order);
        this.log(`Order captured for ${phone} [${order.deliveryLocation || 'General'}]: ${order.summary}`, 'success');
      }
    } catch (err) {
      this.log(`Order extraction failed: ${err.message}`, 'warning');
    }
  }

  updateAutoReplySettings(settings) {
    this.autoReply = settings;
  }

  async logout() {
    try {
      await this.sock?.logout();
    } catch {
      // ignore — we're clearing local session state regardless
    }
    fs.rmSync(AUTH_FOLDER(), { recursive: true, force: true });
    this.everConnectedThisRun = false;
    this.onStatus?.('logged-out');
    this.log('Session cleared. Scan the QR code again to reconnect.', 'info');
    setTimeout(() => this.connect(), 500);
  }

  toJid(rawNumber) {
    if (typeof rawNumber === 'string' && rawNumber.includes('@')) return rawNumber;
    let digits = String(rawNumber).replace(/[^0-9]/g, '');
    if (digits.length === 10) digits = '91' + digits;
    return `${digits}@s.whatsapp.net`;
  }

  async sendBulk({ contactsText, contacts, message, sendAt }, onProgress) {
    // Support both old (contactsText) and new (contacts array) formats
    let contactList;
    if (contacts && Array.isArray(contacts)) {
      // New grid format: [{phone: '919876...', fields: {A: '919876...', B: 'Priya'}}]
      contactList = contacts;
    } else {
      // Legacy textarea format: parse lines
      const lines = String(contactsText || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      contactList = lines.map((line) => {
        const parts = line.split(',').map((s) => s?.trim());
        return { phone: parts[0], fields: { A: parts[0], B: parts[1] || '' } };
      });
    }

    if (sendAt) {
      const delay = new Date(sendAt).getTime() - Date.now();
      if (delay > 0) {
        onProgress?.({ type: 'status', text: `Scheduled — will send in ${Math.round(delay / 60000)} min...` });
        setTimeout(() => {
          this._executeBulkSend(contactList, message, onProgress);
        }, delay);
        return { scheduled: true, delay };
      }
    }

    return this._executeBulkSend(contactList, message, onProgress);
  }

  async _executeBulkSend(contactList, message, onProgress) {
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const contact of contactList) {
      const rawNumber = contact.phone;
      if (!rawNumber) continue;

      const jid = this.toJid(rawNumber);
      // Replace {A}, {B}, {C}... and {1}, {2}, {3}... placeholders
      let personalized = message;
      if (contact.fields) {
        for (const [col, val] of Object.entries(contact.fields)) {
          // Replace {A}, {B}, etc. (case-insensitive)
          personalized = personalized.replace(new RegExp(`\\{${col}\\}`, 'gi'), val || '');
        }
      }
      // Also support legacy {{name}} which maps to field B
      personalized = personalized.replace(/\{\{\s*name\s*\}\}/gi, contact.fields?.B || '');

      try {
        const [check] = await this.sock.onWhatsApp(jid);
        if (!check?.exists) {
          skipped++;
          onProgress?.({ type: 'skipped', number: rawNumber, reason: 'Not on WhatsApp' });
          continue;
        }

        await this.sock.sendMessage(check.jid, { text: personalized });
        sent++;
        onProgress?.({ type: 'sent', number: rawNumber });
      } catch (err) {
        failed++;
        onProgress?.({ type: 'failed', number: rawNumber, reason: err.message });
      }

      await sleep(randomDelay());
    }

    const summary = { sent, failed, skipped };
    onProgress?.({ type: 'done', ...summary });
    return summary;
  }

  async confirmOrder(orderId) {
    const order = Store.getOrders().find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');

    const customerGreeting = order.customerName ? `Namaste ${order.customerName} ji!` : 'Namaste ji!';
    const itemsText = order.items && order.items.length > 0
      ? order.items.map((i) => `${i.quantity} ${i.name}`).join(', ')
      : order.summary;
    const locHeader = order.deliveryLocation ? ` (${order.deliveryLocation} Delivery)` : '';
    const locationText = order.deliveryLocation ? `\n📍 Delivery Location: ${order.deliveryLocation}` : '';

    const text = `${customerGreeting} Aapka order${locHeader} humari taraf se confirm kar diya gaya hai. ✅\n\n🥣 Order: ${itemsText}${locationText}\n\nHum samay par fresh delivery bhejenge. Dhanyawad! 🙏`;

    try {
      await this.sock.sendMessage(order.jid, { text });
      Store.updateOrderStatus(orderId, 'confirmed');
      this.log(`Order confirmed for ${order.phone} [${order.deliveryLocation || 'General'}] and WhatsApp message sent.`, 'success');
      return { ok: true, status: 'confirmed' };
    } catch (err) {
      this.log(`Failed to send confirmation to ${order.phone}: ${err.message}`, 'error');
      throw err;
    }
  }

  async rejectOrder(orderId, reason = '') {
    const order = Store.getOrders().find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');

    const customerGreeting = order.customerName ? `Namaste ${order.customerName} ji!` : 'Namaste ji!';
    const locInfo = order.deliveryLocation ? ` (${order.deliveryLocation} delivery ke liye)` : '';
    const reasonText = reason ? ` — ${reason}` : '';

    const text = `${customerGreeting} Asuvidha ke liye kshama chahte hain, filhal hum aapka yeh order${locInfo} accept nahi kar pa rahe hain${reasonText}. Agli baar hume zaroor sewa ka mauka dein. Dhanyawad! 🙏`;

    try {
      await this.sock.sendMessage(order.jid, { text });
      Store.updateOrderStatus(orderId, 'rejected');
      this.log(`Order rejected for ${order.phone} [${order.deliveryLocation || 'General'}] and notice sent.`, 'warning');
      return { ok: true, status: 'rejected' };
    } catch (err) {
      this.log(`Failed to send rejection to ${order.phone}: ${err.message}`, 'error');
      throw err;
    }
  }

  async sendCustomReply(jid, text) {
    if (!this.sock) throw new Error('WhatsApp not connected');
    const toJid = jid.includes('@') ? jid : `${jid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    await this.sock.sendMessage(toJid, { text });
    this.log(`Manual message sent to ${toJid.split('@')[0]}: ${text}`, 'success');
    return { ok: true };
  }

  async sendSingle(phone, message) {
    if (!this.sock) throw new Error('WhatsApp not connected');
    const jid = this.toJid(phone);
    await this.sock.sendMessage(jid, { text: message });
    this.log(`Direct message sent to ${phone}`, 'success');
    return { ok: true };
  }

  async sendDocument(phone, filePath, caption = '') {
    if (!this.sock) throw new Error('WhatsApp not connected');
    const jid = this.toJid(phone);
    const fs = require('fs');
    const path = require('path');
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Receipt PDF file not found: ${filePath}`);
    }
    const buffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    await this.sock.sendMessage(jid, {
      document: buffer,
      mimetype: 'application/pdf',
      fileName: fileName,
      caption: caption
    });
    this.log(`Document sent to ${phone}: ${fileName}`, 'success');
    return { ok: true };
  }

  isConnected() {
    return !!(this.sock && this.everConnectedThisRun);
  }
}

module.exports = WaHubService;
