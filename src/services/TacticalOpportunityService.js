/**
 * TacticalOpportunityService
 *
 * Manages tactical opportunity records in the database.
 * Tracks found vs missed tactics (forks, pins, skewers, discovered attacks).
 *
 * Reference: ADR 009 Phase 5.1 - Found vs Missed Tactical Opportunities
 */

class TacticalOpportunityService {
  constructor(database) {
    this.database = database;
  }

  /**
   * Record a tactical opportunity
   * @param {number} gameId - ID of the game
   * @param {Object} opportunity - Tactical opportunity data
   * @param {number} opportunity.moveNumber - Move number in the game
   * @param {string} opportunity.playerColor - 'white' or 'black'
   * @param {string} opportunity.tacticType - Type of tactic (fork, pin, skewer, discovered_attack, tactical_sequence)
   * @param {string} opportunity.attackingPiece - Piece that executes the tactic (uppercase: K, Q, R, B, N, P)
   * @param {Array} opportunity.targetPieces - Target pieces (uppercase)
   * @param {boolean} opportunity.wasFound - Whether the player found the tactic
   * @param {string} opportunity.bestMove - Engine's best move (SAN notation)
   * @param {string} opportunity.playedMove - Move actually played (SAN notation)
   * @param {number} opportunity.evalGain - Evaluation gain in centipawns
   * @param {string} opportunity.fenPosition - FEN position before the move
   * @returns {Promise<Object>} Inserted record
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

    const db = this.database.getDb();

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO tactical_opportunities (
          game_id, move_number, player_color, tactic_type,
          attacking_piece, target_pieces, was_found,
          best_move, played_move, eval_gain, fen_position
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gameId,
          moveNumber,
          playerColor,
          tacticType,
          attackingPiece,
          JSON.stringify(targetPieces || []),
          wasFound ? 1 : 0,
          bestMove,
          playedMove,
          evalGain || 0,
          fenPosition
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...opportunity });
          }
        }
      );
    });
  }

  /**
   * Get all tactical opportunities for a game
   * @param {number} gameId - Game ID
   * @returns {Promise<Array>} Array of tactical opportunities
   */
  async getOpportunitiesForGame(gameId) {
    const db = this.database.getDb();

    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM tactical_opportunities WHERE game_id = ? ORDER BY move_number`,
        [gameId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              ...row,
              targetPieces: JSON.parse(row.target_pieces || '[]'),
              wasFound: row.was_found === 1
            })));
          }
        }
      );
    });
  }

  /**
   * Get tactical statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Tactical statistics
   */
  async getTacticStats(userId) {
    const db = this.database.getDb();

    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          tactic_type,
          COUNT(*) as total,
          SUM(CASE WHEN was_found = 1 THEN 1 ELSE 0 END) as found,
          SUM(CASE WHEN was_found = 0 THEN 1 ELSE 0 END) as missed
        FROM tactical_opportunities t
        JOIN games g ON t.game_id = g.id
        WHERE g.user_id = ?
        GROUP BY tactic_type`,
        [userId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const stats = {
              total: 0,
              found: 0,
              missed: 0,
              byType: {}
            };

            for (const row of rows) {
              stats.total += row.total;
              stats.found += row.found;
              stats.missed += row.missed;
              stats.byType[row.tactic_type] = {
                total: row.total,
                found: row.found,
                missed: row.missed,
                findRate: row.total > 0 ? Math.round((row.found / row.total) * 100) : 0
              };
            }

            stats.findRate = stats.total > 0 ? Math.round((stats.found / stats.total) * 100) : 0;
            resolve(stats);
          }
        }
      );
    });
  }

  /**
   * Get recent missed tactics for a user (for learning/improvement)
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of missed tactical opportunities
   */
  async getRecentMissedTactics(userId, limit = 10) {
    const db = this.database.getDb();

    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          t.*,
          g.white_player,
          g.black_player,
          g.date
        FROM tactical_opportunities t
        JOIN games g ON t.game_id = g.id
        WHERE g.user_id = ? AND t.was_found = 0
        ORDER BY g.date DESC, t.id DESC
        LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              ...row,
              targetPieces: JSON.parse(row.target_pieces || '[]'),
              wasFound: false
            })));
          }
        }
      );
    });
  }
}

module.exports = TacticalOpportunityService;
