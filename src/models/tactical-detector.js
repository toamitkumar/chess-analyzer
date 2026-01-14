/**
 * Tactical Blunder Detector
 * Phase 2.1 of ADR 005: Win-probability based accuracy calculation
 * Updated in ADR 006 Phase 2: Centralized thresholds + Mate detection
 *
 * Detects tactical blunders by analyzing:
 * 1. Alternative moves from engine analysis
 * 2. Material loss in forced sequences
 * 3. Tactical patterns (hanging pieces, forced losses)
 * 4. Mate detection (ADR 006)
 */

const WinProbability = require('./win-probability');
const AnalysisConfig = require('./analysis-config');

class TacticalDetector {
  /**
   * Analyze a move for tactical blunders using alternative moves
   *
   * @param {Object} moveData - Current move data
   * @param {number} moveData.evaluation - Position evaluation after the move
   * @param {number} moveData.centipawnLoss - CP loss of the move
   * @param {Array} alternatives - Alternative moves from engine (sorted by evaluation)
   * @returns {Object} Tactical analysis result
   *
   * @example
   * const result = TacticalDetector.analyzeTacticalBlunder({
   *   evaluation: 9,
   *   centipawnLoss: 21
   * }, [
   *   { evaluation: 12, move: 'Bg2', line: 'Bg2 c5' },
   *   { evaluation: 11, move: 'Bd2', line: 'Bd2' }
   * ]);
   * // Returns: { isTacticalBlunder: true, type: 'hanging_piece', severity: 'blunder', ... }
   */
  static analyzeTacticalBlunder(moveData, alternatives) {
    if (!alternatives || alternatives.length === 0) {
      return {
        isTacticalBlunder: false,
        hasMissedOpportunity: false,
        reason: 'No alternative moves available'
      };
    }

    const bestAlternative = alternatives[0];
    const evalAfter = moveData.evaluation;
    const evalBest = bestAlternative.evaluation;
    const evalDiff = Math.abs(evalBest - evalAfter);

    // Calculate win probability difference between best move and played move
    const winProbBest = WinProbability.cpToWinProbability(evalBest);
    const winProbPlayed = WinProbability.cpToWinProbability(evalAfter);
    const winProbDrop = Math.max(0, winProbBest - winProbPlayed);

    // Detect tactical blunder patterns
    const tacticalPattern = this._detectTacticalPattern(
      moveData,
      bestAlternative,
      evalDiff,
      winProbDrop
    );

    if (tacticalPattern.isTactical) {
      return {
        isTacticalBlunder: true,
        type: tacticalPattern.type,
        severity: tacticalPattern.severity,
        evalDiff,
        winProbDrop: winProbDrop.toFixed(1),
        bestMove: bestAlternative.move || bestAlternative.alternative_move,
        bestEval: evalBest,
        reason: tacticalPattern.reason
      };
    }

    // Check for missed opportunities (good move, but better exists)
    const missedOpp = this._detectMissedOpportunity(
      moveData,
      alternatives,
      evalDiff,
      winProbDrop
    );

    if (missedOpp.hasMissed) {
      return {
        isTacticalBlunder: false,
        hasMissedOpportunity: true,
        type: missedOpp.type,
        severity: 'missed_opportunity',
        evalDiff,
        winProbDrop: winProbDrop.toFixed(1),
        bestMove: bestAlternative.move || bestAlternative.alternative_move,
        bestEval: evalBest,
        reason: missedOpp.reason
      };
    }

    return {
      isTacticalBlunder: false,
      hasMissedOpportunity: false,
      evalDiff,
      winProbDrop: winProbDrop.toFixed(1)
    };
  }

  /**
   * Detect specific tactical patterns
   * Uses thresholds from AnalysisConfig (ADR 006 Phase 2)
   * @private
   */
  static _detectTacticalPattern(moveData, bestAlternative, evalDiff, winProbDrop) {
    const cpLoss = moveData.centipawnLoss || 0;

    // ADR 006 Phase 2: Check for mate first
    if (AnalysisConfig.isMateEvaluation(moveData.evaluation) && moveData.evaluation < 0) {
      return {
        isTactical: true,
        type: 'mate_blunder',
        severity: 'blunder',
        reason: `Moving into forced mate`
      };
    }

    // Only detect the most obvious tactical patterns
    // Most moves should be classified by win probability, not tactical patterns

    // Pattern 1: Massive material loss (hanging queen/rook level)
    // Only trigger for truly massive losses that are clearly tactical
    if (cpLoss >= AnalysisConfig.TACTICAL.HANGING_PIECE_MIN_LOSS && 
        evalDiff >= AnalysisConfig.TACTICAL.HANGING_PIECE_MIN_LOSS && 
        Math.abs(moveData.evaluation) < AnalysisConfig.TACTICAL.HANGING_PIECE_MIN_LOSS) {
      return {
        isTactical: true,
        type: 'hanging_piece',
        severity: 'blunder',
        reason: `Major material loss: ${cpLoss} CP loss, clearly tactical`
      };
    }

    // Pattern 2: Mate-level blunder in equal position
    // Only trigger for moves that go from equal to mate-level disadvantage
    if (cpLoss >= AnalysisConfig.TACTICAL.TACTICAL_OVERSIGHT_MIN_LOSS && 
        Math.abs(moveData.evaluation) < AnalysisConfig.CLASSIFICATION.CP_MISTAKE) {
      return {
        isTactical: true,
        type: 'tactical_oversight',
        severity: 'blunder',
        reason: `Mate-level tactical oversight: ${cpLoss} CP loss in equal position`
      };
    }

    // All other cases: let win probability handle classification
    return { isTactical: false };
  }

  /**
   * Detect missed tactical or positional opportunities
   * Uses thresholds from AnalysisConfig (ADR 006 Phase 2)
   * @private
   */
  static _detectMissedOpportunity(moveData, alternatives, evalDiff, winProbDrop) {
    const cpLoss = moveData.centipawnLoss || 0;
    const evalAfter = moveData.evaluation;

    // Only consider missed opportunities if the move wasn't bad (low CP loss)
    if (cpLoss > 30) {
      return { hasMissed: false };
    }

    // Type 1: Missed winning tactic
    // Best move gives significant advantage (>300 CP or mate) but player chose decent move
    const bestEval = alternatives[0].evaluation;
    if (bestEval >= AnalysisConfig.TACTICAL.MISSED_WINNING_TACTIC_EVAL && 
        evalDiff >= AnalysisConfig.TACTICAL.MISSED_WINNING_TACTIC_EVAL / 2) {
      return {
        hasMissed: true,
        type: 'winning_tactic',
        reason: `Missed winning tactic: Best move gives +${bestEval} CP advantage`
      };
    }

    // Type 2: Missed significant improvement
    // Move is okay but misses clear tactical/positional improvement
    if (evalDiff >= AnalysisConfig.TACTICAL.MISSED_IMPROVEMENT_EVAL && 
        winProbDrop >= AnalysisConfig.TACTICAL.MISSED_IMPROVEMENT_WIN_PROB) {
      return {
        hasMissed: true,
        type: 'tactical_improvement',
        reason: `Missed tactical improvement: ${evalDiff} CP and ${winProbDrop.toFixed(1)}% win probability`
      };
    }

    // Type 3: Missed positional opportunity
    // Moderate eval difference in a critical position
    if (evalDiff >= AnalysisConfig.TACTICAL.MISSED_POSITIONAL_EVAL && 
        Math.abs(evalAfter) < AnalysisConfig.CLASSIFICATION.CP_MISTAKE) {
      return {
        hasMissed: true,
        type: 'positional_improvement',
        reason: `Missed positional opportunity: ${evalDiff} CP improvement available`
      };
    }

    return { hasMissed: false };
  }

  /**
   * Combine tactical analysis with win-probability classification
   * Returns the most severe classification
   * 
   * UPDATED ADR 006 Phase 2:
   * - Added mate detection (always blunder if moving into forced mate)
   * - Uses centralized thresholds from AnalysisConfig
   * - Win-probability is the PRIMARY classification method
   */
  static classifyMoveWithTactics(moveAccuracy, tacticalAnalysis, evalBefore, evalAfter, cpLoss = 0, winProbBefore = null, winProbAfter = null) {
    // ADR 006 Phase 2: CRITICAL - Mate detection
    // If the position after the move is a forced mate against the mover, it's ALWAYS a blunder
    // evalAfter is from mover's perspective, so negative mate = mate against mover
    if (AnalysisConfig.isMateEvaluation(evalAfter) && evalAfter < 0) {
      return {
        classification: 'blunder',
        reason: 'mate_detection',
        details: `Moving into forced mate (eval: ${evalAfter})`,
        moveAccuracy,
        winProbDrop: 100 // Maximum drop
      };
    }

    // Check position context first (pass cpLoss for two-tier filtering)
    const shouldClassify = WinProbability.shouldClassifyMove(evalBefore, evalAfter, cpLoss);

    // Calculate win% drop - use pre-calculated values if available, otherwise calculate
    let winProbDrop;
    if (winProbBefore !== null && winProbAfter !== null) {
      // Use pre-calculated win probabilities from analyzer (more accurate)
      winProbDrop = Math.max(0, winProbBefore - winProbAfter);
    } else {
      // Fallback: calculate from evaluations
      const winProbBeforeCalc = WinProbability.cpToWinProbability(evalBefore);
      const winProbAfterCalc = WinProbability.cpToWinProbability(evalAfter);
      winProbDrop = Math.max(0, winProbBeforeCalc - winProbAfterCalc);
    }

    // PRIMARY: Win-probability classification using centralized config
    if (shouldClassify) {
      // Use thresholds from AnalysisConfig (ADR 006 Phase 2)
      if (winProbDrop >= AnalysisConfig.CLASSIFICATION.WIN_PROB_BLUNDER) {
        return { classification: 'blunder', reason: 'win_probability', moveAccuracy, winProbDrop };
      }
      if (winProbDrop >= AnalysisConfig.CLASSIFICATION.WIN_PROB_MISTAKE) {
        return { classification: 'mistake', reason: 'win_probability', moveAccuracy, winProbDrop };
      }
      if (winProbDrop >= AnalysisConfig.CLASSIFICATION.WIN_PROB_INACCURACY) {
        return { classification: 'inaccuracy', reason: 'win_probability', moveAccuracy, winProbDrop };
      }
    }

    // SECONDARY: Tactical overrides (only for extreme cases where win% fails)
    // These should be VERY rare and only catch obvious engine evaluation bugs
    if (shouldClassify) {
      const tacticalOverride = this._detectTacticalOverride(evalBefore, evalAfter, cpLoss, winProbDrop);
      if (tacticalOverride.isBlunder) {
        return {
          classification: 'blunder',
          reason: 'tactical_override',
          details: tacticalOverride.reason,
          moveAccuracy,
          winProbDrop
        };
      }
    }

    // TERTIARY: Explicit tactical blunders (very conservative)
    // Only if position is contestable AND no win% classification AND clear tactical pattern
    if (shouldClassify && winProbDrop < AnalysisConfig.CLASSIFICATION.WIN_PROB_MISTAKE && tacticalAnalysis.isTacticalBlunder) {
      // Only allow tactical override if it's a very clear pattern
      if (tacticalAnalysis.severity === 'blunder' && cpLoss >= AnalysisConfig.TACTICAL.HANGING_PIECE_MIN_LOSS * 0.75) {
        return {
          classification: 'blunder',
          reason: 'tactical',
          details: tacticalAnalysis.reason,
          moveAccuracy,
          tacticalType: tacticalAnalysis.type
        };
      }
      if (tacticalAnalysis.severity === 'mistake' && cpLoss >= AnalysisConfig.CLASSIFICATION.CP_MISTAKE) {
        return {
          classification: 'mistake',
          reason: 'tactical',
          details: tacticalAnalysis.reason,
          moveAccuracy,
          tacticalType: tacticalAnalysis.type
        };
      }
    }

    // QUATERNARY: Missed opportunities (informational only, don't classify as errors)
    if (tacticalAnalysis.hasMissedOpportunity) {
      return {
        classification: 'missed_opportunity',
        reason: tacticalAnalysis.type,
        details: tacticalAnalysis.reason,
        moveAccuracy,
        tacticalType: tacticalAnalysis.type
      };
    }

    return null; // Good move - no classification
  }

  /**
   * Detect tactical overrides for moves that don't show win% drop but are tactical blunders
   * EXTREMELY CONSERVATIVE: Only for clear engine evaluation bugs
   * Should be very rare (< 1% of moves)
   * @private
   */
  static _detectTacticalOverride(evalBefore, evalAfter, cpLoss, winProbDrop) {
    // Pattern 1: Massive CP loss with no win% drop (clear evaluation bug)
    // Only trigger for truly massive losses that make no sense
    if (cpLoss >= 200 && winProbDrop < 2) {
      return {
        isBlunder: true,
        reason: `Evaluation bug: ${cpLoss} CP loss but only ${winProbDrop.toFixed(1)}% win drop`
      };
    }

    // Pattern 2: Mate-level position deterioration
    // Only trigger when going from equal to mate-level disadvantage
    if (Math.abs(evalBefore) <= 50 && Math.abs(evalAfter) >= 500 && cpLoss >= 200) {
      return {
        isBlunder: true,
        reason: `Critical deterioration: Equal → mate-level (${cpLoss} CP loss)`
      };
    }

    // Pattern 3: Throwing away winning position completely
    // Only trigger for massive advantage squandering
    if (evalBefore >= 500 && cpLoss >= 300 && winProbDrop < 5) {
      return {
        isBlunder: true,
        reason: `Winning advantage thrown away: ${cpLoss} CP loss in winning position`
      };
    }

    // All other cases: trust win probability calculation
    return { isBlunder: false };
  }
}

module.exports = TacticalDetector;
