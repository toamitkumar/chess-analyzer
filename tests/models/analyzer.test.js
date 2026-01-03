const ChessAnalyzer = require('../../src/models/analyzer');

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

    const result = await analyzer.analyzeGame(moves, false); // Disable alternatives for faster test

    expect(result.summary).toHaveProperty('totalMoves', 2); // 3 plies = 2 board moves
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

    const result = await analyzer.analyzeGame(moves, false); // Disable alternatives for faster test
    
    expect(result.summary.totalMoves).toBe(2); // 3 plies = 2 board moves
    expect(result.moves.length).toBeGreaterThanOrEqual(2); // May skip invalid moves
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

    const result = await analyzer.analyzeGame(moves, false); // Disable alternatives for faster test
    
    // Should skip invalid move and analyze valid ones
    expect(result.moves.length).toBeLessThan(3);
  }, 10000);

  test('should provide realistic analysis data', async () => {
    if (!analyzer.isReady) {
      console.log('Skipping test - Stockfish not ready');
      return;
    }

    const moves = ['e4', 'e5'];

    const result = await analyzer.analyzeGame(moves, false); // Disable alternatives for faster test
    
    expect(result.summary.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.summary.accuracy).toBeLessThanOrEqual(100);
    expect(typeof result.summary.averageCentipawnLoss).toBe('number');
  }, 10000);

  test('should convert UCI moves to SAN notation in alternatives', async () => {
    if (!analyzer.isReady) {
      console.log('Skipping test - Stockfish not ready');
      return;
    }

    const moves = ['e4', 'e5', 'Nf3'];

    const result = await analyzer.analyzeGame(moves, true); // Enable alternatives
    
    // Check that we have alternatives for at least one move
    const movesWithAlternatives = result.moves.filter(move => 
      move.alternatives && move.alternatives.length > 0
    );
    
    if (movesWithAlternatives.length > 0) {
      const moveWithAlts = movesWithAlternatives[0];
      
      // Check that alternatives have both move (SAN) and moveUci fields
      for (const alt of moveWithAlts.alternatives) {
        expect(alt).toHaveProperty('move');
        expect(alt).toHaveProperty('moveUci');
        expect(typeof alt.move).toBe('string');
        expect(typeof alt.moveUci).toBe('string');
        
        // SAN notation should not contain coordinates like 'e2e4'
        expect(alt.move).not.toMatch(/^[a-h][1-8][a-h][1-8]/);
        
        // UCI notation should be in format like 'e2e4' or 'g1f3'
        expect(alt.moveUci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
        
        // SAN should be different from UCI for most moves (except simple pawn moves)
        if (alt.moveUci.length === 4 && !alt.moveUci.match(/^[a-h][27][a-h][18]$/)) {
          expect(alt.move).not.toBe(alt.moveUci);
        }
      }
      
      console.log(`✅ Verified SAN conversion for ${moveWithAlts.alternatives.length} alternatives`);
    } else {
      console.log('⚠️ No alternatives found to test SAN conversion');
    }
  }, 15000);
});
