# Lichess Puzzle Integration - Implementation Plan

## Executive Summary

**Feature**: Lichess Puzzle Integration (#78)
**Goal**: Create a personalized chess learning system that matches blunders with relevant training puzzles
**Effort**: ~115-140 hours across 4 phases
**Prerequisites**: ✅ Completed (#76, #77)
**Timeline**: 3-4 weeks for full implementation

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
- **Database**: SQLite with 11 migrations (latest: 011_fix_cascade_delete_constraints.js)
- **Dependencies**: chess.js, express, stockfish, sqlite3
- **Storage**: 4.3MB currently, 493GB available (plenty for ~2GB puzzle DB)
- **Architecture**: Node.js 20.x backend + Angular frontend

### 🚧 Missing Components
- Puzzle database (3M+ puzzles from Lichess)
- Puzzle matching algorithm
- Progress tracking system
- Interactive puzzle UI
- Dependencies: csv-parser, unbzip2-stream, cli-progress, axios

---

## Gap Analysis & Risks

### Identified Gaps

#### 1. **Database Migration Numbering Conflict**
- **Issue**: Specs call for migrations 008-010, but current DB is at migration 011
- **Impact**: Migration files need renumbering
- **Solution**:
  - Phase 1 → `012_create_puzzles_table.js`
  - Phase 2 → `013_create_blunder_puzzle_links.js`
  - Phase 3 → `014_create_puzzle_progress_tables.js`

#### 2. **Scripts Directory Missing**
- **Issue**: No `/scripts` directory for download/import scripts
- **Impact**: Need to create directory structure
- **Solution**: Create `chessify/scripts/` directory in Phase 1

#### 3. **Multi-User Support**
- **Issue**: Current system hardcoded for single player (AdvaitKumar1213)
- **Impact**: Puzzle progress tracking assumes single user
- **Solution**: Current implementation OK for MVP, document as future enhancement

#### 4. **Disk Space for Puzzle Database**
- **Issue**: ~1.5GB compressed, ~4GB uncompressed, ~2GB final DB size
- **Impact**: Total ~7GB needed during import
- **Mitigation**: ✅ 493GB available - no concern

#### 5. **Import Performance**
- **Issue**: 3M+ puzzles could take significant time to import
- **Impact**: Users waiting for initial setup
- **Solution**: Spec includes progress bar, batch inserts, and streaming - addressed

#### 6. **Theme Mapping Completeness**
- **Issue**: Lichess themes may not perfectly map to BlunderCategorizer themes
- **Impact**: Some blunders might not find good puzzle matches
- **Solution**: Spec includes comprehensive THEME_MAPPING in Phase 2, may need iteration

### Risk Assessment

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Lichess puzzle DB format changes | High | Low | Document format version, test with sample |
| Import fails midway (network/disk) | Medium | Medium | ✅ Spec includes resume logic, error handling |
| Poor puzzle match quality | Medium | Medium | Manual QA in Phase 2, adjust scoring algorithm |
| Slow query performance | Medium | Medium | ✅ Spec includes indexes, caching |
| Storage exceeds limits (Heroku) | High | Low | Document storage requirements, consider CDN |
| Stockfish timeout during multi-PV | Low | Medium | Already handled in existing analyzer |
| Frontend performance (3M puzzles) | Low | Low | Pagination and filtering in spec |

---

## Implementation Roadmap

### Phase 1: Database Import (#79)
**Estimated Effort**: 11-17 hours
**Dependencies**: None

#### Tasks
1. **Setup** (2h)
   - Create `scripts/` directory
   - Install dependencies: `npm install csv-parser unbzip2-stream cli-progress axios`
   - Create migration `012_create_puzzles_table.js`

2. **Download Script** (2-3h)
   - `scripts/download-lichess-puzzles.js`
   - URL: https://database.lichess.org/lichess_db_puzzle.csv.bz2
   - Progress bar, retry logic, checksum validation
   - Store in `data/lichess_puzzles.csv.bz2`

3. **Import Script** (4-6h)
   - `scripts/import-lichess-puzzles.js`
   - Streaming CSV parser (memory efficient)
   - Batch inserts (1000 records at a time)
   - Validation (FEN, UCI moves, ratings)
   - Error logging to `data/import_errors.log`

4. **Testing** (3-4h)
   - Unit tests for CSV parsing
   - Integration test with 1000 puzzle subset
   - Performance test with 100K puzzles
   - Error handling tests

5. **Documentation** (1-2h)
   - Update README with import instructions
   - Document npm script: `npm run import-puzzles`

#### Deliverables
- [ ] Migration 012 creating puzzles table
- [ ] Download script with progress bar
- [ ] Import script with streaming
- [ ] Test suite (≥80% coverage)
- [ ] Documentation

#### Success Criteria
- [x] 3M+ puzzles imported successfully
- [x] Import completes in <10 minutes for 1M puzzles
- [x] Query by theme <100ms
- [x] Database size <2GB

---

### Phase 2: Puzzle Matching (#80)
**Estimated Effort**: 20-27 hours
**Dependencies**: Phase 1 complete

#### Tasks
1. **PuzzleMatcher Class** (6-8h)
   - `src/models/puzzle-matcher.js`
   - Theme mapping (blunder categories → Lichess themes)
   - Similarity scoring algorithm
   - Priority ranking (1-4)
   - Caching strategy

2. **Database Schema** (2-3h)
   - Migration `013_create_blunder_puzzle_links.js`
   - `blunder_puzzle_links` table with indexes

3. **Auto-Linking Service** (3-4h)
   - Background job to link blunders to puzzles
   - Trigger on new blunder detection
   - Batch linking for existing blunders

4. **API Endpoints** (2-3h)
   - `GET /api/blunders/:id/puzzles`
   - `POST /api/blunders/:id/refresh-puzzles`
   - `GET /api/puzzles/match` (testing)

5. **Testing** (4-5h)
   - Unit tests for similarity scoring
   - Integration tests for each blunder type
   - Quality verification (manual review)
   - Performance tests

6. **Iteration** (3-4h)
   - Tune similarity algorithm based on test results
   - Adjust theme mapping
   - Optimize queries

#### Deliverables
- [ ] PuzzleMatcher class with tests
- [ ] Migration 013 for puzzle links
- [ ] API endpoints
- [ ] Theme mapping documentation

#### Success Criteria
- [x] 90% of blunders have 5+ relevant puzzles
- [x] Similarity scores are meaningful (manual QA)
- [x] Query <200ms per blunder
- [x] Batch matching 100 blunders <10s
- [x] Test coverage ≥85%

---

### Phase 3: Learning Path API (#81)
**Estimated Effort**: 26-34 hours
**Dependencies**: Phase 2 complete

#### Tasks
1. **Database Schema** (2h)
   - Migration `014_create_puzzle_progress_tables.js`
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
   - `GET /api/puzzles/recommended`
   - `GET /api/puzzles/:id`
   - `POST /api/puzzles/:id/attempt`
   - `POST /api/puzzles/:id/solve`
   - `GET /api/puzzles/progress`
   - `GET /api/learning-path`

6. **Testing** (5-6h)
   - Unit tests for mastery calculation
   - API integration tests
   - Performance tests (1000+ attempts)

#### Deliverables
- [ ] Migration 014 for progress tracking
- [ ] PuzzleProgressTracker class
- [ ] LearningPathGenerator class
- [ ] 6 API endpoints with tests

#### Success Criteria
- [x] Recommendations are personalized
- [x] Mastery score reflects performance
- [x] Learning path prioritizes correctly
- [x] API response <200ms
- [x] Test coverage ≥85%

---

### Phase 4: Practice UI (#82)
**Estimated Effort**: 38-52 hours
**Dependencies**: Phase 3 complete

#### Tasks
1. **Frontend Routes** (2h)
   - `/puzzles` - Browser/filter
   - `/puzzles/:id` - Practice view
   - `/learning-path` - Study plan
   - `/puzzles/daily` - Daily challenge

2. **Core Puzzle Component** (8-10h)
   - `PuzzleComponent` with Chessground integration
   - Move validation (UCI format)
   - Auto-play opponent responses
   - Solution playback

3. **User Interaction** (4-6h)
   - Drag-and-drop pieces
   - Move highlighting
   - Visual feedback (green/red)
   - Animations

4. **Help System** (3-4h)
   - Hint button (highlight square)
   - Solution button
   - Explanation text

5. **Progress Display** (3-4h)
   - Timer, attempts counter
   - Theme badges, difficulty
   - Success/failure messages
   - Mastery score updates

6. **Puzzle Browser** (4-6h)
   - `PuzzleBrowserComponent`
   - Filter by theme/difficulty
   - Mini board thumbnails
   - Pagination

7. **Learning Path View** (4-6h)
   - `LearningPathComponent`
   - Recommended themes
   - Daily goal progress
   - Recent activity feed

8. **Styling & Responsive** (6-8h)
   - Desktop (600x600 board)
   - Tablet (500x500)
   - Mobile (320x320)
   - Dark mode support

9. **Testing** (6-8h)
   - Unit tests for components
   - E2E tests for puzzle flow
   - Responsive testing

#### Deliverables
- [ ] 4 new routes
- [ ] 7+ Angular components
- [ ] Responsive UI (mobile/tablet/desktop)
- [ ] Test suite

#### Success Criteria
- [x] User can solve puzzles interactively
- [x] Hints and solutions work correctly
- [x] Progress tracked and saved
- [x] Responsive design works
- [x] Keyboard shortcuts functional
- [x] Accessible (screen readers)

---

## Technical Recommendations

### 1. **Phased Rollout Strategy**
**Recommended Approach**:
```
Week 1: Phase 1 (Database Import)
Week 2: Phase 2 (Puzzle Matching)
Week 3: Phase 3 (Learning Path API)
Week 4: Phase 4 (Practice UI)
```

**Why**: Each phase builds on the previous, allows for testing and iteration.

### 2. **Migration Number Correction**
**Action**: Update specs to use migrations 012-014 instead of 008-010.

**Files to Update**:
- Issue #79 spec: Change to 012
- Issue #80 spec: Change to 013
- Issue #81 spec: Change to 014

### 3. **Import Performance Optimization**
**Recommended**:
- Use SQLite transaction wrapper for batch inserts (5-10x faster)
- Create indexes AFTER import, not during
- Use `PRAGMA journal_mode=WAL` for concurrent reads
- Consider `--limit 100000` flag for initial testing

**Code Pattern**:
```javascript
await db.exec('BEGIN TRANSACTION');
// ... batch inserts ...
await db.exec('COMMIT');
```

### 4. **Testing Database Separation**
**Critical**: Always use `chess_analysis_test.db` for tests (per CLAUDE.md).

**Recommended Pattern**:
```javascript
const dbPath = process.env.NODE_ENV === 'test'
  ? './data/chess_analysis_test.db'
  : './data/chess_analysis.db';
```

### 5. **Caching Strategy**
**Recommended**:
- Puzzle recommendations: 5 minutes (matches existing API cache)
- Theme mastery: 10 minutes
- Learning path: 1 hour
- Individual puzzles: 24 hours

### 6. **Frontend State Management**
**Consideration**: With puzzle progress, consider using NgRx or Akita for state management.

**Why**: Synchronizing progress across components (board, timer, mastery score) can get complex.

**Alternative**: Start with Angular services, refactor if needed.

### 7. **Stockfish Multi-PV Analysis**
**Note**: Specs mention multi-PV for puzzles, but Stockfish timeout issues exist per CLAUDE.md.

**Recommendation**:
- Start with single-line solutions (puzzle.moves)
- Add multi-PV in future enhancement
- OR mock Stockfish for puzzle analysis (puzzles already have solutions)

### 8. **Mobile UX Considerations**
**Critical for Phase 4**:
- Touch targets ≥44px (Apple HIG)
- Prevent zoom on input focus
- Swipe gestures for next/prev puzzle
- Offline support (Service Worker) for downloaded puzzles

### 9. **Accessibility (WCAG 2.1 Level AA)**
**Required**:
- ARIA labels on all interactive elements
- Keyboard navigation (Tab, Enter, Escape)
- Focus indicators (2px outline)
- Screen reader announcements for moves
- Color contrast ≥4.5:1

### 10. **Error Recovery**
**Recommendations**:
- **Download fails**: Retry 3x with exponential backoff, resume if supported
- **Import fails**: Save progress (last puzzle ID), allow resume
- **Matching fails**: Gracefully degrade (show random puzzles)
- **API fails**: Show cached data, retry in background

---

## Timeline & Resource Estimates

### Summary
| Phase | Effort (hours) | Duration (days) | Dependencies |
|-------|----------------|-----------------|--------------|
| Phase 1: Import | 11-17 | 2-3 | None |
| Phase 2: Matching | 20-27 | 4-5 | Phase 1 |
| Phase 3: API | 26-34 | 5-7 | Phase 2 |
| Phase 4: UI | 38-52 | 7-10 | Phase 3 |
| **Total** | **95-130** | **18-25** | Sequential |

### Adjusted Timeline (with testing & iteration)
**Realistic Estimate**: 115-140 hours over 3-4 weeks

**Breakdown**:
- Development: 95-130 hours (as above)
- Integration testing: 10-15 hours
- Bug fixes: 5-10 hours
- Documentation: 5-10 hours

### Resource Requirements
**Single Developer**: 3-4 weeks full-time (40h/week)
**Part-Time (20h/week)**: 6-8 weeks
**Team of 2**: 2-3 weeks (parallel frontend/backend work)

### Critical Path
```
Phase 1 → Phase 2 → Phase 3 → Phase 4
  ↓         ↓         ↓          ↓
 Test     Test      Test       Test
  ↓         ↓         ↓          ↓
 Doc      Doc       Doc        Doc
```

---

## Success Criteria (Overall)

### Functional Requirements
- [ ] 3M+ puzzles imported and queryable
- [ ] 90% of blunders have 5+ relevant puzzle matches
- [ ] Users can practice puzzles interactively
- [ ] Progress is tracked and persists
- [ ] Mastery scores update correctly
- [ ] Learning path prioritizes correctly
- [ ] Daily goals are generated

### Performance Requirements
- [ ] Puzzle query <100ms
- [ ] Blunder matching <200ms per blunder
- [ ] API endpoints <200ms response time
- [ ] Frontend loads in <2 seconds
- [ ] Puzzle board responsive (<16ms frame time)

### Quality Requirements
- [ ] Test coverage ≥85% for all new code
- [ ] No console errors in production
- [ ] Accessible (WCAG 2.1 Level AA)
- [ ] Responsive (mobile/tablet/desktop)
- [ ] Error states handled gracefully

### User Experience
- [ ] Intuitive puzzle interface
- [ ] Clear feedback on correct/incorrect moves
- [ ] Progress visible throughout
- [ ] Keyboard shortcuts work
- [ ] Dark mode supported

---

## Next Steps

### Immediate Actions (Week 1)
1. **Review & Approve Plan**
   - Confirm timeline and scope
   - Identify any concerns or blockers
   - Allocate resources

2. **Update Issue Specs**
   - Correct migration numbers (012-014)
   - Add missing technical details from this plan
   - Tag issues with effort estimates

3. **Environment Setup**
   - Create `scripts/` directory
   - Install Phase 1 dependencies
   - Set up test database

4. **Create Feature Branch**
   ```bash
   git checkout -b feature/78-lichess-puzzle-integration
   ```

5. **Start Phase 1**
   - Create migration 012
   - Implement download script
   - Test with 1000 puzzle subset

### Communication Plan
- **Daily**: Update GitHub issue with progress
- **Weekly**: Commit and push code, run tests
- **Per Phase**: Create PR for review, merge to main
- **End of Project**: Close issue #78, create documentation PR

---

## Appendix: Key Files Reference

### Backend Files to Create
```
chessify/
├── scripts/
│   ├── download-lichess-puzzles.js (new)
│   └── import-lichess-puzzles.js (new)
├── src/
│   ├── models/
│   │   ├── migrations/
│   │   │   ├── 012_create_puzzles_table.js (new)
│   │   │   ├── 013_create_blunder_puzzle_links.js (new)
│   │   │   └── 014_create_puzzle_progress_tables.js (new)
│   │   ├── puzzle-matcher.js (new)
│   │   ├── puzzle-progress-tracker.js (new)
│   │   └── learning-path-generator.js (new)
│   └── api/
│       └── api-server.js (modify - add endpoints)
└── tests/
    ├── puzzle-import.test.js (new)
    ├── puzzle-matcher.test.js (new)
    ├── puzzle-progress.test.js (new)
    └── learning-path.test.js (new)
```

### Frontend Files to Create
```
chessify/newfrontend/src/app/
├── pages/
│   ├── puzzles/
│   │   ├── puzzle.component.ts (new)
│   │   └── puzzle-browser.component.ts (new)
│   └── learning-path/
│       └── learning-path.component.ts (new)
├── components/
│   ├── puzzle-board/ (new)
│   ├── puzzle-controls/ (new)
│   └── puzzle-feedback/ (new)
└── services/
    ├── puzzle.service.ts (new)
    └── puzzle-progress.service.ts (new)
```

### Dependencies to Add
```bash
# Backend (Phase 1)
npm install csv-parser unbzip2-stream cli-progress axios

# Frontend (Phase 4) - if needed
npm install ng2-charts chart.js  # for any additional charts
```

---

**Plan Version**: 1.0
**Last Updated**: 2025-11-29
**Status**: Ready for implementation
