/**
 * Upload Controller
 *
 * Handles all PGN file upload and manual game entry operations including:
 * - PGN file uploads via FormData
 * - Manual PGN entry
 * - Game analysis and storage
 * - Tournament linkage
 */

const crypto = require('crypto');
const { getDatabase } = require('../../models/database');
const { TARGET_PLAYER } = require('../../config/app-config');
const PGNParser = require('../../services/PGNParser');
const ChessAnalyzer = require('../../models/analyzer');
const { getTournamentManager } = require('../../models/tournament-manager');
const fileStorage = require('../../models/file-storage');

class UploadController {
  /**
   * Handle PGN file upload or text content
   * POST /api/upload
   * POST /api/upload/pgn
   *
   * Supports two formats:
   * 1. Multipart/form-data: file upload with 'pgn' field (from frontend file upload)
   * 2. JSON: { pgnContent: "...", tournamentId?: number } (from manual entry)
   */
  async upload(req, res) {
    try {
      let pgnContent;
      let originalFileName = 'uploaded.pgn';
      let assignedTournamentId = null;

      // Check if this is a multipart file upload (req.file from multer)
      if (req.file) {
        // File upload via FormData
        pgnContent = req.file.buffer.toString('utf-8');
        originalFileName = req.file.originalname || 'uploaded.pgn';
        assignedTournamentId = req.body.tournamentId ? parseInt(req.body.tournamentId) : null;
      } else if (req.body.pgnContent) {
        // JSON format (manual entry)
        pgnContent = req.body.pgnContent;
        assignedTournamentId = req.body.tournamentId ? parseInt(req.body.tournamentId) : null;
      } else {
        return res.status(400).json({ error: 'No PGN content provided. Send either a file upload or JSON with pgnContent field.' });
      }

      if (!pgnContent || typeof pgnContent !== 'string') {
        return res.status(400).json({ error: 'Invalid PGN content' });
      }

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      // Check for duplicate content
      const contentHash = crypto.createHash('sha256').update(pgnContent).digest('hex');
      const existingGame = await database.findGameByContentHash(contentHash, req.userId);

      if (existingGame) {
        return res.json({
          success: true,
          message: 'PGN content already exists in database',
          duplicate: true,
          existingGameId: existingGame.id
        });
      }

      const parser = new PGNParser();
      const validation = parser.validatePGN(pgnContent);

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const tournamentManager = getTournamentManager();
      let tournament;

      if (assignedTournamentId) {
        // Use assigned tournament
        tournament = await tournamentManager.getTournamentById(assignedTournamentId);
        if (!tournament) {
          return res.status(400).json({ error: 'Assigned tournament not found' });
        }
        console.log(`📊 Using assigned tournament: ${tournament.name} (ID: ${tournament.id})`);
      } else {
        // Auto-detect tournament from PGN headers
        const tournamentResult = await tournamentManager.processPGNForTournament(pgnContent, req.userId);
        tournament = tournamentResult.tournament;
        console.log(`📊 Auto-detected tournament: ${tournament.name} (ID: ${tournament.id})`);
      }

      const parseResult = parser.parseFile(pgnContent);
      console.log(`📊 Starting analysis for ${parseResult.totalGames} games in tournament: ${tournament.name}`);

      // Initialize ChessAnalyzer for analysis
      const analyzer = new ChessAnalyzer();

      // Wait for Stockfish engine to be ready
      if (!analyzer.isReady) {
        console.log('⏳ Waiting for Stockfish engine to initialize...');
        await new Promise(resolve => {
          const checkReady = () => {
            if (analyzer.isReady) {
              console.log('✅ Stockfish engine ready for analysis');
              resolve();
            } else {
              setTimeout(checkReady, 200);
            }
          };
          setTimeout(() => {
            console.log('⚠️ Stockfish engine timeout after 30 seconds, proceeding anyway');
            resolve();
          }, 30000);
          checkReady();
        });
      } else {
        console.log('✅ Stockfish engine already ready');
      }

      const analyzedGames = [];
      const analysisErrors = [];
      const storedGameIds = [];

      // Analyze and store each game
      for (let i = 0; i < parseResult.games.length; i++) {
        const game = parseResult.games[i];
        console.log(`🔍 Analyzing game ${i + 1}/${parseResult.games.length}: ${game.white} vs ${game.black}`);

        try {
          // Debug logging
          console.log(`📝 Game moves:`, game.moves);
          console.log(`📊 Moves type: ${typeof game.moves}, Array: ${Array.isArray(game.moves)}, Length: ${game.moves?.length}`);

          // Check if moves exist and are valid
          if (!game.moves || !Array.isArray(game.moves) || game.moves.length === 0) {
            throw new Error('No valid moves found in game');
          }

          const analysis = await analyzer.analyzeGame(game.moves);

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

          analyzedGames.push(analyzedGame);

          // Store game in database with tournament linkage
          try {
            let storedFilePath = 'database';

            // Store PGN in tournament folder if tournament assigned
            if (assignedTournamentId && fileStorage) {
              try {
                const fileResult = await fileStorage.storePGNInTournament(
                  pgnContent,
                  originalFileName,
                  tournament.name
                );
                storedFilePath = fileResult.relativePath;
                console.log(`📁 Stored in tournament folder: ${fileResult.tournamentFolder}/${fileResult.fileName}`);
              } catch (fileError) {
                console.warn('⚠️ Failed to store in tournament folder, using database only:', fileError.message);
              }
            }

            const gameData = {
              pgnFilePath: storedFilePath,
              whitePlayer: game.white || 'Unknown',
              blackPlayer: game.black || 'Unknown',
              result: game.result || '*',
              date: game.date || null,
              event: assignedTournamentId ? tournament.name : (game.event || tournament.name),
              whiteElo: game.whiteElo ? parseInt(game.whiteElo) : null,
              blackElo: game.blackElo ? parseInt(game.blackElo) : null,
              movesCount: game.moves ? game.moves.length : 0,
              tournamentId: tournament.id,
              userId: req.userId
            };

            const gameResult = await database.insertGame(gameData, pgnContent);
            const gameId = gameResult.id;
            storedGameIds.push(gameId);

            // Store analysis data
            if (analysis.moves && analysis.moves.length > 0) {
              for (const moveAnalysis of analysis.moves) {
                await database.insertAnalysis(gameId, moveAnalysis);

                // Store up to 15 alternative moves for each position
                if (moveAnalysis.alternatives && moveAnalysis.alternatives.length > 0) {
                  await database.storeAlternativeMoves(gameId, moveAnalysis.move_number, moveAnalysis.alternatives);
                  console.log(`📝 Stored ${moveAnalysis.alternatives.length} alternatives for move ${moveAnalysis.move_number}`);
                }

                // Store position evaluation with FEN
                if (moveAnalysis.fen_before) {
                  await database.storePositionEvaluation(
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
            }

            console.log(`💾 Game ${i + 1} stored in database with ID: ${gameId}, Tournament: ${tournament.name}`);
            console.log(`📊 Stored alternatives for ${analysis.moves.length} positions`);
          } catch (dbError) {
            console.error(`❌ Database storage failed for game ${i + 1}:`, dbError.message);
          }

          console.log(`✅ Game ${i + 1} analyzed - Accuracy: ${analysis.summary.accuracy}%, Blunders: ${analysis.summary.blunders}`);
        } catch (error) {
          console.error(`❌ Analysis failed for game ${i + 1}:`, error.message);
          analysisErrors.push(`Game ${i + 1}: ${error.message}`);

          analyzedGames.push({
            ...game,
            analysis: null
          });
        }
      }

      // Update tournament game count
      if (tournament && storedGameIds.length > 0) {
        const tournamentManagerRef = getTournamentManager();
        await tournamentManagerRef.updateTournamentGameCount(tournament.id);
      }

      // Close the analyzer
      await analyzer.close();

      // Update performance metrics in database
      if (storedGameIds.length > 0) {
        try {
          await database.updatePerformanceMetrics();
          console.log(`📊 Performance metrics updated`);
        } catch (error) {
          console.error('❌ Failed to update performance metrics:', error.message);
        }
      }

      console.log(`🎯 Analysis complete: ${analyzedGames.filter(g => g.analysis).length}/${parseResult.totalGames} games analyzed`);
      console.log(`💾 Stored ${storedGameIds.length} games in database`);
      console.log(`🏆 Tournament: ${tournament.name} (${tournament.event_type})`);

      res.json({
        success: true,
        message: `Successfully imported and analyzed ${parseResult.totalGames} games`,
        gamesCount: parseResult.totalGames,
        totalGames: parseResult.totalGames,
        analyzedGames: analyzedGames.filter(g => g.analysis).length,
        storedGames: storedGameIds.length,
        tournament: {
          id: tournament.id,
          name: tournament.name,
          eventType: tournament.event_type,
          location: tournament.location,
          assigned: !!assignedTournamentId
        },
        games: analyzedGames.slice(0, 5), // Return first 5 games as preview
        errors: [...parseResult.errors, ...analysisErrors]
      });
    } catch (error) {
      console.error('PGN upload error:', error);
      res.status(500).json({ error: 'Failed to process PGN file' });
    }
  }

  /**
   * Handle manual PGN entry
   * POST /api/manual-pgn
   */
  async manualEntry(req, res) {
    try {
      const { tournamentName, date, opponent, opponentElo, playerElo, result, variant, termination, playerColor, moves } = req.body;

      // Validate required fields
      if (!tournamentName || !opponent || !moves || !result || !playerColor || !variant || !termination) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Determine white and black players based on player color
      const whitePlayer = playerColor === 'white' ? TARGET_PLAYER : opponent;
      const blackPlayer = playerColor === 'black' ? TARGET_PLAYER : opponent;
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

      // Create a modified request object to simulate file upload
      const modifiedReq = {
        ...req,
        body: pgnContent,
        file: null
      };

      // Call upload handler with the constructed PGN
      await this.upload(modifiedReq, res);
    } catch (error) {
      console.error('Manual PGN entry error:', error);
      res.status(500).json({ error: 'Failed to process manual PGN entry' });
    }
  }
}

module.exports = new UploadController();
