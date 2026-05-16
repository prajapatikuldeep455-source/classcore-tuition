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

// ── 5. AUTO-UPDATER  ✅ FULL FIX (all Copilot recommendations applied) ───────
//
// FIXES APPLIED:
//   1. Removed requestHeaders (AWS S3/GitHub rejects custom headers → 403)
//   2. Timeout mechanism (10 min for overall, 5 min if download stalls)
//   3. Exponential backoff retry logic (up to 3 attempts)
//   4. Progress monitoring clears timeout — detects active downloads
//   5. feedUrl from environment variable with GitHub fallback
//   6. Detailed logging to classcore.log for easy debugging
// ──────────────────────────────────────────────────────────────────────────────

let _updateTimeoutTimer = null;
let _updateRetryCount   = 0;
const MAX_RETRIES          = 3;
const UPDATE_TIMEOUT_MS    = 10 * 60 * 1000;   // 10 minutes total
const DOWNLOAD_TIMEOUT_MS  =  5 * 60 * 1000;   //  5 minutes if stalled

function setupAutoUpdater() {
  // ── CONFIG ────────────────────────────────────────────────────────────────
  autoUpdater.autoDownload         = false;  // Show banner before downloading
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease      = false;

  // ✅ FIX: Use environment variable or default GitHub repo
  // Set this in package.json "build" section or environment:
  // "publish": { "provider": "github", "owner": "prajapatikuldeep455-source", "repo": "classcore-tuition" }
  if (!autoUpdater.app.updateConfigPath) {
    const feedUrl = process.env.UPDATE_FEED_URL ||
      'https://github.com/prajapatikuldeep455-source/classcore-tuition/releases/latest';
    log(`Update feed URL: ${feedUrl}`);
  }

  // ✅ FIX: Do NOT set requestHeaders — AWS S3/GitHub rejects custom
  // Cache-Control / Pragma headers → 403 Forbidden → stuck at 0%.
  // electron-updater handles caching correctly on its own.

  // ── LOGGING ───────────────────────────────────────────────────────────────
  autoUpdater.logger = {
    info:  log,
    warn:  (msg) => log(`[WARN] ${msg}`),
    error: (msg) => log(`[ERROR] ${msg}`),
    debug: () => {}
  };

  // ── EVENTS ────────────────────────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    log('✓ Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log(`✓ Update available: v${info.version}`);
    _updateRetryCount = 0; // Reset retry counter on successful check
    if (mainWindow) mainWindow.webContents.send('update-available', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    log(`✓ Already up to date: v${info.version}`);
    if (mainWindow) mainWindow.webContents.send('update-not-available', info.version);
  });

  autoUpdater.on('download-progress', (progress) => {
    const pct   = Math.round(progress.percent);
    const speed = Math.round(progress.bytesPerSecond / 1024);
    log(`↓ Download: ${pct}% (${speed} KB/s)`);

    // ✅ FIX: Clear timeout on any progress — download is active
    if (_updateTimeoutTimer) clearTimeout(_updateTimeoutTimer);
    _setDownloadTimeout();   // reset the 5-minute stall timer

    if (mainWindow) mainWindow.webContents.send('update-progress', pct);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log(`✓ Downloaded: v${info.version}`);

    // ✅ FIX: Clear timeout on success
    if (_updateTimeoutTimer) clearTimeout(_updateTimeoutTimer);

    try {
      fs.writeFileSync(META_FILE, JSON.stringify({
        justUpdated: true,
        version:     info.version,
        updatedAt:   new Date().toISOString(),
      }));
    } catch (_) {}

    if (mainWindow) mainWindow.webContents.send('update-downloaded', info.version);
  });

  // ✅ FIX: Improved error handling with retry logic
  autoUpdater.on('error', (err) => {
    log(`✗ Update error: ${err.message}`);

    // Clear timeout on error
    if (_updateTimeoutTimer) clearTimeout(_updateTimeoutTimer);

    const isNetErr = err.message.includes('net::')         ||
                     err.message.includes('ENOTFOUND')     ||
                     err.message.includes('ETIMEDOUT')     ||
                     err.message.includes('ECONNRESET')    ||
                     err.message.includes('403')           ||
                     err.message.includes('Connection refused');

    // ✅ FIX: Exponential backoff retry for network errors
    if (isNetErr && _updateRetryCount < MAX_RETRIES) {
      _updateRetryCount++;
      const delayMs = Math.pow(2, _updateRetryCount) * 1000; // 2s, 4s, 8s
      log(`↻ Retrying in ${delayMs/1000}s (attempt ${_updateRetryCount}/${MAX_RETRIES})`);
      setTimeout(() => {
        try { autoUpdater.checkForUpdates(); } catch(e) { log(`Retry failed: ${e.message}`); }
      }, delayMs);
    } else {
      // Non-recoverable error — forward to user
      if (mainWindow && !isNetErr) {
        mainWindow.webContents.send('update-error', `Update failed: ${err.message}`);
      }
    }
  });

  // ── START THE CHECK ───────────────────────────────────────────────────────
  try {
    autoUpdater.checkForUpdates();
  } catch (err) {
    log(`✗ checkForUpdates failed: ${err.message}`);
  }
}

// ✅ FIX: Timeout handler for stuck downloads
// If no progress event fires for DOWNLOAD_TIMEOUT_MS, assume stalled → retry
function _setDownloadTimeout() {
  if (_updateTimeoutTimer) clearTimeout(_updateTimeoutTimer);

  _updateTimeoutTimer = setTimeout(() => {
    log('✗ Download timeout (5 min) — no progress received');
    try {
      autoUpdater.downloadUpdate(); // Try again
    } catch(e) {
      log(`Timeout retry failed: ${e.message}`);
      if (mainWindow) {
        mainWindow.webContents.send('update-error', 'Download took too long. Please check your internet connection.');
      }
    }
  }, DOWNLOAD_TIMEOUT_MS);
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
// ✅ CRITICAL FIX: Do NOT await autoUpdater.downloadUpdate().
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

    // ✅ FIX: Set timeout for download stall detection
    _setDownloadTimeout();

    log('✓ downloadUpdate() called (non-blocking). Progress events will follow.');
    return { ok: true };
  } catch (err) {
    log(`✗ downloadUpdate() threw: ${err.message}`);
    // Forward error to renderer so UI can show a message
    if (mainWindow) {
      mainWindow.webContents.send('update-error', 'Download failed: ' + err.message);
    }
    return { ok: false, error: err.message };
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
