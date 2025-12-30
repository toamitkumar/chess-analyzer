/**
 * Tests for Win-Probability Utility
 * ADR 005: Win-probability based accuracy calculation
 */

const WinProbability = require('../../src/models/win-probability');

describe('WinProbability', () => {
  describe('cpToWinProbability()', () => {
    it('should return 50% for evaluation of 0', () => {
      const result = WinProbability.cpToWinProbability(0);
      expect(result).toBeCloseTo(50, 1);
    });

    it('should return ~59-64% for +100 centipawns', () => {
      const result = WinProbability.cpToWinProbability(100);
      expect(result).toBeGreaterThan(58);
      expect(result).toBeLessThan(65);
    });

    it('should return ~75-80% for +300 centipawns', () => {
      const result = WinProbability.cpToWinProbability(300);
      expect(result).toBeGreaterThan(74);
      expect(result).toBeLessThan(81);
    });

    it('should return ~95% for +600 centipawns', () => {
      const result = WinProbability.cpToWinProbability(600);
      expect(result).toBeGreaterThan(90);
      expect(result).toBeLessThan(98);
    });

    it('should return ~36-42% for -100 centipawns', () => {
      const result = WinProbability.cpToWinProbability(-100);
      expect(result).toBeGreaterThan(35);
      expect(result).toBeLessThan(42);
    });

    it('should return close to 100% for mate (10000 CP)', () => {
      const result = WinProbability.cpToWinProbability(10000);
      expect(result).toBeGreaterThan(99);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should return close to 0% for -mate (-10000 CP)', () => {
      const result = WinProbability.cpToWinProbability(-10000);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    });

    it('should be symmetric around 50%', () => {
      const plus200 = WinProbability.cpToWinProbability(200);
      const minus200 = WinProbability.cpToWinProbability(-200);
      expect(plus200 + minus200).toBeCloseTo(100, 1);
    });

    it('should handle edge case of exactly +1000 CP', () => {
      const result = WinProbability.cpToWinProbability(1000);
      expect(result).toBeGreaterThan(95);
      expect(result).toBeLessThan(100);
    });
  });

  describe('calculateMoveAccuracy()', () => {
    it('should return 100% for no win probability drop', () => {
      const result = WinProbability.calculateMoveAccuracy(65, 65);
      expect(result).toBeCloseTo(100, 0);
    });

    it('should return ~80% for 5% win drop', () => {
      const result = WinProbability.calculateMoveAccuracy(65, 60);
      expect(result).toBeGreaterThan(75);
      expect(result).toBeLessThan(85);
    });

    it('should return ~60% for 10% win drop', () => {
      const result = WinProbability.calculateMoveAccuracy(65, 55);
      expect(result).toBeGreaterThan(55);
      expect(result).toBeLessThan(65);
    });

    it('should return ~40% for 20% win drop', () => {
      const result = WinProbability.calculateMoveAccuracy(65, 45);
      expect(result).toBeGreaterThan(38);
      expect(result).toBeLessThan(44);
    });

    it('should return very low accuracy for 50% win drop', () => {
      const result = WinProbability.calculateMoveAccuracy(80, 30);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(10);
    });

    it('should handle negative win drop (improving position)', () => {
      const result = WinProbability.calculateMoveAccuracy(60, 70);
      expect(result).toBe(100);
    });

    it('should clamp result to [0, 100]', () => {
      const result = WinProbability.calculateMoveAccuracy(90, 0);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should return ~51% for 15% drop (Lichess-style)', () => {
      // Lichess formula with our constants
      const result = WinProbability.calculateMoveAccuracy(70, 55);
      expect(result).toBeGreaterThan(50);
      expect(result).toBeLessThan(53);
    });
  });

  describe('calculatePositionVolatility()', () => {
    it('should return low volatility for stable position', () => {
      const winProbs = [50, 51, 50, 49, 50];
      const result = WinProbability.calculatePositionVolatility(winProbs);
      expect(result).toBeLessThan(2);
    });

    it('should return high volatility for tactical position', () => {
      const winProbs = [50, 65, 45, 70, 40];
      const result = WinProbability.calculatePositionVolatility(winProbs);
      expect(result).toBeGreaterThan(5);
    });

    it('should handle single value (return minimum)', () => {
      const winProbs = [50];
      const result = WinProbability.calculatePositionVolatility(winProbs);
      expect(result).toBe(0.5); // Minimum volatility
    });

    it('should clamp volatility to [0.5, 12]', () => {
      const winProbs = [10, 90, 10, 90, 10]; // Very high volatility
      const result = WinProbability.calculatePositionVolatility(winProbs);
      expect(result).toBeLessThanOrEqual(12);
      expect(result).toBeGreaterThanOrEqual(0.5);
    });

    it('should return 0.5 for empty array', () => {
      const winProbs = [];
      const result = WinProbability.calculatePositionVolatility(winProbs);
      expect(result).toBe(0.5);
    });
  });

  describe('calculateGameAccuracy()', () => {
    it('should return 100% for all perfect moves', () => {
      const moveAccuracies = [100, 100, 100, 100];
      const volatilities = [1, 1, 1, 1];
      const result = WinProbability.calculateGameAccuracy(moveAccuracies, volatilities);
      expect(result).toBeCloseTo(100, 0);
    });

    it('should weight volatile positions more heavily', () => {
      const moveAccuracies = [90, 50, 90, 90]; // One bad move
      const lowVolatility = [1, 1, 1, 1];
      const highVolatility = [1, 10, 1, 1]; // Bad move in critical position

      const resultLow = WinProbability.calculateGameAccuracy(moveAccuracies, lowVolatility);
      const resultHigh = WinProbability.calculateGameAccuracy(moveAccuracies, highVolatility);

      // Higher volatility should lower overall accuracy more
      expect(resultHigh).toBeLessThan(resultLow);
    });

    it('should handle all zero volatility (default to 0.5)', () => {
      const moveAccuracies = [90, 85, 95];
      const volatilities = [0, 0, 0];
      const result = WinProbability.calculateGameAccuracy(moveAccuracies, volatilities);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should combine weighted and harmonic means', () => {
      const moveAccuracies = [80, 60, 90];
      const volatilities = [2, 5, 3];
      const result = WinProbability.calculateGameAccuracy(moveAccuracies, volatilities);

      // Should be between simple average (76.6) and harmonic mean (71.7)
      expect(result).toBeGreaterThan(70);
      expect(result).toBeLessThan(80);
    });

    it('should handle single move', () => {
      const moveAccuracies = [85];
      const volatilities = [3];
      const result = WinProbability.calculateGameAccuracy(moveAccuracies, volatilities);
      expect(result).toBeCloseTo(85, 0);
    });

    it('should clamp final result to [0, 100]', () => {
      const moveAccuracies = [120, 150]; // Invalid input
      const volatilities = [1, 1];
      const result = WinProbability.calculateGameAccuracy(moveAccuracies, volatilities);
      expect(result).toBeLessThanOrEqual(100);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shouldClassifyMove()', () => {
    it('should return true for equal position (0 CP)', () => {
      const result = WinProbability.shouldClassifyMove(0, 0);
      expect(result).toBe(true);
    });

    it('should return true for slight advantage (+150 CP)', () => {
      const result = WinProbability.shouldClassifyMove(100, 150);
      expect(result).toBe(true);
    });

    it('should return false for clearly winning (+600 CP)', () => {
      const result = WinProbability.shouldClassifyMove(400, 600);
      expect(result).toBe(false);
    });

    it('should return false for clearly losing (-700 CP)', () => {
      const result = WinProbability.shouldClassifyMove(-500, -700);
      expect(result).toBe(false);
    });

    it('should return true at threshold boundary (500 CP)', () => {
      const result = WinProbability.shouldClassifyMove(300, 500);
      expect(result).toBe(true);
    });

    it('should return false just above threshold (501 CP)', () => {
      const result = WinProbability.shouldClassifyMove(300, 501);
      expect(result).toBe(false);
    });

    it('should handle mate evaluation (10000 CP)', () => {
      const result = WinProbability.shouldClassifyMove(500, 10000);
      expect(result).toBe(false);
    });

    it('should handle position turning from equal to winning', () => {
      const result = WinProbability.shouldClassifyMove(0, 450);
      expect(result).toBe(true); // Still contestable
    });
  });
});
