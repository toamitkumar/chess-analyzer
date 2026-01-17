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
    // Get all games for the user
    const games = await this.database.all(`
      SELECT id, user_color, result, white_elo, black_elo, created_at
      FROM games
      WHERE user_id = ?
      ORDER BY created_at ASC
    `, [userId]);

    let totalWins = 0, totalLosses = 0, totalDraws = 0;
    let whiteWins = 0, whiteLosses = 0, whiteDraws = 0, whiteGames = 0;
    let blackWins = 0, blackLosses = 0, blackDraws = 0, blackGames = 0;
    let totalBlunders = 0, totalCentipawnLoss = 0, totalMoves = 0;

    for (const game of games) {
      const isPlayerWhite = game.user_color === 'white';
      const isPlayerBlack = game.user_color === 'black';

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

      // Filter moves for the user (based on their color in this game)
      const playerMoves = analysis.filter(move =>
        (isPlayerWhite && move.move_number % 2 === 1) ||
        (isPlayerBlack && move.move_number % 2 === 0)
      );

      // Count blunders using centralized BlunderService
      const blunderCount = await this.blunderService.getBlunderCountForGame(game.id, game.user_color);

      totalBlunders += blunderCount;
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
          analysis,
          // For AccuracyCalculator compatibility
          white_player: game.user_color === 'white' ? 'user' : 'opponent',
          black_player: game.user_color === 'black' ? 'user' : 'opponent'
        });
      }
    }

    const avgAccuracy = AccuracyCalculator.calculateOverallAccuracy(gamesWithAnalysis, 'user');

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
      WHERE g.user_id = ?
      GROUP BY g.id
      ORDER BY g.date ASC
    `, [userId]);

    if (games.length === 0) {
      return null;
    }

    // Convert database games to trend calculator format
    const trendGames = games.map(game => {
      // Determine which rating belongs to the user based on their color
      const isWhite = game.user_color === 'white';
      const isBlack = game.user_color === 'black';

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
    const games = await this.database.all(`
      SELECT g.id, g.date, g.white_elo, g.black_elo, g.user_color
      FROM games g
      WHERE g.user_id = ? ${tournamentId ? 'AND g.tournament_id = ?' : ''}
      ORDER BY g.date ASC
    `, tournamentId ? [userId, tournamentId] : [userId]);

    // Filter games with actual ratings and track rating progression
    const ratedGames = games.filter(game => {
      const playerRating = game.user_color === 'white' ? game.white_elo : game.black_elo;
      return playerRating && playerRating > 0;
    });

    const data = ratedGames.map((game, index) => ({
      gameNumber: index + 1,
      rating: game.user_color === 'white' ? game.white_elo : game.black_elo,
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
    const games = await this.database.all(`
      SELECT g.id, AVG(a.centipawn_loss) as avg_centipawn_loss
      FROM games g
      JOIN analysis a ON g.id = a.game_id
      WHERE g.user_id = ? ${tournamentId ? 'AND g.tournament_id = ?' : ''}
      GROUP BY g.id
      ORDER BY g.date ASC
    `, tournamentId ? [userId, tournamentId] : [userId]);

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
    const blunders = await this.database.all(`
      SELECT bd.square, bd.severity, bd.move_san
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE g.user_id = ? ${tournamentId ? 'AND g.tournament_id = ?' : ''}
        AND bd.is_blunder = 1
    `, tournamentId ? [userId, tournamentId] : [userId]);

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
      SELECT opening_name FROM chess_openings WHERE eco_code = ?
    `, [ecoCode]);
    return opening ? opening.opening_name : null;
  }

  // ============================================
  // Chess.com Insights Dashboard Methods (ADR 009)
  // ============================================

  /**
   * Get accuracy breakdown by game result (win/draw/loss)
   * Chess.com Insights Feature: Average Accuracy Overview
   * @param {string} userId - User ID
   * @param {string|null} color - Optional filter by player color ('white' or 'black')
   * @returns {Promise<Object>} Accuracy stats grouped by result
   */
  async getAccuracyByResult(userId, color = null) {
    // Get all games with analysis for the user
    let query = `
      SELECT g.id, g.result, g.user_color
      FROM games g
      WHERE g.user_id = ?
    `;
    const params = [userId];

    if (color) {
      query += ' AND g.user_color = ?';
      params.push(color);
    }

    const games = await this.database.all(query, params);

    if (games.length === 0) {
      return {
        overall: { accuracy: 0, games: 0 },
        wins: { accuracy: 0, games: 0 },
        draws: { accuracy: 0, games: 0 },
        losses: { accuracy: 0, games: 0 }
      };
    }

    // Categorize games by result
    const categorizedGames = {
      wins: [],
      draws: [],
      losses: []
    };

    for (const game of games) {
      const isPlayerWhite = game.user_color === 'white';
      const isPlayerBlack = game.user_color === 'black';

      // Determine game outcome for the player
      let outcome;
      if (game.result === '1/2-1/2') {
        outcome = 'draws';
      } else if (
        (isPlayerWhite && game.result === '1-0') ||
        (isPlayerBlack && game.result === '0-1')
      ) {
        outcome = 'wins';
      } else {
        outcome = 'losses';
      }

      categorizedGames[outcome].push(game);
    }

    // Calculate accuracy for each category
    const calculateCategoryAccuracy = async (categoryGames) => {
      if (categoryGames.length === 0) {
        return { accuracy: 0, games: 0 };
      }

      let totalCentipawnLoss = 0;
      let totalMoves = 0;

      for (const game of categoryGames) {
        const analysis = await this.database.all(`
          SELECT centipawn_loss, move_number
          FROM analysis
          WHERE game_id = ?
          ORDER BY move_number
        `, [game.id]);

        const isPlayerWhite = game.user_color === 'white';
        const playerMoves = analysis.filter(move =>
          (isPlayerWhite && move.move_number % 2 === 1) ||
          (!isPlayerWhite && move.move_number % 2 === 0)
        );

        totalCentipawnLoss += playerMoves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0);
        totalMoves += playerMoves.length;
      }

      const avgCentipawnLoss = totalMoves > 0 ? totalCentipawnLoss / totalMoves : 0;
      const accuracy = AccuracyCalculator.calculateAccuracy(avgCentipawnLoss);

      return {
        accuracy,
        games: categoryGames.length,
        avgCentipawnLoss: Math.round(avgCentipawnLoss)
      };
    };

    const [winsStats, drawsStats, lossesStats] = await Promise.all([
      calculateCategoryAccuracy(categorizedGames.wins),
      calculateCategoryAccuracy(categorizedGames.draws),
      calculateCategoryAccuracy(categorizedGames.losses)
    ]);

    // Calculate overall accuracy
    const overallStats = await calculateCategoryAccuracy(games);

    return {
      overall: overallStats,
      wins: winsStats,
      draws: drawsStats,
      losses: lossesStats
    };
  }

  /**
   * Get distribution of which game phase games typically end in
   * Chess.com Insights Feature: Game Phases Analysis
   * @param {string} userId - User ID
   * @param {string|null} color - Optional filter by player color ('white' or 'black')
   * @returns {Promise<Object>} Phase distribution statistics
   */
  async getPhaseDistribution(userId, color = null) {
    // Phase definitions (matching existing implementation)
    const PHASE_BOUNDARIES = {
      opening: { start: 1, end: 10 },
      middlegame: { start: 11, end: 30 },
      endgame: { start: 31, end: Infinity }
    };

    let query = `
      SELECT g.id, g.moves_count, g.user_color
      FROM games g
      WHERE g.user_id = ?
    `;
    const params = [userId];

    if (color) {
      query += ' AND g.user_color = ?';
      params.push(color);
    }

    const games = await this.database.all(query, params);

    if (games.length === 0) {
      return {
        overall: {
          opening: { count: 0, percentage: 0 },
          middlegame: { count: 0, percentage: 0 },
          endgame: { count: 0, percentage: 0 }
        },
        totalGames: 0
      };
    }

    // Determine which phase each game ended in
    const phaseCounts = { opening: 0, middlegame: 0, endgame: 0 };

    for (const game of games) {
      const movesCount = game.moves_count || 0;
      // Each move_count represents half-moves (plies), so divide by 2 for full moves
      const fullMoves = Math.ceil(movesCount / 2);

      if (fullMoves <= PHASE_BOUNDARIES.opening.end) {
        phaseCounts.opening++;
      } else if (fullMoves <= PHASE_BOUNDARIES.middlegame.end) {
        phaseCounts.middlegame++;
      } else {
        phaseCounts.endgame++;
      }
    }

    const totalGames = games.length;

    return {
      overall: {
        opening: {
          count: phaseCounts.opening,
          percentage: Math.round((phaseCounts.opening / totalGames) * 100)
        },
        middlegame: {
          count: phaseCounts.middlegame,
          percentage: Math.round((phaseCounts.middlegame / totalGames) * 100)
        },
        endgame: {
          count: phaseCounts.endgame,
          percentage: Math.round((phaseCounts.endgame / totalGames) * 100)
        }
      },
      totalGames
    };
  }

  /**
   * Get aggregate accuracy by game phase across all games
   * Chess.com Insights Feature: Accuracy by Game Phase
   * @param {string} userId - User ID
   * @param {string|null} color - Optional filter by player color ('white' or 'black')
   * @returns {Promise<Object>} Accuracy by phase
   */
  async getAccuracyByPhase(userId, color = null) {
    // Try to use pre-computed phase_stats first
    let query = `
      SELECT ps.*, g.user_color
      FROM phase_stats ps
      JOIN games g ON ps.game_id = g.id
      WHERE g.user_id = ?
    `;
    const params = [userId];

    if (color) {
      query += ' AND g.user_color = ?';
      params.push(color);
    }

    const phaseStats = await this.database.all(query, params);

    if (phaseStats.length > 0) {
      // Use pre-computed stats
      let openingTotal = 0, middlegameTotal = 0, endgameTotal = 0;
      let openingCount = 0, middlegameCount = 0, endgameCount = 0;

      for (const stat of phaseStats) {
        if (stat.opening_accuracy > 0) {
          openingTotal += stat.opening_accuracy;
          openingCount++;
        }
        if (stat.middlegame_accuracy > 0) {
          middlegameTotal += stat.middlegame_accuracy;
          middlegameCount++;
        }
        if (stat.endgame_accuracy > 0) {
          endgameTotal += stat.endgame_accuracy;
          endgameCount++;
        }
      }

      return {
        opening: {
          accuracy: openingCount > 0 ? Math.round(openingTotal / openingCount) : 0,
          gamesWithData: openingCount
        },
        middlegame: {
          accuracy: middlegameCount > 0 ? Math.round(middlegameTotal / middlegameCount) : 0,
          gamesWithData: middlegameCount
        },
        endgame: {
          accuracy: endgameCount > 0 ? Math.round(endgameTotal / endgameCount) : 0,
          gamesWithData: endgameCount
        },
        totalGames: phaseStats.length
      };
    }

    // Fallback: Calculate from raw analysis data
    const PHASE_BOUNDARIES = {
      opening: { start: 1, end: 10 },
      middlegame: { start: 11, end: 30 },
      endgame: { start: 31, end: Infinity }
    };

    let gamesQuery = `
      SELECT g.id, g.user_color
      FROM games g
      WHERE g.user_id = ?
    `;
    const gamesParams = [userId];

    if (color) {
      gamesQuery += ' AND g.user_color = ?';
      gamesParams.push(color);
    }

    const games = await this.database.all(gamesQuery, gamesParams);

    if (games.length === 0) {
      return {
        opening: { accuracy: 0, gamesWithData: 0 },
        middlegame: { accuracy: 0, gamesWithData: 0 },
        endgame: { accuracy: 0, gamesWithData: 0 },
        totalGames: 0
      };
    }

    const phaseAccumulator = {
      opening: { totalCpl: 0, moveCount: 0, gamesWithData: 0 },
      middlegame: { totalCpl: 0, moveCount: 0, gamesWithData: 0 },
      endgame: { totalCpl: 0, moveCount: 0, gamesWithData: 0 }
    };

    for (const game of games) {
      const analysis = await this.database.all(`
        SELECT centipawn_loss, move_number
        FROM analysis
        WHERE game_id = ?
        ORDER BY move_number
      `, [game.id]);

      const isPlayerWhite = game.user_color === 'white';
      const playerMoves = analysis.filter(move =>
        (isPlayerWhite && move.move_number % 2 === 1) ||
        (!isPlayerWhite && move.move_number % 2 === 0)
      );

      // Group moves by phase
      const gamePhaseData = { opening: [], middlegame: [], endgame: [] };

      for (const move of playerMoves) {
        // Convert half-move number to full move number
        const fullMoveNumber = Math.ceil(move.move_number / 2);

        if (fullMoveNumber <= PHASE_BOUNDARIES.opening.end) {
          gamePhaseData.opening.push(move);
        } else if (fullMoveNumber <= PHASE_BOUNDARIES.middlegame.end) {
          gamePhaseData.middlegame.push(move);
        } else {
          gamePhaseData.endgame.push(move);
        }
      }

      // Accumulate phase data
      for (const phase of ['opening', 'middlegame', 'endgame']) {
        if (gamePhaseData[phase].length > 0) {
          const phaseCpl = gamePhaseData[phase].reduce((sum, m) => sum + (m.centipawn_loss || 0), 0);
          phaseAccumulator[phase].totalCpl += phaseCpl;
          phaseAccumulator[phase].moveCount += gamePhaseData[phase].length;
          phaseAccumulator[phase].gamesWithData++;
        }
      }
    }

    // Calculate final accuracies
    const result = {};
    for (const phase of ['opening', 'middlegame', 'endgame']) {
      const acc = phaseAccumulator[phase];
      const avgCpl = acc.moveCount > 0 ? acc.totalCpl / acc.moveCount : 0;
      result[phase] = {
        accuracy: AccuracyCalculator.calculateAccuracy(avgCpl),
        gamesWithData: acc.gamesWithData,
        avgCentipawnLoss: Math.round(avgCpl)
      };
    }

    result.totalGames = games.length;
    return result;
  }

  /**
   * Get performance statistics for most frequently played openings
   * Chess.com Insights Feature: Opening Performance Analysis
   * @param {string} userId - User ID
   * @param {number} limit - Number of top openings to return (default: 10)
   * @param {string|null} color - Optional filter by player color ('white' or 'black')
   * @returns {Promise<Array>} Top openings with W/D/L stats
   */
  async getOpeningPerformance(userId, limit = 10, color = null) {
    // Try to use opening_analysis table first (has ECO codes)
    let query = `
      SELECT
        oa.eco_code,
        oa.opening_name,
        g.result,
        g.user_color,
        g.id as game_id
      FROM opening_analysis oa
      JOIN games g ON oa.game_id = g.id
      WHERE g.user_id = ?
    `;
    const params = [userId];

    if (color) {
      query += ' AND g.user_color = ?';
      params.push(color);
    }

    const openingGames = await this.database.all(query, params);

    // If no data in opening_analysis, try to detect from PGN
    if (openingGames.length === 0) {
      return await this.getOpeningPerformanceFromPGN(userId, limit, color);
    }

    // Aggregate by opening
    const openingMap = new Map();

    for (const game of openingGames) {
      const key = game.eco_code || 'Unknown';
      const isPlayerWhite = game.user_color === 'white';

      if (!openingMap.has(key)) {
        openingMap.set(key, {
          ecoCode: game.eco_code,
          name: game.opening_name || 'Unknown Opening',
          games: 0,
          wins: 0,
          draws: 0,
          losses: 0
        });
      }

      const stats = openingMap.get(key);
      stats.games++;

      if (game.result === '1/2-1/2') {
        stats.draws++;
      } else if (
        (isPlayerWhite && game.result === '1-0') ||
        (!isPlayerWhite && game.result === '0-1')
      ) {
        stats.wins++;
      } else {
        stats.losses++;
      }
    }

    // Convert to array and sort by games played
    const openings = Array.from(openingMap.values())
      .map(opening => ({
        ...opening,
        winRate: opening.games > 0 ? Math.round((opening.wins / opening.games) * 100) : 0,
        drawRate: opening.games > 0 ? Math.round((opening.draws / opening.games) * 100) : 0,
        lossRate: opening.games > 0 ? Math.round((opening.losses / opening.games) * 100) : 0
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, limit);

    return openings;
  }

  /**
   * Helper: Get opening performance from PGN content when opening_analysis is empty
   * @private
   */
  async getOpeningPerformanceFromPGN(userId, limit = 10, color = null) {
    const openingDetector = require('../models/opening-detector');

    let query = `
      SELECT g.id, g.pgn_content, g.result, g.user_color
      FROM games g
      WHERE g.user_id = ? AND g.pgn_content IS NOT NULL
    `;
    const params = [userId];

    if (color) {
      query += ' AND g.user_color = ?';
      params.push(color);
    }

    const games = await this.database.all(query, params);

    const openingMap = new Map();

    for (const game of games) {
      // Try to get ECO from PGN headers
      let ecoCode = null;
      let openingName = null;

      const ecoMatch = game.pgn_content.match(/\[ECO "([^"]+)"\]/);
      if (ecoMatch) {
        ecoCode = ecoMatch[1];
        openingName = await this.getOpeningName(ecoCode);
      }

      // Fallback: detect from moves
      if (!openingName) {
        const detected = openingDetector.detect(game.pgn_content);
        if (detected) {
          ecoCode = detected.eco || 'Unknown';
          openingName = detected.name;
        }
      }

      if (!openingName) {
        openingName = 'Unknown Opening';
        ecoCode = 'Unknown';
      }

      const key = ecoCode;
      const isPlayerWhite = game.user_color === 'white';

      if (!openingMap.has(key)) {
        openingMap.set(key, {
          ecoCode,
          name: openingName,
          games: 0,
          wins: 0,
          draws: 0,
          losses: 0
        });
      }

      const stats = openingMap.get(key);
      stats.games++;

      if (game.result === '1/2-1/2') {
        stats.draws++;
      } else if (
        (isPlayerWhite && game.result === '1-0') ||
        (!isPlayerWhite && game.result === '0-1')
      ) {
        stats.wins++;
      } else {
        stats.losses++;
      }
    }

    // Convert to array and sort by games played
    const openings = Array.from(openingMap.values())
      .map(opening => ({
        ...opening,
        winRate: opening.games > 0 ? Math.round((opening.wins / opening.games) * 100) : 0,
        drawRate: opening.games > 0 ? Math.round((opening.draws / opening.games) * 100) : 0,
        lossRate: opening.games > 0 ? Math.round((opening.losses / opening.games) * 100) : 0
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, limit);

    return openings;
  }
}

module.exports = DashboardService;
