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
});
