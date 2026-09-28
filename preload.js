const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('bookPlayer', {
  backendUrl: 'http://127.0.0.1:8765',
});
