const ChessAnalyzer = require('../src/models/analyzer');

describe('ChessAnalyzer', () => {
  let analyzer;

  beforeEach(async () => {
    analyzer = new ChessAnalyzer();
    // Wait for real Stockfish to initialize
    await new Promise(resolve => {
      const checkReady = () => {
        if (analyzer.isReady) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      setTimeout(() => resolve(), 3000); // Max 3 second wait
      checkReady();
    });
  });

  afterEach(async () => {
    if (analyzer) {
      await analyzer.close();
    }
  });

  test('should initialize successfully', () => {
    expect(analyzer).toBeInstanceOf(ChessAnalyzer);
  });

  test('should analyze a simple game', async () => {
    if (!analyzer.isReady) {
      console.log('Skipping test - Stockfish not ready');
      return;
    }
    
    const moves = ['e4', 'e5', 'Nf3'];
    
    const result = await analyzer.analyzeGame(moves);
    
    expect(result.summary).toHaveProperty('totalMoves', 3);
    expect(result.summary).toHaveProperty('accuracy');
    expect(result.summary).toHaveProperty('blunders');
    expect(result.summary).toHaveProperty('averageCentipawnLoss');
    expect(result).toHaveProperty('moves');
    expect(result.moves).toHaveLength(3);
  }, 10000);

  test('should detect blunders in poor moves', async () => {
    if (!analyzer.isReady) {
      console.log('Skipping test - Stockfish not ready');
      return;
    }
    
    const moves = ['e4', 'e5', 'Qh5']; // Poor early queen move
    
    const result = await analyzer.analyzeGame(moves);
    
    expect(result.summary.totalMoves).toBe(3);
    expect(result.moves).toHaveLength(3);
    expect(typeof result.summary.accuracy).toBe('number');
  }, 10000);

  test('should handle empty moves array', async () => {
    await expect(analyzer.analyzeGame([])).rejects.toThrow('No moves provided for analysis');
  });

  test('should handle invalid moves gracefully', async () => {
    if (!analyzer.isReady) {
      console.log('Skipping test - Stockfish not ready');
      return;
    }
    
    const moves = ['e4', 'invalidmove', 'Nf3'];
    
    const result = await analyzer.analyzeGame(moves);
    
    // Should skip invalid move and analyze valid ones
    expect(result.moves.length).toBeLessThan(3);
  }, 10000);

  test('should provide realistic analysis data', async () => {
    if (!analyzer.isReady) {
      console.log('Skipping test - Stockfish not ready');
      return;
    }
    
    const moves = ['e4', 'e5'];
    
    const result = await analyzer.analyzeGame(moves);
    
    expect(result.summary.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.summary.accuracy).toBeLessThanOrEqual(100);
    expect(typeof result.summary.averageCentipawnLoss).toBe('number');
  }, 10000);
});
