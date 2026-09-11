const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  hide: () => ipcRenderer.send('pet-hide'),
  close: () => ipcRenderer.send('pet-close'),
  selectSkin: () => ipcRenderer.invoke('pet-select-skin'),
  clearSkin: () => ipcRenderer.invoke('pet-clear-skin'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('pet-set-top', enabled),
  setSize: (size) => ipcRenderer.invoke('pet-set-size', size),
  setSettingsOpen: (open) => ipcRenderer.send('pet-settings-open', open),
  onSnapshot: (handler) => {
    const listener = (_event, snapshot) => handler(snapshot);
    ipcRenderer.on('sppet-snapshot', listener);
    return () => ipcRenderer.removeListener('sppet-snapshot', listener);
  },
  onOpenSkinPicker: (handler) => {
    const listener = () => handler();
    ipcRenderer.on('open-skin-picker', listener);
    return () => ipcRenderer.removeListener('open-skin-picker', listener);
  },
  onOpenSettings: (handler) => {
    const listener = () => handler();
    ipcRenderer.on('open-pet-settings', listener);
    return () => ipcRenderer.removeListener('open-pet-settings', listener);
  },
});
