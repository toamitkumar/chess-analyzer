/**
 * Upload Routes
 *
 * Maps HTTP endpoints to upload controller methods
 * Note: Middleware (uploadLimiter, checkAccessCode, multer upload)
 * must be applied in api-server.js when mounting these routes
 */

const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');

// POST /api/upload - Upload PGN file (middleware applied in api-server.js)
router.post('/', uploadController.upload.bind(uploadController));

// POST /api/upload/pgn - Upload PGN file (alternative endpoint)
router.post('/pgn', uploadController.upload.bind(uploadController));

module.exports = router;
