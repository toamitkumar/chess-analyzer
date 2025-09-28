const PerformanceCalculator = require('../src/models/performance-stats');

describe('Unit Tests', () => {
  let calculator;

  beforeEach(() => {
    calculator = new PerformanceCalculator();
  });

  describe('PerformanceCalculator', () => {
    test('calculateWinRate works correctly', () => {
      const stats = { wins: 7, draws: 2, losses: 1 };
      expect(calculator.calculateWinRate(stats)).toBe(80);
    });

    test('calculateAccuracy works correctly', () => {
      const stats = { accuracy: 850, totalMoves: 10 };
      expect(calculator.calculateAccuracy(stats)).toBe(85);
    });

    test('isBlunder detects large evaluation drops', () => {
      const move = {
        evaluation: { evaluation: -0.5 },
        bestMoveEvaluation: { evaluation: 0.5 }
      };
      expect(calculator.isBlunder(move)).toBe(true);
    });

    test('extractPgnHeader parses correctly', () => {
      const pgn = `[Event "Test"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]`;
      
      const header = calculator.extractPgnHeader(pgn);
      expect(header.Event).toBe('Test');
      expect(header.Result).toBe('1-0');
    });

    test('updateGameResult updates stats correctly', () => {
      const stats = {
        white: { wins: 0, draws: 0, losses: 0 },
        black: { wins: 0, draws: 0, losses: 0 }
      };
      
      calculator.updateGameResult('1-0', 'white', stats);
      expect(stats.white.wins).toBe(1);
    });
  });
});
