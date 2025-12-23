/**
 * API Routes Index
 *
 * Central router that aggregates all domain-specific routes
 *
 * Note: Upload routes require special middleware to be passed in
 * from api-server.js (uploadLimiter, checkAccessCode, multer)
 */

const express = require('express');

// Import domain routes
const tournamentRoutes = require('./tournament.routes');
const gameRoutes = require('./game.routes');
const blunderRoutes = require('./blunder.routes');
const healthRoutes = require('./health.routes');
const dashboardRoutes = require('./dashboard.routes');
const uploadController = require('../controllers/upload.controller');
// TODO: Add other routes as they're created
// const puzzleRoutes = require('./puzzle.routes');
// const learningPathRoutes = require('./learningPath.routes');

/**
 * Configure all API routes
 * @param {Object} middleware - Required middleware for upload routes
 * @param {Function} middleware.uploadLimiter - Rate limiter for uploads
 * @param {Function} middleware.checkAccessCode - Access code validator
 * @param {Function} middleware.multerUpload - Multer file upload middleware
 */
function configureRoutes(middleware = {}) {
  const router = express.Router();

  // Mount standard routes
  router.use('/tournaments', tournamentRoutes);
  router.use('/games', gameRoutes);
  router.use('/blunders', blunderRoutes);
  router.use('/health', healthRoutes);
  router.use('/', dashboardRoutes);  // Dashboard routes mounted at root /api/

  // Mount upload routes with required middleware
  if (middleware.uploadLimiter && middleware.checkAccessCode && middleware.multerUpload) {
    // File upload endpoints (multipart/form-data)
    router.post('/upload',
      middleware.uploadLimiter,
      middleware.checkAccessCode,
      middleware.multerUpload.single('pgn'),
      uploadController.upload.bind(uploadController)
    );
    router.post('/upload/pgn',
      middleware.uploadLimiter,
      middleware.checkAccessCode,
      middleware.multerUpload.single('pgn'),
      uploadController.upload.bind(uploadController)
    );

    // Manual PGN entry endpoint (JSON)
    router.post('/manual-pgn',
      middleware.uploadLimiter,
      middleware.checkAccessCode,
      uploadController.manualEntry.bind(uploadController)
    );
  }

  // TODO: Mount other routes
  // router.use('/puzzles', puzzleRoutes);
  // router.use('/learning-path', learningPathRoutes);

  // Special route for tournament-folders (doesn't fit the pattern)
  const tournamentController = require('../controllers/tournament.controller');
  router.get('/tournament-folders', tournamentController.listFolders.bind(tournamentController));

  return router;
}

module.exports = configureRoutes;
