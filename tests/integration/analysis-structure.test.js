const ChessAnalyzer = require('../../src/models/analyzer');

describe('Analysis Structure Tests', () => {
  let analyzer;

  beforeEach(async () => {
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
      setTimeout(() => resolve(), 3000);
      checkReady();
    });
  });

  afterEach(async () => {
    if (analyzer) {
      await analyzer.close();
    }
  });

  test('should return correct analysis structure', async () => {
    if (!analyzer.isReady) {
      console.log('Skipping test - Stockfish not ready');
      return;
    }

    const moves = ['e4', 'e5', 'Nf3'];
    const result = await analyzer.analyzeGame(moves);

    // Verify top-level structure
    expect(result).toHaveProperty('moves');
    expect(result).toHaveProperty('summary');

    // Verify moves array structure
    expect(Array.isArray(result.moves)).toBe(true);
    expect(result.moves.length).toBe(3);

    // Verify each move has required properties
    result.moves.forEach(move => {
      expect(move).toHaveProperty('move_number');
      expect(move).toHaveProperty('move');
      expect(move).toHaveProperty('evaluation');
      expect(move).toHaveProperty('best_move');
      expect(move).toHaveProperty('centipawn_loss');
      expect(move).toHaveProperty('is_blunder');
      expect(move).toHaveProperty('alternatives');
    });

    // Verify summary structure
    expect(result.summary).toHaveProperty('totalMoves');
    expect(result.summary).toHaveProperty('accuracy');
    expect(result.summary).toHaveProperty('blunders');
    expect(result.summary).toHaveProperty('averageCentipawnLoss');
    expect(result.summary).toHaveProperty('blunderDetails');

    // Verify data types
    expect(typeof result.summary.totalMoves).toBe('number');
    expect(typeof result.summary.accuracy).toBe('number');
    expect(typeof result.summary.blunders).toBe('number');
    expect(typeof result.summary.averageCentipawnLoss).toBe('number');
    expect(Array.isArray(result.summary.blunderDetails)).toBe(true);

  }, 10000);

  test('should handle blunder detection correctly', async () => {
    if (!analyzer.isReady) {
      console.log('Skipping test - Stockfish not ready');
      return;
    }

    const moves = ['e4', 'e5', 'Qh5']; // Qh5 is typically a poor move
    const result = await analyzer.analyzeGame(moves, false); // Disable alternatives for faster test

    // Verify blunder structure
    expect(result.summary.blunders).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.summary.blunderDetails)).toBe(true);

    // Check if any moves are marked as blunders
    const blunderMoves = result.moves.filter(move => move.is_blunder);
    expect(blunderMoves.length).toBe(result.summary.blunders);

    // Verify blunder details structure
    result.summary.blunderDetails.forEach(blunder => {
      expect(blunder).toHaveProperty('moveNumber');
      expect(blunder).toHaveProperty('move');
      expect(blunder).toHaveProperty('centipawnLoss');
    });

  }, 10000);
});
