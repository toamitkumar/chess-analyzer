/**
 * Game Routes
 *
 * Defines all game-related endpoint mappings
 */

const express = require('express');
const router = express.Router();
const gameController = require('../controllers/game.controller');

// List all games
router.get('/', gameController.list.bind(gameController));

// Get specific game
router.get('/:id', gameController.getById.bind(gameController));

// Game analysis endpoints
router.get('/:id/analysis', gameController.getAnalysis.bind(gameController));
router.get('/:id/alternatives/:moveNumber', gameController.getAlternatives.bind(gameController));
router.get('/:id/blunders', gameController.getBlunders.bind(gameController));
router.get('/:id/accuracy', gameController.getAccuracy.bind(gameController));
router.get('/:id/performance', gameController.getPerformance.bind(gameController));
router.get('/:id/phases', gameController.getPhases.bind(gameController));

module.exports = router;
