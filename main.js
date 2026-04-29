// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ClassCore — main.js  (Electron Main Process)                           ║
// ║  Place this file at:                                                    ║
// ║  C:\Users\via\Documents\My Project\ClassCore_Desktop\ClassCore\main.js  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const { autoUpdater } = require('electron-updater');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

// ── 1. PATHS ────────────────────────────────────────────────────────────────
// Data file: stored in the user's Documents/ClassCore folder so it
// survives app updates and reinstalls.
const DATA_DIR  = path.join(os.homedir(), 'Documents', 'ClassCore');
const DATA_FILE = path.join(DATA_DIR, 'classcore_data.json');
const META_FILE = path.join(DATA_DIR, 'update_meta.json');  // tracks "just updated"
const LOG_FILE  = path.join(DATA_DIR, 'classcore.log');

// Ensure the data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── 2. SIMPLE FILE LOGGER ───────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (_) {}
  console.log(msg);
}

// ── 3. MAIN WINDOW ──────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1280,
    height:          800,
    minWidth:        900,
    minHeight:       600,
    icon:            path.join(__dirname, 'assets', 'icon.png'),   // optional
    title:           'ClassCore — Tuition Management',
    backgroundColor: '#F7F5F0',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,    // ← SECURITY: keep enabled
      nodeIntegration:  false,   // ← SECURITY: keep disabled
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

  // Remove default menu bar (optional — cleaner look)
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── 4. APP LIFECYCLE ────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  // Check immediately on startup (1 second — enough for window to paint)
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


// ══════════════════════════════════════════════════════════════════════════════
//  5. AUTO-UPDATER  ← THE CORE UPDATE SYSTEM
//
//  electron-updater checks your GitHub Releases page for a file called
//  latest.yml.  If the version number in that file is higher than the
//  running app's version, it downloads the new installer automatically.
// ══════════════════════════════════════════════════════════════════════════════

function setupAutoUpdater() {
  // ── Config ────────────────────────────────────────────────────────────────
  autoUpdater.autoDownload    = false;  // Ask user before downloading
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  // CRITICAL: Disable update cache so GitHub always returns the latest version.json
  // Without this, the CDN serves a 5-minute cached version → updates appear slow.
  autoUpdater.requestHeaders = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma':        'no-cache',
    'Expires':       '0',
  };

  // ── Logging ───────────────────────────────────────────────────────────────
  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };

  // ── Events ────────────────────────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    log('Checking for updates...');
  });

  // NEW VERSION FOUND
  autoUpdater.on('update-available', (info) => {
    log(`Update available: v${info.version}`);
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info.version);
    }
  });

  // ALREADY LATEST
  autoUpdater.on('update-not-available', (info) => {
    log(`Already up to date: v${info.version}`);
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available', info.version);
    }
  });

  // DOWNLOAD PROGRESS
  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent);
    log(`Download: ${pct}% (${Math.round(progress.bytesPerSecond / 1024)} KB/s)`);
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', pct);
    }
  });

  // DOWNLOAD COMPLETE
  autoUpdater.on('update-downloaded', (info) => {
    log(`Downloaded: v${info.version}`);
    try {
      fs.writeFileSync(META_FILE, JSON.stringify({
        justUpdated: true,
        version:     info.version,
        updatedAt:   new Date().toISOString(),
      }));
    } catch (_) {}
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info.version);
    }
  });

  // ERROR — log it but never crash the app
  autoUpdater.on('error', (err) => {
    log(`Update error: ${err.message}`);
    // Only send to renderer if it's not a network error (don't spam user)
    if (mainWindow && !err.message.includes('net::') && !err.message.includes('ENOTFOUND')) {
      mainWindow.webContents.send('update-error', err.message);
    }
  });

  // ── Start the check ───────────────────────────────────────────────────────
  try {
    autoUpdater.checkForUpdates();
  } catch (err) {
    log(`checkForUpdates failed: ${err.message}`);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
//  6. IPC HANDLERS  — these are the bridge between index.html and main.js
//     index.html calls:  window.classcore.someMethod()
//     preload.js exposes: ipcRenderer.invoke('channel-name', args)
//     main.js handles:   ipcMain.handle('channel-name', handler)
// ══════════════════════════════════════════════════════════════════════════════

// ── App version ───────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

// ── Data path (shown in Settings) ────────────────────────────────────────
ipcMain.handle('get-data-path', () => DATA_FILE);

// ── Update meta (was app just updated?) ──────────────────────────────────
ipcMain.handle('get-update-meta', () => {
  try {
    if (!fs.existsSync(META_FILE)) return null;
    const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
    // Delete the flag so it only shows once
    fs.unlinkSync(META_FILE);
    return meta;
  } catch (_) { return null; }
});

// ── LOAD DATA ────────────────────────────────────────────────────────────
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

// ── SAVE DATA (async) ─────────────────────────────────────────────────────
ipcMain.handle('save-data', (event, payload) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    log(`saveData error: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// ── SAVE DATA SYNC (called on window close) ───────────────────────────────
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

// ── CHECK FOR UPDATE (manual, from Settings button) ───────────────────────
ipcMain.handle('check-update', () => {
  try {
    autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── DOWNLOAD UPDATE (user clicked "Update Now") ───────────────────────────
ipcMain.handle('download-update', async (event, payload) => {
  // 1. Save current data BEFORE downloading (data safety)
  if (payload) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
      log('Data saved before update download.');
    } catch (err) {
      log(`Pre-update save error: ${err.message}`);
    }
  }
  // 2. Start download
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    log(`downloadUpdate error: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// ── INSTALL UPDATE (user clicked "Restart & Install") ────────────────────
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

// ── EXPORT BACKUP ────────────────────────────────────────────────────────
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

// ── IMPORT BACKUP ────────────────────────────────────────────────────────
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

// ── PRINT ────────────────────────────────────────────────────────────────
ipcMain.handle('print-content', async (event, html, paperSize) => {
  const win = new BrowserWindow({
    show:            false,
    webPreferences:  { nodeIntegration: false, contextIsolation: true },
  });
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise(res => win.webContents.once('did-finish-load', res));
  try {
    await win.webContents.print({
      silent:          false,
      printBackground: true,
      pageSize:        paperSize || 'A4',
    });
    win.close();
    return { ok: true };
  } catch (err) {
    win.close();
    return { ok: false, error: err.message };
  }
});

// ── SAVE PDF ────────────────────────────────────────────────────────────
ipcMain.handle('save-pdf', async (event, html, filename, paperSize) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title:       'Save PDF',
    defaultPath: path.join(os.homedir(), 'Desktop', (filename || 'ClassCore') + '.pdf'),
    filters:     [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false };
  return _generatePDF(html, filePath, paperSize);
});

// ── SAVE PDF SILENTLY (no dialog — for WhatsApp share) ────────────────
ipcMain.handle('save-pdf-silent', async (event, html, filename, paperSize) => {
  const filePath = path.join(os.homedir(), 'Documents', 'ClassCore', 'Receipts',
                             (filename || 'Receipt') + '.pdf');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const result = await _generatePDF(html, filePath, paperSize);
  if (result.ok) shell.showItemInFolder(filePath);
  return result;
});

// ── PDF HELPER ────────────────────────────────────────────────────────
async function _generatePDF(html, filePath, paperSize) {
  const win = new BrowserWindow({
    show:           false,
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

// ── DATE STRING HELPER ────────────────────────────────────────────────
function _dateStr() {
  return new Date().toISOString().slice(0, 10);
}
