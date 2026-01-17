/**
 * DashboardService Unit Tests
 *
 * Tests dashboard service integration with BlunderService
 */

const DashboardService = require('../../src/services/DashboardService');
const BlunderService = require('../../src/services/BlunderService');

// Mock dependencies
jest.mock('../../src/services/BlunderService');
jest.mock('../../src/models/trend-calculator');
jest.mock('../../src/models/HeatmapCalculator');

describe('DashboardService', () => {
  let dashboardService;
  let mockDatabase;
  let mockBlunderService;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn()
    };

    // Create mock BlunderService
    mockBlunderService = {
      getBlunderCountForGame: jest.fn()
    };

    BlunderService.mockImplementation(() => mockBlunderService);

    dashboardService = new DashboardService({
      database: mockDatabase,
      blunderService: mockBlunderService
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlayerPerformance', () => {
    it('should use BlunderService to count blunders', async () => {
      const mockGames = [
        {
          id: 1,
          user_color: 'white',
          result: '1-0',
          white_elo: 1500,
          black_elo: 1450,
          created_at: '2025-01-01'
        }
      ];

      const mockAnalysis = [
        { move_number: 1, centipawn_loss: 10 }
      ];

      mockDatabase.all
        .mockResolvedValueOnce(mockGames)
        .mockResolvedValue(mockAnalysis);

      mockBlunderService.getBlunderCountForGame.mockResolvedValue(2);

      const result = await dashboardService.getPlayerPerformance('user123');

      expect(mockBlunderService.getBlunderCountForGame).toHaveBeenCalledWith(1, 'white');
      expect(result.overall.totalBlunders).toBe(2);
    });
  });

  describe('User ID Filtering', () => {
    it('should always include user_id filter in queries', async () => {
      mockDatabase.all.mockResolvedValue([]);
      mockBlunderService.getBlunderCountForGame.mockResolvedValue(0);

      const userId = 'test-user-123';

      await dashboardService.getTrendsData(userId);
      await dashboardService.getRatingTrends(null, userId);
      await dashboardService.generateHeatmap(userId);

      const allCalls = mockDatabase.all.mock.calls;
      allCalls.forEach(call => {
        const query = call[0];
        const params = call[1];
        expect(query).toMatch(/WHERE.*user_id.*=.*\?|g\.user_id = \?/);
        expect(params).toContain(userId);
      });
    });
  });

  // ============================================
  // Chess.com Insights Dashboard Methods (ADR 009)
  // ============================================

  describe('getAccuracyByResult', () => {
    it('should return empty stats when no games exist', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await dashboardService.getAccuracyByResult('user123');

      expect(result).toEqual({
        overall: { accuracy: 0, games: 0 },
        wins: { accuracy: 0, games: 0 },
        draws: { accuracy: 0, games: 0 },
        losses: { accuracy: 0, games: 0 }
      });
    });

    it('should categorize games by result correctly', async () => {
      const mockGames = [
        { id: 1, result: '1-0', user_color: 'white' },  // Win
        { id: 2, result: '0-1', user_color: 'white' },  // Loss
        { id: 3, result: '1/2-1/2', user_color: 'white' },  // Draw
        { id: 4, result: '0-1', user_color: 'black' }   // Win (black won)
      ];

      const mockAnalysis = [
        { move_number: 1, centipawn_loss: 20 },
        { move_number: 3, centipawn_loss: 30 }
      ];

      mockDatabase.all
        .mockResolvedValueOnce(mockGames)  // First call: get games
        .mockResolvedValue(mockAnalysis);   // Subsequent calls: get analysis

      const result = await dashboardService.getAccuracyByResult('user123');

      expect(result.wins.games).toBe(2);  // Game 1 (white won) + Game 4 (black won)
      expect(result.losses.games).toBe(1);  // Game 2
      expect(result.draws.games).toBe(1);   // Game 3
      expect(result.overall.games).toBe(4);
    });

    it('should filter by color when provided', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await dashboardService.getAccuracyByResult('user123', 'white');

      const query = mockDatabase.all.mock.calls[0][0];
      const params = mockDatabase.all.mock.calls[0][1];

      expect(query).toContain('user_color = ?');
      expect(params).toContain('white');
    });

    it('should calculate accuracy from centipawn loss', async () => {
      const mockGames = [
        { id: 1, result: '1-0', user_color: 'white' }
      ];

      // Low CPL = high accuracy
      const mockAnalysis = [
        { move_number: 1, centipawn_loss: 10 },
        { move_number: 3, centipawn_loss: 20 },
        { move_number: 5, centipawn_loss: 15 }
      ];

      mockDatabase.all
        .mockResolvedValueOnce(mockGames)
        .mockResolvedValue(mockAnalysis);

      const result = await dashboardService.getAccuracyByResult('user123');

      // Average CPL = (10 + 20 + 15) / 3 = 15
      // Accuracy = 100 - (15 / 3) = 95
      expect(result.wins.accuracy).toBe(95);
      expect(result.wins.avgCentipawnLoss).toBe(15);
    });
  });

  describe('getPhaseDistribution', () => {
    it('should return empty stats when no games exist', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await dashboardService.getPhaseDistribution('user123');

      expect(result).toEqual({
        overall: {
          opening: { count: 0, percentage: 0 },
          middlegame: { count: 0, percentage: 0 },
          endgame: { count: 0, percentage: 0 }
        },
        totalGames: 0
      });
    });

    it('should classify games ending in opening phase (moves 1-10)', async () => {
      const mockGames = [
        { id: 1, moves_count: 16, user_color: 'white' },  // 8 full moves -> opening
        { id: 2, moves_count: 20, user_color: 'white' }   // 10 full moves -> opening
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      const result = await dashboardService.getPhaseDistribution('user123');

      expect(result.overall.opening.count).toBe(2);
      expect(result.overall.opening.percentage).toBe(100);
      expect(result.overall.middlegame.count).toBe(0);
      expect(result.overall.endgame.count).toBe(0);
    });

    it('should classify games ending in middlegame phase (moves 11-30)', async () => {
      const mockGames = [
        { id: 1, moves_count: 40, user_color: 'white' },  // 20 full moves -> middlegame
        { id: 2, moves_count: 50, user_color: 'white' }   // 25 full moves -> middlegame
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      const result = await dashboardService.getPhaseDistribution('user123');

      expect(result.overall.middlegame.count).toBe(2);
      expect(result.overall.middlegame.percentage).toBe(100);
    });

    it('should classify games ending in endgame phase (moves 31+)', async () => {
      const mockGames = [
        { id: 1, moves_count: 80, user_color: 'white' },  // 40 full moves -> endgame
        { id: 2, moves_count: 100, user_color: 'white' }  // 50 full moves -> endgame
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      const result = await dashboardService.getPhaseDistribution('user123');

      expect(result.overall.endgame.count).toBe(2);
      expect(result.overall.endgame.percentage).toBe(100);
    });

    it('should calculate correct percentages for mixed phases', async () => {
      const mockGames = [
        { id: 1, moves_count: 16, user_color: 'white' },   // opening
        { id: 2, moves_count: 40, user_color: 'white' },   // middlegame
        { id: 3, moves_count: 80, user_color: 'white' },   // endgame
        { id: 4, moves_count: 80, user_color: 'white' }    // endgame
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      const result = await dashboardService.getPhaseDistribution('user123');

      expect(result.overall.opening.count).toBe(1);
      expect(result.overall.opening.percentage).toBe(25);
      expect(result.overall.middlegame.count).toBe(1);
      expect(result.overall.middlegame.percentage).toBe(25);
      expect(result.overall.endgame.count).toBe(2);
      expect(result.overall.endgame.percentage).toBe(50);
      expect(result.totalGames).toBe(4);
    });

    it('should filter by color when provided', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await dashboardService.getPhaseDistribution('user123', 'black');

      const query = mockDatabase.all.mock.calls[0][0];
      const params = mockDatabase.all.mock.calls[0][1];

      expect(query).toContain('user_color = ?');
      expect(params).toContain('black');
    });
  });

  describe('getAccuracyByPhase', () => {
    it('should return empty stats when no games exist', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await dashboardService.getAccuracyByPhase('user123');

      expect(result).toEqual({
        opening: { accuracy: 0, gamesWithData: 0 },
        middlegame: { accuracy: 0, gamesWithData: 0 },
        endgame: { accuracy: 0, gamesWithData: 0 },
        totalGames: 0
      });
    });

    it('should use pre-computed phase_stats when available', async () => {
      const mockPhaseStats = [
        { game_id: 1, opening_accuracy: 90, middlegame_accuracy: 80, endgame_accuracy: 70, user_color: 'white' },
        { game_id: 2, opening_accuracy: 85, middlegame_accuracy: 75, endgame_accuracy: 65, user_color: 'white' }
      ];

      mockDatabase.all.mockResolvedValueOnce(mockPhaseStats);

      const result = await dashboardService.getAccuracyByPhase('user123');

      expect(result.opening.accuracy).toBe(88);  // (90 + 85) / 2 = 87.5, rounded to 88
      expect(result.middlegame.accuracy).toBe(78);  // (80 + 75) / 2 = 77.5, rounded to 78
      expect(result.endgame.accuracy).toBe(68);  // (70 + 65) / 2 = 67.5, rounded to 68
      expect(result.opening.gamesWithData).toBe(2);
      expect(result.totalGames).toBe(2);
    });

    it('should fall back to raw analysis when phase_stats is empty', async () => {
      // First call returns empty phase_stats
      mockDatabase.all.mockResolvedValueOnce([]);

      // Second call returns games
      const mockGames = [
        { id: 1, user_color: 'white' }
      ];
      mockDatabase.all.mockResolvedValueOnce(mockGames);

      // Third call returns analysis
      const mockAnalysis = [
        { move_number: 1, centipawn_loss: 10 },   // Opening (move 1)
        { move_number: 3, centipawn_loss: 15 },   // Opening (move 2)
        { move_number: 21, centipawn_loss: 25 },  // Middlegame (move 11)
        { move_number: 61, centipawn_loss: 30 }   // Endgame (move 31)
      ];
      mockDatabase.all.mockResolvedValueOnce(mockAnalysis);

      const result = await dashboardService.getAccuracyByPhase('user123');

      expect(result.opening.gamesWithData).toBe(1);
      expect(result.middlegame.gamesWithData).toBe(1);
      expect(result.endgame.gamesWithData).toBe(1);
      expect(result.totalGames).toBe(1);
    });

    it('should filter by color when provided', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await dashboardService.getAccuracyByPhase('user123', 'white');

      const query = mockDatabase.all.mock.calls[0][0];
      const params = mockDatabase.all.mock.calls[0][1];

      expect(query).toContain('user_color = ?');
      expect(params).toContain('white');
    });
  });

  describe('getOpeningPerformance', () => {
    it('should return empty array when no games exist', async () => {
      mockDatabase.all
        .mockResolvedValueOnce([])  // opening_analysis query
        .mockResolvedValueOnce([]); // fallback PGN query

      const result = await dashboardService.getOpeningPerformance('user123');

      expect(result).toEqual([]);
    });

    it('should aggregate opening stats correctly', async () => {
      const mockOpeningGames = [
        { eco_code: 'C42', opening_name: 'Russian Game', result: '1-0', user_color: 'white', game_id: 1 },
        { eco_code: 'C42', opening_name: 'Russian Game', result: '0-1', user_color: 'white', game_id: 2 },
        { eco_code: 'C42', opening_name: 'Russian Game', result: '1/2-1/2', user_color: 'white', game_id: 3 },
        { eco_code: 'B20', opening_name: 'Sicilian Defense', result: '1-0', user_color: 'white', game_id: 4 }
      ];

      mockDatabase.all.mockResolvedValueOnce(mockOpeningGames);

      const result = await dashboardService.getOpeningPerformance('user123');

      expect(result).toHaveLength(2);

      const russian = result.find(o => o.ecoCode === 'C42');
      expect(russian.games).toBe(3);
      expect(russian.wins).toBe(1);
      expect(russian.losses).toBe(1);
      expect(russian.draws).toBe(1);
      expect(russian.winRate).toBe(33);
      expect(russian.drawRate).toBe(33);
      expect(russian.lossRate).toBe(33);

      const sicilian = result.find(o => o.ecoCode === 'B20');
      expect(sicilian.games).toBe(1);
      expect(sicilian.wins).toBe(1);
      expect(sicilian.winRate).toBe(100);
    });

    it('should sort by games played and respect limit', async () => {
      const mockOpeningGames = [
        { eco_code: 'A00', opening_name: 'Opening A', result: '1-0', user_color: 'white', game_id: 1 },
        { eco_code: 'B00', opening_name: 'Opening B', result: '1-0', user_color: 'white', game_id: 2 },
        { eco_code: 'B00', opening_name: 'Opening B', result: '1-0', user_color: 'white', game_id: 3 },
        { eco_code: 'C00', opening_name: 'Opening C', result: '1-0', user_color: 'white', game_id: 4 },
        { eco_code: 'C00', opening_name: 'Opening C', result: '1-0', user_color: 'white', game_id: 5 },
        { eco_code: 'C00', opening_name: 'Opening C', result: '1-0', user_color: 'white', game_id: 6 }
      ];

      mockDatabase.all.mockResolvedValueOnce(mockOpeningGames);

      const result = await dashboardService.getOpeningPerformance('user123', 2);

      expect(result).toHaveLength(2);
      expect(result[0].ecoCode).toBe('C00');  // 3 games
      expect(result[1].ecoCode).toBe('B00');  // 2 games
    });

    it('should handle black wins correctly', async () => {
      const mockOpeningGames = [
        { eco_code: 'C42', opening_name: 'Russian Game', result: '0-1', user_color: 'black', game_id: 1 }
      ];

      mockDatabase.all.mockResolvedValueOnce(mockOpeningGames);

      const result = await dashboardService.getOpeningPerformance('user123');

      expect(result[0].wins).toBe(1);
      expect(result[0].winRate).toBe(100);
    });

    it('should filter by color when provided', async () => {
      mockDatabase.all.mockResolvedValueOnce([]);
      mockDatabase.all.mockResolvedValueOnce([]);

      await dashboardService.getOpeningPerformance('user123', 10, 'white');

      const query = mockDatabase.all.mock.calls[0][0];
      const params = mockDatabase.all.mock.calls[0][1];

      expect(query).toContain('user_color = ?');
      expect(params).toContain('white');
    });

    it('should fall back to PGN detection when opening_analysis is empty', async () => {
      // First call: empty opening_analysis
      mockDatabase.all.mockResolvedValueOnce([]);

      // Second call: games with PGN content
      const mockGamesWithPGN = [
        {
          id: 1,
          pgn_content: '[ECO "C42"]\n1. e4 e5',
          result: '1-0',
          user_color: 'white'
        }
      ];
      mockDatabase.all.mockResolvedValueOnce(mockGamesWithPGN);

      // Mock getOpeningName
      mockDatabase.get.mockResolvedValueOnce({ opening_name: 'Russian Game' });

      const result = await dashboardService.getOpeningPerformance('user123');

      expect(result).toHaveLength(1);
      expect(result[0].ecoCode).toBe('C42');
    });
  });
});
