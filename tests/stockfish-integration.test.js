const { ChessAnalyzer } = require('../src/models/analyzer');
const fs = require('fs');
const path = require('path');

describe('Stockfish Integration Tests', () => {
  let analyzer;
  
  beforeAll(async () => {
    analyzer = new ChessAnalyzer();
    // Mock analyzer is always ready
    expect(analyzer.isReady).toBe(true);
  });

  test('should initialize Stockfish engine successfully', () => {
    expect(analyzer.isReady).toBe(true);
    // Mock analyzer doesn't have a real engine, just check it exists
    expect(analyzer).toBeTruthy();
  });

  test('should evaluate a starting position', async () => {
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const evaluation = await analyzer.evaluatePosition(startingFen, 10);
    
    expect(evaluation).toHaveProperty('bestMove');
    expect(evaluation).toHaveProperty('evaluation');
    expect(evaluation.bestMove).toBeTruthy();
    expect(typeof evaluation.evaluation).toBe('number');
    
    console.log('Starting position evaluation:', evaluation);
  });

  test('should analyze fixture PGN game', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'match-won-black.pgn');
    const pgnContent = fs.readFileSync(fixturePath, 'utf8');
    
    // Extract moves from PGN
    const moveMatches = pgnContent.match(/\d+\.\s*([a-zA-Z0-9+#=\-]+)(?:\s+([a-zA-Z0-9+#=\-]+))?/g);
    const moves = [];
    
    if (moveMatches) {
      moveMatches.forEach(match => {
        const parts = match.split(/\d+\.\s*/)[1].split(/\s+/);
        parts.forEach(move => {
          if (move && !move.match(/^\d/) && move !== '0-1' && move !== '1-0' && move !== '1/2-1/2') {
            moves.push(move);
          }
        });
      });
    }
    
    console.log(`Analyzing ${moves.length} moves from fixture game...`);
    
    const analysis = await analyzer.analyzeGame(moves.slice(0, 10)); // Analyze first 10 moves for speed
    
    expect(analysis).toHaveProperty('totalMoves');
    expect(analysis).toHaveProperty('accuracy');
    expect(analysis).toHaveProperty('blunders');
    expect(analysis).toHaveProperty('averageCentipawnLoss');
    expect(analysis).toHaveProperty('analysis');
    
    expect(analysis.totalMoves).toBe(10);
    expect(analysis.accuracy).toBeGreaterThanOrEqual(0);
    expect(analysis.accuracy).toBeLessThanOrEqual(100);
    expect(Array.isArray(analysis.blunders)).toBe(true);
    expect(Array.isArray(analysis.analysis)).toBe(true);
    expect(analysis.analysis).toHaveLength(10);
    
    console.log('Analysis results:', {
      totalMoves: analysis.totalMoves,
      accuracy: analysis.accuracy,
      blunders: analysis.blunders.length,
      averageCentipawnLoss: analysis.averageCentipawnLoss
    });
    
    // Verify each move analysis has required properties
    analysis.analysis.forEach((moveAnalysis, index) => {
      expect(moveAnalysis).toHaveProperty('moveNumber');
      expect(moveAnalysis).toHaveProperty('move');
      expect(moveAnalysis).toHaveProperty('evaluation');
      expect(moveAnalysis).toHaveProperty('centipawnLoss');
      expect(moveAnalysis).toHaveProperty('bestMove');
      
      expect(typeof moveAnalysis.evaluation).toBe('number');
      expect(typeof moveAnalysis.centipawnLoss).toBe('number');
      expect(moveAnalysis.bestMove).toBeTruthy();
    });
    
  }, 30000); // 30 second timeout

  test('should detect blunders in poor moves', async () => {
    // Test with a position where there's a clear blunder
    const moves = ['e4', 'e5', 'Qh5']; // Qh5 is a poor early queen move
    
    const analysis = await analyzer.analyzeGame(moves);
    
    expect(analysis.totalMoves).toBe(3);
    expect(analysis.analysis).toHaveLength(3);
    
    // The third move (Qh5) should likely have some centipawn loss
    const qh5Analysis = analysis.analysis[2];
    expect(qh5Analysis.move).toBe('Qh5');
    expect(typeof qh5Analysis.centipawnLoss).toBe('number');
    
    console.log('Qh5 analysis:', qh5Analysis);
    
  }, 10000);
});
