/**
 * Tournament Routes
 *
 * Defines all routes for tournament-related endpoints
 */

const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournament.controller');

// CRUD Operations
router.post('/', tournamentController.create.bind(tournamentController));
router.get('/', tournamentController.list.bind(tournamentController));
router.get('/compare', tournamentController.compare.bind(tournamentController)); // Must be before /:id
router.get('/rankings', tournamentController.getRankings.bind(tournamentController)); // Must be before /:id
router.get('/:id', tournamentController.getById.bind(tournamentController));

// Analytics Endpoints
router.get('/:id/performance', tournamentController.getPerformance.bind(tournamentController));
router.get('/:id/heatmap', tournamentController.getHeatmap.bind(tournamentController));
router.get('/:id/trends', tournamentController.getTrends.bind(tournamentController));
router.get('/:id/summary', tournamentController.getSummary.bind(tournamentController));
router.get('/:id/player-performance', tournamentController.getPlayerPerformance.bind(tournamentController));

// File Management
router.get('/:id/files', tournamentController.getFiles.bind(tournamentController));
router.get('/:id/games', tournamentController.getGames.bind(tournamentController));

module.exports = router;
