'use strict';

const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const isDev = !app.isPackaged;

// ── Env loading ────────────────────────────────────────────────────────────────
// Must happen before any require() of server modules so env vars are in place.
// Dev:  project root .env  |  Prod: userData/.env (user drops credentials here)
function loadEnv() {
  const envPaths = isDev
    ? [path.join(__dirname, '../.env')]
    : [path.join(app.getPath('userData'), '.env')];

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
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

// ── Path helpers ───────────────────────────────────────────────────────────────

const SERVER_PORT = process.env.PORT || 3000;

function getStockfishPath() {
  if (isDev) return process.env.STOCKFISH_PATH || 'stockfish';
  const bundled = path.join(process.resourcesPath, 'stockfish');
  try { fs.chmodSync(bundled, 0o755); } catch (_) {}
  return bundled;
}

function getDbPath() {
  if (isDev) return path.join(__dirname, '../data/chess-analysis.db');
  return path.join(app.getPath('userData'), 'chess_analysis.db');
}

function getFrontendDist() {
  if (isDev) return path.join(__dirname, '../frontend/dist/chess-analyzer');
  return path.join(process.resourcesPath, 'frontend', 'dist', 'chess-analyzer');
}

// ── Express server (in-process) ────────────────────────────────────────────────
// Run Express in the Electron main process so require() has full asar support.
// No child process spawning — avoids ELECTRON_RUN_AS_NODE fuse requirements
// and all asar module resolution issues.

// Supabase public credentials — same values already bundled in the Angular frontend.
// The anon key is safe to embed; it only allows token verification via auth.getUser().
// Users can override either value via userData/.env (loaded by loadEnv() above).
const SUPABASE_URL_DEFAULT         = 'https://idegbwcvwodjtqoufuyh.supabase.co';
const SUPABASE_PUBLISHABLE_DEFAULT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZWdid2N2d29kanRxb3VmdXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODc4MzksImV4cCI6MjA4MTU2MzgzOX0.Bmpxuk3o1KywWSNegbpbR4bL_Frmwb1ZuSFUIDEXCKM';

function startServer() {
  // Inject env vars before any server module is loaded
  process.env.PORT            = String(SERVER_PORT);
  process.env.DB_PATH         = getDbPath();
  process.env.STOCKFISH_PATH  = getStockfishPath();
  process.env.FRONTEND_DIST   = getFrontendDist();
  process.env.DATA_DIR        = isDev
    ? path.join(__dirname, '../data')
    : path.join(app.getPath('userData'), 'data');
  process.env.NODE_ENV        = process.env.NODE_ENV || (isDev ? 'development' : 'production');

  // Set Supabase defaults only if not already provided via .env
  if (!process.env.SUPABASE_URL)              process.env.SUPABASE_URL              = SUPABASE_URL_DEFAULT;
  if (!process.env.SUPABASE_PUBLISHABLE_KEY)  process.env.SUPABASE_PUBLISHABLE_KEY  = SUPABASE_PUBLISHABLE_DEFAULT;

  console.log('🔧 Loading Express server in-process...');

  // Require the server — it auto-starts (calls initializeServices() internally)
  // Works because the Electron main process has full Node.js + asar support.
  try {
    require('../src/api/api-server');
  } catch (err) {
    return Promise.reject(err);
  }

  return pollHealth();
}

function pollHealth(attempt = 0) {
  const MAX_ATTEMPTS = 120; // 60s at 500ms intervals (Stockfish init can be slow)

  return new Promise((resolve, reject) => {
    const check = (n) => {
      if (n >= MAX_ATTEMPTS) {
        reject(new Error('Server did not become ready within 60 seconds'));
        return;
      }

      const req = http.get(`http://localhost:${SERVER_PORT}/api/health`, (res) => {
        // 200 = OK, 401 = auth required but server is up
        if (res.statusCode === 200 || res.statusCode === 401) {
          console.log(`✅ Server ready on port ${SERVER_PORT}`);
          resolve();
        } else {
          setTimeout(() => check(n + 1), 500);
        }
        res.resume();
      });

      req.on('error', () => setTimeout(() => check(n + 1), 500));
      req.setTimeout(400, () => { req.destroy(); setTimeout(() => check(n + 1), 500); });
    };

    check(0);
  });
}

// ── BrowserWindow ──────────────────────────────────────────────────────────────

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'ChessPulse',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  loadEnv();

  console.log(`🎯 ChessPulse starting (isDev=${isDev})`);
  console.log(`📂 userData : ${app.getPath('userData')}`);
  console.log(`🗃️  DB path  : ${getDbPath()}`);
  console.log(`♟️  Stockfish: ${getStockfishPath()}`);
  console.log(`🎨 Frontend : ${getFrontendDist()}`);

  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    dialog.showErrorBox(
      'ChessPulse failed to start',
      `Could not start the analysis server:\n\n${err.message}\n\nPlease check your installation and try again.`
    );
    app.quit();
  }
});

app.on('activate', () => { if (mainWindow === null) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Auto-updater ───────────────────────────────────────────────────────────────

if (!isDev) {
  const { autoUpdater } = require('electron-updater');

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => console.log('🔄 Checking for updates...'));
  autoUpdater.on('update-available',    (i) => console.log(`📦 Update available: ${i.version}`));
  autoUpdater.on('update-not-available',()  => console.log('✅ App is up to date'));
  autoUpdater.on('error',              (e)  => console.error('❌ Updater error:', e.message));
  autoUpdater.on('update-downloaded',  (i)  => {
    console.log(`✅ Update ${i.version} downloaded — installs on quit`);
    if (mainWindow) mainWindow.webContents.send('update-downloaded', { version: i.version });
  });

  setTimeout(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 10_000);
}
