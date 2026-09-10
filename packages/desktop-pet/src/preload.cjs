const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  hide: () => ipcRenderer.send('pet-hide'),
  close: () => ipcRenderer.send('pet-close'),
  selectSkin: () => ipcRenderer.invoke('pet-select-skin'),
  clearSkin: () => ipcRenderer.invoke('pet-clear-skin'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('pet-set-top', enabled),
  onSnapshot: (handler) => {
    const listener = (_event, snapshot) => handler(snapshot);
    ipcRenderer.on('gamification-snapshot', listener);
    return () => ipcRenderer.removeListener('gamification-snapshot', listener);
  },
  onOpenSkinPicker: (handler) => {
    const listener = () => handler();
    ipcRenderer.on('open-skin-picker', listener);
    return () => ipcRenderer.removeListener('open-skin-picker', listener);
  },
});
