/**
 * Insights Service
 *
 * Handles all chess insights analytics - accuracy by result, phase distribution,
 * accuracy by phase, opening performance, and tactical patterns.
 * 
 * Reference: ADR 009 - Chess.com Insights Dashboard
 */

const { getDatabase } = require('../models/database');
const TacticalOpportunityService = require('./TacticalOpportunityService');
const OpponentBlunderService = require('./OpponentBlunderService');

class InsightsService {
  constructor(database = null) {
    this.database = database || getDatabase();
  }

  /**
   * Get accuracy breakdown by game result (win/draw/loss)
   * @param {string} userId - User ID
   * @param {string|null} color - Optional filter by player color ('white' or 'black')
   * @returns {Promise<Object>} Accuracy stats grouped by result
   */
  async getAccuracyByResult(userId, color = null) {
    let query = `
      SELECT 
        g.result,
        g.user_color,
        COUNT(*) as games,
        AVG(ps.opening_accuracy) as avg_opening,
        AVG(ps.middlegame_accuracy) as avg_middlegame,
        AVG(ps.endgame_accuracy) as avg_endgame
      FROM games g
      LEFT JOIN phase_stats ps ON g.id = ps.game_id
      WHERE g.user_id = ?
    `;
    const params = [userId];

    if (color) {
      query += ' AND g.user_color = ?';
      params.push(color);
    }

    query += ' GROUP BY g.result, g.user_color';

    const rows = await this.database.all(query, params);

    const results = {
      overall: { games: 0, accuracy: 0 },
      wins: { games: 0, accuracy: 0 },
      draws: { games: 0, accuracy: 0 },
      losses: { games: 0, accuracy: 0 }
    };

    let totalGames = 0;
    let totalAccuracy = 0;

    for (const row of rows) {
      const isPlayerWhite = row.user_color === 'white';
      const avgAccuracy = this._calculateOverallAccuracy(row.avg_opening, row.avg_middlegame, row.avg_endgame);

      let category;
      if (row.result === '1/2-1/2') {
        category = 'draws';
      } else if ((isPlayerWhite && row.result === '1-0') || (!isPlayerWhite && row.result === '0-1')) {
        category = 'wins';
      } else {
        category = 'losses';
      }

      results[category].games += row.games;
      results[category].accuracy = avgAccuracy;
      totalGames += row.games;
      totalAccuracy += avgAccuracy * row.games;
    }

    results.overall.games = totalGames;
    results.overall.accuracy = totalGames > 0 ? Math.round((totalAccuracy / totalGames) * 10) / 10 : 0;

    return results;
  }

  /**
   * Get distribution of which game phase games typically end in
   * @param {string} userId - User ID
   * @param {string|null} color - Optional filter by player color
   * @returns {Promise<Object>} Phase distribution stats
   */
  async getPhaseDistribution(userId, color = null) {
    let query = `
      SELECT 
        g.id,
        g.user_color,
        (SELECT MAX(move_number) FROM analysis WHERE game_id = g.id) as total_moves
      FROM games g
      WHERE g.user_id = ?
    `;
    const params = [userId];

    if (color) {
      query += ' AND g.user_color = ?';
      params.push(color);
    }

    const games = await this.database.all(query, params);

    const distribution = {
      totalGames: games.length,
      overall: {
        opening: { count: 0, percentage: 0 },
        middlegame: { count: 0, percentage: 0 },
        endgame: { count: 0, percentage: 0 }
      }
    };

    for (const game of games) {
      const totalMoves = game.total_moves || 0;
      let phase;
      if (totalMoves <= 20) phase = 'opening';
      else if (totalMoves <= 60) phase = 'middlegame';
      else phase = 'endgame';

      distribution.overall[phase].count++;
    }

    const total = distribution.totalGames || 1;
    distribution.overall.opening.percentage = Math.round((distribution.overall.opening.count / total) * 100);
    distribution.overall.middlegame.percentage = Math.round((distribution.overall.middlegame.count / total) * 100);
    distribution.overall.endgame.percentage = Math.round((distribution.overall.endgame.count / total) * 100);

    return distribution;
  }

  /**
   * Get aggregate accuracy by game phase across all games
   * @param {string} userId - User ID
   * @param {string|null} color - Optional filter by player color
   * @returns {Promise<Object>} Accuracy stats by phase
   */
  async getAccuracyByPhase(userId, color = null) {
    let query = `
      SELECT 
        AVG(ps.opening_accuracy) as avg_opening,
        AVG(ps.middlegame_accuracy) as avg_middlegame,
        AVG(ps.endgame_accuracy) as avg_endgame,
        COUNT(CASE WHEN ps.opening_accuracy IS NOT NULL THEN 1 END) as opening_games,
        COUNT(CASE WHEN ps.middlegame_accuracy IS NOT NULL THEN 1 END) as middlegame_games,
        COUNT(CASE WHEN ps.endgame_accuracy IS NOT NULL THEN 1 END) as endgame_games
      FROM games g
      LEFT JOIN phase_stats ps ON g.id = ps.game_id
      WHERE g.user_id = ?
    `;
    const params = [userId];

    if (color) {
      query += ' AND g.user_color = ?';
      params.push(color);
    }

    const row = await this.database.get(query, params);

    return {
      opening: {
        accuracy: Math.round((row?.avg_opening || 0) * 10) / 10,
        gamesWithData: row?.opening_games || 0
      },
      middlegame: {
        accuracy: Math.round((row?.avg_middlegame || 0) * 10) / 10,
        gamesWithData: row?.middlegame_games || 0
      },
      endgame: {
        accuracy: Math.round((row?.avg_endgame || 0) * 10) / 10,
        gamesWithData: row?.endgame_games || 0
      }
    };
  }

  /**
   * Get performance statistics for most frequently played openings
   * @param {string} userId - User ID
   * @param {number} limit - Number of openings to return
   * @param {string|null} color - Optional filter by player color
   * @returns {Promise<Array>} Opening performance stats
   */
  async getOpeningPerformance(userId, limit = 10, color = null) {
    // First try opening_analysis table
    let query = `
      SELECT 
        oa.eco_code as ecoCode,
        oa.opening_name as name,
        COUNT(*) as games,
        SUM(CASE 
          WHEN (g.user_color = 'white' AND g.result = '1-0') OR 
               (g.user_color = 'black' AND g.result = '0-1') THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN g.result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
        SUM(CASE 
          WHEN (g.user_color = 'white' AND g.result = '0-1') OR 
               (g.user_color = 'black' AND g.result = '1-0') THEN 1 ELSE 0 END) as losses
      FROM games g
      JOIN opening_analysis oa ON g.id = oa.game_id
      WHERE g.user_id = ?
    `;
    const params = [userId];

    if (color) {
      query += ' AND g.user_color = ?';
      params.push(color);
    }

    query += ` GROUP BY oa.eco_code, oa.opening_name ORDER BY games DESC LIMIT ?`;
    params.push(limit);

    let rows = await this.database.all(query, params);

    // Fallback to PGN parsing if no opening_analysis data
    if (rows.length === 0) {
      rows = await this._getOpeningPerformanceFromPGN(userId, limit, color);
    }

    return rows.map(row => ({
      ecoCode: row.ecoCode || 'Unknown',
      name: row.name || 'Unknown Opening',
      games: row.games,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      winRate: row.games > 0 ? Math.round((row.wins / row.games) * 100) : 0,
      drawRate: row.games > 0 ? Math.round((row.draws / row.games) * 100) : 0,
      lossRate: row.games > 0 ? Math.round((row.losses / row.games) * 100) : 0
    }));
  }

  /**
   * Get tactical opportunities statistics (found vs missed)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Tactical opportunities stats by type
   */
  async getTacticalOpportunities(userId) {
    const tacticalService = new TacticalOpportunityService(this.database);
    return tacticalService.getTacticStats(userId);
  }

  /**
   * Get free pieces statistics (opponent blunders found vs missed)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Free pieces stats by piece type
   */
  async getFreePieces(userId) {
    const opponentBlunderService = new OpponentBlunderService(this.database);
    return opponentBlunderService.getFreePieceStats(userId);
  }

  // Private helpers

  _calculateOverallAccuracy(opening, middlegame, endgame) {
    const phases = [opening, middlegame, endgame].filter(v => v != null);
    if (phases.length === 0) return 0;
    return Math.round((phases.reduce((a, b) => a + b, 0) / phases.length) * 10) / 10;
  }

  async _getOpeningPerformanceFromPGN(userId, limit, color) {
    const openingDetector = require('../models/opening-detector');

    let query = `SELECT g.id, g.pgn_content, g.result, g.user_color FROM games g WHERE g.user_id = ? AND g.pgn_content IS NOT NULL`;
    const params = [userId];
    if (color) {
      query += ' AND g.user_color = ?';
      params.push(color);
    }

    const games = await this.database.all(query, params);
    const openingMap = new Map();

    for (const game of games) {
      let ecoCode = null, openingName = null;
      const ecoMatch = game.pgn_content?.match(/\[ECO "([^"]+)"\]/);
      if (ecoMatch) ecoCode = ecoMatch[1];

      const detected = openingDetector.detect(game.pgn_content);
      if (detected) {
        ecoCode = ecoCode || detected.eco || 'Unknown';
        openingName = detected.name;
      }
      if (!openingName) { openingName = 'Unknown Opening'; ecoCode = ecoCode || 'Unknown'; }

      const key = ecoCode;
      const isPlayerWhite = game.user_color === 'white';

      if (!openingMap.has(key)) {
        openingMap.set(key, { ecoCode, name: openingName, games: 0, wins: 0, draws: 0, losses: 0 });
      }

      const stats = openingMap.get(key);
      stats.games++;
      if (game.result === '1/2-1/2') stats.draws++;
      else if ((isPlayerWhite && game.result === '1-0') || (!isPlayerWhite && game.result === '0-1')) stats.wins++;
      else stats.losses++;
    }

    return Array.from(openingMap.values()).sort((a, b) => b.games - a.games).slice(0, limit);
  }
}

module.exports = InsightsService;
