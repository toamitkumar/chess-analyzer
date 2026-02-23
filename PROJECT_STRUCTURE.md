# Project Structure

## Root

```
chessify/
├── package.json              # Backend dependencies & npm scripts
├── jest.config.js            # Jest test configuration
├── Makefile                  # Developer workflow commands (setup, dev, build, dmg)
├── README.md                 # Project documentation
├── PROJECT_STRUCTURE.md      # This file
├── nixpacks.toml             # Railway/Nixpacks deployment config
├── railway.json / railway.toml  # Railway deployment config
│
├── electron/                 # Electron desktop app shell
├── frontend/                 # Angular web frontend
├── src/                      # Node.js/Express backend
├── scripts/                  # Build and utility scripts
├── tests/                    # Test suite
├── docs/                     # Architecture decisions and guides
├── data/                     # Local SQLite database (dev)
└── supabase/                 # Supabase project config
```

---

## Backend (`src/`)

```
src/
├── api/
│   ├── api-server.js         # Express app: middleware, static serving, server lifecycle
│   ├── controllers/
│   │   ├── blunder.controller.js      # Blunder review, navigation, marking learned
│   │   ├── dashboard.controller.js    # Performance metrics, heatmap, trends
│   │   ├── game.controller.js         # Game listing, detail, analysis retrieval
│   │   ├── health.controller.js       # /api/health readiness probe
│   │   ├── insights.controller.js     # Chess.com-style insights aggregation
│   │   ├── tournament.controller.js   # Tournament CRUD and game linking
│   │   └── upload.controller.js       # PGN file upload and manual entry
│   └── routes/
│       ├── index.js                   # Router factory — mounts all sub-routers
│       ├── blunder.routes.js
│       ├── dashboard.routes.js
│       ├── game.routes.js
│       ├── health.routes.js
│       ├── insights.routes.js
│       ├── tournament.routes.js
│       └── upload.routes.js
│
├── config/
│   ├── app-config.js         # Global constants (TARGET_PLAYER, etc.)
│   ├── database.js           # SQLite / PostgreSQL dual-mode connection
│   └── theme-mapping.js      # Opening theme → display label mapping
│
├── middleware/
│   ├── supabase-auth.js      # JWT verification via Supabase, user sync to DB
│   └── access-code.js        # Optional access-code gate middleware
│
├── models/
│   ├── analyzer.js            # Stockfish engine wrapper (spawn, UCI protocol, eval)
│   ├── database.js            # Database class with query helpers and migrations runner
│   ├── performance-stats.js   # Win/draw/loss rates, accuracy, blunder aggregation
│   ├── accuracy-calculator.js # Centipawn-loss → accuracy % conversion
│   ├── blunder-categorizer.js # Classify blunders by tactical theme
│   ├── evaluation-normalizer.js  # Normalise Stockfish eval scores
│   ├── win-probability.js     # Centipawn eval → win probability (logistic)
│   ├── HeatmapCalculator.js   # Move-quality square heatmaps
│   ├── trend-calculator.js    # Weekly/monthly performance trends
│   ├── opening-detector.js    # ECO opening identification
│   ├── tournament-manager.js  # Tournament record creation and lookup
│   ├── tournament-analyzer.js # Tournament-level stats aggregation
│   ├── tactical-detector.js   # Tactical pattern detection in positions
│   ├── analysis-config.js     # Stockfish analysis parameters
│   ├── file-storage.js        # PGN file storage in userData/data/
│   ├── learning-path-generator.js  # Personalised learning path generation
│   ├── lichess-api-client.js  # Lichess public API integration
│   ├── puzzle-blunder-linker.js    # Link blunders to matching Lichess puzzles
│   ├── puzzle-cache-manager.js     # Puzzle result caching
│   ├── puzzle-matcher.js      # Match positions to puzzle database
│   ├── puzzle-progress-tracker.js  # User puzzle attempt tracking
│   └── theme-mapper.js        # Map Lichess puzzle themes to display categories
│   └── migrations/            # SQLite schema migrations (run on DB init)
│       ├── 001_add_pgn_content.js
│       ├── 002_add_analysis_tables.js
│       ├── 003_add_game_analysis_tables.js
│       ├── 004_create_chess_openings.js
│       ├── 005_add_mistake_inaccuracy_columns.js
│       ├── 006_add_enhanced_analysis_fields.js
│       ├── 007_create_blunder_details.js
│       ├── 008_add_fen_before_column.js
│       ├── 009_add_move_type_to_blunder_details.js
│       ├── 010_add_player_to_blunder_details.js
│       ├── 011_fix_cascade_delete_constraints.js
│       ├── 012_create_puzzle_index.js
│       ├── 013_create_puzzle_cache.js
│       ├── 014_create_blunder_puzzle_links.js
│       ├── 015_create_puzzle_progress_tables.js
│       ├── 016_add_user_authentication.js
│       ├── 017_add_user_color.js
│       ├── 018_fix_tournament_unique_constraint.js
│       └── 019_create_tactical_tracking_tables.js
│
└── services/
    ├── PGNParser.js                  # Parse and validate PGN files
    ├── PGNUploadService.js           # Orchestrate upload → parse → analyse → store
    ├── GameAnalysisService.js        # Run Stockfish analysis on parsed games
    ├── GameStorageService.js         # Persist games and analysis to DB
    ├── BlunderService.js             # Blunder retrieval, filtering, pagination
    ├── DashboardService.js           # Aggregate dashboard metrics
    ├── InsightsService.js            # Chess.com-style insights generation
    ├── OpponentBlunderService.js     # Track opponent blunders / missed wins
    ├── TacticalOpportunityService.js # Identify tactical chances in games
    ├── TacticalPatternDetector.js    # Detect forks, pins, skewers, etc.
    ├── FreePieceDetector.js          # Detect hanging-piece opportunities
    └── TournamentResolutionService.js  # Resolve PGN event → tournament record
```

---

## Frontend (`frontend/src/`)

Angular 17 app served as static files by the Express backend in production.

```
frontend/src/
├── index-angular.html        # App shell HTML
├── main-angular.ts           # Angular bootstrap
├── styles.css                # Global Tailwind + CSS variables (dark theme)
│
├── environments/
│   ├── environment.ts             # Production config (Supabase URL/key)
│   └── environment.development.ts # Dev config
│
└── app/
    ├── app.component.ts      # Root component
    ├── app.routes.ts         # Route definitions (lazy-loaded pages)
    │
    ├── guards/
    │   └── auth.guard.ts     # Redirect unauthenticated users to /sign-in
    │
    ├── interceptors/
    │   ├── auth.interceptor.ts        # Attach Supabase Bearer token to API requests
    │   └── access-code.interceptor.ts # Attach access-code header if set
    │
    ├── services/
    │   ├── auth.service.ts       # Supabase auth: sign-in, sign-up, session, sign-out
    │   ├── chess-api.service.ts  # All HTTP calls to /api/* backend endpoints
    │   ├── puzzle.service.ts     # Puzzle fetch and progress submission
    │   └── access-code.service.ts  # Access-code storage and validation
    │
    ├── components/               # Shared / reusable UI components
    │   ├── layout/               # Top nav bar + mobile bottom nav + router outlet
    │   ├── chess-board/          # Interactive board (Lichess Chessground)
    │   ├── move-list/            # Move list with quality badges and variants
    │   ├── win-probability/      # Vertical eval bar (centipawn → win %)
    │   ├── multi-variation-analysis/  # Multi-PV engine lines display
    │   ├── alternative-moves-panel/   # Engine alternative moves for blunders
    │   ├── move-evaluation/      # Per-move quality badge (blunder/mistake/inaccuracy)
    │   ├── stat-card/            # Metric card with icon and trend
    │   └── access-gate/          # Access-code entry overlay
    │
    └── pages/                    # Route-level page components (lazy-loaded)
        ├── sign-in/              # Supabase sign-in form
        ├── sign-up/              # Supabase sign-up form
        ├── dashboard/            # Performance overview: accuracy, blunders, openings
        ├── games/                # Game list with filters
        ├── game-detail-v2/       # Full game analysis: board + moves + eval + blunders
        ├── upload/               # PGN file upload + manual game entry
        ├── blunders/             # Blunder review dashboard with navigation
        ├── tournaments/          # Tournament list
        ├── tournament-detail/    # Tournament games and stats
        ├── insights/             # Chess.com-style insights and recommendations
        ├── puzzles/              # Lichess puzzle trainer linked to your blunders
        ├── learning-path/        # Personalised improvement plan
        └── not-found/            # 404 page
```

---

## Electron Desktop App (`electron/`)

Self-contained macOS app — Express runs **in-process** (no child spawn). Stockfish, Angular frontend, and SQLite are all bundled.

```
electron/
├── main.js          # App entry: loads .env, sets env vars, requires api-server in-process,
│                    # polls /api/health, creates BrowserWindow; auto-updater (production)
├── preload.js       # Context bridge: exposes { platform, isElectron } to renderer
│
├── assets/
│   ├── icon.icns    # macOS app icon (amber gradient king — matches nav bar)
│   └── entitlements.mac.plist  # (kept for reference; hardenedRuntime disabled)
│
└── bin/
    └── stockfish    # Pre-built Stockfish binary (arm64/universal) — gitignored
                     # Regenerate with: make prepare-stockfish
```

User data is stored in `~/Library/Application Support/chesspulse/`:
- `chess_analysis.db` — SQLite database (created on first launch)
- `data/pgn/`, `data/tournaments/`, `data/backups/` — PGN file storage
- `.env` — optional credential overrides

---

## Scripts (`scripts/`)

```
scripts/
├── after-sign.js           # electron-builder afterSign hook: re-signs .app inner-to-outer
│                           # with ad-hoc identity to fix DYLD Team ID mismatch on install
├── prepare-stockfish.js    # Download Stockfish arm64 + x64 binaries → create universal binary
├── install-local.sh        # Install to /Applications, ad-hoc sign, and launch (dev testing)
├── fix-move-numbers.js     # One-off migration: fix ply→move number in blunder_details
├── download-lichess-puzzles.js   # Download Lichess puzzle database
├── import-puzzle-index.js        # Import puzzle index into SQLite
├── import-to-production.sh       # Import puzzle data to production DB
└── fix-move-numbers.js           # Backfill correct move numbers in existing DB records
```

---

## Tests (`tests/`)

```
tests/
├── unit.test.js              # Core unit tests (fast, no Stockfish)
├── free-piece-detector.test.js
├── tactical-pattern-detector.test.js
├── setup.js                  # Global test setup (test DB path, etc.)
│
├── unit/                     # (additional unit test files)
├── models/                   # Model-level tests (accuracy, blunders, openings, etc.)
├── services/                 # Service-level tests (PGNUpload, GameAnalysis, Blunder, etc.)
├── controllers/              # Controller-level tests (blunder, dashboard, game, upload, etc.)
├── integration/              # End-to-end API and flow tests
├── fixtures/                 # Sample PGN files and test data
└── config/                   # Test configuration helpers
```

---

## Documentation (`docs/`)

```
docs/
├── adr/                     # Architecture Decision Records
│   ├── 001 – User color field in games table
│   ├── 002 – Stockfish singleton pattern
│   ├── 003 – Supabase authentication
│   ├── 004 – Stockfish determinism and analysis queue
│   ├── 005 – Win-probability-based accuracy calculation
│   ├── 006 – Lichess evaluation alignment
│   ├── 007 – Lichess game detail layout
│   ├── 008 – Game detail component refactoring
│   ├── 009 – Chess.com insights dashboard
│   ├── 010 – Lichess puzzle integration
│   └── 011 – macOS desktop DMG packaging (Electron)
├── guides/                  # How-to guides
├── plans/                   # Feature planning documents
├── SUPABASE_AUTH_SETUP.md   # Supabase project setup instructions
└── CLERK_TO_SUPABASE_MIGRATION.md  # Historical migration notes
```

---

## Key npm Scripts

| Command | Description |
|---|---|
| `make dev` | Start backend (port 3000) + Angular dev server (port 4200) |
| `make dev-be` | Backend only |
| `make dev-fe` | Angular dev server only |
| `make electron-dev` | Launch desktop app via Electron (dev mode) |
| `make electron-build-dir` | Build unpacked `.app` (fast, for local testing) |
| `make install-local` | Install to `/Applications`, sign, and launch |
| `make dmg` | Build distributable DMG (arm64 + x64) |
| `make release` | Build DMG and publish to GitHub Releases |
| `make test` | Run full test suite |
| `make test-coverage` | Run tests with coverage report |
| `make check` | Verify Node, npm, Stockfish are installed |

---

## Database Schema (SQLite)

Core tables:

| Table | Purpose |
|---|---|
| `users` | Supabase-synced user accounts |
| `games` | Imported PGN games with metadata |
| `tournaments` | Tournament / event grouping |
| `blunder_details` | Per-move blunders, mistakes, inaccuracies with eval |
| `chess_openings` | Opening repertoire stats |
| `puzzle_index` | Lichess puzzle catalogue |
| `puzzle_cache` | Cached puzzle API results |
| `blunder_puzzle_links` | Blunder ↔ puzzle associations |
| `puzzle_progress` | User puzzle attempt history |
| `tactical_opportunities` | Detected tactical chances per game |

Schema changes are managed via numbered migration files in `src/models/migrations/`.
