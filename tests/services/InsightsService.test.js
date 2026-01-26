/**
 * InsightsService Unit Tests
 *
 * Tests for Chess.com Insights Dashboard features (ADR 009)
 */

const InsightsService = require('../../src/services/InsightsService');

describe('InsightsService', () => {
  let insightsService;
  let mockDatabase;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn()
    };

    mockDatabase = {
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn(),
      getDb: jest.fn().mockReturnValue(mockDb)
    };

    insightsService = new InsightsService(mockDatabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAccuracyByResult', () => {
    it('should return empty stats when no games exist', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await insightsService.getAccuracyByResult('user123');

      expect(result.overall.games).toBe(0);
      expect(result.wins.games).toBe(0);
      expect(result.draws.games).toBe(0);
      expect(result.losses.games).toBe(0);
    });
  });

  describe('getPhaseDistribution', () => {
    it('should return empty stats when no games exist', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await insightsService.getPhaseDistribution('user123');

      expect(result.totalGames).toBe(0);
      expect(result.overall.opening.count).toBe(0);
      expect(result.overall.middlegame.count).toBe(0);
      expect(result.overall.endgame.count).toBe(0);
    });
  });

  describe('getAccuracyByPhase', () => {
    it('should return empty stats when no phase_stats exist', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await insightsService.getAccuracyByPhase('user123');

      expect(result.opening.accuracy).toBe(0);
      expect(result.middlegame.accuracy).toBe(0);
      expect(result.endgame.accuracy).toBe(0);
    });
  });

  describe('getOpeningPerformance', () => {
    it('should return empty array when no games exist', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await insightsService.getOpeningPerformance('user123');

      expect(result).toEqual([]);
    });
  });

  describe('getTacticalOpportunities', () => {
    it('should return tactical stats structure', async () => {
      // Mock callback-style db.all
      mockDb.all = jest.fn((query, params, callback) => {
        callback(null, []);
      });

      const result = await insightsService.getTacticalOpportunities('user123');

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('found');
      expect(result).toHaveProperty('missed');
      expect(result).toHaveProperty('findRate');
      expect(result).toHaveProperty('byType');
    });
  });

  describe('getFreePieces', () => {
    it('should return free pieces stats structure', async () => {
      // Mock callback-style db.all
      mockDb.all = jest.fn((query, params, callback) => {
        callback(null, []);
      });

      const result = await insightsService.getFreePieces('user123');

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('captured');
      expect(result).toHaveProperty('missed');
      expect(result).toHaveProperty('captureRate');
      expect(result).toHaveProperty('byPiece');
    });
  });
});
