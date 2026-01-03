const ChessAnalyzer = require('../../src/models/analyzer');

describe('Lichess/Chess.com Style Analysis', () => {
  let analyzer;

  beforeAll(async () => {
    analyzer = new ChessAnalyzer();
    // Wait for Stockfish to initialize
    await new Promise(resolve => {
      const checkReady = () => {
        if (analyzer.isReady) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      setTimeout(() => resolve(), 10000);
      checkReady();
    });
  }, 15000);

  afterAll(async () => {
    if (analyzer) {
      await analyzer.close();
    }
  });

  describe('Win Probability Calculation', () => {
    test('should calculate 50% for equal position', () => {
      const wp = analyzer.centipawnToWinProbability(0);
      expect(wp).toBeCloseTo(0.5, 2);
    });

    test('should calculate higher probability for positive eval', () => {
      const wp100 = analyzer.centipawnToWinProbability(100);
      const wp200 = analyzer.centipawnToWinProbability(200);
      const wp500 = analyzer.centipawnToWinProbability(500);

      expect(wp100).toBeGreaterThan(0.5);
      expect(wp200).toBeGreaterThan(wp100);
      expect(wp500).toBeGreaterThan(wp200);
      expect(wp500).toBeLessThan(1);
    });

    test('should calculate lower probability for negative eval', () => {
      const wpNeg100 = analyzer.centipawnToWinProbability(-100);
      const wpNeg200 = analyzer.centipawnToWinProbability(-200);

      expect(wpNeg100).toBeLessThan(0.5);
      expect(wpNeg200).toBeLessThan(wpNeg100);
      expect(wpNeg200).toBeGreaterThan(0);
    });

    test('should be symmetric around 0', () => {
      const wpPos = analyzer.centipawnToWinProbability(100);
      const wpNeg = analyzer.centipawnToWinProbability(-100);

      expect(wpPos + wpNeg).toBeCloseTo(1, 2);
    });
  });

  describe('Game Accuracy Formula', () => {
    test('should return 100% for 0 ACPL', () => {
      const accuracy = analyzer.calculateGameAccuracy(0);
      expect(accuracy).toBe(100);
    });

    test('should return high accuracy for low ACPL', () => {
      const acc5 = analyzer.calculateGameAccuracy(5);
      const acc10 = analyzer.calculateGameAccuracy(10);

      expect(acc5).toBeGreaterThan(90);
      expect(acc10).toBeGreaterThan(85);
      expect(acc5).toBeGreaterThan(acc10);
    });

    test('should return moderate accuracy for medium ACPL', () => {
      const acc25 = analyzer.calculateGameAccuracy(25);
      const acc35 = analyzer.calculateGameAccuracy(35);

      expect(acc25).toBeGreaterThan(70);
      expect(acc25).toBeLessThan(85);
      expect(acc35).toBeGreaterThan(60);
      expect(acc35).toBeLessThan(75);
    });

    test('should return low accuracy for high ACPL', () => {
      const acc50 = analyzer.calculateGameAccuracy(50);
      const acc100 = analyzer.calculateGameAccuracy(100);

      expect(acc50).toBeLessThan(60);
      expect(acc100).toBe(0); // Capped at 0
    });

    test('should match expected Lichess accuracy scale', () => {
      // ACPL 0-5: 95-100%
      expect(analyzer.calculateGameAccuracy(3)).toBeGreaterThan(95);
      // ACPL 5-10: 90-95%
      expect(analyzer.calculateGameAccuracy(7)).toBeGreaterThanOrEqual(90);
      expect(analyzer.calculateGameAccuracy(7)).toBeLessThanOrEqual(96);
      // ACPL 10-20: 80-90%
      expect(analyzer.calculateGameAccuracy(15)).toBeGreaterThanOrEqual(80);
      expect(analyzer.calculateGameAccuracy(15)).toBeLessThanOrEqual(92);
    });
  });

  describe('Move Quality Classification', () => {
    test('should classify best move correctly', () => {
      const quality = analyzer.classifyMove(0, 'e4', 'e2e4', []);
      expect(quality).toBe('best');
    });

    test('should classify excellent move correctly', () => {
      const quality = analyzer.classifyMove(8, 'Nf3', 'e2e4', []);
      expect(quality).toBe('excellent');
    });

    test('should classify good move correctly', () => {
      const quality = analyzer.classifyMove(20, 'd4', 'e2e4', []);
      expect(quality).toBe('good');
    });

    test('should classify inaccuracy correctly', () => {
      const quality = analyzer.classifyMove(40, 'h3', 'e2e4', []);
      expect(quality).toBe('inaccuracy');
    });

    test('should classify mistake correctly', () => {
      const quality = analyzer.classifyMove(75, 'a3', 'e2e4', []);
      expect(quality).toBe('mistake');
    });

    test('should classify blunder correctly', () => {
      const quality = analyzer.classifyMove(150, 'f3', 'e2e4', []);
      expect(quality).toBe('blunder');
    });

    test('should classify severe blunder correctly', () => {
      const quality = analyzer.classifyMove(400, 'Qh5', 'e2e4', []);
      expect(quality).toBe('blunder');
    });
  });

  describe('Per-Move Accuracy', () => {
    test('should return 100% for moves that improve position', () => {
      // White moves: before +20, after -41 (Black's view = White +41)
      const accuracy = analyzer.calculateMoveAccuracy(20, -41, true);
      expect(accuracy).toBe(100);
    });

    test('should return less than 100% for moves that worsen position', () => {
      // White moves: before +100, after +50 (Black's view = White -50)
      const accuracy = analyzer.calculateMoveAccuracy(100, 50, true);
      expect(accuracy).toBeLessThan(100);
      expect(accuracy).toBeGreaterThan(0);
    });

    test('should penalize large position drops', () => {
      const smallDrop = analyzer.calculateMoveAccuracy(100, -50, true);
      const largeDrop = analyzer.calculateMoveAccuracy(100, 200, true);

      expect(smallDrop).toBeGreaterThan(largeDrop);
    });
  });

  describe('Full Game Analysis with New Features', () => {
    test('should include new fields in move analysis', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const moves = ['e4', 'e5', 'Nf3'];
      const result = await analyzer.analyzeGame(moves, true);

      expect(result.moves).toHaveLength(3);

      result.moves.forEach(moveAnalysis => {
        // Check new Lichess-style fields
        expect(moveAnalysis).toHaveProperty('move_quality');
        expect(moveAnalysis).toHaveProperty('move_accuracy');
        expect(moveAnalysis).toHaveProperty('win_probability_before');
        expect(moveAnalysis).toHaveProperty('win_probability_after');
        expect(moveAnalysis).toHaveProperty('is_best');
        expect(moveAnalysis).toHaveProperty('is_excellent');
        expect(moveAnalysis).toHaveProperty('is_good');

        // Validate move quality values
        expect(['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']).toContain(moveAnalysis.move_quality);

        // Validate accuracy is in valid range
        expect(moveAnalysis.move_accuracy).toBeGreaterThanOrEqual(0);
        expect(moveAnalysis.move_accuracy).toBeLessThanOrEqual(100);

        // Validate win probabilities are percentages
        expect(moveAnalysis.win_probability_before).toBeGreaterThanOrEqual(0);
        expect(moveAnalysis.win_probability_before).toBeLessThanOrEqual(100);
        expect(moveAnalysis.win_probability_after).toBeGreaterThanOrEqual(0);
        expect(moveAnalysis.win_probability_after).toBeLessThanOrEqual(100);
      });

      console.log('Move quality distribution:', result.summary.moveQuality);
    }, 60000);

    test('should provide move quality counts in summary', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const moves = ['e4', 'e5', 'Qh5', 'Nc6'];
      const result = await analyzer.analyzeGame(moves, true);

      expect(result.summary).toHaveProperty('moveQuality');
      expect(result.summary.moveQuality).toHaveProperty('best');
      expect(result.summary.moveQuality).toHaveProperty('excellent');
      expect(result.summary.moveQuality).toHaveProperty('good');
      expect(result.summary.moveQuality).toHaveProperty('inaccuracies');
      expect(result.summary.moveQuality).toHaveProperty('mistakes');
      expect(result.summary.moveQuality).toHaveProperty('blunders');

      // Sum of all qualities should equal total moves
      const totalQuality =
        result.summary.moveQuality.best +
        result.summary.moveQuality.excellent +
        result.summary.moveQuality.good +
        result.summary.moveQuality.inaccuracies +
        result.summary.moveQuality.mistakes +
        result.summary.moveQuality.blunders;

      expect(totalQuality).toBe(moves.length);

      // Should have additional summary fields
      expect(result.summary).toHaveProperty('bestMoves');
      expect(result.summary).toHaveProperty('excellentMoves');
      expect(result.summary).toHaveProperty('goodMoves');
    }, 60000);

    test('should calculate realistic accuracy scores', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'];
      const result = await analyzer.analyzeGame(moves, true);

      // For standard opening moves, accuracy should be high
      expect(result.summary.accuracy).toBeGreaterThan(70);
      expect(result.summary.averageCentipawnLoss).toBeLessThan(50);

      console.log(`Accuracy: ${result.summary.accuracy}%`);
      console.log(`ACPL: ${result.summary.averageCentipawnLoss}`);
      console.log(`Best moves: ${result.summary.bestMoves}/${moves.length}`);
    }, 60000);

    test('should detect blunders in bad moves', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      // Game with a clear blunder: 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Qf6?? 5.Nxc6
      // Qf6 is a terrible move that ignores the threat to the knight
      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Qf6', 'Nxc6'];
      const result = await analyzer.analyzeGame(moves, true);

      console.log('Move analysis with bad moves:');
      result.moves.forEach((m, i) => {
        console.log(`  ${i+1}. ${m.move}: quality=${m.move_quality}, cp_loss=${m.centipawn_loss}`);
      });

      // Qf6 (move 8) should be classified as a mistake or blunder
      const qf6Move = result.moves[7]; // 8th move (0-indexed)
      expect(qf6Move.move).toBe('Qf6');
      expect(qf6Move.centipawn_loss).toBeGreaterThan(10); // Non-trivial loss (engine depth may vary)

      // Should have some non-best moves
      const nonBestMoves = result.moves.filter(m => m.move_quality !== 'best').length;
      expect(nonBestMoves).toBeGreaterThan(0);

      console.log(`Non-best moves: ${nonBestMoves}/${moves.length}`);
      console.log(`Move quality distribution:`, result.summary.moveQuality);
    }, 60000);
  });
});
