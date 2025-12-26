/**
 * Unit Tests for Dashboard Controller
 *
 * Tests dashboard controller methods with mocked DashboardService
 */

// Must mock DashboardService BEFORE requiring the controller
// because the controller creates a singleton instance on load
jest.mock('../../src/services/DashboardService');

const dashboardController = require('../../src/api/controllers/dashboard.controller');
const DashboardService = require('../../src/services/DashboardService');

describe('DashboardController', () => {
  let mockReq, mockRes, mockDashboardService;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock request object
    mockReq = {
      query: {},
      params: {},
      userId: 'test-user-123'
    };

    // Mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Create mock methods
    mockDashboardService = {
      getPerformanceMetrics: jest.fn(),
      getPlayerPerformance: jest.fn(),
      getTrendsData: jest.fn(),
      getRatingTrends: jest.fn(),
      getCentipawnLossTrends: jest.fn(),
      generateHeatmap: jest.fn(),
      getGamesList: jest.fn()
    };

    // Mock the DashboardService constructor to return our mock
    DashboardService.mockImplementation(() => mockDashboardService);

    // Replace the controller's dashboardService with our mock
    dashboardController.dashboardService = mockDashboardService;
  });

  describe('getPerformance()', () => {
    it('should get performance metrics without tournament filter', async () => {
      const mockMetrics = {
        white: { games: 10, winRate: 60, avgAccuracy: 85, blunders: 5 },
        black: { games: 8, winRate: 50, avgAccuracy: 82, blunders: 6 },
        overall: { avgAccuracy: 83.5, totalBlunders: 11 }
      };

      mockDashboardService.getPerformanceMetrics.mockResolvedValue(mockMetrics);

      await dashboardController.getPerformance(mockReq, mockRes);

      expect(mockDashboardService.getPerformanceMetrics).toHaveBeenCalledWith(null, 'test-user-123');
      expect(mockRes.json).toHaveBeenCalledWith(mockMetrics);
    });

    it('should get performance metrics with tournament filter', async () => {
      mockReq.query.tournament = '5';

      const mockMetrics = {
        white: { games: 5, winRate: 80 },
        black: { games: 5, winRate: 60 }
      };

      mockDashboardService.getPerformanceMetrics.mockResolvedValue(mockMetrics);

      await dashboardController.getPerformance(mockReq, mockRes);

      expect(mockDashboardService.getPerformanceMetrics).toHaveBeenCalledWith(5, 'test-user-123');
      expect(mockRes.json).toHaveBeenCalledWith(mockMetrics);
    });

    it('should return fallback data on error', async () => {
      mockDashboardService.getPerformanceMetrics.mockRejectedValue(new Error('Database error'));

      await dashboardController.getPerformance(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        white: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
        black: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
        overall: { avgAccuracy: 0, totalBlunders: 0 }
      });
    });
  });

  describe('getPlayerPerformance()', () => {
    it('should get overall player performance', async () => {
      const mockPerformance = {
        overallRecord: { wins: 10, losses: 5, draws: 2, winRate: 65 },
        byColor: {
          white: { games: 9, wins: 6, losses: 2, draws: 1 },
          black: { games: 8, wins: 4, losses: 3, draws: 1 }
        },
        analysis: { totalBlunders: 15, avgCentipawnLoss: 45 }
      };

      mockDashboardService.getPlayerPerformance.mockResolvedValue(mockPerformance);

      await dashboardController.getPlayerPerformance(mockReq, mockRes);

      expect(mockDashboardService.getPlayerPerformance).toHaveBeenCalledWith('test-user-123');
      expect(mockRes.json).toHaveBeenCalledWith(mockPerformance);
    });

    it('should return 500 on error', async () => {
      mockDashboardService.getPlayerPerformance.mockRejectedValue(new Error('Service error'));

      await dashboardController.getPlayerPerformance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Service error'
      });
    });

    it('should return generic message when error has no message', async () => {
      mockDashboardService.getPlayerPerformance.mockRejectedValue(new Error());

      await dashboardController.getPlayerPerformance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to get player performance'
      });
    });
  });

  describe('getTrends()', () => {
    it('should get trends data successfully', async () => {
      const mockTrends = {
        ratingProgression: [{ date: '2025-01-01', rating: 1500 }],
        centipawnTrend: [{ date: '2025-01-01', avgCentipawnLoss: 45 }],
        summary: { ratingChange: 50, improvementTrend: 'improving' }
      };

      mockDashboardService.getTrendsData.mockResolvedValue(mockTrends);

      await dashboardController.getTrends(mockReq, mockRes);

      expect(mockDashboardService.getTrendsData).toHaveBeenCalledWith('test-user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockTrends,
        responseTime: expect.any(Number)
      });
    });

    it('should include response time in result', async () => {
      mockDashboardService.getTrendsData.mockResolvedValue({});

      await dashboardController.getTrends(mockReq, mockRes);

      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return 500 on error', async () => {
      mockDashboardService.getTrendsData.mockRejectedValue(new Error('Trends error'));

      await dashboardController.getTrends(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Trends error'
      });
    });
  });

  describe('getRatingTrends()', () => {
    it('should get rating trends without tournament filter', async () => {
      const mockRating = {
        data: [
          { gameNumber: 1, rating: 1500, date: '2025-01-01' },
          { gameNumber: 2, rating: 1520, date: '2025-01-02' }
        ]
      };

      mockDashboardService.getRatingTrends.mockResolvedValue(mockRating);

      await dashboardController.getRatingTrends(mockReq, mockRes);

      expect(mockDashboardService.getRatingTrends).toHaveBeenCalledWith(null, 'test-user-123');
      expect(mockRes.json).toHaveBeenCalledWith(mockRating);
    });

    it('should get rating trends with tournament filter', async () => {
      mockReq.query.tournament = '10';

      mockDashboardService.getRatingTrends.mockResolvedValue({ data: [] });

      await dashboardController.getRatingTrends(mockReq, mockRes);

      expect(mockDashboardService.getRatingTrends).toHaveBeenCalledWith(10, 'test-user-123');
    });

    it('should return 500 on error', async () => {
      mockDashboardService.getRatingTrends.mockRejectedValue(new Error('Rating error'));

      await dashboardController.getRatingTrends(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Rating error' });
    });
  });

  describe('getCentipawnLossTrends()', () => {
    it('should get centipawn loss trends without tournament filter', async () => {
      const mockCPL = {
        data: [
          { gameNumber: 1, avgCentipawnLoss: 45 },
          { gameNumber: 2, avgCentipawnLoss: 38 }
        ]
      };

      mockDashboardService.getCentipawnLossTrends.mockResolvedValue(mockCPL);

      await dashboardController.getCentipawnLossTrends(mockReq, mockRes);

      expect(mockDashboardService.getCentipawnLossTrends).toHaveBeenCalledWith(null, 'test-user-123');
      expect(mockRes.json).toHaveBeenCalledWith(mockCPL);
    });

    it('should get centipawn loss trends with tournament filter', async () => {
      mockReq.query.tournament = '15';

      mockDashboardService.getCentipawnLossTrends.mockResolvedValue({ data: [] });

      await dashboardController.getCentipawnLossTrends(mockReq, mockRes);

      expect(mockDashboardService.getCentipawnLossTrends).toHaveBeenCalledWith(15, 'test-user-123');
    });

    it('should return 500 on error', async () => {
      mockDashboardService.getCentipawnLossTrends.mockRejectedValue(new Error('CPL error'));

      await dashboardController.getCentipawnLossTrends(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'CPL error' });
    });
  });

  describe('getHeatmap()', () => {
    it('should get heatmap without tournament filter', async () => {
      const mockHeatmap = {
        heatmap: [{ square: 'e5', count: 5, intensity: 0.5 }],
        problematicSquares: [{ square: 'e5', count: 5 }]
      };

      mockDashboardService.generateHeatmap.mockResolvedValue(mockHeatmap);

      await dashboardController.getHeatmap(mockReq, mockRes);

      expect(mockDashboardService.generateHeatmap).toHaveBeenCalledWith('test-user-123', null);
      expect(mockRes.json).toHaveBeenCalledWith(mockHeatmap);
    });

    it('should get heatmap with tournament filter', async () => {
      mockReq.query.tournament = '20';

      mockDashboardService.generateHeatmap.mockResolvedValue({ heatmap: [], problematicSquares: [] });

      await dashboardController.getHeatmap(mockReq, mockRes);

      expect(mockDashboardService.generateHeatmap).toHaveBeenCalledWith('test-user-123', 20);
    });

    it('should return 500 on error', async () => {
      mockDashboardService.generateHeatmap.mockRejectedValue(new Error('Heatmap error'));

      await dashboardController.getHeatmap(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to generate heatmap data' });
    });
  });

  describe('getGamesList()', () => {
    it('should get games list with default limit', async () => {
      const mockGames = [
        { id: 1, white_player: 'Player1', black_player: 'Player2', opening: 'Sicilian Defense' }
      ];

      mockDashboardService.getGamesList.mockResolvedValue(mockGames);

      await dashboardController.getGamesList(mockReq, mockRes);

      expect(mockDashboardService.getGamesList).toHaveBeenCalledWith('test-user-123', 50, null);
      expect(mockRes.json).toHaveBeenCalledWith(mockGames);
    });

    it('should get games list with custom limit', async () => {
      mockReq.query.limit = '100';

      mockDashboardService.getGamesList.mockResolvedValue([]);

      await dashboardController.getGamesList(mockReq, mockRes);

      expect(mockDashboardService.getGamesList).toHaveBeenCalledWith('test-user-123', 100, null);
    });

    it('should get games list with tournament filter', async () => {
      mockReq.query.tournament = '25';
      mockReq.query.limit = '30';

      mockDashboardService.getGamesList.mockResolvedValue([]);

      await dashboardController.getGamesList(mockReq, mockRes);

      expect(mockDashboardService.getGamesList).toHaveBeenCalledWith('test-user-123', 30, 25);
    });

    it('should return empty array on error', async () => {
      mockDashboardService.getGamesList.mockRejectedValue(new Error('Games error'));

      await dashboardController.getGamesList(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });
});
