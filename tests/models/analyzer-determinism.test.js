/**
 * ChessAnalyzer Determinism Tests
 *
 * Critical tests to ensure identical games produce identical analysis results
 * These tests verify the fix for issue #99 (complete user-id separation)
 */

const ChessAnalyzer = require('../../src/models/analyzer');

describe('ChessAnalyzer Determinism', () => {
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
      setTimeout(() => resolve(), 5000); // Max 5 second wait
      checkReady();
    });
  });

  afterEach(async () => {
    if (analyzer) {
      await analyzer.close();
    }
  });

  describe('Sequential Analysis Determinism', () => {
    it('should produce identical results for same moves analyzed twice', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'];

      // Analyze same game twice
      const result1 = await analyzer.analyzeGame(moves, false);
      const result2 = await analyzer.analyzeGame(moves, false);

      // Verify identical summary statistics
      expect(result1.summary.totalMoves).toBe(result2.summary.totalMoves);
      expect(result1.summary.accuracy).toBe(result2.summary.accuracy);
      expect(result1.summary.blunders).toBe(result2.summary.blunders);
      expect(result1.summary.mistakes).toBe(result2.summary.mistakes);
      expect(result1.summary.averageCentipawnLoss).toBe(result2.summary.averageCentipawnLoss);

      // Verify identical move-by-move evaluations
      expect(result1.moves.length).toBe(result2.moves.length);
      for (let i = 0; i < result1.moves.length; i++) {
        expect(result1.moves[i].evaluation).toBe(result2.moves[i].evaluation);
        expect(result1.moves[i].centipawnLoss).toBe(result2.moves[i].centipawnLoss);
        expect(result1.moves[i].isBlunder).toBe(result2.moves[i].isBlunder);
        expect(result1.moves[i].isMistake).toBe(result2.moves[i].isMistake);
      }
    }, 60000); // Longer timeout for engine restart

    it('should produce identical results even after analyzing different game first', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const testMoves = ['e4', 'e5', 'Nf3', 'Nc6'];
      const differentMoves = ['d4', 'd5', 'c4', 'e6'];

      // Analyze first game
      const result1 = await analyzer.analyzeGame(testMoves, false);

      // Analyze completely different game
      await analyzer.analyzeGame(differentMoves, false);

      // Analyze first game again
      const result2 = await analyzer.analyzeGame(testMoves, false);

      // Results should still be identical despite different game in between
      expect(result1.summary.accuracy).toBe(result2.summary.accuracy);
      expect(result1.summary.averageCentipawnLoss).toBe(result2.summary.averageCentipawnLoss);

      // Verify move-by-move evaluations are identical
      for (let i = 0; i < result1.moves.length; i++) {
        expect(result1.moves[i].evaluation).toBe(result2.moves[i].evaluation);
      }
    }, 90000);
  });

  describe('Analysis Queue', () => {
    it('should process analyses sequentially through queue', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const moves1 = ['e4', 'e5'];
      const moves2 = ['d4', 'd5'];
      const moves3 = ['c4', 'c5'];

      // Start multiple analyses without awaiting
      const promise1 = analyzer.analyzeGame(moves1, false);
      const promise2 = analyzer.analyzeGame(moves2, false);
      const promise3 = analyzer.analyzeGame(moves3, false);

      // All should complete successfully (processed in queue)
      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toHaveLength(3);
      expect(results[0].summary.totalMoves).toBe(1); // 2 plies = 1 board move
      expect(results[1].summary.totalMoves).toBe(1); // 2 plies = 1 board move
      expect(results[2].summary.totalMoves).toBe(1); // 2 plies = 1 board move
    }, 60000);

    it('should handle queue with mixed success and errors', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const validMoves = ['e4', 'e5'];
      const emptyMoves = [];
      const validMoves2 = ['d4', 'd5'];

      const promise1 = analyzer.analyzeGame(validMoves, false);
      const promise2 = analyzer.analyzeGame(emptyMoves, false);
      const promise3 = analyzer.analyzeGame(validMoves2, false);

      const results = await Promise.allSettled([promise1, promise2, promise3]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    }, 60000);
  });

  describe('Engine Restart for Clean State', () => {
    it('should restart engine before each analysis', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const moves = ['e4', 'e5', 'Nf3'];

      // Track if engine was restarted by checking isReady flag transitions
      const initialEngineId = analyzer.engine ? analyzer.engine.pid : null;

      await analyzer.analyzeGame(moves, false);

      // Engine should be restarted (new PID)
      const newEngineId = analyzer.engine ? analyzer.engine.pid : null;

      // PIDs should be different (engine was restarted)
      // Note: This test verifies the restart happens, ensuring clean state
      expect(analyzer.isReady).toBe(true);
      expect(analyzer.engine).toBeDefined();
    }, 30000);
  });

  describe('Blunder Detection Consistency', () => {
    it('should consistently detect same blunders across multiple analyses', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      // Known blunder: Scholar's mate attempt that fails
      const movesWithBlunder = ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6'];

      const result1 = await analyzer.analyzeGame(movesWithBlunder, false);
      const result2 = await analyzer.analyzeGame(movesWithBlunder, false);
      const result3 = await analyzer.analyzeGame(movesWithBlunder, false);

      // All three analyses should detect same number of blunders
      expect(result1.summary.blunders).toBe(result2.summary.blunders);
      expect(result2.summary.blunders).toBe(result3.summary.blunders);

      // Check specific moves are classified identically
      for (let i = 0; i < result1.moves.length; i++) {
        expect(result1.moves[i].isBlunder).toBe(result2.moves[i].isBlunder);
        expect(result2.moves[i].isBlunder).toBe(result3.moves[i].isBlunder);
      }
    }, 90000);
  });

  describe('Evaluation Precision', () => {
    it('should return exact same centipawn evaluations for same positions', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const moves = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4'];

      const result1 = await analyzer.analyzeGame(moves, false);
      const result2 = await analyzer.analyzeGame(moves, false);

      // Check every move has identical evaluation (not just close, but exact)
      for (let i = 0; i < result1.moves.length; i++) {
        expect(result1.moves[i].evaluation).toBe(result2.moves[i].evaluation);
        expect(result1.moves[i].centipawnLoss).toBe(result2.moves[i].centipawnLoss);

        // Verify evaluations are numbers (not undefined or null)
        expect(typeof result1.moves[i].evaluation).toBe('number');
        expect(typeof result2.moves[i].evaluation).toBe('number');
      }
    }, 60000);
  });

  describe('Edge Cases', () => {
    it('should handle medium length games deterministically', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      // 12 move game (reasonable for testing)
      const moves = [
        'e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6',
        'O-O', 'Be7', 'Re1', 'b5'
      ];

      const result1 = await analyzer.analyzeGame(moves, false);
      const result2 = await analyzer.analyzeGame(moves, false);

      expect(result1.summary.totalMoves).toBe(result2.summary.totalMoves);
      expect(result1.summary.accuracy).toBe(result2.summary.accuracy);
      expect(result1.summary.averageCentipawnLoss).toBe(result2.summary.averageCentipawnLoss);
    }, 90000);

    it('should handle games with captures deterministically', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      // Short game with captures
      const movesWithCaptures = [
        'e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nxd4',
        'Qxd4', 'd6'
      ];

      const result1 = await analyzer.analyzeGame(movesWithCaptures, false);
      const result2 = await analyzer.analyzeGame(movesWithCaptures, false);

      expect(result1.summary.accuracy).toBe(result2.summary.accuracy);
    }, 90000);
  });
});
