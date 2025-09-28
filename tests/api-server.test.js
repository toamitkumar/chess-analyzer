const request = require('supertest');
const fs = require('fs');

// Mock dependencies
jest.mock('fs');
jest.mock('../src/models/performance-stats');

describe('API Server', () => {
  let app;
  let PerformanceCalculator;

  beforeAll(() => {
    // Mock PerformanceCalculator
    PerformanceCalculator = require('../src/models/performance-stats');
    PerformanceCalculator.mockImplementation(() => ({
      parseGameResults: jest.fn(() => []),
      calculatePerformanceStats: jest.fn(() => ({
        white: { winRate: 70, accuracy: 90, blunders: 5 },
        black: { winRate: 60, accuracy: 85, blunders: 8 }
      }))
    }));

    // Import app after mocks
    app = require('../src/api/api-server');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/performance', () => {
    it('should return performance data', async () => {
      fs.existsSync.mockReturnValue(false); // Force mock data

      const response = await request(app)
        .get('/api/performance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('white');
      expect(response.body.data).toHaveProperty('black');
      expect(response.body.responseTime).toBeDefined();
    });

    it('should return mock data when no PGN files exist', async () => {
      fs.existsSync.mockReturnValue(false);

      const response = await request(app)
        .get('/api/performance')
        .expect(200);

      expect(response.body.data.white.winRate).toBe(65);
      expect(response.body.data.black.winRate).toBe(58);
    });

    it('should handle errors gracefully', async () => {
      fs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const response = await request(app)
        .get('/api/performance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined(); // Should return mock data
    });
  });
});
