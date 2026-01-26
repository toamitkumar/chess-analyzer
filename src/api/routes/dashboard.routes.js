/**
 * Dashboard Routes
 *
 * Routes for dashboard and analytics endpoints
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

// Performance metrics
router.get('/performance', dashboardController.getPerformance.bind(dashboardController));
router.get('/player-performance', dashboardController.getPlayerPerformance.bind(dashboardController));

// Trends
router.get('/trends', dashboardController.getTrends.bind(dashboardController));
router.get('/trends/rating', dashboardController.getRatingTrends.bind(dashboardController));
router.get('/trends/centipawn-loss', dashboardController.getCentipawnLossTrends.bind(dashboardController));

// Heatmap
router.get('/heatmap-db', dashboardController.getHeatmap.bind(dashboardController));

// Games list
router.get('/games', dashboardController.getGamesList.bind(dashboardController));

module.exports = router;
