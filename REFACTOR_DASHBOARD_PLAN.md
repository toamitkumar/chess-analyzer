# Dashboard Controller Refactoring Plan

## Overview
Extract dashboard and analytics endpoints from `api-server.js` into a dedicated dashboard controller with supporting service layer, following the same pattern used in the upload controller refactoring.

## Current State Analysis

### Dashboard-Related Endpoints in api-server.js

**Performance & Stats:**
- `GET /api/performance` (line 593) - Enhanced performance data with tournament filtering
- `GET /api/player-performance` (line 457) - Overall player performance calculation
- `GET /api/heatmap` (line 322) - Move quality heatmap (mock data)
- `GET /api/heatmap-db` (line 778) - Real database-driven heatmap

**Trends:**
- `GET /api/trends` (line 302) - Weekly performance trends
- `GET /api/trends/rating` (line 897) - Rating progression over games
- `GET /api/trends/centipawn-loss` (line 929) - Centipawn loss trends

**Games:**
- `GET /api/games` (line 847) - Games list with opening detection

**Issues Identified:**
1. **Business logic in routes**: Database queries, calculations, and data transformation mixed with HTTP handling
2. **Code duplication**: Similar patterns for tournament filtering, player matching, error handling
3. **Hard to test**: Can't unit test business logic without spinning up Express server
4. **No separation of concerns**: Performance calculations, trends, and heatmap logic all inline

## Refactoring Strategy

### Phase 0: Prepare Service Layer
- [x] Already have `src/services/` directory
- [x] Already have `tests/services/` directory

### Phase 1: Create DashboardService
Create a single **DashboardService** that orchestrates dashboard operations and uses existing calculator classes:

**DashboardService** (`src/services/DashboardService.js`):
- Uses existing `TrendCalculator`, `PerformanceCalculator`, `HeatmapCalculator` from `models/`
- Uses `database` for data access
- Methods:
  - `getPerformanceMetrics(tournamentId, userId)` - Get performance data from database
  - `getPlayerPerformance(userId)` - Calculate overall player stats with DB queries
  - `getTrendsData(userId)` - Weekly performance trends
  - `getRatingTrends(tournamentId, userId)` - Rating progression
  - `getCentipawnLossTrends(tournamentId, userId)` - CPL progression
  - `generateHeatmap(userId, tournamentId)` - Database-driven heatmap
  - `getGamesList(userId, limit, tournamentId)` - Games with openings

**Reuse Existing Classes** (no changes needed):
- `src/models/TrendCalculator.js` - Already has calculation logic
- `src/models/performance-stats.js` (PerformanceCalculator) - Already has performance logic
- `src/models/HeatmapCalculator.js` - Already has heatmap logic

### Phase 2: Write Unit Tests
Create comprehensive test file:
- `tests/services/DashboardService.test.js`

**Test Coverage Goals:**
- Mock database queries (no real DB calls in unit tests)
- Test edge cases (no games, null ratings, missing analysis)
- Test tournament filtering logic
- Test data transformation logic
- Target: 100% code coverage for new services

### Phase 3: Create Dashboard Controller
Create `src/api/controllers/dashboard.controller.js`:

**Methods:**
- `getPerformance(req, res)` - `/api/performance`
- `getPlayerPerformance(req, res)` - `/api/player-performance`
- `getTrends(req, res)` - `/api/trends`
- `getRatingTrends(req, res)` - `/api/trends/rating`
- `getCentipawnLossTrends(req, res)` - `/api/trends/centipawn-loss`
- `getHeatmap(req, res)` - `/api/heatmap-db`
- `getGamesList(req, res)` - `/api/games`

**Controller Responsibilities:**
- Parse request parameters (tournamentId, userId, query params)
- Call appropriate service methods
- Handle errors and return proper HTTP status codes
- Return JSON responses

### Phase 4: Write Controller Tests
Create `tests/controllers/dashboard.controller.test.js`:
- Test all 7 controller methods
- Mock all service dependencies
- Test query parameter parsing
- Test error handling (500 responses with fallback data)
- Test successful responses

### Phase 5: Update Routes
Update `src/api/routes/index.js` to use dashboard controller:
```javascript
const dashboardController = require('../controllers/dashboard.controller');

// Dashboard routes
router.get('/performance', dashboardController.getPerformance);
router.get('/player-performance', dashboardController.getPlayerPerformance);
router.get('/trends', dashboardController.getTrends);
router.get('/trends/rating', dashboardController.getRatingTrends);
router.get('/trends/centipawn-loss', dashboardController.getCentipawnLossTrends);
router.get('/heatmap-db', dashboardController.getHeatmap);
router.get('/games', dashboardController.getGamesList);
```

### Phase 6: Cleanup api-server.js
- Remove dashboard endpoint handlers from `api-server.js` (lines 302-954)
- Keep only:
  - Server setup and middleware
  - Route mounting (`app.use('/api', routes)`)
  - Static file serving
  - Error handling
  - Server startup logic

**Note**: Keep puzzle endpoints (lines 957-1280) as they're a separate domain

### Phase 7: Integration Testing
- Run full test suite
- Manual testing of dashboard endpoints via curl/Postman
- Verify tournament filtering works correctly
- Verify fallback data on errors

## Expected Benefits

1. **Cleaner Architecture**
   - Dashboard logic separated from HTTP concerns
   - Services can be reused in CLI tools or batch jobs

2. **Better Testability**
   - Services can be unit tested in isolation
   - Controllers can be tested with mocked services
   - No need for integration tests to verify business logic

3. **Easier Maintenance**
   - Dashboard logic centralized in service classes
   - Changes to calculations don't require touching routes
   - Easier to add new dashboard features

4. **Reduced api-server.js Size**
   - Remove ~650 lines of dashboard code
   - Keep server focused on setup and routing

## File Structure After Refactoring

```
src/
├── api/
│   ├── controllers/
│   │   ├── upload.controller.js
│   │   └── dashboard.controller.js (NEW)
│   ├── routes/
│   │   └── index.js (UPDATED)
│   └── api-server.js (REDUCED)
├── services/
│   ├── PGNParser.js
│   ├── PGNUploadService.js
│   ├── TournamentResolutionService.js
│   ├── GameAnalysisService.js
│   ├── GameStorageService.js
│   └── DashboardService.js (NEW)
└── models/
    ├── TrendCalculator.js (existing - reused)
    ├── performance-stats.js (existing - reused)
    ├── HeatmapCalculator.js (existing - reused)
    └── (other existing models)

tests/
├── controllers/
│   ├── upload.controller.test.js
│   └── dashboard.controller.test.js (NEW)
└── services/
    ├── PGNParser.test.js
    ├── PGNUploadService.test.js
    ├── TournamentResolutionService.test.js
    ├── GameAnalysisService.test.js
    ├── GameStorageService.test.js
    └── DashboardService.test.js (NEW)
```

## Implementation Order

1. Phase 1: Create DashboardService (single service using existing calculators)
2. Phase 2: Write unit tests for DashboardService (verify 100% passing)
3. Phase 3: Create dashboard.controller.js
4. Phase 4: Write unit tests for controller
5. Phase 5: Update routes/index.js
6. Phase 6: Clean up api-server.js
7. Phase 7: Integration testing

## Notes

- **Don't refactor puzzle endpoints** (lines 957-1280 in api-server.js) - those are a separate concern
- **Keep tournament endpoints** in api-server.js for now (they may warrant their own controller later)
- **Preserve existing behavior**: Fallback data on errors, tournament filtering, etc.
- **Use dependency injection** in services for testability (same pattern as upload services)
- **Follow upload refactoring patterns**: Constructor injection, async/await, proper error handling

## Success Criteria

- ✅ All service unit tests pass (target: 100% coverage)
- ✅ All controller unit tests pass
- ✅ Dashboard endpoints return same data as before refactoring
- ✅ Tournament filtering still works
- ✅ Error handling with fallback data preserved
- ✅ api-server.js reduced by ~650 lines
- ✅ Code more maintainable and testable
