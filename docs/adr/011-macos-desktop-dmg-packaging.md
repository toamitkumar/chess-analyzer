# ADR 011: macOS Desktop App Packaging as DMG

## Status
**Proposed**

## Context

ChessPulse currently runs as a web application: an Express API server (port 3000) backed by SQLite, with an Angular frontend served either via `ng serve` (dev) or as static files built into `dist/`. Users must have Node.js, npm, and Stockfish installed and must manually start the server to use the app.

### Problem Statement
- High setup friction: users need Node.js, Stockfish, and CLI knowledge just to run the app
- No self-contained distribution: no way to hand the app to a non-technical user
- The full feature set (login, PGN upload, Stockfish analysis, SQLite persistence) must work offline, on a local machine, without any cloud dependency

### Goals
- Zero-dependency install: double-click DMG → drag to Applications → open and use
- Bundle Node.js runtime, Stockfish binary, Angular build, and SQLite database into a single `.app`
- Support the complete user flow: login → upload PGN → analyse → browse results → blunder navigation
- Auto-initialise SQLite schema on first launch
- Auto-start the Express API server as a background process inside the app
- macOS-native experience: menu bar, dock icon, about screen

### Non-Goals
- Windows / Linux packaging (separate ADR if needed)
- Cloud sync or multi-device support
- App Store distribution (notarisation only, no sandboxing constraints for now)

### Related Issues
- GitHub: [Tracking issue to be created]

---

## Decision

Package ChessPulse as a macOS `.app` bundle distributed via a signed `.dmg` using **Electron** as the host process, with the Express backend running as a child process inside the Electron main process and the Angular app loaded in an Electron `BrowserWindow`.

### Why Electron

| Option | Pros | Cons |
|---|---|---|
| **Electron** | Bundles Node.js runtime; proven for Node+web apps; large ecosystem (`electron-builder`); cross-platform path later | Larger bundle (~150MB); memory overhead |
| **Tauri** | Smaller bundle; Rust-based | Requires rewriting backend in Rust or running Node as a sidecar with extra complexity |
| **pkg (standalone Node)** | Packages Node app without Electron | No GUI shell; still need a separate WebView; no DMG tooling |
| **nw.js** | Similar to Electron | Smaller community; fewer tools |

Electron is the right fit because:
1. The backend is already Node.js — no rewrite needed
2. `electron-builder` produces signed `.dmg` with drag-to-install UX out of the box
3. The Angular build is standard static HTML/JS — trivially loaded in a `BrowserWindow`
4. Stockfish binary can be bundled as an `extraResource` and resolved at runtime via `process.resourcesPath`

---

## Architecture

```
ChessPulse.app/
├── Contents/
│   ├── MacOS/
│   │   └── ChessPulse              # Electron main process binary
│   ├── Resources/
│   │   ├── app/                    # Packaged Electron app
│   │   │   ├── main.js             # Electron main: starts Express, opens BrowserWindow
│   │   │   ├── preload.js          # Context bridge (minimal)
│   │   │   └── package.json
│   │   ├── server/                 # Express backend (bundled via pkg or copied as-is)
│   │   │   ├── src/
│   │   │   └── node_modules/
│   │   ├── frontend/               # Angular production build (dist/)
│   │   │   └── index.html, *.js, *.css
│   │   ├── stockfish               # Stockfish binary (arm64 + x86_64 universal)
│   │   └── data/
│   │       └── chess_analysis.db   # SQLite DB (created on first launch if absent)
│   └── Info.plist
```

### Startup Sequence

```
User opens ChessPulse.app
        │
        ▼
Electron main process (main.js)
        │
        ├── 1. Resolve paths (resourcesPath for stockfish, userData for SQLite)
        │
        ├── 2. Spawn Express server as child_process
        │       └── Wait for /api/health to respond (poll, max 30s)
        │
        ├── 3. Open BrowserWindow → load http://localhost:3000
        │
        └── 4. On app quit → kill Express child process
```

### Key Path Resolutions

```javascript
// main.js (Electron)

const isDev = !app.isPackaged;

const stockfishPath = isDev
  ? 'stockfish'                                      // system PATH in dev
  : path.join(process.resourcesPath, 'stockfish');   // bundled binary in prod

const dbPath = path.join(app.getPath('userData'), 'chess_analysis.db');
// → ~/Library/Application Support/ChessPulse/chess_analysis.db
```

SQLite database lives in `userData` (not inside the `.app` bundle) so it persists across app updates and is never overwritten on reinstall.

### Express Server Integration

The Express server is started as a `child_process.fork()` or `spawn()` inside `main.js`, with environment variables injected:

```javascript
const server = spawn(process.execPath, [serverEntryPoint], {
  env: {
    ...process.env,
    PORT: '3000',
    DB_PATH: dbPath,
    STOCKFISH_PATH: stockfishPath,
    NODE_ENV: 'production',
  }
});
```

`api-server.js` must be updated to read `STOCKFISH_PATH` from `process.env` (falling back to `'stockfish'` for backwards compatibility).

---

## Implementation Plan

### Phase 1 — Electron Shell
- [ ] Add `electron`, `electron-builder` as dev dependencies in root `package.json`
- [ ] Create `electron/main.js` — spawn Express, open BrowserWindow, handle lifecycle
- [ ] Create `electron/preload.js` — minimal context bridge
- [ ] Update `src/models/analyzer.js` to read `STOCKFISH_PATH` env var
- [ ] Smoke test: `npm run electron:dev` opens app with live backend

### Phase 2 — Production Build Pipeline
- [ ] Build Angular frontend (`ng build --configuration production`)
- [ ] Configure `electron-builder` in `package.json`:
  - `extraResources`: Stockfish universal binary, `server/`, `frontend/dist/`
  - `mac.target`: `dmg`
  - `mac.category`: `public.app-category.productivity`
- [ ] Makefile targets: `make electron-dev`, `make electron-build`, `make dmg`
- [ ] Test: packaged `.app` opens, backend starts, Angular loads

### Phase 3 — SQLite Auto-Init & Migration
- [ ] Pass `DB_PATH` env var through to `database.js`
- [ ] On first launch, `database.js` creates the file and runs all migrations automatically (already supported via existing migration system)
- [ ] Test: fresh install with no prior database initialises correctly

### Phase 4 — Auth & Full User Flow
- [ ] Validate Supabase auth works inside Electron (network calls to Supabase cloud are fine)
- [ ] Ensure PGN upload, Stockfish analysis, blunder navigation all function end-to-end
- [ ] Handle deep links if needed (`chessPulse://` URL scheme) for future sharing

### Phase 5 — DMG Polish & Distribution
- [ ] DMG background image and icon
- [ ] Apple Developer ID code signing (`electron-builder` + `codesign`)
- [ ] Notarisation via `notarytool` (required for Gatekeeper on macOS 10.15+)
- [ ] Auto-updater: `electron-updater` with GitHub Releases as update server
- [ ] Test install on a clean macOS machine (no Node, no Stockfish)

---

## Consequences

### Positive
- Zero setup for end users — drag, drop, open
- Full feature parity with the web app (login, upload, analysis, blunder review)
- SQLite data persists in `~/Library/Application Support/ChessPulse/` — survives updates
- Path to Windows/Linux packaging with minimal extra work (`electron-builder` supports both)
- Auto-update via GitHub Releases keeps users current without manual downloads

### Negative / Risks
- **Bundle size**: Electron adds ~80MB, Node runtime ~50MB, Stockfish ~30MB → expect ~200MB DMG
- **Signing cost**: Apple Developer Program required ($99/yr) for notarisation
- **Port conflict**: app hardcodes port 3000 — must detect conflicts and pick a free port at startup
- **Supabase dependency**: login requires internet; offline use limited to previously cached data
- **Maintenance**: Electron major versions require periodic updates; security patches must be applied promptly

### Mitigations
- Port conflict: use `portfinder` npm package to select a free port dynamically and pass it to both Express and the `BrowserWindow` URL
- Bundle size: acceptable for a desktop app; consider `asar` compression
- Signing: one-time setup; automate via CI (GitHub Actions + secrets)

---

## Alternatives Considered

### Ship as a Docker container
Users run `docker run chessPulse` and open `localhost:3000` in a browser. Rejected: Docker Desktop required; no native macOS feel; not zero-dependency for non-developers.

### Ship as a shell script installer
`install.sh` installs Node via `nvm`, Stockfish via Homebrew, then runs the server. Rejected: still requires developer tooling; fragile across macOS versions; no `.app` launcher.

### Use `pkg` to produce a standalone Node binary
`pkg` bundles Node + JS into a single executable. Rejected: no GUI shell, no DMG, no way to load Angular in a native window without a separate WebView layer — effectively reinvents Electron with more effort.

---

## References
- [Electron documentation](https://www.electronjs.org/docs/latest)
- [electron-builder DMG docs](https://www.electron.build/configuration/dmg)
- [Apple Notarisation guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [portfinder npm package](https://www.npmjs.com/package/portfinder)
- Existing ADR 002: Stockfish Singleton Pattern
- Existing ADR 003: Supabase Authentication
