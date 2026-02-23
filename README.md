# ChessPulse - Multi-User Chess Analysis Platform

A comprehensive Node.js application that analyzes chess games in PGN format using the Stockfish engine. Features user authentication, multi-user support, and provides detailed performance dashboards with trend visualization.

## Prerequisites

- **Node.js** 20.x
- **npm** 10.x
- **Stockfish** chess engine (required for game analysis)

### Installing Stockfish

**macOS (Homebrew):**
```bash
brew install stockfish
```

**Ubuntu/Debian:**
```bash
sudo apt-get install stockfish
```

**Windows:**
Download from [stockfishchess.org](https://stockfishchess.org/download/) and add to `PATH`.

Verify installation:
```bash
stockfish --version
```

## Quick Start (Recommended)

Use the Makefile to set up everything in one step:

```bash
make setup   # Install all dependencies (Stockfish + npm packages)
make dev     # Start backend and frontend dev servers
```

## Installation

```bash
npm install
```

## Usage

### Analyze PGN Files

Analyze a single PGN file:
```bash
node src/models/analyzer.js game.pgn
```

Analyze with custom depth (default is 15):
```bash
node src/models/analyzer.js game.pgn 20
```

### Performance Dashboard

Start the dashboard server:
```bash
npm run dashboard
```

Then open http://localhost:3000 in your browser to view the performance dashboard.

## Features

### User Authentication & Multi-User Support
- Supabase authentication integration
- User-specific game analysis and progress tracking
- Secure user sessions and data isolation

### Core Analysis
- Parses PGN files using chess.js
- Evaluates each position with Stockfish
- Outputs detailed analysis in JSON format
- Configurable analysis depth

### Performance Dashboard
- Performance statistics with White/Black split
- Win rate, accuracy, and blunder tracking
- **NEW**: Rating progression over time
- **NEW**: Average centipawn loss trends
- Interactive line charts with hover tooltips
- Responsive design for mobile and desktop

### API Endpoints
- `GET /api/performance` - Get performance statistics
- `GET /api/trends` - Get rating and centipawn loss trends
- `GET /api/health` - Health check

## Dashboard Features

### Performance Overview
- Win rates split by White/Black pieces
- Accuracy percentages based on engine analysis
- Blunder counts (moves with >100 centipawn loss)

### Trend Visualization
- **Rating Progression Chart**: Interactive line chart showing rating changes over time
- **Centipawn Loss Trend**: Track improvement in move accuracy
- Hover tooltips showing game details
- Time-based filtering capabilities

## Output

The analyzer creates a JSON file with move-by-move analysis including:
- Move number and notation
- Position FEN
- Stockfish evaluation
- Best move suggestion

Example output: `game_analysis.json`

## Desktop App (macOS DMG)

ChessPulse ships as a self-contained macOS app — no external setup needed. Stockfish, SQLite, and the full backend are bundled inside.

### Run in dev mode (Electron, no DMG)

```bash
make electron-dev
```

### Build an unpacked `.app` (fast, for local testing)

```bash
make electron-build-dir        # builds to dist-electron/mac-arm64/ChessPulse.app
make install-local             # installs to /Applications, ad-hoc signs, and launches
```

### Build a distributable DMG

```bash
make prepare-stockfish         # download arm64 + x64 Stockfish binaries (one-time)
make dmg                       # builds dist-electron/ChessPulse-1.0.0-arm64.dmg
                               #         dist-electron/ChessPulse-1.0.0.dmg (Intel)
```

### Publish a release to GitHub

```bash
GH_TOKEN=<your-token> make release
```

### What's bundled in the DMG

| Component | Location inside app |
|---|---|
| Express backend | `app.asar` (in-process, no child spawn) |
| Angular frontend | `Resources/frontend/dist/chess-analyzer/` |
| Stockfish engine | `Resources/stockfish` |
| SQLite database | Created on first launch in `~/Library/Application Support/chesspulse/` |

### User data locations (macOS)

| Data | Path |
|---|---|
| Database | `~/Library/Application Support/chesspulse/chess_analysis.db` |
| PGN files | `~/Library/Application Support/chesspulse/data/pgn/` |
| Custom `.env` overrides | `~/Library/Application Support/chesspulse/.env` |

Each user gets a fresh database on first install — sign-up is required on first launch.

> See `docs/adr/011-macos-desktop-dmg-packaging.md` for architecture decisions.

## Testing

Run unit tests:
```bash
npm test unit.test.js
npm test trend-calculator.test.js
```

## Project Structure

See `PROJECT_STRUCTURE.md` for detailed code organization.
