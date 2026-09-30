const { contextBridge, webUtils } = require('electron');

contextBridge.exposeInMainWorld('bookPlayer', {
  backendUrl: `http://127.0.0.1:${process.env.BACKEND_PORT}`,
  getPathForFile: (file) => webUtils.getPathForFile(file),
});
