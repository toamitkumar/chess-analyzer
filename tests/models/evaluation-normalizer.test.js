/**
 * Tests for EvaluationNormalizer
 * Phase 1 of ADR 006: Lichess Evaluation Alignment
 */

const EvaluationNormalizer = require('../../src/models/evaluation-normalizer');

describe('EvaluationNormalizer', () => {
  describe('toWhitePerspective()', () => {
    test('should return same value when White to move (already White perspective)', () => {
      expect(EvaluationNormalizer.toWhitePerspective(100, true)).toBe(100);
      expect(EvaluationNormalizer.toWhitePerspective(-100, true)).toBe(-100);
      expect(EvaluationNormalizer.toWhitePerspective(0, true)).toBe(0);
    });

    test('should negate value when Black to move (convert to White perspective)', () => {
      // Black to move, Stockfish says +100 (Black is better)
      // From White's perspective: -100 (White is worse)
      expect(EvaluationNormalizer.toWhitePerspective(100, false)).toBe(-100);

      // Black to move, Stockfish says -100 (Black is worse)
      // From White's perspective: +100 (White is better)
      expect(EvaluationNormalizer.toWhitePerspective(-100, false)).toBe(100);

      expect(EvaluationNormalizer.toWhitePerspective(0, false)).toBe(-0); // -0 === 0 in JS but Object.is distinguishes
    });

    test('should handle mate evaluations', () => {
      // White to move, mate for White
      expect(EvaluationNormalizer.toWhitePerspective(10000, true)).toBe(10000);

      // Black to move, mate for Black (from Black's perspective)
      // From White's perspective: mate against White
      expect(EvaluationNormalizer.toWhitePerspective(10000, false)).toBe(-10000);
    });
  });

  describe('toMoverPerspective()', () => {
    test('should return same value for White move', () => {
      expect(EvaluationNormalizer.toMoverPerspective(100, true)).toBe(100);
      expect(EvaluationNormalizer.toMoverPerspective(-100, true)).toBe(-100);
    });

    test('should negate value for Black move', () => {
      // Position is +100 from White's perspective
      // From Black's perspective: -100 (bad for Black)
      expect(EvaluationNormalizer.toMoverPerspective(100, false)).toBe(-100);

      // Position is -100 from White's perspective
      // From Black's perspective: +100 (good for Black)
      expect(EvaluationNormalizer.toMoverPerspective(-100, false)).toBe(100);
    });
  });

  describe('calculateCentipawnLoss()', () => {
    describe('White moves', () => {
      test('should calculate loss when position worsens for White', () => {
        // Position goes from +50 to +30 (White's perspective)
        // White lost 20 centipawns
        expect(EvaluationNormalizer.calculateCentipawnLoss(50, 30, true)).toBe(20);
      });

      test('should return 0 when position improves for White', () => {
        // Position goes from +30 to +50 (White's perspective)
        // White gained, no loss
        expect(EvaluationNormalizer.calculateCentipawnLoss(30, 50, true)).toBe(0);
      });

      test('should handle position going from advantage to disadvantage', () => {
        // Position goes from +100 to -50 (White's perspective)
        // White lost 150 centipawns
        expect(EvaluationNormalizer.calculateCentipawnLoss(100, -50, true)).toBe(150);
      });
    });

    describe('Black moves', () => {
      test('should calculate loss when position worsens for Black', () => {
        // Position goes from -50 to -30 (White's perspective)
        // From Black's perspective: +50 to +30, Black lost 20 centipawns
        expect(EvaluationNormalizer.calculateCentipawnLoss(-50, -30, false)).toBe(20);
      });

      test('should return 0 when position improves for Black', () => {
        // Position goes from -30 to -50 (White's perspective)
        // From Black's perspective: +30 to +50, Black gained
        expect(EvaluationNormalizer.calculateCentipawnLoss(-30, -50, false)).toBe(0);
      });

      test('should handle position going from advantage to disadvantage for Black', () => {
        // Position goes from -100 to +50 (White's perspective)
        // From Black's perspective: +100 to -50, Black lost 150 centipawns
        expect(EvaluationNormalizer.calculateCentipawnLoss(-100, 50, false)).toBe(150);
      });
    });

    describe('Lichess reference cases', () => {
      test('Game 2 Move 2 (e5 - Englund Gambit): Black blunder', () => {
        // Before: 0.00 (equal), After: +1.74 (White advantage)
        // Black moved, position went from 0 to +174 (White's perspective)
        // From Black's perspective: 0 to -174, Black lost 174 centipawns
        expect(EvaluationNormalizer.calculateCentipawnLoss(0, 174, false)).toBe(174);
      });

      test('Game 1 Move 6 (a3): White mistake', () => {
        // Before: -0.17, After: -0.91 (White's perspective)
        // White moved, position went from -17 to -91
        // White lost 74 centipawns
        expect(EvaluationNormalizer.calculateCentipawnLoss(-17, -91, true)).toBe(74);
      });

      test('Game 4 Move 56 (Ka7 - Mate in 3): Black blunder', () => {
        // Before: some losing position, After: #3 for White
        // Black moved into forced mate
        // From Black's perspective: massive loss
        expect(EvaluationNormalizer.calculateCentipawnLoss(-500, 10000, false)).toBeGreaterThan(9000);
      });
    });
  });

  describe('isMateEvaluation()', () => {
    test('should return true for mate evaluations', () => {
      expect(EvaluationNormalizer.isMateEvaluation(10000)).toBe(true);
      expect(EvaluationNormalizer.isMateEvaluation(-10000)).toBe(true);
      expect(EvaluationNormalizer.isMateEvaluation(9500)).toBe(true);
      expect(EvaluationNormalizer.isMateEvaluation(-9500)).toBe(true);
      expect(EvaluationNormalizer.isMateEvaluation(9000)).toBe(true);
    });

    test('should return false for non-mate evaluations', () => {
      expect(EvaluationNormalizer.isMateEvaluation(8999)).toBe(false);
      expect(EvaluationNormalizer.isMateEvaluation(-8999)).toBe(false);
      expect(EvaluationNormalizer.isMateEvaluation(500)).toBe(false);
      expect(EvaluationNormalizer.isMateEvaluation(0)).toBe(false);
    });
  });

  describe('getMateIn()', () => {
    test('should return mate-in-N for mate evaluations', () => {
      // 10000 = checkmate (mate in 0)
      expect(EvaluationNormalizer.getMateIn(10000)).toBe(0);

      // 9990 = mate in 1
      expect(EvaluationNormalizer.getMateIn(9990)).toBe(1);

      // 9980 = mate in 2
      expect(EvaluationNormalizer.getMateIn(9980)).toBe(2);

      // Negative = mate against
      expect(EvaluationNormalizer.getMateIn(-10000)).toBe(-0); // Checkmate against
      expect(EvaluationNormalizer.getMateIn(-9990)).toBe(-1);
    });

    test('should return null for non-mate evaluations', () => {
      expect(EvaluationNormalizer.getMateIn(500)).toBeNull();
      expect(EvaluationNormalizer.getMateIn(-500)).toBeNull();
      expect(EvaluationNormalizer.getMateIn(0)).toBeNull();
    });
  });

  describe('normalizeForStorage()', () => {
    test('should normalize evaluation after White move (Black to move next)', () => {
      // After White's move d4, it's Black's turn
      // Stockfish returns +20 from Black's perspective (Black slightly better)
      // From White's perspective: -20
      expect(EvaluationNormalizer.normalizeForStorage(20, false)).toBe(-20);
    });

    test('should normalize evaluation after Black move (White to move next)', () => {
      // After Black's move e5, it's White's turn
      // Stockfish returns +174 from White's perspective (White better)
      // Already White's perspective: +174
      expect(EvaluationNormalizer.normalizeForStorage(174, true)).toBe(174);
    });

    test('Lichess Game 2 Move 2 (e5): should show +174 (White advantage)', () => {
      // After Black plays e5 (Englund Gambit), it's White's turn
      // Stockfish returns +174 (White is better from White's perspective)
      // This should be stored as +174 (matching Lichess +1.74)
      expect(EvaluationNormalizer.normalizeForStorage(174, true)).toBe(174);
    });

    test('Lichess Game 2 Move 10 (Qxb2): should show +227 (White advantage)', () => {
      // After Black plays Qxb2, it's White's turn
      // Stockfish returns +227 (White is better from White's perspective)
      // This should be stored as +227 (matching Lichess +2.27)
      expect(EvaluationNormalizer.normalizeForStorage(227, true)).toBe(227);
    });
  });
});
