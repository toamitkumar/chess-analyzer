/**
 * PGN Upload Service
 *
 * Orchestrates the entire PGN upload and analysis flow.
 * Responsible for:
 * - Coordinating all upload-related services
 * - Managing the complete upload pipeline
 * - Providing a unified interface for PGN upload operations
 */

const PGNParser = require('./PGNParser');
const TournamentResolutionService = require('./TournamentResolutionService');
const GameAnalysisService = require('./GameAnalysisService');
const GameStorageService = require('./GameStorageService');

class PGNUploadService {
  constructor({
    pgnParser = null,
    tournamentService = null,
    analysisService = null,
    storageService = null
  } = {}) {
    this.pgnParser = pgnParser || new PGNParser();
    this.tournamentService = tournamentService || new TournamentResolutionService();
    this.analysisService = analysisService || new GameAnalysisService();
    this.storageService = storageService || new GameStorageService();
  }

  /**
   * Process a PGN upload (file or text)
   * @param {Object} options - Upload options
   * @param {string} options.pgnContent - PGN content to process
   * @param {string} options.originalFileName - Original file name
   * @param {number|null} options.assignedTournamentId - Optional tournament ID
   * @param {string} options.userId - User ID
   * @param {string|null} options.userColor - Color user played ('white' or 'black')
   * @returns {Promise<Object>} Upload result
   */
  async processPGNUpload({ pgnContent, originalFileName = 'uploaded.pgn', assignedTournamentId = null, userId, userColor = null }) {
    // 1. Validate input
    if (!pgnContent || typeof pgnContent !== 'string') {
      throw new Error('Invalid PGN content');
    }

    // 2. Check for duplicate
    const existingGame = await this.storageService.checkDuplicate(pgnContent, userId);
    if (existingGame) {
      return {
        success: true,
        message: 'PGN content already exists in database',
        duplicate: true,
        existingGameId: existingGame.id
      };
    }

    // 3. Validate PGN format
    const validation = this.pgnParser.validatePGN(pgnContent);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 4. Resolve tournament
    const { tournament, wasAssigned } = await this.tournamentService.resolveTournament(
      pgnContent,
      assignedTournamentId,
      userId
    );

    // 5. Parse PGN file
    const parseResult = this.pgnParser.parseFile(pgnContent);
    console.log(`📊 Starting analysis for ${parseResult.totalGames} games in tournament: ${tournament.name}`);

    // 6. Initialize analysis engine
    await this.analysisService.ensureReady();

    // 7. Analyze all games
    const { analyzedGames, analysisErrors, successCount } = await this.analysisService.analyzeGames(parseResult.games);

    // 8. Store PGN file (if assigned tournament)
    const { storedFilePath } = await this.storageService.storePGNFile(
      pgnContent,
      originalFileName,
      tournament.name,
      wasAssigned
    );

    // 9. Store all games in database
    const storedGameIds = await this.storageService.storeGames(
      parseResult.games,
      analyzedGames,
      tournament,
      pgnContent,
      storedFilePath,
      userId,
      userColor  // Pass userColor to storage
    );

    // 10. Update tournament game count
    if (storedGameIds.length > 0) {
      await this.tournamentService.updateTournamentGameCount(tournament.id);
    }

    // 11. Close analyzer
    await this.analysisService.close();

    // 12. Update performance metrics
    if (storedGameIds.length > 0) {
      await this.storageService.updatePerformanceMetrics();
    }

    // 13. Log summary
    console.log(`🎯 Analysis complete: ${successCount}/${parseResult.totalGames} games analyzed`);
    console.log(`💾 Stored ${storedGameIds.length} games in database`);
    console.log(`🏆 Tournament: ${tournament.name} (${tournament.event_type})`);

    // 14. Return result
    return {
      success: true,
      message: `Successfully imported and analyzed ${parseResult.totalGames} games`,
      gamesCount: parseResult.totalGames,
      totalGames: parseResult.totalGames,
      analyzedGames: successCount,
      storedGames: storedGameIds.length,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        eventType: tournament.event_type,
        location: tournament.location,
        assigned: wasAssigned
      },
      games: analyzedGames.slice(0, 5), // Return first 5 games as preview
      errors: [...parseResult.errors, ...analysisErrors]
    };
  }

  /**
   * Process manual PGN entry
   * @param {Object} gameData - Manual game entry data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Upload result
   */
  async processManualEntry(gameData, userId) {
    const {
      tournamentName,
      date,
      opponent,
      opponentElo,
      playerElo,
      result,
      variant,
      termination,
      playerColor,
      moves,
      targetPlayer
    } = gameData;

    // Validate required fields
    if (!tournamentName || !opponent || !moves || !result || !playerColor || !variant || !termination) {
      throw new Error('Missing required fields');
    }

    // Determine white and black players based on player color
    const whitePlayer = playerColor === 'white' ? targetPlayer : opponent;
    const blackPlayer = playerColor === 'black' ? targetPlayer : opponent;
    const whiteElo = playerColor === 'white' ? playerElo : opponentElo;
    const blackElo = playerColor === 'black' ? playerElo : opponentElo;

    // Format the date for PGN (YYYY.MM.DD)
    const formattedDate = date ? date.replace(/-/g, '.') : new Date().toISOString().split('T')[0].replace(/-/g, '.');

    // Construct PGN content with proper headers
    let pgnContent = `[Event "${tournamentName}"]\n`;
    pgnContent += `[Site "Tournament"]\n`;
    pgnContent += `[Date "${formattedDate}"]\n`;
    pgnContent += `[Round "?"]\n`;
    pgnContent += `[White "${whitePlayer}"]\n`;
    pgnContent += `[Black "${blackPlayer}"]\n`;
    pgnContent += `[Result "${result}"]\n`;

    if (whiteElo) {
      pgnContent += `[WhiteElo "${whiteElo}"]\n`;
    }
    if (blackElo) {
      pgnContent += `[BlackElo "${blackElo}"]\n`;
    }

    // Add TimeControl and Termination headers
    pgnContent += `[TimeControl "${variant}"]\n`;
    pgnContent += `[Termination "${termination}"]\n`;

    pgnContent += `\n${moves.trim()}\n`;

    // Add result at the end if not already present
    if (!moves.trim().endsWith(result)) {
      pgnContent += ` ${result}\n`;
    }

    console.log(`📝 Manual PGN entry: ${whitePlayer} vs ${blackPlayer} at ${tournamentName} (${variant}, ${termination})`);

    // Process as regular PGN upload
    return await this.processPGNUpload({
      pgnContent,
      originalFileName: `manual-${Date.now()}.pgn`,
      assignedTournamentId: null,
      userId,
      userColor: playerColor  // Pass playerColor from manual entry as userColor
    });
  }
}

module.exports = PGNUploadService;
