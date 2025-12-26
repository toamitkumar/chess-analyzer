const GameAnalysisService = require('../../src/services/GameAnalysisService');

describe('GameAnalysisService', () => {
  let service;
  let mockAnalyzer;

  beforeEach(() => {
    // Create mock analyzer
    mockAnalyzer = {
      isReady: true,
      analyzeGame: jest.fn(),
      close: jest.fn()
    };

    service = new GameAnalysisService(mockAnalyzer);
  });

  describe('ensureReady', () => {
    it('should resolve immediately if analyzer is already ready', async () => {
      mockAnalyzer.isReady = true;
      service.isInitialized = false;

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.ensureReady();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Stockfish engine already ready'));
      expect(service.isInitialized).toBe(true);

      consoleLogSpy.mockRestore();
    });

    it('should wait for analyzer to become ready', async () => {
      mockAnalyzer.isReady = false;
      service.isInitialized = false;

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate analyzer becoming ready after 300ms
      setTimeout(() => {
        mockAnalyzer.isReady = true;
      }, 300);

      await service.ensureReady();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Waiting for Stockfish engine to initialize'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Stockfish engine ready for analysis'));
      expect(service.isInitialized).toBe(true);

      consoleLogSpy.mockRestore();
    });

    it('should timeout after specified time and proceed anyway', async () => {
      mockAnalyzer.isReady = false;
      service.isInitialized = false;

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.ensureReady(100); // Very short timeout

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stockfish engine timeout')
      );
      expect(service.isInitialized).toBe(true);

      consoleLogSpy.mockRestore();
    });

    it('should not reinitialize if already initialized', async () => {
      service.isInitialized = true;

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.ensureReady();

      // Should not log anything or only log debug messages
      const relevantCalls = consoleLogSpy.mock.calls.filter(call =>
        !call[0].includes('[GameAnalysisService]')
      );
      expect(relevantCalls).toHaveLength(0);

      consoleLogSpy.mockRestore();
    });
  });

  describe('analyzeGame', () => {
    const mockGame = {
      white: 'Player1',
      black: 'Player2',
      moves: ['e4', 'e5', 'Nf3', 'Nc6']
    };

    const mockAnalysis = {
      summary: {
        accuracy: 95,
        blunders: 2,
        averageCentipawnLoss: 15,
        totalMoves: 4
      },
      moves: [
        { move_number: 1, evaluation: 25, best_move: 'e4' },
        { move_number: 2, evaluation: -20, best_move: 'e5' }
      ]
    };

    it('should analyze a game successfully', async () => {
      mockAnalyzer.analyzeGame.mockResolvedValue(mockAnalysis);

      const result = await service.analyzeGame(mockGame, 0, 1);

      expect(result).toEqual({
        ...mockGame,
        analysis: {
          accuracy: 95,
          blunders: 2,
          centipawnLoss: 15,
          moveCount: 4,
          fullAnalysis: mockAnalysis.moves
        }
      });

      expect(mockAnalyzer.analyzeGame).toHaveBeenCalledWith(mockGame.moves);
    });

    it('should log analysis progress', async () => {
      mockAnalyzer.analyzeGame.mockResolvedValue(mockAnalysis);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.analyzeGame(mockGame, 0, 1);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Analyzing game 1/1: Player1 vs Player2')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Game 1 analyzed - Accuracy: 95%, Blunders: 2')
      );

      consoleLogSpy.mockRestore();
    });

    it('should throw error when moves are missing', async () => {
      const gameWithoutMoves = {
        white: 'Player1',
        black: 'Player2',
        moves: []
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.analyzeGame(gameWithoutMoves, 0, 1);

      expect(result.analysis).toBeNull();
      expect(result.analysisError).toBe('No valid moves found in game');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle analyzer errors gracefully', async () => {
      mockAnalyzer.analyzeGame.mockRejectedValue(new Error('Analyzer failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.analyzeGame(mockGame, 0, 1);

      expect(result.analysis).toBeNull();
      expect(result.analysisError).toBe('Analyzer failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Analysis failed for game 1'),
        'Analyzer failed'
      );

      consoleErrorSpy.mockRestore();
    });

    it('should validate moves array type', async () => {
      const gameWithInvalidMoves = {
        white: 'Player1',
        black: 'Player2',
        moves: 'not an array'
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.analyzeGame(gameWithInvalidMoves, 0, 1);

      expect(result.analysis).toBeNull();
      expect(result.analysisError).toBe('No valid moves found in game');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('analyzeGames', () => {
    const mockGames = [
      { white: 'P1', black: 'P2', moves: ['e4', 'e5'] },
      { white: 'P3', black: 'P4', moves: ['d4', 'd5'] },
      { white: 'P5', black: 'P6', moves: [] } // Invalid
    ];

    const mockAnalysis = {
      summary: { accuracy: 90, blunders: 1, averageCentipawnLoss: 10, totalMoves: 2 },
      moves: []
    };

    it('should analyze multiple games', async () => {
      mockAnalyzer.analyzeGame.mockResolvedValue(mockAnalysis);

      const result = await service.analyzeGames(mockGames);

      expect(result.analyzedGames).toHaveLength(3);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
      expect(result.analysisErrors).toHaveLength(1);
    });

    it('should return all games including failed ones', async () => {
      mockAnalyzer.analyzeGame.mockResolvedValue(mockAnalysis);

      const result = await service.analyzeGames(mockGames);

      expect(result.analyzedGames[0].analysis).not.toBeNull();
      expect(result.analyzedGames[1].analysis).not.toBeNull();
      expect(result.analyzedGames[2].analysis).toBeNull();
      expect(result.analyzedGames[2].analysisError).toBeDefined();
    });

    it('should handle empty games array', async () => {
      const result = await service.analyzeGames([]);

      expect(result.analyzedGames).toHaveLength(0);
      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });
  });

  describe('close', () => {
    it('should close the analyzer', async () => {
      mockAnalyzer.close.mockResolvedValue();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      service.isInitialized = true;
      service.isSharedAnalyzer = false; // Not a shared analyzer, so it can be closed

      await service.close();

      expect(mockAnalyzer.close).toHaveBeenCalled();
      expect(service.isInitialized).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Analyzer closed'));

      consoleLogSpy.mockRestore();
    });

    it('should handle close when analyzer is null', async () => {
      service.analyzer = null;

      await expect(service.close()).resolves.not.toThrow();
    });
  });
});
