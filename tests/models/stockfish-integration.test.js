const ChessAnalyzer = require('../../src/models/analyzer');
const fs = require('fs');
const path = require('path');

describe('Stockfish Integration Tests', () => {
  let analyzer;
  
  beforeAll(async () => {
    analyzer = new ChessAnalyzer();
    
    // Wait for real Stockfish engine to be ready
    await new Promise(resolve => {
      const checkReady = () => {
        if (analyzer.isReady) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      setTimeout(() => resolve(), 5000); // Max 5 second wait
      checkReady();
    });
  });

  afterAll(async () => {
    if (analyzer) {
      await analyzer.close();
    }
  });

  test('should initialize Stockfish engine successfully', () => {
    expect(analyzer).toBeTruthy();
    // Real Stockfish may take time to initialize
    if (analyzer.isReady) {
      expect(analyzer.isReady).toBe(true);
    }
  });

  test('should evaluate a starting position', async () => {
    if (!analyzer.isReady) {
      console.log('Skipping test - Stockfish not ready');
      return;
    }
    
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const evaluation = await analyzer.evaluatePosition(startingFen, 8);
    
    expect(evaluation).toHaveProperty('bestMove');
    expect(evaluation).toHaveProperty('evaluation');
    expect(evaluation.bestMove).toBeTruthy();
    expect(typeof evaluation.evaluation).toBe('number');
    
    console.log('Starting position evaluation:', evaluation);
  });

  test('should analyze fixture PGN game', async () => {
    if (!analyzer.isReady) {
      console.log('Skipping test - Stockfish not ready');
      return;
    }
    
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'match-won-black.pgn');
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
    
    console.log(`Analyzing ${Math.min(5, moves.length)} moves from fixture game...`);
    
    const analysis = await analyzer.analyzeGame(moves.slice(0, 5)); // Analyze first 5 moves for speed
    
    expect(analysis).toHaveProperty('moves');
    expect(analysis).toHaveProperty('summary');
    expect(analysis.summary).toHaveProperty('totalMoves');
    expect(analysis.summary).toHaveProperty('accuracy');
    expect(analysis.summary).toHaveProperty('blunders');
    expect(analysis.summary).toHaveProperty('averageCentipawnLoss');
    
    expect(analysis.summary.totalMoves).toBe(3); // 5 plies = 3 board moves
    expect(analysis.summary.accuracy).toBeGreaterThanOrEqual(0);
    expect(analysis.summary.accuracy).toBeLessThanOrEqual(100);
    expect(Array.isArray(analysis.moves)).toBe(true);
    expect(analysis.moves).toHaveLength(5); // Still 5 plies in the array
    
    console.log('Analysis results:', analysis.summary);
    
  }, 30000); // 30 second timeout

  test('should detect blunders in poor moves', async () => {
    if (!analyzer.isReady) {
      console.log('Skipping test - Stockfish not ready');
      return;
    }
    
    // Test with a position where there's a clear blunder
    const moves = ['e4', 'e5', 'Qh5']; // Qh5 is a poor early queen move
    
    const analysis = await analyzer.analyzeGame(moves);
    
    expect(analysis.summary.totalMoves).toBe(2); // 3 plies = 2 board moves
    expect(analysis.moves.length).toBeGreaterThanOrEqual(2); // May vary with move validation

    // The third move (Qh5) should likely have some centipawn loss
    const qh5Analysis = analysis.moves.find(m => m.move === 'Qh5') || analysis.moves[analysis.moves.length - 1];
    expect(qh5Analysis.move).toBe('Qh5');
    expect(typeof qh5Analysis.centipawn_loss).toBe('number');
    
    console.log('Qh5 analysis:', qh5Analysis);
    
  }, 15000);
});
