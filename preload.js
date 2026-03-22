const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('classcore', {
  // Data
  loadData:       ()               => ipcRenderer.invoke('load-data'),
  saveData:       (data)           => ipcRenderer.invoke('save-data', data),
  saveDataSync:   (data)           => ipcRenderer.sendSync('save-data-sync', data),
  exportBackup:   (data)           => ipcRenderer.invoke('export-backup', data),
  importBackup:   ()               => ipcRenderer.invoke('import-backup'),
  getDataPath:    ()               => ipcRenderer.invoke('get-data-path'),
  getAppVersion:  ()               => ipcRenderer.invoke('get-app-version'),
  getUpdateMeta:  ()               => ipcRenderer.invoke('get-update-meta'),
  // Print & PDF
  printContent:   (html)           => ipcRenderer.invoke('print-content', html),
  savePDF:        (html, name)     => ipcRenderer.invoke('save-pdf', html, name),
  // Auto Update
  checkUpdate:    ()               => ipcRenderer.invoke('check-update'),
  downloadUpdate: (data)           => ipcRenderer.invoke('download-update', data),
  installUpdate:  ()               => ipcRenderer.invoke('install-update'),
  onUpdateAvailable:    (cb)       => ipcRenderer.on('update-available', (e, version, notes) => cb(version, notes)),
  onUpdateProgress:     (cb)       => ipcRenderer.on('update-progress', (e, pct) => cb(pct)),
  onUpdateDownloaded:   (cb)       => ipcRenderer.on('update-downloaded', () => cb()),
});
