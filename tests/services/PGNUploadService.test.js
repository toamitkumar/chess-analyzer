const PGNUploadService = require('../../src/services/PGNUploadService');

describe('PGNUploadService', () => {
  let service;
  let mockPGNParser;
  let mockTournamentService;
  let mockAnalysisService;
  let mockStorageService;

  beforeEach(() => {
    // Create mocks for all dependencies
    mockPGNParser = {
      validatePGN: jest.fn(),
      parseFile: jest.fn()
    };

    mockTournamentService = {
      resolveTournament: jest.fn(),
      updateTournamentGameCount: jest.fn()
    };

    mockAnalysisService = {
      ensureReady: jest.fn(),
      analyzeGames: jest.fn(),
      close: jest.fn()
    };

    mockStorageService = {
      checkDuplicate: jest.fn(),
      storePGNFile: jest.fn(),
      storeGames: jest.fn(),
      updatePerformanceMetrics: jest.fn()
    };

    service = new PGNUploadService({
      pgnParser: mockPGNParser,
      tournamentService: mockTournamentService,
      analysisService: mockAnalysisService,
      storageService: mockStorageService
    });
  });

  describe('processPGNUpload', () => {
    const validPGN = '[Event "Test Tournament"]\n[White "Player1"]\n[Black "Player2"]\n\n1. e4 e5';
    const userId = 'user123';

    it('should throw error for invalid PGN content', async () => {
      await expect(
        service.processPGNUpload({ pgnContent: null, userId })
      ).rejects.toThrow('Invalid PGN content');

      await expect(
        service.processPGNUpload({ pgnContent: '', userId })
      ).rejects.toThrow('Invalid PGN content');
    });

    it('should return early if duplicate is found', async () => {
      const existingGame = { id: 42 };
      mockStorageService.checkDuplicate.mockResolvedValue(existingGame);

      const result = await service.processPGNUpload({ pgnContent: validPGN, userId });

      expect(result).toEqual({
        success: true,
        message: 'PGN content already exists in database',
        duplicate: true,
        existingGameId: 42
      });

      // Should not proceed with validation/parsing
      expect(mockPGNParser.validatePGN).not.toHaveBeenCalled();
    });

    it('should throw error for invalid PGN format', async () => {
      mockStorageService.checkDuplicate.mockResolvedValue(null);
      mockPGNParser.validatePGN.mockReturnValue({
        valid: false,
        error: 'Invalid PGN format'
      });

      await expect(
        service.processPGNUpload({ pgnContent: 'invalid', userId })
      ).rejects.toThrow('Invalid PGN format');
    });

    it('should successfully process valid PGN upload', async () => {
      const mockTournament = { id: 1, name: 'Test Tournament', event_type: 'Blitz', location: 'Online' };
      const mockParseResult = {
        totalGames: 1,
        games: [{ white: 'P1', black: 'P2', moves: ['e4', 'e5'] }],
        errors: []
      };
      const mockAnalyzedGames = [
        { white: 'P1', black: 'P2', moves: ['e4', 'e5'], analysis: { accuracy: 95 } }
      ];

      mockStorageService.checkDuplicate.mockResolvedValue(null);
      mockPGNParser.validatePGN.mockReturnValue({ valid: true });
      mockTournamentService.resolveTournament.mockResolvedValue({
        tournament: mockTournament,
        wasAssigned: false
      });
      mockPGNParser.parseFile.mockReturnValue(mockParseResult);
      mockAnalysisService.ensureReady.mockResolvedValue();
      mockAnalysisService.analyzeGames.mockResolvedValue({
        analyzedGames: mockAnalyzedGames,
        analysisErrors: [],
        successCount: 1,
        errorCount: 0
      });
      mockStorageService.storePGNFile.mockResolvedValue({ storedFilePath: 'database' });
      mockStorageService.storeGames.mockResolvedValue([1]);
      mockTournamentService.updateTournamentGameCount.mockResolvedValue();
      mockAnalysisService.close.mockResolvedValue();
      mockStorageService.updatePerformanceMetrics.mockResolvedValue();

      const result = await service.processPGNUpload({ pgnContent: validPGN, userId });

      expect(result).toEqual({
        success: true,
        message: 'Successfully imported and analyzed 1 games',
        gamesCount: 1,
        totalGames: 1,
        analyzedGames: 1,
        storedGames: 1,
        tournament: {
          id: 1,
          name: 'Test Tournament',
          eventType: 'Blitz',
          location: 'Online',
          assigned: false
        },
        games: mockAnalyzedGames.slice(0, 5),
        errors: []
      });
    });

    it('should call all services in correct order', async () => {
      const mockTournament = { id: 1, name: 'Test', event_type: 'Blitz', location: 'Online' };
      const mockParseResult = {
        totalGames: 1,
        games: [{ white: 'P1', black: 'P2', moves: ['e4'] }],
        errors: []
      };

      mockStorageService.checkDuplicate.mockResolvedValue(null);
      mockPGNParser.validatePGN.mockReturnValue({ valid: true });
      mockTournamentService.resolveTournament.mockResolvedValue({ tournament: mockTournament, wasAssigned: false });
      mockPGNParser.parseFile.mockReturnValue(mockParseResult);
      mockAnalysisService.ensureReady.mockResolvedValue();
      mockAnalysisService.analyzeGames.mockResolvedValue({ analyzedGames: [{}], analysisErrors: [], successCount: 1 });
      mockStorageService.storePGNFile.mockResolvedValue({ storedFilePath: 'database' });
      mockStorageService.storeGames.mockResolvedValue([1]);
      mockTournamentService.updateTournamentGameCount.mockResolvedValue();
      mockAnalysisService.close.mockResolvedValue();
      mockStorageService.updatePerformanceMetrics.mockResolvedValue();

      await service.processPGNUpload({ pgnContent: validPGN, userId });

      // Verify call order
      expect(mockStorageService.checkDuplicate).toHaveBeenCalled();
      expect(mockPGNParser.validatePGN).toHaveBeenCalled();
      expect(mockTournamentService.resolveTournament).toHaveBeenCalled();
      expect(mockPGNParser.parseFile).toHaveBeenCalled();
      expect(mockAnalysisService.ensureReady).toHaveBeenCalled();
      expect(mockAnalysisService.analyzeGames).toHaveBeenCalled();
      expect(mockStorageService.storePGNFile).toHaveBeenCalled();
      expect(mockStorageService.storeGames).toHaveBeenCalled();
      expect(mockTournamentService.updateTournamentGameCount).toHaveBeenCalled();
      expect(mockAnalysisService.close).toHaveBeenCalled();
      expect(mockStorageService.updatePerformanceMetrics).toHaveBeenCalled();
    });

    it('should handle assigned tournament', async () => {
      const mockTournament = { id: 5, name: 'Assigned', event_type: 'Rapid', location: 'City' };
      const mockParseResult = {
        totalGames: 1,
        games: [{ white: 'P1', black: 'P2', moves: ['e4'] }],
        errors: []
      };

      mockStorageService.checkDuplicate.mockResolvedValue(null);
      mockPGNParser.validatePGN.mockReturnValue({ valid: true });
      mockTournamentService.resolveTournament.mockResolvedValue({
        tournament: mockTournament,
        wasAssigned: true
      });
      mockPGNParser.parseFile.mockReturnValue(mockParseResult);
      mockAnalysisService.ensureReady.mockResolvedValue();
      mockAnalysisService.analyzeGames.mockResolvedValue({ analyzedGames: [{}], analysisErrors: [], successCount: 1 });
      mockStorageService.storePGNFile.mockResolvedValue({ storedFilePath: 'tournaments/Assigned/game.pgn' });
      mockStorageService.storeGames.mockResolvedValue([1]);
      mockTournamentService.updateTournamentGameCount.mockResolvedValue();
      mockAnalysisService.close.mockResolvedValue();
      mockStorageService.updatePerformanceMetrics.mockResolvedValue();

      const result = await service.processPGNUpload({
        pgnContent: validPGN,
        assignedTournamentId: 5,
        userId
      });

      expect(result.tournament.assigned).toBe(true);
      expect(mockTournamentService.resolveTournament).toHaveBeenCalledWith(validPGN, 5, userId);
    });

    it('should not update tournament or metrics when no games stored', async () => {
      const mockTournament = { id: 1, name: 'Test', event_type: 'Blitz', location: 'Online' };
      const mockParseResult = {
        totalGames: 0,
        games: [],
        errors: []
      };

      mockStorageService.checkDuplicate.mockResolvedValue(null);
      mockPGNParser.validatePGN.mockReturnValue({ valid: true });
      mockTournamentService.resolveTournament.mockResolvedValue({ tournament: mockTournament, wasAssigned: false });
      mockPGNParser.parseFile.mockReturnValue(mockParseResult);
      mockAnalysisService.ensureReady.mockResolvedValue();
      mockAnalysisService.analyzeGames.mockResolvedValue({ analyzedGames: [], analysisErrors: [], successCount: 0 });
      mockStorageService.storePGNFile.mockResolvedValue({ storedFilePath: 'database' });
      mockStorageService.storeGames.mockResolvedValue([]);
      mockAnalysisService.close.mockResolvedValue();

      await service.processPGNUpload({ pgnContent: validPGN, userId });

      expect(mockTournamentService.updateTournamentGameCount).not.toHaveBeenCalled();
      expect(mockStorageService.updatePerformanceMetrics).not.toHaveBeenCalled();
    });

    it('should use default file name when not provided', async () => {
      const mockTournament = { id: 1, name: 'Test', event_type: 'Blitz', location: 'Online' };
      const mockParseResult = {
        totalGames: 1,
        games: [{ white: 'P1', black: 'P2', moves: ['e4'] }],
        errors: []
      };

      mockStorageService.checkDuplicate.mockResolvedValue(null);
      mockPGNParser.validatePGN.mockReturnValue({ valid: true });
      mockTournamentService.resolveTournament.mockResolvedValue({ tournament: mockTournament, wasAssigned: false });
      mockPGNParser.parseFile.mockReturnValue(mockParseResult);
      mockAnalysisService.ensureReady.mockResolvedValue();
      mockAnalysisService.analyzeGames.mockResolvedValue({ analyzedGames: [{}], analysisErrors: [], successCount: 1 });
      mockStorageService.storePGNFile.mockResolvedValue({ storedFilePath: 'database' });
      mockStorageService.storeGames.mockResolvedValue([1]);
      mockTournamentService.updateTournamentGameCount.mockResolvedValue();
      mockAnalysisService.close.mockResolvedValue();
      mockStorageService.updatePerformanceMetrics.mockResolvedValue();

      await service.processPGNUpload({ pgnContent: validPGN, userId });

      expect(mockStorageService.storePGNFile).toHaveBeenCalledWith(
        validPGN,
        'uploaded.pgn',
        'Test',
        false
      );
    });
  });

  describe('processManualEntry', () => {
    const manualGameData = {
      tournamentName: 'Manual Tournament',
      date: '2025-01-15',
      opponent: 'Opponent1',
      opponentElo: 1800,
      playerElo: 1900,
      result: '1-0',
      variant: '600+0',
      termination: 'Normal',
      playerColor: 'white',
      moves: '1. e4 e5 2. Nf3 Nc6',
      targetPlayer: 'TestPlayer'
    };

    it('should throw error for missing required fields', async () => {
      const incompleteData = { ...manualGameData };
      delete incompleteData.opponent;

      await expect(
        service.processManualEntry(incompleteData, 'user123')
      ).rejects.toThrow('Missing required fields');
    });

    it('should construct valid PGN from manual entry', async () => {
      mockStorageService.checkDuplicate.mockResolvedValue(null);
      mockPGNParser.validatePGN.mockReturnValue({ valid: true });
      mockTournamentService.resolveTournament.mockResolvedValue({
        tournament: { id: 1, name: 'Manual Tournament', event_type: 'Blitz', location: 'Online' },
        wasAssigned: false
      });
      mockPGNParser.parseFile.mockReturnValue({
        totalGames: 1,
        games: [{ white: 'TestPlayer', black: 'Opponent1', moves: ['e4', 'e5'] }],
        errors: []
      });
      mockAnalysisService.ensureReady.mockResolvedValue();
      mockAnalysisService.analyzeGames.mockResolvedValue({ analyzedGames: [{}], analysisErrors: [], successCount: 1 });
      mockStorageService.storePGNFile.mockResolvedValue({ storedFilePath: 'database' });
      mockStorageService.storeGames.mockResolvedValue([1]);
      mockTournamentService.updateTournamentGameCount.mockResolvedValue();
      mockAnalysisService.close.mockResolvedValue();
      mockStorageService.updatePerformanceMetrics.mockResolvedValue();

      await service.processManualEntry(manualGameData, 'user123');

      // Verify PGN was validated with correct format
      expect(mockPGNParser.validatePGN).toHaveBeenCalledWith(
        expect.stringContaining('[Event "Manual Tournament"]')
      );
      expect(mockPGNParser.validatePGN).toHaveBeenCalledWith(
        expect.stringContaining('[White "TestPlayer"]')
      );
      expect(mockPGNParser.validatePGN).toHaveBeenCalledWith(
        expect.stringContaining('[Black "Opponent1"]')
      );
    });

    it('should handle player as black correctly', async () => {
      const blackGameData = { ...manualGameData, playerColor: 'black' };

      mockStorageService.checkDuplicate.mockResolvedValue(null);
      mockPGNParser.validatePGN.mockReturnValue({ valid: true });
      mockTournamentService.resolveTournament.mockResolvedValue({
        tournament: { id: 1, name: 'Manual', event_type: 'Blitz', location: 'Online' },
        wasAssigned: false
      });
      mockPGNParser.parseFile.mockReturnValue({
        totalGames: 1,
        games: [{ white: 'Opponent1', black: 'TestPlayer', moves: ['e4'] }],
        errors: []
      });
      mockAnalysisService.ensureReady.mockResolvedValue();
      mockAnalysisService.analyzeGames.mockResolvedValue({ analyzedGames: [{}], analysisErrors: [], successCount: 1 });
      mockStorageService.storePGNFile.mockResolvedValue({ storedFilePath: 'database' });
      mockStorageService.storeGames.mockResolvedValue([1]);
      mockTournamentService.updateTournamentGameCount.mockResolvedValue();
      mockAnalysisService.close.mockResolvedValue();
      mockStorageService.updatePerformanceMetrics.mockResolvedValue();

      await service.processManualEntry(blackGameData, 'user123');

      expect(mockPGNParser.validatePGN).toHaveBeenCalledWith(
        expect.stringContaining('[White "Opponent1"]')
      );
      expect(mockPGNParser.validatePGN).toHaveBeenCalledWith(
        expect.stringContaining('[Black "TestPlayer"]')
      );
    });

    it('should format date correctly', async () => {
      mockStorageService.checkDuplicate.mockResolvedValue(null);
      mockPGNParser.validatePGN.mockReturnValue({ valid: true });
      mockTournamentService.resolveTournament.mockResolvedValue({
        tournament: { id: 1, name: 'Manual', event_type: 'Blitz', location: 'Online' },
        wasAssigned: false
      });
      mockPGNParser.parseFile.mockReturnValue({ totalGames: 1, games: [{}], errors: [] });
      mockAnalysisService.ensureReady.mockResolvedValue();
      mockAnalysisService.analyzeGames.mockResolvedValue({ analyzedGames: [{}], analysisErrors: [], successCount: 1 });
      mockStorageService.storePGNFile.mockResolvedValue({ storedFilePath: 'database' });
      mockStorageService.storeGames.mockResolvedValue([1]);
      mockTournamentService.updateTournamentGameCount.mockResolvedValue();
      mockAnalysisService.close.mockResolvedValue();
      mockStorageService.updatePerformanceMetrics.mockResolvedValue();

      await service.processManualEntry(manualGameData, 'user123');

      // Date should be converted from 2025-01-15 to 2025.01.15
      expect(mockPGNParser.validatePGN).toHaveBeenCalledWith(
        expect.stringContaining('[Date "2025.01.15"]')
      );
    });

    it('should include ELO ratings in PGN headers', async () => {
      mockStorageService.checkDuplicate.mockResolvedValue(null);
      mockPGNParser.validatePGN.mockReturnValue({ valid: true });
      mockTournamentService.resolveTournament.mockResolvedValue({
        tournament: { id: 1, name: 'Manual', event_type: 'Blitz', location: 'Online' },
        wasAssigned: false
      });
      mockPGNParser.parseFile.mockReturnValue({ totalGames: 1, games: [{}], errors: [] });
      mockAnalysisService.ensureReady.mockResolvedValue();
      mockAnalysisService.analyzeGames.mockResolvedValue({ analyzedGames: [{}], analysisErrors: [], successCount: 1 });
      mockStorageService.storePGNFile.mockResolvedValue({ storedFilePath: 'database' });
      mockStorageService.storeGames.mockResolvedValue([1]);
      mockTournamentService.updateTournamentGameCount.mockResolvedValue();
      mockAnalysisService.close.mockResolvedValue();
      mockStorageService.updatePerformanceMetrics.mockResolvedValue();

      await service.processManualEntry(manualGameData, 'user123');

      expect(mockPGNParser.validatePGN).toHaveBeenCalledWith(
        expect.stringContaining('[WhiteElo "1900"]')
      );
      expect(mockPGNParser.validatePGN).toHaveBeenCalledWith(
        expect.stringContaining('[BlackElo "1800"]')
      );
    });
  });
});
