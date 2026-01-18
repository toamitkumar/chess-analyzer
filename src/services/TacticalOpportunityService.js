/**
 * TacticalOpportunityService
 *
 * Service for tracking and analyzing tactical opportunities (found vs missed).
 * This enables chess.com-style "Forks", "Pins", and tactical pattern analysis.
 *
 * Reference: ADR 009 Phase 5.1 - Found vs Missed Tactical Opportunities
 */

class TacticalOpportunityService {
  constructor(database) {
    this.database = database;
  }

  /**
   * Record a tactical opportunity (found or missed)
   * @param {number} gameId - Game ID
   * @param {object} opportunity - Opportunity details
   * @returns {Promise<object>} Inserted record
   */
  async recordOpportunity(gameId, opportunity) {
    const {
      moveNumber,
      playerColor,
      tacticType,
      attackingPiece,
      targetPieces,
      wasFound,
      bestMove,
      playedMove,
      evalGain,
      fenPosition
    } = opportunity;

    const sql = `
      INSERT INTO tactical_opportunities (
        game_id, move_number, player_color, tactic_type, attacking_piece,
        target_pieces, was_found, best_move, played_move, eval_gain, fen_position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      gameId,
      moveNumber,
      playerColor,
      tacticType,
      attackingPiece || null,
      targetPieces ? JSON.stringify(targetPieces) : null,
      wasFound ? 1 : 0,
      bestMove || null,
      playedMove || null,
      evalGain || null,
      fenPosition
    ];

    const result = await this.database.run(sql, params);
    return { id: result.lastID, ...opportunity };
  }

  /**
   * Get found vs missed summary for a user
   * @param {string} userId - User ID
   * @param {string} tacticType - Optional filter by tactic type
   * @returns {Promise<object>} Summary with found/missed counts and percentages
   */
  async getFoundVsMissed(userId, tacticType = null) {
    let query = `
      SELECT
        t.tactic_type,
        COUNT(*) as total,
        SUM(CASE WHEN t.was_found = 1 THEN 1 ELSE 0 END) as found,
        SUM(CASE WHEN t.was_found = 0 THEN 1 ELSE 0 END) as missed,
        AVG(CASE WHEN t.was_found = 1 THEN t.eval_gain ELSE 0 END) as avg_gain_when_found,
        AVG(CASE WHEN t.was_found = 0 THEN t.eval_gain ELSE 0 END) as avg_missed_gain
      FROM tactical_opportunities t
      JOIN games g ON t.game_id = g.id
      WHERE g.user_id = ?
        AND ((g.user_color = 'white' AND t.player_color = 'white')
          OR (g.user_color = 'black' AND t.player_color = 'black'))
    `;
    const params = [userId];

    if (tacticType) {
      query += ' AND t.tactic_type = ?';
      params.push(tacticType);
    }

    query += ' GROUP BY t.tactic_type ORDER BY total DESC';

    const results = await this.database.all(query, params);

    // Calculate overall totals
    const overall = {
      total: 0,
      found: 0,
      missed: 0,
      foundPercentage: 0,
      missedPercentage: 0
    };

    const byType = results.map(row => {
      const foundPct = row.total > 0 ? Math.round((row.found / row.total) * 100) : 0;
      const missedPct = row.total > 0 ? Math.round((row.missed / row.total) * 100) : 0;

      overall.total += row.total;
      overall.found += row.found;
      overall.missed += row.missed;

      return {
        tacticType: row.tactic_type,
        total: row.total,
        found: row.found,
        missed: row.missed,
        foundPercentage: foundPct,
        missedPercentage: missedPct,
        avgGainWhenFound: Math.round(row.avg_gain_when_found || 0),
        avgMissedGain: Math.round(row.avg_missed_gain || 0)
      };
    });

    if (overall.total > 0) {
      overall.foundPercentage = Math.round((overall.found / overall.total) * 100);
      overall.missedPercentage = Math.round((overall.missed / overall.total) * 100);
    }

    return {
      overall,
      byType
    };
  }

  /**
   * Get tactical opportunities grouped by attacking piece type
   * @param {string} userId - User ID
   * @param {string} tacticType - Filter by tactic type (optional)
   * @returns {Promise<object>} Breakdown by attacking piece
   */
  async getByAttackingPiece(userId, tacticType = null) {
    let query = `
      SELECT
        t.attacking_piece,
        COUNT(*) as total,
        SUM(CASE WHEN t.was_found = 1 THEN 1 ELSE 0 END) as found,
        SUM(CASE WHEN t.was_found = 0 THEN 1 ELSE 0 END) as missed
      FROM tactical_opportunities t
      JOIN games g ON t.game_id = g.id
      WHERE g.user_id = ?
        AND t.attacking_piece IS NOT NULL
        AND ((g.user_color = 'white' AND t.player_color = 'white')
          OR (g.user_color = 'black' AND t.player_color = 'black'))
    `;
    const params = [userId];

    if (tacticType) {
      query += ' AND t.tactic_type = ?';
      params.push(tacticType);
    }

    query += ' GROUP BY t.attacking_piece ORDER BY total DESC';

    const results = await this.database.all(query, params);

    // Map piece types to full names
    const pieceNames = {
      'P': 'Pawn',
      'N': 'Knight',
      'B': 'Bishop',
      'R': 'Rook',
      'Q': 'Queen',
      'K': 'King'
    };

    return results.map(row => ({
      pieceType: row.attacking_piece,
      pieceName: pieceNames[row.attacking_piece] || row.attacking_piece,
      total: row.total,
      found: row.found,
      missed: row.missed,
      foundPercentage: row.total > 0 ? Math.round((row.found / row.total) * 100) : 0
    }));
  }

  /**
   * Get detailed fork opportunities for a user
   * @param {string} userId - User ID
   * @returns {Promise<object>} Fork opportunities summary
   */
  async getForkOpportunities(userId) {
    return this.getFoundVsMissed(userId, 'fork');
  }

  /**
   * Get detailed pin opportunities for a user
   * @param {string} userId - User ID
   * @returns {Promise<object>} Pin opportunities summary
   */
  async getPinOpportunities(userId) {
    return this.getFoundVsMissed(userId, 'pin');
  }

  /**
   * Get recent missed opportunities for review
   * @param {string} userId - User ID
   * @param {number} limit - Number of opportunities to return
   * @returns {Promise<Array>} Recent missed opportunities
   */
  async getRecentMissed(userId, limit = 10) {
    const query = `
      SELECT t.*, g.white_player, g.black_player, g.date, g.event
      FROM tactical_opportunities t
      JOIN games g ON t.game_id = g.id
      WHERE g.user_id = ?
        AND t.was_found = 0
        AND ((g.user_color = 'white' AND t.player_color = 'white')
          OR (g.user_color = 'black' AND t.player_color = 'black'))
      ORDER BY t.created_at DESC
      LIMIT ?
    `;

    const results = await this.database.all(query, [userId, limit]);

    return results.map(row => ({
      id: row.id,
      gameId: row.game_id,
      moveNumber: row.move_number,
      tacticType: row.tactic_type,
      attackingPiece: row.attacking_piece,
      targetPieces: row.target_pieces ? JSON.parse(row.target_pieces) : [],
      bestMove: row.best_move,
      playedMove: row.played_move,
      evalGain: row.eval_gain,
      fen: row.fen_position,
      opponent: row.player_color === 'white' ? row.black_player : row.white_player,
      date: row.date,
      event: row.event
    }));
  }

  /**
   * Get summary for insights dashboard
   * @param {string} userId - User ID
   * @returns {Promise<object>} Comprehensive tactical summary
   */
  async getDashboardSummary(userId) {
    const foundVsMissed = await this.getFoundVsMissed(userId);
    const byPiece = await this.getByAttackingPiece(userId);
    const recentMissed = await this.getRecentMissed(userId, 5);

    // Get specific tactic breakdowns
    const forks = foundVsMissed.byType.find(t => t.tacticType === 'fork') || {
      total: 0, found: 0, missed: 0, foundPercentage: 0
    };
    const pins = foundVsMissed.byType.find(t => t.tacticType === 'pin') || {
      total: 0, found: 0, missed: 0, foundPercentage: 0
    };
    const skewers = foundVsMissed.byType.find(t => t.tacticType === 'skewer') || {
      total: 0, found: 0, missed: 0, foundPercentage: 0
    };
    const discoveredAttacks = foundVsMissed.byType.find(t => t.tacticType === 'discovered_attack') || {
      total: 0, found: 0, missed: 0, foundPercentage: 0
    };

    return {
      overall: foundVsMissed.overall,
      byType: {
        forks,
        pins,
        skewers,
        discoveredAttacks
      },
      byAttackingPiece: byPiece,
      recentMissed
    };
  }
}

module.exports = TacticalOpportunityService;
