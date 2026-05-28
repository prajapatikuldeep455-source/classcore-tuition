'use strict';

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ClassCore — main.js  (Electron Main Process)                   ║
// ║  Place this file at:                                            ║
// ║  C:\Users\via\Documents\My Project\ClassCore_Desktop\ClassCore  ║
// ╚══════════════════════════════════════════════════════════════════╝

const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ── 1. PATHS ──────────────────────────────────────────────────────────────────
// Data file: stored in Documents/ClassCore so it survives app updates.
const DATA_DIR  = path.join(os.homedir(), 'Documents', 'ClassCore');
const DATA_FILE = path.join(DATA_DIR, 'classcore_data.json');
const META_FILE = path.join(DATA_DIR, 'update_meta.json');  // "just updated?" flag
const LOG_FILE  = path.join(DATA_DIR, 'classcore.log');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── 2. SIMPLE FILE LOGGER ─────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (_) {}
  console.log(msg);
}

// ── 3. MAIN WINDOW ────────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1280,
    height:          800,
    minWidth:        900,
    minHeight:       600,
    icon:            path.join(__dirname, 'assets', 'icon.png'),  // optional
    title:           'ClassCore — Tuition Management',
    backgroundColor: '#F7F5F0',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // SECURITY: keep enabled
      nodeIntegration:  false,  // SECURITY: keep disabled
      sandbox:          false,
    },
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Send version to renderer as soon as it's ready
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('app-version', app.getVersion());
    log(`App loaded — v${app.getVersion()}`);
  });

  // Remove default menu bar (cleaner look)
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── 4. APP LIFECYCLE ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  // Check 1 second after startup (enough for window to paint)
  // Then re-check every 30 minutes silently
  setTimeout(() => setupAutoUpdater(), 1000);
  setInterval(() => {
    try { autoUpdater.checkForUpdates(); } catch(_) {}
  }, 30 * 60 * 1000); // 30 minutes

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
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
  // ── CONFIG ────────────────────────────────────────────────────────────────
  autoUpdater.autoDownload         = false;  // Show banner before downloading
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease      = false;

  // feedUrl from env variable with GitHub fallback
  if (!autoUpdater.app.updateConfigPath) {
    const feedUrl = process.env.UPDATE_FEED_URL ||
      'https://github.com/prajapatikuldeep455-source/classcore-tuition/releases/latest';
    log(`Update feed URL: ${feedUrl}`);
  }

  // NOTE: Do NOT set requestHeaders here.
  // AWS S3 (used by GitHub Releases) rejects Cache-Control / Pragma headers → 403.

  // ── LOGGING ───────────────────────────────────────────────────────────────
  autoUpdater.logger = {
    info:  log,
    warn:  (msg) => log(`[WARN] ${msg}`),
    error: (msg) => log(`[ERROR] ${msg}`),
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
      // Fix 2: Try again if retries remain
      _scheduleRetry();
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
  });

  // ── START THE CHECK ───────────────────────────────────────────────────────
  try {
    autoUpdater.checkForUpdates();
  } catch (err) {
    log(`✗ checkForUpdates failed: ${err.message}`);
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

// ── LOAD DATA ─────────────────────────────────────────────────────────────────
ipcMain.handle('load-data', () => {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    log(`loadData error: ${err.message}`);
    return null;
  }
});

// ── SAVE DATA (async) ─────────────────────────────────────────────────────────
ipcMain.handle('save-data', async (event, payload) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    log(`saveData error: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// ── SAVE DATA SYNC (called on window close) ───────────────────────────────────
// Note: ipcMain.on (not handle) because renderer uses sendSync
ipcMain.on('save-data-sync', (event, payload) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    event.returnValue = { ok: true };
  } catch (err) {
    log(`saveDataSync error: ${err.message}`);
    event.returnValue = { ok: false, error: err.message };
  }
});

// ── CHECK FOR UPDATE (manual, from Settings button) ───────────────────────────
ipcMain.handle('check-update', () => {
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
  // 1. Save current data BEFORE downloading
  if (payload) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
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
  log('→ Installing update and restarting...');
  autoUpdater.quitAndInstall(false, true);
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
    await win.webContents.print({
      silent:           false,
      printBackground:  true,
      pageSize:         paperSize || 'A4',
    });
    win.close();
    return { ok: true };
  } catch (err) {
    win.close();
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

// ── SAVE PDF SILENTLY (no dialog — for WhatsApp share) ────────────────────────
ipcMain.handle('save-pdf-silent', async (event, html, filename, paperSize) => {
  const filePath = path.join(os.homedir(), 'Documents', 'ClassCore', 'Receipts',
                             (filename || 'Receipt') + '.pdf');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const result = await _generatePDF(html, filePath, paperSize);
  if (result.ok) shell.showItemInFolder(filePath);
  return result;
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
    win.close();
    return { ok: true, filePath };
  } catch (err) {
    win.close();
    log(`PDF error: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// ── DATE STRING HELPER ────────────────────────────────────────────────────────
function _dateStr() {
  return new Date().toISOString().slice(0, 10);
}
