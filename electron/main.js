'use strict';

const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const isDev = !app.isPackaged;

// Load env vars early so they are available when the Express child is spawned.
// Dev:  project root .env  (standard dotenv location)
// Prod: userData/.env      (user drops credentials here after first install)
function loadEnv() {
  const envPaths = isDev
    ? [path.join(__dirname, '../.env')]
    : [
        path.join(app.getPath('userData'), '.env'),     // user-provided creds
        path.join(process.resourcesPath, 'app.asar.unpacked', '.env'), // build-time baked (non-secret only)
      ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !(key in process.env)) process.env[key] = val;
      }
      console.log(`📋 Loaded env from: ${envPath}`);
    }
  }
}

let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = process.env.PORT || 3000;

// ── Path resolution ────────────────────────────────────────────────────────────

function getStockfishPath() {
  if (isDev) return process.env.STOCKFISH_PATH || 'stockfish';
  const bundled = path.join(process.resourcesPath, 'stockfish');
  // Ensure executable bit is set — may be lost during DMG creation
  try { fs.chmodSync(bundled, 0o755); } catch (_) {}
  return bundled;
}

function getDbPath() {
  if (isDev) return path.join(__dirname, '../data/chess-analysis.db');
  return path.join(app.getPath('userData'), 'chess_analysis.db');
}

function getServerEntry() {
  if (isDev) return path.join(__dirname, '../src/api/api-server.js');
  // In production, src/ is asarUnpacked — accessible as real files on disk
  return path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'api', 'api-server.js');
}

function getFrontendDist() {
  if (isDev) return path.join(__dirname, '../frontend/dist/chess-analyzer');
  // Frontend is in extraResources → Resources/frontend/dist/chess-analyzer
  return path.join(process.resourcesPath, 'frontend', 'dist', 'chess-analyzer');
}

// ── Express server lifecycle ───────────────────────────────────────────────────

function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🔧 Spawning Express server...');

    serverProcess = spawn(process.execPath, [getServerEntry()], {
      env: {
        ...process.env,
        PORT: String(SERVER_PORT),
        DB_PATH: getDbPath(),
        STOCKFISH_PATH: getStockfishPath(),
        FRONTEND_DIST: getFrontendDist(),
        NODE_ENV: isDev ? 'development' : 'production',
        ELECTRON: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (data) => {
      process.stdout.write(`[server] ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
      process.stderr.write(`[server:err] ${data}`);
    });

    serverProcess.on('error', (err) => {
      console.error('❌ Failed to spawn server:', err.message);
      reject(err);
    });

    serverProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`❌ Server exited unexpectedly (code ${code})`);
      }
      serverProcess = null;
    });

    pollHealth(resolve, reject);
  });
}

function pollHealth(resolve, reject, attempt = 0) {
  const MAX_ATTEMPTS = 60; // 30s at 500ms intervals

  if (attempt >= MAX_ATTEMPTS) {
    reject(new Error('Server did not become ready within 30 seconds'));
    return;
  }

  const req = http.get(`http://localhost:${SERVER_PORT}/api/health`, (res) => {
    // 200 = healthy, 401 = auth required but server is up — both mean ready
    if (res.statusCode === 200 || res.statusCode === 401) {
      console.log(`✅ Server ready on port ${SERVER_PORT}`);
      resolve();
    } else {
      setTimeout(() => pollHealth(resolve, reject, attempt + 1), 500);
    }
    res.resume(); // drain to avoid socket hang
  });

  req.on('error', () => {
    setTimeout(() => pollHealth(resolve, reject, attempt + 1), 500);
  });

  req.setTimeout(400, () => {
    req.destroy();
    setTimeout(() => pollHealth(resolve, reject, attempt + 1), 500);
  });
}

function stopServer() {
  if (serverProcess) {
    console.log('🛑 Stopping Express server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// ── BrowserWindow ──────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'ChessPulse',
    show: false, // reveal after paint to avoid white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open <a target="_blank"> links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  loadEnv();
  console.log(`🎯 ChessPulse starting (isDev=${isDev})`);
  console.log(`📂 userData : ${app.getPath('userData')}`);
  console.log(`🗃️  DB path  : ${getDbPath()}`);
  console.log(`♟️  Stockfish: ${getStockfishPath()}`);

  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    dialog.showErrorBox(
      'ChessPulse failed to start',
      `Could not start the analysis server:\n\n${err.message}\n\nCheck that Stockfish is installed and try again.`
    );
    app.quit();
  }
});

// macOS: re-create window when dock icon is clicked and no windows are open
app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// Quit when all windows are closed (non-macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up server on quit
app.on('before-quit', stopServer);

// ── Auto-updater ───────────────────────────────────────────────────────────────
// Only active in packaged builds. Checks GitHub Releases for new versions.
if (!isDev) {
  const { autoUpdater } = require('electron-updater');

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => console.log('🔄 Checking for updates...'));
  autoUpdater.on('update-available', (info) => console.log(`📦 Update available: ${info.version}`));
  autoUpdater.on('update-not-available', () => console.log('✅ App is up to date'));
  autoUpdater.on('error', (err) => console.error('❌ Updater error:', err.message));
  autoUpdater.on('update-downloaded', (info) => {
    console.log(`✅ Update ${info.version} downloaded — will install on quit`);
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', { version: info.version });
    }
  });

  // Check for updates 10 seconds after launch (give the app time to settle)
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 10_000);
}
