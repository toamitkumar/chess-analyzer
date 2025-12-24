const PerformanceCalculator = require('../../src/models/performance-stats');

describe('PerformanceCalculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = new PerformanceCalculator();
  });

  describe('calculateWinRate', () => {
    it('should calculate correct win rate', () => {
      const stats = { wins: 7, draws: 2, losses: 1 };
      expect(calculator.calculateWinRate(stats)).toBe(80); // (7 + 2*0.5) / 10 * 100
    });

    it('should return 0 for no games', () => {
      const stats = { wins: 0, draws: 0, losses: 0 };
      expect(calculator.calculateWinRate(stats)).toBe(0);
    });
  });

  describe('calculateAccuracy', () => {
    it('should calculate average accuracy', () => {
      const stats = { accuracy: 850, totalMoves: 10 };
      expect(calculator.calculateAccuracy(stats)).toBe(85);
    });

    it('should return 0 for no moves', () => {
      const stats = { accuracy: 0, totalMoves: 0 };
      expect(calculator.calculateAccuracy(stats)).toBe(0);
    });
  });

  describe('isBlunder', () => {
    it('should detect blunder with large evaluation drop', () => {
      const move = {
        evaluation: { evaluation: -0.5 },
        bestMoveEvaluation: { evaluation: 0.5 }
      };
      expect(calculator.isBlunder(move)).toBe(true);
    });

    it('should not detect blunder with small evaluation drop', () => {
      const move = {
        evaluation: { evaluation: 0.2 },
        bestMoveEvaluation: { evaluation: 0.3 }
      };
      expect(calculator.isBlunder(move)).toBe(false);
    });

    it('should handle missing evaluation data', () => {
      const move = {};
      expect(calculator.isBlunder(move)).toBe(false);
    });
  });

  describe('getMoveAccuracy', () => {
    it('should return high accuracy for good moves', () => {
      const move = {
        evaluation: { evaluation: 0.2 },
        bestMoveEvaluation: { evaluation: 0.3 }
      };
      expect(calculator.getMoveAccuracy(move)).toBe(99);
    });

    it('should return low accuracy for bad moves', () => {
      const move = {
        evaluation: { evaluation: -2.0 },
        bestMoveEvaluation: { evaluation: 0.5 }
      };
      expect(calculator.getMoveAccuracy(move)).toBe(75);
    });

    it('should return 100 for missing evaluation', () => {
      const move = {};
      expect(calculator.getMoveAccuracy(move)).toBe(100);
    });
  });

  describe('updateGameResult', () => {
    it('should update white wins correctly', () => {
      const stats = {
        white: { wins: 0, draws: 0, losses: 0 },
        black: { wins: 0, draws: 0, losses: 0 }
      };
      
      calculator.updateGameResult('1-0', 'white', stats);
      expect(stats.white.wins).toBe(1);
    });

    it('should update black losses when white wins', () => {
      const stats = {
        white: { wins: 0, draws: 0, losses: 0 },
        black: { wins: 0, draws: 0, losses: 0 }
      };
      
      calculator.updateGameResult('1-0', 'black', stats);
      expect(stats.black.losses).toBe(1);
    });

    it('should update draws correctly', () => {
      const stats = {
        white: { wins: 0, draws: 0, losses: 0 },
        black: { wins: 0, draws: 0, losses: 0 }
      };
      
      calculator.updateGameResult('1/2-1/2', 'white', stats);
      expect(stats.white.draws).toBe(1);
    });
  });

  describe('extractPgnHeader', () => {
    it('should extract PGN header information', () => {
      const pgn = `[Event "Test Game"]
[Site "Online"]
[Date "2023.01.01"]
[Round "1"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 1-0`;

      const header = calculator.extractPgnHeader(pgn);
      expect(header.Event).toBe('Test Game');
      expect(header.White).toBe('Player1');
      expect(header.Black).toBe('Player2');
      expect(header.Result).toBe('1-0');
    });
  });
});
