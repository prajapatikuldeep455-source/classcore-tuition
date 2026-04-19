// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ClassCore — preload.js                                                 ║
// ║  Place at: ClassCore/preload.js  (same folder as main.js)              ║
// ║                                                                         ║
// ║  This file is the ONLY bridge between the web page (index.html) and    ║
// ║  Electron's main process (main.js).  It exposes ONLY the methods       ║
// ║  ClassCore needs — nothing more.  contextIsolation keeps it secure.    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('classcore', {

  // ── DATA ────────────────────────────────────────────────────────────────

  /** Load all data from the JSON file on disk */
  loadData: () =>
    ipcRenderer.invoke('load-data'),

  /** Save all data to disk (async — used normally) */
  saveData: (payload) =>
    ipcRenderer.invoke('save-data', payload),

  /** Save synchronously — called on window close to avoid data loss */
  saveDataSync: (payload) =>
    ipcRenderer.sendSync('save-data-sync', payload),

  /** Returns the full file path of the data file (shown in Settings) */
  getDataPath: () =>
    ipcRenderer.invoke('get-data-path'),


  // ── APP INFO ─────────────────────────────────────────────────────────────

  /** Returns the version string from package.json, e.g. "1.5.0" */
  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),

  /**
   * Returns { justUpdated, version } if the app was just updated,
   * or null if this is a normal launch.
   */
  getUpdateMeta: () =>
    ipcRenderer.invoke('get-update-meta'),


  // ── UPDATES ──────────────────────────────────────────────────────────────

  /** Manually trigger an update check (called from Settings button) */
  checkUpdate: () =>
    ipcRenderer.invoke('check-update'),

  /**
   * Start downloading the update.
   * Pass current data payload so it gets saved BEFORE the download starts.
   * @param {object|null} dataPayload  — the full app data to save first
   */
  downloadUpdate: (dataPayload) =>
    ipcRenderer.invoke('download-update', dataPayload),

  /** Quit the app and install the downloaded update */
  installUpdate: () =>
    ipcRenderer.invoke('install-update'),

  // ── UPDATE EVENTS (renderer listens for these from main) ─────────────────

  /**
   * Fires when a newer version is found on GitHub.
   * @param {function} cb  — called with (version: string)
   */
  onUpdateAvailable: (cb) =>
    ipcRenderer.on('update-available', (_event, version) => cb(version)),

  /** Fires repeatedly during download with the current percentage 0–100 */
  onUpdateProgress: (cb) =>
    ipcRenderer.on('update-progress', (_event, pct) => cb(pct)),

  /** Fires when the download is complete and ready to install */
  onUpdateDownloaded: (cb) =>
    ipcRenderer.on('update-downloaded', (_event, version) => cb(version)),

  /** Fires if no update is available (used by manual check button) */
  onUpdateNotAvailable: (cb) =>
    ipcRenderer.on('update-not-available', (_event, version) => cb(version)),

  /** Fires if an update check or download fails */
  onUpdateError: (cb) =>
    ipcRenderer.on('update-error', (_event, msg) => cb(msg)),

  /**
   * Fires as soon as the page loads — pushes the app version string.
   * More reliable than getAppVersion() because it doesn't need a round-trip.
   */
  onAppVersion: (cb) =>
    ipcRenderer.on('app-version', (_event, version) => cb(version)),


  // ── PRINT & PDF ──────────────────────────────────────────────────────────

  /** Open the system print dialog for the given HTML string */
  printContent: (html, paperSize) =>
    ipcRenderer.invoke('print-content', html, paperSize),

  /** Show a Save dialog and write a PDF file */
  savePDF: (html, filename, paperSize) =>
    ipcRenderer.invoke('save-pdf', html, filename, paperSize),

  /** Save a PDF silently (no dialog) — used for WhatsApp share flow */
  savePDFSilent: (html, filename, paperSize) =>
    ipcRenderer.invoke('save-pdf-silent', html, filename, paperSize),


  // ── BACKUP ───────────────────────────────────────────────────────────────

  /** Show a Save dialog and export a full JSON backup */
  exportBackup: (data) =>
    ipcRenderer.invoke('export-backup', data),

  /** Show an Open dialog and read a JSON backup file */
  importBackup: () =>
    ipcRenderer.invoke('import-backup'),

});
