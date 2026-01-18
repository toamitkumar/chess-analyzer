/**
 * Tactics Controller
 *
 * Handles HTTP requests for tactical opportunities endpoints.
 * Reference: ADR 009 Phase 5.1 - Found vs Missed Tactical Opportunities
 * Reference: ADR 009 Phase 5.3 - Free Pieces (Opponent Blunders)
 */

const { getDatabase } = require('../../models/database');
const TacticalOpportunityService = require('../../services/TacticalOpportunityService');
const OpponentBlunderService = require('../../services/OpponentBlunderService');

class TacticsController {
  constructor() {
    this.tacticsService = null;
    this.opponentBlunderService = null;
  }

  /**
   * Get or initialize TacticalOpportunityService instance
   */
  getTacticsService() {
    if (!this.tacticsService) {
      const database = getDatabase();
      this.tacticsService = new TacticalOpportunityService(database);
    }
    return this.tacticsService;
  }

  /**
   * Get or initialize OpponentBlunderService instance
   */
  getOpponentBlunderService() {
    if (!this.opponentBlunderService) {
      const database = getDatabase();
      this.opponentBlunderService = new OpponentBlunderService(database);
    }
    return this.opponentBlunderService;
  }

  /**
   * GET /api/insights/tactics/opportunities
   * Get found vs missed tactical opportunities summary
   */
  async getOpportunities(req, res) {
    try {
      const { type } = req.query;
      console.log(`📊 [TACTICS CONTROLLER] Opportunities requested${type ? ` for type: ${type}` : ''}`);

      const service = this.getTacticsService();
      const result = await service.getFoundVsMissed(req.userId, type || null);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[TACTICS CONTROLLER] Get opportunities error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get tactical opportunities'
      });
    }
  }

  /**
   * GET /api/insights/tactics/forks
   * Get fork opportunities breakdown
   */
  async getForks(req, res) {
    try {
      console.log('📊 [TACTICS CONTROLLER] Fork opportunities requested');

      const service = this.getTacticsService();
      const result = await service.getForkOpportunities(req.userId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[TACTICS CONTROLLER] Get forks error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get fork opportunities'
      });
    }
  }

  /**
   * GET /api/insights/tactics/pins
   * Get pin opportunities breakdown
   */
  async getPins(req, res) {
    try {
      console.log('📊 [TACTICS CONTROLLER] Pin opportunities requested');

      const service = this.getTacticsService();
      const result = await service.getPinOpportunities(req.userId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[TACTICS CONTROLLER] Get pins error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get pin opportunities'
      });
    }
  }

  /**
   * GET /api/insights/tactics/by-piece
   * Get tactical opportunities grouped by attacking piece type
   */
  async getByPiece(req, res) {
    try {
      const { type } = req.query;
      console.log(`📊 [TACTICS CONTROLLER] By piece requested${type ? ` for type: ${type}` : ''}`);

      const service = this.getTacticsService();
      const result = await service.getByAttackingPiece(req.userId, type || null);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[TACTICS CONTROLLER] Get by piece error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get tactics by piece'
      });
    }
  }

  /**
   * GET /api/insights/tactics/missed
   * Get recent missed tactical opportunities
   */
  async getMissed(req, res) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      console.log(`📊 [TACTICS CONTROLLER] Recent missed requested (limit: ${limit})`);

      const service = this.getTacticsService();
      const result = await service.getRecentMissed(req.userId, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[TACTICS CONTROLLER] Get missed error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get missed opportunities'
      });
    }
  }

  /**
   * GET /api/insights/tactics/dashboard
   * Get comprehensive tactical summary for insights dashboard
   */
  async getDashboard(req, res) {
    try {
      console.log('📊 [TACTICS CONTROLLER] Dashboard summary requested');

      const service = this.getTacticsService();
      const result = await service.getDashboardSummary(req.userId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[TACTICS CONTROLLER] Get dashboard error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get tactics dashboard'
      });
    }
  }

  // ============================================
  // Free Pieces (Opponent Blunders) - ADR 009 Phase 5.3
  // ============================================

  /**
   * GET /api/insights/tactics/free-pieces
   * Get free pieces (opponent blunders) summary
   */
  async getFreePieces(req, res) {
    try {
      console.log('📊 [TACTICS CONTROLLER] Free pieces summary requested');

      const service = this.getOpponentBlunderService();
      const result = await service.getDashboardSummary(req.userId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[TACTICS CONTROLLER] Get free pieces error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get free pieces data'
      });
    }
  }

  /**
   * GET /api/insights/tactics/free-pieces/missed
   * Get recent missed free pieces (captures player didn't make)
   */
  async getMissedFreePieces(req, res) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      console.log(`📊 [TACTICS CONTROLLER] Missed free pieces requested (limit: ${limit})`);

      const service = this.getOpponentBlunderService();
      const result = await service.getRecentMissed(req.userId, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[TACTICS CONTROLLER] Get missed free pieces error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get missed free pieces'
      });
    }
  }

  /**
   * GET /api/insights/tactics/free-pieces/by-piece
   * Get free pieces grouped by opponent's piece type
   */
  async getFreePiecesByType(req, res) {
    try {
      console.log('📊 [TACTICS CONTROLLER] Free pieces by type requested');

      const service = this.getOpponentBlunderService();
      const result = await service.getByPieceType(req.userId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[TACTICS CONTROLLER] Get free pieces by type error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get free pieces by type'
      });
    }
  }
}

module.exports = new TacticsController();
