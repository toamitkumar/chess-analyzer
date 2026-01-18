/**
 * BlunderService Unit Tests
 *
 * Tests the centralized blunder business logic service
 */

const BlunderService = require('../../src/services/BlunderService');

describe('BlunderService', () => {
  let mockDatabase;
  let blunderService;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn()
    };

    blunderService = new BlunderService(mockDatabase);
  });

  describe('getBlunderCountForGame', () => {
    it('should return blunder count for a game', async () => {
      mockDatabase.get.mockResolvedValue({ count: 5 });

      const count = await blunderService.getBlunderCountForGame(1, 'white');

      expect(count).toBe(5);
      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as count'),
        expect.arrayContaining([1, 'white'])
      );
    });

    it('should filter by phase when provided', async () => {
      mockDatabase.get.mockResolvedValue({ count: 2 });

      const count = await blunderService.getBlunderCountForGame(1, 'white', { phase: 'opening' });

      expect(count).toBe(2);
      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.phase = ?'),
        expect.arrayContaining([1, 'white', 'opening'])
      );
    });

    it('should filter by tactical theme when provided', async () => {
      mockDatabase.get.mockResolvedValue({ count: 3 });

      const count = await blunderService.getBlunderCountForGame(1, 'black', { theme: 'fork' });

      expect(count).toBe(3);
      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.tactical_theme = ?'),
        expect.arrayContaining([1, 'black', 'fork'])
      );
    });

    it('should return 0 when count is null', async () => {
      mockDatabase.get.mockResolvedValue({ count: null });

      const count = await blunderService.getBlunderCountForGame(1, 'white');

      expect(count).toBe(0);
    });

    it('should include player_color filter to exclude opponent blunders', async () => {
      mockDatabase.get.mockResolvedValue({ count: 4 });

      await blunderService.getBlunderCountForGame(123, 'white');

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.player_color = ?'),
        [123, 'white']
      );
    });
  });

  describe('getBlundersForUser', () => {
    it('should return all blunders for a user', async () => {
      const mockBlunders = [
        { id: 1, game_id: 1, centipawn_loss: 150 },
        { id: 2, game_id: 2, centipawn_loss: 200 }
      ];
      mockDatabase.all.mockResolvedValue(mockBlunders);

      const blunders = await blunderService.getBlundersForUser('user123');

      expect(blunders).toEqual(mockBlunders);
      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE g.user_id = ? AND bd.player_color = g.user_color'),
        ['user123']
      );
    });

    it('should filter by phase', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await blunderService.getBlundersForUser('user123', { phase: 'middlegame' });

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.phase = ?'),
        expect.arrayContaining(['user123', 'middlegame'])
      );
    });

    it('should filter by learned status', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await blunderService.getBlundersForUser('user123', { learned: true });

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.learned = ?'),
        expect.arrayContaining(['user123', 1])
      );
    });

    it('should filter by difficulty range', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await blunderService.getBlundersForUser('user123', {
        minDifficulty: 3,
        maxDifficulty: 8
      });

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.difficulty_level >= ?'),
        expect.arrayContaining(['user123', 3, 8])
      );
    });
  });

  describe('getBlundersByPhase', () => {
    it('should return blunders for specific phase', async () => {
      const mockBlunders = [{ id: 1, phase: 'endgame' }];
      mockDatabase.all.mockResolvedValue(mockBlunders);

      const blunders = await blunderService.getBlundersByPhase('user123', 'endgame');

      expect(blunders).toEqual(mockBlunders);
      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.phase = ?'),
        ['user123', 'endgame']
      );
    });
  });

  describe('getBlunderStats', () => {
    it('should calculate comprehensive blunder statistics', async () => {
      const mockBlunders = [
        {
          centipawn_loss: 150,
          phase: 'opening',
          blunder_severity: 'minor',
          tactical_theme: 'fork',
          learned: 0,
          mastery_score: 0.3
        },
        {
          centipawn_loss: 250,
          phase: 'middlegame',
          blunder_severity: 'major',
          tactical_theme: 'fork',
          learned: 1,
          mastery_score: 0.8
        },
        {
          centipawn_loss: 200,
          phase: 'opening',
          blunder_severity: 'moderate',
          tactical_theme: 'pin',
          learned: 0,
          mastery_score: 0
        }
      ];
      mockDatabase.all.mockResolvedValue(mockBlunders);

      const stats = await blunderService.getBlunderStats('user123');

      expect(stats.total).toBe(3);
      expect(stats.avgCentipawnLoss).toBe(200); // (150+250+200)/3
      expect(stats.byPhase.opening).toBe(2);
      expect(stats.byPhase.middlegame).toBe(1);
      expect(stats.bySeverity.minor).toBe(1);
      expect(stats.bySeverity.major).toBe(1);
      expect(stats.byTheme.fork).toBe(2);
      expect(stats.byTheme.pin).toBe(1);
      expect(stats.learning.learned).toBe(1);
      expect(stats.learning.unlearned).toBe(2);
    });

    it('should handle empty blunder list', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const stats = await blunderService.getBlunderStats('user123');

      expect(stats.total).toBe(0);
      expect(stats.avgCentipawnLoss).toBe(0);
      expect(stats.learning.avgMastery).toBe(0);
    });
  });

  describe('markAsReviewed', () => {
    it('should increment review count', async () => {
      const mockBlunder = { id: 1, game_id: 1 };
      mockDatabase.get
        .mockResolvedValueOnce(mockBlunder) // First call: verify ownership
        .mockResolvedValueOnce({ ...mockBlunder, review_count: 1 }); // Second call: get updated

      const result = await blunderService.markAsReviewed(1, 'user123');

      expect(result.review_count).toBe(1);
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE blunder_details'),
        [1]
      );
    });

    it('should throw error if blunder not found or access denied', async () => {
      mockDatabase.get.mockResolvedValue(null);

      await expect(
        blunderService.markAsReviewed(999, 'user123')
      ).rejects.toThrow('Blunder not found or access denied');
    });
  });

  describe('markAsLearned', () => {
    it('should mark blunder as learned with mastery score', async () => {
      const mockBlunder = { id: 1, game_id: 1 };
      mockDatabase.get
        .mockResolvedValueOnce(mockBlunder)
        .mockResolvedValueOnce({ ...mockBlunder, learned: 1, mastery_score: 0.8 });

      const result = await blunderService.markAsLearned(1, 'user123', 0.8, 'Practiced fork defense');

      expect(result.learned).toBe(1);
      expect(result.mastery_score).toBe(0.8);
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('SET learned = 1'),
        expect.arrayContaining([0.8, 'Practiced fork defense', 1])
      );
    });

    it('should throw error if blunder not found', async () => {
      mockDatabase.get.mockResolvedValue(null);

      await expect(
        blunderService.markAsLearned(999, 'user123', 0.5)
      ).rejects.toThrow('Blunder not found or access denied');
    });
  });

  describe('Player Color Filter Consistency', () => {
    it('should always filter by player_color to exclude opponent blunders', async () => {
      mockDatabase.all.mockResolvedValue([]);

      // Test all query methods
      await blunderService.getBlundersForUser('user123');
      await blunderService.getBlundersByPhase('user123', 'opening');
      await blunderService.getBlundersByTheme('user123', 'fork');
      await blunderService.getUnlearnedBlunders('user123');
      await blunderService.getBlunderStats('user123');
      await blunderService.getBlunderTimeline('user123');

      // Verify all calls include player_color filter
      const allCalls = mockDatabase.all.mock.calls;
      allCalls.forEach(call => {
        const query = call[0];
        expect(query).toMatch(/bd\.player_color = g\.user_color|AND bd\.player_color = \?/);
      });
    });
  });

  describe('getHangingPiecesByType (ADR 009 Phase 5.2)', () => {
    it('should return breakdown of blunders by piece type', async () => {
      const mockPieceBreakdown = [
        { piece_type: 'N', count: 5, avgLoss: 250 },
        { piece_type: 'P', count: 4, avgLoss: 150 },
        { piece_type: 'B', count: 3, avgLoss: 300 },
        { piece_type: 'R', count: 2, avgLoss: 450 },
        { piece_type: 'Q', count: 1, avgLoss: 800 }
      ];
      mockDatabase.all.mockResolvedValue(mockPieceBreakdown);

      const result = await blunderService.getHangingPiecesByType('user123');

      expect(result.total).toBe(15);
      expect(result.byPiece).toHaveLength(6); // All 6 piece types included
      expect(result.mostCommon.pieceType).toBe('N');
      expect(result.mostCommon.pieceName).toBe('Knight');
      expect(result.mostCommon.count).toBe(5);

      // Verify query includes player_color filter
      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('bd.player_color = g.user_color'),
        ['user123']
      );
    });

    it('should return all piece types even when some have zero count', async () => {
      const mockPieceBreakdown = [
        { piece_type: 'P', count: 3, avgLoss: 150 }
      ];
      mockDatabase.all.mockResolvedValue(mockPieceBreakdown);

      const result = await blunderService.getHangingPiecesByType('user123');

      expect(result.byPiece).toHaveLength(6);

      // Pawn should have count 3
      const pawn = result.byPiece.find(p => p.pieceType === 'P');
      expect(pawn.count).toBe(3);
      expect(pawn.pieceName).toBe('Pawn');

      // Other pieces should have count 0
      const knight = result.byPiece.find(p => p.pieceType === 'N');
      expect(knight.count).toBe(0);
      expect(knight.pieceName).toBe('Knight');
    });

    it('should handle empty result set', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await blunderService.getHangingPiecesByType('user123');

      expect(result.total).toBe(0);
      expect(result.byPiece).toHaveLength(6);
      expect(result.mostCommon).toBeNull();

      // All pieces should have 0 count
      result.byPiece.forEach(piece => {
        expect(piece.count).toBe(0);
        expect(piece.percentage).toBe(0);
      });
    });

    it('should calculate correct percentages', async () => {
      const mockPieceBreakdown = [
        { piece_type: 'N', count: 5, avgLoss: 250 },
        { piece_type: 'B', count: 5, avgLoss: 300 }
      ];
      mockDatabase.all.mockResolvedValue(mockPieceBreakdown);

      const result = await blunderService.getHangingPiecesByType('user123');

      expect(result.total).toBe(10);

      const knight = result.byPiece.find(p => p.pieceType === 'N');
      expect(knight.percentage).toBe(50);

      const bishop = result.byPiece.find(p => p.pieceType === 'B');
      expect(bishop.percentage).toBe(50);
    });

    it('should map piece types to full names correctly', async () => {
      const mockPieceBreakdown = [
        { piece_type: 'P', count: 1, avgLoss: 100 },
        { piece_type: 'N', count: 1, avgLoss: 300 },
        { piece_type: 'B', count: 1, avgLoss: 320 },
        { piece_type: 'R', count: 1, avgLoss: 500 },
        { piece_type: 'Q', count: 1, avgLoss: 900 },
        { piece_type: 'K', count: 1, avgLoss: 0 }
      ];
      mockDatabase.all.mockResolvedValue(mockPieceBreakdown);

      const result = await blunderService.getHangingPiecesByType('user123');

      const pieceNames = result.byPiece.reduce((acc, p) => {
        acc[p.pieceType] = p.pieceName;
        return acc;
      }, {});

      expect(pieceNames['P']).toBe('Pawn');
      expect(pieceNames['N']).toBe('Knight');
      expect(pieceNames['B']).toBe('Bishop');
      expect(pieceNames['R']).toBe('Rook');
      expect(pieceNames['Q']).toBe('Queen');
      expect(pieceNames['K']).toBe('King');
    });

    it('should round average centipawn loss', async () => {
      const mockPieceBreakdown = [
        { piece_type: 'N', count: 3, avgLoss: 256.7 }
      ];
      mockDatabase.all.mockResolvedValue(mockPieceBreakdown);

      const result = await blunderService.getHangingPiecesByType('user123');

      const knight = result.byPiece.find(p => p.pieceType === 'N');
      expect(knight.avgCentipawnLoss).toBe(257);
    });

    it('should filter only blunders (not mistakes or inaccuracies)', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await blunderService.getHangingPiecesByType('user123');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('bd.is_blunder = TRUE'),
        ['user123']
      );
    });

    it('should only include records with non-null piece_type', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await blunderService.getHangingPiecesByType('user123');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('bd.piece_type IS NOT NULL'),
        ['user123']
      );
    });
  });
});
