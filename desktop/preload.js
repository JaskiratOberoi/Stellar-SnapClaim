// Runs in the renderer before the web app loads. Exposes only what the app
// needs to know about its host; add IPC bridges here as desktop features grow.

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('assistantDesktop', {
  platform: process.platform,
  version: process.versions.electron,
});
