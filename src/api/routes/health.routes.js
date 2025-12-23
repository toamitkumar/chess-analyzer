/**
 * Health Routes
 *
 * Maps HTTP endpoints to health controller methods
 */

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

// GET /api/health - Health check endpoint
router.get('/', healthController.check.bind(healthController));

module.exports = router;
