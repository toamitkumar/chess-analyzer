/**
 * Game Storage Service
 *
 * Handles database and file storage operations for chess games.
 * Responsible for:
 * - Storing games in database
 * - Storing analysis data
 * - Storing alternative moves and position evaluations
 * - File storage in tournament folders
 * - Updating performance metrics
 */

const crypto = require('crypto');
const { getDatabase } = require('../models/database');
const { getFileStorage } = require('../models/file-storage');

class GameStorageService {
  constructor(database = null, fileStorage = null) {
    this.database = database || getDatabase();
    this.fileStorage = fileStorage || getFileStorage();
  }

  /**
   * Check if PGN content already exists in database
   * @param {string} pgnContent - PGN content to check
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Existing game or null
   */
  async checkDuplicate(pgnContent, userId) {
    const contentHash = crypto.createHash('sha256').update(pgnContent).digest('hex');
    return await this.database.findGameByContentHash(contentHash, userId);
  }

  /**
   * Store PGN file in tournament folder
   * @param {string} pgnContent - PGN content
   * @param {string} originalFileName - Original file name
   * @param {string} tournamentName - Tournament name
   * @param {boolean} assignedTournament - Whether tournament was assigned
   * @returns {Promise<Object>} File storage result with path
   */
  async storePGNFile(pgnContent, originalFileName, tournamentName, assignedTournament) {
    let storedFilePath = 'database'; // default to database-only

    if (assignedTournament && this.fileStorage) {
      try {
        const fileResult = await this.fileStorage.storePGNInTournament(
          pgnContent,
          originalFileName,
          tournamentName
        );
        storedFilePath = fileResult.relativePath;
        console.log(`📁 Stored in tournament folder: ${fileResult.tournamentFolder}/${fileResult.fileName}`);
      } catch (fileError) {
        console.warn('⚠️ Failed to store in tournament folder, using database only:', fileError.message);
      }
    }

    return { storedFilePath };
  }

  /**
   * Store a single game with its analysis
   * @param {Object} game - Game object with moves and metadata
   * @param {Object} analyzedGame - Analyzed game with analysis data
   * @param {Object} tournament - Tournament object
   * @param {string} pgnContent - Original PGN content
   * @param {string} storedFilePath - File path where PGN is stored
   * @param {string} userId - User ID
   * @param {number} gameIndex - Index of the game (for logging)
   * @param {string|null} userColor - Color the user played ('white' or 'black')
   * @returns {Promise<number>} Game ID
   */
  async storeGame(game, analyzedGame, tournament, pgnContent, storedFilePath, userId, gameIndex, userColor = null) {
    const gameData = {
      pgnFilePath: storedFilePath,
      whitePlayer: game.white || 'Unknown',
      blackPlayer: game.black || 'Unknown',
      result: game.result || '*',
      date: game.date || null,
      event: tournament.name,
      whiteElo: game.whiteElo ? parseInt(game.whiteElo) : null,
      blackElo: game.blackElo ? parseInt(game.blackElo) : null,
      movesCount: game.moves ? Math.ceil(game.moves.length / 2) : 0, // Board moves, not ply count
      tournamentId: tournament.id,
      userId: userId,
      userColor: userColor  // Add user_color
    };

    const gameResult = await this.database.insertGame(gameData, pgnContent);
    const gameId = gameResult.id;

    console.log(`💾 Game ${gameIndex + 1} stored in database with ID: ${gameId}, Tournament: ${tournament.name}`);

    // Store analysis data if available
    if (analyzedGame.analysis && analyzedGame.analysis.fullAnalysis) {
      await this.storeAnalysisData(gameId, analyzedGame.analysis.fullAnalysis);
    }

    return gameId;
  }

  /**
   * Store analysis data for a game
   * @param {number} gameId - Game ID
   * @param {Array} analysisData - Array of move analysis objects
   * @returns {Promise<void>}
   */
  async storeAnalysisData(gameId, analysisData) {
    for (const moveAnalysis of analysisData) {
      // Insert move analysis
      await this.database.insertAnalysis(gameId, moveAnalysis);

      // Store alternative moves (up to 15)
      if (moveAnalysis.alternatives && moveAnalysis.alternatives.length > 0) {
        await this.database.storeAlternativeMoves(gameId, moveAnalysis.move_number, moveAnalysis.alternatives);
        console.log(`📝 Stored ${moveAnalysis.alternatives.length} alternatives for move ${moveAnalysis.move_number}`);
      }

      // Store position evaluation with FEN
      if (moveAnalysis.fen_before) {
        await this.database.storePositionEvaluation(
          gameId,
          moveAnalysis.move_number,
          moveAnalysis.fen_before,
          moveAnalysis.evaluation,
          moveAnalysis.best_move,
          12, // depth
          null // mateIn
        );
      }
    }

    console.log(`📊 Stored alternatives for ${analysisData.length} positions`);
  }

  /**
   * Store multiple games with analysis
   * @param {Array} games - Array of games to store
   * @param {Array} analyzedGames - Array of analyzed games
   * @param {Object} tournament - Tournament object
   * @param {string} pgnContent - Original PGN content
   * @param {string} storedFilePath - File path where PGN is stored
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of stored game IDs
   */
  async storeGames(games, analyzedGames, tournament, pgnContent, storedFilePath, userId, userColor = null) {
    const storedGameIds = [];

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const analyzedGame = analyzedGames[i];

      try {
        const gameId = await this.storeGame(
          game,
          analyzedGame,
          tournament,
          pgnContent,
          storedFilePath,
          userId,
          i,
          userColor  // Pass userColor to storeGame
        );
        storedGameIds.push(gameId);
      } catch (dbError) {
        console.error(`❌ Database storage failed for game ${i + 1}:`, dbError.message);
      }
    }

    return storedGameIds;
  }

  /**
   * Update performance metrics in database
   * @returns {Promise<void>}
   */
  async updatePerformanceMetrics() {
    try {
      await this.database.updatePerformanceMetrics();
      console.log(`📊 Performance metrics updated`);
    } catch (error) {
      console.error('❌ Failed to update performance metrics:', error.message);
    }
  }
}

module.exports = GameStorageService;
