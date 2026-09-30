const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');

let backendProcess;

function startBackend() {
  const isWindows = process.platform === 'win32';
  const configuredPython = process.env.PYTHON_PATH;
  const pythonCommand = configuredPython || (isWindows ? 'py' : 'python3');
  const pythonArgs = configuredPython ? ['-u'] : (isWindows ? ['-3', '-u'] : ['-u']);
  const backendRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend')
    : path.join(__dirname, 'backend');
  const backendPath = path.join(backendRoot, 'server.py');

  return new Promise((resolve, reject) => {
    const launch = (command, args, canRetry) => {
      const child = spawn(command, [...args, backendPath], {
        env: {
          ...process.env,
          BOOK_PLAYER_PORT: '0',
        },
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      backendProcess = child;

      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
        const portMatch = output.match(/Python backend listening on port (\d+)/);
        if (portMatch) {
          process.env.BACKEND_PORT = portMatch[1];
          resolve(Number(portMatch[1]));
        }
      });

      child.on('error', (error) => {
        if (canRetry) {
          launch('python', ['-u'], false);
          return;
        }

        reject(error);
      });
    };

    launch(pythonCommand, pythonArgs, !configuredPython && !isWindows && pythonCommand === 'python3');
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.openDevTools();
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(() => {
  startBackend()
    .then(() => createWindow())
    .catch((error) => console.error('Failed to start Python backend:', error));

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
