/**
 * Blunder Controller Unit Tests
 *
 * Tests the blunder controller's HTTP request handling and delegation to BlunderService.
 * All dependencies are mocked - no real database or service calls are made.
 */

process.env.NODE_ENV = 'test';

const blunderController = require('../../src/api/controllers/blunder.controller');
const { getDatabase } = require('../../src/models/database');
const BlunderService = require('../../src/services/BlunderService');

// Mock dependencies
jest.mock('../../src/models/database');
jest.mock('../../src/services/BlunderService');

describe('BlunderController', () => {
  let mockDb;
  let mockBlunderService;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };

    // Mock getDatabase to return our mock
    getDatabase.mockReturnValue(mockDb);

    // Create mock BlunderService
    mockBlunderService = {
      getBlundersForUser: jest.fn()
    };
    BlunderService.mockImplementation(() => mockBlunderService);

    // Reset controller's cached service instance
    blunderController.blunderService = null;

    // Create mock request and response objects
    mockReq = {
      params: {},
      query: {},
      body: {},
      userId: 'test-user-123'
    };

    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('list()', () => {
    it('should return list of blunders using BlunderService', async () => {
      const mockBlunders = [
        { id: 1, phase: 'opening', centipawn_loss: 150 },
        { id: 2, phase: 'middlegame', centipawn_loss: 200 }
      ];

      mockBlunderService.getBlundersForUser.mockResolvedValue(mockBlunders);

      await blunderController.list(mockReq, mockRes);

      expect(mockBlunderService.getBlundersForUser).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({})
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        count: 2,
        blunders: mockBlunders
      });
    });

    it('should pass phase filter to BlunderService', async () => {
      mockReq.query.phase = 'opening';
      mockBlunderService.getBlundersForUser.mockResolvedValue([]);

      await blunderController.list(mockReq, mockRes);

      expect(mockBlunderService.getBlundersForUser).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({ phase: 'opening' })
      );
    });

    it('should pass theme filter to BlunderService', async () => {
      mockReq.query.theme = 'fork';
      mockBlunderService.getBlundersForUser.mockResolvedValue([]);

      await blunderController.list(mockReq, mockRes);

      expect(mockBlunderService.getBlundersForUser).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({ theme: 'fork' })
      );
    });

    it('should convert learned query param to boolean', async () => {
      mockReq.query.learned = 'true';
      mockBlunderService.getBlundersForUser.mockResolvedValue([]);

      await blunderController.list(mockReq, mockRes);

      expect(mockBlunderService.getBlundersForUser).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({ learned: true })
      );
    });

    it('should pass severity filter to BlunderService', async () => {
      mockReq.query.severity = 'major';
      mockBlunderService.getBlundersForUser.mockResolvedValue([]);

      await blunderController.list(mockReq, mockRes);

      expect(mockBlunderService.getBlundersForUser).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({ severity: 'major' })
      );
    });

    it('should pass difficulty range to BlunderService', async () => {
      mockReq.query.minDifficulty = '3';
      mockReq.query.maxDifficulty = '8';
      mockBlunderService.getBlundersForUser.mockResolvedValue([]);

      await blunderController.list(mockReq, mockRes);

      expect(mockBlunderService.getBlundersForUser).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          minDifficulty: '3',
          maxDifficulty: '8'
        })
      );
    });

    it('should handle errors and return 500', async () => {
      mockBlunderService.getBlundersForUser.mockRejectedValue(new Error('Service error'));

      await blunderController.list(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Service error' });
    });
  });

  describe('getByPhase()', () => {
    it('should return blunders for valid phase', async () => {
      mockReq.params.phase = 'opening';
      const mockBlunders = [
        { id: 1, phase: 'opening', centipawn_loss: 150, blunder_severity: 'major', learned: 0 }
      ];
      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.getByPhase(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.phase = ?'),
        ['test-user-123', 'opening']
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'opening',
          stats: expect.any(Object),
          blunders: mockBlunders
        })
      );
    });

    it('should return 400 for invalid phase', async () => {
      mockReq.params.phase = 'invalid_phase';

      await blunderController.getByPhase(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid phase. Must be opening, middlegame, or endgame'
      });
    });

    it('should handle database errors', async () => {
      mockReq.params.phase = 'opening';
      mockDb.all.mockRejectedValue(new Error('Database error'));

      await blunderController.getByPhase(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('getByTheme()', () => {
    it('should return blunders for specific theme', async () => {
      mockReq.params.theme = 'fork';
      const mockBlunders = [
        { id: 1, tactical_theme: 'fork', centipawn_loss: 200, phase: 'middlegame', learned: 0, difficulty_level: 5 }
      ];
      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.getByTheme(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.tactical_theme = ?'),
        ['test-user-123', 'fork']
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'fork',
          stats: expect.any(Object),
          blunders: mockBlunders
        })
      );
    });

    it('should handle empty results', async () => {
      mockReq.params.theme = 'rare_theme';
      mockDb.all.mockResolvedValue([]);

      await blunderController.getByTheme(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'rare_theme',
          stats: expect.any(Object),
          blunders: []
        })
      );
    });

    it('should handle database errors', async () => {
      mockReq.params.theme = 'fork';
      mockDb.all.mockRejectedValue(new Error('Database error'));

      await blunderController.getByTheme(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('getUnlearned()', () => {
    it('should return unlearned blunders grouped by theme', async () => {
      const mockBlunders = [
        { id: 1, tactical_theme: 'fork', learned: 0 },
        { id: 2, tactical_theme: 'fork', learned: 0 },
        { id: 3, tactical_theme: 'pin', learned: 0 }
      ];
      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.getUnlearned(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE g.user_id = ?'),
        ['test-user-123', 70]
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalUnlearned: 3,
          byTheme: expect.objectContaining({
            fork: expect.arrayContaining([
              expect.objectContaining({ id: 1 })
            ])
          })
        })
      );
    });

    it('should use custom minMastery threshold', async () => {
      mockReq.query.minMastery = '50';
      mockDb.all.mockResolvedValue([]);

      await blunderController.getUnlearned(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.anything(),
        ['test-user-123', '50']
      );
    });

    it('should handle database errors', async () => {
      mockDb.all.mockRejectedValue(new Error('Database error'));

      await blunderController.getUnlearned(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('markReviewed()', () => {
    it('should mark blunder as reviewed', async () => {
      mockReq.params.id = '123';
      const mockBlunder = { id: 123, review_count: 1, mastery_score: 50 };
      mockDb.get
        .mockResolvedValueOnce({ id: 123, review_count: 0, mastery_score: 0 }) // Verify blunder exists
        .mockResolvedValueOnce(mockBlunder); // Get updated blunder
      mockDb.run.mockResolvedValue({});

      await blunderController.markReviewed(mockReq, mockRes);

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE bd.id = ?'),
        [123, 'test-user-123']
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE blunder_details'),
        expect.arrayContaining([1, expect.any(String), expect.any(Number), expect.any(String), 123])
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        blunder: mockBlunder
      });
    });

    it('should return 404 when blunder not found', async () => {
      mockReq.params.id = '999';
      mockDb.get.mockResolvedValue(null);

      await blunderController.markReviewed(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Blunder not found'
      });
    });

    it('should handle database errors', async () => {
      mockReq.params.id = '123';
      mockDb.get.mockRejectedValue(new Error('Database error'));

      await blunderController.markReviewed(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('markLearned()', () => {
    it('should mark blunder as learned with mastery 100', async () => {
      mockReq.params.id = '123';
      mockReq.body.learned = true;
      const mockBlunder = { id: 123, learned: 1, mastery_score: 100 };
      mockDb.get
        .mockResolvedValueOnce({ id: 123, mastery_score: 50 })
        .mockResolvedValueOnce(mockBlunder);
      mockDb.run.mockResolvedValue({});

      await blunderController.markLearned(mockReq, mockRes);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('SET learned = ?'),
        [1, 100, expect.any(String), 123]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        blunder: mockBlunder
      });
    });

    it('should mark blunder as unlearned', async () => {
      mockReq.params.id = '123';
      mockReq.body.learned = false;
      const mockBlunder = { id: 123, learned: 0, mastery_score: 50 };
      mockDb.get
        .mockResolvedValueOnce({ id: 123, mastery_score: 50 })
        .mockResolvedValueOnce(mockBlunder);
      mockDb.run.mockResolvedValue({});

      await blunderController.markLearned(mockReq, mockRes);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('SET learned = ?'),
        [0, 50, expect.any(String), 123]
      );
    });

    it('should update notes when provided', async () => {
      mockReq.params.id = '123';
      mockReq.body.learned = true;
      mockReq.body.notes = 'Practiced this pattern';
      mockDb.get
        .mockResolvedValueOnce({ id: 123, mastery_score: 0 })
        .mockResolvedValueOnce({ id: 123 });
      mockDb.run.mockResolvedValue({});

      await blunderController.markLearned(mockReq, mockRes);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.anything(),
        [1, 100, expect.any(String), 'Practiced this pattern', 123]
      );
    });

    it('should return 404 when blunder not found', async () => {
      mockReq.params.id = '999';
      mockReq.body.learned = true;
      mockDb.get.mockResolvedValue(null);

      await blunderController.markLearned(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Blunder not found'
      });
    });
  });

  describe('getDashboard()', () => {
    it('should return comprehensive dashboard statistics', async () => {
      const mockBlunders = [
        {
          id: 1,
          game_id: 1,
          centipawn_loss: 250,
          phase: 'opening',
          blunder_severity: 'major',
          learned: 1,
          tactical_theme: 'fork',
          move_number: 10,
          created_at: '2024-01-01',
          mastery_score: 80
        },
        {
          id: 2,
          game_id: 2,
          centipawn_loss: 400,
          phase: 'middlegame',
          blunder_severity: 'critical',
          learned: 0,
          tactical_theme: 'pin',
          move_number: 15,
          created_at: '2024-01-02',
          mastery_score: 20
        }
      ];
      mockDb.all.mockResolvedValue(mockBlunders);
      mockDb.get.mockResolvedValue({ user_color: 'white' });

      await blunderController.getDashboard(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE g.user_id = ?'),
        ['test-user-123']
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          overview: expect.objectContaining({
            totalBlunders: 2,
            avgCentipawnLoss: 325
          }),
          byPhase: expect.any(Object),
          byTheme: expect.any(Array),
          bySeverity: expect.any(Object),
          topPatterns: expect.any(Array),
          learningProgress: expect.objectContaining({
            learnedCount: 1,
            unlearnedCount: 1,
            totalCount: 2
          }),
          recentBlunders: expect.any(Array)
        })
      );
    });

    it('should handle empty blunders list', async () => {
      mockDb.all.mockResolvedValue([]);

      await blunderController.getDashboard(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          overview: expect.objectContaining({
            totalBlunders: 0
          })
        })
      );
    });
  });

  describe('getTimeline()', () => {
    it('should return blunder timeline grouped by date', async () => {
      const mockTimeline = [
        { date: '2024-01-15', count: 3, avgLoss: 250 },
        { date: '2024-01-14', count: 1, avgLoss: 180 }
      ];
      mockDb.all.mockResolvedValue(mockTimeline);

      await blunderController.getTimeline(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY DATE(bd.created_at)'),
        ['test-user-123']
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        data: mockTimeline.map(row => ({
          date: row.date,
          count: row.count,
          avgLoss: Math.round(row.avgLoss)
        })),
        totalDays: 2
      });
    });

    it('should filter timeline by date range', async () => {
      mockReq.query.startDate = '2024-01-01';
      mockReq.query.endDate = '2024-01-31';
      mockDb.all.mockResolvedValue([]);

      await blunderController.getTimeline(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND DATE(bd.created_at) >= ?'),
        ['test-user-123', '2024-01-01', '2024-01-31']
      );
    });

    it('should handle empty timeline', async () => {
      mockDb.all.mockResolvedValue([]);

      await blunderController.getTimeline(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        data: [],
        totalDays: 0
      });
    });

    it('should handle database errors', async () => {
      mockDb.all.mockRejectedValue(new Error('Database error'));

      await blunderController.getTimeline(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('User ID Filtering', () => {
    it('should always pass userId to database queries', async () => {
      const testMethods = [
        { method: 'getByPhase', setup: () => { mockReq.params.phase = 'opening'; } },
        { method: 'getByTheme', setup: () => { mockReq.params.theme = 'fork'; } },
        { method: 'getUnlearned', setup: () => {} },
        { method: 'getDashboard', setup: () => {} },
        { method: 'getTimeline', setup: () => {} }
      ];

      for (const { method, setup } of testMethods) {
        jest.clearAllMocks();
        mockDb.all.mockResolvedValue([]);
        setup();

        await blunderController[method](mockReq, mockRes);

        expect(mockDb.all).toHaveBeenCalled();
        const [[query, params]] = mockDb.all.mock.calls;
        expect(params).toContain('test-user-123');
      }
    });

    it('should pass userId to BlunderService in list()', async () => {
      mockBlunderService.getBlundersForUser.mockResolvedValue([]);

      await blunderController.list(mockReq, mockRes);

      expect(mockBlunderService.getBlundersForUser).toHaveBeenCalledWith(
        'test-user-123',
        expect.any(Object)
      );
    });
  });
});
