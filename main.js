const { app, BrowserWindow, ipcMain, ipcRenderer, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

const dataDir = path.join(app.getPath('documents'), 'ClassCore');
const dataFile = path.join(dataDir, 'classcore_data.json');
const versionFile = path.join(dataDir, 'version.json');
const indexFile = path.join(__dirname, 'index.html');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const GITHUB_USER = 'prajapatikuldeep455-source';
const GITHUB_REPO = 'classcore-tuition';
const VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/version.json`;
const INDEX_URL   = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/index.html`;

let mainWindow;
let latestData = null; // keep last known data in memory

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'ClassCore Tuition Management',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#F7F5F0',
    show: false
  });
  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setTimeout(() => checkForUpdates(), 4000);
  });
  mainWindow.setMenuBarVisibility(false);

  // Before window closes → ask renderer to send data, then save synchronously
  mainWindow.on('close', (e) => {
    if (latestData) {
      try {
        fs.writeFileSync(dataFile, JSON.stringify(latestData, null, 2), 'utf8');
      } catch(err) {
        console.error('Final save error:', err);
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Data ──────────────────────────────────────────────────────────────────
ipcMain.handle('load-data', () => {
  try {
    if (fs.existsSync(dataFile)) {
      const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      latestData = d; // cache it
      return d;
    }
    return null;
  } catch(e) { return null; }
});

// Async save (called after every change)
ipcMain.handle('save-data', (e, data) => {
  try {
    latestData = data; // always update memory cache
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true };
  } catch(e) {
    console.error('Save error:', e);
    return { ok: false, error: e.message };
  }
});

// Synchronous save (called from sendSync on close)
ipcMain.on('save-data-sync', (e, data) => {
  try {
    latestData = data;
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
    e.returnValue = true;
  } catch(err) {
    console.error('Sync save error:', err);
    e.returnValue = false;
  }
});

ipcMain.handle('get-data-path', () => dataFile);

// ── Backup ────────────────────────────────────────────────────────────────
ipcMain.handle('export-backup', async (e, data) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export ClassCore Backup',
    defaultPath: `ClassCore_Backup_${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: 'JSON Backup', extensions: ['json'] }]
  });
  if (!filePath) return { ok: false };
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); return { ok: true }; }
  catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('import-backup', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Import ClassCore Backup',
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (!filePaths || !filePaths[0]) return { ok: false };
  try { return { ok: true, data: JSON.parse(fs.readFileSync(filePaths[0], 'utf8')) }; }
  catch(e) { return { ok: false, error: 'Invalid backup file' }; }
});

// ── Auto Update ───────────────────────────────────────────────────────────
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'ClassCore-App' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) return fetchURL(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function getCurrentVersion() {
  try {
    if (fs.existsSync(versionFile)) return JSON.parse(fs.readFileSync(versionFile, 'utf8')).version || '1.0.0';
  } catch(e) {}
  return '1.0.0';
}

async function checkForUpdates() {
  try {
    const raw = await fetchURL(VERSION_URL);
    const remote = JSON.parse(raw);
    const current = getCurrentVersion();
    if (remote.version && remote.version !== current) {
      mainWindow.webContents.send('update-available', remote.version, remote.notes || '');
    }
  } catch(e) { console.log('Update check failed:', e.message); }
}

ipcMain.handle('check-update', async () => { await checkForUpdates(); return { ok: true }; });

ipcMain.handle('download-update', async (e, currentData) => {
  try {
    // STEP 1: Save current data to main file (make sure nothing is lost)
    mainWindow.webContents.send('update-progress', 5);
    if (currentData) {
      fs.writeFileSync(dataFile, JSON.stringify(currentData, null, 2), 'utf8');
    } else if (latestData) {
      fs.writeFileSync(dataFile, JSON.stringify(latestData, null, 2), 'utf8');
    }

    // STEP 2: Create a backup copy before update
    const backupFile = path.join(dataDir, `backup_before_update_${Date.now()}.json`);
    if (fs.existsSync(dataFile)) {
      fs.copyFileSync(dataFile, backupFile);
    }
    mainWindow.webContents.send('update-progress', 15);

    // STEP 3: Download new index.html from GitHub
    const newIndex = await fetchURL(INDEX_URL);
    mainWindow.webContents.send('update-progress', 60);

    // STEP 4: Download new version.json
    const newVersion = await fetchURL(VERSION_URL);
    mainWindow.webContents.send('update-progress', 85);

    // STEP 5: Write new files
    fs.writeFileSync(indexFile, newIndex, 'utf8');
    fs.writeFileSync(versionFile, newVersion, 'utf8');

    // STEP 6: Mark that we just updated (so app shows "updated" message on restart)
    const updateMeta = { justUpdated: true, version: JSON.parse(newVersion).version, timestamp: new Date().toISOString() };
    fs.writeFileSync(path.join(dataDir, 'update_meta.json'), JSON.stringify(updateMeta), 'utf8');

    mainWindow.webContents.send('update-progress', 100);
    mainWindow.webContents.send('update-downloaded');
    return { ok: true };
  } catch(e) {
    console.error('Update download error:', e);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('install-update', () => {
  // Final data save before restart
  if (latestData) {
    try { fs.writeFileSync(dataFile, JSON.stringify(latestData, null, 2), 'utf8'); } catch(e) {}
  }
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('get-app-version', () => getCurrentVersion());

// Check if we just updated and return meta info
ipcMain.handle('get-update-meta', () => {
  const metaFile = path.join(dataDir, 'update_meta.json');
  try {
    if (fs.existsSync(metaFile)) {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      fs.unlinkSync(metaFile); // delete so it only shows once
      return meta;
    }
  } catch(e) {}
  return null;
});

// ── Print ─────────────────────────────────────────────────────────────────
ipcMain.handle('print-content', async (e, html) => {
  return new Promise((resolve) => {
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        win.webContents.print({ silent: false, printBackground: true }, (success, err) => {
          win.close(); resolve({ ok: success, error: err });
        });
      }, 500);
    });
  });
});

// ── PDF ───────────────────────────────────────────────────────────────────
ipcMain.handle('save-pdf', async (e, html, defaultName) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Save as PDF',
    defaultPath: (defaultName || 'ClassCore_Export') + '.pdf',
    filters: [{ name: 'PDF File', extensions: ['pdf'] }]
  });
  if (!filePath) return { ok: false };
  return new Promise((resolve) => {
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 } })
          .then(data => { fs.writeFileSync(filePath, data); win.close(); resolve({ ok: true }); })
          .catch(err => { win.close(); resolve({ ok: false, error: err.message }); });
      }, 500);
    });
  });
});
