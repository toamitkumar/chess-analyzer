/**
 * OpponentBlunderService
 *
 * Manages opponent blunder records in the database.
 * Tracks free pieces (hanging pieces) that opponents leave.
 *
 * Reference: ADR 009 Phase 5.3 - Free Pieces (Opponent Blunders)
 */

class OpponentBlunderService {
  constructor(database) {
    this.database = database;
  }

  /**
   * Record an opponent blunder (free piece)
   * @param {number} gameId - ID of the game
   * @param {Object} blunder - Opponent blunder data
   * @param {number} blunder.moveNumber - Move number in the game
   * @param {string} blunder.playerColor - Color of the player (who could capture)
   * @param {string} blunder.opponentPiece - Piece that was hanging (uppercase: Q, R, B, N, P)
   * @param {boolean} blunder.wasCaptured - Whether the player captured the free piece
   * @param {string} blunder.captureMove - Best capture move (SAN notation)
   * @param {string} blunder.playedMove - Move actually played (SAN notation)
   * @param {string} blunder.fenPosition - FEN position where piece was hanging
   * @returns {Promise<Object>} Inserted record
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

    const db = this.database.getDb();

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO opponent_blunders (
          game_id, move_number, player_color, opponent_piece,
          was_captured, capture_move, played_move, fen_position
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gameId,
          moveNumber,
          playerColor,
          opponentPiece,
          wasCaptured ? 1 : 0,
          captureMove,
          playedMove,
          fenPosition
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...blunder });
          }
        }
      );
    });
  }

  /**
   * Get all opponent blunders for a game
   * @param {number} gameId - Game ID
   * @returns {Promise<Array>} Array of opponent blunders
   */
  async getBlundersForGame(gameId) {
    const db = this.database.getDb();

    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM opponent_blunders WHERE game_id = ? ORDER BY move_number`,
        [gameId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              ...row,
              wasCaptured: row.was_captured === 1
            })));
          }
        }
      );
    });
  }

  /**
   * Get free piece statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Free piece statistics
   */
  async getFreePieceStats(userId) {
    const db = this.database.getDb();

    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          opponent_piece,
          COUNT(*) as total,
          SUM(CASE WHEN was_captured = 1 THEN 1 ELSE 0 END) as captured,
          SUM(CASE WHEN was_captured = 0 THEN 1 ELSE 0 END) as missed
        FROM opponent_blunders ob
        JOIN games g ON ob.game_id = g.id
        WHERE g.user_id = ?
        GROUP BY opponent_piece`,
        [userId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const stats = {
              total: 0,
              captured: 0,
              missed: 0,
              byPiece: {}
            };

            for (const row of rows) {
              stats.total += row.total;
              stats.captured += row.captured;
              stats.missed += row.missed;
              stats.byPiece[row.opponent_piece] = {
                total: row.total,
                captured: row.captured,
                missed: row.missed,
                captureRate: row.total > 0 ? Math.round((row.captured / row.total) * 100) : 0
              };
            }

            stats.captureRate = stats.total > 0 ? Math.round((stats.captured / stats.total) * 100) : 0;
            resolve(stats);
          }
        }
      );
    });
  }

  /**
   * Get recent missed free pieces for a user (for learning/improvement)
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of missed free piece opportunities
   */
  async getRecentMissedFreePieces(userId, limit = 10) {
    const db = this.database.getDb();

    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
          ob.*,
          g.white_player,
          g.black_player,
          g.date
        FROM opponent_blunders ob
        JOIN games g ON ob.game_id = g.id
        WHERE g.user_id = ? AND ob.was_captured = 0
        ORDER BY g.date DESC, ob.id DESC
        LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              ...row,
              wasCaptured: false
            })));
          }
        }
      );
    });
  }
}

module.exports = OpponentBlunderService;
