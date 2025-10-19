const HeatmapCalculator = require('../src/models/HeatmapCalculator');

describe('HeatmapCalculator', () => {
  let calculator;
  let mockGames;

  beforeEach(() => {
    calculator = new HeatmapCalculator();
    mockGames = [
      {
        id: 1,
        blunders: [
          { move: 'Nf3-e5', square: 'e5', severity: 2 },
          { move: 'Qd1-h5', square: 'h5', severity: 1 }
        ]
      },
      {
        id: 2,
        blunders: [
          { move: 'Bc8-g4', square: 'g4', severity: 3 },
          { move: 'Ke8-f7', square: 'f7', severity: 2 },
          { move: 'Nf3-e5', square: 'e5', severity: 1 }
        ]
      }
    ];
  });

  describe('calculateHeatmap', () => {
    test('should calculate blunder frequencies correctly', () => {
      const result = calculator.calculateHeatmap(mockGames);
      
      const e5Square = result.find(s => s.square === 'e5');
      expect(e5Square.count).toBe(2);
      expect(e5Square.severity).toBe(3);
      
      const g4Square = result.find(s => s.square === 'g4');
      expect(g4Square.count).toBe(1);
      expect(g4Square.severity).toBe(3);
    });

    test('should return 64 squares', () => {
      const result = calculator.calculateHeatmap(mockGames);
      expect(result).toHaveLength(64);
    });

    test('should handle games without blunders', () => {
      const gamesWithoutBlunders = [{ id: 1, blunders: [] }];
      const result = calculator.calculateHeatmap(gamesWithoutBlunders);
      
      result.forEach(square => {
        expect(square.count).toBe(0);
        expect(square.intensity).toBe(0);
      });
    });
  });

  describe('extractSquareFromMove', () => {
    test('should extract destination square from move notation', () => {
      expect(calculator.extractSquareFromMove('Nf3-e5')).toBe('e5');
      expect(calculator.extractSquareFromMove('Qd1-h5')).toBe('h5');
      expect(calculator.extractSquareFromMove('O-O')).toBeNull();
    });

    test('should handle null or undefined moves', () => {
      expect(calculator.extractSquareFromMove(null)).toBeNull();
      expect(calculator.extractSquareFromMove(undefined)).toBeNull();
    });
  });

  describe('calculateIntensity', () => {
    test('should calculate intensity based on count and severity', () => {
      expect(calculator.calculateIntensity(2, 3)).toBe(0.6);
      expect(calculator.calculateIntensity(5, 2)).toBe(1);
      expect(calculator.calculateIntensity(0, 0)).toBe(0);
    });

    test('should cap intensity at 1', () => {
      expect(calculator.calculateIntensity(10, 5)).toBe(1);
    });
  });

  describe('getMostProblematicSquares', () => {
    test('should return squares sorted by severity impact', () => {
      calculator.calculateHeatmap(mockGames);
      const problematic = calculator.getMostProblematicSquares(3);
      
      expect(problematic[0].square).toBe('e5');
      expect(problematic[0].count).toBe(2);
      expect(problematic[0].severity).toBe(3);
    });

    test('should respect limit parameter', () => {
      calculator.calculateHeatmap(mockGames);
      const problematic = calculator.getMostProblematicSquares(2);
      expect(problematic).toHaveLength(2);
    });
  });
});
