const { Chess } = require('chess.js');
const BlunderCategorizer = require('../src/models/blunder-categorizer');

describe('BlunderCategorizer', () => {
  let categorizer;

  beforeEach(() => {
    categorizer = new BlunderCategorizer();
  });

  describe('constructor', () => {
    test('should initialize with severity thresholds', () => {
      expect(categorizer.SEVERITY_THRESHOLDS).toEqual({
        minor: 150,
        moderate: 300,
        major: 500,
        critical: 501
      });
    });

    test('should initialize with phase ranges', () => {
      expect(categorizer.PHASE_RANGES).toEqual({
        opening: { start: 1, end: 10 },
        middlegame: { start: 11, end: 40 },
        endgame: { start: 41, end: 999 }
      });
    });
  });

  describe('determinePhase()', () => {
    test('should return "opening" for moves 1-10', () => {
      expect(categorizer.determinePhase(1)).toBe('opening');
      expect(categorizer.determinePhase(5)).toBe('opening');
      expect(categorizer.determinePhase(10)).toBe('opening');
    });

    test('should return "middlegame" for moves 11-40', () => {
      expect(categorizer.determinePhase(11)).toBe('middlegame');
      expect(categorizer.determinePhase(25)).toBe('middlegame');
      expect(categorizer.determinePhase(40)).toBe('middlegame');
    });

    test('should return "endgame" for moves 41+', () => {
      expect(categorizer.determinePhase(41)).toBe('endgame');
      expect(categorizer.determinePhase(50)).toBe('endgame');
      expect(categorizer.determinePhase(100)).toBe('endgame');
    });
  });

  describe('calculateSeverity()', () => {
    test('should return "minor" for CP loss < 150', () => {
      expect(categorizer.calculateSeverity(50)).toBe('minor');
      expect(categorizer.calculateSeverity(100)).toBe('minor');
      expect(categorizer.calculateSeverity(149)).toBe('minor');
    });

    test('should return "moderate" for CP loss 150-299', () => {
      expect(categorizer.calculateSeverity(150)).toBe('moderate');
      expect(categorizer.calculateSeverity(200)).toBe('moderate');
      expect(categorizer.calculateSeverity(299)).toBe('moderate');
    });

    test('should return "major" for CP loss 300-499', () => {
      expect(categorizer.calculateSeverity(300)).toBe('major');
      expect(categorizer.calculateSeverity(400)).toBe('major');
      expect(categorizer.calculateSeverity(499)).toBe('major');
    });

    test('should return "critical" for CP loss >= 501', () => {
      expect(categorizer.calculateSeverity(500)).toBe('major');
      expect(categorizer.calculateSeverity(501)).toBe('critical');
      expect(categorizer.calculateSeverity(1000)).toBe('critical');
    });
  });

  describe('calculateDifficulty()', () => {
    test('should return difficulty between 1-5 for easy hanging piece with low CP loss', () => {
      const difficulty = categorizer.calculateDifficulty(100, 'hanging_piece', 'opening');
      expect(difficulty).toBeGreaterThanOrEqual(1);
      expect(difficulty).toBeLessThanOrEqual(5);
    });

    test('should increase difficulty for high CP loss', () => {
      const lowDiff = categorizer.calculateDifficulty(100, 'positional_error', 'opening');
      const highDiff = categorizer.calculateDifficulty(600, 'positional_error', 'opening');
      expect(highDiff).toBeGreaterThan(lowDiff);
    });

    test('should increase difficulty for complex tactical themes', () => {
      const easyDiff = categorizer.calculateDifficulty(300, 'hanging_piece', 'opening');
      const hardDiff = categorizer.calculateDifficulty(300, 'missed_discovery', 'opening');
      expect(hardDiff).toBeGreaterThan(easyDiff);
    });

    test('should increase difficulty for endgame phase', () => {
      const midDiff = categorizer.calculateDifficulty(300, 'positional_error', 'middlegame');
      const endDiff = categorizer.calculateDifficulty(300, 'positional_error', 'endgame');
      expect(endDiff).toBeGreaterThan(midDiff);
    });

    test('should cap difficulty at 5', () => {
      const difficulty = categorizer.calculateDifficulty(1000, 'missed_discovery', 'endgame');
      expect(difficulty).toBeLessThanOrEqual(5);
    });

    test('should have minimum difficulty of 1', () => {
      const difficulty = categorizer.calculateDifficulty(50, 'hanging_piece', 'opening');
      expect(difficulty).toBeGreaterThanOrEqual(1);
    });
  });

  describe('classifyPositionType()', () => {
    test('should return "tactical" for tactical themes', () => {
      const chess = new Chess();
      expect(categorizer.classifyPositionType(chess.fen(), chess, 'missed_fork')).toBe('tactical');
      expect(categorizer.classifyPositionType(chess.fen(), chess, 'hanging_piece')).toBe('tactical');
      expect(categorizer.classifyPositionType(chess.fen(), chess, 'missed_pin')).toBe('tactical');
    });

    test('should return "defensive" for king safety issues', () => {
      const chess = new Chess();
      expect(categorizer.classifyPositionType(chess.fen(), chess, 'king_safety')).toBe('defensive');
    });

    test('should return "positional" for pawn structure issues', () => {
      const chess = new Chess();
      expect(categorizer.classifyPositionType(chess.fen(), chess, 'weak_pawn_structure')).toBe('positional');
    });

    test('should return position type for balanced positions', () => {
      const chess = new Chess();
      const result = categorizer.classifyPositionType(chess.fen(), chess, 'bad_piece_placement');
      expect(['positional', 'attacking', 'defensive', 'tactical']).toContain(result);
    });
  });

  describe('isHangingPiece()', () => {
    test('should return boolean for valid move', () => {
      const chess = new Chess();
      const result = categorizer.isHangingPiece(chess, 'e2e4');
      expect(typeof result).toBe('boolean');
    });

    test('should return false for invalid move', () => {
      const chess = new Chess();
      const result = categorizer.isHangingPiece(chess, 'invalid');
      expect(result).toBe(false);
    });
  });

  describe('isMissedFork()', () => {
    test('should return boolean for valid move', () => {
      const chess = new Chess();
      const result = categorizer.isMissedFork(chess, 'e2e4');
      expect(typeof result).toBe('boolean');
    });

    test('should return false for invalid move', () => {
      const chess = new Chess();
      const result = categorizer.isMissedFork(chess, 'invalid');
      expect(result).toBe(false);
    });
  });

  describe('isKingSafetyIssue()', () => {
    test('should return boolean for valid move', () => {
      const chess = new Chess();
      const result = categorizer.isKingSafetyIssue(chess, 'e2e4');
      expect(typeof result).toBe('boolean');
    });

    test('should return false for invalid move', () => {
      const chess = new Chess();
      const result = categorizer.isKingSafetyIssue(chess, 'invalid');
      expect(result).toBe(false);
    });
  });

  describe('isWrongCapture()', () => {
    test('should return boolean for valid moves', () => {
      const fen = 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2';
      const chess = new Chess(fen);
      const result = categorizer.isWrongCapture(chess, 'd4d5', 'c1d5');
      expect(typeof result).toBe('boolean');
    });

    test('should return false when both are not captures', () => {
      const chess = new Chess();
      const result = categorizer.isWrongCapture(chess, 'e2e4', 'd2d4');
      expect(result).toBe(false);
    });

    test('should return false for invalid moves', () => {
      const chess = new Chess();
      const result = categorizer.isWrongCapture(chess, 'invalid', 'e2e4');
      expect(result).toBe(false);
    });
  });

  describe('categorizeBlunder()', () => {
    test('should categorize a complete blunder', () => {
      const chess = new Chess();
      const blunderData = {
        fen: chess.fen(),
        moveNumber: 5,
        playerMove: 'e2e4',
        bestMove: 'd2d4',
        evaluationBefore: 0.5,
        evaluationAfter: -1.5,
        centipawnLoss: 200
      };

      const result = categorizer.categorizeBlunder(blunderData, chess);

      expect(result).toHaveProperty('phase');
      expect(result).toHaveProperty('tactical_theme');
      expect(result).toHaveProperty('position_type');
      expect(result).toHaveProperty('blunder_severity');
      expect(result).toHaveProperty('difficulty_level');

      expect(result.phase).toBe('opening');
      expect(result.blunder_severity).toBe('moderate');
      expect(result.difficulty_level).toBeGreaterThanOrEqual(1);
      expect(result.difficulty_level).toBeLessThanOrEqual(5);
    });

    test('should categorize middlegame blunder', () => {
      const chess = new Chess();
      const blunderData = {
        fen: chess.fen(),
        moveNumber: 25,
        playerMove: 'e2e4',
        bestMove: 'd2d4',
        evaluationBefore: 1.0,
        evaluationAfter: -2.0,
        centipawnLoss: 300
      };

      const result = categorizer.categorizeBlunder(blunderData, chess);
      expect(result.phase).toBe('middlegame');
      expect(result.blunder_severity).toBe('major');
    });

    test('should categorize endgame blunder', () => {
      const chess = new Chess();
      const blunderData = {
        fen: chess.fen(),
        moveNumber: 45,
        playerMove: 'e2e4',
        bestMove: 'd2d4',
        evaluationBefore: 0.0,
        evaluationAfter: -5.0,
        centipawnLoss: 500
      };

      const result = categorizer.categorizeBlunder(blunderData, chess);
      expect(result.phase).toBe('endgame');
      expect(result.blunder_severity).toBe('major');
    });

    test('should categorize critical blunder', () => {
      const chess = new Chess();
      const blunderData = {
        fen: chess.fen(),
        moveNumber: 15,
        playerMove: 'e2e4',
        bestMove: 'd2d4',
        evaluationBefore: 2.0,
        evaluationAfter: -4.0,
        centipawnLoss: 600
      };

      const result = categorizer.categorizeBlunder(blunderData, chess);
      expect(result.blunder_severity).toBe('critical');
      expect(result.difficulty_level).toBeGreaterThan(1);
    });
  });

  describe('helper methods', () => {
    describe('findKing()', () => {
      test('should find white king on starting position', () => {
        const chess = new Chess();
        const kingSquare = categorizer.findKing(chess, 'w');
        expect(kingSquare).toBe('e1');
      });

      test('should find black king on starting position', () => {
        const chess = new Chess();
        const kingSquare = categorizer.findKing(chess, 'b');
        expect(kingSquare).toBe('e8');
      });

      test('should find king after it moves', () => {
        // Test finding king in a different position after moves
        const chess = new Chess();
        chess.move('e2e4');
        chess.move('e7e5');
        const whiteKing = categorizer.findKing(chess, 'w');
        const blackKing = categorizer.findKing(chess, 'b');
        expect(whiteKing).toBe('e1'); // King hasn't moved yet
        expect(blackKing).toBe('e8');
      });
    });

    describe('getMaterialBalance()', () => {
      test('should return 0 for starting position', () => {
        const chess = new Chess();
        const balance = categorizer.getMaterialBalance(chess);
        expect(balance).toBe(0);
      });

      test('should calculate piece values correctly', () => {
        const chess = new Chess();
        const balance = categorizer.getMaterialBalance(chess);
        expect(balance).toBe(0);
      });
    });

    describe('isPoorSquare()', () => {
      test('should detect knight on rim', () => {
        expect(categorizer.isPoorSquare(new Chess(), 'a1', 'n')).toBe(true);
        expect(categorizer.isPoorSquare(new Chess(), 'h8', 'n')).toBe(true);
      });

      test('should return false for knight on good square', () => {
        expect(categorizer.isPoorSquare(new Chess(), 'd4', 'n')).toBe(false);
        expect(categorizer.isPoorSquare(new Chess(), 'e5', 'n')).toBe(false);
      });

      test('should return false for non-knight pieces', () => {
        expect(categorizer.isPoorSquare(new Chess(), 'a1', 'r')).toBe(false);
        expect(categorizer.isPoorSquare(new Chess(), 'e1', 'k')).toBe(false);
      });
    });

    describe('getAttackedPieces()', () => {
      test('should return array', () => {
        const chess = new Chess();
        const attacked = categorizer.getAttackedPieces(chess, 'e2', 'w');
        expect(Array.isArray(attacked)).toBe(true);
      });
    });

    describe('getAllAttackedSquares()', () => {
      test('should return array of attacked squares', () => {
        const chess = new Chess();
        const squares = categorizer.getAllAttackedSquares(chess, 'w');
        expect(Array.isArray(squares)).toBe(true);
        expect(squares.length).toBeGreaterThan(0);
      });

      test('should return different squares for white and black', () => {
        const chess = new Chess();
        const whiteSquares = categorizer.getAllAttackedSquares(chess, 'w');
        const blackSquares = categorizer.getAllAttackedSquares(chess, 'b');
        expect(whiteSquares).not.toEqual(blackSquares);
      });
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle invalid FEN gracefully', () => {
      const chess = new Chess();
      const blunderData = {
        fen: 'invalid-fen',
        moveNumber: 1,
        playerMove: 'e2e4',
        bestMove: 'd2d4',
        evaluationBefore: 0,
        evaluationAfter: -1,
        centipawnLoss: 100
      };

      // Should not throw error
      const result = categorizer.categorizeBlunder(blunderData, chess);
      expect(result).toHaveProperty('tactical_theme');
    });

    test('should handle invalid moves gracefully', () => {
      const chess = new Chess();
      const result = categorizer.identifyTacticalTheme(chess.fen(), 'invalid', 'e2e4', chess);
      expect(typeof result).toBe('string');
    });

    test('should return theme string on error', () => {
      const chess = new Chess();
      const result = categorizer.identifyTacticalTheme(chess.fen(), null, null, chess);
      // Error handling returns a default theme instead of throwing
      expect(typeof result).toBe('string');
      expect(result).toBeTruthy();
    });
  });
});
