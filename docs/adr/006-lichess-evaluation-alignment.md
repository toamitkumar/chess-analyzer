# ADR 006: Lichess Evaluation Alignment

**Status:** Proposed
**Date:** 2026-01-12
**Decision Makers:** Development Team
**Related Issue:** Lichess Evaluation Matching

## Context

Comparison between our chess analysis engine and Lichess reveals significant discrepancies in position evaluations and move classifications. Using the Eric Rosen vs Alireza game (Game ID: 84, Lichess: ErSfVbRk) as a reference, we identified systematic differences that affect user trust and analysis quality.

### Reference Game Analysis

**Game 1 - Eric Rosen Lost (ErSfVbRk):**
- White: EricRosen (2724) vs Black: alireza2003 (3298)
- Result: 0-1 (Black wins by checkmate)
- Lichess URL: https://lichess.org/ErSfVbRk

**Game 2 - Eric Rosen Won (KxLtTGUG):**
- White: EricRosen (2724) vs Black: alireza2003 (3298)
- Result: 1-0 (White wins by checkmate)
- Lichess URL: https://lichess.org/KxLtTGUG
- Opening: Englund Gambit (1...e5?? blunder)

**Game 3 - Eric Rosen Draw (wmc9QOP2):**
- White: EricRosen (2828) vs Black: alireza2003 (3107)
- Result: 1/2-1/2 (Draw by repetition)
- Lichess URL: https://lichess.org/wmc9QOP2
- Opening: Sicilian Defense: Closed

**Game 4 - Advait Black Lost (5Aa4ie3y):**
- White: heyitsme2024 (2019) vs Black: AdvaitKumar1213 (1819)
- Result: 1-0 (Black resigns)
- Lichess URL: https://lichess.org/5Aa4ie3y
- Opening: Caro-Kann Defense: Advance Variation

### Evaluation Comparison - Game 1 (Selected Critical Moves)

| Move# | Move | Lichess Eval | Our Eval | Lichess Class | Our Class |
|-------|------|--------------|----------|---------------|-----------|
| 6 | a3 | -0.91 | -0.98 | Mistake | Blunder |
| 7 | e5 | +0.26 | -0.33 | Mistake | Mistake |
| 12 | Qe2 | -1.57 | -0.87 | Inaccuracy | Good |
| 15 | Qe3 | -1.89 | -1.41 | Inaccuracy | Inaccuracy |
| 18 | h6 | -1.11 | +0.84 | Inaccuracy | Good |
| 19 | Ne2 | -2.24 | -1.16 | Inaccuracy | Good |
| 20 | c3 | -3.00 | -1.81 | Mistake | Inaccuracy |
| 21 | Nh4 | -5.95 | -2.37 | Mistake | Good |
| 26 | Qg5 | -7.36 | -3.91 | Mistake | Mistake |
| 30 | Nh6+ | -7.28 | -3.55 | Mistake | Inaccuracy |

### Evaluation Comparison - Game 2 (Englund Gambit)

| Move# | Move | Lichess Eval | Our Eval | Lichess Class | Our Class |
|-------|------|--------------|----------|---------------|-----------|
| 2 | e5 | +1.74 | -1.38 | **Blunder** | Mistake |
| 4 | Qe7 | +2.48 | -1.92 | Inaccuracy | Inaccuracy |
| 5 | Nf3 | +1.51 | +1.32 | Inaccuracy | Inaccuracy |
| 10 | Qxb2 | +2.27 | -1.92 | **Inaccuracy** | Best |
| 14 | Qxc3 | +2.64 | -2.51 | **Inaccuracy** | Good |
| 18 | Nxe5 | +4.18 | -2.69 | **Inaccuracy** | Best |
| 26 | Ne7 | +6.68 | -4.27 | Inaccuracy | Inaccuracy |
| 39 | Qxb7 | +8.96 | +3.54 | - | **Mistake** |
| 42 | Rab8 | +10.87 | -6.93 | - | **Mistake** |

### Evaluation Comparison - Game 3 (Sicilian Defense - Draw)

| Move# | Move | Lichess Eval | Our Eval | Lichess Class | Our Class |
|-------|------|--------------|----------|---------------|-----------|
| 16 | Na5 | +0.43 | -0.61 | Inaccuracy | **Mistake** |
| 32 | Ne3 | +2.14 | -2.22 | Mistake | **Blunder** |
| 33 | Ng5 | +2.13 | +2.51 | - | **Blunder** (false positive) |
| 39 | Rf2 | +1.28 | +1.18 | Inaccuracy | **Mistake** |
| 42 | Kg8 | +4.08 | -3.38 | Blunder | Blunder |
| 45 | g4 | +1.28 | +1.22 | Inaccuracy | Inaccuracy |
| 52 | Rg5 | +1.06 | -1.19 | Inaccuracy | **Mistake** |
| 58 | Qg4 | +1.36 | -1.56 | Mistake | **Blunder** |
| 64 | Kf7 | +1.95 | -1.37 | Blunder | **Mistake** (under-classified) |
| 80 | Rg1 | +7.21 | -7.68 | Blunder | Blunder |
| 93 | h5 | +3.35 | +2.10 | Inaccuracy | **Blunder** (over-classified) |
| 97 | h6 | +0.00 | 0.00 | Blunder | Blunder |

**Key Findings from Game 3:**

1. **Sign Inversion Pattern Continues** - Move 32 (Ne3): Lichess +2.14, Our app -2.22
2. **Over-Classification** - Move 33 (Ng5) marked as blunder by us but not flagged by Lichess
3. **Under-Classification** - Move 64 (Kf7) is a Lichess blunder but we only mark it as mistake
4. **Endgame Accuracy** - Final moves (97+) correctly identify draw position (0.00)

### Evaluation Comparison - Game 4 (Caro-Kann - Advait Lost)

| Move# | Move | Lichess Eval | Our Eval | Lichess Class | Our Class |
|-------|------|--------------|----------|---------------|-----------|
| 14 | Bg6 | +1.73 | -1.72 | Mistake | Mistake |
| 16 | Qxd5 | +2.00 | -1.99 | - | **Blunder** (false positive) |
| 17 | Bb5 | +0.38 | +0.61 | Mistake | Mistake |
| 21 | Nc3 | +0.34 | +0.13 | - | **Blunder** (false positive) |
| 26 | Kxd7 | +0.57 | -0.77 | - | **Inaccuracy** (false positive) |
| 30 | Kc6 | +2.71 | -2.42 | Blunder | Blunder |
| 44 | Kc7 | +1.51 | -1.33 | Mistake | Mistake |
| 48 | Kb6 | +5.78 | -4.41 | Blunder | Blunder |
| 56 | Ka7 | #3 (Mate) | -10000 | **Mate in 3** | **Inaccuracy** (CRITICAL BUG) |

**Critical Finding - Move 56 (Ka7 - Mate in 3):**
- Lichess correctly identifies this as leading to forced checkmate in 3
- Our app marks it as mere "inaccuracy" despite detecting mate (-10000)
- This is a classification bug - mate threats should always be blunders

**Critical Finding - Move 2 (e5 - Englund Gambit):**
- This is a well-known opening blunder giving White a significant advantage
- Lichess: +1.74 (correctly shows White advantage after Black's blunder)
- Our App: -1.38 (incorrectly shows Black advantage - **SIGN IS WRONG**)
- Lichess Classification: BLUNDER (correct)
- Our Classification: MISTAKE (under-classified)

### Problems Identified

**1. Evaluation Sign/Perspective Bug (CRITICAL)**
```
Game 2, Move 2 (e5 - Englund Gambit):
- Lichess: +1.74 (White has advantage after Black's blunder)
- Our App: -1.38 (Shows Black has advantage - WRONG!)
- This is a fundamental sign convention error

Game 2, Move 10 (Qxb2):
- Lichess: +2.27 (White still better)
- Our App: -1.92 (Shows Black better - WRONG!)
```

**2. Evaluation Magnitude Discrepancy (~50% smaller)**
```
Game 1, Move 21 (Nh4):
- Lichess: -5.95 (nearly winning for Black)
- Our App: -2.37 (slight Black advantage)
- Ratio: Our eval is ~40% of Lichess eval

Game 2, Move 26 (Ne7):
- Lichess: +6.68 (White clearly winning)
- Our App: -4.27 (Shows Black winning - SIGN + MAGNITUDE wrong)
```

**3. Sign/Perspective Inconsistencies**
```
Game 1, Move 18 (h6):
- Lichess: -1.11 (Black slightly better)
- Our App: +0.84 (White slightly better)
- Issue: Opposite evaluation signs

Game 2, Move 2 (e5):
- Lichess: +1.74 (White advantage after Black blunder)
- Our App: -1.38 (Shows Black advantage)
- Issue: Completely inverted perspective
```

**4. Classification Threshold Mismatch**
```
Game 1, Move 21 (Nh4): 106cp loss in our system
- Lichess: MISTAKE (correctly identifies significant error)
- Our App: GOOD (misses the severity)

Game 2, Move 2 (e5): 120cp loss in our system
- Lichess: BLUNDER (correctly identifies opening blunder)
- Our App: MISTAKE (under-classified)

Move 6 (a3): 174cp loss
- Lichess: MISTAKE
- Our App: BLUNDER (over-classifies)
```

**4. Missed Inaccuracies**
Our system marks as "good" several moves Lichess flags as inaccuracies:
- Move 12 (Qe2): Lichess inaccuracy, we say good
- Move 18 (h6): Lichess inaccuracy, we say good
- Move 19 (Ne2): Lichess inaccuracy, we say good

### Root Cause Analysis

**0. Engine Version (NOT the issue)**
```
Lichess Engine: Stockfish 17.1
Our Engine: Stockfish 17.1
```
Both systems use the same Stockfish version, so evaluation differences are NOT due to engine version mismatch.

**1. Analysis Depth**
```javascript
// Current: src/models/analyzer.js
const beforeEval = await this.evaluatePosition(beforeFen, 12);  // Depth 12
```
- Lichess uses depth 20+ with cloud analysis
- Depth 12 misses deeper tactical consequences
- Particularly affects complex middlegame positions

**2. Centipawn Loss Thresholds**
```javascript
// Current thresholds (implicit in classification logic)
Inaccuracy: >50cp loss
Mistake: >100cp loss  
Blunder: >200cp loss
```
Lichess uses win-probability based thresholds which are more nuanced.

**3. Evaluation Perspective Handling**
```javascript
// Current: src/models/analyzer.js line ~270
const afterFromMoverView = -afterEval;  // Negate for opponent's turn
```
The sign convention may have edge cases causing perspective flips.

**4. Multi-PV Analysis**
- Lichess analyzes multiple principal variations
- Our system primarily uses single best move
- Missing alternative line analysis affects accuracy

**5. Best Move Format Inconsistency**
```
Database stores best_move in UCI format (square coordinates):
- best_move: "f8d6" (UCI)
- Should be: "Bd6" (SAN - Standard Algebraic Notation)

Lichess displays moves in SAN format for readability.
Fix: Convert UCI to SAN in stockfish-engine.js before storing.
Re-upload games to apply fix.
```

## Decision

Implement a multi-phase alignment strategy to match Lichess evaluation standards.

### Phase 1: Increase Analysis Depth

**Current:**
```javascript
const beforeEval = await this.evaluatePosition(beforeFen, 12);
```

**Proposed:**
```javascript
// src/models/analyzer.js
const ANALYSIS_DEPTH = {
  QUICK: 12,      // For real-time preview
  STANDARD: 18,   // Default analysis
  DEEP: 22,       // Detailed analysis mode
  LICHESS: 20     // Match Lichess cloud depth
};

const beforeEval = await this.evaluatePosition(beforeFen, ANALYSIS_DEPTH.STANDARD);
```

**Rationale:**
- Depth 18-20 catches most tactical sequences
- Matches Lichess cloud analysis depth
- Acceptable performance trade-off (~2x slower)

### Phase 2: Align Classification Thresholds with Lichess

**Lichess Classification (based on win probability drop):**
```javascript
// Reference: Lichess source code analysis
// Win probability drop thresholds:
// Inaccuracy: 5-10% win probability drop
// Mistake: 10-20% win probability drop
// Blunder: >20% win probability drop
```

**Proposed Centipawn Equivalents:**
```javascript
// src/models/analyzer.js - new thresholds
const CLASSIFICATION_THRESHOLDS = {
  // Based on Lichess win-probability to centipawn mapping
  INACCURACY_MIN: 30,   // Was 50 - lowered to catch more
  MISTAKE_MIN: 80,      // Was 100 - lowered
  BLUNDER_MIN: 150,     // Was 200 - lowered
  
  // Win probability thresholds (primary method)
  WIN_PROB_INACCURACY: 5,   // 5% win prob drop
  WIN_PROB_MISTAKE: 10,     // 10% win prob drop
  WIN_PROB_BLUNDER: 20      // 20% win prob drop
};
```

### Phase 3: Fix Evaluation Perspective

**Issue:** Some evaluations show opposite signs from Lichess.

**Root Cause Analysis:**
```javascript
// Current logic in analyzer.js
const beforeFromMoverView = beforeEval;        // From mover's perspective
const afterFromMoverView = -afterEval;         // Negate for opponent's turn
```

**Proposed Fix:**
```javascript
// Ensure consistent perspective: positive = White advantage
function normalizeEvaluation(evaluation, isWhiteToMove) {
  // Stockfish returns eval from side-to-move perspective
  // Normalize to always be from White's perspective (Lichess convention)
  return isWhiteToMove ? evaluation : -evaluation;
}

// In analysis loop:
const normalizedBefore = normalizeEvaluation(beforeEval.evaluation, isWhiteMove);
const normalizedAfter = normalizeEvaluation(afterEval.evaluation, !isWhiteMove);

// Store normalized evaluation (White's perspective)
moveAnalysis.evaluation = normalizedAfter;

// Calculate centipawn loss from mover's perspective
const evalBeforeForMover = isWhiteMove ? normalizedBefore : -normalizedBefore;
const evalAfterForMover = isWhiteMove ? normalizedAfter : -normalizedAfter;
const centipawnLoss = Math.max(0, evalBeforeForMover - evalAfterForMover);
```

### Phase 4: Implement Lichess-Style Multi-PV Analysis

**Current:** Single best move analysis
**Proposed:** Multi-PV with line comparison

```javascript
// src/models/analyzer.js - new method
async evaluatePositionMultiPV(fen, depth = 18, numLines = 3) {
  return new Promise((resolve, reject) => {
    const engine = spawn('stockfish');
    
    // Enable Multi-PV
    engine.stdin.write('setoption name MultiPV value ' + numLines + '\n');
    engine.stdin.write('setoption name Threads value 1\n');
    engine.stdin.write('setoption name Hash value 128\n');
    engine.stdin.write('isready\n');
    
    // ... analysis logic
    
    // Returns array of lines:
    // [
    //   { move: 'e5', evaluation: 50, line: ['e5', 'dxe5', 'Nxe5'] },
    //   { move: 'd5', evaluation: 35, line: ['d5', 'exd5', 'cxd5'] },
    //   { move: 'c5', evaluation: 20, line: ['c5', 'dxc5', 'Qa5+'] }
    // ]
  });
}
```

### Phase 5: Calibration Against Lichess Reference Games

**Test Suite Creation:**
```javascript
// tests/fixtures/lichess-reference-games.json
// Reference PGN files with Lichess evaluations:
// - tests/fixtures/1-eric-rossen-lost.pgn (Game 84, ErSfVbRk)
// - tests/fixtures/2-eric-rossen-won.pgn (Game 85, KxLtTGUG)
// - tests/fixtures/3-eric-rossen-draw.pgn (Game 86, wmc9QOP2)
{
  "games": [
    {
      "id": "ErSfVbRk",
      "dbId": 84,
      "name": "Eric Rosen vs Alireza - Lost",
      "pgnFile": "tests/fixtures/1-eric-rossen-lost.pgn",
      "lichessEvaluations": [
        { "moveNumber": 1, "move": "d4", "eval": 0.0 },
        { "moveNumber": 2, "move": "Nf6", "eval": 0.23 },
        { "moveNumber": 6, "move": "a3", "eval": -0.91, "class": "mistake" },
        // ... all moves with Lichess evals
      ]
    },
    {
      "id": "KxLtTGUG",
      "dbId": 85,
      "name": "Eric Rosen vs Alireza - Won (Englund Gambit)",
      "pgnFile": "tests/fixtures/2-eric-rossen-won.pgn",
      "lichessEvaluations": [
        { "moveNumber": 1, "move": "d4", "eval": 0.0 },
        { "moveNumber": 2, "move": "e5", "eval": 1.74, "class": "blunder" },
        // ... all moves with Lichess evals
      ]
    },
    {
      "id": "wmc9QOP2",
      "dbId": 86,
      "name": "Eric Rosen vs Alireza - Draw (Sicilian)",
      "pgnFile": "tests/fixtures/3-eric-rossen-draw.pgn",
      "lichessEvaluations": [
        { "moveNumber": 1, "move": "e4", "eval": 0.15 },
        { "moveNumber": 16, "move": "Na5", "eval": 0.43, "class": "inaccuracy" },
        { "moveNumber": 32, "move": "Ne3", "eval": 2.14, "class": "mistake" },
        // ... all moves with Lichess evals
      ]
    },
    {
      "id": "5Aa4ie3y",
      "dbId": 87,
      "name": "Advait vs heyitsme2024 - Lost (Caro-Kann)",
      "pgnFile": "tests/fixtures/4-advait-black-lost.pgn",
      "lichessEvaluations": [
        { "moveNumber": 1, "move": "e4", "eval": 0.18 },
        { "moveNumber": 14, "move": "Bg6", "eval": 1.73, "class": "mistake" },
        { "moveNumber": 30, "move": "Kc6", "eval": 2.71, "class": "blunder" },
        { "moveNumber": 56, "move": "Ka7", "eval": "#3", "class": "mate_in_3" },
        // ... all moves with Lichess evals
      ]
    }
  ]
}
```

**Calibration Test:**
```javascript
// tests/models/lichess-alignment.test.js
describe('Lichess Evaluation Alignment', () => {
  const referenceGames = require('../fixtures/lichess-reference-games.json');
  
  test.each(referenceGames.games)('$name evaluations within tolerance', async (game) => {
    const analysis = await analyzer.analyzeGame(game.moves);
    
    for (const lichessMove of game.lichessEvaluations) {
      const ourMove = analysis.moves[lichessMove.moveNumber - 1];
      const evalDiff = Math.abs(ourMove.evaluation - lichessMove.eval * 100);
      
      // Allow 30cp tolerance (0.30 pawns)
      expect(evalDiff).toBeLessThan(30);
    }
  });
  
  test.each(referenceGames.games)('$name classifications match', async (game) => {
    const analysis = await analyzer.analyzeGame(game.moves);
    
    let matches = 0;
    for (const lichessClass of game.lichessClassifications) {
      const ourMove = analysis.moves[lichessClass.moveNumber - 1];
      if (ourMove.move_quality === lichessClass.class) {
        matches++;
      }
    }
    
    // Expect >85% classification match rate
    const matchRate = matches / game.lichessClassifications.length;
    expect(matchRate).toBeGreaterThan(0.85);
  });
});
```

## Implementation Plan

### Week 1: Core Changes
1. **Day 1-2:** Increase analysis depth to 18
   - Update `evaluatePosition()` default depth
   - Add configurable depth levels
   - Performance testing

2. **Day 3-4:** Fix evaluation perspective
   - Implement `normalizeEvaluation()` function
   - Update centipawn loss calculation
   - Add unit tests for perspective handling

3. **Day 5:** Update classification thresholds
   - Lower thresholds to match Lichess
   - Ensure win-probability based classification (ADR 005) uses correct thresholds

### Week 2: Multi-PV and Testing
1. **Day 1-2:** Implement Multi-PV analysis
   - Add `evaluatePositionMultiPV()` method
   - Update alternatives generation
   - Test with reference positions

2. **Day 3-4:** Create Lichess reference test suite
   - Extract evaluations from 5-10 reference games
   - Create calibration tests
   - Document expected tolerances

3. **Day 5:** Integration testing
   - Run full analysis on reference games
   - Compare with Lichess results
   - Fine-tune thresholds if needed

### Week 3: Migration and Validation
1. **Day 1-2:** Database migration
   - Re-analyze existing games with new settings
   - Update stored evaluations and classifications
   - Preserve original data for comparison

2. **Day 3-4:** Validation
   - Compare before/after for sample games
   - User acceptance testing
   - Performance benchmarking

3. **Day 5:** Documentation and rollout
   - Update API documentation
   - Release notes
   - Monitor for issues

## File Changes

### Architecture Refactoring (SRP Compliance)

The current `analyzer.js` is a ~1000 line God class. We'll extract responsibilities into focused modules:

```
src/models/
├── analyzer.js                    # Orchestrator only (~200 lines)
├── analysis-config.js             # NEW: Centralized configuration
├── evaluation-normalizer.js       # NEW: Perspective/sign handling
├── move-classifier.js             # NEW: Classification logic
├── stockfish-engine.js            # NEW: Engine communication
├── win-probability.js             # Existing (minor updates)
├── tactical-detector.js           # Existing (threshold updates)
└── blunder-categorizer.js         # Existing (threshold updates)
```

### New Files

1. **src/models/analysis-config.js** (~60 lines)
   - Single source of truth for all thresholds
   - Depth levels, classification thresholds, mate detection
   ```javascript
   module.exports = {
     DEPTH: { QUICK: 12, STANDARD: 18, DEEP: 22 },
     CLASSIFICATION: {
       WIN_PROB_INACCURACY: 5,
       WIN_PROB_MISTAKE: 10,
       WIN_PROB_BLUNDER: 20,
       MATE_THRESHOLD: 9000
     }
   };
   ```

2. **src/models/evaluation-normalizer.js** (~80 lines)
   - **Single Responsibility:** Convert evaluations to consistent perspective
   - Fixes the sign inversion bug
   - Pure functions, fully testable
   ```javascript
   class EvaluationNormalizer {
     // Always returns eval from White's perspective (Lichess convention)
     static toWhitePerspective(evaluation, isWhiteToMove) { }
     
     // Calculate centipawn loss from mover's perspective
     static calculateCentipawnLoss(evalBefore, evalAfter, isWhiteMove) { }
     
     // Detect mate evaluations
     static isMateEvaluation(evaluation) { }
   }
   ```

3. **src/models/move-classifier.js** (~120 lines)
   - **Single Responsibility:** Classify moves as blunder/mistake/inaccuracy/good
   - Uses config thresholds
   - Handles mate detection bug
   ```javascript
   class MoveClassifier {
     static classify(moveData, config) {
       // 1. Check for mate (always blunder)
       // 2. Check win probability drop
       // 3. Apply thresholds from config
     }
   }
   ```

4. **src/models/stockfish-engine.js** (~250 lines)
   - **Single Responsibility:** Stockfish process management
   - Extracted from analyzer.js
   - Handles spawning, communication, cleanup
   - **Fix:** Convert UCI to SAN before returning best_move
   ```javascript
   class StockfishEngine {
     async evaluatePosition(fen, depth) {
       // Returns { bestMove: 'Nf3', bestMoveUci: 'g1f3', evaluation: 25 }
     }
     async evaluateMultiPV(fen, depth, numLines) { }
     async close() { }
   }
   ```

5. **tests/fixtures/lichess-reference-games.json** (~500 lines)
   - All 4 reference games with Lichess evaluations
   - Structured for automated testing

6. **tests/models/lichess-alignment.test.js** (~200 lines)
   - Evaluation sign tests
   - Classification accuracy tests
   - Mate detection tests
   - Calibration against reference games

### Modified Files

1. **src/models/analyzer.js** (Refactored - ~300 lines, down from ~1000)
   - Now an **orchestrator only**
   - Delegates to specialized modules
   - Imports: StockfishEngine, EvaluationNormalizer, MoveClassifier, config
   ```javascript
   class ChessAnalyzer {
     constructor() {
       this.engine = new StockfishEngine();
       this.config = require('./analysis-config');
     }
     
     async analyzeGame(moves) {
       // Orchestrate: engine → normalize → classify → categorize
     }
   }
   ```

2. **src/models/win-probability.js** (~10 lines changed)
   - Import thresholds from `analysis-config.js`
   - Remove hardcoded values

3. **src/models/tactical-detector.js** (~15 lines changed)
   - Import thresholds from `analysis-config.js`
   - Remove hardcoded values

4. **src/models/blunder-categorizer.js** (~10 lines changed)
   - Import thresholds from `analysis-config.js`
   - Remove hardcoded `SEVERITY_THRESHOLDS`

### Existing Test Fixtures (Already Present)

- `tests/fixtures/1-eric-rossen-lost.pgn` (Game 84)
- `tests/fixtures/2-eric-rossen-won.pgn` (Game 85)
- `tests/fixtures/3-eric-rossen-draw.pgn` (Game 86)
- `tests/fixtures/4-advait-black-lost.pgn` (Game 87)

### Database Changes

1. **Re-analysis Required**
   - Games 84, 85, 86, 87 need re-analysis after code changes
   - Optional: Batch re-analyze all existing games

2. **No Schema Changes**
   - Existing `analysis` table schema is sufficient
   - `evaluation`, `centipawn_loss`, `move_quality` columns already exist

### Dependency Graph

```
analyzer.js (orchestrator)
    ├── analysis-config.js (shared config)
    ├── stockfish-engine.js (engine I/O, UCI→SAN conversion)
    ├── evaluation-normalizer.js (perspective handling)
    ├── move-classifier.js (classification)
    │       └── analysis-config.js
    ├── win-probability.js (accuracy calc)
    │       └── analysis-config.js
    ├── tactical-detector.js (tactical patterns)
    │       └── analysis-config.js
    └── blunder-categorizer.js (categorization)
            └── analysis-config.js
```

## Consequences

### Positive

1. **Evaluation Accuracy**
   - Match Lichess evaluations within ±0.30 pawns
   - Consistent perspective (always from White's view)
   - Better tactical detection at higher depth

2. **Classification Accuracy**
   - >85% match rate with Lichess classifications
   - Fewer false positives (over-classification)
   - Fewer false negatives (missed errors)

3. **User Trust**
   - Users can cross-reference with Lichess
   - Consistent experience across platforms
   - Professional-grade analysis quality

### Negative

1. **Performance Impact**
   - ~2x slower analysis (depth 12 → 18)
   - More memory usage for Multi-PV
   - Mitigation: Add "quick" vs "deep" analysis modes

2. **Breaking Changes**
   - Existing game evaluations will change
   - Historical accuracy scores may shift
   - Mitigation: Re-analyze games, preserve history

3. **Maintenance Burden**
   - Need to track Lichess algorithm changes
   - Calibration tests require updates
   - Mitigation: Automated comparison tools

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Evaluation Tolerance | ±30cp | Avg diff from Lichess |
| Classification Match | >85% | % matching Lichess |
| Analysis Time | <2x increase | Benchmark comparison |
| User Satisfaction | No complaints | Feedback tracking |

## Alternatives Considered

### Alternative 1: Use Lichess API for Analysis
**Pros:** Perfect match, no local computation
**Cons:** Rate limits, network dependency, privacy
**Verdict:** Rejected - need offline capability

### Alternative 2: Keep Current System
**Pros:** No work required, stable
**Cons:** Inaccurate, user complaints, trust issues
**Verdict:** Rejected - quality gap too large

### Alternative 3: Partial Alignment (Depth Only)
**Pros:** Simpler, faster implementation
**Cons:** Doesn't fix perspective issues, partial solution
**Verdict:** Rejected - need comprehensive fix

## References

1. **Lichess Analysis Source:**
   - https://github.com/lichess-org/lila/tree/master/modules/analyse
   - Lichess uses Stockfish 17.1 (same as our local engine)

2. **Stockfish Multi-PV Documentation:**
   - https://official-stockfish.github.io/docs/stockfish-wiki/UCI-&-Commands.html

3. **Reference Game:**
   - https://lichess.org/ErSfVbRk (Game 1 - Eric Rosen Lost)
   - https://lichess.org/KxLtTGUG (Game 2 - Eric Rosen Won, Englund Gambit)
   - https://lichess.org/wmc9QOP2 (Game 3 - Eric Rosen Draw, Sicilian)
   - https://lichess.org/5Aa4ie3y (Game 4 - Advait Lost, Caro-Kann)
   - Local fixtures: tests/fixtures/1-eric-rossen-lost.pgn, tests/fixtures/2-eric-rossen-won.pgn, tests/fixtures/3-eric-rossen-draw.pgn, tests/fixtures/4-advait-black-lost.pgn

4. **Related ADRs:**
   - ADR 004: Stockfish Determinism
   - ADR 005: Win-Probability Based Accuracy

## Approval

- [ ] Technical Review: _______________ Date: ___________
- [ ] Product Review: _______________ Date: ___________
- [ ] Final Approval: _______________ Date: ___________

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0 | Initial proposal | Development Team |
