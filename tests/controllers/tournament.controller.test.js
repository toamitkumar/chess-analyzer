/**
 * Unit Tests for Tournament Controller
 *
 * Tests all tournament controller methods with mocked dependencies
 */

const tournamentController = require('../../src/api/controllers/tournament.controller');
const { getDatabase } = require('../../src/models/database');
const { getTournamentManager } = require('../../src/models/tournament-manager');
const { getTournamentAnalyzer } = require('../../src/models/tournament-analyzer');
const { getFileStorage } = require('../../src/models/file-storage');
const AccuracyCalculator = require('../../src/models/accuracy-calculator');

// Mock all dependencies
jest.mock('../../src/models/database');
jest.mock('../../src/models/tournament-manager');
jest.mock('../../src/models/tournament-analyzer');
jest.mock('../../src/models/file-storage');
jest.mock('../../src/models/accuracy-calculator');

describe('TournamentController', () => {
  let mockReq, mockRes, mockDatabase, mockTournamentManager, mockTournamentAnalyzer, mockFileStorage;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock request object
    mockReq = {
      body: {},
      params: {},
      query: {},
      userId: 'test-user-123'
    };

    // Mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Mock database
    mockDatabase = {
      findTournamentByName: jest.fn(),
      insertTournament: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      getAllTournaments: jest.fn()
    };
    getDatabase.mockReturnValue(mockDatabase);

    // Mock tournament manager
    mockTournamentManager = {
      getAllTournaments: jest.fn(),
      getTournamentById: jest.fn(),
      getTournamentStats: jest.fn()
    };
    getTournamentManager.mockReturnValue(mockTournamentManager);

    // Mock tournament analyzer
    mockTournamentAnalyzer = {
      getTournamentPerformance: jest.fn(),
      getTournamentHeatmap: jest.fn(),
      getTournamentTrends: jest.fn(),
      getTournamentSummary: jest.fn(),
      compareTournaments: jest.fn(),
      rankTournaments: jest.fn()
    };
    getTournamentAnalyzer.mockReturnValue(mockTournamentAnalyzer);

    // Mock file storage
    mockFileStorage = {
      listTournamentFiles: jest.fn(),
      listTournamentFolders: jest.fn()
    };
    getFileStorage.mockReturnValue(mockFileStorage);
  });

  describe('create()', () => {
    it('should create a tournament successfully', async () => {
      mockReq.body = {
        name: 'Test Tournament',
        eventType: 'rapid',
        location: 'Online',
        startDate: '2025-01-01',
        endDate: '2025-01-05'
      };

      mockDatabase.findTournamentByName.mockResolvedValue(null);
      mockDatabase.insertTournament.mockResolvedValue({ id: 1 });

      await tournamentController.create(mockReq, mockRes);

      expect(mockDatabase.findTournamentByName).toHaveBeenCalledWith('Test Tournament', 'test-user-123');
      expect(mockDatabase.insertTournament).toHaveBeenCalledWith({
        name: 'Test Tournament',
        eventType: 'rapid',
        location: 'Online',
        startDate: '2025-01-01',
        endDate: '2025-01-05',
        userId: 'test-user-123'
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        id: 1,
        name: 'Test Tournament',
        event_type: 'rapid',
        location: 'Online',
        total_games: 0
      }));
    });

    it('should return 400 if tournament name is missing', async () => {
      mockReq.body = {};

      await tournamentController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Tournament name is required' });
      expect(mockDatabase.insertTournament).not.toHaveBeenCalled();
    });

    it('should return 409 if tournament with same name exists', async () => {
      mockReq.body = { name: 'Existing Tournament' };
      mockDatabase.findTournamentByName.mockResolvedValue({ id: 1, name: 'Existing Tournament' });

      await tournamentController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Tournament with this name already exists' });
      expect(mockDatabase.insertTournament).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockReq.body = { name: 'Test Tournament' };
      mockDatabase.findTournamentByName.mockRejectedValue(new Error('Database error'));

      await tournamentController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to create tournament' });
    });

    it('should trim tournament name and use defaults for optional fields', async () => {
      mockReq.body = { name: '  Spaced Tournament  ' };
      mockDatabase.findTournamentByName.mockResolvedValue(null);
      mockDatabase.insertTournament.mockResolvedValue({ id: 2 });

      await tournamentController.create(mockReq, mockRes);

      expect(mockDatabase.insertTournament).toHaveBeenCalledWith({
        name: 'Spaced Tournament',
        eventType: 'standard',
        location: null,
        startDate: null,
        endDate: null,
        userId: 'test-user-123'
      });
    });
  });

  describe('list()', () => {
    it('should return list of tournaments', async () => {
      const mockTournaments = [
        { id: 1, name: 'Tournament 1', total_games: 10 },
        { id: 2, name: 'Tournament 2', total_games: 5 }
      ];
      mockTournamentManager.getAllTournaments.mockResolvedValue(mockTournaments);

      await tournamentController.list(mockReq, mockRes);

      expect(mockTournamentManager.getAllTournaments).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockTournaments);
    });

    it('should return empty array on error', async () => {
      mockTournamentManager.getAllTournaments.mockRejectedValue(new Error('Database error'));

      await tournamentController.list(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getById()', () => {
    it('should return tournament details with stats', async () => {
      mockReq.params.id = '1';
      const mockTournament = { id: 1, name: 'Test Tournament' };
      const mockStats = { total_games: 10, white_wins: 5, black_wins: 3, draws: 2 };

      mockTournamentManager.getTournamentById.mockResolvedValue(mockTournament);
      mockTournamentManager.getTournamentStats.mockResolvedValue(mockStats);

      await tournamentController.getById(mockReq, mockRes);

      expect(mockTournamentManager.getTournamentById).toHaveBeenCalledWith(1);
      expect(mockTournamentManager.getTournamentStats).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalledWith({
        ...mockTournament,
        stats: mockStats
      });
    });

    it('should return 404 if tournament not found', async () => {
      mockReq.params.id = '999';
      mockTournamentManager.getTournamentById.mockResolvedValue(null);

      await tournamentController.getById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Tournament not found' });
    });

    it('should handle errors gracefully', async () => {
      mockReq.params.id = '1';
      mockTournamentManager.getTournamentById.mockRejectedValue(new Error('Database error'));

      await tournamentController.getById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to get tournament details' });
    });
  });

  describe('getPerformance()', () => {
    it('should return tournament performance data', async () => {
      mockReq.params.id = '1';
      const mockPerformance = { accuracy: 85, blunders: 3, avgCentipawnLoss: 25 };
      mockTournamentAnalyzer.getTournamentPerformance.mockResolvedValue(mockPerformance);

      await tournamentController.getPerformance(mockReq, mockRes);

      expect(mockTournamentAnalyzer.getTournamentPerformance).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalledWith(mockPerformance);
    });

    it('should handle errors gracefully', async () => {
      mockReq.params.id = '1';
      mockTournamentAnalyzer.getTournamentPerformance.mockRejectedValue(new Error('Analysis error'));

      await tournamentController.getPerformance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to get tournament performance' });
    });
  });

  describe('getHeatmap()', () => {
    it('should return tournament heatmap data', async () => {
      mockReq.params.id = '1';
      const mockHeatmap = [
        { move: 10, quality: 'good' },
        { move: 15, quality: 'blunder' }
      ];
      mockTournamentAnalyzer.getTournamentHeatmap.mockResolvedValue(mockHeatmap);

      await tournamentController.getHeatmap(mockReq, mockRes);

      expect(mockTournamentAnalyzer.getTournamentHeatmap).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalledWith(mockHeatmap);
    });

    it('should return empty array on error', async () => {
      mockReq.params.id = '1';
      mockTournamentAnalyzer.getTournamentHeatmap.mockRejectedValue(new Error('Analysis error'));

      await tournamentController.getHeatmap(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getTrends()', () => {
    it('should return tournament trends data', async () => {
      mockReq.params.id = '1';
      const mockTrends = [
        { round: 1, accuracy: 80 },
        { round: 2, accuracy: 85 }
      ];
      mockTournamentAnalyzer.getTournamentTrends.mockResolvedValue(mockTrends);

      await tournamentController.getTrends(mockReq, mockRes);

      expect(mockTournamentAnalyzer.getTournamentTrends).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalledWith(mockTrends);
    });

    it('should return empty array on error', async () => {
      mockReq.params.id = '1';
      mockTournamentAnalyzer.getTournamentTrends.mockRejectedValue(new Error('Analysis error'));

      await tournamentController.getTrends(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getSummary()', () => {
    it('should return tournament summary', async () => {
      mockReq.params.id = '1';
      const mockSummary = {
        total_games: 10,
        wins: 6,
        losses: 2,
        draws: 2,
        avg_accuracy: 85
      };
      mockTournamentAnalyzer.getTournamentSummary.mockResolvedValue(mockSummary);

      await tournamentController.getSummary(mockReq, mockRes);

      expect(mockTournamentAnalyzer.getTournamentSummary).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalledWith(mockSummary);
    });

    it('should handle errors gracefully', async () => {
      mockReq.params.id = '1';
      mockTournamentAnalyzer.getTournamentSummary.mockRejectedValue(new Error('Analysis error'));

      await tournamentController.getSummary(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to get tournament summary' });
    });
  });

  describe('compare()', () => {
    it('should compare multiple tournaments', async () => {
      mockReq.query.ids = '1,2,3';
      const mockComparison = [
        { id: 1, name: 'T1', avg_accuracy: 85 },
        { id: 2, name: 'T2', avg_accuracy: 80 },
        { id: 3, name: 'T3', avg_accuracy: 90 }
      ];
      mockTournamentAnalyzer.compareTournaments.mockResolvedValue(mockComparison);

      await tournamentController.compare(mockReq, mockRes);

      expect(mockTournamentAnalyzer.compareTournaments).toHaveBeenCalledWith([1, 2, 3]);
      expect(mockRes.json).toHaveBeenCalledWith(mockComparison);
    });

    it('should return empty array if no IDs provided', async () => {
      mockReq.query.ids = '';

      await tournamentController.compare(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
      expect(mockTournamentAnalyzer.compareTournaments).not.toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      mockReq.query.ids = '1,2';
      mockTournamentAnalyzer.compareTournaments.mockRejectedValue(new Error('Analysis error'));

      await tournamentController.compare(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getRankings()', () => {
    it('should return tournament rankings', async () => {
      const mockRankings = [
        { id: 1, name: 'T1', score: 95 },
        { id: 2, name: 'T2', score: 90 }
      ];
      mockTournamentAnalyzer.rankTournaments.mockResolvedValue(mockRankings);

      await tournamentController.getRankings(mockReq, mockRes);

      expect(mockTournamentAnalyzer.rankTournaments).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockRankings);
    });

    it('should return empty array on error', async () => {
      mockTournamentAnalyzer.rankTournaments.mockRejectedValue(new Error('Analysis error'));

      await tournamentController.getRankings(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getFiles()', () => {
    it('should return tournament files', async () => {
      mockReq.params.id = '1';
      const mockTournament = { id: 1, name: 'Test Tournament' };
      const mockFiles = ['game1.pgn', 'game2.pgn'];

      mockTournamentManager.getTournamentById.mockResolvedValue(mockTournament);
      mockFileStorage.listTournamentFiles.mockReturnValue(mockFiles);

      await tournamentController.getFiles(mockReq, mockRes);

      expect(mockTournamentManager.getTournamentById).toHaveBeenCalledWith(1);
      expect(mockFileStorage.listTournamentFiles).toHaveBeenCalledWith('Test Tournament');
      expect(mockRes.json).toHaveBeenCalledWith(mockFiles);
    });

    it('should return 404 if tournament not found', async () => {
      mockReq.params.id = '999';
      mockTournamentManager.getTournamentById.mockResolvedValue(null);

      await tournamentController.getFiles(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Tournament not found' });
    });

    it('should return empty array on error', async () => {
      mockReq.params.id = '1';
      mockTournamentManager.getTournamentById.mockRejectedValue(new Error('Database error'));

      await tournamentController.getFiles(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('listFolders()', () => {
    it('should return tournament folders', async () => {
      const mockFolders = ['tournament1', 'tournament2', 'tournament3'];
      mockFileStorage.listTournamentFolders.mockReturnValue(mockFolders);

      await tournamentController.listFolders(mockReq, mockRes);

      expect(mockFileStorage.listTournamentFolders).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockFolders);
    });

    it('should return empty array on error', async () => {
      mockFileStorage.listTournamentFolders.mockImplementation(() => {
        throw new Error('File system error');
      });

      await tournamentController.listFolders(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getPlayerPerformance()', () => {
    it('should calculate player performance for tournament', async () => {
      mockReq.params.id = '1';

      const mockGames = [
        {
          id: 1,
          white_player: 'AdvaitKumar1213',
          black_player: 'Opponent1',
          result: '1-0',
          white_elo: 1800,
          black_elo: 1750
        },
        {
          id: 2,
          white_player: 'Opponent2',
          black_player: 'AdvaitKumar1213',
          result: '0-1',
          white_elo: 1820,
          black_elo: 1800
        },
        {
          id: 3,
          white_player: 'AdvaitKumar1213',
          black_player: 'Opponent3',
          result: '1/2-1/2',
          white_elo: 1800,
          black_elo: 1800
        }
      ];

      mockDatabase.all
        .mockResolvedValueOnce(mockGames) // First call for games
        .mockResolvedValueOnce([{ centipawn_loss: 20, move_number: 1 }]) // Analysis for game 1
        .mockResolvedValueOnce([{ centipawn_loss: 15, move_number: 2 }]) // Analysis for game 2
        .mockResolvedValueOnce([{ centipawn_loss: 10, move_number: 1 }]); // Analysis for game 3

      mockDatabase.get
        .mockResolvedValueOnce({ count: 1 }) // Blunders for game 1
        .mockResolvedValueOnce({ count: 0 }) // Blunders for game 2
        .mockResolvedValueOnce({ count: 2 }); // Blunders for game 3

      await tournamentController.getPlayerPerformance(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        totalGames: 3,
        wins: 2,
        losses: 0,
        draws: 1,
        winRate: expect.any(Number),
        avgAccuracy: expect.any(Number),
        totalBlunders: 3
      }));
    });

    it('should handle errors gracefully', async () => {
      mockReq.params.id = '1';
      mockDatabase.all.mockRejectedValue(new Error('Database error'));

      await tournamentController.getPlayerPerformance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to get player tournament performance' });
    });
  });

  describe('getGames()', () => {
    it('should return games with analysis data', async () => {
      mockReq.params.id = '1';

      const mockGames = [
        {
          id: 1,
          white_player: 'AdvaitKumar1213',
          black_player: 'Opponent1',
          result: '1-0',
          date: '2025-01-01',
          white_elo: 1800,
          black_elo: 1750,
          moves_count: 40,
          created_at: '2025-01-01T10:00:00Z',
          pgn_content: '[Event "Test"]\n[ECO "C50"]\n\n1. e4 e5'
        }
      ];

      mockDatabase.all
        .mockResolvedValueOnce(mockGames) // Games query
        .mockResolvedValueOnce([{ move_number: 1, centipawn_loss: 20 }]); // Analysis query

      mockDatabase.get
        .mockResolvedValueOnce({ name: 'Italian Game' }) // Opening query
        .mockResolvedValueOnce({ count: 1 }); // Blunder count query

      AccuracyCalculator.calculatePlayerAccuracy = jest.fn().mockReturnValue(85);

      await tournamentController.getGames(mockReq, mockRes);

      expect(mockDatabase.all).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          id: 1,
          opening: expect.any(String),
          accuracy: 85,
          blunders: 1,
          playerColor: 'white'
        })
      ]));
    });

    it('should return empty array on error', async () => {
      mockReq.params.id = '1';
      mockDatabase.all.mockRejectedValue(new Error('Database error'));

      await tournamentController.getGames(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should handle games without PGN content', async () => {
      mockReq.params.id = '1';

      const mockGames = [{
        id: 1,
        white_player: 'AdvaitKumar1213',
        black_player: 'Opponent1',
        result: '1-0',
        date: '2025-01-01',
        white_elo: 1800,
        black_elo: 1750,
        moves_count: 40,
        created_at: '2025-01-01T10:00:00Z',
        pgn_content: null
      }];

      mockDatabase.all
        .mockResolvedValueOnce(mockGames)
        .mockResolvedValueOnce([]);

      mockDatabase.get.mockResolvedValueOnce({ count: 0 });

      AccuracyCalculator.calculatePlayerAccuracy = jest.fn().mockReturnValue(0);

      await tournamentController.getGames(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          opening: 'Unknown Opening'
        })
      ]));
    });
  });
});
