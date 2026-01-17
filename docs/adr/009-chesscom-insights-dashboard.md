# ADR 009: Chess.com Insights Dashboard Features

## Status
Proposed

## Context
This ADR documents features from Chess.com's Insights dashboard (https://www.chess.com/insights) that should be considered for future implementation in our chess analysis platform. These features provide comprehensive game analysis and performance tracking that would enhance user experience.

## Reference
- GitHub Issue: [#100 - Review chess.com insights for future dashboard](https://github.com/toamitkumar/chess-analyzer/issues/100)
- Chess.com Insights: https://www.chess.com/insights#phases
- Labels: `dashboard`, `enhancement`, `epic:unified-dashboard`, `priority:medium`

---

## Current Implementation Status

### What Already Exists (Infrastructure Ready)

| Component | Status | Location |
|-----------|--------|----------|
| **Database Schema** | 95% | Migration 002, 007 |
| `phase_analysis` table | ✅ Ready | Stores per-game phase stats |
| `phase_stats` table | ✅ Ready | Aggregated phase statistics |
| `opening_analysis` table | ✅ Ready | ECO codes, opening names |
| `opening_stats` table | ✅ Ready | Opening W/D/L rates (empty) |
| `tactical_motifs` table | ✅ Ready | Fork, pin, hanging piece data |
| `blunder_details` table | ✅ Ready | Phase, tactical_theme, severity |
| **Backend Models** | | |
| `tactical-detector.js` | ✅ Ready | Detects forks, pins, hanging pieces |
| `opening-detector.js` | ✅ Ready | ECO code detection (40+ openings) |
| `accuracy-calculator.js` | ⚠️ Partial | Overall only, not by phase/result |
| **Backend Services** | | |
| `BlunderService.js` | ✅ Ready | Blunder aggregation by phase/theme/severity |
| **API Endpoints** | | |
| `GET /api/games/:id/phases` | ✅ Ready | Per-game phase accuracy |
| `GET /api/performance` | ✅ Ready | Overall performance by color |
| `GET /api/blunders/dashboard` | ✅ Ready | **Tactical patterns by phase & theme** |
| `GET /api/blunders/by-phase/:phase` | ✅ Ready | Blunders filtered by game phase |
| `GET /api/blunders/by-theme/:theme` | ✅ Ready | Blunders filtered by tactical theme |
| `GET /api/blunders/timeline` | ✅ Ready | Blunder trends over time |
| **Frontend Components** | | |
| `phase-analysis.component.ts` | ✅ Ready | Per-game phase visualization |

### Existing Blunder Dashboard API (Critical Discovery)

The `/api/blunders/dashboard` endpoint already provides comprehensive tactical pattern data:

```javascript
// GET /api/blunders/dashboard returns:
{
  overview: {
    totalBlunders: number,
    avgCentipawnLoss: number,
    trend: { period, blunders, avgLoss }
  },
  byPhase: {
    opening: { count, percentage, avgLoss },
    middlegame: { count, percentage, avgLoss },
    endgame: { count, percentage, avgLoss }
  },
  byTheme: [
    { theme: 'hanging_piece', count, percentage, avgLoss },
    { theme: 'fork', count, percentage, avgLoss },
    { theme: 'pin', count, percentage, avgLoss },
    // ... other tactical themes
  ],
  bySeverity: {
    critical: { count, percentage },
    major: { count, percentage },
    moderate: { count, percentage },
    minor: { count, percentage }
  },
  topPatterns: [
    { theme, phase, count, percentage }
  ],
  learningProgress: {
    learnedCount, unlearnedCount, percentage
  }
}
```

**This covers ~80% of the chess.com Tactical Patterns feature!**

### What Needs to Be Built

| Component | Status | Description |
|-----------|--------|-------------|
| **DashboardService Methods** | ⚠️ Partial | Add insights aggregation methods (some exist via BlunderService) |
| **Accuracy by Result** | ❌ Missing | `getAccuracyByResult()` - Group by win/draw/loss |
| **Aggregate Phase Stats** | ❌ Missing | `getPhaseDistribution()` - % games ending in each phase |
| **Accuracy by Phase** | ⚠️ Partial | `getAccuracyByPhase()` - Cross-game phase accuracy (per-game exists) |
| **Opening Performance** | ❌ Missing | `getOpeningPerformance()` - Top 10 openings W/D/L |
| **Tactical Patterns** | ✅ Exists | **Already in `/api/blunders/dashboard`** - byPhase, byTheme |
| **Hanging Pieces by Type** | ⚠️ Partial | Need to add `piece_type` breakdown (theme exists, piece type missing) |
| **Dashboard Routes** | ⚠️ Partial | Add `/api/insights/*` routes (can reuse blunder routes) |
| **Frontend Components** | ❌ Missing | Add insights cards/charts to dashboard page |

### Reuse vs Build Decision

| Chess.com Feature | Build New? | Notes |
|-------------------|------------|-------|
| Average Accuracy Overview | ✅ Build | Need `getAccuracyByResult()` |
| Game Phases (where games end) | ✅ Build | Need `getPhaseDistribution()` |
| Accuracy by Game Phase | ⚠️ Extend | Per-game exists, need aggregate |
| Opening Performance | ✅ Build | `opening_stats` table ready but empty |
| Forks/Pins (found vs missed) | 🔄 Reuse | `/api/blunders/dashboard` byTheme |
| Hanging Pieces (your blunders) | 🔄 Reuse | `/api/blunders/dashboard` byTheme |
| Free Pieces (opponent blunders) | ✅ Build | Need opponent blunder tracking |

---

## Chess.com Insights Feature Analysis

### 1. Average Accuracy Overview
**Description**: Displays overall accuracy percentage with breakdown by game outcome.

**Components**:
- Overall accuracy percentage (e.g., 75.13%)
- Accuracy when you win
- Accuracy when you draw
- Accuracy when you lose

**Implementation Notes**:
- Calculate from existing centipawn loss data
- Requires grouping games by result
- Display as prominent header card

---

### 2. Game Phases Analysis
**Description**: Shows which phase of the game (Opening, Middlegame, Endgame) your games typically end in.

**Views**:
1. **Overall**: Aggregate percentage for all games
2. **By Piece Color**: Separate stats for White and Black
3. **Similar Players**: Comparison with players of similar rating (future feature)

**Data Structure**:
```
Phase        | Games | Percentage
-------------|-------|------------
Opening      |   0   |    0%
Middlegame   |   0   |    0%
Endgame      |   2   |  100%
```

**Phase Definitions**:
- Opening: Moves 1-10 (approximately)
- Middlegame: Moves 11-30
- Endgame: Moves 31+

**Implementation Notes**:
- Track game length in moves
- Determine which phase game ended based on move count
- Consider piece count as alternative endgame detection

---

### 3. Accuracy by Game Phase
**Description**: Bar chart visualization showing accuracy performance across game phases.

**Data Points** (per phase):
- Opening accuracy %
- Middlegame accuracy %
- Endgame accuracy %

**Filters**:
- When Playing White
- When Playing Black
- All games (combined)

**Visualization**: Horizontal or vertical bar chart with labels showing exact percentages

**Example Data**:
```
Phase       | White | Black
------------|-------|-------
Opening     | 84.0% | 82.5%
Middlegame  | 80.8% | 73.4%
Endgame     | 72.6% | 80.5%
```

---

### 4. Opening Performance Analysis
**Description**: Performance statistics for most frequently played openings.

**Title**: "How well you perform in your 10 most played openings"

**Data Columns**:
- Opening Name (e.g., "Bird's Opening", "Slav Defense")
- Moves (e.g., "1. f4", "1. d4 d5 2. c4 c6")
- Total Games played
- Win % (green)
- Draw % (gray)
- Loss % (red)

**Filters**:
- When Playing White
- When Playing Black

**Features**:
- Clickable to drill down into specific opening games
- Visual progress bar showing W/D/L distribution

---

### 5. Tactical Patterns Analysis

#### 5.1 Forks
**Description**: Track found vs missed fork opportunities by piece type.

**Piece Categories**:
- Pawn forks
- Knight forks
- Bishop forks
- Rook forks
- Queen forks
- King forks (discovered attacks)

**Metrics**:
- Found count & percentage
- Missed count & percentage
- Total opportunities

**Comparison Options**:
- None (raw data)
- Similar Players
- Past Performance (trend over time)

---

#### 5.2 Pins
**Description**: Track found vs missed pin opportunities.

**Piece Categories**:
- Bishop pins
- Rook pins
- Queen pins

**Metrics**: Same as Forks

---

#### 5.3 Hanging Pieces (Blunders)
**Description**: Track pieces left undefended that were captured.

**Title**: "Pieces you left hanging"

**Piece Categories**:
- Pawn
- Knight
- Bishop
- Rook
- Queen

**Metrics**:
- Count of hanging pieces by type
- Percentage (relative frequency)
- Visual indicator (red for problematic patterns)

**Features**:
- Clickable to review specific positions
- Pattern identification for improvement areas

---

#### 5.4 Free Pieces (Opponent Blunders)
**Description**: Track opponent's hanging pieces that you found vs missed.

**Title**: "Pieces your opponent left hanging"

**Piece Categories**: Same as Hanging Pieces

**Metrics**:
- Found: Count & percentage of captured hanging pieces
- Missed: Count & percentage of opportunities not taken

---

## Implementation Phases

### Phase 1: Extend DashboardService (Backend) - Priority: HIGH
- [x] Track game phase where game ended (Migration 002 - `phase_stats` table)
- [x] Calculate accuracy per game phase (per-game: `/api/games/:id/phases`)
- [x] Track opening statistics schema (`opening_stats` table exists)
- [x] Store tactical pattern data (`tactical_motifs`, `blunder_details` tables)
- [x] **DONE**: Tactical patterns by phase & theme (`/api/blunders/dashboard`)
- [x] **DONE**: Blunders by phase (`/api/blunders/by-phase/:phase`)
- [x] **DONE**: Blunders by theme (`/api/blunders/by-theme/:theme`)
- [ ] **NEW**: Add `getAccuracyByResult()` method to `DashboardService.js`
- [ ] **NEW**: Add `getPhaseDistribution()` method to `DashboardService.js`
- [ ] **NEW**: Add `getAccuracyByPhase()` method to `DashboardService.js` (aggregate cross-game)
- [ ] **NEW**: Add `getOpeningPerformance()` method to `DashboardService.js`

### Phase 2: Add API Endpoints to Dashboard Routes - Priority: HIGH
Add to `dashboard.routes.js`:
- [ ] `GET /api/insights/accuracy` - Accuracy by result (win/draw/loss)
- [ ] `GET /api/insights/phases` - Aggregate phase distribution (% games ending in each phase)
- [ ] `GET /api/insights/accuracy-by-phase` - Average accuracy per phase across all games
- [ ] `GET /api/insights/openings` - Top 10 openings with W/D/L stats
- [x] ~~`GET /api/insights/tactics/summary`~~ - **Use `/api/blunders/dashboard` instead**
- [ ] `GET /api/insights/tactics/hanging-by-piece` - Hanging pieces grouped by piece type (optional enhancement)

### Phase 3: Frontend Dashboard Components - Priority: MEDIUM
Add to existing dashboard page:
- [ ] Accuracy by result card (chess.com style green gradient)
- [ ] Game phases distribution chart (bar/pie)
- [ ] Accuracy by phase chart (filterable by color)
- [ ] Opening performance table with W/D/L progress bars
- [ ] Tactical patterns card (**Reuse data from `/api/blunders/dashboard`**)

### Phase 4: Advanced Features - Priority: LOW
- [ ] Similar players comparison (requires rating-based grouping)
- [ ] Past performance trends (time-series data) - **Partial: `/api/blunders/timeline` exists**
- [ ] Drill-down to specific games/positions
- [ ] Export insights report
- [ ] Opponent blunder tracking (free pieces you missed)

## Database Schema Status

### Existing Tables (Migration 002 & 007) - NO NEW MIGRATIONS NEEDED

```sql
-- Already exists: phase_analysis (per-move phase data)
-- Already exists: phase_stats (per-game phase aggregates)
CREATE TABLE phase_stats (
  id INTEGER PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  opening_accuracy REAL,
  middlegame_accuracy REAL,
  endgame_accuracy REAL,
  opening_blunders INTEGER,
  middlegame_blunders INTEGER,
  endgame_blunders INTEGER
);

-- Already exists: opening_stats (opening performance)
CREATE TABLE opening_stats (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  opening_name TEXT,
  eco_code TEXT,
  player_color TEXT, -- 'white' or 'black'
  games_played INTEGER,
  wins INTEGER,
  draws INTEGER,
  losses INTEGER,
  avg_accuracy REAL
);

-- Already exists: tactical_motifs (tactical patterns)
CREATE TABLE tactical_motifs (
  id INTEGER PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  move_number INTEGER,
  motif_type TEXT, -- 'fork', 'pin', 'skewer', 'discovered_attack', etc.
  piece_involved TEXT,
  difficulty TEXT,
  squares TEXT
);

-- Already exists: blunder_details (enhanced blunder tracking)
CREATE TABLE blunder_details (
  id INTEGER PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  move_number INTEGER,
  phase TEXT, -- 'opening', 'middlegame', 'endgame'
  tactical_theme TEXT, -- 'hanging_piece', 'fork', 'pin', etc.
  player_color TEXT,
  severity TEXT,
  eval_before REAL,
  eval_after REAL,
  centipawn_loss INTEGER,
  win_probability_before REAL,
  win_probability_after REAL,
  fen_before TEXT
);
```

### Data Population Required
The tables exist but may be empty. Need to:
1. Run backfill job to populate `opening_stats` from existing games
2. Ensure `phase_stats` is populated during game analysis
3. Ensure `blunder_details` captures tactical themes

## UI/UX Considerations

### Color Scheme (Chess.com Style)
- Background: Green gradient (#769656 to #baca44)
- Cards: Semi-transparent white overlay
- Win: Green (#22c55e)
- Draw: Gray (#6b7280)
- Loss: Red (#ef4444)
- Found/Success: Green with checkmark
- Missed/Problem: Red with X

### Layout
- Card-based design with rounded corners
- Tabs for switching between views (Overall, By Piece Color, etc.)
- Responsive grid layout
- Interactive tooltips with additional details

## Acceptance Criteria
- [ ] User can view overall accuracy with breakdown by game result
- [ ] User can see which game phase their games typically end in
- [ ] User can view accuracy breakdown by game phase
- [ ] User can see performance in their most played openings (top 10)
- [ ] User can view tactical pattern statistics (forks, pins, hanging pieces)
- [ ] All metrics can be filtered by piece color (White/Black)
- [ ] Data is calculated from existing game analysis

## Files to Create/Modify

### Existing Dashboard Infrastructure (Add Insights Here)

The insights APIs should be added to the **existing dashboard controller/service** rather than creating new files:

**Current Dashboard Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/performance` | GET | Performance metrics by color |
| `/api/player-performance` | GET | Overall player performance |
| `/api/trends` | GET | Weekly performance trends |
| `/api/trends/rating` | GET | Rating progression |
| `/api/trends/centipawn-loss` | GET | Centipawn loss trends |
| `/api/heatmap-db` | GET | Blunder heatmap |
| `/api/games` | GET | Games list with openings |

**New Endpoints to Add:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/insights/accuracy` | GET | Accuracy breakdown by game result (win/draw/loss) |
| `/api/insights/phases` | GET | Aggregate phase distribution (% games ending in each phase) |
| `/api/insights/accuracy-by-phase` | GET | Average accuracy per phase across all games |
| `/api/insights/openings` | GET | Top 10 openings with W/D/L stats |
| `/api/insights/tactics/summary` | GET | Tactical patterns overview |
| `/api/insights/tactics/hanging` | GET | Hanging pieces by piece type |

### Files to Modify

| File | Changes Needed |
|------|----------------|
| `src/services/DashboardService.js` | Add insights aggregation methods |
| `src/api/controllers/dashboard.controller.js` | Add insights endpoint handlers |
| `src/api/routes/dashboard.routes.js` | Register new `/insights/*` routes |
| `src/models/accuracy-calculator.js` | Add `calculateByResult()` method |
| `frontend/src/app/services/chess-api.service.ts` | Add insights API calls |
| `frontend/src/app/pages/dashboard/` | Add insights charts/cards |

### Files to Reference (No Changes Needed)

| File | What It Provides |
|------|------------------|
| `src/models/tactical-detector.js` | Fork, pin, hanging piece detection |
| `src/models/opening-detector.js` | ECO code and opening classification |
| `src/api/controllers/game.controller.js` | `getPhases()` implementation pattern |
| `frontend/src/app/pages/game-detail-v2/components/phase-analysis.component.ts` | Phase visualization reference |
| **`src/services/BlunderService.js`** | **Blunder aggregation: byPhase, byTheme, bySeverity, timeline** |
| **`src/api/controllers/blunder.controller.js`** | **`getDashboard()` - tactical patterns API pattern** |
| **`src/api/routes/blunder.routes.js`** | **Existing `/api/blunders/*` routes for tactical data** |

## Dependencies
- ✅ Existing game analysis data (in `game_analysis` table)
- ✅ Stockfish evaluation data (already captured)
- ✅ Opening classification (`chess_openings` table + `opening-detector.js`)
- ✅ Phase definitions (already implemented: opening 1-10, middlegame 11-30, endgame 31+)
- ✅ Blunder tracking with phase/theme (`blunder_details` table)

## Notes
- **No new database migrations required** - all tables exist in Migration 002 & 007
- Tables may need backfill/population from existing game data
- ~~Tactical pattern detection exists but aggregation layer is missing~~ **RESOLVED: `/api/blunders/dashboard` provides full aggregation**
- **IMPORTANT**: The blunder dashboard API (`/api/blunders/dashboard`) already provides tactical patterns breakdown by phase and theme - frontend can consume this directly
- "Similar Players" feature requires user rating system (future)
- Consider Redis caching for insights data (computationally expensive)

## Effort Estimate

**Revised estimate after discovering existing blunder infrastructure:**

| Phase | Original | Revised | Notes |
|-------|----------|---------|-------|
| Phase 1: Aggregation Service | 2-3 days | **1-2 days** | Tactical patterns already exist |
| Phase 2: API Endpoints | 1-2 days | **1 day** | Only 4 new endpoints needed |
| Phase 3: Frontend Dashboard | 3-4 days | **2-3 days** | Can reuse blunder dashboard patterns |
| Phase 4: Advanced Features | 2-3 days | 2-3 days | No change |
| **Total** | **8-12 days** | **6-9 days** | ~25% reduction |

**Key Savings:**
- Tactical patterns API: Already implemented (`/api/blunders/dashboard`)
- Blunders by phase/theme: Already implemented
- Timeline trends: Already implemented (`/api/blunders/timeline`)

## Related ADRs
- ADR 007: Lichess Game Detail Layout
- Future: ADR for rating system and player comparisons
