/**
 * Blunder Controller Unit Tests
 *
 * IMPORTANT: This test file uses mocked dependencies and does NOT touch
 * the real database. All database operations are mocked using jest.mock().
 * This ensures the development database (chess_analysis.db) is never affected.
 */

// Set test environment BEFORE importing modules
process.env.NODE_ENV = 'test';

const blunderController = require('../../src/api/controllers/blunder.controller');
const { getDatabase } = require('../../src/models/database');
const BlunderService = require('../../src/services/BlunderService');

// Mock the database module - no real database operations occur
jest.mock('../../src/models/database');

// Mock BlunderService
jest.mock('../../src/services/BlunderService');

describe('BlunderController', () => {
  let mockDb;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Create mock database with all helper methods
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };

    // Mock getDatabase to return our mock
    getDatabase.mockReturnValue(mockDb);

    // Mock BlunderService
    const mockBlunderService = {
      getBlundersForUser: jest.fn()
    };
    BlunderService.mockImplementation(() => mockBlunderService);

    // Create mock request and response objects
    mockReq = {
      params: {},
      query: {},
      body: {},
      userId: 'test-user-123' // Added for authentication context
    };

    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('list()', () => {
    it('should return list of blunders without filters', async () => {
      const mockBlunders = [
        {
          id: 1,
          game_id: 1,
          move_number: 15,
          phase: 'middlegame',
          tactical_theme: 'hanging_piece',
          centipawn_loss: 250,
          white_player: 'Player1',
          black_player: 'Player2',
          date: '2024-01-01',
          event: 'Test Tournament'
        },
        {
          id: 2,
          game_id: 2,
          move_number: 8,
          phase: 'opening',
          tactical_theme: 'fork',
          centipawn_loss: 300,
          white_player: 'Player3',
          black_player: 'Player4',
          date: '2024-01-02',
          event: 'Test Event'
        }
      ];

      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.list(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT bd.*, g.white_player'),
        []
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        count: 2,
        blunders: mockBlunders
      });
    });

    it('should filter blunders by phase', async () => {
      mockReq.query.phase = 'opening';

      const mockBlunders = [
        {
          id: 1,
          phase: 'opening',
          tactical_theme: 'fork',
          centipawn_loss: 200
        }
      ];

      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.list(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.phase = ?'),
        ['opening']
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        count: 1,
        blunders: mockBlunders
      });
    });

    it('should filter blunders by theme', async () => {
      mockReq.query.theme = 'hanging_piece';

      mockDb.all.mockResolvedValue([]);

      await blunderController.list(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.tactical_theme = ?'),
        ['hanging_piece']
      );
    });

    it('should filter blunders by learned status', async () => {
      mockReq.query.learned = 'true';

      mockDb.all.mockResolvedValue([]);

      await blunderController.list(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.learned = ?'),
        [1]
      );
    });

    it('should filter blunders by severity', async () => {
      mockReq.query.severity = 'major';

      mockDb.all.mockResolvedValue([]);

      await blunderController.list(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.blunder_severity = ?'),
        ['major']
      );
    });

    it('should filter blunders by difficulty range', async () => {
      mockReq.query.minDifficulty = '3';
      mockReq.query.maxDifficulty = '5';

      mockDb.all.mockResolvedValue([]);

      await blunderController.list(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.difficulty_level >= ?'),
        [3, 5]
      );
    });

    it('should handle database errors gracefully', async () => {
      mockDb.all.mockRejectedValue(new Error('Database error'));

      await blunderController.list(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
    });

    it('should apply multiple filters simultaneously', async () => {
      mockReq.query = {
        phase: 'middlegame',
        theme: 'fork',
        learned: 'false',
        severity: 'major',
        minDifficulty: '4'
      };

      mockDb.all.mockResolvedValue([]);

      await blunderController.list(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.phase = ?'),
        ['middlegame', 'fork', 0, 'major', 4]
      );
    });
  });

  describe('getByPhase()', () => {
    it('should return blunders for valid phase with statistics', async () => {
      mockReq.params.phase = 'opening';

      const mockBlunders = [
        {
          id: 1,
          phase: 'opening',
          centipawn_loss: 200,
          blunder_severity: 'major',
          learned: 1
        },
        {
          id: 2,
          phase: 'opening',
          centipawn_loss: 300,
          blunder_severity: 'moderate',
          learned: 0
        }
      ];

      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.getByPhase(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE bd.phase = ?'),
        ['opening']
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'opening',
          stats: expect.objectContaining({
            totalBlunders: 2,
            averageCentipawnLoss: 250,
            severityBreakdown: expect.any(Object),
            learned: 1,
            unlearned: 1
          }),
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

    it('should handle empty blunders list', async () => {
      mockReq.params.phase = 'endgame';
      mockDb.all.mockResolvedValue([]);

      await blunderController.getByPhase(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            totalBlunders: 0,
            averageCentipawnLoss: 0
          })
        })
      );
    });

    it('should calculate severity breakdown correctly', async () => {
      mockReq.params.phase = 'middlegame';

      const mockBlunders = [
        { blunder_severity: 'critical', centipawn_loss: 500, learned: 1 },
        { blunder_severity: 'major', centipawn_loss: 300, learned: 0 },
        { blunder_severity: 'major', centipawn_loss: 250, learned: 0 },
        { blunder_severity: 'moderate', centipawn_loss: 150, learned: 1 }
      ];

      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.getByPhase(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            severityBreakdown: {
              minor: 0,
              moderate: 1,
              major: 2,
              critical: 1
            }
          })
        })
      );
    });
  });

  describe('getByTheme()', () => {
    it('should return blunders for specific theme with statistics', async () => {
      mockReq.params.theme = 'hanging_piece';

      const mockBlunders = [
        {
          id: 1,
          tactical_theme: 'hanging_piece',
          phase: 'opening',
          centipawn_loss: 250,
          difficulty_level: 3,
          learned: 1
        },
        {
          id: 2,
          tactical_theme: 'hanging_piece',
          phase: 'middlegame',
          centipawn_loss: 300,
          difficulty_level: 4,
          learned: 0
        }
      ];

      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.getByTheme(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE bd.tactical_theme = ?'),
        ['hanging_piece']
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'hanging_piece',
          stats: expect.objectContaining({
            totalBlunders: 2,
            averageCentipawnLoss: 275,
            phaseBreakdown: {
              opening: 1,
              middlegame: 1,
              endgame: 0
            },
            learned: 1,
            averageDifficulty: '3.5'
          }),
          blunders: mockBlunders
        })
      );
    });

    it('should handle empty blunders list for theme', async () => {
      mockReq.params.theme = 'rare_theme';
      mockDb.all.mockResolvedValue([]);

      await blunderController.getByTheme(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            totalBlunders: 0,
            averageCentipawnLoss: 0,
            averageDifficulty: 0
          })
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
        { id: 1, tactical_theme: 'fork', learned: 0, mastery_score: 20 },
        { id: 2, tactical_theme: 'fork', learned: 0, mastery_score: 30 },
        { id: 3, tactical_theme: 'pin', learned: 0, mastery_score: 40 }
      ];

      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.getUnlearned(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE bd.learned = 0 OR bd.mastery_score < ?'),
        [70]
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalUnlearned: 3,
          byTheme: {
            fork: expect.arrayContaining([
              expect.objectContaining({ id: 1 }),
              expect.objectContaining({ id: 2 })
            ]),
            pin: expect.arrayContaining([
              expect.objectContaining({ id: 3 })
            ])
          },
          blunders: mockBlunders
        })
      );
    });

    it('should use custom minMastery threshold', async () => {
      mockReq.query.minMastery = '50';
      mockDb.all.mockResolvedValue([]);

      await blunderController.getUnlearned(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.any(String),
        ['50'] // Query params are strings
      );
    });

    it('should handle blunders without tactical_theme', async () => {
      const mockBlunders = [
        { id: 1, tactical_theme: null, learned: 0 }
      ];

      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.getUnlearned(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          byTheme: {
            unknown: expect.arrayContaining([
              expect.objectContaining({ id: 1 })
            ])
          }
        })
      );
    });
  });

  describe('markReviewed()', () => {
    it('should mark blunder as reviewed and update mastery', async () => {
      mockReq.params.id = '1';

      const mockBlunder = {
        id: 1,
        review_count: 2,
        mastery_score: 40
      };

      const updatedBlunder = {
        id: 1,
        review_count: 3,
        mastery_score: 65,
        last_reviewed: expect.any(String)
      };

      mockDb.get
        .mockResolvedValueOnce(mockBlunder) // First call to check existence
        .mockResolvedValueOnce(updatedBlunder); // Second call to get updated blunder

      mockDb.run.mockResolvedValue({ changes: 1 });

      await blunderController.markReviewed(mockReq, mockRes);

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE bd.id = ?'),
        [1]
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE blunder_details'),
        expect.arrayContaining([3, expect.any(String), expect.any(Number)])
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        blunder: updatedBlunder
      });
    });

    it('should return 404 when blunder not found', async () => {
      mockReq.params.id = '999';
      mockDb.get.mockResolvedValue(null);

      await blunderController.markReviewed(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Blunder not found' });
    });

    it('should increment review count from zero', async () => {
      mockReq.params.id = '1';

      const mockBlunder = {
        id: 1,
        review_count: 0,
        mastery_score: 0
      };

      mockDb.get.mockResolvedValueOnce(mockBlunder).mockResolvedValueOnce(mockBlunder);
      mockDb.run.mockResolvedValue({ changes: 1 });

      await blunderController.markReviewed(mockReq, mockRes);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1]) // review_count should be 1
      );
    });

    it('should handle database errors', async () => {
      mockReq.params.id = '1';
      mockDb.get.mockRejectedValue(new Error('Database error'));

      await blunderController.markReviewed(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('markLearned()', () => {
    it('should mark blunder as learned and set mastery to 100', async () => {
      mockReq.params.id = '1';
      mockReq.body = { learned: true };

      const mockBlunder = {
        id: 1,
        learned: 0,
        mastery_score: 50
      };

      const updatedBlunder = {
        id: 1,
        learned: 1,
        mastery_score: 100
      };

      mockDb.get
        .mockResolvedValueOnce(mockBlunder)
        .mockResolvedValueOnce(updatedBlunder);

      mockDb.run.mockResolvedValue({ changes: 1 });

      await blunderController.markLearned(mockReq, mockRes);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE blunder_details'),
        expect.arrayContaining([1, 100]) // learned=1, mastery=100
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        blunder: updatedBlunder
      });
    });

    it('should mark blunder as unlearned without changing mastery', async () => {
      mockReq.params.id = '1';
      mockReq.body = { learned: false };

      const mockBlunder = {
        id: 1,
        learned: 1,
        mastery_score: 100
      };

      const updatedBlunder = {
        id: 1,
        learned: 0,
        mastery_score: 100
      };

      mockDb.get
        .mockResolvedValueOnce(mockBlunder)
        .mockResolvedValueOnce(updatedBlunder);

      mockDb.run.mockResolvedValue({ changes: 1 });

      await blunderController.markLearned(mockReq, mockRes);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE blunder_details'),
        expect.arrayContaining([0, 100]) // learned=0, mastery unchanged
      );
    });

    it('should update notes when provided', async () => {
      mockReq.params.id = '1';
      mockReq.body = { learned: true, notes: 'Remember to check for tactics' };

      const mockBlunder = { id: 1, learned: 0, mastery_score: 50 };

      mockDb.get
        .mockResolvedValueOnce(mockBlunder)
        .mockResolvedValueOnce(mockBlunder);

      mockDb.run.mockResolvedValue({ changes: 1 });

      await blunderController.markLearned(mockReq, mockRes);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('notes = ?'),
        expect.arrayContaining(['Remember to check for tactics'])
      );
    });

    it('should return 404 when blunder not found', async () => {
      mockReq.params.id = '999';
      mockReq.body = { learned: true };

      mockDb.get.mockResolvedValue(null);

      await blunderController.markLearned(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Blunder not found' });
    });
  });

  describe('getDashboard()', () => {
    it('should return comprehensive dashboard statistics', async () => {
      const mockBlunders = [
        {
          id: 1,
          game_id: 1,
          move_number: 10,
          phase: 'opening',
          tactical_theme: 'fork',
          centipawn_loss: 250,
          blunder_severity: 'major',
          learned: 1,
          mastery_score: 90,
          created_at: new Date().toISOString(),
          white_player: mockReq.userId,
          black_player: 'Opponent1',
          player_color: 'white',
          date: '2024-01-01',
          event: 'Tournament 1'
        },
        {
          id: 2,
          game_id: 2,
          move_number: 25,
          phase: 'middlegame',
          tactical_theme: 'pin',
          centipawn_loss: 400,
          blunder_severity: 'critical',
          learned: 0,
          mastery_score: 30,
          created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
          white_player: 'Opponent2',
          black_player: mockReq.userId,
          player_color: 'black',
          date: '2023-12-01',
          event: 'Tournament 2'
        }
      ];

      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.getDashboard(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE bd.is_blunder = TRUE'),
        [mockReq.userId]
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          overview: expect.objectContaining({
            totalBlunders: 2,
            avgCentipawnLoss: 325,
            mostCostlyBlunder: expect.objectContaining({
              gameId: 2,
              loss: 400
            }),
            trend: expect.any(Object)
          }),
          byPhase: expect.objectContaining({
            opening: expect.any(Object),
            middlegame: expect.any(Object),
            endgame: expect.any(Object)
          }),
          byTheme: expect.any(Array),
          bySeverity: expect.objectContaining({
            critical: 1,
            major: 1,
            moderate: 0,
            minor: 0
          }),
          topPatterns: expect.any(Array),
          learningProgress: expect.objectContaining({
            learnedCount: 1,
            unlearnedCount: 1,
            totalCount: 2,
            percentage: '50.0',
            masteredThemes: expect.any(Array),
            recommendations: expect.any(Array)
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
            totalBlunders: 0,
            avgCentipawnLoss: 0,
            mostCostlyBlunder: null
          })
        })
      );
    });

    it('should calculate trend correctly', async () => {
      const now = Date.now();
      const mockBlunders = [
        {
          centipawn_loss: 200,
          created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
          phase: 'opening',
          tactical_theme: 'fork',
          blunder_severity: 'major',
          learned: 0,
          white_player: mockReq.userId,
          player_color: 'white'
        },
        {
          centipawn_loss: 300,
          created_at: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
          phase: 'middlegame',
          tactical_theme: 'pin',
          blunder_severity: 'critical',
          learned: 0,
          white_player: mockReq.userId,
          player_color: 'white'
        },
        {
          centipawn_loss: 250,
          created_at: new Date(now - 50 * 24 * 60 * 60 * 1000).toISOString(), // 50 days ago
          phase: 'endgame',
          tactical_theme: 'skewer',
          blunder_severity: 'major',
          learned: 0,
          white_player: mockReq.userId,
          player_color: 'white'
        }
      ];

      mockDb.all.mockResolvedValue(mockBlunders);

      await blunderController.getDashboard(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          overview: expect.objectContaining({
            trend: expect.objectContaining({
              lastMonth: 1, // 1 blunder in last 30 days
              previousMonth: 2, // 2 blunders in previous 30 days
              improving: true // fewer blunders recently
            })
          })
        })
      );
    });
  });

  describe('getTimeline()', () => {
    it('should return blunder timeline grouped by date', async () => {
      const mockTimeline = [
        { date: '2024-01-15', count: 3, avgLoss: 250.5 },
        { date: '2024-01-14', count: 1, avgLoss: 180.0 },
        { date: '2024-01-10', count: 2, avgLoss: 320.7 }
      ];

      mockDb.all.mockResolvedValue(mockTimeline);

      await blunderController.getTimeline(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY DATE(bd.created_at)'),
        [mockReq.userId]
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        data: [
          { date: '2024-01-15', count: 3, avgLoss: 251 },
          { date: '2024-01-14', count: 1, avgLoss: 180 },
          { date: '2024-01-10', count: 2, avgLoss: 321 }
        ],
        totalDays: 3
      });
    });

    it('should filter timeline by date range', async () => {
      mockReq.query.startDate = '2024-01-01';
      mockReq.query.endDate = '2024-01-31';

      mockDb.all.mockResolvedValue([]);

      await blunderController.getTimeline(mockReq, mockRes);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND DATE(bd.created_at) >= ?'),
        [mockReq.userId, '2024-01-01', '2024-01-31']
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
});
