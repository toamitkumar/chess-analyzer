# Lichess Puzzle Integration - Implementation Plan
## Railway-Optimized API-First Hybrid Architecture

## Executive Summary

**Feature**: Lichess Puzzle Integration (#78)
**Goal**: Create a personalized chess learning system that matches blunders with relevant training puzzles
**Architecture**: API-First Hybrid (minimal local storage + Lichess API)
**Effort**: ~110-135 hours across 4 phases
**Prerequisites**: ✅ Completed (#76, #77)
**Timeline**: 3-4 weeks for full implementation
**Storage**: 20MB total (vs 2GB in original plan)

---

## Current State Analysis

### ✅ Completed Prerequisites
- **Issue #76**: Enhanced Blunder Tracking - CLOSED
  - `blunder_details` table exists (migration 007)
  - `BlunderCategorizer` class implemented
  - Tactical theme categorization working

- **Issue #77**: Blunder Dashboard - CLOSED
  - Dashboard visualizations implemented
  - API endpoints for blunder aggregation
  - Foundation for "Practice" button integration

### 📦 Existing Infrastructure
- **Development Database**: SQLite with 11 migrations (latest: 011_fix_cascade_delete_constraints.js)
- **Production Database**: PostgreSQL on Railway.app
  - **Tier**: Hobby ($5/month with $5 credit)
  - **Storage Limit**: 5GB (hard cap)
  - **Current Usage**: 4.3MB
  - **Available**: 4.996GB
- **Dependencies**: chess.js, express, stockfish, sqlite3, pg
- **Architecture**: Node.js 20.x backend + Angular frontend

### 🚧 Missing Components
- Puzzle index (3M puzzle metadata from Lichess) - 10MB
- Lichess API integration
- Puzzle caching layer (Redis or PostgreSQL)
- Puzzle matching algorithm
- Progress tracking system
- Interactive puzzle UI
- Dependencies: csv-parser, unbzip2-stream, cli-progress, axios

---

## Architecture Decision: API-First Hybrid

### Why Not Full Local Storage?

**Original Plan**: Store 2GB of puzzle data (FEN, moves, solutions)
**Problem**: Railway.app Hobby tier has 5GB limit
- 2GB puzzles = 40% of total storage capacity
- Leaves little room for user data growth
- Risky for production scaling

### Chosen Architecture: API-First Hybrid

```
┌─────────────────────────────────────────────────────────┐
│ Railway PostgreSQL (20MB Total)                         │
├─────────────────────────────────────────────────────────┤
│ puzzle_index (10MB)                                     │
│   - 3M puzzle IDs + metadata (themes, rating)           │
│   - Used for MATCHING algorithm                         │
│   - Enables: "find fork puzzles rated 1500-1700"        │
│                                                          │
│ puzzle_cache (10MB max, LRU eviction)                   │
│   - Recently fetched puzzles (FEN, moves, solution)     │
│   - 24-hour TTL, max 2000 puzzles                       │
│   - 70-90% cache hit rate expected                      │
│                                                          │
│ user_puzzle_progress (grows with usage)                 │
│   - Solved puzzles, attempts, timing, mastery           │
└─────────────────────────────────────────────────────────┘
                           ↓
              Lichess API (Source of Truth)
         https://lichess.org/api/puzzle/{id}
          - Fetch full puzzle details on-demand
          - Rate limit: ~1 request/second
          - Free, no authentication required
```

### Benefits

| Aspect | Full Local | API-First Hybrid |
|--------|------------|------------------|
| **Storage** | 2GB (40% limit) | 20MB (0.4% limit) |
| **Scaling** | ❌ Blocked | ✅ Room to grow |
| **Matching Speed** | 50ms | 50ms (same!) |
| **Puzzle Details** | 0ms | 200ms (cached: 0ms) |
| **Freshness** | Monthly update | Always current |
| **Railway Cost** | +$0.50/mo | +$0.005/mo |
| **Complexity** | Low | Medium |

---

## Gap Analysis & Risks

### Identified Gaps

#### 1. **Database Migration Numbering Conflict**
- **Issue**: Specs call for migrations 008-010, but current DB is at migration 011
- **Impact**: Migration files need renumbering
- **Solution**:
  - Phase 1 → `012_create_puzzle_index.js` (changed from puzzles)
  - Phase 1 → `013_create_puzzle_cache.js` (new)
  - Phase 2 → `014_create_blunder_puzzle_links.js`
  - Phase 3 → `015_create_puzzle_progress_tables.js`

#### 2. **Railway Storage Constraints** ⚠️ CRITICAL
- **Issue**: Production PostgreSQL limited to 5GB on Hobby tier
- **Impact**: Cannot store 2GB puzzle database
- **Solution**: API-first hybrid (10MB index + 10MB cache = 20MB total)
- **Cost Savings**: $0.50/mo → $0.005/mo

#### 3. **Scripts Directory Missing**
- **Issue**: No `/scripts` directory for download/import scripts
- **Impact**: Need to create directory structure
- **Solution**: Create `chessify/scripts/` directory in Phase 1

#### 4. **Multi-User Support**
- **Issue**: Current system hardcoded for single player (AdvaitKumar1213)
- **Impact**: Puzzle progress tracking assumes single user
- **Solution**: Current implementation OK for MVP, document as future enhancement

#### 5. **Lichess API Rate Limiting**
- **Issue**: Lichess API rate limited to ~1 request/second
- **Impact**: Need caching to avoid hitting limits
- **Solution**: 24-hour TTL cache with LRU eviction (70-90% hit rate)

#### 6. **Theme Mapping Completeness**
- **Issue**: Lichess themes may not perfectly map to BlunderCategorizer themes
- **Impact**: Some blunders might not find good puzzle matches
- **Solution**: Spec includes comprehensive THEME_MAPPING in Phase 2, may need iteration

### Risk Assessment

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Railway storage exceeds 5GB | **High** | Low | ✅ API-first hybrid uses 20MB only |
| Lichess API rate limiting | Medium | Medium | ✅ 24h cache + throttling + LRU eviction |
| Lichess API downtime | Medium | Low | Cache provides fallback, "Open on Lichess" button |
| Poor puzzle match quality | Medium | Medium | Manual QA in Phase 2, adjust scoring algorithm |
| Slow puzzle loading (API latency) | Low | Medium | ✅ Cache hit rate 70-90% after warmup |
| Import fails midway (network/disk) | Low | Low | Resume logic, streaming parser |
| Cache storage growth | Low | Low | ✅ LRU eviction caps at 10MB |

---

## Implementation Roadmap

### Phase 1: Puzzle Index Import & Caching Layer (#79)
**Estimated Effort**: 9-15 hours (reduced from 11-17)
**Dependencies**: None

#### Tasks
1. **Setup** (2h)
   - Create `scripts/` directory
   - Install dependencies: `npm install csv-parser unbzip2-stream cli-progress axios`
   - Create migrations `012_create_puzzle_index.js` and `013_create_puzzle_cache.js`

2. **Download Script** (2-3h)
   - `scripts/download-lichess-puzzles.js`
   - URL: https://database.lichess.org/lichess_db_puzzle.csv.bz2
   - Progress bar, retry logic, checksum validation
   - Store in `data/lichess_puzzles.csv.bz2`

3. **Import Script - INDEX ONLY** (3-5h)
   - `scripts/import-puzzle-index.js` (renamed from import-lichess-puzzles.js)
   - **Import ONLY**: `id`, `themes`, `rating`, `popularity`
   - **Skip**: `fen`, `moves`, `game_url` (will fetch from API on-demand)
   - Streaming CSV parser (memory efficient)
   - Batch inserts (1000 records at a time)
   - Validation (rating is numeric, themes properly formatted)
   - Error logging to `data/import_errors.log`

4. **Testing** (2-3h)
   - Unit tests for CSV parsing (index fields only)
   - Integration test with 1000 puzzle subset
   - Performance test with 100K puzzles
   - Verify storage size (~10MB for 3M puzzles)

5. **Documentation** (1-2h)
   - Update README with import instructions
   - Document npm script: `npm run import-puzzle-index`

#### Database Schema

**Migration 012: Puzzle Index**
```sql
-- SQLite (development)
CREATE TABLE puzzle_index (
  id TEXT PRIMARY KEY,
  themes TEXT NOT NULL,      -- JSON array as string
  rating INTEGER,
  popularity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_puzzle_index_themes ON puzzle_index(themes);
CREATE INDEX idx_puzzle_index_rating ON puzzle_index(rating);

-- PostgreSQL (production)
CREATE TABLE puzzle_index (
  id TEXT PRIMARY KEY,
  themes TEXT[] NOT NULL,    -- Native array type
  rating INTEGER,
  popularity INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_puzzle_index_themes ON puzzle_index USING GIN(themes);
CREATE INDEX idx_puzzle_index_rating ON puzzle_index(rating);
```

**Migration 013: Puzzle Cache**
```sql
CREATE TABLE puzzle_cache (
  id TEXT PRIMARY KEY,
  fen TEXT NOT NULL,
  moves TEXT NOT NULL,
  solution TEXT,
  themes TEXT NOT NULL,
  rating INTEGER,
  game_url TEXT,
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_puzzle_cache_accessed ON puzzle_cache(last_accessed);
CREATE INDEX idx_puzzle_cache_age ON puzzle_cache(cached_at);
```

#### Import Script Example
```javascript
// scripts/import-puzzle-index.js
async function importPuzzleIndex(filePath, db) {
  let batch = [];
  let imported = 0;

  const stream = fs.createReadStream(filePath)
    .pipe(bz2())
    .pipe(csv());

  for await (const row of stream) {
    // Import ONLY metadata - skip FEN and moves!
    const puzzleIndex = {
      id: row.PuzzleId,
      themes: row.Themes,              // Store as-is
      rating: parseInt(row.Rating),
      popularity: parseInt(row.Popularity)
      // FEN and Moves NOT stored - fetched from API
    };

    batch.push(puzzleIndex);

    if (batch.length >= 1000) {
      await insertBatch(db, batch);
      imported += batch.length;
      batch = [];
      console.log(`Imported ${imported} puzzle indices...`);
    }
  }

  console.log(`✅ Index complete: ${imported} puzzles, ~${Math.round(imported * 3 / 1024)}MB storage`);
}
```

#### Deliverables
- [ ] Migration 012 creating puzzle_index table
- [ ] Migration 013 creating puzzle_cache table
- [ ] Download script with progress bar
- [ ] Import script for index only (NOT full puzzles)
- [ ] Test suite (≥80% coverage)
- [ ] Documentation

#### Success Criteria
- [x] 3M+ puzzle indices imported successfully
- [x] Import completes in <5 minutes (faster than full import)
- [x] Query by theme <50ms
- [x] Database size **<15MB** (vs 2GB original plan)
- [x] Cache table created and empty

---

### Phase 2: Puzzle Matching & Lichess API Client (#80)
**Estimated Effort**: 24-31 hours (increased from 20-27)
**Dependencies**: Phase 1 complete

#### Tasks
1. **Lichess API Client** (6-8h) ⭐ NEW
   - `src/models/lichess-api-client.js`
   - Fetch puzzle details by ID
   - Rate limiting (1 req/sec throttle)
   - Retry logic with exponential backoff
   - Error handling and fallback

2. **Puzzle Cache Manager** (4-6h) ⭐ NEW
   - `src/models/puzzle-cache-manager.js`
   - LRU eviction (max 2000 puzzles = 10MB)
   - 24-hour TTL
   - Cache hit/miss tracking
   - Cleanup job (hourly)

3. **PuzzleMatcher Class** (6-8h)
   - `src/models/puzzle-matcher.js`
   - Query puzzle_index (local, fast)
   - Fetch top 10 details from Lichess API
   - Theme mapping (blunder categories → Lichess themes)
   - Similarity scoring algorithm
   - Priority ranking (1-4)

4. **Database Schema** (2-3h)
   - Migration `014_create_blunder_puzzle_links.js`
   - `blunder_puzzle_links` table with indexes

5. **Auto-Linking Service** (2-3h)
   - Background job to link blunders to puzzles
   - Uses puzzle_index for matching
   - Stores top 10 puzzle IDs only (not full details)

6. **API Endpoints** (2-3h)
   - `GET /api/blunders/:id/puzzles` (returns puzzle IDs + fetches from Lichess)
   - `POST /api/blunders/:id/refresh-puzzles`
   - `GET /api/puzzles/:id` (fetch from cache or Lichess)

7. **Testing** (4-5h)
   - Unit tests for Lichess API client
   - Unit tests for cache manager (LRU eviction)
   - Integration tests for matching
   - Mock Lichess API responses
   - Performance tests

#### Lichess API Client Implementation
```javascript
class LichessAPIClient {
  constructor() {
    this.baseUrl = 'https://lichess.org/api';
    this.lastRequest = 0;
    this.minInterval = 1000; // 1 req/sec
  }

  async fetchPuzzle(id) {
    // Throttle requests
    await this.throttle();

    try {
      const response = await fetch(`${this.baseUrl}/puzzle/${id}`);

      if (response.status === 429) {
        // Rate limited - wait 1 minute
        console.warn(`Rate limited, waiting 60s...`);
        await this.sleep(60000);
        return this.fetchPuzzle(id);
      }

      if (!response.ok) {
        throw new Error(`Lichess API error: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error(`Failed to fetch puzzle ${id}:`, error);
      // Return fallback with Lichess link
      return {
        id,
        lichessUrl: `https://lichess.org/training/${id}`,
        error: true
      };
    }
  }

  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequest;

    if (elapsed < this.minInterval) {
      await this.sleep(this.minInterval - elapsed);
    }

    this.lastRequest = Date.now();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### Puzzle Cache Manager Implementation
```javascript
class PuzzleCacheManager {
  constructor(db) {
    this.db = db;
    this.maxSize = 2000; // 2000 puzzles × 5KB = 10MB
    this.ttl = 24 * 3600; // 24 hours
  }

  async get(puzzleId) {
    // Check cache (with TTL)
    const cached = await this.db.query(`
      SELECT * FROM puzzle_cache
      WHERE id = $1
      AND cached_at > NOW() - INTERVAL '24 hours'
    `, [puzzleId]);

    if (cached.rows.length > 0) {
      // Cache HIT - update last_accessed
      await this.touch(puzzleId);
      return cached.rows[0];
    }

    // Cache MISS
    return null;
  }

  async set(puzzle) {
    // Evict if over limit
    const size = await this.getSize();
    if (size >= this.maxSize) {
      await this.evictLRU();
    }

    // Insert or update
    await this.db.query(`
      INSERT INTO puzzle_cache (id, fen, moves, solution, themes, rating, game_url, cached_at, last_accessed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET cached_at = NOW(), last_accessed = NOW()
    `, [puzzle.id, puzzle.fen, puzzle.moves, puzzle.solution, puzzle.themes, puzzle.rating, puzzle.gameUrl]);
  }

  async evictLRU() {
    // Remove least recently accessed puzzle
    await this.db.query(`
      DELETE FROM puzzle_cache
      WHERE id = (
        SELECT id FROM puzzle_cache
        ORDER BY last_accessed ASC
        LIMIT 1
      )
    `);
  }

  async cleanup() {
    // Remove expired entries (>24h old)
    const result = await this.db.query(`
      DELETE FROM puzzle_cache
      WHERE cached_at < NOW() - INTERVAL '24 hours'
      RETURNING id
    `);
    console.log(`Cleaned up ${result.rowCount} expired puzzles from cache`);
  }
}
```

#### PuzzleMatcher with API Integration
```javascript
class PuzzleMatcher {
  constructor(db, lichessClient, cacheManager) {
    this.db = db;
    this.lichess = lichessClient;
    this.cache = cacheManager;
  }

  async findPuzzlesForBlunder(blunder, playerRating) {
    // Step 1: Query local index (fast, 3M puzzles)
    const candidates = await this.db.query(`
      SELECT id, rating, popularity
      FROM puzzle_index
      WHERE themes LIKE $1
      AND rating BETWEEN $2 AND $3
      ORDER BY popularity DESC
      LIMIT 100
    `, [`%${blunder.theme}%`, playerRating - 200, playerRating + 200]);

    // Step 2: Score and rank
    const ranked = this.rankBysimilarity(candidates, blunder, playerRating);
    const top10 = ranked.slice(0, 10);

    // Step 3: Fetch full details (from cache or Lichess API)
    const puzzles = await Promise.all(
      top10.map(c => this.fetchPuzzleWithCache(c.id))
    );

    return puzzles;
  }

  async fetchPuzzleWithCache(puzzleId) {
    // Check cache first
    let puzzle = await this.cache.get(puzzleId);

    if (puzzle) {
      // Cache HIT
      return puzzle;
    }

    // Cache MISS - fetch from Lichess
    puzzle = await this.lichess.fetchPuzzle(puzzleId);

    // Store in cache for next time
    if (!puzzle.error) {
      await this.cache.set(puzzle);
    }

    return puzzle;
  }
}
```

#### Deliverables
- [ ] LichessAPIClient class with rate limiting
- [ ] PuzzleCacheManager with LRU eviction
- [ ] PuzzleMatcher using index + API
- [ ] Migration 014 for puzzle links
- [ ] API endpoints
- [ ] Theme mapping documentation
- [ ] Test suite with mocked Lichess API

#### Success Criteria
- [x] 90% of blunders have 5+ relevant puzzles (from index)
- [x] Puzzle details fetched in <300ms (first time) or <50ms (cached)
- [x] Cache hit rate >70% after warmup period
- [x] Rate limiting prevents Lichess API 429 errors
- [x] Cache size stays under 10MB (LRU eviction works)
- [x] Query <200ms per blunder
- [x] Test coverage ≥85%

---

### Phase 3: Learning Path API (#81)
**Estimated Effort**: 26-34 hours
**Dependencies**: Phase 2 complete

#### Tasks
1. **Database Schema** (2h)
   - Migration `015_create_puzzle_progress_tables.js` (renumbered from 014)
   - `user_puzzle_progress` table
   - `theme_mastery` table

2. **Progress Tracker** (6-8h)
   - `src/models/puzzle-progress-tracker.js`
   - Record attempts, solutions, timing
   - Update mastery scores
   - Track streaks

3. **Mastery Calculation** (3-4h)
   - Algorithm: success rate (50%) + efficiency (30%) + volume (20%)
   - Status: learning/improving/mastered
   - Threshold tuning

4. **Learning Path Generator** (4-6h)
   - `src/models/learning-path-generator.js`
   - Prioritize by frequency and severity
   - Daily goal generation
   - Recommendation algorithm

5. **API Endpoints** (6-8h)
   - `GET /api/puzzles/recommended` (uses index + fetches from API)
   - `GET /api/puzzles/:id` (cache-aware)
   - `POST /api/puzzles/:id/attempt`
   - `POST /api/puzzles/:id/solve`
   - `GET /api/puzzles/progress`
   - `GET /api/learning-path`

6. **Testing** (5-6h)
   - Unit tests for mastery calculation
   - API integration tests
   - Performance tests (1000+ attempts)

#### API Endpoint Example
```javascript
// GET /api/puzzles/:id
app.get('/api/puzzles/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Try cache first
    let puzzle = await cacheManager.get(id);

    if (!puzzle) {
      // Fetch from Lichess API
      puzzle = await lichessClient.fetchPuzzle(id);

      // Cache for future requests
      if (!puzzle.error) {
        await cacheManager.set(puzzle);
      }
    }

    // Get user progress
    const progress = await db.query(
      'SELECT * FROM user_puzzle_progress WHERE puzzle_id = $1',
      [id]
    );

    res.json({
      puzzle,
      progress: progress.rows[0] || null,
      cached: !!puzzle.cached_at
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### Deliverables
- [ ] Migration 015 for progress tracking
- [ ] PuzzleProgressTracker class
- [ ] LearningPathGenerator class
- [ ] 6 API endpoints with cache integration
- [ ] Test suite

#### Success Criteria
- [x] Recommendations are personalized
- [x] Mastery score reflects performance
- [x] Learning path prioritizes correctly
- [x] API response <300ms (including Lichess fetch)
- [x] API response <100ms (cached puzzles)
- [x] Test coverage ≥85%

---

### Phase 4: Practice UI (#82)
**Estimated Effort**: 40-54 hours (increased from 38-52)
**Dependencies**: Phase 3 complete

#### Tasks
1. **Frontend Routes** (2h)
   - `/puzzles` - Browser/filter
   - `/puzzles/:id` - Practice view
   - `/learning-path` - Study plan
   - `/puzzles/daily` - Daily challenge (uses Lichess API)

2. **Core Puzzle Component** (8-10h)
   - `PuzzleComponent` with Chessground integration
   - Fetch puzzle from backend API (cache-aware)
   - Move validation (UCI format)
   - Auto-play opponent responses
   - Solution playback

3. **User Interaction** (4-6h)
   - Drag-and-drop pieces
   - Move highlighting
   - Visual feedback (green/red)
   - Animations

4. **Loading States** (2-3h) ⭐ NEW
   - Skeleton loader while fetching from Lichess API
   - Cached puzzle loads instantly
   - "Fetching puzzle..." indicator
   - Error state with "Open on Lichess" fallback

5. **Help System** (3-4h)
   - Hint button (highlight square)
   - Solution button
   - Explanation text
   - "Solve on Lichess" button (opens lichess.org/training/{id})

6. **Progress Display** (3-4h)
   - Timer, attempts counter
   - Theme badges, difficulty
   - Success/failure messages
   - Mastery score updates

7. **Puzzle Browser** (4-6h)
   - `PuzzleBrowserComponent`
   - Filter by theme/difficulty (queries index)
   - Mini board thumbnails (lazy-loaded)
   - Pagination

8. **Learning Path View** (4-6h)
   - `LearningPathComponent`
   - Recommended themes
   - Daily goal progress
   - Recent activity feed

9. **Styling & Responsive** (6-8h)
   - Desktop (600x600 board)
   - Tablet (500x500)
   - Mobile (320x320)
   - Dark mode support

10. **Testing** (6-8h)
    - Unit tests for components
    - E2E tests for puzzle flow
    - Test API integration and caching
    - Responsive testing

#### Puzzle Component with API Integration
```typescript
export class PuzzleComponent implements OnInit {
  puzzle: Puzzle;
  loading = false;
  cached = false;
  error = false;

  async ngOnInit() {
    await this.loadPuzzle();
  }

  async loadPuzzle() {
    this.loading = true;
    this.error = false;

    try {
      const puzzleId = this.route.snapshot.params['id'];

      // Fetch from backend (which checks cache then Lichess API)
      const response = await this.puzzleService.getPuzzle(puzzleId);

      this.puzzle = response.puzzle;
      this.cached = response.cached;

      // Show notification if fetched from API
      if (!this.cached) {
        this.showToast('Puzzle loaded from Lichess');
      }

      this.startTimer();

    } catch (error) {
      this.error = true;
      this.showErrorWithFallback(error);

    } finally {
      this.loading = false;
    }
  }

  showErrorWithFallback(error: any) {
    // Show "Open on Lichess" button as fallback
    this.fallbackUrl = `https://lichess.org/training/${this.puzzleId}`;
  }

  openOnLichess() {
    window.open(this.fallbackUrl, '_blank');
  }
}
```

#### Deliverables
- [ ] 4 new routes
- [ ] 7+ Angular components
- [ ] API integration with loading states
- [ ] Cache-aware UI (instant vs loading)
- [ ] Fallback to Lichess.org
- [ ] Responsive UI (mobile/tablet/desktop)
- [ ] Test suite

#### Success Criteria
- [x] User can solve puzzles interactively
- [x] Cached puzzles load instantly (<100ms)
- [x] Non-cached puzzles show loading state
- [x] Hints and solutions work correctly
- [x] "Open on Lichess" fallback works
- [x] Progress tracked and saved
- [x] Responsive design works
- [x] Keyboard shortcuts functional
- [x] Accessible (screen readers)

---

## Technical Recommendations

### 1. **Phased Rollout Strategy**
**Recommended Approach**:
```
Week 1: Phase 1 (Puzzle Index Import + Cache Setup)
Week 2: Phase 2 (Matching + Lichess API Integration)
Week 3: Phase 3 (Learning Path API)
Week 4: Phase 4 (Practice UI)
```

**Why**: Each phase builds on the previous, allows for testing and iteration.

### 2. **Migration Numbering**
**Update from original specs:**
- Phase 1: Migration `012_create_puzzle_index.js` + `013_create_puzzle_cache.js`
- Phase 2: Migration `014_create_blunder_puzzle_links.js`
- Phase 3: Migration `015_create_puzzle_progress_tables.js`

### 3. **Database-Specific Optimizations**

**SQLite (Development):**
```javascript
// Use transactions for batch inserts
await db.exec('BEGIN TRANSACTION');
// ... batch inserts ...
await db.exec('COMMIT');

// Enable WAL mode
await db.exec('PRAGMA journal_mode=WAL');
```

**PostgreSQL (Production - Railway.app):**
```javascript
// Use native array operations
const themes = ['fork', 'middlegame'];

await db.query(`
  SELECT * FROM puzzle_index
  WHERE themes && $1  -- Array overlap operator
`, [themes]);

// Use JSONB for flexible metadata
ALTER TABLE puzzle_cache ADD COLUMN metadata JSONB;
```

### 4. **Caching Strategy** ⭐ KEY RECOMMENDATION

**Puzzle Cache (24-hour TTL + LRU):**
```javascript
class PuzzleCacheManager {
  maxSize = 2000;        // 2000 puzzles × 5KB = 10MB
  ttl = 24 * 3600;       // 24 hours

  // LRU eviction when size exceeded
  // Automatic cleanup every hour
}
```

**Expected Cache Performance:**
- Day 1: 0% hit rate (cold cache)
- Day 7: 70% hit rate (popular puzzles cached)
- Day 30: 85% hit rate (warm cache)
- Storage: 10MB max (LRU bounded)

**Cleanup Job (Railway.app):**
```javascript
// Add to cron job or scheduled task
setInterval(async () => {
  await cacheManager.cleanup();
}, 3600000); // Every hour
```

### 5. **Lichess API Best Practices**

**Rate Limiting:**
- Max 1 request/second (conservative)
- Exponential backoff on 429 errors
- Batch requests when possible

**Error Handling:**
```javascript
try {
  puzzle = await lichessClient.fetchPuzzle(id);
} catch (error) {
  // Fallback: Show "Open on Lichess" button
  return {
    id,
    lichessUrl: `https://lichess.org/training/${id}`,
    error: true
  };
}
```

**Caching Headers:**
```javascript
// Respect Lichess cache headers
const cacheControl = response.headers.get('cache-control');
if (cacheControl?.includes('max-age')) {
  // Use Lichess's suggested cache duration
}
```

### 6. **Testing Database Separation**
**Critical**: Always use separate test database.

**Pattern:**
```javascript
const dbConfig = {
  development: {
    client: 'sqlite3',
    connection: { filename: './data/chess_analysis.db' }
  },
  test: {
    client: 'sqlite3',
    connection: { filename: './data/chess_analysis_test.db' }
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL
  }
};

const db = dbConfig[process.env.NODE_ENV || 'development'];
```

### 7. **Frontend State Management**
**Consideration**: With puzzle progress, API caching, and real-time updates, consider state management.

**Recommendation**: Start with Angular services, upgrade to NgRx if complexity grows.

```typescript
@Injectable({ providedIn: 'root' })
export class PuzzleStateService {
  private cache = new Map<string, Puzzle>();

  getCachedPuzzle(id: string): Puzzle | null {
    return this.cache.get(id) || null;
  }

  setCachedPuzzle(id: string, puzzle: Puzzle) {
    this.cache.set(id, puzzle);
  }
}
```

### 8. **Mobile UX Considerations**
**Critical for Phase 4**:
- Touch targets ≥44px (Apple HIG)
- Loading states prevent layout shift
- Swipe gestures for next/prev puzzle
- Progressive Web App (PWA) for offline capability

### 9. **Accessibility (WCAG 2.1 Level AA)**
**Required**:
- ARIA labels on all interactive elements
- Loading state announcements for screen readers
- Keyboard navigation (Tab, Enter, Escape)
- Focus indicators (2px outline)
- Color contrast ≥4.5:1

### 10. **Monitoring & Observability**

**Cache Performance Metrics:**
```javascript
class CacheMetrics {
  hits = 0;
  misses = 0;

  get hitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }

  logMetrics() {
    console.log(`Cache hit rate: ${this.hitRate.toFixed(1)}%`);
    console.log(`Cache size: ${this.currentSize}/${this.maxSize}`);
  }
}
```

**Lichess API Metrics:**
- Track API calls per hour
- Monitor rate limit errors
- Alert if hit rate drops below 50%

---

## Timeline & Resource Estimates

### Summary
| Phase | Effort (hours) | Duration (days) | Storage Impact | Dependencies |
|-------|----------------|-----------------|----------------|--------------|
| Phase 1: Index + Cache | 9-15 | 2 | +10MB | None |
| Phase 2: Matching + API | 24-31 | 5-6 | +10MB cache | Phase 1 |
| Phase 3: Progress API | 26-34 | 5-7 | +5MB user data | Phase 2 |
| Phase 4: UI | 40-54 | 7-10 | 0MB | Phase 3 |
| **Total** | **99-134** | **19-25** | **~25MB** | Sequential |

### Adjusted Timeline (with testing & iteration)
**Realistic Estimate**: 110-135 hours over 3-4 weeks

**Breakdown**:
- Development: 99-134 hours (as above)
- Integration testing: 10-15 hours
- Bug fixes: 5-10 hours
- Documentation: 5-10 hours

### Effort Changes from Original Plan
| Phase | Original | API-First | Change | Reason |
|-------|----------|-----------|--------|--------|
| Phase 1 | 11-17h | 9-15h | **-2h** | Import index only (simpler) |
| Phase 2 | 20-27h | 24-31h | **+4h** | Add API client + cache manager |
| Phase 3 | 26-34h | 26-34h | 0h | No change |
| Phase 4 | 38-52h | 40-54h | **+2h** | Add loading states, fallbacks |
| **Total** | 95-130h | 99-134h | **+4h** | Net increase (worth it for 99% storage savings) |

### Resource Requirements
**Single Developer**: 3-4 weeks full-time (40h/week)
**Part-Time (20h/week)**: 6-7 weeks
**Team of 2**: 2-3 weeks (parallel frontend/backend work)

### Railway.app Cost Projection

**Storage Costs:**
| Component | Size | Monthly Cost |
|-----------|------|--------------|
| Puzzle Index | 10MB | $0.0025 |
| Puzzle Cache | 10MB | $0.0025 |
| User Progress (100 users) | 5MB | $0.00125 |
| **Total** | **25MB** | **$0.00625** |

**Hobby Tier Budget:**
- Credit: $5/month
- Storage cost: $0.006/month
- **Remaining for compute:** $4.99/month
- **Storage used:** 0.5% of 5GB limit

---

## Success Criteria (Overall)

### Functional Requirements
- [ ] 3M+ puzzle indices imported and queryable
- [ ] 90% of blunders have 5+ relevant puzzle matches
- [ ] Puzzles fetched from Lichess API or cache
- [ ] Users can practice puzzles interactively
- [ ] Progress is tracked and persists
- [ ] Mastery scores update correctly
- [ ] Learning path prioritizes correctly
- [ ] Daily goals are generated
- [ ] Cache hit rate >70% after warmup

### Performance Requirements
- [ ] Puzzle index query <50ms
- [ ] Cached puzzle load <100ms
- [ ] Lichess API fetch <500ms
- [ ] Blunder matching <200ms per blunder
- [ ] API endpoints <300ms response time
- [ ] Frontend loads in <2 seconds
- [ ] Puzzle board responsive (<16ms frame time)

### Storage Requirements ⭐ CRITICAL
- [ ] Puzzle index <15MB
- [ ] Puzzle cache <10MB (LRU enforced)
- [ ] Total puzzle storage <25MB
- [ ] Railway storage usage <1% of 5GB limit

### Quality Requirements
- [ ] Test coverage ≥85% for all new code
- [ ] No console errors in production
- [ ] Accessible (WCAG 2.1 Level AA)
- [ ] Responsive (mobile/tablet/desktop)
- [ ] Error states handled gracefully
- [ ] Lichess API errors fallback to "Open on Lichess"

### User Experience
- [ ] Intuitive puzzle interface
- [ ] Clear feedback on correct/incorrect moves
- [ ] Progress visible throughout
- [ ] Loading states prevent layout shift
- [ ] Keyboard shortcuts work
- [ ] Dark mode supported
- [ ] Offline capability (cached puzzles only)

---

## Next Steps

### Immediate Actions (Week 1)

1. **Review & Approve Architecture**
   - ✅ Confirm API-first hybrid approach
   - ✅ Validate Railway.app storage constraints
   - Identify any concerns or blockers
   - Allocate resources

2. **Update GitHub Issues**
   - Update #79 with puzzle INDEX import (not full puzzles)
   - Update #80 with Lichess API client requirements
   - Update #81, #82 with cache-aware implementation
   - Correct migration numbers (012-015)
   - Add effort estimates

3. **Environment Setup**
   - Create `scripts/` directory
   - Install Phase 1 dependencies: `npm install csv-parser unbzip2-stream cli-progress axios`
   - Set up test database
   - Test Railway.app PostgreSQL connection

4. **Create Feature Branch**
   ```bash
   git checkout -b feature/78-lichess-puzzle-api-hybrid
   ```

5. **Start Phase 1**
   - Create migration 012 (puzzle_index)
   - Create migration 013 (puzzle_cache)
   - Implement download script
   - Implement index import script (NOT full puzzles)
   - Test with 1000 puzzle subset
   - Verify storage <15MB

### Communication Plan
- **Daily**: Update GitHub issue with progress
- **Weekly**: Commit and push code, run tests
- **Per Phase**:
  - Create PR for review
  - Verify Railway storage limits
  - Merge to main
  - Deploy to Railway staging
- **End of Project**:
  - Close issue #78
  - Create documentation PR
  - Monitor cache hit rate
  - Optimize based on metrics

---

## Appendix: Key Files Reference

### Backend Files to Create

```
chessify/
├── scripts/
│   ├── download-lichess-puzzles.js (new)
│   └── import-puzzle-index.js (new - INDEX ONLY)
├── src/
│   ├── models/
│   │   ├── migrations/
│   │   │   ├── 012_create_puzzle_index.js (new)
│   │   │   ├── 013_create_puzzle_cache.js (new)
│   │   │   ├── 014_create_blunder_puzzle_links.js (new)
│   │   │   └── 015_create_puzzle_progress_tables.js (new)
│   │   ├── lichess-api-client.js (new) ⭐
│   │   ├── puzzle-cache-manager.js (new) ⭐
│   │   ├── puzzle-matcher.js (new - uses API)
│   │   ├── puzzle-progress-tracker.js (new)
│   │   └── learning-path-generator.js (new)
│   └── api/
│       └── api-server.js (modify - add endpoints)
└── tests/
    ├── puzzle-index-import.test.js (new)
    ├── lichess-api-client.test.js (new) ⭐
    ├── puzzle-cache-manager.test.js (new) ⭐
    ├── puzzle-matcher.test.js (new)
    ├── puzzle-progress.test.js (new)
    └── learning-path.test.js (new)
```

### Frontend Files to Create

```
chessify/newfrontend/src/app/
├── pages/
│   ├── puzzles/
│   │   ├── puzzle.component.ts (new - API-aware)
│   │   └── puzzle-browser.component.ts (new)
│   └── learning-path/
│       └── learning-path.component.ts (new)
├── components/
│   ├── puzzle-board/ (new)
│   ├── puzzle-controls/ (new)
│   ├── puzzle-feedback/ (new)
│   └── puzzle-loading/ (new) ⭐
└── services/
    ├── puzzle.service.ts (new - cache-aware API)
    ├── puzzle-cache.service.ts (new) ⭐
    └── puzzle-progress.service.ts (new)
```

### Dependencies to Add

```bash
# Backend (Phase 1)
npm install csv-parser unbzip2-stream cli-progress axios

# Backend (Phase 2) - if using Redis for caching (optional)
npm install redis

# Frontend (Phase 4)
# No additional dependencies needed beyond existing Angular + Chessground
```

### Database Schema Summary

**Total Storage: ~20-25MB**

| Table | Size | Purpose |
|-------|------|---------|
| puzzle_index | 10MB | Searchable metadata for 3M puzzles |
| puzzle_cache | 10MB | LRU cache of full puzzle details |
| blunder_puzzle_links | 2MB | Links blunders to puzzle IDs |
| user_puzzle_progress | 3-5MB | User attempts, solutions, timing |
| theme_mastery | <1MB | Mastery scores per theme |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                           │
│  (Angular Frontend - Chessground Board)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express API Server                          │
│  • GET /api/puzzles/:id                                      │
│  • GET /api/blunders/:id/puzzles                             │
│  • GET /api/learning-path                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐     ┌──────────────────────┐
│  PuzzleMatcher   │     │ PuzzleCacheManager   │
│  - Query index   │     │  - Check cache       │
│  - Rank puzzles  │     │  - LRU eviction      │
└────────┬─────────┘     └──────────┬───────────┘
         │                          │
         ▼                          ▼
┌──────────────────────────────────────────────────────┐
│         Railway PostgreSQL (5GB limit)               │
│  ┌────────────────┐  ┌────────────────┐             │
│  │ puzzle_index   │  │ puzzle_cache   │             │
│  │ (10MB)         │  │ (10MB max)     │             │
│  │ - 3M puzzles   │  │ - 2000 puzzles │             │
│  │ - themes[]     │  │ - FEN, moves   │             │
│  │ - rating       │  │ - 24h TTL      │             │
│  └────────────────┘  └────────────────┘             │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   LichessAPIClient      │
         │  - Fetch on cache miss  │
         │  - Rate limit: 1/sec    │
         │  - Retry on 429         │
         └────────┬────────────────┘
                  │
                  ▼
         ┌─────────────────────────┐
         │   Lichess.org API       │
         │ /api/puzzle/{id}        │
         │  - Free, no auth        │
         │  - 3M+ puzzles          │
         └─────────────────────────┘
```

---

**Plan Version**: 2.0 (Railway-Optimized API-First Hybrid)
**Last Updated**: 2025-11-30
**Status**: Ready for implementation
**Storage Impact**: 20-25MB (99% reduction from original 2GB plan)
**Railway Friendly**: ✅ Yes (0.5% of 5GB limit)
