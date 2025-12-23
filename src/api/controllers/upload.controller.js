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

class UploadController {
  constructor() {
    this.uploadService = new PGNUploadService();
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

      // Check if this is a multipart file upload (req.file from multer)
      if (req.file) {
        // File upload via FormData
        pgnContent = req.file.buffer.toString('utf-8');
        originalFileName = req.file.originalname || 'uploaded.pgn';
        assignedTournamentId = req.body.tournamentId ? parseInt(req.body.tournamentId) : null;
      } else if (req.body.pgnContent) {
        // JSON format (manual entry)
        pgnContent = req.body.pgnContent;
        assignedTournamentId = req.body.tournamentId ? parseInt(req.body.tournamentId) : null;
      } else {
        return res.status(400).json({ error: 'No PGN content provided. Send either a file upload or JSON with pgnContent field.' });
      }

      // Delegate to PGNUploadService
      const result = await this.uploadService.processPGNUpload({
        pgnContent,
        originalFileName,
        assignedTournamentId,
        userId: req.userId
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

module.exports = new UploadController();
