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
 * - Detecting and storing tactical opportunities (ADR 009 Phase 5.1)
 * - Detecting and storing free pieces (ADR 009 Phase 5.3)
 */

const crypto = require('crypto');
const { getDatabase } = require('../models/database');
const { getFileStorage } = require('../models/file-storage');
const TacticalPatternDetector = require('./TacticalPatternDetector');
const FreePieceDetector = require('./FreePieceDetector');
const TacticalOpportunityService = require('./TacticalOpportunityService');
const OpponentBlunderService = require('./OpponentBlunderService');

class GameStorageService {
  constructor(database = null, fileStorage = null) {
    this.database = database || getDatabase();
    this.fileStorage = fileStorage || getFileStorage();

    // Initialize tactical detectors (ADR 009 Phase 5)
    this.tacticalDetector = new TacticalPatternDetector();
    this.freePieceDetector = new FreePieceDetector();
    this.tacticalOpportunityService = new TacticalOpportunityService(this.database);
    this.opponentBlunderService = new OpponentBlunderService(this.database);
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
      await this.storeAnalysisData(gameId, analyzedGame.analysis.fullAnalysis, userColor);
    }

    return gameId;
  }

  /**
   * Store analysis data for a game
   * @param {number} gameId - Game ID
   * @param {Array} analysisData - Array of move analysis objects
   * @param {string|null} userColor - Color the user played ('white' or 'black')
   * @returns {Promise<void>}
   */
  async storeAnalysisData(gameId, analysisData, userColor = null) {
    let tacticalOpportunities = 0;
    let freePiecesDetected = 0;

    for (let i = 0; i < analysisData.length; i++) {
      const moveAnalysis = analysisData[i];
      // Determine whose move it is from the FEN (more reliable than move_number)
      // FEN format: "position w/b castling..." - the second field indicates whose turn
      const isWhiteMove = moveAnalysis.fen_before && moveAnalysis.fen_before.includes(' w ');
      const playerColor = isWhiteMove ? 'white' : 'black';

      // Insert move analysis
      await this.database.insertAnalysis(gameId, moveAnalysis);

      // Store alternative moves (up to 15)
      if (moveAnalysis.alternatives && moveAnalysis.alternatives.length > 0) {
        await this.database.storeAlternativeMoves(gameId, moveAnalysis.move_number, moveAnalysis.alternatives);
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

      // ADR 009 Phase 5.1: Detect tactical opportunities
      // Only for the user's moves (if userColor is specified)
      if (userColor && playerColor === userColor && moveAnalysis.fen_before && moveAnalysis.best_move) {
        try {
          await this._detectAndStoreTacticalOpportunity(gameId, moveAnalysis, playerColor);
          tacticalOpportunities++;
        } catch (error) {
          console.warn(`Failed to detect tactical opportunity for move ${moveAnalysis.move_number}:`, error.message);
        }
      }

      // ADR 009 Phase 5.3: Detect free pieces (opponent blunders)
      // Look at positions after opponent's moves to see if they left pieces hanging
      if (userColor && playerColor !== userColor && moveAnalysis.fen_after) {
        try {
          await this._detectAndStoreFreePiece(gameId, moveAnalysis, analysisData[i + 1], userColor);
          freePiecesDetected++;
        } catch (error) {
          console.warn(`Failed to detect free piece for move ${moveAnalysis.move_number}:`, error.message);
        }
      }
    }

    console.log(`📊 Stored analysis for ${analysisData.length} positions`);
    if (tacticalOpportunities > 0) {
      console.log(`⚔️ Detected tactical opportunities in ${tacticalOpportunities} positions`);
    }
    if (freePiecesDetected > 0) {
      console.log(`🎁 Detected free pieces in ${freePiecesDetected} positions`);
    }
  }

  /**
   * Detect and store a tactical opportunity for a move
   * @private
   */
  async _detectAndStoreTacticalOpportunity(gameId, moveAnalysis, playerColor) {
    const { fen_before, best_move, move, centipawn_loss, alternatives } = moveAnalysis;

    // Calculate evaluation gain (how much better best move is than played move)
    let evalGain = centipawn_loss || 0;

    // Use alternatives to get more accurate eval gain if available
    if (alternatives && alternatives.length > 0 && centipawn_loss > 50) {
      const bestAlt = alternatives[0];
      const playedAlt = alternatives.find(a => a.move === move || a.moveUci === move);
      if (bestAlt && playedAlt) {
        evalGain = Math.max(0, bestAlt.evaluation - playedAlt.evaluation);
      }
    }

    // Detect tactical pattern
    const opportunity = this.tacticalDetector.detectOpportunity(
      fen_before,
      best_move,
      move,
      evalGain,
      playerColor
    );

    if (opportunity) {
      await this.tacticalOpportunityService.recordOpportunity(gameId, {
        moveNumber: Math.ceil(moveAnalysis.move_number / 2),
        playerColor: playerColor,
        tacticType: opportunity.tacticType,
        attackingPiece: opportunity.attackingPiece,
        targetPieces: opportunity.targetPieces,
        wasFound: opportunity.wasFound,
        bestMove: opportunity.bestMove,
        playedMove: move,
        evalGain: evalGain,
        fenPosition: fen_before
      });
    }
  }

  /**
   * Detect and store a free piece (opponent blunder)
   * @private
   */
  async _detectAndStoreFreePiece(gameId, opponentMoveAnalysis, playerNextMoveAnalysis, userColor) {
    // After opponent's move, check if they left a piece hanging
    const fenAfterOpponent = opponentMoveAnalysis.fen_after;

    if (!fenAfterOpponent || !playerNextMoveAnalysis) return;

    const playerMove = playerNextMoveAnalysis.move;
    const alternatives = playerNextMoveAnalysis.alternatives;

    // Detect free pieces in the position
    const freePiece = this.freePieceDetector.detectFreePiece(
      fenAfterOpponent,
      playerMove,
      alternatives,
      userColor
    );

    if (freePiece && freePiece.pieceValue >= 1) {
      await this.opponentBlunderService.recordOpponentBlunder(gameId, {
        moveNumber: Math.ceil(playerNextMoveAnalysis.move_number / 2),
        playerColor: userColor,
        opponentPiece: freePiece.opponentPiece,
        wasCaptured: freePiece.wasCaptured,
        captureMove: freePiece.captureMove,
        playedMove: playerMove,
        fenPosition: fenAfterOpponent
      });
    }
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
