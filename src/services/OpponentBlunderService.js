/**
 * OpponentBlunderService
 *
 * Service for tracking and analyzing opponent blunders (free pieces).
 * Tracks when opponents leave pieces hanging and whether the player captured them.
 *
 * Reference: ADR 009 Phase 5.3 - Free Pieces (Opponent Blunders)
 */

class OpponentBlunderService {
  constructor(database) {
    this.database = database;

    // Material values for pieces
    this.pieceValues = {
      'P': 1,
      'N': 3,
      'B': 3,
      'R': 5,
      'Q': 9
    };

    // Piece names for display
    this.pieceNames = {
      'P': 'Pawn',
      'N': 'Knight',
      'B': 'Bishop',
      'R': 'Rook',
      'Q': 'Queen'
    };
  }

  /**
   * Record an opponent blunder (free piece)
   * @param {number} gameId - Game ID
   * @param {object} blunder - Blunder details
   * @returns {Promise<object>} Inserted record
   */
  async recordOpponentBlunder(gameId, blunder) {
    const {
      moveNumber,
      playerColor,
      opponentPiece,
      wasCaptured,
      captureMove,
      playedMove,
      fenPosition
    } = blunder;

    const pieceValue = this.pieceValues[opponentPiece] || 0;

    const sql = `
      INSERT INTO opponent_blunders (
        game_id, move_number, player_color, opponent_piece,
        was_captured, capture_move, played_move, piece_value, fen_position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      gameId,
      moveNumber,
      playerColor,
      opponentPiece || null,
      wasCaptured ? 1 : 0,
      captureMove || null,
      playedMove || null,
      pieceValue,
      fenPosition
    ];

    const result = await this.database.run(sql, params);
    return { id: result.lastID, ...blunder, pieceValue };
  }

  /**
   * Get free pieces statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<object>} Statistics about free pieces found vs missed
   */
  async getFreePiecesStats(userId) {
    const query = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ob.was_captured = 1 THEN 1 ELSE 0 END) as captured,
        SUM(CASE WHEN ob.was_captured = 0 THEN 1 ELSE 0 END) as missed,
        SUM(CASE WHEN ob.was_captured = 1 THEN ob.piece_value ELSE 0 END) as material_captured,
        SUM(CASE WHEN ob.was_captured = 0 THEN ob.piece_value ELSE 0 END) as material_missed
      FROM opponent_blunders ob
      JOIN games g ON ob.game_id = g.id
      WHERE g.user_id = ?
        AND ((g.user_color = 'white' AND ob.player_color = 'white')
          OR (g.user_color = 'black' AND ob.player_color = 'black'))
    `;

    const result = await this.database.get(query, [userId]);

    const total = result?.total || 0;
    const captured = result?.captured || 0;
    const missed = result?.missed || 0;

    return {
      total,
      captured,
      missed,
      capturedPercentage: total > 0 ? Math.round((captured / total) * 100) : 0,
      missedPercentage: total > 0 ? Math.round((missed / total) * 100) : 0,
      materialCaptured: result?.material_captured || 0,
      materialMissed: result?.material_missed || 0
    };
  }

  /**
   * Get free pieces grouped by opponent's piece type
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Breakdown by piece type
   */
  async getByPieceType(userId) {
    const query = `
      SELECT
        ob.opponent_piece,
        COUNT(*) as total,
        SUM(CASE WHEN ob.was_captured = 1 THEN 1 ELSE 0 END) as captured,
        SUM(CASE WHEN ob.was_captured = 0 THEN 1 ELSE 0 END) as missed,
        SUM(CASE WHEN ob.was_captured = 1 THEN ob.piece_value ELSE 0 END) as material_captured,
        SUM(CASE WHEN ob.was_captured = 0 THEN ob.piece_value ELSE 0 END) as material_missed
      FROM opponent_blunders ob
      JOIN games g ON ob.game_id = g.id
      WHERE g.user_id = ?
        AND ob.opponent_piece IS NOT NULL
        AND ((g.user_color = 'white' AND ob.player_color = 'white')
          OR (g.user_color = 'black' AND ob.player_color = 'black'))
      GROUP BY ob.opponent_piece
      ORDER BY total DESC
    `;

    const results = await this.database.all(query, [userId]);

    return results.map(row => ({
      pieceType: row.opponent_piece,
      pieceName: this.pieceNames[row.opponent_piece] || row.opponent_piece,
      pieceValue: this.pieceValues[row.opponent_piece] || 0,
      total: row.total,
      captured: row.captured,
      missed: row.missed,
      capturedPercentage: row.total > 0 ? Math.round((row.captured / row.total) * 100) : 0,
      materialCaptured: row.material_captured,
      materialMissed: row.material_missed
    }));
  }

  /**
   * Get total material value missed by the player
   * @param {string} userId - User ID
   * @returns {Promise<object>} Material statistics
   */
  async getMissedMaterial(userId) {
    const query = `
      SELECT
        SUM(ob.piece_value) as total_missed,
        COUNT(*) as missed_count,
        AVG(ob.piece_value) as avg_missed_value
      FROM opponent_blunders ob
      JOIN games g ON ob.game_id = g.id
      WHERE g.user_id = ?
        AND ob.was_captured = 0
        AND ((g.user_color = 'white' AND ob.player_color = 'white')
          OR (g.user_color = 'black' AND ob.player_color = 'black'))
    `;

    const result = await this.database.get(query, [userId]);

    return {
      totalMissed: result?.total_missed || 0,
      missedCount: result?.missed_count || 0,
      avgMissedValue: Math.round((result?.avg_missed_value || 0) * 10) / 10
    };
  }

  /**
   * Get recent missed free pieces for review
   * @param {string} userId - User ID
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Recent missed captures
   */
  async getRecentMissed(userId, limit = 10) {
    const query = `
      SELECT ob.*, g.white_player, g.black_player, g.date, g.event
      FROM opponent_blunders ob
      JOIN games g ON ob.game_id = g.id
      WHERE g.user_id = ?
        AND ob.was_captured = 0
        AND ((g.user_color = 'white' AND ob.player_color = 'white')
          OR (g.user_color = 'black' AND ob.player_color = 'black'))
      ORDER BY ob.created_at DESC
      LIMIT ?
    `;

    const results = await this.database.all(query, [userId, limit]);

    return results.map(row => ({
      id: row.id,
      gameId: row.game_id,
      moveNumber: row.move_number,
      opponentPiece: row.opponent_piece,
      pieceName: this.pieceNames[row.opponent_piece] || row.opponent_piece,
      pieceValue: row.piece_value,
      captureMove: row.capture_move,
      playedMove: row.played_move,
      fen: row.fen_position,
      opponent: row.player_color === 'white' ? row.black_player : row.white_player,
      date: row.date,
      event: row.event
    }));
  }

  /**
   * Get summary for insights dashboard
   * @param {string} userId - User ID
   * @returns {Promise<object>} Comprehensive free pieces summary
   */
  async getDashboardSummary(userId) {
    const stats = await this.getFreePiecesStats(userId);
    const byPiece = await this.getByPieceType(userId);
    const missedMaterial = await this.getMissedMaterial(userId);
    const recentMissed = await this.getRecentMissed(userId, 5);

    // Find most missed piece type
    const mostMissed = byPiece.length > 0
      ? byPiece.reduce((max, p) => p.missed > max.missed ? p : max, byPiece[0])
      : null;

    return {
      overall: stats,
      byPieceType: byPiece,
      missedMaterial,
      mostMissedPiece: mostMissed,
      recentMissed
    };
  }
}

module.exports = OpponentBlunderService;
