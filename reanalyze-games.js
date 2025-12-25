/**
 * Re-analyze games that have PGN content but no analysis data
 */

const { getDatabase } = require('./src/models/database');
const ChessAnalyzer = require('./src/models/analyzer');
const GameStorageService = require('./src/services/GameStorageService');

async function reanalyzeGames(gameIds = []) {
  const db = getDatabase();
  const analyzer = new ChessAnalyzer();
  const storageService = new GameStorageService();

  try {
    console.log('🚀 Starting game re-analysis...');

    // Initialize database
    await db.initialize();

    // Wait for Stockfish to initialize
    console.log('⏳ Waiting for Stockfish engine...');
    await new Promise((resolve) => {
      const checkReady = () => {
        if (analyzer.isReady) {
          console.log('✅ Stockfish ready');
          resolve();
        } else {
          setTimeout(checkReady, 200);
        }
      };
      setTimeout(() => {
        console.log('⚠️ Stockfish timeout, proceeding anyway');
        resolve();
      }, 30000);
      checkReady();
    });

    // Get games to analyze
    let games;
    if (gameIds.length > 0) {
      console.log(`🎯 Re-analyzing games: ${gameIds.join(', ')}`);
      games = await db.all(
        `SELECT * FROM games WHERE id IN (${gameIds.map(() => '?').join(',')})`,
        gameIds
      );
    } else {
      console.log('🔍 Finding games without analysis...');
      games = await db.all(`
        SELECT g.*
        FROM games g
        LEFT JOIN analysis a ON g.id = a.game_id
        WHERE a.game_id IS NULL
        ORDER BY g.id
      `);
    }

    if (games.length === 0) {
      console.log('✅ No games need re-analysis');
      return;
    }

    console.log(`📊 Found ${games.length} games to analyze`);

    // Analyze each game
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 Analyzing game ${i + 1}/${games.length}: ID ${game.id}`);
      console.log(`   ${game.white_player} vs ${game.black_player}`);
      console.log(`   Result: ${game.result}, Moves: ${game.moves_count}`);

      try {
        // Parse PGN to extract moves
        const PGNParser = require('./src/models/PGNParser');
        const parser = new PGNParser();
        const parseResult = parser.parse(game.pgn_content);

        if (parseResult.success && parseResult.games.length > 0) {
          const parsedGame = parseResult.games[0];

          console.log(`📝 Extracted ${parsedGame.moves?.length || 0} moves`);

          if (!parsedGame.moves || parsedGame.moves.length === 0) {
            console.error(`❌ No moves found in PGN for game ${game.id}`);
            continue;
          }

          // Analyze game
          console.log('⚙️ Running Stockfish analysis...');
          const analysis = await analyzer.analyzeGame(parsedGame.moves);

          console.log(`✅ Analysis complete - Accuracy: ${analysis.summary.accuracy}%, Blunders: ${analysis.summary.blunders}`);

          // Store analysis results
          await storageService.storeAnalysisResults(
            game.id,
            analysis,
            parsedGame.moves,
            game.user_color
          );

          console.log(`💾 Analysis saved to database`);
        } else {
          console.error(`❌ Failed to parse PGN for game ${game.id}`);
        }
      } catch (error) {
        console.error(`❌ Analysis failed for game ${game.id}:`, error.message);
        console.error(error.stack);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Re-analysis complete!');

  } catch (error) {
    console.error('❌ Re-analysis failed:', error);
  } finally {
    await analyzer.close();
    await db.close();
  }
}

// Get game IDs from command line arguments
const gameIds = process.argv.slice(2).map(id => parseInt(id)).filter(id => !isNaN(id));

reanalyzeGames(gameIds);
