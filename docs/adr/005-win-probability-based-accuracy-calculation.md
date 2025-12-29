# ADR 005: Win-Probability Based Accuracy Calculation

**Status:** Proposed
**Date:** 2025-12-29
**Decision Makers:** Development Team
**Related Issue:** #107

## Context

The chess analysis platform calculates move accuracy and game accuracy to help users understand their performance. Currently, we use a simple centipawn-loss based formula, but comparison with Chess.com and Lichess reveals significant discrepancies in accuracy percentages and move classifications.

### Current State

**Current Accuracy Calculation:**
```javascript
// src/models/analyzer.js (lines 79-100)
calculateGameAccuracy(averageCentipawnLoss) {
  const accuracy = 100 - (averageCentipawnLoss * 0.8) - Math.pow(averageCentipawnLoss / 15, 2);
  return Math.max(0, Math.min(100, Math.round(accuracy * 10) / 10));
}
```

**Current Move Classification Thresholds:**
```javascript
// src/models/analyzer.js (lines 55-77)
classifyMove(centipawnLoss, ...) {
  if (centipawnLoss <= 2) return 'best';
  if (centipawnLoss <= 10) return 'excellent';
  if (centipawnLoss <= 25) return 'good';
  if (centipawnLoss <= 50) return 'inaccuracy';  // 25-50 CP
  if (centipawnLoss <= 100) return 'mistake';    // 50-100 CP
  return 'blunder';  // >100 CP
}
```

### Problems Identified

**1. Accuracy Mismatch (Game 61 Example):**
- **Chess.com:** 87% accuracy, 0 blunders, 2 mistakes
- **Our System:** 92% accuracy, 2 blunders, 6 mistakes
- **Root Cause:** Different calculation methods

**2. Incorrect Move Classifications:**
```
Move 21 (Rb1): 101 CP loss
- Our System: MISTAKE (101 CP > 100 threshold)
- Chess.com: INACCURACY (keeps position equal)

Move 97 (Rg8): 451 CP loss
- Our System: BLUNDER (451 CP > 100 threshold)
- Chess.com: GOOD MOVE (position already lost, doesn't affect outcome)
```

**3. Missing Strategic Errors:**
```
Move 33 (Bd1): 0 CP loss
- Our System: OK (no centipawn loss)
- Chess.com: MISTAKE (poor strategic choice)
```

**4. No Position Context:**
- Current system penalizes all mistakes equally
- Doesn't distinguish between mistakes in equal vs. lost positions
- Mistakes in clearly won/lost positions shouldn't affect learning metrics

### Industry Standards

**Lichess Algorithm (Open Source):**
- Uses win-probability based accuracy (CAPS algorithm)
- Converts centipawn evaluations to win percentages
- Per-move accuracy uses exponential penalty for win% drops
- Weights moves in critical/volatile positions more heavily
- Reference: [lichess-org/lila AccuracyPercent.scala](https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala)

**Chess.com CAPS2:**
- Proprietary algorithm with similar approach
- Evaluates moves against engine's top choices
- Generates Precision Score (Accuracy) from 0-100
- Considers position context and game phase
- Only flags mistakes in contestable positions

**Lichess Per-Move Accuracy Formula:**
```scala
accuracy = 103.1668 * exp(-0.04354 * winPercentDrop) - 3.1669 + 1
// Bounded: [0, 100]
```

**Lichess Game Accuracy:**
```scala
gameAccuracy = (weightedArithmeticMean + harmonicMean) / 2
// Weights based on position volatility (0.5 to 12)
```

## Decision

**Adopt a win-probability based accuracy calculation system** modeled on Lichess's open-source implementation, with the following components:

### 1. Centipawn to Win Probability Conversion

```javascript
function cpToWinProbability(centipawns) {
  // Lichess formula: 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1);
}
```

**Why this formula:**
- Standard sigmoid function used by major platforms
- Maps -∞ to +∞ centipawns → 0% to 100% win probability
- Approximately: +100 CP ≈ 65% win chance, +300 CP ≈ 85%, +600 CP ≈ 95%

### 2. Per-Move Accuracy Calculation

```javascript
function calculateMoveAccuracy(winProbBefore, winProbAfter) {
  const winPercentDrop = Math.max(0, winProbBefore - winProbAfter);

  // Lichess exponential formula
  const raw = 103.1668 * Math.exp(-0.04354 * winPercentDrop) - 3.1669 + 1;

  return Math.max(0, Math.min(100, raw));
}
```

**Behavior:**
- 0% win drop → 100% accuracy
- 5% win drop → ~80% accuracy
- 10% win drop → ~60% accuracy
- 20% win drop → ~30% accuracy
- Exponential penalty reflects that larger mistakes are disproportionately bad

### 3. Position Context Filtering

```javascript
function shouldClassifyMove(evalBefore, evalAfter) {
  // Only classify moves when position is contestable
  const DECISIVE_THRESHOLD = 500; // ~95% win probability

  // Skip if position already clearly won/lost
  if (Math.abs(evalAfter) > DECISIVE_THRESHOLD) {
    return false;
  }

  return true;
}
```

**Rationale:**
- Matches Chess.com's approach
- Focuses learning on mistakes that affect game outcomes
- Mistakes in lost positions don't aid improvement

### 4. Game-Level Accuracy

```javascript
function calculateGameAccuracy(moveAccuracies, positionVolatilities) {
  // Weight moves in critical positions more heavily
  const weights = positionVolatilities.map(volatility =>
    Math.max(0.5, Math.min(12, volatility))
  );

  const weightedMean = weightedAverage(moveAccuracies, weights);
  const harmonicMean = harmonicMeanOf(moveAccuracies);

  // Lichess hybrid approach
  return (weightedMean + harmonicMean) / 2;
}
```

**Position Volatility:**
- Calculated as standard deviation of win% in 3-move window
- High volatility = tactical, sharp positions (weight moves more)
- Low volatility = quiet, positional play (weight moves less)

### 5. Updated Move Classification

Based on win-probability drops (not raw centipawn loss):

```javascript
function classifyMoveByWinProb(winProbDrop, moveAccuracy) {
  // Skip classification if position already decided
  if (!shouldClassifyMove(...)) {
    return 'ok';
  }

  // Based on Lichess/Chess.com standards
  if (moveAccuracy >= 95) return 'best';
  if (moveAccuracy >= 90) return 'excellent';
  if (moveAccuracy >= 80) return 'good';
  if (moveAccuracy >= 60) return 'inaccuracy';   // ~5-10% win drop
  if (moveAccuracy >= 40) return 'mistake';      // ~10-15% win drop
  return 'blunder';  // >15% win drop
}
```

## Implementation Plan

### Phase 1: Core Algorithm (Week 1)
1. Add win-probability conversion utility
2. Implement per-move accuracy calculation
3. Add position volatility calculation
4. Update game accuracy calculation
5. Comprehensive unit tests

### Phase 2: Position Context (Week 2)
1. Add position context filtering
2. Skip classifications in decided positions
3. Update move classification logic
4. Integration tests with real game data

### Phase 3: Migration & Calibration (Week 3)
1. Add database columns for new metrics:
   - `win_prob_before`, `win_prob_after` in analysis table
   - `move_accuracy` in analysis table
   - `position_volatility` in analysis table
2. Create migration to backfill existing games
3. Calibrate against Chess.com/Lichess reference games
4. Update API responses

### Phase 4: UI Updates (Week 4)
1. Update frontend to display new accuracy scores
2. Add win-probability graphs
3. Show move accuracy in move list
4. Update game detail analysis views

## Consequences

### Positive

1. **Accuracy Alignment:**
   - Match Chess.com and Lichess accuracy percentages (±2%)
   - Consistent move classifications with industry standards
   - Better user trust in analysis quality

2. **Better Learning Focus:**
   - Only flag mistakes that matter for game outcomes
   - Ignore errors in already-lost positions
   - Help users focus on critical decision points

3. **More Sophisticated Analysis:**
   - Win-probability provides intuitive metric
   - Position context awareness
   - Weighted by move criticality

4. **Industry Standard:**
   - Lichess algorithm is proven and open-source
   - Well-documented and tested
   - Community-validated approach

5. **Better Accuracy for Different Playing Styles:**
   - Positional players: fewer penalties for long-term plans
   - Tactical players: appropriate credit for sharp play
   - Endgame accuracy: proper handling of small advantages

### Negative

1. **Breaking Change:**
   - Existing accuracy scores will change
   - Historical comparisons will show discrepancies
   - Need to re-analyze or migrate existing games

2. **Increased Complexity:**
   - More complex algorithm to maintain
   - Harder to debug accuracy issues
   - Need to understand win-probability mathematics

3. **Performance Impact:**
   - Additional calculations per move
   - Need to store more data (win probabilities)
   - Slightly slower analysis processing

4. **Database Migration:**
   - Need to backfill ~10,000+ games
   - Migration could take hours
   - Risk of data inconsistency during migration

5. **Testing Complexity:**
   - Need reference data from Lichess/Chess.com
   - Harder to write deterministic tests
   - Calibration requires manual validation

### Mitigation Strategies

**For Breaking Changes:**
- Add feature flag to toggle between old/new algorithm
- Show both accuracy scores during transition period
- Clear communication to users about improvements

**For Performance:**
- Cache win-probability calculations
- Batch process migrations
- Optimize volatility calculations

**For Testing:**
- Create comprehensive test suite with known games
- Use Lichess API to validate accuracy calculations
- Maintain reference game database

## Alternatives Considered

### Alternative 1: Keep Simple Centipawn Formula
**Pros:** Simple, no migration needed
**Cons:** Inaccurate, doesn't match industry standards, misleading to users
**Verdict:** Rejected - accuracy discrepancies too large

### Alternative 2: Hybrid Approach (Simple + Context)
**Pros:** Easier to implement, some improvements
**Cons:** Still not industry-standard, partial solution
**Verdict:** Rejected - doesn't solve core problem

### Alternative 3: Use Chess.com API
**Pros:** Perfect accuracy match with Chess.com
**Cons:** API costs, rate limits, vendor lock-in, not all games on Chess.com
**Verdict:** Rejected - not sustainable for all users

### Alternative 4: Lichess Cloud Analysis
**Pros:** Matches Lichess exactly, no local computation
**Cons:** Network dependency, rate limits, privacy concerns
**Verdict:** Rejected - prefer local analysis for privacy

## References

1. **Lichess AccuracyPercent.scala:**
   https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala

2. **Lichess WinPercent.scala:**
   https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/WinPercent.scala

3. **Chess.com CAPS2 Overview:**
   https://www.chess.com/article/view/what-is-caps-accuracy-in-game-review

4. **Win Probability in Chess (Research):**
   - Stockfish evaluation to win% conversion
   - Standard sigmoid formula used across platforms

5. **Game Analysis Comparison (Game 61):**
   - Chess.com: 87% accuracy, 0 blunders, 2 mistakes
   - Lichess: Similar results with win-probability method
   - Our system (old): 92% accuracy, 2 blunders (incorrect)

## Success Metrics

**Accuracy Alignment:**
- Game accuracy within ±2% of Chess.com/Lichess for test suite
- Move classifications match >90% of the time
- Zero complaints about "obviously wrong" accuracy scores

**Performance:**
- Analysis time increase <10%
- Migration completes in <4 hours
- No user-visible performance degradation

**User Satisfaction:**
- Positive feedback on accuracy improvements
- Reduced confusion about accuracy differences
- Increased trust in analysis quality

## Rollout Plan

1. **Development (2 weeks):** Implement core algorithm with tests
2. **Beta Testing (1 week):** Test with select users, gather feedback
3. **Migration (1 day):** Backfill existing games overnight
4. **Launch (Day 1):** Enable for all users with announcement
5. **Monitoring (2 weeks):** Track accuracy, performance, user feedback
6. **Deprecation (Month 2):** Remove old algorithm, clean up feature flags

## Approval

- [ ] Technical Review: _______________ Date: ___________
- [ ] Product Review: _______________ Date: ___________
- [ ] Security Review: _______________ Date: ___________
- [ ] Final Approval: _______________ Date: ___________

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-12-29 | 1.0 | Initial proposal | Development Team |
