const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');

const BACKEND_PORT = 8765;
let backendProcess;

function startBackend() {
  const pythonCommand = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
  const backendPath = path.join(__dirname, 'backend', 'server.py');

  backendProcess = spawn(pythonCommand, [backendPath], {
    env: {
      ...process.env,
      BOOK_PLAYER_PORT: String(BACKEND_PORT),
    },
    stdio: 'inherit',
  });

  backendProcess.on('error', (error) => {
    console.error('Failed to start Python backend:', error);
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
