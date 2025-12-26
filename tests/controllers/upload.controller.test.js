/**
 * Unit Tests for Upload Controller
 *
 * Tests upload controller methods with mocked PGNUploadService
 */

// Must mock PGNUploadService BEFORE requiring the controller
jest.mock('../../src/services/PGNUploadService');

const UploadController = require('../../src/api/controllers/upload.controller');
const PGNUploadService = require('../../src/services/PGNUploadService');

describe('UploadController', () => {
  let uploadController, mockReq, mockRes, mockUploadService, mockAnalyzer;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock request object
    mockReq = {
      body: {},
      params: {},
      query: {},
      userId: 'test-user-123',
      file: null
    };

    // Mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Mock analyzer (for shared analyzer pattern)
    mockAnalyzer = {
      isReady: true,
      analyzeGame: jest.fn(),
      close: jest.fn()
    };

    // Create mock methods
    mockUploadService = {
      processPGNUpload: jest.fn(),
      processManualEntry: jest.fn()
    };

    // Mock the PGNUploadService constructor to return our mock
    PGNUploadService.mockImplementation(() => mockUploadService);

    // Create controller instance with mock analyzer
    uploadController = new UploadController(mockAnalyzer);
  });

  describe('upload()', () => {
    describe('File Upload (Multipart)', () => {
      it('should process file upload successfully', async () => {
        const pgnContent = '[Event "Test"]\n1. e4 e5';
        mockReq.file = {
          buffer: Buffer.from(pgnContent),
          originalname: 'test-game.pgn'
        };
        mockReq.body = { tournamentId: '1' };

        const serviceResponse = {
          success: true,
          totalGames: 1,
          analyzedGames: 1,
          tournament: { id: 1, name: 'Test Tournament' }
        };
        mockUploadService.processPGNUpload.mockResolvedValue(serviceResponse);

        await uploadController.upload(mockReq, mockRes);

        expect(mockUploadService.processPGNUpload).toHaveBeenCalledWith({
          pgnContent,
          originalFileName: 'test-game.pgn',
          assignedTournamentId: 1,
          userId: 'test-user-123',
          userColor: null
        });
        expect(mockRes.json).toHaveBeenCalledWith(serviceResponse);
      });

      it('should handle missing originalname in file upload', async () => {
        const pgnContent = '[Event "Test"]\n1. e4 e5';
        mockReq.file = {
          buffer: Buffer.from(pgnContent)
          // No originalname
        };

        const serviceResponse = { success: true, totalGames: 1 };
        mockUploadService.processPGNUpload.mockResolvedValue(serviceResponse);

        await uploadController.upload(mockReq, mockRes);

        expect(mockUploadService.processPGNUpload).toHaveBeenCalledWith({
          pgnContent,
          originalFileName: 'uploaded.pgn', // Default
          assignedTournamentId: null,
          userId: 'test-user-123',
          userColor: null
        });
      });

      it('should parse tournamentId from body for file uploads', async () => {
        mockReq.file = {
          buffer: Buffer.from('[Event "Test"]\n1. e4 e5'),
          originalname: 'game.pgn'
        };
        mockReq.body = { tournamentId: '42' };

        mockUploadService.processPGNUpload.mockResolvedValue({ success: true });

        await uploadController.upload(mockReq, mockRes);

        expect(mockUploadService.processPGNUpload).toHaveBeenCalledWith(
          expect.objectContaining({
            assignedTournamentId: 42
          })
        );
      });
    });

    describe('JSON Upload', () => {
      it('should process JSON upload successfully', async () => {
        const pgnContent = '[Event "Test"]\n1. e4 e5';
        mockReq.body = {
          pgnContent,
          tournamentId: 5
        };

        const serviceResponse = {
          success: true,
          totalGames: 1,
          tournament: { id: 5, name: 'JSON Tournament' }
        };
        mockUploadService.processPGNUpload.mockResolvedValue(serviceResponse);

        await uploadController.upload(mockReq, mockRes);

        expect(mockUploadService.processPGNUpload).toHaveBeenCalledWith({
          pgnContent,
          originalFileName: 'uploaded.pgn',
          assignedTournamentId: 5,
          userId: 'test-user-123',
          userColor: null
        });
        expect(mockRes.json).toHaveBeenCalledWith(serviceResponse);
      });

      it('should handle JSON upload without tournamentId', async () => {
        mockReq.body = {
          pgnContent: '[Event "Test"]\n1. e4 e5'
        };

        mockUploadService.processPGNUpload.mockResolvedValue({ success: true });

        await uploadController.upload(mockReq, mockRes);

        expect(mockUploadService.processPGNUpload).toHaveBeenCalledWith(
          expect.objectContaining({
            assignedTournamentId: null
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should return 400 when no PGN content provided', async () => {
        mockReq.body = {}; // No pgnContent
        mockReq.file = null; // No file

        await uploadController.upload(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'No PGN content provided. Send either a file upload or JSON with pgnContent field.'
        });
        expect(mockUploadService.processPGNUpload).not.toHaveBeenCalled();
      });

      it('should return 500 when service throws error', async () => {
        mockReq.body = { pgnContent: '[Event "Test"]\n1. e4 e5' };
        mockUploadService.processPGNUpload.mockRejectedValue(new Error('Service error'));

        await uploadController.upload(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Service error'
        });
      });

      it('should return 500 with generic message when error has no message', async () => {
        mockReq.body = { pgnContent: '[Event "Test"]\n1. e4 e5' };
        mockUploadService.processPGNUpload.mockRejectedValue(new Error());

        await uploadController.upload(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Failed to process PGN file'
        });
      });
    });

    describe('Duplicate Handling', () => {
      it('should return duplicate response from service', async () => {
        mockReq.body = { pgnContent: '[Event "Test"]\n1. e4 e5' };

        const duplicateResponse = {
          success: true,
          duplicate: true,
          existingGameId: 42,
          message: 'PGN content already exists in database'
        };
        mockUploadService.processPGNUpload.mockResolvedValue(duplicateResponse);

        await uploadController.upload(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith(duplicateResponse);
      });
    });
  });

  describe('manualEntry()', () => {
    it('should process manual entry successfully', async () => {
      mockReq.body = {
        tournamentName: 'Manual Tournament',
        date: '2025-01-15',
        opponent: 'Opponent1',
        opponentElo: 1800,
        playerElo: 1850,
        result: '1-0',
        variant: '600+0',
        termination: 'Normal',
        playerColor: 'white',
        moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0'
      };

      const serviceResponse = {
        success: true,
        totalGames: 1,
        tournament: { id: 1, name: 'Manual Tournament' }
      };
      mockUploadService.processManualEntry.mockResolvedValue(serviceResponse);

      await uploadController.manualEntry(mockReq, mockRes);

      expect(mockUploadService.processManualEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          tournamentName: 'Manual Tournament',
          date: '2025-01-15',
          opponent: 'Opponent1',
          opponentElo: 1800,
          playerElo: 1850,
          result: '1-0',
          variant: '600+0',
          termination: 'Normal',
          playerColor: 'white',
          moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0',
          targetPlayer: 'AdvaitKumar1213' // From TARGET_PLAYER constant
        }),
        'test-user-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(serviceResponse);
    });

    it('should include all request body fields in gameData', async () => {
      mockReq.body = {
        tournamentName: 'Test',
        opponent: 'Player',
        moves: '1. e4 1-0',
        result: '1-0',
        playerColor: 'black',
        variant: '300+0',
        termination: 'Time',
        customField: 'customValue' // Extra field
      };

      mockUploadService.processManualEntry.mockResolvedValue({ success: true });

      await uploadController.manualEntry(mockReq, mockRes);

      expect(mockUploadService.processManualEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          customField: 'customValue',
          targetPlayer: 'AdvaitKumar1213'
        }),
        'test-user-123'
      );
    });

    it('should return 500 when service throws error', async () => {
      mockReq.body = {
        tournamentName: 'Test',
        opponent: 'Player',
        moves: '1. e4 1-0',
        result: '1-0',
        playerColor: 'white',
        variant: '600+0',
        termination: 'Normal'
      };

      mockUploadService.processManualEntry.mockRejectedValue(new Error('Manual entry error'));

      await uploadController.manualEntry(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Manual entry error'
      });
    });

    it('should return 500 with generic message when error has no message', async () => {
      mockReq.body = {
        tournamentName: 'Test',
        opponent: 'Player',
        moves: '1. e4 1-0',
        result: '1-0',
        playerColor: 'white',
        variant: '600+0',
        termination: 'Normal'
      };

      mockUploadService.processManualEntry.mockRejectedValue(new Error());

      await uploadController.manualEntry(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to process manual PGN entry'
      });
    });

    it('should handle missing fields gracefully (service validates)', async () => {
      mockReq.body = {
        tournamentName: 'Test'
        // Missing required fields
      };

      mockUploadService.processManualEntry.mockRejectedValue(
        new Error('Missing required fields')
      );

      await uploadController.manualEntry(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing required fields'
      });
    });
  });
});
