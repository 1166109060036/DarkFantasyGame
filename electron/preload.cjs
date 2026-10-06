// The only bridge between the game page and the desktop shell.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  quit: () => ipcRenderer.send('quit'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
});
