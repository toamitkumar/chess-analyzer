/**
 * TacticalOpportunityService Unit Tests
 *
 * Tests for the tactical opportunities (found vs missed) service
 * Reference: ADR 009 Phase 5.1
 */

const TacticalOpportunityService = require('../../src/services/TacticalOpportunityService');

describe('TacticalOpportunityService', () => {
  let mockDatabase;
  let tacticsService;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn()
    };

    tacticsService = new TacticalOpportunityService(mockDatabase);
  });

  describe('recordOpportunity', () => {
    it('should insert a tactical opportunity record', async () => {
      mockDatabase.run.mockResolvedValue({ lastID: 1 });

      const opportunity = {
        moveNumber: 15,
        playerColor: 'white',
        tacticType: 'fork',
        attackingPiece: 'N',
        targetPieces: ['Q', 'R'],
        wasFound: true,
        bestMove: 'Nf7',
        playedMove: 'Nf7',
        evalGain: 400,
        fenPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      };

      const result = await tacticsService.recordOpportunity(123, opportunity);

      expect(result.id).toBe(1);
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tactical_opportunities'),
        expect.arrayContaining([123, 15, 'white', 'fork', 'N'])
      );
    });

    it('should handle null attacking piece', async () => {
      mockDatabase.run.mockResolvedValue({ lastID: 2 });

      const opportunity = {
        moveNumber: 10,
        playerColor: 'black',
        tacticType: 'pin',
        attackingPiece: null,
        targetPieces: null,
        wasFound: false,
        bestMove: 'Bb5',
        playedMove: 'Be2',
        evalGain: 200,
        fenPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      };

      await tacticsService.recordOpportunity(456, opportunity);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([456, 10, 'black', 'pin', null])
      );
    });
  });

  describe('getFoundVsMissed', () => {
    it('should return found vs missed summary grouped by tactic type', async () => {
      const mockResults = [
        { tactic_type: 'fork', total: 10, found: 7, missed: 3, avg_gain_when_found: 350, avg_missed_gain: 300 },
        { tactic_type: 'pin', total: 5, found: 3, missed: 2, avg_gain_when_found: 200, avg_missed_gain: 180 }
      ];
      mockDatabase.all.mockResolvedValue(mockResults);

      const result = await tacticsService.getFoundVsMissed('user123');

      expect(result.overall.total).toBe(15);
      expect(result.overall.found).toBe(10);
      expect(result.overall.missed).toBe(5);
      expect(result.overall.foundPercentage).toBe(67); // 10/15 = ~67%
      expect(result.byType).toHaveLength(2);
      expect(result.byType[0].tacticType).toBe('fork');
      expect(result.byType[0].foundPercentage).toBe(70); // 7/10 = 70%
    });

    it('should filter by tactic type when provided', async () => {
      mockDatabase.all.mockResolvedValue([
        { tactic_type: 'fork', total: 10, found: 7, missed: 3, avg_gain_when_found: 350, avg_missed_gain: 300 }
      ]);

      await tacticsService.getFoundVsMissed('user123', 'fork');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('AND t.tactic_type = ?'),
        ['user123', 'fork']
      );
    });

    it('should handle empty result set', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await tacticsService.getFoundVsMissed('user123');

      expect(result.overall.total).toBe(0);
      expect(result.overall.found).toBe(0);
      expect(result.overall.missed).toBe(0);
      expect(result.overall.foundPercentage).toBe(0);
      expect(result.byType).toHaveLength(0);
    });

    it('should include player color filter for user-specific data', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await tacticsService.getFoundVsMissed('user123');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringMatching(/g\.user_color.*t\.player_color|t\.player_color.*g\.user_color/),
        ['user123']
      );
    });
  });

  describe('getByAttackingPiece', () => {
    it('should return opportunities grouped by attacking piece', async () => {
      const mockResults = [
        { attacking_piece: 'N', total: 8, found: 6, missed: 2 },
        { attacking_piece: 'B', total: 5, found: 3, missed: 2 },
        { attacking_piece: 'Q', total: 3, found: 2, missed: 1 }
      ];
      mockDatabase.all.mockResolvedValue(mockResults);

      const result = await tacticsService.getByAttackingPiece('user123');

      expect(result).toHaveLength(3);
      expect(result[0].pieceType).toBe('N');
      expect(result[0].pieceName).toBe('Knight');
      expect(result[0].total).toBe(8);
      expect(result[0].foundPercentage).toBe(75); // 6/8 = 75%
    });

    it('should filter by tactic type when provided', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await tacticsService.getByAttackingPiece('user123', 'fork');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('AND t.tactic_type = ?'),
        ['user123', 'fork']
      );
    });

    it('should map all piece types to full names', async () => {
      const mockResults = [
        { attacking_piece: 'P', total: 2, found: 1, missed: 1 },
        { attacking_piece: 'N', total: 2, found: 1, missed: 1 },
        { attacking_piece: 'B', total: 2, found: 1, missed: 1 },
        { attacking_piece: 'R', total: 2, found: 1, missed: 1 },
        { attacking_piece: 'Q', total: 2, found: 1, missed: 1 },
        { attacking_piece: 'K', total: 2, found: 1, missed: 1 }
      ];
      mockDatabase.all.mockResolvedValue(mockResults);

      const result = await tacticsService.getByAttackingPiece('user123');

      const pieceNames = result.map(r => r.pieceName);
      expect(pieceNames).toContain('Pawn');
      expect(pieceNames).toContain('Knight');
      expect(pieceNames).toContain('Bishop');
      expect(pieceNames).toContain('Rook');
      expect(pieceNames).toContain('Queen');
      expect(pieceNames).toContain('King');
    });
  });

  describe('getForkOpportunities', () => {
    it('should call getFoundVsMissed with fork type', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await tacticsService.getForkOpportunities('user123');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining("AND t.tactic_type = ?"),
        expect.arrayContaining(['user123', 'fork'])
      );
    });
  });

  describe('getPinOpportunities', () => {
    it('should call getFoundVsMissed with pin type', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await tacticsService.getPinOpportunities('user123');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining("AND t.tactic_type = ?"),
        expect.arrayContaining(['user123', 'pin'])
      );
    });
  });

  describe('getRecentMissed', () => {
    it('should return recent missed opportunities', async () => {
      const mockResults = [
        {
          id: 1,
          game_id: 100,
          move_number: 25,
          tactic_type: 'fork',
          attacking_piece: 'N',
          target_pieces: '["Q","R"]',
          best_move: 'Nf7',
          played_move: 'Nc4',
          eval_gain: 400,
          fen_position: 'fen...',
          white_player: 'Me',
          black_player: 'Opponent',
          date: '2024-01-01',
          event: 'Test Game',
          player_color: 'white'
        }
      ];
      mockDatabase.all.mockResolvedValue(mockResults);

      const result = await tacticsService.getRecentMissed('user123', 10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].tacticType).toBe('fork');
      expect(result[0].targetPieces).toEqual(['Q', 'R']);
      expect(result[0].opponent).toBe('Opponent');
    });

    it('should use default limit of 10', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await tacticsService.getRecentMissed('user123');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.any(String),
        ['user123', 10]
      );
    });

    it('should filter for missed opportunities only', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await tacticsService.getRecentMissed('user123');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('t.was_found = 0'),
        expect.any(Array)
      );
    });
  });

  describe('getDashboardSummary', () => {
    it('should return comprehensive tactical summary', async () => {
      // Mock getFoundVsMissed response
      mockDatabase.all
        .mockResolvedValueOnce([
          { tactic_type: 'fork', total: 10, found: 7, missed: 3, avg_gain_when_found: 350, avg_missed_gain: 300 },
          { tactic_type: 'pin', total: 5, found: 3, missed: 2, avg_gain_when_found: 200, avg_missed_gain: 180 }
        ])
        // Mock getByAttackingPiece response
        .mockResolvedValueOnce([
          { attacking_piece: 'N', total: 8, found: 6, missed: 2 }
        ])
        // Mock getRecentMissed response
        .mockResolvedValueOnce([]);

      const result = await tacticsService.getDashboardSummary('user123');

      expect(result.overall).toBeDefined();
      expect(result.overall.total).toBe(15);
      expect(result.byType).toBeDefined();
      expect(result.byType.forks).toBeDefined();
      expect(result.byAttackingPiece).toBeDefined();
      expect(result.recentMissed).toBeDefined();
    });

    it('should handle missing tactic types gracefully', async () => {
      // Only forks returned
      mockDatabase.all
        .mockResolvedValueOnce([
          { tactic_type: 'fork', total: 10, found: 7, missed: 3, avg_gain_when_found: 350, avg_missed_gain: 300 }
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await tacticsService.getDashboardSummary('user123');

      // Pins should have default values
      expect(result.byType.pins.total).toBe(0);
      expect(result.byType.pins.found).toBe(0);
      expect(result.byType.skewers.total).toBe(0);
      expect(result.byType.discoveredAttacks.total).toBe(0);
    });
  });

  describe('Player Color Filter Consistency', () => {
    it('should always filter by player_color to only return user tactics', async () => {
      mockDatabase.all.mockResolvedValue([]);

      // Test all query methods
      await tacticsService.getFoundVsMissed('user123');
      await tacticsService.getByAttackingPiece('user123');
      await tacticsService.getRecentMissed('user123');

      // Verify all calls include player_color filter
      const allCalls = mockDatabase.all.mock.calls;
      allCalls.forEach(call => {
        const query = call[0];
        expect(query).toMatch(/g\.user_color.*t\.player_color|t\.player_color.*g\.user_color/);
      });
    });
  });
});
