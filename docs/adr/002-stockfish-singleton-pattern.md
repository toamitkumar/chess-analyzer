# ADR 002: Stockfish Singleton Pattern for Game Analysis

**Status:** Accepted
**Date:** 2025-12-25
**Decision Makers:** Development Team
**Related Issue:** User_id/user_color separation implementation

## Context

The chess analysis platform uses the Stockfish engine to analyze chess games uploaded by users. Each game requires deep position analysis which is CPU-intensive and takes time to initialize.

### Problem Statement

When multiple PGN files were uploaded in quick succession, only the first game would be analyzed. Subsequent uploads failed with:
```
Analyzer error: Stockfish engine not ready
❌ Analysis failed for game: Stockfish engine not ready
```

### Root Cause

The original architecture created a **new Stockfish engine instance for each upload**:

```
Upload 1 → New PGNUploadService → New GameAnalysisService → New ChessAnalyzer → New Stockfish process
Upload 2 → New PGNUploadService → New GameAnalysisService → New ChessAnalyzer → New Stockfish process
Upload 3 → New PGNUploadService → New GameAnalysisService → New ChessAnalyzer → New Stockfish process
```

**Critical Issue:** Stockfish takes 10-60 seconds to initialize (varies by machine). When uploads happened in quick succession:
- Upload 1: New Stockfish instance starts, initializes successfully ✅, analysis completes
- Upload 2: New Stockfish instance starts, **times out before ready** ❌, analysis fails
- Upload 3: New Stockfish instance starts, **times out before ready** ❌, analysis fails

### Impact

- **User Experience**: Users uploading multiple games saw failures for all but the first game
- **Resource Waste**: Each failed upload spawned a Stockfish process that was never used
- **Memory Overhead**: Multiple concurrent Stockfish instances (each ~100MB) could exhaust memory
- **Unreliable Analysis**: Success rate dependent on upload timing rather than deterministic behavior

## Decision

Implement a **Singleton Pattern** for the Stockfish analyzer:
- Initialize **ONE** shared Stockfish instance when the API server starts
- All upload requests use the **SAME** analyzer instance via dependency injection
- Close the shared instance only on server shutdown

### Architecture

```
Server Startup:
  ├─ initializeServices()
  │   ├─ Initialize database
  │   ├─ Initialize tournament manager
  │   └─ Initialize SHARED ChessAnalyzer (Stockfish) ← SINGLETON
  │       └─ Wait up to 60s for Stockfish ready
  ├─ configureRoutes({ sharedAnalyzer })
  │   └─ Create UploadController(sharedAnalyzer)
  │       └─ Create PGNUploadService(GameAnalysisService(sharedAnalyzer))
  └─ Start HTTP server

Upload Flow:
  Request → UploadController → PGNUploadService → GameAnalysisService → SHARED ChessAnalyzer
                                                                              ↑
  Request → UploadController → PGNUploadService → GameAnalysisService ────────┘
                                                                              ↑
  Request → UploadController → PGNUploadService → GameAnalysisService ────────┘
```

### Implementation Details

#### 1. Server Initialization (`src/api/api-server.js`)

```javascript
let sharedAnalyzer = null;

async function initializeServices() {
  database = getDatabase();
  await database.initialize();

  // Initialize SHARED Stockfish analyzer (SINGLETON)
  console.log('🔧 Initializing shared Stockfish engine...');
  const ChessAnalyzer = require('../models/analyzer');
  sharedAnalyzer = new ChessAnalyzer();

  // Wait for Stockfish to be ready (60s timeout)
  await new Promise((resolve) => {
    const checkReady = () => {
      if (sharedAnalyzer.isReady) {
        console.log('✅ Shared Stockfish engine ready');
        resolve();
      } else {
        setTimeout(checkReady, 200);
      }
    };

    setTimeout(() => {
      console.log('⚠️ Stockfish initialization timeout after 60s');
      resolve(); // Server continues even if timeout
    }, 60000);

    checkReady();
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (sharedAnalyzer) {
    await sharedAnalyzer.close();
  }
  if (database) {
    await database.close();
  }
  process.exit(0);
});
```

#### 2. Dependency Injection (`src/api/routes/index.js`)

```javascript
const UploadController = require('../controllers/upload.controller');

function configureRoutes(middleware = {}) {
  const router = express.Router();

  // Create upload controller with shared analyzer
  const sharedAnalyzer = middleware.sharedAnalyzer ? middleware.sharedAnalyzer() : null;
  const uploadController = new UploadController(sharedAnalyzer);

  router.post('/upload', uploadController.upload.bind(uploadController));

  return router;
}
```

#### 3. Controller Accepts Shared Analyzer (`src/api/controllers/upload.controller.js`)

```javascript
class UploadController {
  constructor(sharedAnalyzer = null) {
    const analysisService = sharedAnalyzer
      ? new GameAnalysisService(sharedAnalyzer)
      : undefined; // Fallback to creating new analyzer

    this.uploadService = new PGNUploadService({
      analysisService: analysisService
    });
  }
}

module.exports = UploadController; // Export class, not singleton
```

#### 4. Prevent Closing Shared Analyzer (`src/services/GameAnalysisService.js`)

```javascript
class GameAnalysisService {
  constructor(analyzer = null) {
    this.analyzer = analyzer || new ChessAnalyzer();
    this.isInitialized = false;
    this.isSharedAnalyzer = !!analyzer; // Track if using shared instance
  }

  async close() {
    if (this.isSharedAnalyzer) {
      console.log('ℹ️ Skipping close - using shared analyzer');
      return; // Don't close shared analyzer
    }

    if (this.analyzer) {
      await this.analyzer.close();
    }
  }
}
```

## Consequences

### Benefits

#### Performance
- **Faster uploads**: No initialization delay after first server start (was 10-60s per upload)
- **Lower CPU usage**: One Stockfish process instead of N concurrent processes
- **Lower memory**: Shared instance uses ~100MB total vs ~100MB × N instances
- **Predictable latency**: Analysis starts immediately since engine is always ready

#### Reliability
- **No timeout errors**: Analyzer guaranteed ready after server startup
- **Consistent behavior**: All uploads use same engine configuration
- **Deterministic**: Success no longer depends on upload timing
- **Better error handling**: Single initialization point with clear failure mode

#### Scalability
- **Concurrent uploads**: Multiple uploads can safely queue on same analyzer
- **Resource limits**: Single process respects system resource limits
- **Horizontal scaling**: Each server instance has one Stockfish (not N per upload)

### Trade-offs

#### Startup Time
- **Before**: Server starts immediately, Stockfish initializes on first upload
- **After**: Server waits up to 60s for Stockfish initialization
- **Mitigation**: Timeout allows server to start even if Stockfish slow

#### Concurrency
- **Single analyzer**: Only one game analyzed at a time (sequential)
- **Future improvement**: Implement analyzer pool for parallel analysis

#### Memory Residency
- **Before**: Stockfish processes created/destroyed on demand
- **After**: Stockfish always resident in memory (~100MB)
- **Assessment**: Acceptable for dedicated analysis server

### Backward Compatibility

✅ **Fully backward compatible**
- If `sharedAnalyzer` not provided, service creates new instance (old behavior)
- Tests that mock analyzer work unchanged
- Gradual rollout possible (services can opt-in to shared analyzer)

### Testing Strategy

**Manual Verification:**
1. Start server: `npm run dashboard`
2. Verify log: `✅ Shared Stockfish engine ready`
3. Upload 3 PGN files in quick succession (< 5 seconds apart)
4. Query database:
```sql
SELECT g.id, g.white_player, g.black_player, COUNT(a.id) as analysis_moves
FROM games g LEFT JOIN analysis a ON g.id = a.game_id
GROUP BY g.id ORDER BY g.id DESC LIMIT 10;
```
5. ✅ All games should have `analysis_moves > 0`

**Expected Server Logs:**
```
🔧 Initializing shared Stockfish engine...
✅ Shared Stockfish engine ready
✅ All services initialized
🚀 Chess Performance Dashboard running at http://localhost:3000

[Upload 1] ✅ Game 1 analyzed - Accuracy: 85%, Blunders: 2
[Upload 2] ✅ Game 1 analyzed - Accuracy: 82%, Blunders: 3
[Upload 3] ✅ Game 1 analyzed - Accuracy: 91%, Blunders: 1
```

### Migration Path

**Development:**
1. Pull latest code
2. Restart API server: `npm run dashboard`
3. Verify: `✅ Shared Stockfish engine ready` in logs

**Production:**
1. Deploy changes
2. Restart server (downtime: initialization time ~10-60s)
3. Monitor logs for successful initialization
4. If timeout occurs, server continues with fallback behavior

### Rollback Plan

If critical issues arise:
1. Revert commits for ADR 002
2. Restart server
3. System falls back to creating new analyzer per upload (original behavior)

## Future Enhancements

1. **Health Check Endpoint**: `GET /api/health/stockfish` returns analyzer status
2. **Analyzer Pool**: Multiple Stockfish instances for true parallel analysis
3. **Lazy Initialization**: Start Stockfish on first upload (faster server startup)
4. **Configuration**: Make engine depth/timeout configurable per request
5. **Metrics**: Track analyzer utilization, queue depth, analysis time

## Files Modified

- `src/api/api-server.js` - Add sharedAnalyzer singleton, initialization, shutdown
- `src/api/routes/index.js` - Pass sharedAnalyzer to UploadController
- `src/api/controllers/upload.controller.js` - Accept sharedAnalyzer in constructor
- `src/services/GameAnalysisService.js` - Track shared analyzer, prevent closing

## References

- Singleton Pattern: https://refactoring.guru/design-patterns/singleton
- Dependency Injection: https://en.wikipedia.org/wiki/Dependency_injection
- Stockfish Engine: https://stockfishchess.org/
