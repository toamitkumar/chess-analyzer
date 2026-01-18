/**
 * Blunder Routes
 *
 * Maps HTTP endpoints to blunder controller methods
 */

const express = require('express');
const router = express.Router();
const blunderController = require('../controllers/blunder.controller');

// GET /api/blunders - List all blunders with optional filters
router.get('/', blunderController.list.bind(blunderController));

// GET /api/blunders/by-phase/:phase - Get blunders for specific phase
router.get('/by-phase/:phase', blunderController.getByPhase.bind(blunderController));

// GET /api/blunders/by-theme/:theme - Get blunders for specific theme
router.get('/by-theme/:theme', blunderController.getByTheme.bind(blunderController));

// GET /api/blunders/unlearned - Get unlearned blunders
router.get('/unlearned', blunderController.getUnlearned.bind(blunderController));

// GET /api/blunders/dashboard - Get comprehensive blunder statistics
router.get('/dashboard', blunderController.getDashboard.bind(blunderController));

// GET /api/blunders/timeline - Get blunder timeline analysis
router.get('/timeline', blunderController.getTimeline.bind(blunderController));

// GET /api/blunders/by-piece-type - Get blunders breakdown by piece type (ADR 009 Phase 5.2)
router.get('/by-piece-type', blunderController.getByPieceType.bind(blunderController));

// PUT /api/blunders/:id/review - Mark blunder as reviewed
router.put('/:id/review', blunderController.markReviewed.bind(blunderController));

// PUT /api/blunders/:id/learned - Mark blunder as learned/unlearned
router.put('/:id/learned', blunderController.markLearned.bind(blunderController));

module.exports = router;
