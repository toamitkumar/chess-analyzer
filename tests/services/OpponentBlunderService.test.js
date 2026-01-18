/**
 * OpponentBlunderService Unit Tests
 *
 * Tests for the free pieces (opponent blunders) service
 * Reference: ADR 009 Phase 5.3
 */

const OpponentBlunderService = require('../../src/services/OpponentBlunderService');

describe('OpponentBlunderService', () => {
  let mockDatabase;
  let blunderService;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn()
    };

    blunderService = new OpponentBlunderService(mockDatabase);
  });

  describe('recordOpponentBlunder', () => {
    it('should insert an opponent blunder record', async () => {
      mockDatabase.run.mockResolvedValue({ lastID: 1 });

      const blunder = {
        moveNumber: 15,
        playerColor: 'white',
        opponentPiece: 'N',
        wasCaptured: true,
        captureMove: 'Bxf3',
        playedMove: 'Bxf3',
        fenPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      };

      const result = await blunderService.recordOpponentBlunder(123, blunder);

      expect(result.id).toBe(1);
      expect(result.pieceValue).toBe(3); // Knight = 3
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO opponent_blunders'),
        expect.arrayContaining([123, 15, 'white', 'N'])
      );
    });

    it('should assign correct piece values', async () => {
      mockDatabase.run.mockResolvedValue({ lastID: 1 });

      const pieceTests = [
        { piece: 'P', expectedValue: 1 },
        { piece: 'N', expectedValue: 3 },
        { piece: 'B', expectedValue: 3 },
        { piece: 'R', expectedValue: 5 },
        { piece: 'Q', expectedValue: 9 }
      ];

      for (const test of pieceTests) {
        const blunder = {
          moveNumber: 10,
          playerColor: 'black',
          opponentPiece: test.piece,
          wasCaptured: false,
          captureMove: 'Nxe4',
          playedMove: 'Nf3',
          fenPosition: 'fen...'
        };

        const result = await blunderService.recordOpponentBlunder(456, blunder);
        expect(result.pieceValue).toBe(test.expectedValue);
      }
    });

    it('should handle null opponent piece', async () => {
      mockDatabase.run.mockResolvedValue({ lastID: 2 });

      const blunder = {
        moveNumber: 10,
        playerColor: 'black',
        opponentPiece: null,
        wasCaptured: false,
        captureMove: null,
        playedMove: 'Nf3',
        fenPosition: 'fen...'
      };

      const result = await blunderService.recordOpponentBlunder(456, blunder);

      expect(result.pieceValue).toBe(0);
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([456, 10, 'black', null])
      );
    });

    it('should convert wasCaptured boolean to integer', async () => {
      mockDatabase.run.mockResolvedValue({ lastID: 3 });

      const blunder = {
        moveNumber: 5,
        playerColor: 'white',
        opponentPiece: 'R',
        wasCaptured: true,
        captureMove: 'Rxd8',
        playedMove: 'Rxd8',
        fenPosition: 'fen...'
      };

      await blunderService.recordOpponentBlunder(789, blunder);

      const callArgs = mockDatabase.run.mock.calls[0][1];
      // wasCaptured should be converted to 1
      expect(callArgs).toContain(1);
    });
  });

  describe('getFreePiecesStats', () => {
    it('should return free pieces statistics', async () => {
      mockDatabase.get.mockResolvedValue({
        total: 20,
        captured: 15,
        missed: 5,
        material_captured: 25,
        material_missed: 8
      });

      const result = await blunderService.getFreePiecesStats('user123');

      expect(result.total).toBe(20);
      expect(result.captured).toBe(15);
      expect(result.missed).toBe(5);
      expect(result.capturedPercentage).toBe(75); // 15/20 = 75%
      expect(result.missedPercentage).toBe(25); // 5/20 = 25%
      expect(result.materialCaptured).toBe(25);
      expect(result.materialMissed).toBe(8);
    });

    it('should handle empty result set', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const result = await blunderService.getFreePiecesStats('user123');

      expect(result.total).toBe(0);
      expect(result.captured).toBe(0);
      expect(result.missed).toBe(0);
      expect(result.capturedPercentage).toBe(0);
      expect(result.missedPercentage).toBe(0);
    });

    it('should avoid division by zero when total is 0', async () => {
      mockDatabase.get.mockResolvedValue({
        total: 0,
        captured: 0,
        missed: 0,
        material_captured: 0,
        material_missed: 0
      });

      const result = await blunderService.getFreePiecesStats('user123');

      expect(result.capturedPercentage).toBe(0);
      expect(result.missedPercentage).toBe(0);
    });

    it('should include player color filter for user-specific data', async () => {
      mockDatabase.get.mockResolvedValue({ total: 0 });

      await blunderService.getFreePiecesStats('user123');

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringMatching(/g\.user_color.*ob\.player_color|ob\.player_color.*g\.user_color/),
        ['user123']
      );
    });
  });

  describe('getByPieceType', () => {
    it('should return free pieces grouped by opponent piece type', async () => {
      const mockResults = [
        { opponent_piece: 'Q', total: 5, captured: 4, missed: 1, material_captured: 36, material_missed: 9 },
        { opponent_piece: 'R', total: 8, captured: 6, missed: 2, material_captured: 30, material_missed: 10 },
        { opponent_piece: 'N', total: 10, captured: 7, missed: 3, material_captured: 21, material_missed: 9 }
      ];
      mockDatabase.all.mockResolvedValue(mockResults);

      const result = await blunderService.getByPieceType('user123');

      expect(result).toHaveLength(3);
      expect(result[0].pieceType).toBe('Q');
      expect(result[0].pieceName).toBe('Queen');
      expect(result[0].pieceValue).toBe(9);
      expect(result[0].total).toBe(5);
      expect(result[0].capturedPercentage).toBe(80); // 4/5 = 80%
    });

    it('should handle all piece types with correct names and values', async () => {
      const mockResults = [
        { opponent_piece: 'P', total: 2, captured: 1, missed: 1, material_captured: 1, material_missed: 1 },
        { opponent_piece: 'N', total: 2, captured: 1, missed: 1, material_captured: 3, material_missed: 3 },
        { opponent_piece: 'B', total: 2, captured: 1, missed: 1, material_captured: 3, material_missed: 3 },
        { opponent_piece: 'R', total: 2, captured: 1, missed: 1, material_captured: 5, material_missed: 5 },
        { opponent_piece: 'Q', total: 2, captured: 1, missed: 1, material_captured: 9, material_missed: 9 }
      ];
      mockDatabase.all.mockResolvedValue(mockResults);

      const result = await blunderService.getByPieceType('user123');

      const pieceMap = result.reduce((acc, p) => {
        acc[p.pieceType] = p;
        return acc;
      }, {});

      expect(pieceMap['P'].pieceName).toBe('Pawn');
      expect(pieceMap['P'].pieceValue).toBe(1);
      expect(pieceMap['N'].pieceName).toBe('Knight');
      expect(pieceMap['N'].pieceValue).toBe(3);
      expect(pieceMap['B'].pieceName).toBe('Bishop');
      expect(pieceMap['B'].pieceValue).toBe(3);
      expect(pieceMap['R'].pieceName).toBe('Rook');
      expect(pieceMap['R'].pieceValue).toBe(5);
      expect(pieceMap['Q'].pieceName).toBe('Queen');
      expect(pieceMap['Q'].pieceValue).toBe(9);
    });

    it('should handle empty results', async () => {
      mockDatabase.all.mockResolvedValue([]);

      const result = await blunderService.getByPieceType('user123');

      expect(result).toHaveLength(0);
    });

    it('should avoid division by zero for piece with 0 total', async () => {
      const mockResults = [
        { opponent_piece: 'Q', total: 0, captured: 0, missed: 0, material_captured: 0, material_missed: 0 }
      ];
      mockDatabase.all.mockResolvedValue(mockResults);

      const result = await blunderService.getByPieceType('user123');

      expect(result[0].capturedPercentage).toBe(0);
    });
  });

  describe('getMissedMaterial', () => {
    it('should return missed material statistics', async () => {
      mockDatabase.get.mockResolvedValue({
        total_missed: 45,
        missed_count: 12,
        avg_missed_value: 3.75
      });

      const result = await blunderService.getMissedMaterial('user123');

      expect(result.totalMissed).toBe(45);
      expect(result.missedCount).toBe(12);
      expect(result.avgMissedValue).toBe(3.8); // Rounded to 1 decimal
    });

    it('should handle null result', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const result = await blunderService.getMissedMaterial('user123');

      expect(result.totalMissed).toBe(0);
      expect(result.missedCount).toBe(0);
      expect(result.avgMissedValue).toBe(0);
    });

    it('should filter for missed captures only', async () => {
      mockDatabase.get.mockResolvedValue({ total_missed: 0, missed_count: 0 });

      await blunderService.getMissedMaterial('user123');

      expect(mockDatabase.get).toHaveBeenCalledWith(
        expect.stringContaining('ob.was_captured = 0'),
        expect.any(Array)
      );
    });
  });

  describe('getRecentMissed', () => {
    it('should return recent missed free pieces', async () => {
      const mockResults = [
        {
          id: 1,
          game_id: 100,
          move_number: 25,
          opponent_piece: 'R',
          piece_value: 5,
          capture_move: 'Bxe8',
          played_move: 'Be4',
          fen_position: 'fen...',
          white_player: 'Me',
          black_player: 'Opponent',
          date: '2024-01-01',
          event: 'Test Game',
          player_color: 'white'
        }
      ];
      mockDatabase.all.mockResolvedValue(mockResults);

      const result = await blunderService.getRecentMissed('user123', 10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].gameId).toBe(100);
      expect(result[0].opponentPiece).toBe('R');
      expect(result[0].pieceName).toBe('Rook');
      expect(result[0].pieceValue).toBe(5);
      expect(result[0].opponent).toBe('Opponent'); // White player's opponent is black
    });

    it('should determine opponent correctly based on player color', async () => {
      const mockResults = [
        {
          id: 1,
          game_id: 100,
          move_number: 25,
          opponent_piece: 'Q',
          piece_value: 9,
          capture_move: 'Nxd8',
          played_move: 'Ne5',
          fen_position: 'fen...',
          white_player: 'WhitePlayer',
          black_player: 'BlackPlayer',
          date: '2024-01-01',
          event: 'Test Game',
          player_color: 'black'
        }
      ];
      mockDatabase.all.mockResolvedValue(mockResults);

      const result = await blunderService.getRecentMissed('user123');

      // Black player's opponent is white
      expect(result[0].opponent).toBe('WhitePlayer');
    });

    it('should use default limit of 10', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await blunderService.getRecentMissed('user123');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.any(String),
        ['user123', 10]
      );
    });

    it('should respect custom limit', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await blunderService.getRecentMissed('user123', 5);

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.any(String),
        ['user123', 5]
      );
    });

    it('should filter for missed captures only', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await blunderService.getRecentMissed('user123');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('ob.was_captured = 0'),
        expect.any(Array)
      );
    });
  });

  describe('getDashboardSummary', () => {
    it('should return comprehensive free pieces summary', async () => {
      // Mock getFreePiecesStats response
      mockDatabase.get
        .mockResolvedValueOnce({
          total: 20,
          captured: 15,
          missed: 5,
          material_captured: 30,
          material_missed: 12
        })
        // Mock getMissedMaterial response
        .mockResolvedValueOnce({
          total_missed: 12,
          missed_count: 5,
          avg_missed_value: 2.4
        });

      // Mock getByPieceType response
      mockDatabase.all
        .mockResolvedValueOnce([
          { opponent_piece: 'N', total: 10, captured: 7, missed: 3, material_captured: 21, material_missed: 9 },
          { opponent_piece: 'B', total: 5, captured: 4, missed: 1, material_captured: 12, material_missed: 3 }
        ])
        // Mock getRecentMissed response
        .mockResolvedValueOnce([
          {
            id: 1,
            game_id: 100,
            move_number: 15,
            opponent_piece: 'N',
            piece_value: 3,
            capture_move: 'Bxf6',
            played_move: 'Be3',
            fen_position: 'fen...',
            white_player: 'Me',
            black_player: 'Opponent',
            date: '2024-01-01',
            event: 'Game 1',
            player_color: 'white'
          }
        ]);

      const result = await blunderService.getDashboardSummary('user123');

      expect(result.overall).toBeDefined();
      expect(result.overall.total).toBe(20);
      expect(result.overall.captured).toBe(15);
      expect(result.overall.capturedPercentage).toBe(75);

      expect(result.byPieceType).toBeDefined();
      expect(result.byPieceType).toHaveLength(2);

      expect(result.missedMaterial).toBeDefined();
      expect(result.missedMaterial.totalMissed).toBe(12);

      expect(result.mostMissedPiece).toBeDefined();
      expect(result.mostMissedPiece.pieceType).toBe('N'); // Knight has 3 missed vs Bishop has 1

      expect(result.recentMissed).toBeDefined();
      expect(result.recentMissed).toHaveLength(1);
    });

    it('should identify most missed piece correctly', async () => {
      mockDatabase.get
        .mockResolvedValueOnce({ total: 10, captured: 5, missed: 5, material_captured: 15, material_missed: 15 })
        .mockResolvedValueOnce({ total_missed: 15, missed_count: 5, avg_missed_value: 3 });

      mockDatabase.all
        .mockResolvedValueOnce([
          { opponent_piece: 'Q', total: 2, captured: 1, missed: 1, material_captured: 9, material_missed: 9 },
          { opponent_piece: 'R', total: 5, captured: 2, missed: 3, material_captured: 10, material_missed: 15 }, // Most missed
          { opponent_piece: 'P', total: 3, captured: 2, missed: 1, material_captured: 2, material_missed: 1 }
        ])
        .mockResolvedValueOnce([]);

      const result = await blunderService.getDashboardSummary('user123');

      expect(result.mostMissedPiece.pieceType).toBe('R');
      expect(result.mostMissedPiece.missed).toBe(3);
    });

    it('should handle empty byPieceType gracefully', async () => {
      mockDatabase.get
        .mockResolvedValueOnce({ total: 0, captured: 0, missed: 0, material_captured: 0, material_missed: 0 })
        .mockResolvedValueOnce({ total_missed: 0, missed_count: 0, avg_missed_value: 0 });

      mockDatabase.all
        .mockResolvedValueOnce([]) // Empty byPieceType
        .mockResolvedValueOnce([]);

      const result = await blunderService.getDashboardSummary('user123');

      expect(result.mostMissedPiece).toBeNull();
      expect(result.byPieceType).toHaveLength(0);
    });
  });

  describe('Player Color Filter Consistency', () => {
    it('should always filter by player_color to only return user free pieces', async () => {
      mockDatabase.get.mockResolvedValue({ total: 0 });
      mockDatabase.all.mockResolvedValue([]);

      // Test all query methods
      await blunderService.getFreePiecesStats('user123');
      await blunderService.getByPieceType('user123');
      await blunderService.getMissedMaterial('user123');
      await blunderService.getRecentMissed('user123');

      // Verify all get calls include player_color filter
      const allGetCalls = mockDatabase.get.mock.calls;
      allGetCalls.forEach(call => {
        const query = call[0];
        expect(query).toMatch(/g\.user_color.*ob\.player_color|ob\.player_color.*g\.user_color/);
      });

      // Verify all "all" calls include player_color filter
      const allAllCalls = mockDatabase.all.mock.calls;
      allAllCalls.forEach(call => {
        const query = call[0];
        expect(query).toMatch(/g\.user_color.*ob\.player_color|ob\.player_color.*g\.user_color/);
      });
    });
  });
});
