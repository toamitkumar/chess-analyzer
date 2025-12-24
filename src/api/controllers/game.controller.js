/**
 * Game Controller
 *
 * Handles all game-related business logic including:
 * - Game listing and retrieval
 * - Game analysis data
 * - Alternative moves
 * - Blunder analysis
 * - Accuracy calculations
 * - Performance metrics
 * - Phase analysis
 */

const { getDatabase } = require('../../models/database');
const { TARGET_PLAYER } = require('../../config/app-config');
const AccuracyCalculator = require('../../models/accuracy-calculator');

class GameController {
  /**
   * List all games
   * GET /api/games
   */
  async list(req, res) {
    try {
      console.log(`🎮 [GAME CONTROLLER] Games list requested for user ${req.userId}`);

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      const games = await database.all(`
        SELECT
          id, white_player, black_player, result, date, event,
          white_elo, black_elo, moves_count, created_at, pgn_content
        FROM games
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `, [req.userId]);

      // Add opening extraction to each game
      const gamesWithOpenings = await Promise.all(games.map(async (game) => {
        let opening = null;
        if (game.pgn_content) {
          // Try to get ECO from PGN headers first
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

        return {
          ...game,
          opening: opening || 'Unknown Opening'
        };
      }));

      res.json(gamesWithOpenings);
    } catch (error) {
      console.error('[NEW CONTROLLER] Games API error:', error);
      res.json([]);
    }
  }

  /**
   * Get game by ID
   * GET /api/games/:id
   */
  async getById(req, res) {
    try {
      const gameId = parseInt(req.params.id);

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      const game = await database.get('SELECT * FROM games WHERE id = ? AND user_id = ?', [gameId, req.userId]);

      console.log(`🎮 [GAME CONTROLLER] Game ${gameId} details requested for user ${req.userId}`);

      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Extract opening from PGN content
      let opening = null;
      if (game.pgn_content) {
        // Try to get ECO from PGN headers first
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

      res.json({
        ...game,
        opening: opening
      });
    } catch (error) {
      console.error('[NEW CONTROLLER] Game details API error:', error);
      res.status(500).json({ error: 'Failed to retrieve game' });
    }
  }

  /**
   * Get game analysis
   * GET /api/games/:id/analysis
   */
  async getAnalysis(req, res) {
    try {
      const gameId = parseInt(req.params.id);

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      const gameAnalysis = await database.getGameAnalysis(gameId);

      console.log('🎮 [NEW CONTROLLER] Game analysis requested');
    
      if (!gameAnalysis) {
        return res.status(404).json({ error: 'Game not found' });
      }
    
      res.json(gameAnalysis);
    } catch (error) {
      console.error('[NEW CONTROLLER] Analysis retrieval error:', error);
      res.json([]);
    }
  }

  /**
   * Get alternative moves for a specific move
   * GET /api/games/:id/alternatives/:moveNumber
   */
  async getAlternatives(req, res) {
    try {
      const gameId = parseInt(req.params.id);
      const moveNumber = parseInt(req.params.moveNumber);

      console.log(`🎮 [GAME CONTROLLER] Alternatives for game ${gameId}, move ${moveNumber} requested`);
      
      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }
      
      const alternatives = await database.getAlternativeMoves(gameId, moveNumber);
      const position = await database.getPositionEvaluation(gameId, moveNumber);
      
      res.json({
        position: position || { moveNumber },
        alternatives: alternatives.map(alt => ({
          move: alt.alternative_move,
          evaluation: alt.evaluation,
          line: alt.line_moves ? alt.line_moves.split(' ') : [],
          evaluationDiff: position ? alt.evaluation - position.evaluation : 0
        }))
      });
    } catch (error) {
      console.error('[NEW CONTROLLER] Alternatives retrieval error:', error);
      res.json([]);
    }
  }

  /**
   * Get blunders for a game
   * GET /api/games/:id/blunders
   */
  async getBlunders(req, res) {
    try {
      const gameId = parseInt(req.params.id);
      console.log(`⚠️ [GAME CONTROLLER] Blunders for game ${gameId} requested`);

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      // Query blunder_details table (single source of truth for blunders)
      // Verify game belongs to user
      const blunders = await database.all(`
        SELECT bd.*
        FROM blunder_details bd
        INNER JOIN games g ON bd.game_id = g.id
        WHERE bd.game_id = ? AND bd.is_blunder = ? AND g.user_id = ?
        ORDER BY bd.move_number
      `, [gameId, true, req.userId]);

      res.json(blunders);
    } catch (error) {
      console.error('[NEW CONTROLLER] Blunders retrieval error:', error);
      res.json([]);
    }
  }

  /**
   * Get accuracy for a game
   * GET /api/games/:id/accuracy
   */
  async getAccuracy(req, res) {
    try {
      const gameId = parseInt(req.params.id);
      console.log(`🎯 [GAME CONTROLLER] Accuracy for game ${gameId} requested`);

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      const game = await database.get('SELECT * FROM games WHERE id = ? AND user_id = ?', [gameId, req.userId]);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Get analysis data for accuracy calculation using centralized calculator
      const analysis = await database.all(`
        SELECT a.move_number, a.centipawn_loss
        FROM analysis a
        INNER JOIN games g ON a.game_id = g.id
        WHERE a.game_id = ? AND g.user_id = ?
        ORDER BY a.move_number
      `, [gameId, req.userId]);
      
      const gameWithAnalysis = {
        ...game,
        analysis
      };
      
      const whiteAccuracy = AccuracyCalculator.calculatePlayerAccuracy(analysis, game.white_player, game.white_player, game.black_player);
      const blackAccuracy = AccuracyCalculator.calculatePlayerAccuracy(analysis, game.black_player, game.white_player, game.black_player);
      
      const isPlayerWhite = game.white_player === TARGET_PLAYER;
      
      res.json({
        playerAccuracy: isPlayerWhite ? whiteAccuracy : blackAccuracy,
        opponentAccuracy: isPlayerWhite ? blackAccuracy : whiteAccuracy,
        whiteAccuracy,
        blackAccuracy
      });
    } catch (error) {
      console.error('[NEW CONTROLLER] Accuracy calculation error:', error);
      res.status(500).json({ error: 'Failed to calculate accuracy' });
    }
  }

  /**
   * Get performance metrics for a game
   * GET /api/games/:id/performance
   */
  async getPerformance(req, res) {
    try {
      const gameId = parseInt(req.params.id);
      console.log(`📈 [GAME CONTROLLER] Performance for game ${gameId} requested`);

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      const game = await database.get('SELECT * FROM games WHERE id = ? AND user_id = ?', [gameId, req.userId]);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Extract opening from PGN content (same logic as other endpoints)
      let opening = 'Unknown';
      if (game.pgn_content) {
        // Try to get ECO from PGN headers first
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
        SELECT a.move_number, a.centipawn_loss
        FROM analysis a
        INNER JOIN games g ON a.game_id = g.id
        WHERE a.game_id = ? AND g.user_id = ?
        ORDER BY a.move_number
      `, [gameId, req.userId]);

      // Calculate player-specific metrics using AccuracyCalculator
      const isPlayerWhite = game.white_player === TARGET_PLAYER;

      // Filter player moves
      const playerMoves = analysis.filter(move =>
        (isPlayerWhite && move.move_number % 2 === 1) ||
        (!isPlayerWhite && move.move_number % 2 === 0)
      );

      // Calculate accuracy using AccuracyCalculator
      const playerAccuracy = AccuracyCalculator.calculatePlayerAccuracy(
        analysis,
        TARGET_PLAYER,
        game.white_player,
        game.black_player
      );

      // Count blunders from blunder_details table (only target player's blunders)
      const blunderCount = await database.get(`
        SELECT COUNT(*) as count
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.game_id = ?
          AND bd.is_blunder = ?
          AND g.user_id = ?
          AND ((g.white_player = ? AND bd.player_color = 'white')
            OR (g.black_player = ? AND bd.player_color = 'black'))
      `, [gameId, true, req.userId, TARGET_PLAYER, TARGET_PLAYER]);

      const playerBlunders = parseInt(blunderCount?.count) || 0;
      
      res.json({
        gameId: gameId,
        playerColor: isPlayerWhite ? 'white' : 'black',
        accuracy: Math.round(playerAccuracy),
        blunders: playerBlunders,
        moves: playerMoves.length,
        totalMoves: analysis.length,
        opening: opening
      });
    } catch (error) {
      console.error('[GAME CONTROLLER] Performance calculation error:', error);
      res.status(500).json({ error: 'Failed to calculate performance' });
    }
  }

  /**
   * Get phase analysis for a game
   * GET /api/games/:id/phases
   */
  async getPhases(req, res) {
    try {
      const gameId = parseInt(req.params.id);
      console.log(`🔍 [GAME CONTROLLER] Phases for game ${gameId} requested`);

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      const game = await database.get('SELECT * FROM games WHERE id = ? AND user_id = ?', [gameId, req.userId]);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      const analysis = await database.all(`
        SELECT a.*
        FROM analysis a
        INNER JOIN games g ON a.game_id = g.id
        WHERE a.game_id = ? AND g.user_id = ?
        ORDER BY a.move_number
      `, [gameId, req.userId]);
      
      if (analysis.length === 0) {
        return res.json({
          opening: { accuracy: 0, description: 'No analysis available' },
          middlegame: { accuracy: 0, description: 'No analysis available' },
          endgame: { accuracy: 0, description: 'No analysis available' }
        });
      }
      
      // Divide game into phases
      const totalMoves = analysis.length;
      const openingEnd = Math.min(20, Math.floor(totalMoves * 0.3));
      const middlegameEnd = Math.floor(totalMoves * 0.7);
      
      const openingMoves = analysis.slice(0, openingEnd);
      const middlegameMoves = analysis.slice(openingEnd, middlegameEnd);
      const endgameMoves = analysis.slice(middlegameEnd);
      
      const isPlayerWhite = game.white_player === TARGET_PLAYER;
      
      const getPlayerMoves = (moves) => moves.filter(move => 
        (isPlayerWhite && move.move_number % 2 === 1) ||
        (!isPlayerWhite && move.move_number % 2 === 0)
      );
      
      const playerOpeningMoves = getPlayerMoves(openingMoves);
      const playerMiddlegameMoves = getPlayerMoves(middlegameMoves);
      const playerEndgameMoves = getPlayerMoves(endgameMoves);
      
      // Use AccuracyCalculator for consistent accuracy calculation
      const calculatePhaseAccuracy = (moves) => {
        if (moves.length === 0) return 0;
        const avgCPL = moves.reduce((sum, move) => sum + move.centipawn_loss, 0) / moves.length;
        return Math.max(0, Math.min(100, 100 - (avgCPL / 3))); // Same formula as AccuracyCalculator
      };
      
      const openingAccuracy = calculatePhaseAccuracy(playerOpeningMoves);
      const middlegameAccuracy = calculatePhaseAccuracy(playerMiddlegameMoves);
      const endgameAccuracy = calculatePhaseAccuracy(playerEndgameMoves);
      
      const getPhaseDescription = (accuracy, blunders) => {
        if (accuracy >= 90) return `Excellent play, very precise moves`;
        if (accuracy >= 80) return `Good performance with minor inaccuracies`;
        if (blunders > 0) return `${blunders} major mistake${blunders > 1 ? 's' : ''} in this phase`;
        return `Room for improvement in this phase`;
      };
      
      // Count blunders by phase from blunder_details table (only target player's blunders)
      const openingBlunderCount = await database.get(`
        SELECT COUNT(*) as count
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.game_id = ?
          AND bd.phase = 'opening'
          AND bd.is_blunder = ?
          AND g.user_id = ?
          AND ((g.white_player = ? AND bd.player_color = 'white')
            OR (g.black_player = ? AND bd.player_color = 'black'))
      `, [gameId, true, req.userId, TARGET_PLAYER, TARGET_PLAYER]);

      const middlegameBlunderCount = await database.get(`
        SELECT COUNT(*) as count
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.game_id = ?
          AND bd.phase = 'middlegame'
          AND bd.is_blunder = ?
          AND g.user_id = ?
          AND ((g.white_player = ? AND bd.player_color = 'white')
            OR (g.black_player = ? AND bd.player_color = 'black'))
      `, [gameId, true, req.userId, TARGET_PLAYER, TARGET_PLAYER]);

      const endgameBlunderCount = await database.get(`
        SELECT COUNT(*) as count
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.game_id = ?
          AND bd.phase = 'endgame'
          AND bd.is_blunder = ?
          AND g.user_id = ?
          AND ((g.white_player = ? AND bd.player_color = 'white')
            OR (g.black_player = ? AND bd.player_color = 'black'))
      `, [gameId, true, req.userId, TARGET_PLAYER, TARGET_PLAYER]);

      const openingBlunders = parseInt(openingBlunderCount?.count) || 0;
      const middlegameBlunders = parseInt(middlegameBlunderCount?.count) || 0;
      const endgameBlunders = parseInt(endgameBlunderCount?.count) || 0;
      
      res.json({
        opening: {
          accuracy: Math.round(openingAccuracy),
          description: getPhaseDescription(openingAccuracy, openingBlunders)
        },
        middlegame: {
          accuracy: Math.round(middlegameAccuracy),
          description: getPhaseDescription(middlegameAccuracy, middlegameBlunders)
        },
        endgame: {
          accuracy: Math.round(endgameAccuracy),
          description: getPhaseDescription(endgameAccuracy, endgameBlunders)
        }
      });
    } catch (error) {
      console.error('[GAME CONTROLLER] Phase analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze phases' });
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

module.exports = new GameController();
