/**
 * Insights Routes
 *
 * Routes for chess insights analytics endpoints.
 * Reference: ADR 009 - Chess.com Insights Dashboard
 */

const express = require('express');
const router = express.Router();
const insightsController = require('../controllers/insights.controller');

// Phase 1-3: Core Insights
router.get('/accuracy', insightsController.getAccuracyByResult.bind(insightsController));
router.get('/phases', insightsController.getPhaseDistribution.bind(insightsController));
router.get('/accuracy-by-phase', insightsController.getAccuracyByPhase.bind(insightsController));
router.get('/openings', insightsController.getOpeningPerformance.bind(insightsController));

// Phase 5: Advanced Tactical Features
router.get('/tactics/opportunities', insightsController.getTacticalOpportunities.bind(insightsController));
router.get('/tactics/free-pieces', insightsController.getFreePieces.bind(insightsController));

module.exports = router;
