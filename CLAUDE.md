# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive multi-user chess analysis platform. The repository contains:

1. **chessify/** - Node.js/Express backend with Angular frontend (active codebase)
2. **Game-PGNs/** - Source PGN files organized by tournament and platform
3. **Past-Analysis/** - Historical analysis outputs (archived results)

## Development Commands

**Backend:**
```bash
cd chessify
npm install                    # Install dependencies
npm start                      # Run analyzer CLI
npm run dashboard              # Start API server on port 3000
```

**Frontend (Angular - in newfrontend/):**
```bash
cd chessify/newfrontend
npm install
npm run dev                    # Development server
npm run build                  # Production build
```

**Testing:**
```bash
cd chessify
npm test                       # Run all tests
npm run test:watch             # Watch mode
npm run test:coverage          # Generate coverage report
```

Note: Some tests (analyzer.test.js, api-server.test.js) have timeout issues due to Stockfish async initialization. Use unit.test.js for reliable testing.

## Architecture

**Backend (Node.js/Express):**
- **API Layer** (`src/api/api-server.js`): REST endpoints, CORS, file uploads, caching
- **Models** (`src/models/`):
  - `analyzer.js`: Stockfish engine integration for position evaluation
  - `database.js`: SQLite database with migrations, manages games/analysis/performance data
  - `performance-stats.js`: Calculates win rates, accuracy, blunders
  - `accuracy-calculator.js`: Centipawn loss calculations
  - `trend-calculator.js`: Weekly performance trends
  - `HeatmapCalculator.js`: Move quality heatmaps
  - `PGNParser.js`: Parse and validate PGN files
  - `tournament-manager.js` & `tournament-analyzer.js`: Tournament-level aggregation
  - `file-storage.js`: PGN file management

**Database:**
- SQLite database at `chessify/data/chess_analysis.db`
- Schema managed through migrations in `src/models/migrations/`
- Tables: games, game_analysis, performance_metrics, chess_openings, tournaments

**Frontend:**
- Angular application in `newfrontend/` (Vite-based build)
- REST API consumption from backend
- Dashboard visualizations for metrics and trends

**Multi-User Authentication:**
- Supabase-based user authentication and authorization  
- User-specific data isolation and game analysis
- Secure session management

### Data Flow

1. PGN files uploaded via API or read from `Game-PGNs/`
2. `PGNParser` validates and extracts game metadata
3. `analyzer.js` evaluates positions using Stockfish
4. Analysis results stored in `chess_analysis.db`
5. `performance-stats.js` aggregates metrics (accuracy, blunders, openings)
6. API serves data with 5-minute cache (`CACHE_DURATION` in api-server.js:77)
7. Frontend displays dashboard and insights

### Game Analysis Metrics

The system tracks comprehensive metrics per Analysis-Prompt.md:

**Opening Phase:**
- Win/draw/loss rates per opening (by color)
- Centipawn loss in first 10 moves
- Opening repertoire success rates

**Middle Game:**
- Blunders/mistakes/inaccuracies per game
- Tactical opportunity identification
- Positional evaluation accuracy

**Endgame:**
- Conversion rate of winning positions
- Save rate from losing positions
- Endgame technique accuracy

**Weekly Trends:**
- Performance progression over time
- Accuracy trends by phase
- Style classification (tactical/positional/aggressive/defensive)

**Time Controls:**
- Performance breakdown by bullet/blitz/rapid/classical

## File Organization

```
Game-PGNs/
├── {tournament-name}/     # OTB tournament games
├── chessdotcom/          # Chess.com games by date
└── lichess/              # Lichess games by tournament
```

PGNs should be organized into folders by tournament/event. The system parses metadata from PGN headers.

## Testing Strategy

- **Unit tests**: `tests/unit.test.js`, `performance-stats.test.js`, `trend-calculator.test.js` - reliable and fast
- **Integration tests**: Database, tournament, API tests - comprehensive but some have Stockfish timeout issues
- **Mock fixtures**: `tests/fixtures/` contains sample PGN data

When writing tests, prefer mocking Stockfish analysis to avoid async timeouts.

## Key Constraints

1. **Stockfish Performance**: Engine analysis is CPU-intensive. API implements 5-minute caching to reduce load.
2. **Multi-User Support**: Full authentication system with Supabase integration for user-specific analysis.
3. **SQLite Limitations**: Database is local file-based. For production, consider PostgreSQL (pg driver already installed).
4. **File Upload Limit**: 10MB max file size for PGN uploads (api-server.js:51).

## Database Migrations

Schema changes must be added as migration files in `src/models/migrations/`. Migrations run automatically on database initialization. Naming convention: `{number}_description.js` (e.g., `004_create_chess_openings.js`).

## Port Configuration

- **Chessify API**: Port 3000 (or `process.env.PORT`)
- **Frontend Dev**: Configured in newfrontend/package.json

## GitHub Issue Management Workflow

**IMPORTANT: Automatically create and close GitHub issues for all code changes.**

When making any code changes, follow this workflow:

1. **Create Issues**: After implementing changes and pushing commits, create GitHub issues documenting what was done:
   ```bash
   gh issue create --title "Descriptive title" --body "Detailed description including:
   - What changed
   - Why it changed
   - Files modified
   - Impact
   - Commit reference"
   ```

2. **Close Issues**: Immediately after creating issues for completed work, close them:
   ```bash
   gh issue close <issue-number> --comment "Completed in commit <hash>. Brief summary of implementation."
   ```

3. **Issue Content Guidelines**:
   - Use clear, descriptive titles
   - Include sections: Description, Changes Made, Impact, Files Modified, Commit reference
   - Reference specific commit hashes
   - Explain technical decisions and trade-offs
   - Document any breaking changes or migration steps

4. **When to Create Issues**:
   - Feature implementations
   - Bug fixes
   - Refactoring work
   - Configuration changes
   - Documentation updates
   - Build/tooling improvements

This ensures all code changes are documented in GitHub's issue tracker for future reference and project history.

## Angular Frontend Notes

The Angular conversion is documented in `chessify/newfrontend/ANGULAR-CONVERSION.md`. The frontend is a separate npm project that builds to `dist/` and is served as static files by the Express backend (api-server.js:68).

### Frontend Components

**Core Components:**
- `chess-board.component.ts`: Interactive chess board using Lichess Chessground library
  - Supports move navigation with keyboard shortcuts (Arrow keys, Home, End)
  - Board flipping, move highlighting, and quality annotations
  - Integrates with chess.js for move validation
- `win-probability.component.ts`: Vertical evaluation bar showing win probability
  - Converts centipawn evaluation to win percentage using logistic formula
  - Smooth transitions between evaluations
- `move-list.component.ts`: Enhanced move list with variant support (PRD Task 6.2)
  - Displays moves with quality indicators (blunders, mistakes, inaccuracies)
  - Expandable variants for poor moves showing engine suggestions
  - Click to navigate or preview alternative moves
- `multi-variation-analysis.component.ts`: Multi-PV analysis display (PRD Task 6.3)
  - Shows multiple engine variations for critical positions
  - Expandable variation trees with depth and evaluation
  - Filter for critical positions only

**Pages:**
- `game-detail.component.ts`: Main game analysis view
  - Combines board, move list, and statistics
  - Phase analysis (opening, middlegame, endgame)
  - Multi-variation analysis for blunders/mistakes
  - Integrates all analysis features from PRD specs

### Chessground Integration

The project uses `@lichess-org/chessground` for the chess board UI. Key features:
- SVG-based pieces from Lichess CDN
- Animation and highlighting support
- Drawable shapes for move quality annotations
- Keyboard navigation support
