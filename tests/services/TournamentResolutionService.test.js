const TournamentResolutionService = require('../../src/services/TournamentResolutionService');

describe('TournamentResolutionService', () => {
  let service;
  let mockTournamentManager;

  beforeEach(() => {
    // Create mock tournament manager
    mockTournamentManager = {
      getTournamentById: jest.fn(),
      processPGNForTournament: jest.fn(),
      updateTournamentGameCount: jest.fn()
    };

    // Create service with mock
    service = new TournamentResolutionService(mockTournamentManager);
  });

  describe('resolveTournament', () => {
    const samplePGN = '[Event "Test Tournament"]\n[White "Player1"]\n[Black "Player2"]\n\n1. e4 e5';
    const userId = 'user123';

    it('should use assigned tournament when tournamentId is provided', async () => {
      const mockTournament = {
        id: 1,
        name: 'Assigned Tournament',
        event_type: 'Classical',
        location: 'Test City'
      };

      mockTournamentManager.getTournamentById.mockResolvedValue(mockTournament);

      const result = await service.resolveTournament(samplePGN, 1, userId);

      expect(result.tournament).toEqual(mockTournament);
      expect(result.wasAssigned).toBe(true);
      expect(mockTournamentManager.getTournamentById).toHaveBeenCalledWith(1);
      expect(mockTournamentManager.processPGNForTournament).not.toHaveBeenCalled();
    });

    it('should throw error when assigned tournament is not found', async () => {
      mockTournamentManager.getTournamentById.mockResolvedValue(null);

      await expect(
        service.resolveTournament(samplePGN, 999, userId)
      ).rejects.toThrow('Assigned tournament not found');
    });

    it('should auto-detect tournament when no tournamentId is provided', async () => {
      const mockTournament = {
        id: 2,
        name: 'Auto-detected Tournament',
        event_type: 'Blitz',
        location: 'Online'
      };

      mockTournamentManager.processPGNForTournament.mockResolvedValue({
        tournament: mockTournament
      });

      const result = await service.resolveTournament(samplePGN, null, userId);

      expect(result.tournament).toEqual(mockTournament);
      expect(result.wasAssigned).toBe(false);
      expect(mockTournamentManager.processPGNForTournament).toHaveBeenCalledWith(samplePGN, userId);
      expect(mockTournamentManager.getTournamentById).not.toHaveBeenCalled();
    });

    it('should log assigned tournament info', async () => {
      const mockTournament = {
        id: 1,
        name: 'Test Tournament',
        event_type: 'Rapid'
      };

      mockTournamentManager.getTournamentById.mockResolvedValue(mockTournament);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.resolveTournament(samplePGN, 1, userId);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using assigned tournament: Test Tournament (ID: 1)')
      );

      consoleLogSpy.mockRestore();
    });

    it('should log auto-detected tournament info', async () => {
      const mockTournament = {
        id: 2,
        name: 'Auto Tournament',
        event_type: 'Blitz'
      };

      mockTournamentManager.processPGNForTournament.mockResolvedValue({
        tournament: mockTournament
      });
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.resolveTournament(samplePGN, null, userId);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-detected tournament: Auto Tournament (ID: 2)')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('getTournamentById', () => {
    it('should return tournament when found', async () => {
      const mockTournament = {
        id: 1,
        name: 'Test Tournament'
      };

      mockTournamentManager.getTournamentById.mockResolvedValue(mockTournament);

      const result = await service.getTournamentById(1);

      expect(result).toEqual(mockTournament);
      expect(mockTournamentManager.getTournamentById).toHaveBeenCalledWith(1);
    });

    it('should return null when tournament not found', async () => {
      mockTournamentManager.getTournamentById.mockResolvedValue(null);

      const result = await service.getTournamentById(999);

      expect(result).toBeNull();
    });
  });

  describe('updateTournamentGameCount', () => {
    it('should call tournament manager updateTournamentGameCount', async () => {
      mockTournamentManager.updateTournamentGameCount.mockResolvedValue();

      await service.updateTournamentGameCount(1);

      expect(mockTournamentManager.updateTournamentGameCount).toHaveBeenCalledWith(1);
    });

    it('should handle update errors', async () => {
      mockTournamentManager.updateTournamentGameCount.mockRejectedValue(
        new Error('Update failed')
      );

      await expect(
        service.updateTournamentGameCount(1)
      ).rejects.toThrow('Update failed');
    });
  });
});
