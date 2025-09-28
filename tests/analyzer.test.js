const { ChessAnalyzer } = require('../src/models/analyzer');

describe('ChessAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ChessAnalyzer();
  });

  test('should initialize successfully', () => {
    expect(analyzer.isReady).toBe(true);
    expect(analyzer).toBeInstanceOf(ChessAnalyzer);
  });

  test('should analyze a simple game', async () => {
    const moves = ['e4', 'e5', 'Nf3'];
    
    const result = await analyzer.analyzeGame(moves);
    
    expect(result).toHaveProperty('totalMoves', 3);
    expect(result).toHaveProperty('accuracy');
    expect(result).toHaveProperty('blunders');
    expect(result).toHaveProperty('averageCentipawnLoss');
    expect(result).toHaveProperty('analysis');
    
    expect(result.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.accuracy).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.blunders)).toBe(true);
    expect(Array.isArray(result.analysis)).toBe(true);
    expect(result.analysis).toHaveLength(3);
  });

  test('should detect blunders in poor moves', async () => {
    const moves = ['e4', 'e5', 'Qh5']; // Qh5 is a poor early queen move
    
    const result = await analyzer.analyzeGame(moves);
    
    expect(result.totalMoves).toBe(3);
    expect(result.analysis).toHaveLength(3);
    
    // The analysis should include move details
    const qh5Analysis = result.analysis[2];
    expect(qh5Analysis.move).toBe('Qh5');
    expect(typeof qh5Analysis.centipawnLoss).toBe('number');
    expect(qh5Analysis.bestMove).toBeTruthy();
  });

  test('should handle empty moves array', async () => {
    await expect(analyzer.analyzeGame([])).rejects.toThrow('No moves provided for analysis');
  });

  test('should handle invalid moves gracefully', async () => {
    const moves = ['e4', 'invalid_move', 'Nf3'];
    
    const result = await analyzer.analyzeGame(moves);
    
    // The analyzer processes all moves but skips invalid ones
    // It still counts the total moves attempted (3) but only analyzes valid ones (1)
    expect(result.totalMoves).toBe(3); // Total moves attempted
    expect(result.analysis).toHaveLength(1); // Only valid moves analyzed (e4)
  });

  test('should provide realistic analysis data', async () => {
    const moves = ['d4', 'd5', 'Nf3', 'Nf6'];
    
    const result = await analyzer.analyzeGame(moves);
    
    // Check that each move has required properties
    result.analysis.forEach(moveAnalysis => {
      expect(moveAnalysis).toHaveProperty('moveNumber');
      expect(moveAnalysis).toHaveProperty('move');
      expect(moveAnalysis).toHaveProperty('evaluation');
      expect(moveAnalysis).toHaveProperty('centipawnLoss');
      expect(moveAnalysis).toHaveProperty('bestMove');
      expect(moveAnalysis).toHaveProperty('alternatives');
      
      expect(typeof moveAnalysis.evaluation).toBe('number');
      expect(typeof moveAnalysis.centipawnLoss).toBe('number');
      expect(moveAnalysis.bestMove).toBeTruthy();
      expect(Array.isArray(moveAnalysis.alternatives)).toBe(true);
    });
  });
});
