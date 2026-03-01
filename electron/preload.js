'use strict';

const { contextBridge } = require('electron');

// Expose a minimal, safe API surface to the renderer process.
// Keep this as small as possible — prefer handling everything server-side.
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
