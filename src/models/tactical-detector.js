/**
 * Tactical Blunder Detector
 * Phase 2.1 of ADR 005: Win-probability based accuracy calculation
 *
 * Detects tactical blunders by analyzing:
 * 1. Alternative moves from engine analysis
 * 2. Material loss in forced sequences
 * 3. Tactical patterns (hanging pieces, forced losses)
 */

const WinProbability = require('./win-probability');

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
   * @private
   */
  static _detectTacticalPattern(moveData, bestAlternative, evalDiff, winProbDrop) {
    const cpLoss = moveData.centipawnLoss || 0;

    // Only detect the most obvious tactical patterns
    // Most moves should be classified by win probability, not tactical patterns

    // Pattern 1: Massive material loss (hanging queen/rook level)
    // Only trigger for truly massive losses that are clearly tactical
    if (cpLoss >= 200 && evalDiff >= 200 && Math.abs(moveData.evaluation) < 200) {
      return {
        isTactical: true,
        type: 'hanging_piece',
        severity: 'blunder',
        reason: `Major material loss: ${cpLoss} CP loss, clearly tactical`
      };
    }

    // Pattern 2: Mate-level blunder in equal position
    // Only trigger for moves that go from equal to mate-level disadvantage
    if (cpLoss >= 300 && Math.abs(moveData.evaluation) < 100) {
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
    if (bestEval >= 300 && evalDiff >= 150) {
      return {
        hasMissed: true,
        type: 'winning_tactic',
        reason: `Missed winning tactic: Best move gives +${bestEval} CP advantage`
      };
    }

    // Type 2: Missed significant improvement
    // Move is okay but misses clear tactical/positional improvement
    if (evalDiff >= 100 && winProbDrop >= 8) {
      return {
        hasMissed: true,
        type: 'tactical_improvement',
        reason: `Missed tactical improvement: ${evalDiff} CP and ${winProbDrop.toFixed(1)}% win probability`
      };
    }

    // Type 3: Missed positional opportunity
    // Moderate eval difference in a critical position
    if (evalDiff >= 50 && Math.abs(evalAfter) < 100) {
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
   * UPDATED: Win-probability is now the PRIMARY classification method
   * Tactical overrides are much more conservative and rare
   */
  static classifyMoveWithTactics(moveAccuracy, tacticalAnalysis, evalBefore, evalAfter, cpLoss = 0, winProbBefore = null, winProbAfter = null) {
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

    // PRIMARY: Win-probability classification (most moves use this)
    if (shouldClassify) {
      // Calibrated thresholds based on systematic testing (Balanced config)
      // More sensitive to catch Lichess blunders while avoiding false positives
      if (winProbDrop >= 12) {
        return { classification: 'blunder', reason: 'win_probability', moveAccuracy, winProbDrop };
      }
      if (winProbDrop >= 8) {
        return { classification: 'mistake', reason: 'win_probability', moveAccuracy, winProbDrop };
      }
      if (winProbDrop >= 5) {
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
    if (shouldClassify && winProbDrop < 10 && tacticalAnalysis.isTacticalBlunder) {
      // Only allow tactical override if it's a very clear pattern
      if (tacticalAnalysis.severity === 'blunder' && cpLoss >= 150) {
        return {
          classification: 'blunder',
          reason: 'tactical',
          details: tacticalAnalysis.reason,
          moveAccuracy,
          tacticalType: tacticalAnalysis.type
        };
      }
      if (tacticalAnalysis.severity === 'mistake' && cpLoss >= 100) {
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
