const GameStorageService = require('../../src/services/GameStorageService');
const crypto = require('crypto');

describe('GameStorageService', () => {
  let service;
  let mockDatabase;
  let mockFileStorage;

  beforeEach(() => {
    mockDatabase = {
      findGameByContentHash: jest.fn(),
      insertGame: jest.fn(),
      insertAnalysis: jest.fn(),
      storeAlternativeMoves: jest.fn(),
      storePositionEvaluation: jest.fn(),
      updatePerformanceMetrics: jest.fn()
    };

    mockFileStorage = {
      storePGNInTournament: jest.fn()
    };

    service = new GameStorageService(mockDatabase, mockFileStorage);
  });

  describe('checkDuplicate', () => {
    it('should return existing game if content matches', async () => {
      const pgnContent = '[Event "Test"]\n1. e4 e5';
      const userId = 'user123';
      const existingGame = { id: 1, white: 'Player1', black: 'Player2' };

      mockDatabase.findGameByContentHash.mockResolvedValue(existingGame);

      const result = await service.checkDuplicate(pgnContent, userId);

      expect(result).toEqual(existingGame);
      expect(mockDatabase.findGameByContentHash).toHaveBeenCalledWith(
        expect.any(String), // hash
        userId
      );
    });

    it('should return null if no duplicate found', async () => {
      mockDatabase.findGameByContentHash.mockResolvedValue(null);

      const result = await service.checkDuplicate('[Event "Test"]', 'user123');

      expect(result).toBeNull();
    });

    it('should use SHA256 hash of content', async () => {
      const pgnContent = '[Event "Test"]';
      const expectedHash = crypto.createHash('sha256').update(pgnContent).digest('hex');

      mockDatabase.findGameByContentHash.mockResolvedValue(null);

      await service.checkDuplicate(pgnContent, 'user123');

      expect(mockDatabase.findGameByContentHash).toHaveBeenCalledWith(
        expectedHash,
        'user123'
      );
    });
  });

  describe('storePGNFile', () => {
    it('should store PGN in tournament folder when tournament is assigned', async () => {
      const mockFileResult = {
        relativePath: 'tournaments/Test Tournament/game.pgn',
        tournamentFolder: 'tournaments/Test Tournament',
        fileName: 'game.pgn'
      };

      mockFileStorage.storePGNInTournament.mockResolvedValue(mockFileResult);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await service.storePGNFile(
        '[Event "Test"]',
        'game.pgn',
        'Test Tournament',
        true // assigned
      );

      expect(result.storedFilePath).toBe('tournaments/Test Tournament/game.pgn');
      expect(mockFileStorage.storePGNInTournament).toHaveBeenCalledWith(
        '[Event "Test"]',
        'game.pgn',
        'Test Tournament'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stored in tournament folder')
      );

      consoleLogSpy.mockRestore();
    });

    it('should use database storage when tournament is not assigned', async () => {
      const result = await service.storePGNFile(
        '[Event "Test"]',
        'game.pgn',
        'Test Tournament',
        false // not assigned
      );

      expect(result.storedFilePath).toBe('database');
      expect(mockFileStorage.storePGNInTournament).not.toHaveBeenCalled();
    });

    it('should fallback to database on file storage error', async () => {
      mockFileStorage.storePGNInTournament.mockRejectedValue(new Error('Storage failed'));
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await service.storePGNFile(
        '[Event "Test"]',
        'game.pgn',
        'Test Tournament',
        true
      );

      expect(result.storedFilePath).toBe('database');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to store in tournament folder'),
        'Storage failed'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle null fileStorage', async () => {
      service.fileStorage = null;

      const result = await service.storePGNFile(
        '[Event "Test"]',
        'game.pgn',
        'Test Tournament',
        true
      );

      expect(result.storedFilePath).toBe('database');
    });
  });

  describe('storeGame', () => {
    const mockGame = {
      white: 'Player1',
      black: 'Player2',
      result: '1-0',
      date: '2025.01.15',
      whiteElo: 1800,
      blackElo: 1750,
      moves: ['e4', 'e5']
    };

    const mockAnalyzedGame = {
      ...mockGame,
      analysis: {
        accuracy: 95,
        blunders: 1,
        centipawnLoss: 12,
        moveCount: 2,
        fullAnalysis: [
          { move_number: 1, evaluation: 25, best_move: 'e4', alternatives: [], fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }
        ]
      }
    };

    const mockTournament = {
      id: 1,
      name: 'Test Tournament'
    };

    it('should store game in database', async () => {
      mockDatabase.insertGame.mockResolvedValue({ id: 42 });
      mockDatabase.insertAnalysis.mockResolvedValue();
      mockDatabase.storePositionEvaluation.mockResolvedValue();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const gameId = await service.storeGame(
        mockGame,
        mockAnalyzedGame,
        mockTournament,
        '[Event "Test"]',
        'database',
        'user123',
        0
      );

      expect(gameId).toBe(42);
      expect(mockDatabase.insertGame).toHaveBeenCalledWith(
        expect.objectContaining({
          whitePlayer: 'Player1',
          blackPlayer: 'Player2',
          result: '1-0',
          event: 'Test Tournament',
          tournamentId: 1,
          userId: 'user123'
        }),
        '[Event "Test"]'
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle missing player names', async () => {
      const gameWithoutNames = { ...mockGame, white: undefined, black: undefined };
      mockDatabase.insertGame.mockResolvedValue({ id: 42 });

      await service.storeGame(
        gameWithoutNames,
        { ...gameWithoutNames, analysis: null },
        mockTournament,
        '[Event "Test"]',
        'database',
        'user123',
        0
      );

      expect(mockDatabase.insertGame).toHaveBeenCalledWith(
        expect.objectContaining({
          whitePlayer: 'Unknown',
          blackPlayer: 'Unknown'
        }),
        expect.any(String)
      );
    });

    it('should store analysis data when available', async () => {
      mockDatabase.insertGame.mockResolvedValue({ id: 42 });
      mockDatabase.insertAnalysis.mockResolvedValue();
      mockDatabase.storePositionEvaluation.mockResolvedValue();

      await service.storeGame(
        mockGame,
        mockAnalyzedGame,
        mockTournament,
        '[Event "Test"]',
        'database',
        'user123',
        0
      );

      expect(mockDatabase.insertAnalysis).toHaveBeenCalled();
      expect(mockDatabase.storePositionEvaluation).toHaveBeenCalled();
    });

    it('should not store analysis when not available', async () => {
      mockDatabase.insertGame.mockResolvedValue({ id: 42 });

      await service.storeGame(
        mockGame,
        { ...mockGame, analysis: null },
        mockTournament,
        '[Event "Test"]',
        'database',
        'user123',
        0
      );

      expect(mockDatabase.insertAnalysis).not.toHaveBeenCalled();
    });
  });

  describe('storeAnalysisData', () => {
    const mockAnalysisData = [
      {
        move_number: 1,
        evaluation: 25,
        best_move: 'e4',
        alternatives: [
          { move: 'd4', evaluation: 20 },
          { move: 'Nf3', evaluation: 18 }
        ],
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      },
      {
        move_number: 2,
        evaluation: -20,
        best_move: 'e5',
        alternatives: [],
        fen_before: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
      }
    ];

    beforeEach(() => {
      mockDatabase.insertAnalysis.mockResolvedValue();
      mockDatabase.storeAlternativeMoves.mockResolvedValue();
      mockDatabase.storePositionEvaluation.mockResolvedValue();
    });

    it('should store all move analyses', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.storeAnalysisData(1, mockAnalysisData);

      expect(mockDatabase.insertAnalysis).toHaveBeenCalledTimes(2);
      expect(mockDatabase.storePositionEvaluation).toHaveBeenCalledTimes(2);

      consoleLogSpy.mockRestore();
    });

    it('should store alternative moves when available', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.storeAnalysisData(1, mockAnalysisData);

      expect(mockDatabase.storeAlternativeMoves).toHaveBeenCalledWith(
        1,
        1,
        mockAnalysisData[0].alternatives
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stored 2 alternatives for move 1')
      );

      consoleLogSpy.mockRestore();
    });

    it('should store position evaluations with FEN', async () => {
      await service.storeAnalysisData(1, mockAnalysisData);

      expect(mockDatabase.storePositionEvaluation).toHaveBeenCalledWith(
        1,
        1,
        mockAnalysisData[0].fen_before,
        mockAnalysisData[0].evaluation,
        mockAnalysisData[0].best_move,
        12, // depth
        null // mateIn
      );
    });

    it('should handle empty analysis data', async () => {
      await service.storeAnalysisData(1, []);

      expect(mockDatabase.insertAnalysis).not.toHaveBeenCalled();
    });
  });

  describe('storeGames', () => {
    it('should store multiple games', async () => {
      const games = [
        { white: 'P1', black: 'P2', moves: ['e4'] },
        { white: 'P3', black: 'P4', moves: ['d4'] }
      ];
      const analyzedGames = [
        { ...games[0], analysis: { fullAnalysis: [] } },
        { ...games[1], analysis: { fullAnalysis: [] } }
      ];
      const tournament = { id: 1, name: 'Test' };

      mockDatabase.insertGame
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 });

      const result = await service.storeGames(
        games,
        analyzedGames,
        tournament,
        '[Event "Test"]',
        'database',
        'user123'
      );

      expect(result).toEqual([1, 2]);
      expect(mockDatabase.insertGame).toHaveBeenCalledTimes(2);
    });

    it('should continue storing games even if one fails', async () => {
      const games = [
        { white: 'P1', black: 'P2', moves: ['e4'] },
        { white: 'P3', black: 'P4', moves: ['d4'] }
      ];
      const analyzedGames = games.map(g => ({ ...g, analysis: { fullAnalysis: [] } }));
      const tournament = { id: 1, name: 'Test' };

      mockDatabase.insertGame
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ id: 2 });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.storeGames(
        games,
        analyzedGames,
        tournament,
        '[Event "Test"]',
        'database',
        'user123'
      );

      expect(result).toEqual([2]);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('updatePerformanceMetrics', () => {
    it('should call database updatePerformanceMetrics', async () => {
      mockDatabase.updatePerformanceMetrics.mockResolvedValue();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.updatePerformanceMetrics();

      expect(mockDatabase.updatePerformanceMetrics).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance metrics updated')
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle update errors gracefully', async () => {
      mockDatabase.updatePerformanceMetrics.mockRejectedValue(
        new Error('Update failed')
      );
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.updatePerformanceMetrics();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update performance metrics'),
        'Update failed'
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
