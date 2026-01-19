# ADR 010: Lichess Puzzle Integration - API-First Hybrid Architecture

## Status
**Complete** (All Phases Implemented)

## Context
Users need personalized chess training based on their actual blunders. The Lichess puzzle database (3M+ puzzles) provides an ideal training resource, but storing the full 2GB dataset would consume 40% of Railway.app's 5GB PostgreSQL limit.

### Problem Statement
- Users make recurring blunders with specific tactical themes (forks, pins, hanging pieces)
- No mechanism to practice puzzles that address these weaknesses
- Full puzzle storage (2GB) incompatible with Railway.app Hobby tier constraints

### Related Issues
- GitHub Epic: [#78 - Lichess Puzzle Integration](https://github.com/toamitkumar/chess-analyzer/issues/78)
- Phase 1: [#79 - Download/Import Puzzle Database](https://github.com/toamitkumar/chess-analyzer/issues/79)
- Phase 2: [#80 - Puzzle Matching Algorithm](https://github.com/toamitkumar/chess-analyzer/issues/80)
- Phase 3: [#81 - Recommendation API & Progress Tracking](https://github.com/toamitkumar/chess-analyzer/issues/81)
- Phase 4: [#82 - Interactive Puzzle Practice UI](https://github.com/toamitkumar/chess-analyzer/issues/82)

## Decision
Implement an **API-First Hybrid Architecture** that stores only puzzle metadata locally and fetches full puzzle details from Lichess API on-demand.

### Architecture Overview
```
┌─────────────────────────────────────────────────────┐
│ Railway PostgreSQL (20MB Total)                     │
├─────────────────────────────────────────────────────┤
│ puzzle_index (10MB) - 3M puzzle IDs + metadata      │
│ puzzle_cache (10MB max) - LRU cache, 24h TTL        │
│ user_puzzle_progress - Attempts, mastery scores    │
└─────────────────────────────────────────────────────┘
                         ↓
              Lichess API (on-demand)
         https://lichess.org/api/puzzle/{id}
```

### Storage Comparison
| Approach | Storage | Railway Usage |
|----------|---------|---------------|
| Full Local | 2GB | 40% of 5GB limit |
| API-First Hybrid | 20MB | 0.4% of 5GB limit |

## Implementation Status

### Critical Fix Applied: Multi-User Support (2026-01-19)

**Issue:** The puzzle progress system had `user_id` columns in database schema but code defaulted all users to 'default_user'.

**Fix Applied:**
- `PuzzleProgressTracker` now accepts `userId` parameter (defaults to 'default_user' for backward compatibility)
- `LearningPathGenerator` now accepts `userId` parameter
- All API endpoints updated to pass `req.userId` from Supabase authentication
- All SQL queries now filter by `user_id`

| Component | Status |
|-----------|--------|
| `PuzzleProgressTracker` | ✅ Fixed - accepts userId |
| `LearningPathGenerator` | ✅ Fixed - accepts userId |
| API endpoints | ✅ Fixed - uses req.userId |
| Unit tests | ✅ 121 tests passing |

### Completed Components

| Component | Location | Description |
|-----------|----------|-------------|
| `puzzle-matcher.js` | `src/models/` | Theme-based matching with scoring |
| `puzzle-cache-manager.js` | `src/models/` | LRU cache (2000 puzzles, 24h TTL) |
| `puzzle-progress-tracker.js` | `src/models/` | Mastery calculation (60% success, 25% efficiency, 15% first attempt) |
| `lichess-api-client.js` | `src/models/` | Rate-limited API client (1 req/sec) |
| `learning-path-generator.js` | `src/models/` | Spaced repetition, adaptive difficulty |
| Migration 012 | `migrations/` | puzzle_index table |
| Migration 013 | `migrations/` | puzzle_cache table |
| Migration 014 | `migrations/` | blunder_puzzle_links table |
| Migration 015 | `migrations/` | user_puzzle_progress, theme_mastery tables |

### API Endpoints Implemented
- `GET /api/puzzles/blunder/:blunderId` - Recommended puzzles for blunder
- `GET /api/puzzles/:puzzleId` - Full puzzle details (cache-aware)
- `POST /api/puzzles/link` - Link blunder to puzzles
- `GET /api/learning-path` - Personalized learning path
- `GET /api/learning-path/recommendations` - Puzzle recommendations
- `GET /api/learning-path/daily-goals` - Daily practice goals

### Pending (Phase 4)
- ~~Angular puzzle practice UI components~~ ✅ Complete
- ~~Interactive chessboard with move validation~~ ✅ Complete
- ~~Progress visualization dashboard~~ ✅ Complete

### Phase 4 Implementation (2026-01-20)

| Component | Location | Description |
|-----------|----------|-------------|
| `puzzles.component.ts` | `frontend/src/app/pages/puzzles/` | Interactive puzzle training UI |
| `theme-mapper.js` | `src/models/` | Maps blunder themes to Lichess puzzle themes |
| `puzzle-blunder-linker.js` | `src/models/` | Auto-links puzzles to blunders, marks learned |
| Board controls | Reused from game-detail-v2 | Navigation, flip board |
| Unit tests | `tests/models/` | 53 tests for new modules |

**Features Implemented:**
- Interactive chessboard with Chessground
- Move validation with correct/incorrect feedback
- Board controls (start, prev, flip, next, end)
- Keyboard navigation (arrow keys)
- Move list with click-to-navigate history
- Timer and progress stats
- Auto-linking puzzles to blunders by theme
- Blunder dashboard integration (learned count updates)
- Mobile responsive layout

## Consequences

### Positive
- 99% storage reduction (20MB vs 2GB)
- Railway.app compatible (0.4% vs 40% of limit)
- Always-current puzzle data from Lichess
- Scalable for multi-user growth
- 70-90% cache hit rate after warmup

### Negative
- Initial puzzle load latency (~200ms vs instant)
- Dependency on Lichess API availability
- Rate limiting requires careful management

### Mitigations
- LRU cache provides instant access for popular puzzles
- "Open on Lichess" fallback for API failures
- Exponential backoff on rate limit errors

## Technical Details

### Puzzle Matching Algorithm
```javascript
// Scoring: 100pts per theme match + rating/10 + popularity/10
score = (themeOverlap * 100) + (rating / 10) + (popularity / 10)
```

### Mastery Calculation
```javascript
mastery = (successRate * 0.60) + (efficiency * 0.25) + (firstAttemptRate * 0.15)
```

### Cache Configuration
- Max size: 2000 puzzles (~10MB)
- TTL: 24 hours
- Eviction: Least Recently Used (LRU)

## References
- [Implementation Plan](../plans/issue-78-implementation-plan.md)
- [Lichess Puzzle API](https://lichess.org/api#tag/Puzzles)
