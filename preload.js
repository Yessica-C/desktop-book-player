const { contextBridge, webUtils } = require('electron');

contextBridge.exposeInMainWorld('bookPlayer', {
  backendUrl: 'http://127.0.0.1:8765',
  getPathForFile: (file) => webUtils.getPathForFile(file),
});
