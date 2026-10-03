# desktop-book-player
Desktop Graphical audiobook player app for Windows & Linux

## Tech stack
- Electron desktop shell

## Run locally
Requires Node.js 24 or newer.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm start
   ```


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
