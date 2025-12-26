# ADR 004: Stockfish Determinism and Analysis Queue

## Status
Accepted

## Date
2025-12-27

## Context

During implementation of multi-user support (Issue #99), we discovered that identical PGN files uploaded by different users were producing different analysis results. This non-determinism manifested as:

- Different centipawn loss values (106 vs 125 for identical positions)
- Different blunder counts (3 vs 4 blunders)
- Different accuracy percentages (96% vs 98%)
- ALL move evaluations were different (not just blunders)

Despite identical PGN content (verified by SHA-256 hash), the Stockfish analysis was non-deterministic.

### Investigation

Multiple fixes were attempted:

1. **Threads=1 Configuration** (Commit 5db6fca)
   - Set Stockfish to single-threaded mode
   - Set fixed hash table size (128MB)
   - **Result**: Still non-deterministic

2. **ucinewgame Command** (Commit f864e1c)
   - Send `ucinewgame` before each game to reset engine state
   - Wait for `readyok` confirmation
   - **Result**: Still non-deterministic

3. **Explicit Hash Clearing** (Commit 96fa257)
   - Added `setoption name Clear Hash` command
   - **Result**: Still non-deterministic

4. **Analysis Queue** (Commit 8974a61)
   - Initially thought concurrent access was the issue
   - Added queue to serialize analyses
   - **Result**: Helped, but not sufficient

5. **Complete Engine Restart** (Commit 89a8a38)
   - Kill and respawn Stockfish process before each game
   - **Result**: ✅ **100% DETERMINISTIC**

### Root Cause

Testing with a standalone Stockfish script revealed that Stockfish IS deterministic when used correctly (identical evaluations: -46 cp for both runs).

The problem was **internal Stockfish state contamination** across games, including:
- Hash table entries (despite Clear Hash command)
- NNUE evaluation cache
- Pawn structure cache
- Transposition table pollution
- Event handler accumulation in Node.js

The only way to guarantee a completely clean state was to **restart the entire Stockfish process**.

## Decision

We will implement a **two-layer approach** to ensure deterministic analysis:

### 1. Complete Engine Restart per Game

```javascript
// In ChessAnalyzer._analyzeGameInternal()
// Close existing engine
if (this.engine) {
  this.engine.removeAllListeners();
  this.engine.kill();
}

// Restart engine with deterministic settings
this.setupEngine();
```

**Trade-offs**:
- ✅ **Guaranteed clean state**
- ✅ **100% deterministic results**
- ❌ **Slower** (~100-200ms overhead per game)
- ✅ **Worth it** for correctness

### 2. Analysis Queue for Serial Processing

```javascript
class ChessAnalyzer {
  constructor() {
    this.analysisQueue = [];
    this.isAnalyzing = false;
  }

  async analyzeGame(moves, fetchAlternatives) {
    return new Promise((resolve, reject) => {
      this.analysisQueue.push({ moves, fetchAlternatives, resolve, reject });
      if (!this.isAnalyzing) {
        this._processQueue();
      }
    });
  }
}
```

**Benefits**:
- ✅ **Prevents concurrent access** to shared Stockfish instance
- ✅ **Protects against race conditions**
- ✅ **Works with engine restart**
- ❌ **Sequential processing** (slower for batch uploads)
- ✅ **Acceptable** for typical use (1-2 games at a time)

## Consequences

### Positive

1. **Guaranteed Determinism**
   - Identical PGNs produce identical results (verified with 63/63 moves matching)
   - No more user complaints about inconsistent analysis
   - Reliable for tournament comparisons

2. **Multi-User Safety**
   - Users can't interfere with each other's analyses
   - No data leakage between concurrent requests
   - Clean separation of concerns

3. **Test Coverage**
   - 28 new tests protect against regressions
   - Determinism tests verify identical results
   - BlunderService tests verify user separation

### Negative

1. **Performance Impact**
   - Engine restart adds ~100-200ms per game
   - Sequential processing prevents parallel analysis
   - **Mitigation**: Acceptable for typical workload (1-10 games)

2. **Memory Usage**
   - Each engine restart creates new process
   - Temporary memory spike during transition
   - **Mitigation**: Processes are short-lived

3. **Complexity**
   - Queue mechanism adds code complexity
   - Engine lifecycle management is more involved
   - **Mitigation**: Well-tested and documented

### Risks

1. **Stockfish Process Leaks**
   - If engine.kill() fails, orphaned processes
   - **Mitigation**: Comprehensive event handler cleanup

2. **Queue Deadlock**
   - If _processQueue() throws, queue might stall
   - **Mitigation**: try-catch with queue continuation

3. **Test Flakiness**
   - Determinism tests require real Stockfish (slow)
   - **Mitigation**: Proper timeouts and cleanup

## Testing Strategy

### Unit Tests (Fast - Run Pre-Commit)

1. **BlunderService** (17 tests)
   - Verifies player_color filtering
   - Tests user separation
   - Validates access control

2. **DashboardService** (2 tests)
   - Verifies BlunderService integration
   - Tests user_id filtering

### Integration Tests (Slow - Run Pre-Push)

3. **Analyzer Determinism** (9 tests)
   - Verifies identical results for same moves
   - Tests queue mechanism
   - Validates engine restart logic
   - **Requires**: Real Stockfish (60-180s)

### Test Execution

```bash
# Pre-commit: Fast unit tests
npm test -- tests/services/

# Pre-push: Full suite including integration
npm test

# CI/CD: With coverage
npm run test:coverage
```

## Alternatives Considered

### Alternative 1: Use Multiple Stockfish Instances

**Approach**: Create a pool of Stockfish engines, assign one per analysis

**Pros**:
- True parallel analysis
- No queueing delay

**Cons**:
- High memory usage (N engines × 128MB hash each)
- Complex pool management
- Still need engine restart for determinism

**Decision**: Rejected - Complexity and memory cost too high

### Alternative 2: Use Docker Containers for Isolation

**Approach**: Run each analysis in isolated Docker container

**Pros**:
- Perfect isolation
- Resource limits

**Cons**:
- Container startup overhead (seconds, not milliseconds)
- Requires Docker infrastructure
- Platform dependency

**Decision**: Rejected - Too slow and complex

### Alternative 3: Accept Non-Determinism

**Approach**: Document that analysis has small variance, use averages

**Pros**:
- Simpler code
- Faster execution

**Cons**:
- Users can't compare results reliably
- Undermines trust in analysis
- Tournament comparisons meaningless

**Decision**: Rejected - Correctness > Performance

## Implementation

### Files Changed

1. `src/models/analyzer.js`
   - Added analysisQueue and _processQueue()
   - Renamed analyzeGame() → _analyzeGameInternal()
   - Added queue-based wrapper
   - Added complete engine restart logic

2. `src/services/BlunderService.js` (NEW)
   - Centralized blunder business logic
   - Consistent player_color filtering

3. `src/services/DashboardService.js`
   - Updated to use BlunderService
   - Ensures user_id filtering

### Tests Created

1. `tests/services/BlunderService.test.js` (17 tests)
2. `tests/services/DashboardService.test.js` (2 tests)
3. `tests/models/analyzer-determinism.test.js` (9 tests)

## Verification

### Before Fix
```
Game 38 (user1): CP loss = 106, 4 blunders
Game 40 (user2): CP loss = 125, 3 blunders
Move 13 eval: -75 vs -53 (22cp difference)
```

### After Fix
```
Game 50 (user1): CP loss = 56.5, 1 blunder
Game 52 (user2): CP loss = 56.5, 1 blunder
Move 13 eval: Identical (63/63 moves match)
```

## Future Considerations

1. **Performance Optimization**
   - If workload increases, consider engine pool
   - Monitor queue length metrics
   - Add priority queue for paid users

2. **Caching Strategy**
   - Cache analysis results by PGN content hash
   - Check cache before queuing analysis
   - Invalidate on Stockfish version upgrade

3. **Progress Reporting**
   - Add WebSocket to report queue position
   - Show "Analysis in progress" with estimated time

4. **Distributed Analysis**
   - If scaling needed, move to worker queues (Bull/BullMQ)
   - Separate analysis service from web server

## References

- Issue #99: Complete User ID Separation
- Stockfish UCI Protocol: https://backscattering.de/chess/uci/
- Determinism Test Results: See test output logs
- Commit History: See "PROTECTION AGAINST REGRESSIONS" section

## Approval

- **Author**: Claude Sonnet 4.5 (via Claude Code)
- **Reviewer**: Amit Kumar (toamitkumar)
- **Date**: 2025-12-27
- **Status**: Implemented and Tested
