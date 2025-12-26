/**
 * Game Analysis Service
 *
 * Handles chess game analysis using Stockfish engine.
 * Responsible for:
 * - Managing analyzer lifecycle (initialization, analysis, cleanup)
 * - Analyzing individual games
 * - Calculating game metrics (accuracy, blunders, centipawn loss)
 */

const ChessAnalyzer = require('../models/analyzer');

class GameAnalysisService {
  constructor(analyzer = null) {
    this.analyzer = analyzer || new ChessAnalyzer();
    this.isInitialized = false;
    this.isSharedAnalyzer = !!analyzer; // Track if using shared analyzer
  }

  /**
   * Ensure analyzer is ready before use
   * @param {number} timeoutMs - Maximum wait time in milliseconds (default: 30000)
   * @returns {Promise<void>}
   */
  async ensureReady(timeoutMs = 30000) {
    console.log(`🔍 [GameAnalysisService] ensureReady called - isInitialized: ${this.isInitialized}, analyzer.isReady: ${this.analyzer?.isReady}`);

    if (this.isInitialized) {
      console.log('✅ [GameAnalysisService] Already initialized, skipping');
      return;
    }

    if (!this.analyzer.isReady) {
      console.log('⏳ [GameAnalysisService] Waiting for Stockfish engine to initialize...');

      await new Promise((resolve) => {
        const checkReady = () => {
          if (this.analyzer.isReady) {
            console.log('✅ [GameAnalysisService] Stockfish engine ready for analysis');
            this.isInitialized = true;
            resolve();
          } else {
            setTimeout(checkReady, 200);
          }
        };

        // Timeout fallback
        setTimeout(() => {
          console.log('⚠️ [GameAnalysisService] Stockfish engine timeout after 30 seconds, proceeding anyway');
          this.isInitialized = true;
          resolve();
        }, timeoutMs);

        checkReady();
      });
    } else {
      console.log('✅ [GameAnalysisService] Stockfish engine already ready');
      this.isInitialized = true;
    }
  }

  /**
   * Analyze a single game
   * @param {Object} game - Game object with moves and metadata
   * @param {number} gameIndex - Index of the game (for logging)
   * @param {number} totalGames - Total number of games (for logging)
   * @returns {Promise<Object>} Analyzed game with analysis data
   */
  async analyzeGame(game, gameIndex, totalGames) {
    console.log(`🔍 [GameAnalysisService] Analyzing game ${gameIndex + 1}/${totalGames}: ${game.white} vs ${game.black}`);
    console.log(`🔍 [GameAnalysisService] Analyzer ready status: ${this.analyzer?.isReady}`);

    try {
      // Debug logging
      console.log(`📝 Game moves:`, game.moves);
      console.log(`📊 Moves type: ${typeof game.moves}, Array: ${Array.isArray(game.moves)}, Length: ${game.moves?.length}`);

      // Validate moves
      if (!game.moves || !Array.isArray(game.moves) || game.moves.length === 0) {
        throw new Error('No valid moves found in game');
      }

      // Perform analysis
      console.log(`⚙️ [GameAnalysisService] Calling analyzer.analyzeGame() - isReady: ${this.analyzer.isReady}`);
      const analysis = await this.analyzer.analyzeGame(game.moves);

      // Build analyzed game object
      const analyzedGame = {
        ...game,
        analysis: {
          accuracy: analysis.summary.accuracy,
          blunders: analysis.summary.blunders,
          centipawnLoss: analysis.summary.averageCentipawnLoss,
          moveCount: analysis.summary.totalMoves,
          fullAnalysis: analysis.moves
        }
      };

      console.log(`✅ Game ${gameIndex + 1} analyzed - Accuracy: ${analysis.summary.accuracy}%, Blunders: ${analysis.summary.blunders}`);

      return analyzedGame;
    } catch (error) {
      console.error(`❌ Analysis failed for game ${gameIndex + 1}:`, error.message);

      // Return game without analysis on error
      return {
        ...game,
        analysis: null,
        analysisError: error.message
      };
    }
  }

  /**
   * Analyze multiple games
   * @param {Array<Object>} games - Array of game objects
   * @returns {Promise<Object>} Results with analyzed games and errors
   */
  async analyzeGames(games) {
    const analyzedGames = [];
    const analysisErrors = [];

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const result = await this.analyzeGame(game, i, games.length);

      analyzedGames.push(result);

      if (result.analysisError) {
        analysisErrors.push(`Game ${i + 1}: ${result.analysisError}`);
      }
    }

    return {
      analyzedGames,
      analysisErrors,
      successCount: analyzedGames.filter(g => g.analysis).length,
      errorCount: analysisErrors.length
    };
  }

  /**
   * Close the analyzer and clean up resources
   * NOTE: Does NOT close shared analyzers (they're managed by the server lifecycle)
   * @returns {Promise<void>}
   */
  async close() {
    if (this.isSharedAnalyzer) {
      console.log('ℹ️ [GameAnalysisService] Skipping close - using shared analyzer');
      return;
    }

    if (this.analyzer) {
      await this.analyzer.close();
      this.isInitialized = false;
      console.log('🔒 Analyzer closed');
    }
  }
}

module.exports = GameAnalysisService;
