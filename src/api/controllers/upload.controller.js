/**
 * Upload Controller
 *
 * Handles all PGN file upload and manual game entry operations including:
 * - PGN file uploads via FormData
 * - Manual PGN entry
 * - Game analysis and storage
 * - Tournament linkage
 */

const { TARGET_PLAYER } = require('../../config/app-config');
const PGNUploadService = require('../../services/PGNUploadService');
const GameAnalysisService = require('../../services/GameAnalysisService');

class UploadController {
  constructor(sharedAnalyzer = null) {
    console.log(`🔧 [UploadController] Initializing with sharedAnalyzer: ${sharedAnalyzer ? 'YES' : 'NO'}`);
    if (sharedAnalyzer) {
      console.log(`🔧 [UploadController] Shared analyzer isReady: ${sharedAnalyzer.isReady}`);
    }

    // If sharedAnalyzer provided, create GameAnalysisService with it
    const analysisService = sharedAnalyzer
      ? new GameAnalysisService(sharedAnalyzer)
      : undefined;

    this.uploadService = new PGNUploadService({
      analysisService: analysisService
    });
  }
  /**
   * Handle PGN file upload or text content
   * POST /api/upload
   * POST /api/upload/pgn
   *
   * Supports two formats:
   * 1. Multipart/form-data: file upload with 'pgn' field (from frontend file upload)
   * 2. JSON: { pgnContent: "...", tournamentId?: number } (from manual entry)
   */
  async upload(req, res) {
    try {
      let pgnContent;
      let originalFileName = 'uploaded.pgn';
      let assignedTournamentId = null;
      let userColor = null;

      // Check if this is a multipart file upload (req.file from multer)
      if (req.file) {
        // File upload via FormData
        pgnContent = req.file.buffer.toString('utf-8');
        originalFileName = req.file.originalname || 'uploaded.pgn';
        assignedTournamentId = req.body.tournamentId ? parseInt(req.body.tournamentId) : null;
        userColor = req.body.userColor || null;  // Extract userColor from FormData
      } else if (req.body.pgnContent) {
        // JSON format (manual entry)
        pgnContent = req.body.pgnContent;
        assignedTournamentId = req.body.tournamentId ? parseInt(req.body.tournamentId) : null;
        userColor = req.body.userColor || null;  // Extract userColor from JSON
      } else {
        return res.status(400).json({ error: 'No PGN content provided. Send either a file upload or JSON with pgnContent field.' });
      }

      // Delegate to PGNUploadService
      const result = await this.uploadService.processPGNUpload({
        pgnContent,
        originalFileName,
        assignedTournamentId,
        userId: req.userId,
        userColor  // Pass userColor to service
      });

      res.json(result);
    } catch (error) {
      console.error('PGN upload error:', error);
      res.status(500).json({ error: error.message || 'Failed to process PGN file' });
    }
  }

  /**
   * Handle manual PGN entry
   * POST /api/manual-pgn
   */
  async manualEntry(req, res) {
    try {
      const gameData = {
        ...req.body,
        targetPlayer: TARGET_PLAYER
      };

      // Delegate to PGNUploadService
      const result = await this.uploadService.processManualEntry(gameData, req.userId);

      res.json(result);
    } catch (error) {
      console.error('Manual PGN entry error:', error);
      res.status(500).json({ error: error.message || 'Failed to process manual PGN entry' });
    }
  }
}

// Export the class, not a singleton instance
// This allows routes to create instance with shared analyzer
module.exports = UploadController;
