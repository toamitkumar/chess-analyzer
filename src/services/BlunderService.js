/**
 * BlunderService
 *
 * Centralized business logic for blunder-related operations.
 * This service provides consistent blunder queries across all controllers and services.
 *
 * Key principle: All blunder queries MUST filter by player_color to ensure
 * we only count/fetch blunders made by the user, not their opponents.
 */

class BlunderService {
  constructor(database) {
    this.database = database;
  }

  /**
   * Get blunder count for a specific game
   * @param {number} gameId - Game ID
   * @param {string} userColor - User's color in the game ('white' or 'black')
   * @param {object} options - Optional filters
   * @returns {Promise<number>} Number of blunders
   */
  async getBlunderCountForGame(gameId, userColor, options = {}) {
    const { phase, theme, severity } = options;

    let query = `
      SELECT COUNT(*) as count
      FROM blunder_details bd
      WHERE bd.game_id = ?
        AND bd.is_blunder = TRUE
        AND bd.player_color = ?
    `;
    const params = [gameId, userColor];

    if (phase) {
      query += ' AND bd.phase = ?';
      params.push(phase);
    }

    if (theme) {
      query += ' AND bd.tactical_theme = ?';
      params.push(theme);
    }

    if (severity) {
      query += ' AND bd.blunder_severity = ?';
      params.push(severity);
    }

    const result = await this.database.get(query, params);
    return parseInt(result?.count) || 0;
  }

  /**
   * Get all blunders for a user with optional filters
   * @param {string} userId - User ID
   * @param {object} filters - Optional filters (phase, theme, learned, severity, etc.)
   * @returns {Promise<Array>} Array of blunder records with game info
   */
  async getBlundersForUser(userId, filters = {}) {
    const { phase, theme, learned, severity, minDifficulty, maxDifficulty, includeGameInfo = true } = filters;

    const selectFields = includeGameInfo
      ? 'bd.*, g.white_player, g.black_player, g.date, g.event, g.user_color'
      : 'bd.*';

    let query = `
      SELECT ${selectFields}
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE g.user_id = ? AND bd.player_color = g.user_color
    `;
    const params = [userId];

    if (phase) {
      query += ' AND bd.phase = ?';
      params.push(phase);
    }

    if (theme) {
      query += ' AND bd.tactical_theme = ?';
      params.push(theme);
    }

    if (learned !== undefined) {
      query += ' AND bd.learned = ?';
      params.push(learned ? 1 : 0);
    }

    if (severity) {
      query += ' AND bd.blunder_severity = ?';
      params.push(severity);
    }

    if (minDifficulty !== undefined) {
      query += ' AND bd.difficulty_level >= ?';
      params.push(parseInt(minDifficulty));
    }

    if (maxDifficulty !== undefined) {
      query += ' AND bd.difficulty_level <= ?';
      params.push(parseInt(maxDifficulty));
    }

    query += ' ORDER BY bd.created_at DESC';

    return await this.database.all(query, params);
  }

  /**
   * Get blunders filtered by game phase
   * @param {string} userId - User ID
   * @param {string} phase - Game phase ('opening', 'middlegame', 'endgame')
   * @returns {Promise<Array>} Array of blunders in that phase
   */
  async getBlundersByPhase(userId, phase) {
    const blunders = await this.database.all(`
      SELECT bd.*, g.white_player, g.black_player, g.date, g.event, g.user_color
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE g.user_id = ? AND bd.player_color = g.user_color AND bd.phase = ?
      ORDER BY bd.centipawn_loss DESC
    `, [userId, phase]);

    return blunders;
  }

  /**
   * Get blunders filtered by tactical theme
   * @param {string} userId - User ID
   * @param {string} theme - Tactical theme
   * @returns {Promise<Array>} Array of blunders with that theme
   */
  async getBlundersByTheme(userId, theme) {
    const blunders = await this.database.all(`
      SELECT bd.*, g.white_player, g.black_player, g.date, g.event, g.user_color
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE g.user_id = ? AND bd.player_color = g.user_color AND bd.tactical_theme = ?
      ORDER BY bd.centipawn_loss DESC
    `, [userId, theme]);

    return blunders;
  }

  /**
   * Get unlearned blunders (for learning prioritization)
   * @param {string} userId - User ID
   * @param {number} minMastery - Minimum mastery score threshold (default: 0.7)
   * @returns {Promise<Array>} Array of unlearned blunders
   */
  async getUnlearnedBlunders(userId, minMastery = 0.7) {
    const blunders = await this.database.all(`
      SELECT bd.*, g.white_player, g.black_player, g.date, g.event, g.user_color
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE g.user_id = ? AND bd.player_color = g.user_color
        AND (bd.learned = 0 OR bd.mastery_score < ?)
      ORDER BY bd.difficulty_level DESC, bd.centipawn_loss DESC
    `, [userId, minMastery]);

    return blunders;
  }

  /**
   * Get blunder statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<object>} Blunder statistics
   */
  async getBlunderStats(userId) {
    // Get all blunders (actual blunders only, not mistakes or inaccuracies)
    const allBlunders = await this.database.all(`
      SELECT bd.*, g.white_player, g.black_player, g.date, g.event, g.user_color
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE g.user_id = ? AND bd.player_color = g.user_color AND bd.is_blunder = TRUE
      ORDER BY bd.created_at DESC
    `, [userId]);

    const totalBlunders = allBlunders.length;
    const avgCentipawnLoss = totalBlunders > 0
      ? Math.round(allBlunders.reduce((sum, b) => sum + (b.centipawn_loss || 0), 0) / totalBlunders)
      : 0;

    // Group by phase
    const byPhase = {
      opening: allBlunders.filter(b => b.phase === 'opening').length,
      middlegame: allBlunders.filter(b => b.phase === 'middlegame').length,
      endgame: allBlunders.filter(b => b.phase === 'endgame').length
    };

    // Group by severity
    const bySeverity = {
      minor: allBlunders.filter(b => b.blunder_severity === 'minor').length,
      moderate: allBlunders.filter(b => b.blunder_severity === 'moderate').length,
      major: allBlunders.filter(b => b.blunder_severity === 'major').length,
      critical: allBlunders.filter(b => b.blunder_severity === 'critical').length
    };

    // Group by tactical theme
    const byTheme = {};
    allBlunders.forEach(blunder => {
      const theme = blunder.tactical_theme || 'unknown';
      byTheme[theme] = (byTheme[theme] || 0) + 1;
    });

    // Learning progress
    const learned = allBlunders.filter(b => b.learned).length;
    const unlearned = totalBlunders - learned;
    const avgMastery = totalBlunders > 0
      ? allBlunders.reduce((sum, b) => sum + (b.mastery_score || 0), 0) / totalBlunders
      : 0;

    return {
      total: totalBlunders,
      avgCentipawnLoss,
      byPhase,
      bySeverity,
      byTheme: Object.entries(byTheme)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .reduce((obj, [theme, count]) => ({ ...obj, [theme]: count }), {}),
      learning: {
        learned,
        unlearned,
        avgMastery: Math.round(avgMastery * 100) / 100
      },
      recentBlunders: allBlunders.slice(0, 10)
    };
  }

  /**
   * Get blunder timeline (blunders over time)
   * @param {string} userId - User ID
   * @param {string} startDate - Optional start date (YYYY-MM-DD)
   * @param {string} endDate - Optional end date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of daily blunder counts
   */
  async getBlunderTimeline(userId, startDate = null, endDate = null) {
    let query = `
      SELECT
        DATE(bd.created_at) as date,
        COUNT(*) as count,
        AVG(bd.centipawn_loss) as avgLoss
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE g.user_id = ? AND bd.player_color = g.user_color AND bd.is_blunder = TRUE
    `;
    const params = [userId];

    if (startDate) {
      query += ' AND DATE(bd.created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(bd.created_at) <= ?';
      params.push(endDate);
    }

    query += ' GROUP BY DATE(bd.created_at) ORDER BY date DESC';

    const timeline = await this.database.all(query, params);

    return timeline.map(row => ({
      date: row.date,
      count: row.count,
      avgLoss: Math.round(row.avgLoss)
    }));
  }

  /**
   * Mark a blunder as reviewed
   * @param {number} blunderId - Blunder ID
   * @param {string} userId - User ID (for security check)
   * @returns {Promise<object>} Updated blunder
   */
  async markAsReviewed(blunderId, userId) {
    // Verify blunder belongs to user
    const blunder = await this.database.get(`
      SELECT bd.* FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.id = ? AND g.user_id = ?
    `, [blunderId, userId]);

    if (!blunder) {
      throw new Error('Blunder not found or access denied');
    }

    await this.database.run(`
      UPDATE blunder_details
      SET review_count = review_count + 1,
          last_reviewed = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [blunderId]);

    return await this.database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);
  }

  /**
   * Get hanging pieces breakdown by piece type (ADR 009 Phase 5.2)
   * Shows which pieces the user most commonly loses/hangs
   * @param {string} userId - User ID
   * @returns {Promise<object>} Breakdown of blunders by piece type
   */
  async getHangingPiecesByType(userId) {
    // Query blunders grouped by piece_type
    const pieceBreakdown = await this.database.all(`
      SELECT
        bd.piece_type,
        COUNT(*) as count,
        AVG(bd.centipawn_loss) as avgLoss
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE g.user_id = ?
        AND bd.player_color = g.user_color
        AND bd.is_blunder = TRUE
        AND bd.piece_type IS NOT NULL
      GROUP BY bd.piece_type
      ORDER BY count DESC
    `, [userId]);

    // Calculate total for percentages
    const total = pieceBreakdown.reduce((sum, row) => sum + row.count, 0);

    // Map piece types to full names
    const pieceNames = {
      'P': 'Pawn',
      'N': 'Knight',
      'B': 'Bishop',
      'R': 'Rook',
      'Q': 'Queen',
      'K': 'King'
    };

    // Format response with percentages
    const byPiece = pieceBreakdown.map(row => ({
      pieceType: row.piece_type,
      pieceName: pieceNames[row.piece_type] || row.piece_type,
      count: row.count,
      percentage: total > 0 ? Math.round((row.count / total) * 100) : 0,
      avgCentipawnLoss: Math.round(row.avgLoss || 0)
    }));

    // Ensure all piece types are represented (even with 0)
    const allPieceTypes = ['P', 'N', 'B', 'R', 'Q', 'K'];
    const completeBreakdown = allPieceTypes.map(pieceType => {
      const existing = byPiece.find(p => p.pieceType === pieceType);
      return existing || {
        pieceType,
        pieceName: pieceNames[pieceType],
        count: 0,
        percentage: 0,
        avgCentipawnLoss: 0
      };
    });

    return {
      total,
      byPiece: completeBreakdown,
      mostCommon: byPiece.length > 0 ? byPiece[0] : null
    };
  }

  /**
   * Mark a blunder as learned
   * @param {number} blunderId - Blunder ID
   * @param {string} userId - User ID (for security check)
   * @param {number} masteryScore - Mastery score (0-1)
   * @param {string} notes - Optional notes
   * @returns {Promise<object>} Updated blunder
   */
  async markAsLearned(blunderId, userId, masteryScore = 1.0, notes = null) {
    // Verify blunder belongs to user
    const blunder = await this.database.get(`
      SELECT bd.* FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.id = ? AND g.user_id = ?
    `, [blunderId, userId]);

    if (!blunder) {
      throw new Error('Blunder not found or access denied');
    }

    await this.database.run(`
      UPDATE blunder_details
      SET learned = 1,
          mastery_score = ?,
          notes = COALESCE(?, notes),
          last_reviewed = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [masteryScore, notes, blunderId]);

    return await this.database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);
  }
}

module.exports = BlunderService;
