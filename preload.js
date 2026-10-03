const { contextBridge, webUtils } = require('electron');

contextBridge.exposeInMainWorld('bookPlayer', {
  getPathForFile: (file) => webUtils.getPathForFile(file),
});
