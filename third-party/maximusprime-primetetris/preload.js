const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getHighScore: () => ipcRenderer.invoke('get-high-score'),
    saveHighScore: (score) => ipcRenderer.send('save-high-score', score),
    resetHighScore: () => ipcRenderer.send('reset-high-score'),
    openExternal: (url) => ipcRenderer.send('open-external', url)
});
