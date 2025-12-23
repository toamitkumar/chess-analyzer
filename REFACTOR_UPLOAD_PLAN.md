# Upload Controller Refactoring Plan

## Overview
Refactor the monolithic `upload.controller.js` (~350 lines) into modular, testable services following SOLID principles and TDD approach.

## Current Problems
1. **Single Responsibility Violation**: One method handles HTTP parsing, validation, tournament resolution, game analysis, and storage
2. **Hard to Test**: Tightly coupled to Express req/res and external services
3. **No Unit Tests**: Complex logic has 0% test coverage
4. **Hard to Maintain**: 350+ lines in a single method makes debugging difficult
5. **Not Reusable**: Logic can't be used outside of HTTP context (e.g., CLI)

## Goals
- **100% Unit Test Coverage** for all services
- **Modular Architecture** with clear separation of concerns
- **Testable Code** using dependency injection
- **Reusable Services** that work in any context (HTTP, CLI, cron jobs)
- **Maintain Compatibility** - no breaking changes to API endpoints

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     upload.controller.js                     │
│  (Thin HTTP layer - orchestrates services, handles req/res) │
└───────────────┬─────────────────────────────────────────────┘
                │
                ├──► PGNUploadService (validation, deduplication)
                │
                ├──► TournamentResolutionService (auto-detect or assign)
                │
                ├──► GameAnalysisService (Stockfish analysis workflow)
                │
                └──► GameStorageService (database operations)
```

---

## Phase 0: Move PGNParser to Services (30 minutes)

### 0.1 Move Existing PGNParser
**Current**: `src/models/PGNParser.js` + `tests/PGNParser.test.js`
**New**: `src/services/PGNParser.js` + `tests/services/PGNParser.test.js`

**Actions:**
1. Create `src/services/` directory
2. Move `src/models/PGNParser.js` → `src/services/PGNParser.js`
3. Move `tests/PGNParser.test.js` → `tests/services/PGNParser.test.js`
4. Update all import paths in:
   - `upload.controller.js`
   - `api-server.js`
   - Test file itself
5. Run tests to ensure nothing broke

**Why First:**
- PGNParser already has 25 tests with good coverage
- No changes needed to the class itself
- Low risk, quick win
- Establishes the `services/` directory structure

---

## Phase 1: Create Service Classes

### 1.1 PGNUploadService
**File**: `src/services/pgn-upload.service.js`

```javascript
const crypto = require('crypto');
const PGNParser = require('./PGNParser'); // Use moved parser

class PGNUploadService {
  constructor() {
    this.parser = new PGNParser();
  }

  /**
   * Extract PGN content from HTTP request
   * @param {Object} req - Express request object
   * @returns {Object} { pgnContent, fileName, tournamentId }
   */
  extractPGNContent(req)

  /**
   * Calculate SHA-256 hash of PGN content
   * @param {string} pgnContent
   * @returns {string} Hash in hex format
   */
  calculateContentHash(pgnContent)

  /**
   * Check if PGN content already exists in database
   * @param {string} contentHash
   * @param {string} userId
   * @param {Database} database
   * @returns {Promise<Object|null>} Existing game or null
   */
  async checkDuplicate(contentHash, userId, database)

  /**
   * Validate PGN format and structure
   * Delegates to PGNParser
   * @param {string} pgnContent
   * @returns {Object} { valid: boolean, error?: string }
   */
  validatePGN(pgnContent)

  /**
   * Parse PGN content into games
   * Delegates to PGNParser
   * @param {string} pgnContent
   * @returns {Object} { games: Array, totalGames: number, errors: Array }
   */
  parsePGN(pgnContent)
}
```

**Tests**: `tests/services/pgn-upload.service.test.js`
- ✓ Extract PGN from multipart file upload
- ✓ Extract PGN from JSON request body
- ✓ Handle missing PGN content
- ✓ Calculate content hash correctly
- ✓ Detect duplicate content
- ✓ Validate valid PGN (delegates to PGNParser)
- ✓ Reject invalid PGN (delegates to PGNParser)
- ✓ Parse single game PGN (delegates to PGNParser)
- ✓ Parse multi-game PGN (delegates to PGNParser)

---

### 1.2 TournamentResolutionService
**File**: `src/services/tournament-resolution.service.js`

```javascript
class TournamentResolutionService {
  /**
   * Resolve tournament by ID or auto-detect from PGN
   * @param {string} pgnContent
   * @param {number|null} assignedTournamentId
   * @param {string} userId
   * @param {TournamentManager} tournamentManager
   * @returns {Promise<Object>} Tournament object
   */
  async resolveTournament(pgnContent, assignedTournamentId, userId, tournamentManager)

  /**
   * Get tournament by ID
   * @param {number} tournamentId
   * @param {TournamentManager} tournamentManager
   * @returns {Promise<Object|null>} Tournament or null
   */
  async getTournamentById(tournamentId, tournamentManager)

  /**
   * Auto-detect tournament from PGN headers
   * @param {string} pgnContent
   * @param {string} userId
   * @param {TournamentManager} tournamentManager
   * @returns {Promise<Object>} Tournament object
   */
  async autoDetectTournament(pgnContent, userId, tournamentManager)
}
```

**Tests**: `tests/services/tournament-resolution.service.test.js`
- ✓ Resolve by assigned tournament ID
- ✓ Handle invalid tournament ID
- ✓ Auto-detect tournament from PGN headers
- ✓ Create new tournament if not found
- ✓ Handle missing tournament headers

---

### 1.3 GameAnalysisService
**File**: `src/services/game-analysis.service.js`

```javascript
class GameAnalysisService {
  /**
   * Wait for Stockfish engine to be ready
   * @param {ChessAnalyzer} analyzer
   * @param {number} timeout - Timeout in milliseconds (default: 30000)
   * @returns {Promise<boolean>} true if ready, false if timeout
   */
  async waitForStockfishReady(analyzer, timeout = 30000)

  /**
   * Analyze a single game
   * @param {Object} game - Parsed game object
   * @param {ChessAnalyzer} analyzer
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeGame(game, analyzer)

  /**
   * Analyze multiple games in batch
   * @param {Array} games - Array of parsed games
   * @param {ChessAnalyzer} analyzer
   * @param {Function} onProgress - Progress callback (gameIndex, totalGames)
   * @returns {Promise<Object>} { analyzedGames, errors }
   */
  async analyzeGames(games, analyzer, onProgress = null)

  /**
   * Validate game has valid moves
   * @param {Object} game
   * @returns {boolean}
   */
  hasValidMoves(game)

  /**
   * Format analysis result for storage
   * @param {Object} game
   * @param {Object} analysis
   * @returns {Object} Formatted analyzed game
   */
  formatAnalysisResult(game, analysis)
}
```

**Tests**: `tests/services/game-analysis.service.test.js`
- ✓ Wait for Stockfish ready
- ✓ Handle Stockfish timeout
- ✓ Analyze single game successfully
- ✓ Handle game with no moves
- ✓ Handle analysis errors gracefully
- ✓ Analyze multiple games in batch
- ✓ Report progress during batch analysis
- ✓ Validate game has moves
- ✓ Format analysis result correctly

---

### 1.4 GameStorageService
**File**: `src/services/game-storage.service.js`

```javascript
class GameStorageService {
  /**
   * Store analyzed game in database
   * @param {Object} game - Analyzed game
   * @param {Object} tournament
   * @param {string} userId
   * @param {string} pgnContent
   * @param {string} filePath
   * @param {Database} database
   * @returns {Promise<number>} Game ID
   */
  async storeGame(game, tournament, userId, pgnContent, filePath, database)

  /**
   * Store game analysis data
   * @param {number} gameId
   * @param {Array} moveAnalyses
   * @param {Database} database
   * @returns {Promise<void>}
   */
  async storeAnalysis(gameId, moveAnalyses, database)

  /**
   * Store alternative moves for a position
   * @param {number} gameId
   * @param {number} moveNumber
   * @param {Array} alternatives
   * @param {Database} database
   * @returns {Promise<void>}
   */
  async storeAlternativeMoves(gameId, moveNumber, alternatives, database)

  /**
   * Store position evaluation
   * @param {number} gameId
   * @param {number} moveNumber
   * @param {string} fenBefore
   * @param {number} evaluation
   * @param {string} bestMove
   * @param {number} depth
   * @param {Database} database
   * @returns {Promise<void>}
   */
  async storePositionEvaluation(gameId, moveNumber, fenBefore, evaluation, bestMove, depth, database)

  /**
   * Store PGN in tournament folder
   * @param {string} pgnContent
   * @param {string} fileName
   * @param {string} tournamentName
   * @param {FileStorage} fileStorage
   * @returns {Promise<Object>} { relativePath, tournamentFolder, fileName }
   */
  async storePGNInTournament(pgnContent, fileName, tournamentName, fileStorage)

  /**
   * Update tournament game count
   * @param {number} tournamentId
   * @param {TournamentManager} tournamentManager
   * @returns {Promise<void>}
   */
  async updateTournamentGameCount(tournamentId, tournamentManager)

  /**
   * Update performance metrics
   * @param {Database} database
   * @returns {Promise<void>}
   */
  async updatePerformanceMetrics(database)
}
```

**Tests**: `tests/services/game-storage.service.test.js`
- ✓ Store game with metadata
- ✓ Store game analysis data
- ✓ Store alternative moves
- ✓ Store position evaluations
- ✓ Store PGN in tournament folder
- ✓ Handle file storage errors
- ✓ Update tournament game count
- ✓ Update performance metrics
- ✓ Handle database errors gracefully

---

## Phase 2: Refactor Upload Controller

### 2.1 New Controller Structure
**File**: `src/api/controllers/upload.controller.js`

```javascript
class UploadController {
  constructor(
    pgnUploadService,
    tournamentResolutionService,
    gameAnalysisService,
    gameStorageService
  ) {
    this.pgnUploadService = pgnUploadService;
    this.tournamentResolutionService = tournamentResolutionService;
    this.gameAnalysisService = gameAnalysisService;
    this.gameStorageService = gameStorageService;
  }

  /**
   * Handle PGN file upload or text content
   * Thin orchestration layer - delegates to services
   */
  async upload(req, res) {
    try {
      // 1. Extract PGN content
      const { pgnContent, fileName, tournamentId } =
        this.pgnUploadService.extractPGNContent(req);

      // 2. Check for duplicates
      const contentHash = this.pgnUploadService.calculateContentHash(pgnContent);
      const duplicate = await this.pgnUploadService.checkDuplicate(
        contentHash, req.userId, database
      );
      if (duplicate) {
        return res.json({ success: true, duplicate: true, existingGameId: duplicate.id });
      }

      // 3. Validate PGN
      const validation = this.pgnUploadService.validatePGN(pgnContent, parser);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // 4. Resolve tournament
      const tournament = await this.tournamentResolutionService.resolveTournament(
        pgnContent, tournamentId, req.userId, tournamentManager
      );

      // 5. Parse PGN
      const parseResult = this.pgnUploadService.parsePGN(pgnContent, parser);

      // 6. Analyze games
      const analyzer = new ChessAnalyzer();
      await this.gameAnalysisService.waitForStockfishReady(analyzer);
      const { analyzedGames, errors } = await this.gameAnalysisService.analyzeGames(
        parseResult.games,
        analyzer,
        (i, total) => console.log(`Analyzing ${i}/${total}`)
      );

      // 7. Store games
      const storedGameIds = [];
      for (const game of analyzedGames) {
        if (game.analysis) {
          const gameId = await this.gameStorageService.storeGame(
            game, tournament, req.userId, pgnContent, fileName, database
          );
          storedGameIds.push(gameId);
        }
      }

      // 8. Update metrics
      await this.gameStorageService.updateTournamentGameCount(tournament.id, tournamentManager);
      await this.gameStorageService.updatePerformanceMetrics(database);
      await analyzer.close();

      // 9. Return response
      return res.json({
        success: true,
        totalGames: parseResult.totalGames,
        analyzedGames: analyzedGames.filter(g => g.analysis).length,
        storedGames: storedGameIds.length,
        tournament: { id: tournament.id, name: tournament.name },
        errors: [...parseResult.errors, ...errors]
      });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({ error: 'Failed to process PGN file' });
    }
  }

  async manualEntry(req, res) {
    // Same implementation as before
  }
}

// Export singleton with injected dependencies
module.exports = new UploadController(
  new PGNUploadService(),
  new TournamentResolutionService(),
  new GameAnalysisService(),
  new GameStorageService()
);
```

**Tests**: `tests/controllers/upload.controller.test.js`
- ✓ Integration test: successful file upload
- ✓ Integration test: successful JSON upload
- ✓ Integration test: duplicate detection
- ✓ Integration test: invalid PGN rejection
- ✓ Integration test: tournament assignment
- ✓ Integration test: tournament auto-detection
- ✓ Integration test: multiple games processing
- ✓ Integration test: error handling

---

## Phase 3: Write Tests (TDD Approach)

### 3.1 Test Files to Create
```
tests/
├── services/
│   ├── pgn-upload.service.test.js (25 tests)
│   ├── tournament-resolution.service.test.js (15 tests)
│   ├── game-analysis.service.test.js (20 tests)
│   └── game-storage.service.test.js (20 tests)
└── controllers/
    └── upload.controller.test.js (10 integration tests)

Total: ~90 tests
```

### 3.2 Test Patterns
- **Unit Tests**: Mock all dependencies, test single function behavior
- **Integration Tests**: Test controller with real services, mock only external dependencies (database, Stockfish)
- **Fixtures**: Use sample PGN files from `tests/fixtures/`

### 3.3 Test Coverage Goals
- **Services**: 100% line coverage
- **Controller**: 90%+ line coverage (some error paths hard to trigger)
- **Overall**: 95%+ coverage

---

## Phase 4: Implementation Plan

### Step 1: Write Tests First (1-2 hours)
1. Create test files with all test cases (describe blocks, no implementation)
2. Run tests to see failures (Red)
3. This documents expected behavior

### Step 2: Create Service Classes (2-3 hours)
1. Create empty service classes with method stubs
2. Implement `PGNUploadService` + make tests pass (Green)
3. Implement `TournamentResolutionService` + make tests pass (Green)
4. Implement `GameAnalysisService` + make tests pass (Green)
5. Implement `GameStorageService` + make tests pass (Green)

### Step 3: Refactor Controller (1 hour)
1. Update `upload.controller.js` to use services
2. Run integration tests to ensure no regressions
3. Run manual tests with actual uploads

### Step 4: Cleanup (30 minutes)
1. Remove dead code
2. Update documentation
3. Run full test suite
4. Verify 95%+ coverage

**Total Time Estimate: 5-7 hours**

---

## Migration Strategy

### Backward Compatibility
- ✅ No API changes - endpoints remain the same
- ✅ Same request/response format
- ✅ Same database schema
- ✅ Same behavior for end users

### Rollback Plan
If issues arise:
1. Revert to commit before refactoring
2. Services are new files, so no risk of breaking existing code
3. Controller changes are isolated to `upload.controller.js`

---

## Success Criteria

- [ ] All 90+ tests passing
- [ ] 95%+ test coverage
- [ ] No breaking changes to API
- [ ] Manual testing passes (file upload, JSON upload)
- [ ] Code review approved
- [ ] Documentation updated

---

## Benefits After Refactoring

1. **Maintainability**: Easy to find and fix bugs in specific services
2. **Testability**: Each service can be tested independently
3. **Reusability**: Services can be used in CLI, cron jobs, or other contexts
4. **Extensibility**: Easy to add new features (e.g., batch upload, async processing)
5. **Code Quality**: Clear separation of concerns, SOLID principles
6. **Confidence**: High test coverage means safe refactoring in the future

---

## Questions for Review

1. Do you agree with the service boundaries (PGN, Tournament, Analysis, Storage)?
2. Should we use dependency injection in constructors or keep singletons?
3. Any additional test cases you'd like to see?
4. Should we tackle this in one PR or break into multiple PRs (one per service)?
5. Any concerns about the migration strategy?

---

## Next Steps After Approval

1. Create GitHub issue with this plan
2. Create feature branch: `feature/refactor-upload-controller`
3. Start with Phase 3: Write all tests first (TDD)
4. Implement services one by one
5. Create PR for review
6. Merge after approval

---

**Estimated LOC:**
- Services: ~800 lines (4 services × 200 lines)
- Tests: ~1200 lines (90 tests × ~15 lines)
- Controller: ~150 lines (simplified from 350)
- **Total New Code**: ~2000 lines
- **Net Change**: +1650 lines (includes tests)
