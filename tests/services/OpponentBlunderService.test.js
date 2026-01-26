/**
 * Unit tests for OpponentBlunderService
 */

const OpponentBlunderService = require('../../src/services/OpponentBlunderService');

describe('OpponentBlunderService', () => {
  let service;
  let mockDb;
  let mockDatabase;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      run: jest.fn((sql, params, callback) => {
        if (callback) {
          callback.call({ lastID: 1 }, null);
        }
      }),
      all: jest.fn((sql, params, callback) => {
        callback(null, []);
      })
    };

    mockDatabase = {
      getDb: jest.fn(() => mockDb)
    };

    service = new OpponentBlunderService(mockDatabase);
  });

  describe('constructor', () => {
    it('should store database reference', () => {
      expect(service.database).toBe(mockDatabase);
    });
  });

  describe('recordOpponentBlunder', () => {
    it('should insert an opponent blunder record', async () => {
      const blunder = {
        moveNumber: 25,
        playerColor: 'white',
        opponentPiece: 'N',
        wasCaptured: true,
        captureMove: 'Bxe5',
        playedMove: 'Bxe5',
        fenPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      };

      const result = await service.recordOpponentBlunder(1, blunder);

      expect(mockDb.run).toHaveBeenCalled();
      const callArgs = mockDb.run.mock.calls[0];
      expect(callArgs[0]).toContain('INSERT INTO opponent_blunders');
      expect(callArgs[1]).toContain(1); // gameId
      expect(callArgs[1]).toContain(25); // moveNumber
      expect(callArgs[1]).toContain('white'); // playerColor
      expect(callArgs[1]).toContain('N'); // opponentPiece
      expect(result.moveNumber).toBe(25);
    });

    it('should convert wasCaptured boolean to integer', async () => {
      const blunder = {
        moveNumber: 10,
        playerColor: 'black',
        opponentPiece: 'Q',
        wasCaptured: false,
        captureMove: 'Nxd4',
        playedMove: 'O-O'
      };

      await service.recordOpponentBlunder(1, blunder);

      const callArgs = mockDb.run.mock.calls[0];
      // wasCaptured should be 0 (index 4 in params)
      expect(callArgs[1][4]).toBe(0);
    });

    it('should handle captured=true correctly', async () => {
      const blunder = {
        moveNumber: 15,
        playerColor: 'white',
        opponentPiece: 'R',
        wasCaptured: true,
        captureMove: 'Bxa8',
        playedMove: 'Bxa8'
      };

      await service.recordOpponentBlunder(1, blunder);

      const callArgs = mockDb.run.mock.calls[0];
      expect(callArgs[1][4]).toBe(1);
    });

    it('should reject on database error', async () => {
      mockDb.run = jest.fn((sql, params, callback) => {
        callback(new Error('Database error'));
      });

      const blunder = {
        moveNumber: 1,
        playerColor: 'white',
        opponentPiece: 'N',
        wasCaptured: true
      };

      await expect(service.recordOpponentBlunder(1, blunder)).rejects.toThrow('Database error');
    });
  });

  describe('getBlundersForGame', () => {
    it('should return blunders for a game', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, [
          {
            id: 1,
            game_id: 1,
            move_number: 20,
            player_color: 'white',
            opponent_piece: 'N',
            was_captured: 1,
            capture_move: 'Bxe5'
          }
        ]);
      });

      const result = await service.getBlundersForGame(1);

      expect(result).toHaveLength(1);
      expect(result[0].opponent_piece).toBe('N');
      expect(result[0].wasCaptured).toBe(true);
    });

    it('should convert was_captured to boolean', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, [
          { id: 1, was_captured: 0 },
          { id: 2, was_captured: 1 }
        ]);
      });

      const result = await service.getBlundersForGame(1);

      expect(result[0].wasCaptured).toBe(false);
      expect(result[1].wasCaptured).toBe(true);
    });

    it('should reject on database error', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(new Error('Query failed'));
      });

      await expect(service.getBlundersForGame(1)).rejects.toThrow('Query failed');
    });
  });

  describe('getFreePieceStats', () => {
    it('should aggregate free piece statistics by piece type', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, [
          { opponent_piece: 'N', total: 8, captured: 6, missed: 2 },
          { opponent_piece: 'B', total: 4, captured: 3, missed: 1 },
          { opponent_piece: 'P', total: 12, captured: 10, missed: 2 }
        ]);
      });

      const result = await service.getFreePieceStats('user1');

      expect(result.total).toBe(24);
      expect(result.captured).toBe(19);
      expect(result.missed).toBe(5);
      expect(result.captureRate).toBe(79);
      expect(result.byPiece.N.total).toBe(8);
      expect(result.byPiece.N.captureRate).toBe(75);
      expect(result.byPiece.B.total).toBe(4);
      expect(result.byPiece.P.total).toBe(12);
    });

    it('should handle empty results', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, []);
      });

      const result = await service.getFreePieceStats('user1');

      expect(result.total).toBe(0);
      expect(result.captured).toBe(0);
      expect(result.missed).toBe(0);
      expect(result.captureRate).toBe(0);
      expect(result.byPiece).toEqual({});
    });

    it('should calculate captureRate correctly', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, [
          { opponent_piece: 'Q', total: 2, captured: 2, missed: 0 }
        ]);
      });

      const result = await service.getFreePieceStats('user1');

      expect(result.byPiece.Q.captureRate).toBe(100);
      expect(result.captureRate).toBe(100);
    });

    it('should reject on database error', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(new Error('Stats query failed'));
      });

      await expect(service.getFreePieceStats('user1')).rejects.toThrow('Stats query failed');
    });
  });

  describe('getRecentMissedFreePieces', () => {
    it('should return recent missed free pieces', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, [
          {
            id: 1,
            game_id: 5,
            move_number: 30,
            opponent_piece: 'R',
            was_captured: 0,
            capture_move: 'Bxh8',
            white_player: 'Player1',
            black_player: 'Player2',
            date: '2024-01-15'
          }
        ]);
      });

      const result = await service.getRecentMissedFreePieces('user1', 10);

      expect(result).toHaveLength(1);
      expect(result[0].wasCaptured).toBe(false);
      expect(result[0].opponent_piece).toBe('R');
      expect(result[0].white_player).toBe('Player1');
    });

    it('should use provided limit', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, []);
      });

      await service.getRecentMissedFreePieces('user1', 5);

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[1]).toContain(5); // limit
    });

    it('should default to limit of 10', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, []);
      });

      await service.getRecentMissedFreePieces('user1');

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[1]).toContain(10); // default limit
    });

    it('should only return missed pieces (was_captured = 0)', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, []);
      });

      await service.getRecentMissedFreePieces('user1');

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[0]).toContain('was_captured = 0');
    });
  });
});
