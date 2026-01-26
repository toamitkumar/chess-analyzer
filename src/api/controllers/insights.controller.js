/**
 * Insights Controller
 *
 * Handles HTTP requests for chess insights analytics endpoints.
 * Reference: ADR 009 - Insights Dashboard
 */

const InsightsService = require('../../services/InsightsService');

class InsightsController {
  constructor() {
    this.insightsService = new InsightsService();
  }

  /**
   * GET /api/insights/accuracy
   * Get accuracy breakdown by game result (win/draw/loss)
   */
  async getAccuracyByResult(req, res) {
    try {
      const color = req.query.color || null;
      const result = await this.insightsService.getAccuracyByResult(req.userId, color);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Accuracy by result API error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get accuracy by result' });
    }
  }

  /**
   * GET /api/insights/phases
   * Get distribution of which game phase games typically end in
   */
  async getPhaseDistribution(req, res) {
    try {
      const color = req.query.color || null;
      const result = await this.insightsService.getPhaseDistribution(req.userId, color);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Phase distribution API error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get phase distribution' });
    }
  }

  /**
   * GET /api/insights/accuracy-by-phase
   * Get aggregate accuracy by game phase across all games
   */
  async getAccuracyByPhase(req, res) {
    try {
      const color = req.query.color || null;
      const result = await this.insightsService.getAccuracyByPhase(req.userId, color);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Accuracy by phase API error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get accuracy by phase' });
    }
  }

  /**
   * GET /api/insights/openings
   * Get performance statistics for most frequently played openings
   */
  async getOpeningPerformance(req, res) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      const color = req.query.color || null;
      const result = await this.insightsService.getOpeningPerformance(req.userId, limit, color);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Opening performance API error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get opening performance' });
    }
  }

  /**
   * GET /api/insights/tactics/opportunities
   * Get found vs missed tactical opportunities (forks, pins, etc.)
   */
  async getTacticalOpportunities(req, res) {
    try {
      const result = await this.insightsService.getTacticalOpportunities(req.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Tactical opportunities API error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get tactical opportunities' });
    }
  }

  /**
   * GET /api/insights/tactics/free-pieces
   * Get free pieces (opponent blunders) - found vs missed
   */
  async getFreePieces(req, res) {
    try {
      const result = await this.insightsService.getFreePieces(req.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Free pieces API error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to get free pieces' });
    }
  }
}

module.exports = new InsightsController();
