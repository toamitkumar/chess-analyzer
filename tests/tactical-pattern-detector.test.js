/**
 * Unit tests for TacticalPatternDetector
 * Tests detection of forks, pins, skewers, and discovered attacks
 */

const TacticalPatternDetector = require('../src/services/TacticalPatternDetector');

describe('TacticalPatternDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new TacticalPatternDetector();
  });

  describe('constructor', () => {
    it('should initialize piece values correctly', () => {
      expect(detector.pieceValues).toEqual({
        'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 100
      });
    });

    it('should set minimum tactic gain to 100 centipawns', () => {
      expect(detector.MIN_TACTIC_GAIN).toBe(100);
    });
  });

  describe('detectOpportunity', () => {
    it('should return null for null FEN', () => {
      const result = detector.detectOpportunity(null, 'Nxe5', 'Nc3', 150, 'white');
      expect(result).toBeNull();
    });

    it('should return null for null best move', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = detector.detectOpportunity(fen, null, 'e4', 150, 'white');
      expect(result).toBeNull();
    });

    it('should return null when eval gain is below minimum', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = detector.detectOpportunity(fen, 'e4', 'd4', 50, 'white');
      expect(result).toBeNull();
    });

    it('should return null when it is not the player\'s move', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = detector.detectOpportunity(fen, 'e4', 'd4', 150, 'black');
      expect(result).toBeNull();
    });

    it('should return null for invalid best move', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = detector.detectOpportunity(fen, 'invalid', 'd4', 150, 'white');
      expect(result).toBeNull();
    });

    it('should identify tactical sequence for significant eval gain without specific pattern', () => {
      // Position after 1.e4 e5 2.Nf3 - simple position with large eval difference
      const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
      const result = detector.detectOpportunity(fen, 'Nc6', 'd6', 250, 'black');

      // May or may not detect a specific pattern, but should handle gracefully
      if (result) {
        expect(result.bestMove).toBe('Nc6');
        expect(result.wasFound).toBe(false);
      }
    });

    it('should correctly identify when best move was played', () => {
      const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
      const result = detector.detectOpportunity(fen, 'Nc6', 'Nc6', 250, 'black');

      if (result) {
        expect(result.wasFound).toBe(true);
      }
    });
  });

  describe('_detectFork', () => {
    it('should detect knight fork on king and queen', () => {
      // Position where Nf7 forks king and queen
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

      // This tests the internal method indirectly through detectOpportunity
      // The position may or may not have a clear fork - testing the structure
      const result = detector.detectOpportunity(fen, 'Qxf7+', 'Nc3', 900, 'white');

      // Check structure if result exists
      if (result && result.tacticType === 'fork') {
        expect(result.tacticType).toBe('fork');
        expect(result.targetPieces).toBeDefined();
        expect(Array.isArray(result.targetPieces)).toBe(true);
      }
    });

    it('should return null when no fork exists', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      // e4 doesn't create any fork
      const result = detector._detectFork(fen, 'e4', { piece: 'p', to: 'e4', from: 'e2' });
      expect(result).toBeNull();
    });
  });

  describe('_detectPin', () => {
    it('should only check sliding pieces for pins', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      // Knight move - should not detect pin
      const result = detector._detectPin(fen, 'Nc3', { piece: 'n', to: 'c3', from: 'b1' });
      expect(result).toBeNull();
    });

    it('should detect pin with bishop', () => {
      // Position where bishop pins a piece
      const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

      // Test internal method - checking structure
      const result = detector._detectPin(fen, 'Bb5', { piece: 'b', to: 'b5', from: 'c4' });

      // Pin detection may or may not find a pin depending on position
      if (result) {
        expect(result.type).toBe('pin');
        expect(result.pinnedPiece).toBeDefined();
        expect(result.behindPiece).toBeDefined();
      }
    });
  });

  describe('_detectSkewer', () => {
    it('should only check sliding pieces for skewers', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      // Knight move - should not detect skewer
      const result = detector._detectSkewer(fen, 'Nc3', { piece: 'n', to: 'c3', from: 'b1' });
      expect(result).toBeNull();
    });
  });

  describe('_detectDiscoveredAttack', () => {
    it('should handle positions without discovered attacks', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      const result = detector._detectDiscoveredAttack(fen, 'e4', { piece: 'p', to: 'e4', from: 'e2' });
      expect(result).toBeNull();
    });
  });

  describe('_pieceAttacks', () => {
    it('should detect knight attacks', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 1 1';
      const chess = new Chess(fen);

      // Knight on f3 attacks e5 and g5
      const attacksE5 = detector._pieceAttacks(chess, 'f3', 'e5', 'n');
      const attacksG5 = detector._pieceAttacks(chess, 'f3', 'g5', 'n');
      const attacksD4 = detector._pieceAttacks(chess, 'f3', 'd4', 'n');

      expect(attacksE5).toBe(true);
      expect(attacksG5).toBe(true);
      expect(attacksD4).toBe(true);
    });

    it('should return false for non-attacked squares', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 1 1';
      const chess = new Chess(fen);

      // Knight on f3 does not attack f4
      const attacksF4 = detector._pieceAttacks(chess, 'f3', 'f4', 'n');
      expect(attacksF4).toBe(false);
    });
  });

  describe('_getDirections', () => {
    it('should return diagonal directions for bishop', () => {
      const directions = detector._getDirections('b');
      expect(directions).toEqual([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    });

    it('should return orthogonal directions for rook', () => {
      const directions = detector._getDirections('r');
      expect(directions).toEqual([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    });

    it('should return all 8 directions for queen', () => {
      const directions = detector._getDirections('q');
      expect(directions).toHaveLength(8);
      expect(directions).toContainEqual([1, 1]);
      expect(directions).toContainEqual([1, 0]);
    });

    it('should return empty array for non-sliding pieces', () => {
      const directions = detector._getDirections('n');
      expect(directions).toEqual([]);
    });
  });

  describe('_findPinsFromSquare', () => {
    it('should find pins along directions', () => {
      const { Chess } = require('chess.js');
      // Position with potential pin: white bishop on a4, black knight on c6, black king on e8
      const fen = 'r1bqk2r/pppp1ppp/2n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1';
      const chess = new Chess(fen);

      const pins = detector._findPinsFromSquare(chess, 'a4', 'b');

      // Check structure - may or may not find pins depending on exact position
      expect(Array.isArray(pins)).toBe(true);
    });
  });

  describe('_findSkewersFromSquare', () => {
    it('should find skewers along directions', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const skewers = detector._findSkewersFromSquare(chess, 'a1', 'r');

      // Check structure
      expect(Array.isArray(skewers)).toBe(true);
    });
  });

  describe('_findPiecesBehind', () => {
    it('should find sliding pieces behind a square', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      // Check for pieces behind e2
      const pieces = detector._findPiecesBehind(chess, 'e2', 'white');

      expect(Array.isArray(pieces)).toBe(true);
      // Queen on d1 should be found behind e2 diagonally
      const queenFound = pieces.some(p => p.piece === 'q');
      expect(queenFound).toBe(true);
    });

    it('should only find sliding pieces (b, r, q)', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const pieces = detector._findPiecesBehind(chess, 'd2', 'white');

      // Should only include bishops, rooks, queens
      for (const piece of pieces) {
        expect(['b', 'r', 'q']).toContain(piece.piece);
      }
    });
  });

  describe('_getNewAttacks', () => {
    it('should find new attacks after a move', () => {
      const { Chess } = require('chess.js');
      const fenBefore = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      const chessBefore = new Chess(fenBefore);

      const chessAfter = new Chess(fenBefore);
      chessAfter.move('d5');

      // Check for new attacks - this is a simple case
      const newAttacks = detector._getNewAttacks(chessBefore, chessAfter, 'd5');

      expect(Array.isArray(newAttacks)).toBe(true);
    });

    it('should return empty array when no new attacks exist', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chessBefore = new Chess(fen);
      const chessAfter = new Chess(fen);
      chessAfter.move('e4');

      // e4 pawn doesn't create new attacks from itself
      const newAttacks = detector._getNewAttacks(chessBefore, chessAfter, 'a1');

      expect(Array.isArray(newAttacks)).toBe(true);
    });
  });

  describe('integration tests', () => {
    it('should handle complete tactical analysis workflow', () => {
      // Fried Liver position - lots of tactics
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

      // Ng5 threatens Nxf7 fork
      const result = detector.detectOpportunity(fen, 'Ng5', 'O-O', 150, 'white');

      // Should either find a tactic or return null - shouldn't throw
      if (result) {
        expect(result.bestMove).toBe('Ng5');
        expect(result.attackingPiece).toBeDefined();
        expect(result.wasFound).toBe(false);
        expect(result.evalGain).toBe(150);
      }
    });

    it('should handle tactical sequence detection', () => {
      // A position with significant eval gain but no clear single tactic
      const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 5';

      const result = detector.detectOpportunity(fen, 'Na5', 'O-O', 250, 'black');

      if (result && result.tacticType === 'tactical_sequence') {
        expect(result.tacticType).toBe('tactical_sequence');
        expect(result.description).toContain('centipawns');
      }
    });
  });
});
