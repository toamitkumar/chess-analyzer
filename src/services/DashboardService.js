/**
 * Dashboard Service
 *
 * Orchestrates dashboard data retrieval and aggregation.
 * Uses existing calculator classes (TrendCalculator, HeatmapCalculator) from models/
 * Handles database queries and data transformation for dashboard endpoints.
 */

const { getDatabase } = require('../models/database');
const TrendCalculator = require('../models/trend-calculator');
const HeatmapCalculator = require('../models/HeatmapCalculator');
const AccuracyCalculator = require('../models/accuracy-calculator');
const { TARGET_PLAYER } = require('../config/app-config');

class DashboardService {
  constructor({ database = null, trendCalculator = null, heatmapCalculator = null } = {}) {
    this.database = database || getDatabase();
    this.trendCalculator = trendCalculator || new TrendCalculator();
    this.heatmapCalculator = heatmapCalculator || new HeatmapCalculator();
  }

  /**
   * Get performance metrics from database
   * @param {number|null} tournamentId - Optional tournament filter
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Performance metrics (white, black, overall stats)
   */
  async getPerformanceMetrics(tournamentId, userId) {
    const performanceData = await this.database.getPerformanceMetrics(tournamentId, userId);
    return performanceData;
  }

  /**
   * Calculate overall player performance from all games
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Overall player performance stats
   */
  async getPlayerPerformance(userId) {
    // Get all games for the target player
    const games = await this.database.all(`
      SELECT id, white_player, black_player, result, white_elo, black_elo
      FROM games
      WHERE white_player = ? OR black_player = ?
      ORDER BY created_at ASC
    `, [TARGET_PLAYER, TARGET_PLAYER]);

    let totalWins = 0, totalLosses = 0, totalDraws = 0;
    let whiteWins = 0, whiteLosses = 0, whiteDraws = 0, whiteGames = 0;
    let blackWins = 0, blackLosses = 0, blackDraws = 0, blackGames = 0;
    let totalBlunders = 0, totalCentipawnLoss = 0, totalMoves = 0;

    for (const game of games) {
      const isPlayerWhite = game.white_player === TARGET_PLAYER;
      const isPlayerBlack = game.black_player === TARGET_PLAYER;

      // Count games by color
      if (isPlayerWhite) whiteGames++;
      if (isPlayerBlack) blackGames++;

      // Calculate results
      if (game.result === '1/2-1/2') {
        totalDraws++;
        if (isPlayerWhite) whiteDraws++;
        if (isPlayerBlack) blackDraws++;
      } else if (
        (isPlayerWhite && game.result === '1-0') ||
        (isPlayerBlack && game.result === '0-1')
      ) {
        totalWins++;
        if (isPlayerWhite) whiteWins++;
        if (isPlayerBlack) blackWins++;
      } else {
        totalLosses++;
        if (isPlayerWhite) whiteLosses++;
        if (isPlayerBlack) blackLosses++;
      }

      // Get analysis data for this game
      const analysis = await this.database.all(`
        SELECT centipawn_loss, move_number
        FROM analysis
        WHERE game_id = ?
        ORDER BY move_number
      `, [game.id]);

      // Filter moves for the target player
      const playerMoves = analysis.filter(move =>
        (isPlayerWhite && move.move_number % 2 === 1) ||
        (isPlayerBlack && move.move_number % 2 === 0)
      );

      // Count blunders from blunder_details table
      const blunderCount = await this.database.get(`
        SELECT COUNT(*) as count
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.game_id = ?
          AND bd.is_blunder = ?
          AND ((g.white_player = ? AND bd.player_color = 'white')
            OR (g.black_player = ? AND bd.player_color = 'black'))
      `, [game.id, true, TARGET_PLAYER, TARGET_PLAYER]);

      totalBlunders += parseInt(blunderCount?.count) || 0;
      totalCentipawnLoss += playerMoves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0);
      totalMoves += playerMoves.length;
    }

    const totalGames = games.length;
    const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
    const whiteWinRate = whiteGames > 0 ? Math.round((whiteWins / whiteGames) * 100) : 0;
    const blackWinRate = blackGames > 0 ? Math.round((blackWins / blackGames) * 100) : 0;
    // const avgCentipawnLoss = totalMoves > 0 ? Math.round(totalCentipawnLoss / totalMoves) : 0;

    // Calculate accuracy using centralized calculator
    const gamesWithAnalysis = [];
    for (const game of games) {
      const analysis = await this.database.all(`
        SELECT centipawn_loss, move_number
        FROM analysis 
        WHERE game_id = ?
        ORDER BY move_number
      `, [game.id]);
      
      if (analysis.length > 0) {
        gamesWithAnalysis.push({
          ...game,
          analysis
        });
      }
    }

    const avgAccuracy = AccuracyCalculator.calculateOverallAccuracy(gamesWithAnalysis, TARGET_PLAYER);

    return {
      overall: {
        overallWinRate,
        avgAccuracy,
        totalGames,
        totalBlunders
      },
      white: {
        games: whiteGames,
        wins: whiteWins,
        losses: whiteLosses,
        draws: whiteDraws,
        winRate: whiteWinRate,
        avgAccuracy,
        blunders: Math.round(totalBlunders * (whiteGames / totalGames))
      },
      black: {
        games: blackGames,
        wins: blackWins,
        losses: blackLosses,
        draws: blackDraws,
        winRate: blackWinRate,
        avgAccuracy,
        blunders: Math.round(totalBlunders * (blackGames / totalGames))
      }
    };
  }

  /**
   * Get weekly performance trends
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Trends data (rating, centipawn loss, summary)
   */
  async getTrendsData(userId) {
    const games = await this.database.all(`
      SELECT g.*,
             AVG(a.centipawn_loss) as avgCentipawnLoss,
             COUNT(a.id) as moveCount
      FROM games g
      LEFT JOIN analysis a ON g.id = a.game_id
      GROUP BY g.id
      ORDER BY g.date ASC
    `);

    if (games.length === 0) {
      return null;
    }

    // Convert database games to trend calculator format
    const trendGames = games.map(game => {
      // Determine which rating belongs to the target player
      const isWhite = game.white_player?.toLowerCase() === TARGET_PLAYER.toLowerCase();
      const isBlack = game.black_player?.toLowerCase() === TARGET_PLAYER.toLowerCase();

      let playerRating = null;
      let opponentRating = null;

      if (isWhite) {
        playerRating = game.white_elo;
        opponentRating = game.black_elo;
      } else if (isBlack) {
        playerRating = game.black_elo;
        opponentRating = game.white_elo;
      }

      return {
        date: new Date(game.date || game.created_at),
        playerRating: playerRating,
        opponentRating: opponentRating,
        whiteElo: game.white_elo,
        blackElo: game.black_elo,
        result: game.result,
        avgCentipawnLoss: game.avgCentipawnLoss || 0,
        moveCount: game.moveCount || 0,
        moves: []
      };
    });

    const ratingProgression = this.trendCalculator.calculateRatingProgression(trendGames);
    const centipawnTrend = this.trendCalculator.calculateCentipawnLossTrend(trendGames);

    return {
      ratingProgression: ratingProgression,
      centipawnTrend: centipawnTrend,
      summary: this.trendCalculator.generateTrendSummary(ratingProgression, centipawnTrend),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get rating progression trend
   * @param {number|null} tournamentId - Optional tournament filter
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Rating trend data
   */
  async getRatingTrends(tournamentId, userId) {
    const tournamentFilter = tournamentId ? 'AND g.tournament_id = ?' : '';
    const params = tournamentId ? [TARGET_PLAYER, TARGET_PLAYER, tournamentId] : [TARGET_PLAYER, TARGET_PLAYER];

    const games = await this.database.all(`
      SELECT g.id, g.date, g.white_elo, g.black_elo, g.white_player, g.black_player
      FROM games g
      WHERE (g.white_player = ? OR g.black_player = ?) ${tournamentFilter}
      ORDER BY g.date ASC
    `, params);

    // Filter games with actual ratings and track rating progression
    const ratedGames = games.filter(game => {
      const playerRating = game.white_player === TARGET_PLAYER ? game.white_elo : game.black_elo;
      return playerRating && playerRating > 0;
    });

    const data = ratedGames.map((game, index) => ({
      gameNumber: index + 1,
      rating: game.white_player === TARGET_PLAYER ? game.white_elo : game.black_elo,
      date: game.date
    }));

    return { data };
  }

  /**
   * Get centipawn loss progression trend
   * @param {number|null} tournamentId - Optional tournament filter
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Centipawn loss trend data
   */
  async getCentipawnLossTrends(tournamentId, userId) {
    const tournamentFilter = tournamentId ? 'AND g.tournament_id = ?' : '';
    const params = tournamentId ? [TARGET_PLAYER, TARGET_PLAYER, tournamentId] : [TARGET_PLAYER, TARGET_PLAYER];

    const games = await this.database.all(`
      SELECT g.id, AVG(a.centipawn_loss) as avg_centipawn_loss
      FROM games g
      JOIN analysis a ON g.id = a.game_id
      WHERE (g.white_player = ? OR g.black_player = ?) ${tournamentFilter}
      GROUP BY g.id
      ORDER BY g.date ASC
    `, params);

    const data = games.map((game, index) => ({
      gameNumber: index + 1,
      avgCentipawnLoss: Math.round(game.avg_centipawn_loss || 0)
    }));

    return { data };
  }

  /**
   * Generate heatmap from blunder data
   * @param {string} userId - User ID
   * @param {number|null} tournamentId - Optional tournament filter
   * @returns {Promise<Object>} Heatmap data with problematic squares
   */
  async generateHeatmap(userId, tournamentId = null) {
    // Get blunder details from database
    const tournamentFilter = tournamentId ? 'AND g.tournament_id = ?' : '';
    const params = tournamentId ? [TARGET_PLAYER, TARGET_PLAYER, tournamentId] : [TARGET_PLAYER, TARGET_PLAYER];

    const blunders = await this.database.all(`
      SELECT bd.square, bd.severity, bd.move_san
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE (g.white_player = ? OR g.black_player = ?) ${tournamentFilter}
        AND bd.is_blunder = 1
    `, params);

    if (blunders.length === 0) {
      return { heatmap: [], problematicSquares: [] };
    }

    // Format for HeatmapCalculator
    const games = [{
      blunders: blunders.map(b => ({
        square: b.square,
        severity: b.severity || 1,
        move: b.move_san
      }))
    }];

    const heatmap = this.heatmapCalculator.calculateHeatmap(games);
    const problematicSquares = this.heatmapCalculator.getMostProblematicSquares();

    return { heatmap, problematicSquares };
  }

  /**
   * Get games list with opening detection
   * @param {string} userId - User ID
   * @param {number} limit - Number of games to return
   * @param {number|null} tournamentId - Optional tournament filter
   * @returns {Promise<Array>} Games with opening names
   */
  async getGamesList(userId, limit = 50, tournamentId = null) {
    const tournamentFilter = tournamentId ? 'WHERE tournament_id = ?' : '';
    const params = tournamentId ? [tournamentId] : [];

    const games = await this.database.all(`
      SELECT
        id, white_player, black_player, result, date, event,
        white_elo, black_elo, moves_count, created_at, pgn_content
      FROM games
      ${tournamentFilter}
      ORDER BY created_at DESC
      LIMIT ?
    `, [...params, limit]);

    // Add opening extraction to each game
    const gamesWithOpenings = await Promise.all(games.map(async (game) => {
      let opening = null;
      if (game.pgn_content) {
        // Try to get ECO from PGN headers first
        const ecoMatch = game.pgn_content.match(/\[ECO "([^"]+)"\]/);
        if (ecoMatch) {
          const ecoCode = ecoMatch[1];
          opening = await this.getOpeningName(ecoCode);
        } else {
          // Fallback: Detect opening from moves
          const openingDetector = require('../models/opening-detector');
          const detected = openingDetector.detect(game.pgn_content);
          if (detected) {
            opening = detected.name;
          }
        }
      }

      return {
        ...game,
        opening: opening || 'Unknown Opening'
      };
    }));

    return gamesWithOpenings;
  }

  /**
   * Helper: Get opening name from ECO code
   * @param {string} ecoCode - ECO code (e.g., "C42")
   * @returns {Promise<string|null>} Opening name
   */
  async getOpeningName(ecoCode) {
    const opening = await this.database.get(`
      SELECT name FROM chess_openings WHERE eco_code = ?
    `, [ecoCode]);
    return opening ? opening.name : null;
  }
}

module.exports = DashboardService;
