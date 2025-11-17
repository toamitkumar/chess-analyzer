const ChessAnalyzer = require('../src/models/analyzer');
const PGNParser = require('../src/models/PGNParser');
const { getDatabase } = require('../src/models/database');
const fs = require('fs');
const path = require('path');

describe('Alternative Moves Analysis', () => {
  let analyzer;
  let database;
  const TIMEOUT = 120000; // 2 minutes for heavy tests

  beforeAll(async () => {
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
      setTimeout(() => resolve(), 10000); // Max 10 second wait
      checkReady();
    });

    // Initialize database for storage tests
    database = getDatabase();
    await database.initialize();
  }, 15000);

  afterAll(async () => {
    if (analyzer) {
      await analyzer.close();
    }
    if (database) {
      await database.close();
    }
  });

  describe('generateAlternatives()', () => {
    test('should fetch up to 10 alternatives for a position', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      // Starting position FEN
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const alternatives = await analyzer.generateAlternatives(startingFen, 10, 10);

      expect(alternatives).toBeInstanceOf(Array);
      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives.length).toBeLessThanOrEqual(10);

      // Check structure of each alternative
      alternatives.forEach((alt, index) => {
        expect(alt).toHaveProperty('move');
        expect(alt).toHaveProperty('evaluation');
        expect(alt).toHaveProperty('depth');
        expect(alt).toHaveProperty('line');
        expect(alt.line).toBeInstanceOf(Array);
        expect(alt.line.length).toBeLessThanOrEqual(5);
        console.log(`Alternative ${index + 1}: ${alt.move} (eval: ${alt.evaluation}, depth: ${alt.depth})`);
      });

      // First alternative should be the best move (rank 1)
      expect(alternatives[0].rank).toBe(1);
    }, 30000);

    test('should handle complex middlegame positions', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      // Complex middlegame position
      const complexFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
      const alternatives = await analyzer.generateAlternatives(complexFen, 10, 10);

      expect(alternatives.length).toBeGreaterThan(3);
      console.log(`Found ${alternatives.length} alternatives for complex position`);

      // Verify all moves are valid UCI format
      alternatives.forEach(alt => {
        expect(alt.move).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
      });
    }, 30000);

    test('should return sorted by rank', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const alternatives = await analyzer.generateAlternatives(fen, 10, 10);

      // Check ranks are in order
      for (let i = 1; i < alternatives.length; i++) {
        expect(alternatives[i].rank).toBeGreaterThanOrEqual(alternatives[i - 1].rank);
      }
    }, 30000);

    test('should handle positions with few legal moves', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      // Position with limited moves (endgame)
      const endgameFen = '8/8/8/8/8/5k2/8/4K2R w - - 0 1';
      const alternatives = await analyzer.generateAlternatives(endgameFen, 10, 10);

      expect(alternatives.length).toBeGreaterThan(0);
      console.log(`Found ${alternatives.length} alternatives in endgame position`);
    }, 30000);
  });

  describe('analyzeGame() with alternatives', () => {
    test('should include alternatives in move analysis', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const moves = ['e4', 'e5', 'Nf3', 'Nc6'];
      const result = await analyzer.analyzeGame(moves, true);

      expect(result.moves).toHaveLength(4);

      // Check each move has alternatives
      result.moves.forEach((moveAnalysis, index) => {
        expect(moveAnalysis).toHaveProperty('alternatives');
        expect(moveAnalysis.alternatives).toBeInstanceOf(Array);
        expect(moveAnalysis.alternatives.length).toBeGreaterThan(0);
        expect(moveAnalysis.alternatives.length).toBeLessThanOrEqual(10);

        expect(moveAnalysis).toHaveProperty('fen_before');
        expect(moveAnalysis).toHaveProperty('fen_after');
        expect(moveAnalysis).toHaveProperty('is_blunder');
        expect(moveAnalysis).toHaveProperty('is_mistake');
        expect(moveAnalysis).toHaveProperty('is_inaccuracy');

        console.log(`Move ${index + 1} (${moveAnalysis.move}): ${moveAnalysis.alternatives.length} alternatives`);
      });
    }, TIMEOUT);

    test('should classify move quality correctly', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      // Include a known bad move
      const moves = ['e4', 'e5', 'Qh5', 'Nc6', 'Qxf7']; // Scholar's mate attempt
      const result = await analyzer.analyzeGame(moves, true);

      // Check that move quality flags are mutually exclusive
      result.moves.forEach(moveAnalysis => {
        const flagCount = [
          moveAnalysis.is_blunder,
          moveAnalysis.is_mistake,
          moveAnalysis.is_inaccuracy
        ].filter(Boolean).length;

        expect(flagCount).toBeLessThanOrEqual(1); // At most one flag should be true
      });
    }, TIMEOUT);

    test('should skip alternatives when disabled', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const moves = ['e4', 'e5'];
      const startTime = Date.now();
      const result = await analyzer.analyzeGame(moves, false); // Disable alternatives
      const duration = Date.now() - startTime;

      expect(result.moves).toHaveLength(2);

      // Should be much faster without alternatives
      console.log(`Analysis without alternatives took ${duration}ms`);
      expect(duration).toBeLessThan(10000); // Should be under 10 seconds for 2 moves
    }, 30000);
  });

  describe('Performance Tests', () => {
    test('should measure time for analyzing short game with alternatives', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'];

      console.log(`\n📊 Performance Test: 10-move game`);
      const startTime = Date.now();
      const result = await analyzer.analyzeGame(moves, true);
      const duration = Date.now() - startTime;

      console.log(`   Duration: ${(duration / 1000).toFixed(2)} seconds`);
      console.log(`   Time per move: ${(duration / moves.length / 1000).toFixed(2)} seconds`);
      console.log(`   Total alternatives found: ${result.moves.reduce((sum, m) => sum + m.alternatives.length, 0)}`);

      expect(result.moves).toHaveLength(10);
      expect(duration).toBeLessThan(300000); // Should complete in under 5 minutes
    }, TIMEOUT * 3);

    test('should analyze real PGN file and measure performance', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      const pgnPath = path.join(__dirname, '../../Game-PGNs/lichess');
      if (!fs.existsSync(pgnPath)) {
        console.log('Skipping PGN test - Game-PGNs directory not found');
        return;
      }

      const pgnFiles = fs.readdirSync(pgnPath).filter(f => f.endsWith('.pgn'));
      if (pgnFiles.length === 0) {
        console.log('Skipping PGN test - No PGN files found');
        return;
      }

      const pgnContent = fs.readFileSync(path.join(pgnPath, pgnFiles[0]), 'utf8');
      const parser = new PGNParser();
      const parseResult = parser.parseFile(pgnContent);

      if (parseResult.games.length === 0 || !parseResult.games[0].moves) {
        console.log('Skipping PGN test - Could not parse PGN');
        return;
      }

      const game = parseResult.games[0];
      const moves = game.moves.slice(0, 20); // Analyze first 20 moves for speed

      console.log(`\n📊 Real PGN Performance Test`);
      console.log(`   Game: ${game.white} vs ${game.black}`);
      console.log(`   Analyzing first ${moves.length} moves`);

      const startTime = Date.now();
      const result = await analyzer.analyzeGame(moves, true);
      const duration = Date.now() - startTime;

      console.log(`   Duration: ${(duration / 1000).toFixed(2)} seconds`);
      console.log(`   Time per move: ${(duration / moves.length / 1000).toFixed(2)} seconds`);
      console.log(`   Accuracy: ${result.summary.accuracy}%`);
      console.log(`   Blunders: ${result.summary.blunders}`);
      console.log(`   Avg Centipawn Loss: ${result.summary.averageCentipawnLoss}`);

      const totalAlternatives = result.moves.reduce((sum, m) => sum + m.alternatives.length, 0);
      console.log(`   Total alternatives: ${totalAlternatives}`);
      console.log(`   Avg alternatives per move: ${(totalAlternatives / moves.length).toFixed(1)}`);

      expect(result.summary.totalMoves).toBe(moves.length);
    }, TIMEOUT * 5);

    test('should estimate time for full game analysis', async () => {
      if (!analyzer.isReady) {
        console.log('Skipping test - Stockfish not ready');
        return;
      }

      // Analyze 5 moves and extrapolate
      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'];

      console.log(`\n📊 Time Estimation Test`);
      const startTime = Date.now();
      const result = await analyzer.analyzeGame(moves, true);
      const duration = Date.now() - startTime;

      const timePerMove = duration / moves.length;
      const estimatedFor40Moves = timePerMove * 40;
      const estimatedFor60Moves = timePerMove * 60;

      console.log(`   Time for ${moves.length} moves: ${(duration / 1000).toFixed(2)} seconds`);
      console.log(`   Time per move: ${(timePerMove / 1000).toFixed(2)} seconds`);
      console.log(`   Estimated for 40-move game: ${(estimatedFor40Moves / 60000).toFixed(1)} minutes`);
      console.log(`   Estimated for 60-move game: ${(estimatedFor60Moves / 60000).toFixed(1)} minutes`);

      expect(result.moves).toHaveLength(5);
    }, TIMEOUT);
  });

  describe('Database Storage Tests', () => {
    test('should store alternatives in database', async () => {
      if (!analyzer.isReady || !database) {
        console.log('Skipping test - Analyzer or database not ready');
        return;
      }

      // Create a test game
      const gameData = {
        pgnFilePath: 'test',
        whitePlayer: 'TestWhite',
        blackPlayer: 'TestBlack',
        result: '1-0',
        date: '2024-01-01',
        event: 'Test Event',
        whiteElo: 1500,
        blackElo: 1500,
        movesCount: 3
      };

      const gameResult = await database.insertGame(gameData, null);
      const gameId = gameResult.id;

      // Analyze a simple position
      const testFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const alternatives = await analyzer.generateAlternatives(testFen, 10, 10);

      // Store alternatives
      await database.storeAlternativeMoves(gameId, 1, alternatives);

      // Retrieve and verify
      const storedAlternatives = await database.getAlternativeMoves(gameId, 1);

      expect(storedAlternatives.length).toBe(alternatives.length);
      expect(storedAlternatives[0]).toHaveProperty('alternative_move');
      expect(storedAlternatives[0]).toHaveProperty('evaluation');
      expect(storedAlternatives[0]).toHaveProperty('depth');

      console.log(`Stored ${storedAlternatives.length} alternatives in database`);

      // Clean up
      await database.run('DELETE FROM alternative_moves WHERE game_id = ?', [gameId]);
      await database.run('DELETE FROM games WHERE id = ?', [gameId]);
    }, 60000);

    test('should store position evaluation with FEN', async () => {
      if (!analyzer.isReady || !database) {
        console.log('Skipping test - Analyzer or database not ready');
        return;
      }

      const gameData = {
        pgnFilePath: 'test',
        whitePlayer: 'TestWhite',
        blackPlayer: 'TestBlack',
        result: '1-0',
        date: '2024-01-01',
        event: 'Test Event',
        whiteElo: 1500,
        blackElo: 1500,
        movesCount: 1
      };

      const gameResult = await database.insertGame(gameData, null);
      const gameId = gameResult.id;

      const testFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const evaluation = await analyzer.evaluatePosition(testFen, 10);

      await database.storePositionEvaluation(
        gameId, 1, testFen, evaluation.evaluation, evaluation.bestMove, 10, null
      );

      const storedPosition = await database.getPositionEvaluation(gameId, 1);

      expect(storedPosition).toHaveProperty('fen', testFen);
      expect(storedPosition).toHaveProperty('evaluation');
      expect(storedPosition).toHaveProperty('best_move');

      console.log(`Stored position evaluation: ${storedPosition.evaluation} cp, best: ${storedPosition.best_move}`);

      // Clean up
      await database.run('DELETE FROM position_evaluations WHERE game_id = ?', [gameId]);
      await database.run('DELETE FROM games WHERE id = ?', [gameId]);
    }, 30000);
  });
});
