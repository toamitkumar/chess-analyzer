/**
 * Tactics Routes
 *
 * Maps HTTP endpoints to tactics controller methods
 * Reference: ADR 009 Phase 5.1 - Found vs Missed Tactical Opportunities
 * Reference: ADR 009 Phase 5.3 - Free Pieces (Opponent Blunders)
 */

const express = require('express');
const router = express.Router();
const tacticsController = require('../controllers/tactics.controller');

// ============================================
// Tactical Opportunities (Phase 5.1)
// ============================================

// GET /api/insights/tactics/opportunities - Get found vs missed summary
router.get('/opportunities', tacticsController.getOpportunities.bind(tacticsController));

// GET /api/insights/tactics/forks - Get fork opportunities breakdown
router.get('/forks', tacticsController.getForks.bind(tacticsController));

// GET /api/insights/tactics/pins - Get pin opportunities breakdown
router.get('/pins', tacticsController.getPins.bind(tacticsController));

// GET /api/insights/tactics/by-piece - Get tactics grouped by attacking piece
router.get('/by-piece', tacticsController.getByPiece.bind(tacticsController));

// GET /api/insights/tactics/missed - Get recent missed opportunities
router.get('/missed', tacticsController.getMissed.bind(tacticsController));

// GET /api/insights/tactics/dashboard - Get comprehensive tactical summary
router.get('/dashboard', tacticsController.getDashboard.bind(tacticsController));

// ============================================
// Free Pieces - Opponent Blunders (Phase 5.3)
// ============================================

// GET /api/insights/tactics/free-pieces - Get free pieces summary
router.get('/free-pieces', tacticsController.getFreePieces.bind(tacticsController));

// GET /api/insights/tactics/free-pieces/missed - Get missed free pieces
router.get('/free-pieces/missed', tacticsController.getMissedFreePieces.bind(tacticsController));

// GET /api/insights/tactics/free-pieces/by-piece - Get free pieces by opponent's piece type
router.get('/free-pieces/by-piece', tacticsController.getFreePiecesByType.bind(tacticsController));

module.exports = router;
