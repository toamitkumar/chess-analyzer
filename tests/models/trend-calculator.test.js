const TrendCalculator = require('../../src/models/trend-calculator');

describe('TrendCalculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = new TrendCalculator();
  });

  describe('parseDate', () => {
    it('should parse PGN date format correctly', () => {
      const date = calculator.parseDate('2023.01.15');
      expect(date.getFullYear()).toBe(2023);
      expect(date.getMonth()).toBe(0); // January is 0
      expect(date.getDate()).toBe(15);
    });

    it('should handle unknown dates', () => {
      const date = calculator.parseDate('2023.01.??');
      expect(date).toBeInstanceOf(Date);
    });

    it('should handle invalid dates', () => {
      const date = calculator.parseDate('invalid');
      expect(date).toBeInstanceOf(Date);
    });
  });

  describe('calculateGameCentipawnLoss', () => {
    it('should calculate average centipawn loss correctly', () => {
      const moves = [
        {
          evaluation: { evaluation: 0.5 },
          bestMoveEvaluation: { evaluation: 0.2 }
        },
        {
          evaluation: { evaluation: -1.0 },
          bestMoveEvaluation: { evaluation: 0.0 }
        }
      ];

      const loss = calculator.calculateGameCentipawnLoss(moves);
      expect(loss).toBe(100); // Average of 30 and 100 centipawns, but only 100 exceeds threshold
    });

    it('should return 0 for moves without evaluation', () => {
      const moves = [{ san: 'e4' }, { san: 'e5' }];
      const loss = calculator.calculateGameCentipawnLoss(moves);
      expect(loss).toBe(0);
    });

    it('should return 0 for empty moves array', () => {
      const loss = calculator.calculateGameCentipawnLoss([]);
      expect(loss).toBe(0);
    });
  });

  describe('calculateRatingProgression', () => {
    it('should extract and sort rating data', () => {
      const games = [
        { playerRating: '1500', date: '2023.01.15', result: '1-0' },
        { playerRating: '1520', date: '2023.01.10', result: '0-1' },
        { playerRating: '1480', date: '2023.01.20', result: '1/2-1/2' }
      ];

      const progression = calculator.calculateRatingProgression(games);
      
      expect(progression).toHaveLength(3);
      expect(progression[0].rating).toBe(1520); // Earliest date first
      expect(progression[1].rating).toBe(1500);
      expect(progression[2].rating).toBe(1480);
    });

    it('should filter out games without rating data', () => {
      const games = [
        { playerRating: '1500', date: '2023.01.15' },
        { date: '2023.01.16' }, // No rating
        { playerRating: '1520' } // No date
      ];

      const progression = calculator.calculateRatingProgression(games);
      expect(progression).toHaveLength(1);
    });
  });

  describe('calculateCentipawnLossTrend', () => {
    it('should calculate trend data correctly', () => {
      const games = [
        {
          date: '2023.01.15',
          moves: [
            {
              evaluation: { evaluation: 0.5 },
              bestMoveEvaluation: { evaluation: 0.2 }
            }
          ]
        }
      ];

      calculator.calculateGameCentipawnLoss = jest.fn().mockReturnValue(75);
      
      const trend = calculator.calculateCentipawnLossTrend(games);
      
      expect(trend).toHaveLength(1);
      expect(trend[0].avgCentipawnLoss).toBe(75);
      expect(calculator.calculateGameCentipawnLoss).toHaveBeenCalledWith(games[0].moves);
    });
  });

  describe('filterByDateRange', () => {
    it('should filter data by date range', () => {
      const data = [
        { date: new Date('2023-01-10'), value: 1 },
        { date: new Date('2023-01-15'), value: 2 },
        { date: new Date('2023-01-20'), value: 3 }
      ];

      const filtered = calculator.filterByDateRange(data, '2023-01-12', '2023-01-18');
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].value).toBe(2);
    });
  });

  describe('generateMovingAverage', () => {
    it('should calculate moving average correctly', () => {
      const data = [
        { rating: 1500 },
        { rating: 1520 },
        { rating: 1510 },
        { rating: 1530 },
        { rating: 1540 }
      ];

      const result = calculator.generateMovingAverage(data, 3);
      
      expect(result[2].movingAverage).toBe(1510); // (1500+1520+1510)/3
      expect(result[4].movingAverage).toBe(1527); // (1510+1530+1540)/3
    });

    it('should return original data if window size is larger than data', () => {
      const data = [{ rating: 1500 }, { rating: 1520 }];
      const result = calculator.generateMovingAverage(data, 5);
      
      expect(result).toEqual(data);
    });
  });

  describe('extractPgnHeader', () => {
    it('should extract header information correctly', () => {
      const pgn = `[Event "Online Game"]
[Date "2023.01.15"]
[WhiteElo "1500"]
[BlackElo "1520"]
[Result "1-0"]

1. e4 e5 1-0`;

      const header = calculator.extractPgnHeader(pgn);
      
      expect(header.Event).toBe('Online Game');
      expect(header.Date).toBe('2023.01.15');
      expect(header.WhiteElo).toBe('1500');
      expect(header.Result).toBe('1-0');
    });
  });

  describe('generateTrendSummary', () => {
    it('should generate correct trend summary', () => {
      const ratingData = [
        { rating: 1500 },
        { rating: 1520 },
        { rating: 1580 }
      ];
      
      const centipawnData = [
        { avgCentipawnLoss: 80 },
        { avgCentipawnLoss: 70 },
        { avgCentipawnLoss: 60 }
      ];

      const summary = calculator.generateTrendSummary(ratingData, centipawnData);
      
      expect(summary.ratingChange).toBe(80); // 1580 - 1500
      expect(summary.averageCentipawnLoss).toBe(70); // (80+70+60)/3
      expect(summary.improvementTrend).toBe('improving');
      expect(summary.totalGames).toBe(3);
    });

    it('should handle empty data', () => {
      const summary = calculator.generateTrendSummary([], []);
      
      expect(summary.ratingChange).toBe(0);
      expect(summary.averageCentipawnLoss).toBe(0);
      expect(summary.improvementTrend).toBe('stable');
      expect(summary.totalGames).toBe(0);
    });
  });
});
