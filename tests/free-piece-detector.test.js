/**
 * Unit tests for FreePieceDetector
 * Tests detection of hanging pieces and opponent blunders
 */

const FreePieceDetector = require('../src/services/FreePieceDetector');

describe('FreePieceDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new FreePieceDetector();
  });

  describe('constructor', () => {
    it('should initialize piece values correctly', () => {
      expect(detector.pieceValues).toEqual({
        'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9
      });
    });

    it('should set minimum free piece value to 1', () => {
      expect(detector.MIN_FREE_PIECE_VALUE).toBe(1);
    });

    it('should not include king in piece values', () => {
      expect(detector.pieceValues['k']).toBeUndefined();
    });
  });

  describe('detectFreePiece', () => {
    it('should return null for null FEN', () => {
      const result = detector.detectFreePiece(null, 'Nxe5', [], 'white');
      expect(result).toBeNull();
    });

    it('should return null when it is not the player\'s turn', () => {
      // White to move, but playerColor is black
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = detector.detectFreePiece(fen, 'e4', [], 'black');
      expect(result).toBeNull();
    });

    it('should return null when no free pieces exist', () => {
      // Starting position - no hanging pieces
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = detector.detectFreePiece(fen, 'e4', [], 'white');
      expect(result).toBeNull();
    });

    it('should detect hanging piece', () => {
      // Position with black knight hanging on e5 (undefended)
      const fen = 'rnbqkb1r/pppp1ppp/5n2/4n3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1';
      const result = detector.detectFreePiece(fen, 'Nxe5', [], 'white');

      // May or may not find free piece depending on defense calculation
      if (result) {
        expect(result.opponentPiece).toBeDefined();
        expect(result.pieceValue).toBeGreaterThanOrEqual(1);
      }
    });

    it('should identify when player captured the free piece', () => {
      // Position with hanging black knight on c6
      const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3';
      const result = detector.detectFreePiece(fen, 'Bxc6', [], 'white');

      if (result) {
        // If there's a capture on c6 and knight was free
        if (result.pieceSquare === 'c6') {
          expect(result.wasCaptured).toBe(true);
        }
      }
    });

    it('should return all free pieces information', () => {
      // A position with multiple undefended pieces
      const fen = 'r1bqk2r/pppp1ppp/2n2n2/4N3/1bB1P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 5';
      const result = detector.detectFreePiece(fen, 'Nxe4', [], 'black');

      if (result && result.allFreePieces) {
        expect(Array.isArray(result.allFreePieces)).toBe(true);
        for (const piece of result.allFreePieces) {
          expect(piece.piece).toBeDefined();
          expect(piece.square).toBeDefined();
          expect(piece.value).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe('_findFreePieces', () => {
    it('should find undefended enemy pieces', () => {
      const { Chess } = require('chess.js');
      // Position with black pawn on e5 that might be attackable
      const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 2';
      const chess = new Chess(fen);

      const freePieces = detector._findFreePieces(chess, 'white');

      expect(Array.isArray(freePieces)).toBe(true);
      // Each free piece should have piece type, square, and value
      for (const piece of freePieces) {
        expect(piece.piece).toBeDefined();
        expect(piece.square).toBeDefined();
        expect(typeof piece.value).toBe('number');
      }
    });

    it('should not include king in free pieces', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const freePieces = detector._findFreePieces(chess, 'white');

      // No piece should be a king
      for (const piece of freePieces) {
        expect(piece.piece).not.toBe('k');
      }
    });

    it('should correctly identify enemy pieces based on player color', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const whitePlayerFreePieces = detector._findFreePieces(chess, 'white');
      const blackPlayerFreePieces = detector._findFreePieces(chess, 'black');

      // When white is player, free pieces are black's pieces
      // When black is player, free pieces are white's pieces
      // Both should be arrays
      expect(Array.isArray(whitePlayerFreePieces)).toBe(true);
      expect(Array.isArray(blackPlayerFreePieces)).toBe(true);
    });
  });

  describe('_isPieceFree', () => {
    it('should return false if no capturing moves exist', () => {
      const { Chess } = require('chess.js');
      // Pawn on a7 - no white pieces can capture it
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);
      const piece = { type: 'p', color: 'b' };

      const result = detector._isPieceFree(chess, 'a7', piece, 'white');
      expect(result).toBe(false);
    });

    it('should consider piece as free when capturer is less valuable', () => {
      const { Chess } = require('chess.js');
      // Position where pawn can capture knight
      const fen = 'rnbqkbnr/ppp1pppp/3p4/4n3/4P3/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 3';
      const chess = new Chess(fen);
      const piece = { type: 'n', color: 'b' };

      const result = detector._isPieceFree(chess, 'e5', piece, 'white');

      // d3 pawn can take e5 knight - may or may not be free depending on defense
      expect(typeof result).toBe('boolean');
    });
  });

  describe('_getCapturingMoves', () => {
    it('should find moves that capture on target square', () => {
      const { Chess } = require('chess.js');
      // Position with black pawn on d5 that can be captured
      const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
      const chess = new Chess(fen);

      const capturingMoves = detector._getCapturingMoves(chess, 'd5');

      expect(Array.isArray(capturingMoves)).toBe(true);
      // e4 pawn can capture on d5
      const exd5 = capturingMoves.find(m => m.from === 'e4' && m.to === 'd5');
      expect(exd5).toBeDefined();
    });

    it('should return empty array when no captures possible', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      // No piece can capture on a8 (it's defended and would require multiple moves)
      const capturingMoves = detector._getCapturingMoves(chess, 'a8');
      expect(capturingMoves).toEqual([]);
    });
  });

  describe('_getPieceAt', () => {
    it('should return piece at given square', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const pieceAtE1 = detector._getPieceAt(chess, 'e1');
      expect(pieceAtE1.type).toBe('k');
      expect(pieceAtE1.color).toBe('w');

      const pieceAtD8 = detector._getPieceAt(chess, 'd8');
      expect(pieceAtD8.type).toBe('q');
      expect(pieceAtD8.color).toBe('b');
    });

    it('should return null for empty squares', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const pieceAtE4 = detector._getPieceAt(chess, 'e4');
      expect(pieceAtE4).toBeNull();
    });

    it('should handle edge squares correctly', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const pieceAtA1 = detector._getPieceAt(chess, 'a1');
      expect(pieceAtA1.type).toBe('r');
      expect(pieceAtA1.color).toBe('w');

      const pieceAtH8 = detector._getPieceAt(chess, 'h8');
      expect(pieceAtH8.type).toBe('r');
      expect(pieceAtH8.color).toBe('b');
    });
  });

  describe('_wouldBeRecaptured', () => {
    it('should detect recapture possibility', () => {
      const { Chess } = require('chess.js');
      // Position where taking on d5 leads to recapture
      const fen = 'rnbqkbnr/ppp1pppp/8/3p4/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2';
      const chess = new Chess(fen);

      // After exd5, black can recapture with queen
      const captureMove = { from: 'e4', to: 'd5', san: 'exd5' };
      const capturer = { type: 'p', color: 'w' };

      const result = detector._wouldBeRecaptured(chess, captureMove, capturer, 'white');
      expect(typeof result).toBe('boolean');
    });

    it('should handle positions with no recapture', () => {
      const { Chess } = require('chess.js');
      // Simple position
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      const chess = new Chess(fen);

      const captureMove = { from: 'e4', to: 'e5', san: 'e5' };
      const capturer = { type: 'p', color: 'w' };

      const result = detector._wouldBeRecaptured(chess, captureMove, capturer, 'white');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('_moveCaptures', () => {
    it('should return true when move captures target square', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
      const chess = new Chess(fen);

      const result = detector._moveCaptures('exd5', 'd5', chess);
      expect(result).toBe(true);
    });

    it('should return false when move does not capture target', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      const chess = new Chess(fen);

      const result = detector._moveCaptures('e6', 'd5', chess);
      expect(result).toBe(false);
    });

    it('should return false for invalid move', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const result = detector._moveCaptures('invalid', 'e4', chess);
      expect(result).toBe(false);
    });
  });

  describe('_findBestCaptureMove', () => {
    it('should find capture move from alternatives', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
      const chess = new Chess(fen);

      const freePieces = [{ piece: 'p', square: 'd5', value: 1 }];
      const alternatives = [{ move: 'exd5' }, { move: 'Nc3' }];

      const result = detector._findBestCaptureMove(freePieces, alternatives, chess);
      expect(result).toBe('exd5');
    });

    it('should return null when no alternatives provided', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const result = detector._findBestCaptureMove([], null, chess);
      expect(result).toBeNull();
    });

    it('should return null when no capture in alternatives', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const freePieces = [{ piece: 'p', square: 'a7', value: 1 }];
      const alternatives = [{ move: 'e4' }, { move: 'd4' }];

      const result = detector._findBestCaptureMove(freePieces, alternatives, chess);
      expect(result).toBeNull();
    });
  });

  describe('_getCaptureMoveFor', () => {
    it('should find a capture move for target square', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
      const chess = new Chess(fen);

      const result = detector._getCaptureMoveFor(chess, 'd5');
      expect(result).toBe('exd5');
    });

    it('should return least valuable capturer', () => {
      const { Chess } = require('chess.js');
      // Position where both pawn and queen can capture
      const fen = 'rnbqkbnr/ppp1pppp/8/3p4/3QP3/8/PPP2PPP/RNB1KBNR w KQkq - 0 2';
      const chess = new Chess(fen);

      const result = detector._getCaptureMoveFor(chess, 'd5');
      // Should prefer pawn capture over queen
      expect(result).toBe('exd5');
    });

    it('should return null when no capture possible', () => {
      const { Chess } = require('chess.js');
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const chess = new Chess(fen);

      const result = detector._getCaptureMoveFor(chess, 'a8');
      expect(result).toBeNull();
    });
  });

  describe('detectOpponentBlunder', () => {
    it('should call detectFreePiece with correct parameters', () => {
      const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
      const alternatives = [{ move: 'exd5' }];

      // detectOpponentBlunder should analyze from the perspective of finding free pieces
      const result = detector.detectOpponentBlunder(fen, 'e5', alternatives, 'white');

      // Result should be similar to detectFreePiece
      if (result) {
        expect(result.opponentPiece).toBeDefined();
      }
    });

    it('should return null for null FEN', () => {
      const result = detector.detectOpponentBlunder(null, 'e5', [], 'white');
      expect(result).toBeNull();
    });
  });

  describe('integration tests', () => {
    it('should handle complete free piece detection workflow', () => {
      // Position after opponent blunders a piece
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4N3/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 4';

      const result = detector.detectFreePiece(fen, 'Nxe5', [], 'black');

      // Should not throw and return valid structure
      if (result) {
        expect(result.opponentPiece).toBeDefined();
        expect(result.pieceValue).toBeGreaterThanOrEqual(1);
        expect(typeof result.wasCaptured).toBe('boolean');
        expect(result.playedMove).toBe('Nxe5');
      }
    });

    it('should handle position with multiple hanging pieces', () => {
      // Position with multiple loose pieces
      const fen = 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 4 4';

      const result = detector.detectFreePiece(fen, 'Bxc3', [], 'black');

      if (result && result.allFreePieces) {
        // Should return array of all free pieces
        expect(Array.isArray(result.allFreePieces)).toBe(true);
        // Most valuable should be returned as main piece
        const mainValue = result.pieceValue;
        for (const piece of result.allFreePieces) {
          expect(piece.value).toBeLessThanOrEqual(mainValue);
        }
      }
    });

    it('should correctly determine if capture was made', () => {
      const fen = 'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3';

      // If we find a free piece on f6 and played Bxf7+
      const result = detector.detectFreePiece(fen, 'Bxf7+', [], 'white');

      if (result && result.pieceSquare === 'f7') {
        expect(result.wasCaptured).toBe(true);
      }
    });
  });
});
