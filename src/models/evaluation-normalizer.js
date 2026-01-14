/**
 * Evaluation Normalizer
 * Phase 1 of ADR 006: Lichess Evaluation Alignment
 *
 * Handles evaluation perspective normalization to match Lichess convention:
 * - Positive evaluation = White advantage
 * - Negative evaluation = Black advantage
 *
 * Stockfish returns evaluations from the side-to-move's perspective.
 * This module normalizes all evaluations to White's perspective.
 */

class EvaluationNormalizer {
  /**
   * Convert evaluation to White's perspective (Lichess convention)
   *
   * Stockfish returns evaluation from side-to-move's perspective:
   * - If White to move: +100 means White is better
   * - If Black to move: +100 means Black is better
   *
   * Lichess always shows evaluation from White's perspective:
   * - +100 always means White is better
   * - -100 always means Black is better
   *
   * @param {number} evaluation - Raw evaluation from Stockfish (centipawns)
   * @param {boolean} isWhiteToMove - True if it's White's turn to move
   * @returns {number} Evaluation from White's perspective
   *
   * @example
   * // White to move, Stockfish says +100 (White is better)
   * toWhitePerspective(100, true) // Returns: 100
   *
   * // Black to move, Stockfish says +100 (Black is better)
   * toWhitePerspective(100, false) // Returns: -100 (White is worse)
   */
  static toWhitePerspective(evaluation, isWhiteToMove) {
    if (isWhiteToMove) {
      // White to move: Stockfish eval is already from White's perspective
      return evaluation;
    } else {
      // Black to move: Stockfish eval is from Black's perspective
      // Negate to get White's perspective
      return -evaluation;
    }
  }

  /**
   * Convert evaluation to the mover's perspective
   *
   * Used for calculating centipawn loss (how much the position worsened for the mover)
   *
   * @param {number} evaluationWhitePerspective - Evaluation from White's perspective
   * @param {boolean} isWhiteMove - True if White made the move
   * @returns {number} Evaluation from the mover's perspective
   *
   * @example
   * // White moved, position is +100 from White's perspective
   * toMoverPerspective(100, true) // Returns: 100 (good for White)
   *
   * // Black moved, position is +100 from White's perspective
   * toMoverPerspective(100, false) // Returns: -100 (bad for Black)
   */
  static toMoverPerspective(evaluationWhitePerspective, isWhiteMove) {
    if (isWhiteMove) {
      // White moved: White's perspective is the mover's perspective
      return evaluationWhitePerspective;
    } else {
      // Black moved: Negate to get Black's perspective
      return -evaluationWhitePerspective;
    }
  }

  /**
   * Calculate centipawn loss from the mover's perspective
   *
   * Centipawn loss = how much the position worsened for the player who moved
   *
   * @param {number} evalBeforeWhitePerspective - Evaluation before move (White's perspective)
   * @param {number} evalAfterWhitePerspective - Evaluation after move (White's perspective)
   * @param {boolean} isWhiteMove - True if White made the move
   * @returns {number} Centipawn loss (always >= 0)
   *
   * @example
   * // White moves, position goes from +50 to +30 (White's perspective)
   * // White lost 20 centipawns
   * calculateCentipawnLoss(50, 30, true) // Returns: 20
   *
   * // Black moves, position goes from -50 to -30 (White's perspective)
   * // From Black's perspective: +50 to +30, Black lost 20 centipawns
   * calculateCentipawnLoss(-50, -30, false) // Returns: 20
   *
   * // Black moves, position goes from -50 to -80 (White's perspective)
   * // From Black's perspective: +50 to +80, Black gained 30 centipawns (no loss)
   * calculateCentipawnLoss(-50, -80, false) // Returns: 0
   */
  static calculateCentipawnLoss(evalBeforeWhitePerspective, evalAfterWhitePerspective, isWhiteMove) {
    // Convert to mover's perspective
    const beforeMover = this.toMoverPerspective(evalBeforeWhitePerspective, isWhiteMove);
    const afterMover = this.toMoverPerspective(evalAfterWhitePerspective, isWhiteMove);

    // Loss = how much worse the position got for the mover
    // Positive loss means the position worsened
    const loss = beforeMover - afterMover;

    // Return 0 if the position improved (no loss)
    return Math.max(0, Math.round(loss));
  }

  /**
   * Check if evaluation represents a mate
   *
   * @param {number} evaluation - Evaluation in centipawns
   * @returns {boolean} True if this is a mate evaluation
   */
  static isMateEvaluation(evaluation) {
    return Math.abs(evaluation) >= 9000;
  }

  /**
   * Get mate-in-N from evaluation
   *
   * @param {number} evaluation - Evaluation in centipawns (±10000 for mate)
   * @returns {number|null} Mate in N moves, or null if not a mate
   */
  static getMateIn(evaluation) {
    if (!this.isMateEvaluation(evaluation)) {
      return null;
    }

    // Our convention: 10000 = mate in 0 (checkmate), 9990 = mate in 1, etc.
    const absEval = Math.abs(evaluation);
    const mateIn = Math.round((10000 - absEval) / 10);

    return evaluation > 0 ? mateIn : -mateIn;
  }

  /**
   * Normalize raw Stockfish output for storage
   *
   * This is the main entry point for normalizing evaluations before storing in DB.
   *
   * @param {number} rawEvaluation - Raw evaluation from Stockfish
   * @param {boolean} isWhiteToMoveAfter - True if it's White's turn AFTER the move
   * @returns {number} Normalized evaluation (White's perspective)
   *
   * @example
   * // After Black's move (e5), it's White's turn
   * // Stockfish returns +174 (White is better from White's perspective)
   * normalizeForStorage(174, true) // Returns: 174
   *
   * // After White's move (d4), it's Black's turn
   * // Stockfish returns +20 (Black is slightly better from Black's perspective)
   * normalizeForStorage(20, false) // Returns: -20 (White is slightly worse)
   */
  static normalizeForStorage(rawEvaluation, isWhiteToMoveAfter) {
    // Stockfish returns eval from side-to-move's perspective
    // After a move, it's the opponent's turn
    // So we need to convert from opponent's perspective to White's perspective
    return this.toWhitePerspective(rawEvaluation, isWhiteToMoveAfter);
  }
}

module.exports = EvaluationNormalizer;
