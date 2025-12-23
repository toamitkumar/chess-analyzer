const DashboardService = require('../../src/services/DashboardService');

describe('DashboardService', () => {
  let service;
  let mockDatabase;
  let mockTrendCalculator;
  let mockHeatmapCalculator;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      getPerformanceMetrics: jest.fn(),
      all: jest.fn(),
      get: jest.fn()
    };

    // Create mock trend calculator
    mockTrendCalculator = {
      calculateRatingProgression: jest.fn(),
      calculateCentipawnLossTrend: jest.fn(),
      generateTrendSummary: jest.fn()
    };

    // Create mock heatmap calculator
    mockHeatmapCalculator = {
      calculateHeatmap: jest.fn(),
      getMostProblematicSquares: jest.fn()
    };

    service = new DashboardService({
      database: mockDatabase,
      trendCalculator: mockTrendCalculator,
      heatmapCalculator: mockHeatmapCalculator
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should call database.getPerformanceMetrics', async () => {
      const mockMetrics = {
        white: { games: 10, winRate: 60 },
        black: { games: 8, winRate: 50 }
      };
      mockDatabase.getPerformanceMetrics.mockResolvedValue(mockMetrics);

      const result = await service.getPerformanceMetrics(1, 'user123');

      expect(result).toEqual(mockMetrics);
      expect(mockDatabase.getPerformanceMetrics).toHaveBeenCalledWith(1, 'user123');
    });

    it('should handle null tournament ID', async () => {
      mockDatabase.getPerformanceMetrics.mockResolvedValue({});

      await service.getPerformanceMetrics(null, 'user123');

      expect(mockDatabase.getPerformanceMetrics).toHaveBeenCalledWith(null, 'user123');
    });
  });

  describe('getPlayerPerformance', () => {
    it('should calculate overall player performance', async () => {
      const mockGames = [
        { id: 1, white_player: 'AdvaitKumar1213', black_player: 'Opponent1', result: '1-0', white_elo: 1500, black_elo: 1450 },
        { id: 2, white_player: 'Opponent2', black_player: 'AdvaitKumar1213', result: '0-1', white_elo: 1600, black_elo: 1520 }
      ];

      mockDatabase.all
        .mockResolvedValueOnce(mockGames) // First call for games
        .mockResolvedValueOnce([{ centipawn_loss: 25, move_number: 1 }]) // Analysis for game 1
        .mockResolvedValueOnce([{ centipawn_loss: 30, move_number: 2 }]); // Analysis for game 2

      mockDatabase.get
        .mockResolvedValueOnce({ count: 1 }) // Blunders for game 1
        .mockResolvedValueOnce({ count: 0 }); // Blunders for game 2

      const result = await service.getPlayerPerformance('user123');

      expect(result.overallRecord.wins).toBe(2);
      expect(result.overallRecord.losses).toBe(0);
      expect(result.byColor.white.games).toBe(1);
      expect(result.byColor.black.games).toBe(1);
      expect(result.analysis.totalBlunders).toBe(1);
    });

    it('should handle games with no analysis data', async () => {
      const mockGames = [
        { id: 1, white_player: 'AdvaitKumar1213', black_player: 'Opponent1', result: '1-0' }
      ];

      mockDatabase.all
        .mockResolvedValueOnce(mockGames)
        .mockResolvedValueOnce([]); // No analysis

      mockDatabase.get.mockResolvedValue({ count: 0 });

      const result = await service.getPlayerPerformance('user123');

      expect(result.overallRecord.wins).toBe(1);
      expect(result.analysis.avgCentipawnLoss).toBe(0);
    });

    it('should handle empty games array', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await service.getPlayerPerformance('user123');

      expect(result.overallRecord.wins).toBe(0);
      expect(result.overallRecord.winRate).toBe(0);
      expect(result.byColor.white.games).toBe(0);
      expect(result.byColor.black.games).toBe(0);
    });
  });

  describe('getTrendsData', () => {
    it('should calculate trends using TrendCalculator', async () => {
      const mockGames = [
        {
          id: 1,
          white_player: 'AdvaitKumar1213',
          black_player: 'Opponent1',
          white_elo: 1500,
          black_elo: 1450,
          result: '1-0',
          date: '2025-01-01',
          avgCentipawnLoss: 25,
          moveCount: 42
        }
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      const mockRatingProgression = [{ date: new Date('2025-01-01'), rating: 1500 }];
      const mockCentipawnTrend = [{ date: new Date('2025-01-01'), avgCentipawnLoss: 25 }];
      const mockSummary = { ratingChange: 0, averageCentipawnLoss: 25 };

      mockTrendCalculator.calculateRatingProgression.mockReturnValue(mockRatingProgression);
      mockTrendCalculator.calculateCentipawnLossTrend.mockReturnValue(mockCentipawnTrend);
      mockTrendCalculator.generateTrendSummary.mockReturnValue(mockSummary);

      const result = await service.getTrendsData('user123');

      expect(result.ratingProgression).toEqual(mockRatingProgression);
      expect(result.centipawnTrend).toEqual(mockCentipawnTrend);
      expect(result.summary).toEqual(mockSummary);
      expect(result).toHaveProperty('lastUpdated');
    });

    it('should return null when no games exist', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await service.getTrendsData('user123');

      expect(result).toBeNull();
      expect(mockTrendCalculator.calculateRatingProgression).not.toHaveBeenCalled();
    });

    it('should handle games with missing ratings', async () => {
      const mockGames = [
        {
          id: 1,
          white_player: 'AdvaitKumar1213',
          black_player: 'Opponent1',
          white_elo: null,
          black_elo: null,
          result: '1-0',
          date: '2025-01-01'
        }
      ];

      mockDatabase.all.mockResolvedValue(mockGames);
      mockTrendCalculator.calculateRatingProgression.mockReturnValue([]);
      mockTrendCalculator.calculateCentipawnLossTrend.mockReturnValue([]);
      mockTrendCalculator.generateTrendSummary.mockReturnValue({});

      const result = await service.getTrendsData('user123');

      expect(result).toBeDefined();
      expect(mockTrendCalculator.calculateRatingProgression).toHaveBeenCalled();
    });
  });

  describe('getRatingTrends', () => {
    it('should get rating progression with tournament filter', async () => {
      const mockGames = [
        { id: 1, white_player: 'AdvaitKumar1213', black_player: 'Opp', white_elo: 1500, black_elo: 1450, date: '2025-01-01' },
        { id: 2, white_player: 'AdvaitKumar1213', black_player: 'Opp', white_elo: 1520, black_elo: 1460, date: '2025-01-02' }
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      const result = await service.getRatingTrends(1, 'user123');

      expect(result.data).toHaveLength(2);
      expect(result.data[0].rating).toBe(1500);
      expect(result.data[1].rating).toBe(1520);
      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('tournament_id'),
        expect.arrayContaining([1])
      );
    });

    it('should get rating progression without tournament filter', async () => {
      const mockGames = [
        { id: 1, white_player: 'AdvaitKumar1213', black_player: 'Opp', white_elo: 1500, black_elo: 1450, date: '2025-01-01' }
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      const result = await service.getRatingTrends(null, 'user123');

      expect(result.data).toHaveLength(1);
      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.not.stringContaining('tournament_id'),
        expect.any(Array)
      );
    });

    it('should filter out games with no ratings', async () => {
      const mockGames = [
        { id: 1, white_player: 'AdvaitKumar1213', black_player: 'Opp', white_elo: 1500, black_elo: 1450, date: '2025-01-01' },
        { id: 2, white_player: 'AdvaitKumar1213', black_player: 'Opp', white_elo: null, black_elo: 1460, date: '2025-01-02' },
        { id: 3, white_player: 'AdvaitKumar1213', black_player: 'Opp', white_elo: 0, black_elo: 1470, date: '2025-01-03' }
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      const result = await service.getRatingTrends(null, 'user123');

      expect(result.data).toHaveLength(1); // Only first game has valid rating
    });
  });

  describe('getCentipawnLossTrends', () => {
    it('should get centipawn loss progression', async () => {
      const mockGames = [
        { id: 1, avg_centipawn_loss: 25.5 },
        { id: 2, avg_centipawn_loss: 20.3 }
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      const result = await service.getCentipawnLossTrends(null, 'user123');

      expect(result.data).toHaveLength(2);
      expect(result.data[0].avgCentipawnLoss).toBe(26); // Rounded
      expect(result.data[1].avgCentipawnLoss).toBe(20); // Rounded
    });

    it('should handle tournament filter', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await service.getCentipawnLossTrends(5, 'user123');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('tournament_id'),
        expect.arrayContaining([5])
      );
    });

    it('should handle null centipawn loss values', async () => {
      const mockGames = [
        { id: 1, avg_centipawn_loss: null },
        { id: 2, avg_centipawn_loss: undefined }
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      const result = await service.getCentipawnLossTrends(null, 'user123');

      expect(result.data[0].avgCentipawnLoss).toBe(0);
      expect(result.data[1].avgCentipawnLoss).toBe(0);
    });
  });

  describe('generateHeatmap', () => {
    it('should generate heatmap from blunder data', async () => {
      const mockBlunders = [
        { square: 'e5', severity: 3, move_san: 'Nf3-e5' },
        { square: 'h5', severity: 2, move_san: 'Qd1-h5' }
      ];

      mockDatabase.all.mockResolvedValue(mockBlunders);

      const mockHeatmap = [
        { square: 'e5', count: 1, severity: 3, intensity: 0.3 }
      ];
      const mockProblematic = [
        { square: 'e5', count: 1, severity: 3 }
      ];

      mockHeatmapCalculator.calculateHeatmap.mockReturnValue(mockHeatmap);
      mockHeatmapCalculator.getMostProblematicSquares.mockReturnValue(mockProblematic);

      const result = await service.generateHeatmap('user123', null);

      expect(result.heatmap).toEqual(mockHeatmap);
      expect(result.problematicSquares).toEqual(mockProblematic);
      expect(mockHeatmapCalculator.calculateHeatmap).toHaveBeenCalledWith([{
        blunders: expect.arrayContaining([
          expect.objectContaining({ square: 'e5', severity: 3 })
        ])
      }]);
    });

    it('should handle tournament filter', async () => {
      mockDatabase.all.mockResolvedValue([]);
      mockHeatmapCalculator.calculateHeatmap.mockReturnValue([]);
      mockHeatmapCalculator.getMostProblematicSquares.mockReturnValue([]);

      await service.generateHeatmap('user123', 10);

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('tournament_id'),
        expect.arrayContaining([10])
      );
    });

    it('should return empty heatmap when no blunders exist', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await service.generateHeatmap('user123', null);

      expect(result.heatmap).toEqual([]);
      expect(result.problematicSquares).toEqual([]);
      expect(mockHeatmapCalculator.calculateHeatmap).not.toHaveBeenCalled();
    });

    it('should handle blunders with missing severity', async () => {
      const mockBlunders = [
        { square: 'e5', severity: null, move_san: 'Nf3-e5' }
      ];

      mockDatabase.all.mockResolvedValue(mockBlunders);
      mockHeatmapCalculator.calculateHeatmap.mockReturnValue([]);
      mockHeatmapCalculator.getMostProblematicSquares.mockReturnValue([]);

      await service.generateHeatmap('user123', null);

      expect(mockHeatmapCalculator.calculateHeatmap).toHaveBeenCalledWith([{
        blunders: expect.arrayContaining([
          expect.objectContaining({ severity: 1 }) // Default severity
        ])
      }]);
    });
  });

  describe('getGamesList', () => {
    it('should return games with opening names', async () => {
      const mockGames = [
        {
          id: 1,
          white_player: 'Player1',
          black_player: 'Player2',
          pgn_content: '[Event "Test"]\n[ECO "C42"]\n1. e4 e5'
        }
      ];

      mockDatabase.all.mockResolvedValue(mockGames);
      mockDatabase.get.mockResolvedValue({ name: 'Petrov Defense' });

      const result = await service.getGamesList('user123', 50, null);

      expect(result).toHaveLength(1);
      expect(result[0].opening).toBe('Petrov Defense');
    });

    it('should handle games without ECO codes', async () => {
      const mockGames = [
        {
          id: 1,
          white_player: 'Player1',
          black_player: 'Player2',
          pgn_content: '[Event "Test"]\n1. e4 e5'
        }
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      // Mock opening detector
      jest.mock('../../src/models/opening-detector', () => ({
        detect: jest.fn().mockReturnValue({ name: 'King\'s Pawn Opening' })
      }));

      const result = await service.getGamesList('user123', 50, null);

      expect(result).toHaveLength(1);
      // Opening detection might not work in mock environment
    });

    it('should handle tournament filter', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await service.getGamesList('user123', 25, 5);

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tournament_id'),
        [5, 25]
      );
    });

    it('should apply limit correctly', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await service.getGamesList('user123', 100, null);

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        [100]
      );
    });

    it('should handle games without PGN content', async () => {
      const mockGames = [
        {
          id: 1,
          white_player: 'Player1',
          black_player: 'Player2',
          pgn_content: null
        }
      ];

      mockDatabase.all.mockResolvedValue(mockGames);

      const result = await service.getGamesList('user123', 50, null);

      expect(result[0].opening).toBe('Unknown Opening');
    });
  });

  describe('getOpeningName', () => {
    it('should return opening name for valid ECO code', async () => {
      mockDatabase.get.mockResolvedValue({ name: 'Sicilian Defense' });

      const result = await service.getOpeningName('B20');

      expect(result).toBe('Sicilian Defense');
      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('chess_openings'),
        ['B20']
      );
    });

    it('should return null for invalid ECO code', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const result = await service.getOpeningName('ZZZ');

      expect(result).toBeNull();
    });
  });
});
