const { getDatabase } = require('./database');

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
      const metrics = await this.db.all(`
        SELECT 
          COUNT(*) as total_games,
          SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as white_wins,
          SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as black_wins,
          SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
          COUNT(CASE WHEN result = '1-0' THEN 1 END) + COUNT(CASE WHEN result = '0-1' THEN 1 END) as total_decisive
        FROM games 
        WHERE tournament_id = ?
      `, [tournamentId]);

      const analysisMetrics = await this.db.all(`
        SELECT 
          COUNT(*) as total_moves,
          COUNT(CASE WHEN is_blunder = 1 THEN 1 END) as total_blunders,
          COALESCE(SUM(centipawn_loss), 0) as total_centipawn_loss,
          COALESCE(AVG(evaluation), 0) as avg_evaluation
        FROM analysis a
        JOIN games g ON a.game_id = g.id
        WHERE g.tournament_id = ?
      `, [tournamentId]);

      const game = metrics[0];
      const analysis = analysisMetrics[0];

      // Calculate performance statistics
      const whiteWinRate = game.total_games > 0 ? Math.round((game.white_wins / game.total_games) * 100) : 0;
      const blackWinRate = game.total_games > 0 ? Math.round((game.black_wins / game.total_games) * 100) : 0;
      const drawRate = game.total_games > 0 ? Math.round((game.draws / game.total_games) * 100) : 0;
      const avgAccuracy = analysis.total_moves > 0 ? 
        Math.max(0, Math.min(100, 100 - (analysis.total_centipawn_loss / analysis.total_moves / 8))) : 0;

      return {
        totalGames: game.total_games,
        whiteWins: game.white_wins,
        blackWins: game.black_wins,
        draws: game.draws,
        whiteWinRate,
        blackWinRate,
        drawRate,
        totalMoves: analysis.total_moves,
        totalBlunders: analysis.total_blunders,
        avgAccuracy: Math.round(avgAccuracy),
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
          AND a.is_blunder = 1 
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
      const trends = await this.db.all(`
        SELECT 
          g.id,
          g.date,
          g.created_at,
          COUNT(a.id) as moves,
          COUNT(CASE WHEN a.is_blunder = 1 THEN 1 END) as blunders,
          COALESCE(AVG(a.centipawn_loss), 0) as avg_centipawn_loss
        FROM games g
        LEFT JOIN analysis a ON g.id = a.game_id
        WHERE g.tournament_id = ?
        GROUP BY g.id
        ORDER BY g.created_at ASC
      `, [tournamentId]);

      return trends.map((game, index) => ({
        gameNumber: index + 1,
        gameId: game.id,
        date: game.date,
        accuracy: game.moves > 0 ? Math.max(0, Math.min(100, 100 - (game.avg_centipawn_loss / 8))) : 0,
        blunders: game.blunders,
        avgCentipawnLoss: Math.round(game.avg_centipawn_loss)
      }));
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
          COUNT(CASE WHEN g.result = '1-0' THEN 1 END) as wins,
          COUNT(CASE WHEN g.result = '0-1' THEN 1 END) as losses,
          COUNT(CASE WHEN g.result = '1/2-1/2' THEN 1 END) as draws,
          COUNT(a.id) as total_moves,
          COUNT(CASE WHEN a.is_blunder = 1 THEN 1 END) as total_blunders,
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
      const whiteAccuracy = whiteMetrics.total_moves > 0 ? Math.max(0, Math.min(100, 100 - (whiteMetrics.total_centipawn_loss / whiteMetrics.total_moves / 8))) : 0;
      const blackAccuracy = blackMetrics.total_moves > 0 ? Math.max(0, Math.min(100, 100 - (blackMetrics.total_centipawn_loss / blackMetrics.total_moves / 8))) : 0;

      return {
        white: {
          games: whiteMetrics.total_games,
          winRate: whiteWinRate,
          avgAccuracy: Math.round(whiteAccuracy),
          blunders: whiteMetrics.total_blunders
        },
        black: {
          games: blackMetrics.total_games,
          winRate: blackWinRate,
          avgAccuracy: Math.round(blackAccuracy),
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
