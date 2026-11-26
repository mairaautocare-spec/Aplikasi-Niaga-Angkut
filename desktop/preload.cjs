const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('niagaDesktop', {
  isElectron: true,
  printPage: () => ipcRenderer.invoke('niaga:print-page'),
  savePdf: (defaultFileName) => ipcRenderer.invoke('niaga:save-pdf', defaultFileName),
  saveFile: (payload) => ipcRenderer.invoke('niaga:save-file', payload),
});
