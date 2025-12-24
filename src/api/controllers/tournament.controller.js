/**
 * Tournament Controller
 *
 * Handles all tournament-related business logic including:
 * - CRUD operations
 * - Performance analytics
 * - Comparisons and rankings
 * - File management
 */

const { getDatabase } = require('../../models/database');
const { getTournamentManager } = require('../../models/tournament-manager');
const { getTournamentAnalyzer } = require('../../models/tournament-analyzer');
const { getFileStorage } = require('../../models/file-storage');
const AccuracyCalculator = require('../../models/accuracy-calculator');
const { TARGET_PLAYER } = require('../../config/app-config');

class TournamentController {
  /**
   * Create a new tournament
   * POST /api/tournaments
   */
  async create(req, res) {
    try {
      console.log('🏆 Creating new tournament');

      const tournamentManager = getTournamentManager();
      const database = getDatabase();

      if (!tournamentManager) {
        throw new Error('Tournament manager not initialized');
      }

      const { name, eventType, location, startDate, endDate } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Tournament name is required' });
      }

      // Check if tournament already exists
      const existing = await database.findTournamentByName(name, req.userId);
      if (existing) {
        return res.status(409).json({ error: 'Tournament with this name already exists' });
      }

      // Create tournament
      const tournamentData = {
        name: name.trim(),
        eventType: eventType || 'standard',
        location: location || null,
        startDate: startDate || null,
        endDate: endDate || null,
        userId: req.userId
      };

      const result = await database.insertTournament(tournamentData);

      const tournament = {
        id: result.id,
        name: tournamentData.name,
        event_type: tournamentData.eventType,
        location: tournamentData.location,
        start_date: tournamentData.startDate,
        end_date: tournamentData.endDate,
        total_games: 0,
        user_id: tournamentData.userId,
        created_at: new Date().toISOString()
      };

      console.log(`✅ Created tournament: ${tournament.name} (ID: ${tournament.id})`);
      res.status(201).json(tournament);

    } catch (error) {
      console.error('[TOURNAMENT CONTROLLER] Tournament creation error:', error);
      res.status(500).json({ error: 'Failed to create tournament' });
    }
  }

  /**
   * List all tournaments
   * GET /api/tournaments
   */
  async list(req, res) {
    try {
      console.log('🏆 [TOURNAMENT CONTROLLER] Tournaments list requested');

      const tournamentManager = getTournamentManager();

      if (!tournamentManager) {
        throw new Error('Tournament manager not initialized');
      }

      const tournaments = await tournamentManager.getAllTournaments();

      res.json(tournaments);
    } catch (error) {
      console.error('Tournaments API error:', error);
      res.json([]);
    }
  }

  /**
   * Get tournament by ID with stats
   * GET /api/tournaments/:id
   */
  async getById(req, res) {
    try {
      const tournamentId = parseInt(req.params.id);
      console.log(`🏆 [TOURNAMENT CONTROLLER] Tournament ${tournamentId} details requested`);

      const tournamentManager = getTournamentManager();

      if (!tournamentManager) {
        throw new Error('Tournament manager not initialized');
      }

      const tournament = await tournamentManager.getTournamentById(tournamentId);

      if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
      }

      const stats = await tournamentManager.getTournamentStats(tournamentId);

      res.json({
        ...tournament,
        stats
      });
    } catch (error) {
      console.error('Tournament details API error:', error);
      res.status(500).json({ error: 'Failed to get tournament details' });
    }
  }

  /**
   * Get tournament performance metrics
   * GET /api/tournaments/:id/performance
   */
  async getPerformance(req, res) {
    try {
      const tournamentId = parseInt(req.params.id);
      console.log(`📊 [TOURNAMENT CONTROLLER] Tournament ${tournamentId} performance requested`);

      const tournamentAnalyzer = getTournamentAnalyzer();

      if (!tournamentAnalyzer) {
        throw new Error('Tournament manager not initialized');
      }

      const performance = await tournamentAnalyzer.getTournamentPerformance(tournamentId);

      res.json(performance);
    } catch (error) {
      console.error('Tournament performance API error:', error);
      res.status(500).json({ error: 'Failed to get tournament performance' });
    }
  }

  /**
   * Get tournament heatmap data
   * GET /api/tournaments/:id/heatmap
   */
  async getHeatmap(req, res) {
    try {
      const tournamentId = parseInt(req.params.id);
      console.log(`🔥 [TOURNAMENT CONTROLLER] Tournament ${tournamentId} heatmap requested`);

      const tournamentAnalyzer = getTournamentAnalyzer();

      if (!tournamentAnalyzer) {
        throw new Error('Tournament manager not initialized');
      }

      const heatmap = await tournamentAnalyzer.getTournamentHeatmap(tournamentId);

      res.json(heatmap);
    } catch (error) {
      console.error('Tournament heatmap API error:', error);
      res.json([]);
    }
  }

  /**
   * Get tournament trends
   * GET /api/tournaments/:id/trends
   */
  async getTrends(req, res) {
    try {
      const tournamentId = parseInt(req.params.id);
      console.log(`📈 [TOURNAMENT CONTROLLER] Tournament ${tournamentId} trends requested`);

      const tournamentAnalyzer = getTournamentAnalyzer();

      if (!tournamentAnalyzer) {
        throw new Error('Tournament manager not initialized');
      }

      const trends = await tournamentAnalyzer.getTournamentTrends(tournamentId);

      res.json(trends);
    } catch (error) {
      console.error('Tournament trends API error:', error);
      res.json([]);
    }
  }

  /**
   * Get tournament summary
   * GET /api/tournaments/:id/summary
   */
  async getSummary(req, res) {
    try {
      const tournamentId = parseInt(req.params.id);
      console.log(`📋 [TOURNAMENT CONTROLLER] Tournament ${tournamentId} summary requested`);

      const tournamentAnalyzer = getTournamentAnalyzer();

      if (!tournamentAnalyzer) {
        throw new Error('Tournament manager not initialized');
      }

      const summary = await tournamentAnalyzer.getTournamentSummary(tournamentId);

      res.json(summary);
    } catch (error) {
      console.error('Tournament summary API error:', error);
      res.status(500).json({ error: 'Failed to get tournament summary' });
    }
  }

  /**
   * Get player performance for a tournament
   * GET /api/tournaments/:id/player-performance
   */
  async getPlayerPerformance(req, res) {
    try {
      const tournamentId = parseInt(req.params.id);
      console.log(`👤 [TOURNAMENT CONTROLLER] Player performance for tournament ${tournamentId} requested`);

      const database = getDatabase();

      if (!database) {
        throw new Error('Database not initialized');
      }

      // Get games for this tournament involving the target player
      const games = await database.all(`
        SELECT id, white_player, black_player, result, white_elo, black_elo
        FROM games
        WHERE tournament_id = ? AND (white_player = ? OR black_player = ?) AND user_id = ?
        ORDER BY created_at ASC
      `, [tournamentId, TARGET_PLAYER, TARGET_PLAYER, req.userId]);

      let wins = 0;
      let losses = 0;
      let draws = 0;
      let totalBlunders = 0;
      let totalCentipawnLoss = 0;
      let totalMoves = 0;

      for (const game of games) {
        const isPlayerWhite = game.white_player === TARGET_PLAYER;
        const isPlayerBlack = game.black_player === TARGET_PLAYER;

        // Calculate win/loss/draw
        if (game.result === '1/2-1/2') {
          draws++;
        } else if (
          (isPlayerWhite && game.result === '1-0') ||
          (isPlayerBlack && game.result === '0-1')
        ) {
          wins++;
        } else {
          losses++;
        }

        // Get analysis data
        const analysis = await database.all(`
          SELECT a.centipawn_loss, a.move_number
          FROM analysis a
          INNER JOIN games g ON a.game_id = g.id
          WHERE a.game_id = ? AND g.user_id = ?
          ORDER BY a.move_number
        `, [game.id, req.userId]);

        // Filter moves for the target player
        const playerMoves = analysis.filter(move =>
          (isPlayerWhite && move.move_number % 2 === 1) ||
          (isPlayerBlack && move.move_number % 2 === 0)
        );

        // Count blunders
        const blunderCount = await database.get(`
          SELECT COUNT(*) as count
          FROM blunder_details bd
          JOIN games g ON bd.game_id = g.id
          WHERE bd.game_id = ?
            AND bd.is_blunder = ?
            AND g.user_id = ?
            AND ((g.white_player = ? AND bd.player_color = 'white')
              OR (g.black_player = ? AND bd.player_color = 'black'))
        `, [game.id, true, req.userId, TARGET_PLAYER, TARGET_PLAYER]);

        totalBlunders += parseInt(blunderCount?.count) || 0;
        totalCentipawnLoss += playerMoves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0);
        totalMoves += playerMoves.length;
      }

      const totalGames = games.length;
      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
      const avgAccuracy = totalMoves > 0
        ? Math.max(0, Math.min(100, Math.round(100 - (totalCentipawnLoss / totalMoves / 2))))
        : 0;

      res.json({
        totalGames,
        wins,
        losses,
        draws,
        winRate,
        avgAccuracy,
        totalBlunders,
        avgCentipawnLoss: totalMoves > 0 ? Math.round(totalCentipawnLoss / totalMoves) : 0
      });

    } catch (error) {
      console.error('Player tournament performance API error:', error);
      res.status(500).json({ error: 'Failed to get player tournament performance' });
    }
  }

  /**
   * Compare multiple tournaments
   * GET /api/tournaments/compare?ids=1,2,3
   */
  async compare(req, res) {
    try {
      const tournamentIds = req.query.ids ? req.query.ids.split(',').map(id => parseInt(id)) : [];
      console.log(`🔄 [TOURNAMENT CONTROLLER] Tournament comparison requested for: ${tournamentIds.join(', ')}`);

      if (tournamentIds.length === 0) {
        return res.json([]);
      }

      const tournamentAnalyzer = getTournamentAnalyzer();
      const comparison = await tournamentAnalyzer.compareTournaments(tournamentIds);

      res.json(comparison);
    } catch (error) {
      console.error('Tournament comparison API error:', error);
      res.json([]);
    }
  }

  /**
   * Get tournament rankings
   * GET /api/tournaments/rankings
   */
  async getRankings(req, res) {
    try {
      console.log('🏆 [TOURNAMENT CONTROLLER] Tournament rankings requested');

      const tournamentAnalyzer = getTournamentAnalyzer();
      const rankings = await tournamentAnalyzer.rankTournaments();

      res.json(rankings);
    } catch (error) {
      console.error('Tournament rankings API error:', error);
      res.json([]);
    }
  }

  /**
   * Get tournament files
   * GET /api/tournaments/:id/files
   */
  async getFiles(req, res) {
    try {
      const tournamentId = parseInt(req.params.id);
      console.log(`📁 [TOURNAMENT CONTROLLER] Tournament ${tournamentId} files requested`);

      const tournamentManager = getTournamentManager();
      const fileStorage = getFileStorage();

      const tournament = await tournamentManager.getTournamentById(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
      }

      const files = fileStorage.listTournamentFiles(tournament.name);
      res.json(files);
    } catch (error) {
      console.error('Tournament files API error:', error);
      res.json([]);
    }
  }

  /**
   * List all tournament folders
   * GET /api/tournament-folders
   */
  async listFolders(req, res) {
    try {
      console.log('📁 [TOURNAMENT CONTROLLER] Tournament folders list requested');

      const fileStorage = getFileStorage();
      const folders = fileStorage.listTournamentFolders();

      res.json(folders);
    } catch (error) {
      console.error('Tournament folders API error:', error);
      res.json([]);
    }
  }

  /**
   * Get all games for a tournament
   * GET /api/tournaments/:id/games
   */
  async getGames(req, res) {
    try {
      const tournamentId = parseInt(req.params.id);
      console.log(`🎮 [TOURNAMENT CONTROLLER] Games for tournament ${tournamentId} requested`);

      const database = getDatabase();

      if (!database) {
        throw new Error('Database not initialized');
      }

      const games = await database.all(`
        SELECT
          id, white_player, black_player, result, date,
          white_elo, black_elo, moves_count, created_at, pgn_content
        FROM games
        WHERE tournament_id = ?
        ORDER BY created_at DESC
      `, [tournamentId]);

      // Add opening extraction and accuracy calculation
      const gamesWithAnalysis = await Promise.all(games.map(async (game) => {
        let opening = null;
        if (game.pgn_content) {
          // Try to get ECO from PGN headers
          const ecoMatch = game.pgn_content.match(/\[ECO "([^"]+)"\]/);
          if (ecoMatch) {
            const ecoCode = ecoMatch[1];
            opening = await this._getOpeningName(ecoCode);
          } else {
            // Fallback: Detect opening from moves
            const openingDetector = require('../../models/opening-detector');
            const detected = openingDetector.detect(game.pgn_content);
            if (detected) {
              opening = detected.name;
            }
          }
        }

        // Get analysis data
        const analysis = await database.all(`
          SELECT move_number, centipawn_loss
          FROM analysis
          WHERE game_id = ?
          ORDER BY move_number
        `, [game.id]);

        let playerAccuracy = 0;
        let playerBlunders = 0;

        if (analysis.length > 0) {
          // Calculate accuracy for target player
          playerAccuracy = AccuracyCalculator.calculatePlayerAccuracy(
            analysis,
            TARGET_PLAYER,
            game.white_player,
            game.black_player
          );
        }

        // Count blunders
        const blunderCount = await database.get(`
          SELECT COUNT(*) as count
          FROM blunder_details bd
          JOIN games g ON bd.game_id = g.id
          WHERE bd.game_id = ?
            AND bd.is_blunder = ?
            AND g.user_id = ?
            AND ((g.white_player = ? AND bd.player_color = 'white')
              OR (g.black_player = ? AND bd.player_color = 'black'))
        `, [game.id, true, req.userId, TARGET_PLAYER, TARGET_PLAYER]);

        playerBlunders = parseInt(blunderCount?.count) || 0;

        return {
          ...game,
          opening: opening || 'Unknown Opening',
          accuracy: playerAccuracy,
          blunders: playerBlunders,
          playerColor: game.white_player === TARGET_PLAYER ? 'white' : 'black'
        };
      }));

      res.json(gamesWithAnalysis);
    } catch (error) {
      console.error('Tournament games API error:', error);
      res.json([]);
    }
  }

  /**
   * Helper: Get opening name from ECO code
   */
  async _getOpeningName(ecoCode) {
    try {
      const database = getDatabase();
      const opening = await database.get(
        'SELECT name FROM chess_openings WHERE eco = ?',
        [ecoCode]
      );
      return opening ? opening.name : null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new TournamentController();
