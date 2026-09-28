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
