# desktop-book-player
Desktop Graphical audiobook player app for Windows & Linux

## Tech stack
- Electron desktop shell
- Python backend service

## Run locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm start
   ```

The Electron process starts the Python backend automatically and checks `http://127.0.0.1:8765/health` from the renderer.

## Build an Ubuntu AppImage

```bash
npm install
npm run dist:linux
```

The executable is created in `dist/` as `Desktop Book Player-1.0.0.AppImage`.
Run it on Ubuntu with:

```bash
chmod +x "dist/Desktop Book Player-1.0.0.AppImage"
"dist/Desktop Book Player-1.0.0.AppImage"
```

## Build a Windows installer

```bash
npm install
npm run dist:win
```

The NSIS installer is created in `dist/` as `Desktop Book Player Setup 1.0.0.exe`.

The GitHub Actions workflow in `.github/workflows/build-windows.yml` builds this installer on `windows-latest` and uploads it as a workflow artifact.
