/**
 * Accuracy Calculator Utility
 * Provides consistent accuracy calculations across the application
 */

class AccuracyCalculator {
  /**
   * Calculate accuracy using a more forgiving formula for high CPL values
   * @param {number} avgCentipawnLoss - Average centipawn loss
   * @returns {number} Accuracy percentage (0-100)
   */
  static calculateAccuracy(avgCentipawnLoss) {
    if (avgCentipawnLoss < 0) return 100;
    
    // More forgiving formula that works better with higher CPL values
    // This gives more reasonable results for amateur play
    const accuracy = Math.max(0, 100 - (avgCentipawnLoss / 3));
    
    return Math.round(accuracy);
  }

  /**
   * Calculate player-specific accuracy from moves
   * @param {Array} moves - Array of move analysis objects
   * @param {string} targetPlayer - Player name to calculate for
   * @param {string} whitePlayer - White player name
   * @param {string} blackPlayer - Black player name
   * @returns {number} Player accuracy percentage
   */
  static calculatePlayerAccuracy(moves, targetPlayer, whitePlayer, blackPlayer) {
    if (!moves || moves.length === 0) return 0;
    
    const isPlayerWhite = whitePlayer === targetPlayer;
    const isPlayerBlack = blackPlayer === targetPlayer;
    
    if (!isPlayerWhite && !isPlayerBlack) return 0;
    
    // Filter moves for the target player only
    const playerMoves = moves.filter(move => 
      (isPlayerWhite && move.move_number % 2 === 1) ||
      (isPlayerBlack && move.move_number % 2 === 0)
    );
    
    if (playerMoves.length === 0) return 0;
    
    const totalCentipawnLoss = playerMoves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0);
    const avgCentipawnLoss = totalCentipawnLoss / playerMoves.length;
    
    return this.calculateAccuracy(avgCentipawnLoss);
  }

  /**
   * Calculate accuracy for multiple games
   * @param {Array} games - Array of game objects with analysis
   * @param {string} targetPlayer - Player name to calculate for
   * @returns {number} Overall accuracy percentage
   */
  static calculateOverallAccuracy(games, targetPlayer) {
    if (!games || games.length === 0) return 0;

    let totalCentipawnLoss = 0;
    let totalMoves = 0;

    for (const game of games) {
      if (!game.analysis || !Array.isArray(game.analysis)) continue;

      // Use user_color if available (new logic), otherwise fall back to player name comparison
      let isPlayerWhite, isPlayerBlack;
      if (game.user_color) {
        isPlayerWhite = game.user_color === 'white';
        isPlayerBlack = game.user_color === 'black';
      } else {
        // Fallback for old data without user_color
        isPlayerWhite = game.white_player === targetPlayer;
        isPlayerBlack = game.black_player === targetPlayer;
      }

      if (!isPlayerWhite && !isPlayerBlack) continue;

      // Filter moves for the target player
      const playerMoves = game.analysis.filter(move =>
        (isPlayerWhite && move.move_number % 2 === 1) ||
        (isPlayerBlack && move.move_number % 2 === 0)
      );

      totalCentipawnLoss += playerMoves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0);
      totalMoves += playerMoves.length;
    }

    if (totalMoves === 0) return 0;

    const avgCentipawnLoss = totalCentipawnLoss / totalMoves;
    return this.calculateAccuracy(avgCentipawnLoss);
  }
}

module.exports = AccuracyCalculator;
