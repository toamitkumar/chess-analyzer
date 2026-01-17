/**
 * Dashboard Controller
 *
 * Handles HTTP requests for dashboard and analytics endpoints.
 * Delegates business logic to DashboardService.
 */

const DashboardService = require('../../services/DashboardService');

class DashboardController {
  constructor() {
    this.dashboardService = new DashboardService();
  }

  /**
   * GET /api/performance
   * Get performance metrics with optional tournament filtering
   */
  async getPerformance(req, res) {
    try {
      const tournamentId = req.query.tournament ? parseInt(req.query.tournament) : null;
      console.log(`📊 [DASHBOARD CONTROLLER]: Performance data requested${tournamentId ? ` for tournament ${tournamentId}` : ' (overall)'}`);

      const performanceData = await this.dashboardService.getPerformanceMetrics(tournamentId, req.userId);
      res.json(performanceData);
    } catch (error) {
      console.error('Performance API error:', error);

      // Fallback data
      const fallbackData = {
        white: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
        black: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
        overall: { avgAccuracy: 0, totalBlunders: 0 }
      };

      res.json(fallbackData);
    }
  }

  /**
   * GET /api/player-performance
   * Get overall player performance statistics
   */
  async getPlayerPerformance(req, res) {
    try {
      console.log(`👤 [NEW CONTROLLER]: Overall player performance requested`);

      const performanceData = await this.dashboardService.getPlayerPerformance(req.userId);
      res.json(performanceData);
    } catch (error) {
      console.error('Player performance API error:', error);
      res.status(500).json({ error: error.message || 'Failed to get player performance' });
    }
  }

  /**
   * GET /api/trends
   * Get weekly performance trends (rating and centipawn loss)
   */
  async getTrends(req, res) {
    const startTime = Date.now();

    try {
      const data = await this.dashboardService.getTrendsData(req.userId);
      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        data: data,
        responseTime: responseTime
      });
    } catch (error) {
      console.error('Trends API error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/trends/rating
   * Get rating progression over games
   */
  async getRatingTrends(req, res) {
    try {
      const tournamentId = req.query.tournament ? parseInt(req.query.tournament) : null;

      const result = await this.dashboardService.getRatingTrends(tournamentId, req.userId);
      res.json(result);
    } catch (error) {
      console.error('Rating trends API error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/trends/centipawn-loss
   * Get centipawn loss progression over games
   */
  async getCentipawnLossTrends(req, res) {
    try {
      const tournamentId = req.query.tournament ? parseInt(req.query.tournament) : null;

      const result = await this.dashboardService.getCentipawnLossTrends(tournamentId, req.userId);
      res.json(result);
    } catch (error) {
      console.error('Centipawn trends API error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/heatmap-db
   * Generate heatmap from blunder data in database
   */
  async getHeatmap(req, res) {
    try {
      const tournamentId = req.query.tournament ? parseInt(req.query.tournament) : null;
      console.log(`🔥 Heatmap requested${tournamentId ? ` for tournament ${tournamentId}` : ' (overall)'}`);

      const result = await this.dashboardService.generateHeatmap(req.userId, tournamentId);
      res.json(result);
    } catch (error) {
      console.error('Heatmap API error:', error);
      res.status(500).json({ error: 'Failed to generate heatmap data' });
    }
  }

  /**
   * GET /api/games
   * Get list of games with opening information
   */
  async getGamesList(req, res) {
    try {
      console.log('🎮 Games list requested');

      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const tournamentId = req.query.tournament ? parseInt(req.query.tournament) : null;

      const games = await this.dashboardService.getGamesList(req.userId, limit, tournamentId);
      res.json(games);
    } catch (error) {
      console.error('Games API error:', error);
      res.json([]);
    }
  }

  // ============================================
  // Chess.com Insights Dashboard Endpoints (ADR 009)
  // ============================================

  /**
   * GET /api/insights/accuracy
   * Get accuracy breakdown by game result (win/draw/loss)
   * Query params: color (optional) - 'white' or 'black'
   */
  async getAccuracyByResult(req, res) {
    try {
      const color = req.query.color || null;
      console.log(`📊 [INSIGHTS]: Accuracy by result requested${color ? ` for ${color}` : ''}`);

      const result = await this.dashboardService.getAccuracyByResult(req.userId, color);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Accuracy by result API error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get accuracy by result'
      });
    }
  }

  /**
   * GET /api/insights/phases
   * Get distribution of which game phase games typically end in
   * Query params: color (optional) - 'white' or 'black'
   */
  async getPhaseDistribution(req, res) {
    try {
      const color = req.query.color || null;
      console.log(`📊 [INSIGHTS]: Phase distribution requested${color ? ` for ${color}` : ''}`);

      const result = await this.dashboardService.getPhaseDistribution(req.userId, color);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Phase distribution API error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get phase distribution'
      });
    }
  }

  /**
   * GET /api/insights/accuracy-by-phase
   * Get aggregate accuracy by game phase across all games
   * Query params: color (optional) - 'white' or 'black'
   */
  async getAccuracyByPhase(req, res) {
    try {
      const color = req.query.color || null;
      console.log(`📊 [INSIGHTS]: Accuracy by phase requested${color ? ` for ${color}` : ''}`);

      const result = await this.dashboardService.getAccuracyByPhase(req.userId, color);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Accuracy by phase API error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get accuracy by phase'
      });
    }
  }

  /**
   * GET /api/insights/openings
   * Get performance statistics for most frequently played openings
   * Query params:
   *   - limit (optional, default: 10) - number of openings to return
   *   - color (optional) - 'white' or 'black'
   */
  async getOpeningPerformance(req, res) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      const color = req.query.color || null;
      console.log(`📊 [INSIGHTS]: Opening performance requested (limit: ${limit}${color ? `, color: ${color}` : ''})`);

      const result = await this.dashboardService.getOpeningPerformance(req.userId, limit, color);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Opening performance API error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get opening performance'
      });
    }
  }
}

module.exports = new DashboardController();
