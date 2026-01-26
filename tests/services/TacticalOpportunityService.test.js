/**
 * Unit tests for TacticalOpportunityService
 */

const TacticalOpportunityService = require('../../src/services/TacticalOpportunityService');

describe('TacticalOpportunityService', () => {
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

    service = new TacticalOpportunityService(mockDatabase);
  });

  describe('constructor', () => {
    it('should store database reference', () => {
      expect(service.database).toBe(mockDatabase);
    });
  });

  describe('recordOpportunity', () => {
    it('should insert a tactical opportunity record', async () => {
      const opportunity = {
        moveNumber: 15,
        playerColor: 'white',
        tacticType: 'fork',
        attackingPiece: 'N',
        targetPieces: ['Q', 'R'],
        wasFound: true,
        bestMove: 'Nf7+',
        playedMove: 'Nf7+',
        evalGain: 300,
        fenPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      };

      const result = await service.recordOpportunity(1, opportunity);

      expect(mockDb.run).toHaveBeenCalled();
      const callArgs = mockDb.run.mock.calls[0];
      expect(callArgs[0]).toContain('INSERT INTO tactical_opportunities');
      expect(callArgs[1]).toContain(1); // gameId
      expect(callArgs[1]).toContain(15); // moveNumber
      expect(callArgs[1]).toContain('white'); // playerColor
      expect(callArgs[1]).toContain('fork'); // tacticType
      expect(result.moveNumber).toBe(15);
    });

    it('should convert wasFound boolean to integer', async () => {
      const opportunity = {
        moveNumber: 10,
        playerColor: 'black',
        tacticType: 'pin',
        wasFound: false,
        bestMove: 'Bb5',
        playedMove: 'Nc3'
      };

      await service.recordOpportunity(1, opportunity);

      const callArgs = mockDb.run.mock.calls[0];
      // wasFound should be 0 (index 6 in params)
      expect(callArgs[1][6]).toBe(0);
    });

    it('should JSON stringify targetPieces', async () => {
      const opportunity = {
        moveNumber: 20,
        playerColor: 'white',
        tacticType: 'fork',
        targetPieces: ['K', 'Q'],
        wasFound: true,
        bestMove: 'Nf7+'
      };

      await service.recordOpportunity(1, opportunity);

      const callArgs = mockDb.run.mock.calls[0];
      expect(callArgs[1][5]).toBe('["K","Q"]');
    });

    it('should handle null targetPieces', async () => {
      const opportunity = {
        moveNumber: 5,
        playerColor: 'white',
        tacticType: 'tactical_sequence',
        targetPieces: null,
        wasFound: false,
        bestMove: 'Qxd7+'
      };

      await service.recordOpportunity(1, opportunity);

      const callArgs = mockDb.run.mock.calls[0];
      expect(callArgs[1][5]).toBe('[]');
    });

    it('should reject on database error', async () => {
      mockDb.run = jest.fn((sql, params, callback) => {
        callback(new Error('Database error'));
      });

      const opportunity = {
        moveNumber: 1,
        playerColor: 'white',
        tacticType: 'fork',
        wasFound: true
      };

      await expect(service.recordOpportunity(1, opportunity)).rejects.toThrow('Database error');
    });
  });

  describe('getOpportunitiesForGame', () => {
    it('should return opportunities for a game', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, [
          {
            id: 1,
            game_id: 1,
            move_number: 15,
            player_color: 'white',
            tactic_type: 'fork',
            target_pieces: '["Q","R"]',
            was_found: 1
          }
        ]);
      });

      const result = await service.getOpportunitiesForGame(1);

      expect(result).toHaveLength(1);
      expect(result[0].tactic_type).toBe('fork');
      expect(result[0].targetPieces).toEqual(['Q', 'R']);
      expect(result[0].wasFound).toBe(true);
    });

    it('should parse targetPieces from JSON', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, [
          { id: 1, target_pieces: '["K","Q","R"]', was_found: 0 }
        ]);
      });

      const result = await service.getOpportunitiesForGame(1);

      expect(result[0].targetPieces).toEqual(['K', 'Q', 'R']);
    });

    it('should handle null target_pieces', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, [
          { id: 1, target_pieces: null, was_found: 1 }
        ]);
      });

      const result = await service.getOpportunitiesForGame(1);

      expect(result[0].targetPieces).toEqual([]);
    });

    it('should reject on database error', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(new Error('Query failed'));
      });

      await expect(service.getOpportunitiesForGame(1)).rejects.toThrow('Query failed');
    });
  });

  describe('getTacticStats', () => {
    it('should aggregate tactic statistics by type', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, [
          { tactic_type: 'fork', total: 10, found: 7, missed: 3 },
          { tactic_type: 'pin', total: 5, found: 3, missed: 2 }
        ]);
      });

      const result = await service.getTacticStats('user1');

      expect(result.total).toBe(15);
      expect(result.found).toBe(10);
      expect(result.missed).toBe(5);
      expect(result.findRate).toBe(67);
      expect(result.byType.fork.total).toBe(10);
      expect(result.byType.fork.findRate).toBe(70);
      expect(result.byType.pin.total).toBe(5);
    });

    it('should handle empty results', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, []);
      });

      const result = await service.getTacticStats('user1');

      expect(result.total).toBe(0);
      expect(result.found).toBe(0);
      expect(result.missed).toBe(0);
      expect(result.findRate).toBe(0);
      expect(result.byType).toEqual({});
    });

    it('should reject on database error', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(new Error('Stats query failed'));
      });

      await expect(service.getTacticStats('user1')).rejects.toThrow('Stats query failed');
    });
  });

  describe('getRecentMissedTactics', () => {
    it('should return recent missed tactics', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, [
          {
            id: 1,
            game_id: 5,
            move_number: 20,
            tactic_type: 'fork',
            target_pieces: '["Q","R"]',
            was_found: 0,
            white_player: 'Player1',
            black_player: 'Player2',
            date: '2024-01-15'
          }
        ]);
      });

      const result = await service.getRecentMissedTactics('user1', 10);

      expect(result).toHaveLength(1);
      expect(result[0].wasFound).toBe(false);
      expect(result[0].white_player).toBe('Player1');
    });

    it('should use provided limit', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, []);
      });

      await service.getRecentMissedTactics('user1', 5);

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[1]).toContain(5); // limit
    });

    it('should default to limit of 10', async () => {
      mockDb.all = jest.fn((sql, params, callback) => {
        callback(null, []);
      });

      await service.getRecentMissedTactics('user1');

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[1]).toContain(10); // default limit
    });
  });
});
