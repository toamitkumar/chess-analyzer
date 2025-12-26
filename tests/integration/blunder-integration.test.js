const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../src/models/database');
const { TARGET_PLAYER } = require('../../src/config/app-config');
const ChessAnalyzer = require('../../src/models/analyzer');

describe('Blunder Integration Tests', () => {
  let database;
  let app;
  let gameId;

  beforeAll(async () => {
    // Initialize database
    database = getDatabase();
    await database.initialize();

    // Create minimal Express app for API testing
    app = express();
    app.use(express.json());

    // Mock API endpoints
    app.get('/api/games/:id/blunders', async (req, res) => {
      try {
        const gameId = parseInt(req.params.id);
        const blunders = await database.all(`
          SELECT bd.*
          FROM blunder_details bd
          WHERE bd.game_id = ? AND bd.is_blunder = ?
          ORDER BY bd.move_number
        `, [gameId, true]);
        res.json(blunders);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/tournaments/:id/player-performance', async (req, res) => {
      try {
        const tournamentId = parseInt(req.params.id);
        const games = await database.all(`
          SELECT id, white_player, black_player
          FROM games
          WHERE tournament_id = ?
        `, [tournamentId]);

        let totalBlunders = 0;
        for (const game of games) {
          const blunderCount = await database.get(`
            SELECT COUNT(*) as count
            FROM blunder_details bd
            JOIN games g ON bd.game_id = g.id
            WHERE bd.game_id = ?
              AND bd.is_blunder = ?
              AND ((g.white_player = ? AND bd.player_color = 'white')
                OR (g.black_player = ? AND bd.player_color = 'black'))
          `, [game.id, true, TARGET_PLAYER, TARGET_PLAYER]);
          totalBlunders += blunderCount?.count || 0;
        }

        res.json({ totalBlunders });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up test data - delete in correct order for foreign key constraints
    // Child tables first, then parent tables
    await database.run('DELETE FROM blunder_details');
    await database.run('DELETE FROM alternative_moves');
    await database.run('DELETE FROM position_evaluations');
    await database.run('DELETE FROM analysis');
    await database.run('DELETE FROM games');
    await database.run('DELETE FROM tournaments');
  });

  describe('Complete Flow: Analysis → Database → API', () => {
    test('should complete full blunder flow from analysis to API', async () => {
      // Step 1: Create a game
      const game = await database.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']);
      gameId = game.lastID;

      // Step 2: Simulate analyzer creating analysis with blunder
      const blunderAnalysis = {
        move_number: 1,
        move: 'f3',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        fen_after: 'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1',
        evaluation: -200,
        centipawn_loss: 200,
        best_move: 'e4',
        is_blunder: true,
        is_mistake: false,
        is_inaccuracy: false,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 3
        }
      };

      // Step 3: Insert analysis (should auto-populate blunder_details)
      await database.insertAnalysis(gameId, blunderAnalysis);

      // Step 4: Verify database state
      const analysisRecords = await database.all(
        'SELECT * FROM analysis WHERE game_id = ?',
        [gameId]
      );
      expect(analysisRecords.length).toBe(1);
      expect(analysisRecords[0].is_blunder).toBe(1);

      const blunderRecords = await database.all(
        'SELECT * FROM blunder_details WHERE game_id = ?',
        [gameId]
      );
      expect(blunderRecords.length).toBe(1);
      expect(blunderRecords[0].is_blunder).toBe(1);
      expect(blunderRecords[0].player_color).toBe('white');

      // Step 5: Query via API
      const response = await request(app)
        .get(`/api/games/${gameId}/blunders`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].player_move).toBe('f3');
      expect(response.body[0].is_blunder).toBe(1);
      expect(response.body[0].tactical_theme).toBe('hanging_piece');
    });

    test('should filter for target player only in tournament performance', async () => {
      // Create tournament
      const tournament = await database.run(`
        INSERT INTO tournaments (name, start_date, location)
        VALUES (?, ?, ?)
      `, ['Test Tournament', '2024-01-01', 'Test Location']);
      const tournamentId = tournament.lastID;

      // Create game 1: Target player is white
      const game1 = await database.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content, tournament_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, ['test1.pgn', TARGET_PLAYER, 'Opponent1', '1-0', '2024-01-01', 'Test', 'test', tournamentId]);

      // Create game 2: Target player is black
      const game2 = await database.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content, tournament_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, ['test2.pgn', 'Opponent2', TARGET_PLAYER, '0-1', '2024-01-01', 'Test', 'test', tournamentId]);

      // Add blunders for all players
      // Game 1: Target player (white) blunders
      await database.insertAnalysis(game1.lastID, {
        move_number: 1,
        move: 'f3',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 3
        }
      });

      // Game 1: Opponent (black) blunders
      await database.insertAnalysis(game1.lastID, {
        move_number: 2,
        move: 'e6',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1',
        best_move: 'e5',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 3
        }
      });

      // Game 2: Opponent (white) blunders
      await database.insertAnalysis(game2.lastID, {
        move_number: 1,
        move: 'f3',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 3
        }
      });

      // Game 2: Target player (black) blunders
      await database.insertAnalysis(game2.lastID, {
        move_number: 2,
        move: 'e6',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1',
        best_move: 'e5',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 3
        }
      });

      // Query tournament performance
      const response = await request(app)
        .get(`/api/tournaments/${tournamentId}/player-performance`)
        .expect(200);

      // Should only count target player's 2 blunders, not all 4
      expect(response.body.totalBlunders).toBe(2);
    });

    test('should distinguish between blunders, mistakes, and inaccuracies', async () => {
      const game = await database.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']);
      gameId = game.lastID;

      // Add one of each type
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'f3',
        fen_before: 'start',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 3
        }
      });

      await database.insertAnalysis(gameId, {
        move_number: 3,
        move: 'd4',
        fen_before: 'start',
        best_move: 'Nf3',
        is_mistake: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'positional',
          position_type: 'positional',
          blunder_severity: 'moderate',
          difficulty_level: 2
        }
      });

      await database.insertAnalysis(gameId, {
        move_number: 5,
        move: 'Nc3',
        fen_before: 'start',
        best_move: 'Nf3',
        is_inaccuracy: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'opening_theory',
          position_type: 'positional',
          blunder_severity: 'minor',
          difficulty_level: 1
        }
      });

      // Query blunders only
      const blundersResponse = await request(app)
        .get(`/api/games/${gameId}/blunders`)
        .expect(200);

      // Should only return actual blunders, not mistakes or inaccuracies
      expect(blundersResponse.body.length).toBe(1);
      expect(blundersResponse.body[0].is_blunder).toBe(1);
      expect(blundersResponse.body[0].is_mistake).toBe(0);
      expect(blundersResponse.body[0].is_inaccuracy).toBe(0);
    });

    test('should handle games with no blunders', async () => {
      const game = await database.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']);
      gameId = game.lastID;

      // Add only good moves (no blunders)
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'e4',
        fen_before: 'start',
        is_blunder: false,
        is_mistake: false,
        is_inaccuracy: false,
        // No categorization for good moves
      });

      const response = await request(app)
        .get(`/api/games/${gameId}/blunders`)
        .expect(200);

      expect(response.body.length).toBe(0);
    });
  });

  describe('Configuration Integration', () => {
    test('should use TARGET_PLAYER from config', () => {
      expect(TARGET_PLAYER).toBeDefined();
      expect(typeof TARGET_PLAYER).toBe('string');
      expect(TARGET_PLAYER.length).toBeGreaterThan(0);
    });

    test('should respect environment variable override', () => {
      // This test verifies that the config system is set up correctly
      // The actual value depends on whether TARGET_PLAYER env var is set
      const { TARGET_PLAYER: configPlayer } = require('../../src/config/app-config');

      if (process.env.TARGET_PLAYER) {
        expect(configPlayer).toBe(process.env.TARGET_PLAYER);
      } else {
        expect(configPlayer).toBe('AdvaitKumar1213'); // Default value
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle multiple blunders in same game', async () => {
      const game = await database.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']);
      gameId = game.lastID;

      // Add 5 blunders
      for (let i = 1; i <= 5; i++) {
        await database.insertAnalysis(gameId, {
          move_number: i * 2 - 1, // Odd numbers for white
          move: `move${i}`,
          fen_before: 'start',
          best_move: 'e4',
          is_blunder: true,
          categorization: {
            phase: 'opening',
            tactical_theme: 'hanging_piece',
            position_type: 'tactical',
            blunder_severity: 'major',
            difficulty_level: 3
          }
        });
      }

      const response = await request(app)
        .get(`/api/games/${gameId}/blunders`)
        .expect(200);

      expect(response.body.length).toBe(5);
    });

    test('should handle missing categorization gracefully', async () => {
      const game = await database.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']);
      gameId = game.lastID;

      // Try to insert blunder without categorization
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'f3',
        fen_before: 'start',
        best_move: 'e4',
        is_blunder: true,
        categorization: null // Missing
      });

      // Should not crash, just skip insertion to blunder_details
      const response = await request(app)
        .get(`/api/games/${gameId}/blunders`)
        .expect(200);

      expect(response.body.length).toBe(0);
    });

    test('should handle missing fen_before gracefully', async () => {
      const game = await database.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']);
      gameId = game.lastID;

      // Try to insert blunder without fen_before
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'f3',
        fen_before: null, // Missing
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 3
        }
      });

      // Should not crash, just skip insertion to blunder_details
      const response = await request(app)
        .get(`/api/games/${gameId}/blunders`)
        .expect(200);

      expect(response.body.length).toBe(0);
    });
  });
});
