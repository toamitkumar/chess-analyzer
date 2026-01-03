/**
 * Win-Probability Utility
 * ADR 005: Win-probability based accuracy calculation
 *
 * Implements Lichess's algorithm for converting centipawn evaluations
 * to win probabilities and calculating move/game accuracy.
 *
 * References:
 * - https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/WinPercent.scala
 * - https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala
 */

class WinProbability {
  /**
   * Convert centipawn evaluation to win probability
   * Uses standard sigmoid function matching Lichess/Chess.com
   *
   * Formula: 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
   *
   * @param {number} centipawns - Engine evaluation in centipawns
   * @returns {number} Win probability percentage (0-100)
   *
   * @example
   * cpToWinProbability(0)    // => 50.0  (equal position)
   * cpToWinProbability(100)  // => ~64.5 (slight advantage)
   * cpToWinProbability(300)  // => ~84.6 (clear advantage)
   * cpToWinProbability(600)  // => ~95.6 (winning)
   */
  static cpToWinProbability(centipawns) {
    // Lichess formula: 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
    // This returns percentages (0-100)
    const result = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1);
    return Math.max(0, Math.min(100, result));
  }

  /**
   * Calculate per-move accuracy based on win probability drop
   * Uses EXACT Lichess CAPS formula (Computer Aggregated Precision Score)
   *
   * Formula: raw = 103.167 * exp(-0.04354 * winDiff) - 3.167
   *          accuracy = (raw + 1).clamp(0, 100)
   *
   * @param {number} winProbBefore - Win% before the move (0-100)
   * @param {number} winProbAfter - Win% after the move (0-100)
   * @returns {number} Move accuracy percentage (0-100)
   *
   * @example
   * calculateMoveAccuracy(65, 65)  // => 100 (no win% drop)
   * calculateMoveAccuracy(65, 60)  // => ~80  (5% drop)
   * calculateMoveAccuracy(65, 55)  // => ~60  (10% drop)
   * calculateMoveAccuracy(65, 45)  // => ~30  (20% drop)
   */
  static calculateMoveAccuracy(winProbBefore, winProbAfter) {
    // If position improved or stayed same, perfect accuracy
    if (winProbAfter >= winProbBefore) {
      return 100;
    }

    // Calculate win percentage drop
    const winDiff = winProbBefore - winProbAfter;

    // Exact Lichess formula
    const raw = 103.167 * Math.exp(-0.04354 * winDiff) - 3.167;
    const accuracy = raw + 1;

    // Clamp to [0, 100]
    return Math.max(0, Math.min(100, accuracy));
  }

  /**
   * Calculate position volatility (standard deviation of win probabilities)
   * Used to weight moves in critical positions more heavily
   *
   * @param {number[]} winProbabilities - Array of win% values in window
   * @returns {number} Volatility score (0.5 to 12)
   *
   * @example
   * calculatePositionVolatility([50, 51, 50, 49])  // => ~0.7  (stable)
   * calculatePositionVolatility([50, 65, 45, 70])  // => ~10.2 (tactical)
   */
  static calculatePositionVolatility(winProbabilities) {
    if (!winProbabilities || winProbabilities.length === 0) {
      return 0.5; // Minimum volatility
    }

    if (winProbabilities.length === 1) {
      return 0.5; // Cannot calculate std dev of single value
    }

    // Calculate mean
    const mean = winProbabilities.reduce((sum, val) => sum + val, 0) / winProbabilities.length;

    // Calculate variance
    const variance = winProbabilities.reduce((sum, val) => {
      const diff = val - mean;
      return sum + diff * diff;
    }, 0) / winProbabilities.length;

    // Standard deviation
    const stdDev = Math.sqrt(variance);

    // Clamp to Lichess range [0.5, 12]
    return Math.max(0.5, Math.min(12, stdDev));
  }

  /**
   * Calculate overall game accuracy using hybrid mean
   * Combines weighted arithmetic mean and harmonic mean (Lichess algorithm)
   *
   * @param {number[]} moveAccuracies - Array of move accuracy scores
   * @param {number[]} volatilities - Array of position volatilities (same length)
   * @returns {number} Overall game accuracy (0-100)
   *
   * @example
   * calculateGameAccuracy([90, 85, 95], [1, 5, 2])  // => ~88.4
   */
  static calculateGameAccuracy(moveAccuracies, volatilities) {
    if (!moveAccuracies || moveAccuracies.length === 0) {
      return 0;
    }

    // Ensure volatilities array matches length
    const weights = volatilities && volatilities.length === moveAccuracies.length
      ? volatilities.map(v => Math.max(0.5, Math.min(12, v || 0.5)))
      : moveAccuracies.map(() => 0.5);

    // Clamp move accuracies to valid range
    const clampedAccuracies = moveAccuracies.map(acc => Math.max(0, Math.min(100, acc)));

    // Calculate weighted arithmetic mean
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const weightedSum = clampedAccuracies.reduce((sum, acc, i) => sum + acc * weights[i], 0);
    const weightedMean = weightedSum / totalWeight;

    // Calculate harmonic mean
    const harmonicSum = clampedAccuracies.reduce((sum, acc) => {
      // Avoid division by zero
      return sum + (acc > 0 ? 1 / acc : 0);
    }, 0);
    const harmonicMean = harmonicSum > 0 ? clampedAccuracies.length / harmonicSum : 0;

    // Lichess hybrid: (weighted + harmonic) / 2
    const result = (weightedMean + harmonicMean) / 2;

    // Clamp final result
    return Math.max(0, Math.min(100, result));
  }

  /**
   * Determine if move should be classified
   * Uses two-tier approach:
   * 1. Classify all moves in contestable positions (±800 CP)
   * 2. Classify significant mistakes even in decided positions
   *
   * @param {number} evalBefore - Evaluation before move (centipawns)
   * @param {number} evalAfter - Evaluation after move (centipawns)
   * @param {number} cpLoss - Centipawn loss of the move (optional)
   * @returns {boolean} True if move should be classified
   *
   * @example
   * shouldClassifyMove(0, 150)        // => true  (contestable)
   * shouldClassifyMove(100, 600)      // => true  (contestable, raised threshold)
   * shouldClassifyMove(200, 900, 10)  // => false (decided, small mistake)
   * shouldClassifyMove(200, 900, 100) // => true  (decided, but significant mistake)
   */
  static shouldClassifyMove(evalBefore, evalAfter, cpLoss = 0) {
    const CONTESTABLE_THRESHOLD = 800; // ~97% win probability
    const SIGNIFICANT_MISTAKE_THRESHOLD = 50; // CP loss to count in decided positions

    // Tier 1: Classify all moves in contestable positions
    if (Math.abs(evalAfter) <= CONTESTABLE_THRESHOLD) {
      return true;
    }

    // Tier 2: In decided positions, only classify significant mistakes
    // This catches moves like Game 60 Move 41 (-724 CP, 306 CP loss)
    return cpLoss >= SIGNIFICANT_MISTAKE_THRESHOLD;
  }
}

module.exports = WinProbability;
