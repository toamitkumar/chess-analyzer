/**
 * Dashboard Service
 *
 * Orchestrates dashboard data retrieval and aggregation.
 * Uses centralized services (BlunderService) and calculator classes for consistency.
 * Handles database queries and data transformation for dashboard endpoints.
 */

const { getDatabase } = require('../models/database');
const TrendCalculator = require('../models/trend-calculator');
const HeatmapCalculator = require('../models/HeatmapCalculator');
const AccuracyCalculator = require('../models/accuracy-calculator');
const BlunderService = require('./BlunderService');

class DashboardService {
  constructor({ database = null, trendCalculator = null, heatmapCalculator = null, blunderService = null } = {}) {
    this.database = database || getDatabase();
    this.trendCalculator = trendCalculator || new TrendCalculator();
    this.heatmapCalculator = heatmapCalculator || new HeatmapCalculator();
    this.blunderService = blunderService || new BlunderService(this.database);
  }

  /**
   * Get performance metrics from database
   */
  async getPerformanceMetrics(tournamentId, userId) {
    return this.database.getPerformanceMetrics(tournamentId, userId);
  }

  /**
   * Calculate overall player performance from all games
   */
  async getPlayerPerformance(userId) {
    const games = await this.database.all(`
      SELECT id, user_color, result, white_elo, black_elo, created_at
      FROM games WHERE user_id = ? ORDER BY created_at ASC
    `, [userId]);

    let totalWins = 0, totalLosses = 0, totalDraws = 0;
    let whiteWins = 0, whiteLosses = 0, whiteDraws = 0, whiteGames = 0;
    let blackWins = 0, blackLosses = 0, blackDraws = 0, blackGames = 0;
    let totalBlunders = 0, totalCentipawnLoss = 0, totalMoves = 0;

    for (const game of games) {
      const isPlayerWhite = game.user_color === 'white';
      const isPlayerBlack = game.user_color === 'black';

      if (isPlayerWhite) whiteGames++;
      if (isPlayerBlack) blackGames++;

      if (game.result === '1/2-1/2') {
        totalDraws++;
        if (isPlayerWhite) whiteDraws++;
        if (isPlayerBlack) blackDraws++;
      } else if ((isPlayerWhite && game.result === '1-0') || (isPlayerBlack && game.result === '0-1')) {
        totalWins++;
        if (isPlayerWhite) whiteWins++;
        if (isPlayerBlack) blackWins++;
      } else {
        totalLosses++;
        if (isPlayerWhite) whiteLosses++;
        if (isPlayerBlack) blackLosses++;
      }

      const analysis = await this.database.all(`
        SELECT centipawn_loss, move_number FROM analysis WHERE game_id = ? ORDER BY move_number
      `, [game.id]);

      const playerMoves = analysis.filter(move =>
        (isPlayerWhite && move.move_number % 2 === 1) || (isPlayerBlack && move.move_number % 2 === 0)
      );

      const blunderCount = await this.blunderService.getBlunderCountForGame(game.id, game.user_color);
      totalBlunders += blunderCount;
      totalCentipawnLoss += playerMoves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0);
      totalMoves += playerMoves.length;
    }

    const totalGames = games.length;
    const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
    const whiteWinRate = whiteGames > 0 ? Math.round((whiteWins / whiteGames) * 100) : 0;
    const blackWinRate = blackGames > 0 ? Math.round((blackWins / blackGames) * 100) : 0;

    const gamesWithAnalysis = [];
    for (const game of games) {
      const analysis = await this.database.all(`
        SELECT centipawn_loss, move_number FROM analysis WHERE game_id = ? ORDER BY move_number
      `, [game.id]);
      if (analysis.length > 0) {
        gamesWithAnalysis.push({
          ...game, analysis,
          white_player: game.user_color === 'white' ? 'user' : 'opponent',
          black_player: game.user_color === 'black' ? 'user' : 'opponent'
        });
      }
    }

    const avgAccuracy = AccuracyCalculator.calculateOverallAccuracy(gamesWithAnalysis, 'user');

    return {
      overall: { overallWinRate, avgAccuracy, totalGames, totalBlunders },
      white: { games: whiteGames, wins: whiteWins, losses: whiteLosses, draws: whiteDraws, winRate: whiteWinRate, avgAccuracy, blunders: Math.round(totalBlunders * (whiteGames / totalGames)) },
      black: { games: blackGames, wins: blackWins, losses: blackLosses, draws: blackDraws, winRate: blackWinRate, avgAccuracy, blunders: Math.round(totalBlunders * (blackGames / totalGames)) }
    };
  }

  /**
   * Get weekly performance trends
   */
  async getTrendsData(userId) {
    const games = await this.database.all(`
      SELECT g.*, AVG(a.centipawn_loss) as avgCentipawnLoss, COUNT(a.id) as moveCount
      FROM games g LEFT JOIN analysis a ON g.id = a.game_id
      WHERE g.user_id = ? GROUP BY g.id ORDER BY g.date ASC
    `, [userId]);

    if (games.length === 0) return null;

    const trendGames = games.map(game => {
      const isWhite = game.user_color === 'white';
      return {
        date: new Date(game.date || game.created_at),
        playerRating: isWhite ? game.white_elo : game.black_elo,
        opponentRating: isWhite ? game.black_elo : game.white_elo,
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
      ratingProgression,
      centipawnTrend,
      summary: this.trendCalculator.generateTrendSummary(ratingProgression, centipawnTrend),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get rating progression trend
   */
  async getRatingTrends(tournamentId, userId) {
    const games = await this.database.all(`
      SELECT g.id, g.date, g.white_elo, g.black_elo, g.user_color
      FROM games g WHERE g.user_id = ? ${tournamentId ? 'AND g.tournament_id = ?' : ''} ORDER BY g.date ASC
    `, tournamentId ? [userId, tournamentId] : [userId]);

    const ratedGames = games.filter(game => {
      const playerRating = game.user_color === 'white' ? game.white_elo : game.black_elo;
      return playerRating && playerRating > 0;
    });

    return {
      data: ratedGames.map((game, index) => ({
        gameNumber: index + 1,
        rating: game.user_color === 'white' ? game.white_elo : game.black_elo,
        date: game.date
      }))
    };
  }

  /**
   * Get centipawn loss progression trend
   */
  async getCentipawnLossTrends(tournamentId, userId) {
    const games = await this.database.all(`
      SELECT g.id, AVG(a.centipawn_loss) as avg_centipawn_loss
      FROM games g JOIN analysis a ON g.id = a.game_id
      WHERE g.user_id = ? ${tournamentId ? 'AND g.tournament_id = ?' : ''} GROUP BY g.id ORDER BY g.date ASC
    `, tournamentId ? [userId, tournamentId] : [userId]);

    return {
      data: games.map((game, index) => ({
        gameNumber: index + 1,
        avgCentipawnLoss: Math.round(game.avg_centipawn_loss || 0)
      }))
    };
  }

  /**
   * Generate heatmap from blunder data
   */
  async generateHeatmap(userId, tournamentId = null) {
    const blunders = await this.database.all(`
      SELECT bd.square, bd.severity, bd.move_san
      FROM blunder_details bd JOIN games g ON bd.game_id = g.id
      WHERE g.user_id = ? ${tournamentId ? 'AND g.tournament_id = ?' : ''} AND bd.is_blunder = 1
    `, tournamentId ? [userId, tournamentId] : [userId]);

    if (blunders.length === 0) return { heatmap: [], problematicSquares: [] };

    const games = [{ blunders: blunders.map(b => ({ square: b.square, severity: b.severity || 1, move: b.move_san })) }];
    const heatmap = this.heatmapCalculator.calculateHeatmap(games);
    const problematicSquares = this.heatmapCalculator.getMostProblematicSquares();

    return { heatmap, problematicSquares };
  }

  /**
   * Get games list with opening detection
   */
  async getGamesList(userId, limit = 50, tournamentId = null) {
    const tournamentFilter = tournamentId ? 'WHERE tournament_id = ?' : '';
    const params = tournamentId ? [tournamentId] : [];

    const games = await this.database.all(`
      SELECT id, white_player, black_player, result, date, event, white_elo, black_elo, moves_count, created_at, pgn_content
      FROM games ${tournamentFilter} ORDER BY created_at DESC LIMIT ?
    `, [...params, limit]);

    const gamesWithOpenings = await Promise.all(games.map(async (game) => {
      let opening = null;
      if (game.pgn_content) {
        const ecoMatch = game.pgn_content.match(/\[ECO "([^"]+)"\]/);
        if (ecoMatch) {
          const ecoCode = ecoMatch[1];
          const openingRow = await this.database.get(`SELECT opening_name FROM chess_openings WHERE eco_code = ?`, [ecoCode]);
          opening = openingRow?.opening_name;
        }
        if (!opening) {
          const openingDetector = require('../models/opening-detector');
          const detected = openingDetector.detect(game.pgn_content);
          if (detected) opening = detected.name;
        }
      }
      return { ...game, opening: opening || 'Unknown Opening' };
    }));

    return gamesWithOpenings;
  }
}

module.exports = DashboardService;
