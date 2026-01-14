/**
 * Tests for AnalysisConfig
 * ADR 006 Phase 2: Centralized thresholds + Mate detection
 */

const AnalysisConfig = require('../../src/models/analysis-config');

describe('AnalysisConfig', () => {
  describe('Configuration values', () => {
    test('should have depth levels defined', () => {
      expect(AnalysisConfig.DEPTH.QUICK).toBe(12);
      expect(AnalysisConfig.DEPTH.STANDARD).toBe(12);
      expect(AnalysisConfig.DEPTH.DEEP).toBe(18);
      expect(AnalysisConfig.DEPTH.LICHESS).toBe(20);
    });

    test('should have classification thresholds defined', () => {
      // Calibrated thresholds (70% of Lichess values for depth 12 analysis)
      expect(AnalysisConfig.CLASSIFICATION.WIN_PROB_INACCURACY).toBe(7);
      expect(AnalysisConfig.CLASSIFICATION.WIN_PROB_MISTAKE).toBe(14);
      expect(AnalysisConfig.CLASSIFICATION.WIN_PROB_BLUNDER).toBe(21);
      expect(AnalysisConfig.CLASSIFICATION.MATE_THRESHOLD).toBe(9000);
    });

    test('should have centipawn thresholds defined', () => {
      expect(AnalysisConfig.CLASSIFICATION.CP_INACCURACY).toBe(50);
      expect(AnalysisConfig.CLASSIFICATION.CP_MISTAKE).toBe(100);
      expect(AnalysisConfig.CLASSIFICATION.CP_BLUNDER).toBe(200);
    });

    test('should have tactical thresholds defined', () => {
      expect(AnalysisConfig.TACTICAL.HANGING_PIECE_MIN_LOSS).toBe(200);
      expect(AnalysisConfig.TACTICAL.TACTICAL_OVERSIGHT_MIN_LOSS).toBe(300);
    });
  });

  describe('isMateEvaluation()', () => {
    test('should return true for mate evaluations', () => {
      expect(AnalysisConfig.isMateEvaluation(10000)).toBe(true);
      expect(AnalysisConfig.isMateEvaluation(-10000)).toBe(true);
      expect(AnalysisConfig.isMateEvaluation(9500)).toBe(true);
      expect(AnalysisConfig.isMateEvaluation(-9500)).toBe(true);
      expect(AnalysisConfig.isMateEvaluation(9000)).toBe(true);
      expect(AnalysisConfig.isMateEvaluation(-9000)).toBe(true);
    });

    test('should return false for non-mate evaluations', () => {
      expect(AnalysisConfig.isMateEvaluation(8999)).toBe(false);
      expect(AnalysisConfig.isMateEvaluation(-8999)).toBe(false);
      expect(AnalysisConfig.isMateEvaluation(500)).toBe(false);
      expect(AnalysisConfig.isMateEvaluation(-500)).toBe(false);
      expect(AnalysisConfig.isMateEvaluation(0)).toBe(false);
    });
  });

  describe('getClassification()', () => {
    describe('Win probability based classification (calibrated for depth 12)', () => {
      test('should return blunder for >= 21% win prob drop', () => {
        expect(AnalysisConfig.getClassification(21)).toBe('blunder');
        expect(AnalysisConfig.getClassification(25)).toBe('blunder');
        expect(AnalysisConfig.getClassification(50)).toBe('blunder');
      });

      test('should return mistake for 14-20% win prob drop', () => {
        expect(AnalysisConfig.getClassification(14)).toBe('mistake');
        expect(AnalysisConfig.getClassification(17)).toBe('mistake');
        expect(AnalysisConfig.getClassification(20)).toBe('mistake');
      });

      test('should return inaccuracy for 7-13% win prob drop', () => {
        expect(AnalysisConfig.getClassification(7)).toBe('inaccuracy');
        expect(AnalysisConfig.getClassification(10)).toBe('inaccuracy');
        expect(AnalysisConfig.getClassification(13)).toBe('inaccuracy');
      });

      test('should return null for < 7% win prob drop', () => {
        expect(AnalysisConfig.getClassification(6)).toBeNull();
        expect(AnalysisConfig.getClassification(3)).toBeNull();
        expect(AnalysisConfig.getClassification(0)).toBeNull();
      });
    });

    describe('Mate detection override', () => {
      test('should return blunder when moving into forced mate', () => {
        // Negative mate evaluation = mate against the mover
        expect(AnalysisConfig.getClassification(0, -10000)).toBe('blunder');
        expect(AnalysisConfig.getClassification(0, -9500)).toBe('blunder');
        expect(AnalysisConfig.getClassification(5, -9000)).toBe('blunder');
      });

      test('should NOT override for positive mate (mover has mate)', () => {
        // Positive mate = mover is winning
        expect(AnalysisConfig.getClassification(0, 10000)).toBeNull();
        expect(AnalysisConfig.getClassification(0, 9500)).toBeNull();
      });

      test('Game 4 Move 56 (Ka7 - Mate in 3): should be blunder', () => {
        // Black moved into forced mate (eval -10000 from Black's perspective)
        expect(AnalysisConfig.getClassification(0, -10000)).toBe('blunder');
      });
    });
  });

  describe('getClassificationByCpLoss()', () => {
    test('should return blunder for >= 200cp loss', () => {
      expect(AnalysisConfig.getClassificationByCpLoss(200)).toBe('blunder');
      expect(AnalysisConfig.getClassificationByCpLoss(300)).toBe('blunder');
      expect(AnalysisConfig.getClassificationByCpLoss(500)).toBe('blunder');
    });

    test('should return mistake for 100-199cp loss', () => {
      expect(AnalysisConfig.getClassificationByCpLoss(100)).toBe('mistake');
      expect(AnalysisConfig.getClassificationByCpLoss(150)).toBe('mistake');
      expect(AnalysisConfig.getClassificationByCpLoss(199)).toBe('mistake');
    });

    test('should return inaccuracy for 50-99cp loss', () => {
      expect(AnalysisConfig.getClassificationByCpLoss(50)).toBe('inaccuracy');
      expect(AnalysisConfig.getClassificationByCpLoss(75)).toBe('inaccuracy');
      expect(AnalysisConfig.getClassificationByCpLoss(99)).toBe('inaccuracy');
    });

    test('should return null for < 50cp loss', () => {
      expect(AnalysisConfig.getClassificationByCpLoss(49)).toBeNull();
      expect(AnalysisConfig.getClassificationByCpLoss(25)).toBeNull();
      expect(AnalysisConfig.getClassificationByCpLoss(0)).toBeNull();
    });

    test('should override with blunder for mate detection', () => {
      // Even with 0 CP loss, moving into mate is a blunder
      expect(AnalysisConfig.getClassificationByCpLoss(0, -10000)).toBe('blunder');
    });
  });
});
