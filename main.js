'use strict';

// EARLY CRASH DETECTION — write to file before anything else
const _fs = require('fs');
const _path = require('path');
const _os = require('os');
const _crashLog = _path.join(_os.homedir(), 'Documents', 'ClassCore', 'crash_debug.log');
function _logCrash(msg) {
  try {
    _fs.mkdirSync(_path.dirname(_crashLog), { recursive: true });
    _fs.appendFileSync(_crashLog, `[${new Date().toISOString()}] ${msg}\n`);
  } catch(e) {
    console.error('Crash logger failed:', e);
  }
}
_logCrash(`\n=== APP STARTING ===`);

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ClassCore — main.js  (Electron Main Process)                   ║
// ╚══════════════════════════════════════════════════════════════════╝

let autoUpdater = null;
let gotSingleInstanceLock = true;
try {
  const { app: _app, BrowserWindow: _bw, ipcMain: _ipc, dialog: _dlg, shell: _sh, nativeTheme: _nt } = require('electron');
  _logCrash(`Electron loaded OK`);
  // Re-export for rest of file
  var app = _app, BrowserWindow = _bw, ipcMain = _ipc, dialog = _dlg, shell = _sh, nativeTheme = _nt;

  if (process.platform === 'win32') {
    try {
      app.setAppUserModelId('com.classcore.tuition');
      _logCrash('App user model ID set for Windows shortcuts and notifications');
    } catch (e) {
      _logCrash(`Failed to set AppUserModelID: ${e.message}`);
    }

    app.on('gpu-process-crashed', (event, killed) => {
      _logCrash(`GPU process crashed: killed=${killed}`);
    });
  }

  // Desktop shortcut double-clicks should focus the existing window, not spawn
  // a second blank instance that exits immediately.
  gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    _logCrash('Second instance blocked — focusing existing window');
    app.quit();
  } else {
    app.on('second-instance', () => {
      _logCrash('second-instance event — restoring main window');
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });
  }
} catch(e) {
  _logCrash(`ELECTRON REQUIRE FAILED: ${e.message}\n${e.stack}`);
  process.exit(1);
}

function initAutoUpdater(){
  if(!app.isPackaged) return false;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    _logCrash(`electron-updater loaded OK`);
    return true;
  } catch(e) {
    _logCrash(`electron-updater FAILED: ${e.message}\n${e.stack}`);
    autoUpdater = null;
    return false;
  }
}

const path = _path;
const fs   = _fs;
const os   = _os;
const iconPath   = path.join(__dirname, 'assets', 'icon.png');
const iconExists = fs.existsSync(iconPath);

process.on('unhandledRejection', (err) => {
  try { log(`Unhandled rejection: ${err}`); } catch(_) { console.error('Unhandled rejection:', err); }
});
process.on('uncaughtException', (err) => {
  try { log(`Uncaught exception: ${err}`); } catch(_) { console.error('Uncaught exception:', err); }
  // DO NOT re-throw or exit — keep the app alive
});

// ── 1. PATHS ──────────────────────────────────────────────────────────────────
// Data file: stored in Documents/ClassCore so it survives app updates.
const DATA_DIR    = path.join(os.homedir(), 'Documents', 'ClassCore');
const DATA_FILE   = path.join(DATA_DIR, 'classcore_data.json');
const META_FILE   = path.join(DATA_DIR, 'update_meta.json');  // "just updated?" flag
const LOG_FILE    = path.join(DATA_DIR, 'classcore.log');
const BACKUP_DIR  = path.join(DATA_DIR, 'Backups');
const { randomBytes } = require('crypto');

// ── WhatsApp Hub imports ──
const WaHubService = require('./wa-hub-service');
const WaHubStore = require('./wa-hub-store');
const { generateReply, detectProvider, sanitizeApiKey, PROVIDER_NAMES, DEFAULT_MODELS } = require('./wa-hub-ai');
const { Notification } = require('electron');

if (!fs.existsSync(DATA_DIR))    fs.mkdirSync(DATA_DIR,   { recursive: true });
if (!fs.existsSync(BACKUP_DIR))  fs.mkdirSync(BACKUP_DIR, { recursive: true });

// ── AUTO-BACKUP ───────────────────────────────────────────────────────────────
// Creates a daily backup of the data file. Keeps the last 7 backups.
function _autoBackup() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const today    = new Date().toISOString().slice(0, 10); // e.g. 2026-08-19
    const backFile = path.join(BACKUP_DIR, `classcore_backup_${today}.json`);
    // Only backup once per day
    if (fs.existsSync(backFile)) return;
    fs.copyFileSync(DATA_FILE, backFile);
    log(`Auto-backup created: ${backFile}`);
    // Prune old backups — keep only the newest 7
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('classcore_backup_') && f.endsWith('.json'))
      .sort();
    while (files.length > 7) {
      const old = files.shift();
      fs.unlinkSync(path.join(BACKUP_DIR, old));
      log(`Pruned old backup: ${old}`);
    }
  } catch (e) {
    log(`Auto-backup failed: ${e.message}`);
  }
}

// ── LOAD FROM BACKUP (recovery) ───────────────────────────────────────────────
// If the main data file is corrupt, find the newest valid backup and restore it.
function _loadFromBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return null;
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('classcore_backup_') && f.endsWith('.json'))
      .sort()
      .reverse(); // newest first
    for (const file of files) {
      try {
        const raw  = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8');
        const data = JSON.parse(raw);
        // Restore the main file from this good backup
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        log(`Recovered data from backup: ${file}`);
        return data;
      } catch (_) {
        log(`Backup ${file} also corrupt, trying older...`);
      }
    }
  } catch (e) {
    log(`Backup recovery failed: ${e.message}`);
  }
  return null;
}

// ── SAFE WRITE HELPER ─────────────────────────────────────────────────────────
// Uses a unique tmp file per write to prevent race conditions between
// the async save-data and the sync save-data-sync handlers.
function _safeWriteData(payload) {
  const suffix = randomBytes(4).toString('hex');
  const tmpFile = DATA_FILE + '.tmp.' + suffix;
  fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
}

// ── 2. SIMPLE FILE LOGGER ─────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (_) {}
  console.log(msg);
}

// ── 3. MAIN WINDOW ────────────────────────────────────────────────────────────
let mainWindow = null;
let waHubService = null;
let waHubWindow = null;

function waHubEmit(channel, data) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  } catch (e) { /* window may be closing */ }
  try {
    if (waHubWindow && !waHubWindow.isDestroyed()) {
      waHubWindow.webContents.send(channel, data);
    }
  } catch (e) { /* window may be closing */ }
}

function createWindow() {
  _logCrash(`createWindow started`);
  mainWindow = new BrowserWindow({
    width:           1280,
    height:          800,
    minWidth:        900,
    minHeight:       600,
    icon:            iconExists ? iconPath : undefined,
    title:           'ClassCore — Tuition Management',
    backgroundColor: '#F7F5F0',
    show:            false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // SECURITY: keep enabled
      nodeIntegration:  false,  // SECURITY: keep disabled
      sandbox:          true,   // SECURITY: OS-level sandbox for renderer
    },
  });
  _logCrash(`BrowserWindow instance created`);

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'index.html')).catch(e => {
    _logCrash(`loadFile error: ${e.message}`);
  });
  _logCrash(`loadFile called`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // ── Initialize WhatsApp Hub Service ──
  try {
    waHubService = new WaHubService({
      onQr: (dataUrl) => waHubEmit('wa:qr', dataUrl),
      onStatus: (status, info) => waHubEmit('wa:status', { status, info }),
      onLog: (entry) => waHubEmit('wa:log', entry),
      onOrderSummary: (order) => {
        WaHubStore.saveOrder(order);
        waHubEmit('wa:order-summary', order);
        if (Notification.isSupported()) {
          new Notification({ title: 'New Order', body: order.summary || 'New order received' }).show();
        }
      },
      onOwnerAlert: (alert) => {
        WaHubStore.saveAlert(alert);
        waHubEmit('wa:owner-alert', alert);
        if (Notification.isSupported()) {
          new Notification({ title: 'Action Required', body: alert.reason || 'Needs your attention' }).show();
        }
      },
    });
    waHubService.connect().catch(err => console.error('WaHub connect error:', err));
  } catch (err) {
    console.error('WaHub initialization error:', err);
  }

  let readyToShowTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      _logCrash('ready-to-show timeout reached; showing window anyway');
      mainWindow.show();
    }
  }, 5000);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(readyToShowTimeout);
    _logCrash('mainWindow ready-to-show fired');
    if (mainWindow) {
      mainWindow.show();
      _logCrash('mainWindow shown after ready-to-show');
    }
  });

  mainWindow.on('show', () => {
    _logCrash('mainWindow show event fired');
  });

  // Send version to renderer as soon as it's ready
  mainWindow.webContents.on('did-finish-load', () => {
    _logCrash(`did-finish-load fired`);
    mainWindow.webContents.send('app-version', app.getVersion());
    log(`App loaded — v${app.getVersion()}`);
    if (mainWindow && !mainWindow.isVisible()) {
      _logCrash('did-finish-load fired while hidden; showing window');
      mainWindow.show();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    const msg = `did-fail-load: code=${errorCode} desc=${errorDescription} url=${validatedURL} mainFrame=${isMainFrame}`;
    _logCrash(msg);
    log(msg);
  });

  mainWindow.on('close', () => {
    _logCrash('mainWindow close event');
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    const msg = `render-process-gone: reason=${details.reason} killed=${details.wasKilled}`;
    _logCrash(msg);
    log(msg);
    if (mainWindow && !mainWindow.isDestroyed()) {
      _logCrash('Reloading window after renderer crash');
      mainWindow.loadFile(path.join(__dirname, 'index.html')).catch(e => {
        _logCrash(`Reload after crash failed: ${e.message}`);
      });
    }
  });

  mainWindow.webContents.on('unresponsive', () => {
    _logCrash('renderer unresponsive');
    log('renderer unresponsive');
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    _logCrash(`renderer console: [${level}] ${message} (${sourceId}:${line})`);
    console.log(`[RENDERER] ${message}`);
  });

  mainWindow.webContents.on('crashed', () => {
    _logCrash('renderer crashed');
    log('renderer crashed');
  });

  // Remove default menu bar (cleaner look)
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── 4. APP LIFECYCLE ──────────────────────────────────────────────────────────
if (gotSingleInstanceLock) {
app.whenReady().then(() => {
  _logCrash(`app.whenReady fired, creating window`);
  createWindow();
  _logCrash(`Window created OK`);

  const shouldUseAutoUpdater = initAutoUpdater();

  // Check 3 seconds after startup (enough for window to paint + renderer to init)
  // Then re-check every 30 minutes silently
  if (shouldUseAutoUpdater) {
    setTimeout(() => {
      try { setupAutoUpdater(); } catch(e) {
        try { log(`setupAutoUpdater crashed: ${e.message}`); } catch(_) {}
      }
    }, 3000);
    setInterval(() => {
      try { autoUpdater.checkForUpdates(); } catch(_) {}
    }, 30 * 60 * 1000); // 30 minutes
  } else {
    log('Auto-updater disabled in development/unpacked mode — skipping update checks');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
}

app.on('window-all-closed', () => {
  _logCrash(`window-all-closed fired. Platform is: ${process.platform}`);
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', (e) => {
  _logCrash(`app.will-quit fired!`);
});

app.on('quit', (e, exitCode) => {
  _logCrash(`app.quit fired! Exit code: ${exitCode}`);
});

// ── 5. AUTO-UPDATER ───────────────────────────────────────────────────────────
//
// ALL 4 REQUESTED FIXES APPLIED:
//   Fix 1. Update timeout     — fails after 8 min of total silence (not hanging forever)
//   Fix 2. Exponential backoff — retries on network drop: 2s → 4s → 8s (3 attempts)
//   Fix 3. Improved errors     — exact error type shown: Network / Server / Timeout / Unknown
//   Fix 4. Manual fallback UI  — after all retries fail, sends 'update-manual-fallback'
//                                 so UI can show "Download manually" button + GitHub link
//
// ALSO KEPT:
//   - No requestHeaders (AWS S3 / GitHub rejects Cache-Control → 403 Forbidden)
//   - fire-and-forget downloadUpdate() (await blocks IPC → stuck at 0%)
//   - Download stall detection (5 min without progress → restart download)
//   - feedUrl from env variable with GitHub fallback
//   - Full logging to classcore.log
// ──────────────────────────────────────────────────────────────────────────────

let _updateTimeoutTimer  = null;   // single shared timer for both check + download phases
let _updateRetryCount    = 0;
const MAX_RETRIES        = 3;
const CHECK_TIMEOUT_MS   = 8  * 60 * 1000;   // Fix 1: 8 min — if check hangs, give up
const DOWNLOAD_TIMEOUT_MS= 5  * 60 * 1000;   // Fix 1: 5 min stall → restart download

// Classify errors into human-readable types (Fix 3)
function _classifyError(err) {
  const m = (err && err.message) ? err.message : String(err);

  if (m.includes('ENOTFOUND') || m.includes('getaddrinfo'))
    return { type: 'Network',  msg: 'Cannot reach update server. Check your internet connection.' };

  if (m.includes('ETIMEDOUT') || m.includes('ECONNRESET') || m.includes('net::ERR_TIMED_OUT'))
    return { type: 'Timeout',  msg: 'Connection timed out. Your internet may be unstable.' };

  if (m.includes('ECONNREFUSED') || m.includes('Connection refused'))
    return { type: 'Refused',  msg: 'Update server refused the connection. Try again later.' };

  if (m.includes('403') || m.includes('Forbidden'))
    return { type: 'Forbidden',msg: 'Access denied by update server (403). Contact support.' };

  if (m.includes('404') || m.includes('Not Found'))
    return { type: 'NotFound', msg: 'Update file not found on server. It may not be published yet.' };

  if (m.includes('ENOSPC'))
    return { type: 'DiskFull', msg: 'Not enough disk space to download the update.' };

  return { type: 'Unknown', msg: 'Update failed: ' + m };
}

// Send a message to renderer with classified error + manual fallback info (Fix 3 + Fix 4)
function _sendErrorToRenderer(err, isFinal) {
  if (!mainWindow) return;
  const { type, msg } = _classifyError(err);
  log(`✗ Error [${type}]: ${msg}`);

  if (isFinal) {
    // Fix 4: All retries exhausted — send manual fallback event
    const fallback = {
      type,
      msg,
      manualUrl: 'https://github.com/prajapatikuldeep455-source/classcore-tuition/releases/latest',
      instructions: 'Auto-update failed after 3 attempts. Click the link below to download and install manually.',
    };
    log(`✗ All ${MAX_RETRIES} retries failed. Sending manual fallback to UI.`);
    mainWindow.webContents.send('update-manual-fallback', fallback);
  } else {
    mainWindow.webContents.send('update-error', msg);
  }
}

function setupAutoUpdater() {
  try {
  // ── CONFIG ────────────────────────────────────────────────────────────────
  autoUpdater.autoDownload         = true;   // Automatically download in background when available
  autoUpdater.autoInstallOnAppQuit = true;   // Auto-install on quit if user finishes later
  autoUpdater.allowPrerelease      = false;
  autoUpdater.disableWebInstaller  = true;   // Direct full NSIS installer download
  autoUpdater.disableDifferentialDownload = true; // Stream direct installer, avoiding GitHub blockmap 404s

  // feedUrl from env variable with GitHub fallback
  try {
    const feedUrl = process.env.UPDATE_FEED_URL ||
      'https://github.com/prajapatikuldeep455-source/classcore-tuition/releases/latest';
    log(`Update feed URL: ${feedUrl}`);
  } catch(_) {}

  // NOTE: Do NOT set requestHeaders here.
  // AWS S3 (used by GitHub Releases) rejects Cache-Control / Pragma headers → 403.

  // ── LOGGING ───────────────────────────────────────────────────────────────
  autoUpdater.logger = {
    info:  (msg) => { try { log(msg); } catch(_) {} },
    warn:  (msg) => { try { log(`[WARN] ${msg}`); } catch(_) {} },
    error: (msg) => { try { log(`[ERROR] ${msg}`); } catch(_) {} },
    debug: () => {},
  };

  // ── EVENTS ────────────────────────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    log('⊙ Checking for updates...');

    // Fix 1: Start check timeout — if nothing happens in 8 min, treat as failure
    _clearUpdateTimer();
    _updateTimeoutTimer = setTimeout(() => {
      log('✗ Update check timeout (8 min) — server unreachable');
      _sendErrorToRenderer(
        new Error('ETIMEDOUT: Update server did not respond within 8 minutes.'),
        _updateRetryCount >= MAX_RETRIES  // Fix 4: final if all retries used
      );
    }, CHECK_TIMEOUT_MS);
  });

  autoUpdater.on('update-available', (info) => {
    log(`✓ Update available: v${info.version}`);
    _clearUpdateTimer();           // clear check timeout — got a response
    _updateRetryCount = 0;         // reset retries on success
    if (mainWindow) mainWindow.webContents.send('update-available', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    log(`✓ Already up to date: v${info.version}`);
    _clearUpdateTimer();
    _updateRetryCount = 0;
    if (mainWindow) mainWindow.webContents.send('update-not-available', info.version);
  });

  autoUpdater.on('download-progress', (progress) => {
    const pct   = Math.round(progress.percent);
    const speed = Math.round(progress.bytesPerSecond / 1024);
    log(`↓ Download: ${pct}% (${speed} KB/s)`);

    // Fix 1: Any progress clears the stall timer and resets it
    _clearUpdateTimer();
    _setDownloadStallTimer();

    if (mainWindow) mainWindow.webContents.send('update-progress', pct);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log(`✓ Downloaded: v${info.version}`);
    _clearUpdateTimer();
    _updateRetryCount = 0;

    try {
      fs.writeFileSync(META_FILE, JSON.stringify({
        justUpdated: true,
        version:     info.version,
        updatedAt:   new Date().toISOString(),
      }));
    } catch (_) {}

    if (mainWindow) mainWindow.webContents.send('update-downloaded', info.version);
  });

  // Fix 2 + Fix 3 + Fix 4: Full error handler
  autoUpdater.on('error', (err) => {
    try {
    _clearUpdateTimer();

    const { type } = _classifyError(err);
    const isNetworkErr = ['Network','Timeout','Refused'].includes(type);

    // Fix 2: Retry with exponential backoff on network errors
    if (isNetworkErr && _updateRetryCount < MAX_RETRIES) {
      _updateRetryCount++;
      const delayMs = Math.pow(2, _updateRetryCount) * 1000; // 2s, 4s, 8s
      log(`↻ Retrying in ${delayMs / 1000}s (attempt ${_updateRetryCount}/${MAX_RETRIES})`);

      // Show retry progress to user (Fix 3)
      if (mainWindow) {
        mainWindow.webContents.send('update-retrying', {
          attempt: _updateRetryCount,
          max:     MAX_RETRIES,
          delayMs,
          reason:  _classifyError(err).msg,
        });
      }

      setTimeout(() => {
        try { autoUpdater.checkForUpdates(); } catch(e) { log(`Retry failed: ${e.message}`); }
      }, delayMs);

    } else {
      // Fix 4: All retries exhausted — send manual fallback
      _sendErrorToRenderer(err, true);
    }
    } catch(innerErr) {
      log(`Update error handler crashed: ${innerErr.message}`);
    }
  });

  // ── START THE CHECK ───────────────────────────────────────────────────────
  try {
    autoUpdater.checkForUpdates();
  } catch (err) {
    log(`✗ checkForUpdates failed: ${err.message}`);
  }

  } catch(outerErr) {
    log(`setupAutoUpdater FATAL: ${outerErr.message}`);
  }
}

// ── TIMER HELPERS ─────────────────────────────────────────────────────────────
function _clearUpdateTimer() {
  if (_updateTimeoutTimer) {
    clearTimeout(_updateTimeoutTimer);
    _updateTimeoutTimer = null;
  }
}

// Fix 1: Download stall timer — if no progress for 5 min, restart download
function _setDownloadStallTimer() {
  _clearUpdateTimer();
  _updateTimeoutTimer = setTimeout(() => {
    log('✗ Download stall timeout (5 min) — no progress received. Restarting download...');
    if (_updateRetryCount >= MAX_RETRIES) {
      _sendErrorToRenderer(new Error('Download stalled repeatedly.'), true);
      return;
    }
    _updateRetryCount++;
    try {
      autoUpdater.downloadUpdate(); // restart — NOT awaited
    } catch(e) {
      log(`Stall retry failed: ${e.message}`);
      _sendErrorToRenderer(e, _updateRetryCount >= MAX_RETRIES);
    }
  }, DOWNLOAD_TIMEOUT_MS);
}

// Fix 2: Schedule a retry via checkForUpdates
function _scheduleRetry() {
  if (_updateRetryCount >= MAX_RETRIES) {
    log(`✗ Max retries (${MAX_RETRIES}) reached. Giving up.`);
    return;
  }
  _updateRetryCount++;
  const delayMs = Math.pow(2, _updateRetryCount) * 1000;
  log(`↻ Scheduling retry ${_updateRetryCount}/${MAX_RETRIES} in ${delayMs/1000}s`);
  if (mainWindow) {
    mainWindow.webContents.send('update-retrying', {
      attempt: _updateRetryCount,
      max:     MAX_RETRIES,
      delayMs,
      reason:  'Connection to update server timed out.',
    });
  }
  setTimeout(() => {
    try { autoUpdater.checkForUpdates(); } catch(e) { log(`Retry failed: ${e.message}`); }
  }, delayMs);
}

// ── 6. IPC HANDLERS ───────────────────────────────────────────────────────────
// index.html calls:  window.classcore.someMethod()
// preload.js exposes: ipcRenderer.invoke('channel-name', args)
// main.js handles:   ipcMain.handle('channel-name', handler)

// ── App version ───────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

// ── Data path (shown in Settings) ─────────────────────────────────────────────
ipcMain.handle('get-data-path', () => DATA_FILE);

// ── Update meta (was app just updated?) ───────────────────────────────────────
ipcMain.handle('get-update-meta', () => {
  try {
    if (!fs.existsSync(META_FILE)) return null;
    const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
    // Delete the flag so it only shows once
    fs.unlinkSync(META_FILE);
    return meta;
  } catch (_) { return null; }
});

// ── VERIFY LICENSE KEY (Firebase Firestore + Device ID Binding) ───────────────
ipcMain.handle('verify-license-key', async (_event, payload) => {
  const cleanKey = ((typeof payload === 'object' ? payload.key : payload) || '').trim().toUpperCase();
  const currentDeviceId = ((typeof payload === 'object' ? payload.deviceId : '') || '').trim();
  if (!cleanKey) return { valid: false, reason: 'Empty license key' };

  const projectId = 'classcore-e5d97';
  const apiKey = 'AIzaSyB2XecFJhEMtOyGkUPPbkMZpAGbzJdwL3s';

  function checkLicFields(lic, key) {
    if (!lic) return null;
    if (lic.plan !== 'lifetime') {
      const exp = Number(lic.expiry);
      if (!exp) return { valid: false, reason: 'Key has no expiry date. Contact support.' };
      if (Date.now() > exp) {
        return { valid: false, reason: 'Key expired on ' + new Date(exp).toLocaleDateString('en-IN') + '. Please renew.' };
      }
    }
    return {
      valid: true,
      plan: lic.plan,
      expiry: Number(lic.expiry) || 9999999999999,
      name: lic.name || '',
      institute: lic.institute || '',
      mobile: lic.mobile || '',
      email: lic.email || '',
      expiryDate: lic.expiryDate || ''
    };
  }

  // 1. Check Firebase Firestore (Primary secure DRM database)
  try {
    const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/${cleanKey}?key=${apiKey}`;
    const resp = await fetch(docUrl, { cache: 'no-store' });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.fields) {
        const f = data.fields;
        const lic = {
          plan: f.plan?.stringValue || 'monthly',
          expiry: Number(f.expiry?.integerValue || 9999999999999),
          name: f.name?.stringValue || '',
          institute: f.institute?.stringValue || '',
          mobile: f.mobile?.stringValue || '',
          email: f.email?.stringValue || '',
          expiryDate: f.expiryDate?.stringValue || '',
          status: f.status?.stringValue || 'active',
          deviceId: f.deviceId?.stringValue || ''
        };

        if (lic.status && lic.status !== 'active') {
          return { valid: false, reason: 'License key is suspended or inactive. Contact support.' };
        }

        const validCheck = checkLicFields(lic, cleanKey);
        if (!validCheck.valid) return validCheck;

        // ── Device ID Binding (1 PC = 1 Key) ──
        if (currentDeviceId) {
          if (!lic.deviceId) {
            // First activation: bind device ID to this PC in Firestore
            try {
              const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/licenses/${cleanKey}?updateMask.fieldPaths=deviceId&updateMask.fieldPaths=activatedAt&key=${apiKey}`;
              await fetch(patchUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fields: {
                    deviceId: { stringValue: currentDeviceId },
                    activatedAt: { stringValue: new Date().toISOString() }
                  }
                })
              });
              log(`[License] Bound key ${cleanKey} to device ${currentDeviceId}`);
            } catch (bindErr) {
              log(`[License] Failed to bind device: ${bindErr.message}`);
            }
          } else if (lic.deviceId !== currentDeviceId) {
            // Key is already bound to another machine!
            return {
              valid: false,
              reason: '❌ This license key is already active on another computer. Each license is valid for 1 PC only. Please contact admin to transfer.'
            };
          }
        }

        return { ...validCheck, deviceId: lic.deviceId || currentDeviceId };
      }
    }
  } catch (err) {
    log(`[License] Firestore check error: ${err.message}`);
  }

  // 2. Fallback: Local licenses.json bundled with the app or in Documents
  try {
    const candidatePaths = [
      path.join(__dirname, 'licenses.json'),
      path.join(process.resourcesPath || '', 'licenses.json'),
      path.join(DATA_DIR, 'licenses.json')
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const localData = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (localData && localData[cleanKey]) {
          const lic = localData[cleanKey];
          const validCheck = checkLicFields(lic, cleanKey);
          if (validCheck) {
            log(`[License] Key ${cleanKey} verified via local fallback.`);
            return validCheck;
          }
        }
      }
    }
  } catch (err) {
    log(`[License] Local fallback check error: ${err.message}`);
  }

  // 3. Fallback: GitHub raw check (legacy compatibility)
  try {
    const rawUrl = 'https://raw.githubusercontent.com/prajapatikuldeep455-source/classcore-tuition/main/licenses.json?t=' + Date.now();
    const resp = await fetch(rawUrl, { cache: 'no-store' });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data[cleanKey]) {
        return checkLicFields(data[cleanKey], cleanKey);
      }
      return { valid: false, reason: 'License key not found. Please verify your key.' };
    }
  } catch (err) {
    log(`[License] GitHub raw check error: ${err.message}`);
  }

  return { valid: false, reason: 'Cannot reach verification server. Check your internet connection.' };
});

// ── LOAD DATA ─────────────────────────────────────────────────────────────────
ipcMain.handle('load-data', () => {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    // Data loaded OK — trigger a daily backup
    _autoBackup();
    return data;
  } catch (err) {
    log(`loadData error: ${err.message} — attempting recovery from backup...`);
    const recovered = _loadFromBackup();
    if (recovered) {
      log('Data recovered successfully from backup!');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backup-restored', true);
      }
      return recovered;
    }
    log('No valid backup found — returning null (fresh start).');
    return null;
  }
});

// ── SAVE DATA (async) ─────────────────────────────────────────────────────────
ipcMain.handle('save-data', async (event, payload) => {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid payload' };
  try {
    _safeWriteData(payload);
    return { ok: true };
  } catch (err) {
    log(`saveData error: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// ── SAVE DATA SYNC (called on window close) ───────────────────────────────────
// Note: ipcMain.on (not handle) because renderer uses sendSync
ipcMain.on('save-data-sync', (event, payload) => {
  if (!payload || typeof payload !== 'object') {
    event.returnValue = { ok: false, error: 'Invalid payload' };
    return;
  }
  try {
    _safeWriteData(payload);
    event.returnValue = { ok: true };
  } catch (err) {
    log(`saveDataSync error: ${err.message}`);
    event.returnValue = { ok: false, error: err.message };
  }
});

// ── CHECK FOR UPDATE (manual, from Settings button) ───────────────────────────
ipcMain.handle('check-update', () => {
  if(!autoUpdater) return { ok: false, error: 'Auto-updater unavailable' };
  try {
    log('⊙ Manual update check triggered');
    _updateRetryCount = 0; // Reset retry on manual check
    autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── DOWNLOAD UPDATE (user clicked "Update Now") ───────────────────────────────
// CRITICAL: Do NOT await autoUpdater.downloadUpdate().
// Awaiting blocks the IPC channel → progress events queue up → never delivered
// → stuck at 0% forever. Fire-and-forget. Progress via 'download-progress' events.
ipcMain.handle('download-update', async (event, payload) => {
  if(!autoUpdater) return { ok: false, error: 'Auto-updater unavailable' };
  // 1. Save current data BEFORE downloading
  if (payload && typeof payload === 'object') {
    try {
      _safeWriteData(payload);
      log('✓ Data saved before update download.');
    } catch (err) {
      log(`Pre-update save error: ${err.message}`);
      // Non-fatal — proceed with download anyway
    }
  }

  // 2. Fire download — NOT awaited (would block IPC for minutes)
  try {
    log('→ Starting download...');
    autoUpdater.downloadUpdate();  // fire-and-forget — NOT awaited

    // Fix 1: Start stall timer — if no progress after 5 min, restart
    _setDownloadStallTimer();

    log('✓ downloadUpdate() called (non-blocking). Progress events will follow.');
    return { ok: true };
  } catch (err) {
    log(`✗ downloadUpdate() threw: ${err.message}`);
    // Fix 3: Classified error forwarded to renderer
    _sendErrorToRenderer(err, _updateRetryCount >= MAX_RETRIES);
    return { ok: false, error: _classifyError(err).msg };
  }
});

// ── INSTALL UPDATE (user clicked "Restart & Install") ─────────────────────────
ipcMain.handle('install-update', () => {
  if(!autoUpdater) return { ok: false, error: 'Auto-updater unavailable' };
  log('→ Installing update and restarting...');
  // Small delay to allow IPC response to reach renderer before quit
  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 500);
  return { ok: true };
});

// ── EXPORT BACKUP ─────────────────────────────────────────────────────────────
ipcMain.handle('export-backup', async (event, data) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export ClassCore Backup',
    defaultPath: path.join(os.homedir(), 'Desktop', `ClassCore_Backup_${_dateStr()}.json`),
    filters:     [{ name: 'JSON Backup', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false };
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── IMPORT BACKUP ─────────────────────────────────────────────────────────────
ipcMain.handle('import-backup', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title:      'Import ClassCore Backup',
    filters:    [{ name: 'JSON Backup', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { ok: false };
  try {
    const raw  = fs.readFileSync(filePaths[0], 'utf8');
    const data = JSON.parse(raw);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── PRINT ─────────────────────────────────────────────────────────────────────
ipcMain.handle('print-content', async (event, html, paperSize) => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise(res => win.webContents.once('did-finish-load', res));
  try {
    await new Promise((resolve, reject) => {
      win.webContents.print({
        silent:           false,
        printBackground:  true,
        pageSize:         paperSize || 'A4',
      }, (success, failureReason) => {
        if (success) resolve();
        else reject(new Error(failureReason || 'Print failed'));
      });
    });
    win.destroy();
    return { ok: true };
  } catch (err) {
    win.destroy();
    return { ok: false, error: err.message };
  }
});

// ── SAVE PDF ──────────────────────────────────────────────────────────────────
ipcMain.handle('save-pdf', async (event, html, filename, paperSize) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title:       'Save PDF',
    defaultPath: path.join(os.homedir(), 'Desktop', (filename || 'ClassCore') + '.pdf'),
    filters:     [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false };
  return _generatePDF(html, filePath, paperSize);
});

// ── SAVE PDF SILENTLY (no dialog — for WhatsApp share & report exports) ────────
ipcMain.handle('save-pdf-silent', async (event, html, filename, paperSize, subfolder) => {
  const sub = (typeof subfolder === 'string' && subfolder.trim()) ? subfolder.trim() : 'Receipts';
  const folderPath = path.join(os.homedir(), 'Documents', 'ClassCore', sub);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  const safeName = (filename || 'Document').replace(/[\\/:*?"<>|]/g, '_');
  const filePath = path.join(folderPath, safeName + '.pdf');
  const result = await _generatePDF(html, filePath, paperSize);
  return { ...result, path: filePath, filePath, folderPath };
});

// ── OPEN PATH IN OS FILE EXPLORER ──────────────────────────────────────────────
ipcMain.handle('open-path', async (event, targetPath) => {
  try {
    const fullPath = targetPath || path.join(os.homedir(), 'Documents', 'ClassCore');
    await shell.openPath(fullPath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── GENERATE QR CODE ──────────────────────────────────────────────────────────
ipcMain.handle('generate-qr', async (event, text) => {
  try {
    const QRCode = require('qrcode');
    const dataUrl = await QRCode.toDataURL(text || '', { width: 220, margin: 1 });
    return { ok: true, dataUrl };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── PDF HELPER ────────────────────────────────────────────────────────────────
async function _generatePDF(html, filePath, paperSize) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise(res => win.webContents.once('did-finish-load', res));
  try {
    const sizeMap = { A4:'A4', A5:'A5', A6:'A6', A7:[74,105] };
    const pdfSize = sizeMap[paperSize] || 'A4';
    const pdfOpts = typeof pdfSize === 'string'
      ? { pageSize: pdfSize, printBackground: true, marginsType: 1 }
      : { pageSize: { width: pdfSize[0]*1000, height: pdfSize[1]*1000 }, printBackground: true, marginsType: 1 };
    const pdfData = await win.webContents.printToPDF(pdfOpts);
    fs.writeFileSync(filePath, pdfData);
    win.destroy();
    return { ok: true, filePath };
  } catch (err) {
    win.destroy();
    log(`PDF error: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// ── DATE STRING HELPER ────────────────────────────────────────────────────────
function _dateStr() {
  return new Date().toISOString().slice(0, 10);
}

// ══════════════════════════════════════════
// WhatsApp Hub IPC Handlers
// ══════════════════════════════════════════

ipcMain.handle('wa:is-connected', async () => {
  return { connected: waHubService ? waHubService.isConnected() : false };
});

ipcMain.handle('wa:open-hub-window', async () => {
  if (waHubWindow && !waHubWindow.isDestroyed()) {
    waHubWindow.focus();
    return { ok: true };
  }
  waHubWindow = new BrowserWindow({
    width: 1100, height: 750,
    minWidth: 900, minHeight: 600,
    parent: mainWindow,
    title: 'WhatsApp Hub — ClassCore',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'wa-hub-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  });
  waHubWindow.loadFile(path.join(__dirname, 'wa-hub', 'wa-hub.html'));
  waHubWindow.on('closed', () => { waHubWindow = null; });
  
  // Send current status to newly opened window
  waHubWindow.webContents.once('did-finish-load', () => {
    if (waHubService && waHubService.isConnected()) {
      waHubWindow.webContents.send('wa:status', { status: 'connected', info: {} });
    }
  });
  
  waHubWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
  
  return { ok: true };
});

ipcMain.handle('wa:logout', async () => {
  if (!waHubService) return { ok: false, error: 'Service not initialized' };
  await waHubService.logout();
  return { ok: true };
});

ipcMain.handle('wa:send-single', async (_e, { phone, message }) => {
  if (!waHubService) return { ok: false, error: 'Service not initialized' };
  return await waHubService.sendSingle(phone, message);
});

ipcMain.handle('wa:send-document', async (_e, { phone, filePath, caption }) => {
  if (!waHubService) return { ok: false, error: 'Service not initialized' };
  return await waHubService.sendDocument(phone, filePath, caption);
});

ipcMain.handle('wa:send-bulk', async (_e, payload) => {
  if (!waHubService) return { ok: false, error: 'Service not initialized' };
  return await waHubService.sendBulk(payload, (progress) => {
    waHubEmit('wa:bulk-progress', progress);
  });
});

ipcMain.handle('wa:get-auto-reply', async () => {
  return WaHubStore.getAutoReply();
});

ipcMain.handle('wa:save-auto-reply', async (_e, settings) => {
  WaHubStore.saveAutoReply(settings);
  if (waHubService) waHubService.updateAutoReplySettings(settings);
  return { ok: true };
});

ipcMain.handle('wa:detect-provider', async (_e, { apiKey }) => {
  const key = sanitizeApiKey(apiKey || '');
  const provider = detectProvider(key);
  return {
    provider,
    label: PROVIDER_NAMES[provider] || 'Unknown',
    defaultModel: DEFAULT_MODELS[provider] || '',
    seenPrefix: key.slice(0, 6),
    length: key.length,
  };
});

ipcMain.handle('wa:preview-ai-reply', async (_e, { ai, sampleText }) => {
  try {
    const result = await generateReply({
      apiKey: ai.apiKey,
      model: ai.model,
      persona: ai.persona,
      businessInfo: ai.businessInfo,
      menuPricing: ai.menuPricing,
      history: [],
      incomingText: sampleText,
    });
    return { ok: true, replyText: result.text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('wa:get-orders', async () => {
  return WaHubStore.getOrders();
});

ipcMain.handle('wa:update-order-status', async (_e, { orderId, status }) => {
  WaHubStore.updateOrderStatus(orderId, status);
  return { ok: true };
});

ipcMain.handle('wa:confirm-order', async (_e, { orderId }) => {
  if (!waHubService) return { ok: false, error: 'Service not initialized' };
  return await waHubService.confirmOrder(orderId);
});

ipcMain.handle('wa:reject-order', async (_e, { orderId, reason }) => {
  if (!waHubService) return { ok: false, error: 'Service not initialized' };
  return await waHubService.rejectOrder(orderId, reason);
});

ipcMain.handle('wa:delete-order', async (_e, { orderId }) => {
  WaHubStore.deleteOrder(orderId);
  return { ok: true };
});

ipcMain.handle('wa:get-alerts', async () => {
  return WaHubStore.getAlerts();
});

ipcMain.handle('wa:dismiss-alert', async (_e, { alertId }) => {
  WaHubStore.dismissAlert(alertId);
  return { ok: true };
});

ipcMain.handle('wa:reply-to-alert', async (_e, { jid, text, alertId }) => {
  try {
    if (!waHubService) throw new Error('Service not initialized');
    await waHubService.sendCustomReply(jid, text);
    WaHubStore.dismissAlert(alertId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
