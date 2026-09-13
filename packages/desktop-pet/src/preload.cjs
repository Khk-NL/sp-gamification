const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  hide: () => ipcRenderer.send('pet-hide'),
  close: () => ipcRenderer.send('pet-close'),
  selectSkin: () => ipcRenderer.invoke('pet-select-skin'),
  clearSkin: () => ipcRenderer.invoke('pet-clear-skin'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('pet-set-top', enabled),
  setSize: (size) => ipcRenderer.invoke('pet-set-size', size),
  importCharacter: () => ipcRenderer.invoke('pet-import-character'),
  selectCharacter: (id) => ipcRenderer.invoke('pet-select-character', id),
  deleteCharacter: (id) => ipcRenderer.invoke('pet-delete-character', id),
  setBehavior: (changes) => ipcRenderer.invoke('pet-set-behavior', changes),
  setLayers: (changes) => ipcRenderer.invoke('pet-set-layers', changes),
  updateAiSettings: (changes) => ipcRenderer.invoke('ai-update-settings', changes),
  updateProfile: (changes) => ipcRenderer.invoke('ai-update-profile', changes),
  getAiSnapshot: () => ipcRenderer.invoke('ai-get-snapshot'),
  setAiKey: (value) => ipcRenderer.invoke('ai-set-key', value),
  chat: (value) => ipcRenderer.invoke('ai-chat', value),
  deleteHistory: (id) => ipcRenderer.invoke('ai-delete-history', id),
  clearHistory: () => ipcRenderer.invoke('ai-clear-history'),
  deleteMemory: (id) => ipcRenderer.invoke('ai-delete-memory', id),
  clearMemories: () => ipcRenderer.invoke('ai-clear-memories'),
  updateAwarenessSettings: (changes) => ipcRenderer.invoke('awareness-update-settings', changes),
  readCurrentWindow: () => ipcRenderer.invoke('awareness-read-window'),
  analyzeScreen: () => ipcRenderer.invoke('awareness-vision'),
  updateFocusSettings: (changes) => ipcRenderer.invoke('focus-update-settings', changes),
  startFocus: () => ipcRenderer.invoke('focus-start'),
  cancelFocus: () => ipcRenderer.invoke('focus-cancel'),
  replaceProductivity: (moduleName, value) => ipcRenderer.invoke('productivity-replace', moduleName, value),
  analyzeTodayJournal: () => ipcRenderer.invoke('productivity-journal-ai'),
  generateObservationJournal: () => ipcRenderer.invoke('observation-generate'),
  clearObservations: () => ipcRenderer.invoke('observation-clear'),
  updateTtsSettings: (changes) => ipcRenderer.invoke('tts-update-settings', changes),
  setTtsKey: (value) => ipcRenderer.invoke('tts-set-key', value),
  speak: (value) => ipcRenderer.invoke('tts-speak', value),
  updateBehaviorSettings: (changes) => ipcRenderer.invoke('behavior-update-settings', changes),
  wakePet: () => ipcRenderer.invoke('behavior-wake'),
  setSettingsOpen: (open) => ipcRenderer.send('pet-settings-open', open),
  setInteractive: (interactive) => ipcRenderer.send('pet-set-interactive', interactive),
  focusWindow: () => ipcRenderer.send('pet-focus-window'),
  dragStart: (visibleRect) => ipcRenderer.send('pet-drag-start', visibleRect),
  dragMove: () => ipcRenderer.send('pet-drag-move'),
  dragEnd: () => ipcRenderer.send('pet-drag-end'),
  touched: () => ipcRenderer.send('pet-touched'),
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
  onMotionState: (handler) => {
    const listener = (_event, state) => handler(state);
    ipcRenderer.on('pet-motion-state', listener);
    return () => ipcRenderer.removeListener('pet-motion-state', listener);
  },
  onFocusSnapshot: (handler) => { const listener = (_event, value) => handler(value); ipcRenderer.on('focus-snapshot', listener); return () => ipcRenderer.removeListener('focus-snapshot', listener); },
  onFocusCompleted: (handler) => { const listener = (_event, value) => handler(value); ipcRenderer.on('focus-completed', listener); return () => ipcRenderer.removeListener('focus-completed', listener); },
  onFocusWindowCategory: (handler) => { const listener = (_event, value) => handler(value); ipcRenderer.on('focus-window-category', listener); return () => ipcRenderer.removeListener('focus-window-category', listener); },
  onProductivityEvent: (handler) => { const listener = (_event, value) => handler(value); ipcRenderer.on('productivity-event', listener); return () => ipcRenderer.removeListener('productivity-event', listener); },
  onBehaviorEvent: (handler) => { const listener = (_event, value) => handler(value); ipcRenderer.on('behavior-event', listener); return () => ipcRenderer.removeListener('behavior-event', listener); },
});
