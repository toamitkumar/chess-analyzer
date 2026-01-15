/**
 * Analysis Configuration
 * ADR 006: Lichess Evaluation Alignment - Phase 4
 *
 * Centralized configuration for all analysis thresholds.
 * Single source of truth to ensure consistency across modules.
 */

const AnalysisConfig = {
  /**
   * Stockfish engine settings
   */
  ENGINE: {
    HASH_MB: 512,       // Hash table size in MB (was 128, increased for better eval)
    THREADS: 1,         // Number of threads (1 for determinism)
  },

  /**
   * Analysis depth levels (legacy - use NODES for Lichess compatibility)
   */
  DEPTH: {
    QUICK: 12,      // For real-time preview
    STANDARD: 12,   // Default analysis (current)
    DEEP: 18,       // Detailed analysis mode
    LICHESS: 20     // Match Lichess cloud depth
  },

  /**
   * Nodes-based analysis (Lichess-compatible)
   * Source: lila/modules/fishnet/src/main/Work.scala
   * 
   * Lichess uses nodes instead of depth for consistent analysis quality.
   * Nodes provide more predictable evaluation regardless of position complexity.
   */
  NODES: {
    QUICK: 150000,      // 150K - Fast preview (~autoTutor)
    STANDARD: 300000,   // 300K - Default analysis (~autoHunter) - best speed/accuracy trade-off
    DEEP: 1000000,      // 1M - Detailed analysis (~manualRequest)
  },

  /**
   * Analysis mode toggle
   * Set to true to use nodes-based analysis (recommended for Lichess alignment)
   */
  USE_NODES: true,

  /**
   * Win probability drop thresholds for move classification
   * Based on Lichess source code:
   * - scalachess/core/src/main/scala/eval.scala (WinPercent.winningChances)
   * - lila/modules/tree/src/main/Advice.scala (winningChanceJudgements)
   *
   * CRITICAL: Lichess uses [-1, +1] scale for winningChances delta!
   * - Inaccuracy: 0.1 on [-1,+1] = 5% on [0,100] scale
   * - Mistake: 0.2 on [-1,+1] = 10% on [0,100] scale
   * - Blunder: 0.3 on [-1,+1] = 15% on [0,100] scale
   *
   * Conversion: lichess_threshold / 2 * 100 = our_threshold
   * Example: 0.3 / 2 * 100 = 15%
   */
  CLASSIFICATION: {
    // Win probability drop thresholds (percentage points on 0-100 scale)
    // 
    // Lichess thresholds (ADR 006):
    // Source: lila/modules/tree/src/main/Advice.scala
    // - Inaccuracy: 0.1 on [-1,+1] = 5% on [0,100]
    // - Mistake: 0.2 on [-1,+1] = 10% on [0,100]
    // - Blunder: 0.3 on [-1,+1] = 15% on [0,100]
    WIN_PROB_INACCURACY: 5,   // 0.1 on [-1,+1]
    WIN_PROB_MISTAKE: 10,     // 0.2 on [-1,+1]
    WIN_PROB_BLUNDER: 15,     // 0.3 on [-1,+1]

    // Centipawn loss thresholds (fallback/validation)
    CP_INACCURACY: 50,        // 50cp loss
    CP_MISTAKE: 100,          // 100cp loss
    CP_BLUNDER: 200,          // 200cp loss

    // Mate detection threshold
    // Any evaluation >= this is considered a forced mate
    MATE_THRESHOLD: 9000,     // ±9000cp = mate detected

    // Position contestability threshold
    // Moves in positions beyond this are only classified if significant
    CONTESTABLE_THRESHOLD: 800,  // ~97% win probability

    // Minimum CP loss to classify in decided positions
    SIGNIFICANT_MISTAKE_THRESHOLD: 50
  },

  /**
   * Blunder severity thresholds (for categorization)
   */
  SEVERITY: {
    MINOR: 150,      // CP loss < 150
    MODERATE: 300,   // CP loss 150-299
    MAJOR: 500,      // CP loss 300-499
    CRITICAL: 500    // CP loss >= 500
  },

  /**
   * Game phase boundaries (move numbers)
   */
  PHASE: {
    OPENING_END: 10,      // Moves 1-10
    MIDDLEGAME_END: 40,   // Moves 11-40
    // Moves 41+ = endgame
  },

  /**
   * Tactical detection thresholds
   */
  TACTICAL: {
    // Minimum CP loss for tactical pattern detection
    HANGING_PIECE_MIN_LOSS: 200,
    TACTICAL_OVERSIGHT_MIN_LOSS: 300,

    // Minimum eval difference for missed opportunity detection
    MISSED_WINNING_TACTIC_EVAL: 300,
    MISSED_IMPROVEMENT_EVAL: 100,
    MISSED_POSITIONAL_EVAL: 50,

    // Win probability thresholds for missed opportunities
    MISSED_IMPROVEMENT_WIN_PROB: 8
  },

  /**
   * Check if an evaluation represents a mate
   * @param {number} evaluation - Evaluation in centipawns
   * @returns {boolean} True if this is a mate evaluation
   */
  isMateEvaluation(evaluation) {
    return Math.abs(evaluation) >= this.CLASSIFICATION.MATE_THRESHOLD;
  },

  /**
   * Get classification based on win probability drop
   * @param {number} winProbDrop - Win probability drop (percentage points)
   * @param {number} evaluation - Current evaluation (for mate detection)
   * @returns {string|null} Classification or null for good move
   */
  getClassification(winProbDrop, evaluation = 0) {
    // CRITICAL: Mate detection - always a blunder if moving into mate
    if (this.isMateEvaluation(evaluation) && evaluation < 0) {
      return 'blunder';
    }

    // Win probability based classification
    if (winProbDrop >= this.CLASSIFICATION.WIN_PROB_BLUNDER) {
      return 'blunder';
    }
    if (winProbDrop >= this.CLASSIFICATION.WIN_PROB_MISTAKE) {
      return 'mistake';
    }
    if (winProbDrop >= this.CLASSIFICATION.WIN_PROB_INACCURACY) {
      return 'inaccuracy';
    }

    return null; // Good move
  },

  /**
   * Get classification based on centipawn loss (fallback method)
   * @param {number} cpLoss - Centipawn loss
   * @param {number} evaluation - Current evaluation (for mate detection)
   * @returns {string|null} Classification or null for good move
   */
  getClassificationByCpLoss(cpLoss, evaluation = 0) {
    // CRITICAL: Mate detection - always a blunder if moving into mate
    if (this.isMateEvaluation(evaluation) && evaluation < 0) {
      return 'blunder';
    }

    if (cpLoss >= this.CLASSIFICATION.CP_BLUNDER) {
      return 'blunder';
    }
    if (cpLoss >= this.CLASSIFICATION.CP_MISTAKE) {
      return 'mistake';
    }
    if (cpLoss >= this.CLASSIFICATION.CP_INACCURACY) {
      return 'inaccuracy';
    }

    return null; // Good move
  }
};

module.exports = AnalysisConfig;
