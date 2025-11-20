const AccuracyCalculator = require('./accuracy-calculator');
const { getDatabase } = require('./database');

// Get target player from database configuration
const TARGET_PLAYER = 'AdvaitKumar1213'; // TODO: Replace with logged-in user when auth is implemented

class TournamentAnalyzer {
  constructor() {
    this.db = null;
  }

  async initialize() {
    if (!this.db) {
      this.db = getDatabase();
      if (!this.db.db) {
        await this.db.initialize();
      }
    }
  }

  // Get performance metrics for a specific tournament
  async getTournamentPerformance(tournamentId) {
    if (!this.db) await this.initialize();

    try {
      // Get all games in tournament
      const games = await this.db.all(`
        SELECT id, white_player, black_player, result, date
        FROM games 
        WHERE tournament_id = ?
      `, [tournamentId]);

      // Filter for player-specific games and calculate wins/losses/draws
      const playerGames = games.filter(g => g.white_player === TARGET_PLAYER || g.black_player === TARGET_PLAYER);
      
      let wins = 0, losses = 0, draws = 0;
      playerGames.forEach(game => {
        const isPlayerWhite = game.white_player === TARGET_PLAYER;
        
        if (game.result === '1/2-1/2') {
          draws++;
        } else if (
          (isPlayerWhite && game.result === '1-0') ||
          (!isPlayerWhite && game.result === '0-1')
        ) {
          wins++;
        } else {
          losses++;
        }
      });

      // Get analysis metrics for player moves only
      const analysisMetrics = await this.db.all(`
        SELECT 
          COUNT(*) as total_moves,
          COUNT(CASE WHEN is_blunder = TRUE THEN 1 END) as total_blunders,
          COALESCE(SUM(centipawn_loss), 0) as total_centipawn_loss
        FROM analysis a
        JOIN games g ON a.game_id = g.id
        WHERE g.tournament_id = ?
          AND ((g.white_player = ? AND a.move_number % 2 = 1) OR 
               (g.black_player = ? AND a.move_number % 2 = 0))
      `, [tournamentId, TARGET_PLAYER, TARGET_PLAYER]);

      const analysis = analysisMetrics[0];

      // Fetch games with analysis data for accuracy calculation
      const gamesWithAnalysis = [];
      for (const gameRecord of playerGames) {
        const gameAnalysis = await this.db.all(`
          SELECT move_number, centipawn_loss
          FROM analysis 
          WHERE game_id = ?
          ORDER BY move_number
        `, [gameRecord.id]);
        
        if (gameAnalysis.length > 0) {
          gamesWithAnalysis.push({
            ...gameRecord,
            analysis: gameAnalysis
          });
        }
      }

      // Calculate player-specific accuracy using centralized calculator
      const avgAccuracy = AccuracyCalculator.calculateOverallAccuracy(gamesWithAnalysis, TARGET_PLAYER);

      // Calculate performance statistics
      const totalPlayerGames = playerGames.length;
      const whiteWinRate = totalPlayerGames > 0 ? Math.round((wins / totalPlayerGames) * 100) : 0;
      const drawRate = totalPlayerGames > 0 ? Math.round((draws / totalPlayerGames) * 100) : 0;

      return {
        totalGames: totalPlayerGames,
        whiteWins: wins, // Actually player wins regardless of color
        blackWins: 0,    // Not used in new logic
        draws: draws,
        whiteWinRate: whiteWinRate, // Actually overall win rate
        blackWinRate: 0,            // Not used in new logic
        drawRate,
        totalMoves: analysis.total_moves,
        totalBlunders: analysis.total_blunders,
        avgAccuracy: avgAccuracy,
        avgCentipawnLoss: analysis.total_moves > 0 ? Math.round(analysis.total_centipawn_loss / analysis.total_moves) : 0
      };
    } catch (error) {
      console.error('❌ Failed to get tournament performance:', error.message);
      throw error;
    }
  }

  // Compare performance across multiple tournaments
  async compareTournaments(tournamentIds) {
    if (!this.db) await this.initialize();

    const comparisons = [];
    
    for (const tournamentId of tournamentIds) {
      try {
        const tournament = await this.db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
        const performance = await this.getTournamentPerformance(tournamentId);
        
        comparisons.push({
          tournament,
          performance
        });
      } catch (error) {
        console.error(`❌ Failed to get data for tournament ${tournamentId}:`, error.message);
      }
    }

    return comparisons;
  }

  // Get tournament-specific heatmap data
  async getTournamentHeatmap(tournamentId) {
    if (!this.db) await this.initialize();

    try {
      const blunderData = await this.db.all(`
        SELECT 
          SUBSTR(a.move, -2) as square,
          COUNT(*) as count,
          AVG(a.centipawn_loss) as avg_loss
        FROM analysis a
        JOIN games g ON a.game_id = g.id
        WHERE g.tournament_id = ? 
          AND a.is_blunder = TRUE 
          AND SUBSTR(a.move, -2) GLOB '[a-h][1-8]'
        GROUP BY square
      `, [tournamentId]);

      // Generate full heatmap with tournament data
      const heatmapData = [];
      for (let rank = 7; rank >= 0; rank--) {
        for (let file = 0; file < 8; file++) {
          const square = String.fromCharCode(97 + file) + (rank + 1);
          const blunder = blunderData.find(b => b.square === square);
          
          heatmapData.push({
            square,
            file,
            rank,
            count: blunder ? blunder.count : 0,
            severity: blunder ? Math.round(blunder.avg_loss) : 0,
            intensity: blunder ? Math.min(1, blunder.count * 0.3) : 0
          });
        }
      }

      return heatmapData;
    } catch (error) {
      console.error('❌ Failed to get tournament heatmap:', error.message);
      throw error;
    }
  }

  // Get tournament trends (improvement over time within tournament)
  async getTournamentTrends(tournamentId) {
    if (!this.db) await this.initialize();

    try {
      // First get all games in the tournament
      const games = await this.db.all(`
        SELECT
          g.id,
          g.white_player,
          g.black_player,
          g.date,
          g.created_at
        FROM games g
        WHERE g.tournament_id = ?
          AND (g.white_player = ? OR g.black_player = ?)
        ORDER BY g.created_at ASC
      `, [tournamentId, TARGET_PLAYER, TARGET_PLAYER]);

      // Fetch analysis data for each game
      const trends = [];
      for (let index = 0; index < games.length; index++) {
        const game = games[index];

        const gameAnalysis = await this.db.all(`
          SELECT move_number, centipawn_loss, is_blunder
          FROM analysis
          WHERE game_id = ?
          ORDER BY move_number
        `, [game.id]);

        const blunders = gameAnalysis.filter(a => a.is_blunder === true).length;
        const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
          gameAnalysis,
          TARGET_PLAYER,
          game.white_player,
          game.black_player
        );

        // Calculate average centipawn loss for player moves only
        const isPlayerWhite = game.white_player === TARGET_PLAYER;
        const playerMoves = gameAnalysis.filter(move =>
          (isPlayerWhite && move.move_number % 2 === 1) ||
          (!isPlayerWhite && move.move_number % 2 === 0)
        );
        const totalCpl = playerMoves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0);
        const avgCentipawnLoss = playerMoves.length > 0 ? Math.round(totalCpl / playerMoves.length) : 0;

        trends.push({
          gameNumber: index + 1,
          gameId: game.id,
          date: game.date,
          accuracy,
          blunders,
          avgCentipawnLoss
        });
      }

      return trends;
    } catch (error) {
      console.error('❌ Failed to get tournament trends:', error.message);
      throw error;
    }
  }

  // Rank tournaments by performance
  async rankTournaments() {
    if (!this.db) await this.initialize();

    try {
      const tournaments = await this.db.all('SELECT * FROM tournaments WHERE total_games > 0');
      const rankings = [];

      for (const tournament of tournaments) {
        const performance = await this.getTournamentPerformance(tournament.id);
        
        // Calculate overall score (weighted combination of metrics)
        const score = (
          performance.avgAccuracy * 0.4 +
          (100 - Math.min(performance.avgCentipawnLoss, 100)) * 0.3 +
          ((performance.whiteWinRate + performance.blackWinRate) / 2) * 0.3
        );

        rankings.push({
          tournament,
          performance,
          score: Math.round(score)
        });
      }

      // Sort by score descending
      return rankings.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('❌ Failed to rank tournaments:', error.message);
      throw error;
    }
  }

  // Get filtered performance data (overall stats filtered by tournament)
  async getFilteredPerformance(tournamentId = null) {
    if (!this.db) await this.initialize();

    try {
      let whereClause = '';
      let params = [];
      
      if (tournamentId) {
        whereClause = 'WHERE g.tournament_id = ?';
        params = [tournamentId];
      }

      const whiteMetrics = await this.db.get(`
        SELECT 
          COUNT(*) as total_games,
          COUNT(CASE WHEN result = '1-0' THEN 1 END) as wins,
          COUNT(CASE WHEN result = '0-1' THEN 1 END) as losses,
          COUNT(CASE WHEN result = '1/2-1/2' THEN 1 END) as draws,
          COUNT(a.id) as total_moves,
          COUNT(CASE WHEN a.is_blunder = TRUE THEN 1 END) as total_blunders,
          COALESCE(SUM(a.centipawn_loss), 0) as total_centipawn_loss
        FROM games g
        LEFT JOIN analysis a ON g.id = a.game_id
        ${whereClause}
      `, params);

      const blackMetrics = { ...whiteMetrics };
      // For black, wins and losses are swapped
      blackMetrics.wins = whiteMetrics.losses;
      blackMetrics.losses = whiteMetrics.wins;

      // Calculate performance metrics
      const whiteWinRate = whiteMetrics.total_games > 0 ? Math.round((whiteMetrics.wins / whiteMetrics.total_games) * 100) : 0;
      const blackWinRate = blackMetrics.total_games > 0 ? Math.round((blackMetrics.wins / blackMetrics.total_games) * 100) : 0;
      
      // Fetch games with analysis data for accuracy calculation
      const games = await this.db.all(`
        SELECT id, white_player, black_player, result, date
        FROM games g
        ${whereClause}
      `, params);

      const gamesWithAnalysis = [];
      for (const gameRecord of games) {
        const gameAnalysis = await this.db.all(`
          SELECT move_number, centipawn_loss
          FROM analysis 
          WHERE game_id = ?
          ORDER BY move_number
        `, [gameRecord.id]);
        
        if (gameAnalysis.length > 0) {
          gamesWithAnalysis.push({
            ...gameRecord,
            analysis: gameAnalysis
          });
        }
      }
      
      // Calculate player-specific accuracy by color using centralized calculator
      const whiteGames = gamesWithAnalysis.filter(g => g.white_player === TARGET_PLAYER);
      const blackGames = gamesWithAnalysis.filter(g => g.black_player === TARGET_PLAYER);
      
      const whiteAccuracy = AccuracyCalculator.calculateOverallAccuracy(whiteGames, TARGET_PLAYER);
      const blackAccuracy = AccuracyCalculator.calculateOverallAccuracy(blackGames, TARGET_PLAYER);

      return {
        white: {
          games: whiteMetrics.total_games,
          winRate: whiteWinRate,
          avgAccuracy: whiteAccuracy,
          blunders: whiteMetrics.total_blunders
        },
        black: {
          games: blackMetrics.total_games,
          winRate: blackWinRate,
          avgAccuracy: blackAccuracy,
          blunders: blackMetrics.total_blunders
        },
        overall: {
          avgAccuracy: Math.round((whiteAccuracy + blackAccuracy) / 2),
          totalBlunders: whiteMetrics.total_blunders
        }
      };
    } catch (error) {
      console.error('❌ Failed to get filtered performance:', error.message);
      throw error;
    }
  }

  // Get tournament summary with key insights
  async getTournamentSummary(tournamentId) {
    if (!this.db) await this.initialize();

    try {
      const tournament = await this.db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
      const performance = await this.getTournamentPerformance(tournamentId);
      const trends = await this.getTournamentTrends(tournamentId);
      
      // Calculate insights
      const insights = {
        bestGame: trends.length > 0 ? trends.reduce((best, game) => game.accuracy > best.accuracy ? game : best) : null,
        worstGame: trends.length > 0 ? trends.reduce((worst, game) => game.accuracy < worst.accuracy ? game : worst) : null,
        improvement: trends.length > 1 ? trends[trends.length - 1].accuracy - trends[0].accuracy : 0,
        consistency: trends.length > 0 ? this.calculateConsistency(trends.map(t => t.accuracy)) : 0
      };

      return {
        tournament,
        performance,
        trends,
        insights
      };
    } catch (error) {
      console.error('❌ Failed to get tournament summary:', error.message);
      throw error;
    }
  }

  // Calculate consistency score (lower standard deviation = higher consistency)
  calculateConsistency(accuracies) {
    if (accuracies.length < 2) return 100;
    
    const mean = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accuracies.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to consistency score (0-100, higher is better)
    return Math.max(0, Math.min(100, 100 - stdDev));
  }
}

// Singleton instance
let tournamentAnalyzerInstance = null;

function getTournamentAnalyzer() {
  if (!tournamentAnalyzerInstance) {
    tournamentAnalyzerInstance = new TournamentAnalyzer();
  }
  return tournamentAnalyzerInstance;
}

module.exports = { TournamentAnalyzer, getTournamentAnalyzer };
