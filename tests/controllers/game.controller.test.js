/**
 * Game Controller Unit Tests
 *
 * IMPORTANT: This test file uses mocked dependencies and does NOT touch
 * the real database. All database operations are mocked using jest.mock().
 * This ensures the development database (chess_analysis.db) is never affected.
 */

// Set test environment BEFORE importing modules
process.env.NODE_ENV = 'test';

const gameController = require('../../src/api/controllers/game.controller');
const { getDatabase } = require('../../src/models/database');

// Mock the database module - no real database operations occur
jest.mock('../../src/models/database');
jest.mock('../../src/models/opening-detector');
jest.mock('../../src/models/accuracy-calculator');

describe('GameController', () => {
  let mockDb;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Create mock database with all helper methods
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      getGameAnalysis: jest.fn(),
      getAlternativeMoves: jest.fn(),
      getPositionEvaluation: jest.fn()
    };

    // Mock getDatabase to return our mock
    getDatabase.mockReturnValue(mockDb);

    // Create mock request and response objects
    mockReq = {
      params: {},
      query: {},
      userId: 'test-user-id'
    };

    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('list()', () => {
    it('should return list of games with openings', async () => {
      const mockGames = [
        {
          id: 1,
          white_player: 'Player1',
          black_player: 'Player2',
          result: '1-0',
          pgn_content: '[ECO "B10"]'
        }
      ];

      mockDb.all.mockResolvedValue(mockGames);
      mockDb.get.mockResolvedValue({ opening_name: 'Caro-Kann Defense' });

      await gameController.list(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ?'),
        ['test-user-id']
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            opening: 'Caro-Kann Defense'
          })
        ])
      );
    });

    it('should handle database errors gracefully', async () => {
      mockDb.all.mockRejectedValue(new Error('Database error'));

      await gameController.list(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should use Unknown Opening when ECO not found', async () => {
      const mockGames = [
        {
          id: 1,
          white_player: 'Player1',
          black_player: 'Player2',
          pgn_content: null
        }
      ];

      mockDb.all.mockResolvedValue(mockGames);

      await gameController.list(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            opening: 'Unknown Opening'
          })
        ])
      );
    });
  });

  describe('getById()', () => {
    it('should return game by ID', async () => {
      mockReq.params.id = '1';
      const mockGame = {
        id: 1,
        white_player: 'Player1',
        black_player: 'Player2',
        pgn_content: '[ECO "B10"]'
      };

      mockDb.get
        .mockResolvedValueOnce(mockGame) // Game query
        .mockResolvedValueOnce({ opening_name: 'Caro-Kann Defense' }); // Opening name query

      await gameController.getById(mockReq, mockRes);

      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT * FROM games WHERE id = ? AND user_id = ?',
        [1, 'test-user-id']
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          opening: 'Caro-Kann Defense'
        })
      );
    });

    it('should return 404 when game not found', async () => {
      mockReq.params.id = '999';
      mockDb.get.mockResolvedValue(null);

      await gameController.getById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Game not found' });
    });

    it('should handle database errors', async () => {
      mockReq.params.id = '1';
      mockDb.get.mockRejectedValue(new Error('Database error'));

      await gameController.getById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to retrieve game' });
    });
  });

  describe('getAnalysis()', () => {
    it('should return analysis for a game with opening extracted', async () => {
      mockReq.params.id = '1';
      const mockAnalysis = {
        game: { id: 1, white_player: 'Player1', black_player: 'Player2' },
        analysis: [
          { move_number: 1, centipawn_loss: 10 },
          { move_number: 2, centipawn_loss: 15 }
        ]
      };

      mockDb.getGameAnalysis.mockResolvedValue(mockAnalysis);

      await gameController.getAnalysis(mockReq, mockRes);

      expect(mockDb.getGameAnalysis).toHaveBeenCalledWith(1, 'test-user-id');
      // Response should include opening field (defaults to 'Unknown Opening' when no pgn_content)
      expect(mockRes.json).toHaveBeenCalledWith({
        ...mockAnalysis,
        game: {
          ...mockAnalysis.game,
          opening: 'Unknown Opening'
        }
      });
    });

    it('should return empty array on error', async () => {
      mockReq.params.id = '1';
      mockDb.getGameAnalysis.mockRejectedValue(new Error('Database error'));

      await gameController.getAnalysis(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getAlternatives()', () => {
    it('should return alternative moves', async () => {
      mockReq.params.id = '1';
      mockReq.params.moveNumber = '10';
      const mockAlternatives = [
        { alternative_move: 'Nf3', evaluation: 50, line_moves: 'Nf3 d5 e3' }
      ];
      const mockPosition = { moveNumber: 10, evaluation: 30 };

      mockDb.getAlternativeMoves.mockResolvedValue(mockAlternatives);
      mockDb.getPositionEvaluation.mockResolvedValue(mockPosition);

      await gameController.getAlternatives(mockReq, mockRes);

      expect(mockDb.getAlternativeMoves).toHaveBeenCalledWith(1, 10, 'test-user-id');
      expect(mockDb.getPositionEvaluation).toHaveBeenCalledWith(1, 10, 'test-user-id');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        position: mockPosition,
        alternatives: expect.arrayContaining([
          expect.objectContaining({
            move: 'Nf3',
            evaluation: 50,
            line: ['Nf3', 'd5', 'e3'],
            evaluationDiff: 20
          })
        ])
      }));
    });
  });

  describe('getBlunders()', () => {
    it('should return blunders for a game', async () => {
      mockReq.params.id = '1';
      const mockBlunders = [
        { move_number: 5, is_blunder: true },
        { move_number: 12, is_blunder: true }
      ];

      mockDb.all.mockResolvedValue(mockBlunders);

      await gameController.getBlunders(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('is_blunder = ?'),
        [1, true, 'test-user-id']
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockBlunders);
    });

    it('should return empty array on error', async () => {
      mockReq.params.id = '1';
      mockDb.all.mockRejectedValue(new Error('Database error'));

      await gameController.getBlunders(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getAccuracy()', () => {
    it('should calculate accuracy for a game', async () => {
      mockReq.params.id = '1';

      const mockGame = {
        white_player: 'AdvaitKumar1213',
        black_player: 'Opponent'
      };

      const mockAnalysis = [
        { move_number: 1, centipawn_loss: 10 },
        { move_number: 2, centipawn_loss: 15 }
      ];

      mockDb.get.mockResolvedValue(mockGame);
      mockDb.all.mockResolvedValue(mockAnalysis);

      const AccuracyCalculator = require('../../src/models/accuracy-calculator');
      AccuracyCalculator.calculatePlayerAccuracy = jest.fn().mockReturnValue(85);

      await gameController.getAccuracy(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        playerAccuracy: 85,
        opponentAccuracy: 85,
        whiteAccuracy: 85,
        blackAccuracy: 85
      }));
    });

    it('should return 404 when game not found', async () => {
      mockReq.params.id = '999';
      mockDb.get.mockResolvedValue(null);

      await gameController.getAccuracy(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getPerformance()', () => {
    it('should return performance metrics for a game', async () => {
      mockReq.params.id = '1';

      const mockGame = {
        id: 1,
        white_player: 'test-user-id',
        black_player: 'Opponent',
        result: '1-0',
        pgn_content: '[ECO "B10"]',
        user_color: 'white'
      };

      const mockBlunderCount = { count: 2 };
      const mockAnalysis = [
        { move_number: 1, centipawn_loss: 10 },
        { move_number: 2, centipawn_loss: 15 },
        { move_number: 3, centipawn_loss: 12 }
      ];

      mockDb.get
        .mockResolvedValueOnce(mockGame) // First call for game
        .mockResolvedValueOnce({ opening_name: 'Caro-Kann Defense' }) // Second call for opening name
        .mockResolvedValueOnce(mockBlunderCount); // Third call for blunder count
      mockDb.all.mockResolvedValue(mockAnalysis);

      const AccuracyCalculator = require('../../src/models/accuracy-calculator');
      AccuracyCalculator.calculatePlayerAccuracy = jest.fn().mockReturnValue(85);

      await gameController.getPerformance(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          blunders: 2,
          accuracy: 85,
          playerColor: 'white',
          opening: 'Caro-Kann Defense',
          gameId: 1,
          moves: expect.any(Number),
          totalMoves: 3
        })
      );
    });

    it('should handle game not found', async () => {
      mockReq.params.id = '999';
      mockDb.get.mockResolvedValue(null);

      await gameController.getPerformance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getPhases()', () => {
    it('should return phase analysis', async () => {
      mockReq.params.id = '1';

      const mockGame = {
        white_player: 'AdvaitKumar1213',
        black_player: 'Opponent'
      };

      const mockAnalysis = [
        { move_number: 1, centipawn_loss: 10 },
        { move_number: 3, centipawn_loss: 15 },
        { move_number: 25, centipawn_loss: 20 },
        { move_number: 27, centipawn_loss: 18 },
        { move_number: 45, centipawn_loss: 25 },
        { move_number: 47, centipawn_loss: 22 }
      ];

      // Mock all blunder count queries for each phase
      mockDb.get
        .mockResolvedValueOnce(mockGame) // First call for game
        .mockResolvedValueOnce({ count: 0 }) // Opening blunders
        .mockResolvedValueOnce({ count: 0 }) // Middlegame blunders
        .mockResolvedValueOnce({ count: 0 }); // Endgame blunders
      mockDb.all.mockResolvedValue(mockAnalysis);

      await gameController.getPhases(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          opening: expect.objectContaining({
            accuracy: expect.any(Number),
            description: expect.any(String)
          }),
          middlegame: expect.objectContaining({
            accuracy: expect.any(Number),
            description: expect.any(String)
          }),
          endgame: expect.objectContaining({
            accuracy: expect.any(Number),
            description: expect.any(String)
          })
        })
      );
    });

    it('should handle game not found', async () => {
      mockReq.params.id = '999';
      mockDb.get.mockResolvedValue(null);

      await gameController.getPhases(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('_getOpeningName()', () => {
    it('should return opening name for valid ECO code', async () => {
      mockDb.get.mockResolvedValue({ opening_name: 'Sicilian Defense' });

      const result = await gameController._getOpeningName('B20');

      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT opening_name FROM chess_openings WHERE eco_code = ?',
        ['B20']
      );
      expect(result).toBe('Sicilian Defense');
    });

    it('should return null when ECO not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const result = await gameController._getOpeningName('XXX');

      expect(result).toBeNull();
    });

    it('should return null on database error', async () => {
      mockDb.get.mockRejectedValue(new Error('Database error'));

      const result = await gameController._getOpeningName('B20');

      expect(result).toBeNull();
    });
  });
});
