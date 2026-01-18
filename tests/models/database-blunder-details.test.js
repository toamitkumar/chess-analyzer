const { getDatabase } = require('../../src/models/database');
const { TARGET_PLAYER } = require('../../src/config/app-config');

describe('Database - Blunder Details', () => {
  let database;

  beforeAll(async () => {
    database = getDatabase();
    await database.initialize();
    
    // Ensure migrations are run for test database
    await database.runMigrations();
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
  });

  describe('insertBlunderDetails', () => {
    test('should insert blunder with is_blunder flag', async () => {
      // Create a test game
      const gameId = await database.run(
        `INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']
      );

      // Create analysis data for a blunder
      const analysisData = {
        move_number: 5, // Odd = white's move
        move: 'Qh5',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        fen_after: 'rnbqkbnr/pppppppp/8/7Q/8/8/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
        evaluation: -200,
        centipawn_loss: 200,
        best_move: 'Nf3',
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

      // Insert into analysis table first
      await database.insertAnalysis(gameId.lastID, analysisData);

      // Verify blunder_details was populated
      const blunders = await database.all(
        'SELECT * FROM blunder_details WHERE game_id = ?',
        [gameId.lastID]
      );

      expect(blunders.length).toBe(1);
      expect(blunders[0].is_blunder).toBe(1);
      expect(blunders[0].is_mistake).toBe(0);
      expect(blunders[0].is_inaccuracy).toBe(0);
      expect(blunders[0].player_color).toBe('white');
      expect(blunders[0].tactical_theme).toBe('hanging_piece');
      expect(blunders[0].blunder_severity).toBe('major');
    });

    test('should insert mistake with is_mistake flag', async () => {
      const gameId = await database.run(
        `INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']
      );

      const analysisData = {
        move_number: 6, // Even = black's move
        move: 'Nc6',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        fen_after: 'r1bqkbnr/pppppppp/2n5/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 1 2',
        evaluation: -100,
        centipawn_loss: 100,
        best_move: 'Nf6',
        is_blunder: false,
        is_mistake: true,
        is_inaccuracy: false,
        categorization: {
          phase: 'opening',
          tactical_theme: 'positional',
          position_type: 'positional',
          blunder_severity: 'moderate',
          difficulty_level: 2
        }
      };

      await database.insertAnalysis(gameId.lastID, analysisData);

      const mistakes = await database.all(
        'SELECT * FROM blunder_details WHERE game_id = ?',
        [gameId.lastID]
      );

      expect(mistakes.length).toBe(1);
      expect(mistakes[0].is_blunder).toBe(0);
      expect(mistakes[0].is_mistake).toBe(1);
      expect(mistakes[0].is_inaccuracy).toBe(0);
      expect(mistakes[0].player_color).toBe('black');
    });

    test('should insert inaccuracy with is_inaccuracy flag', async () => {
      const gameId = await database.run(
        `INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']
      );

      const analysisData = {
        move_number: 7,
        move: 'd4',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        fen_after: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
        evaluation: -30,
        centipawn_loss: 30,
        best_move: 'e4',
        is_blunder: false,
        is_mistake: false,
        is_inaccuracy: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'opening_theory',
          position_type: 'positional',
          blunder_severity: 'minor',
          difficulty_level: 1
        }
      };

      await database.insertAnalysis(gameId.lastID, analysisData);

      const inaccuracies = await database.all(
        'SELECT * FROM blunder_details WHERE game_id = ?',
        [gameId.lastID]
      );

      expect(inaccuracies.length).toBe(1);
      expect(inaccuracies[0].is_blunder).toBe(0);
      expect(inaccuracies[0].is_mistake).toBe(0);
      expect(inaccuracies[0].is_inaccuracy).toBe(1);
      expect(inaccuracies[0].player_color).toBe('white');
    });

    test('should correctly determine player_color based on move_number', async () => {
      const gameId = await database.run(
        `INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']
      );

      // Test odd move numbers (white's moves)
      for (let moveNum of [1, 3, 5, 7, 9]) {
        const analysisData = {
          move_number: moveNum,
          move: 'e4',
          fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          fen_after: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          best_move: 'Nf3',
          is_blunder: true,
          categorization: {
            phase: 'opening',
            tactical_theme: 'test',
            position_type: 'tactical',
            blunder_severity: 'minor',
            difficulty_level: 1
          }
        };

        await database.insertAnalysis(gameId.lastID, analysisData);
      }

      // Test even move numbers (black's moves)
      for (let moveNum of [2, 4, 6, 8, 10]) {
        const analysisData = {
          move_number: moveNum,
          move: 'e5',
          fen_before: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          fen_after: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
          best_move: 'Nf6',
          is_blunder: true,
          categorization: {
            phase: 'opening',
            tactical_theme: 'test',
            position_type: 'tactical',
            blunder_severity: 'minor',
            difficulty_level: 1
          }
        };

        await database.insertAnalysis(gameId.lastID, analysisData);
      }

      const allBlunders = await database.all(
        'SELECT player_color, move_number FROM blunder_details WHERE game_id = ? ORDER BY move_number',
        [gameId.lastID]
      );

      expect(allBlunders.length).toBe(10);

      // When ordered by move_number (1,2,3,4,5,6,7,8,9,10), they should alternate
      // Odd move numbers (1,3,5,7,9) = white
      // Even move numbers (2,4,6,8,10) = black
      for (let i = 0; i < 10; i++) {
        const expectedColor = (i + 1) % 2 === 1 ? 'white' : 'black';
        expect(allBlunders[i].player_color).toBe(expectedColor);
        expect(allBlunders[i].move_number).toBe(i + 1);
      }
    });

    test('should not insert into blunder_details if fen_before is missing', async () => {
      const gameId = await database.run(
        `INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']
      );

      const analysisData = {
        move_number: 5,
        move: 'Qh5',
        fen_before: null, // Missing fen_before
        fen_after: 'rnbqkbnr/pppppppp/8/7Q/8/8/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 3
        }
      };

      await database.insertAnalysis(gameId.lastID, analysisData);

      const blunders = await database.all(
        'SELECT * FROM blunder_details WHERE game_id = ?',
        [gameId.lastID]
      );

      // Should not insert when fen_before is missing
      expect(blunders.length).toBe(0);
    });

    test('should not insert into blunder_details if categorization is missing', async () => {
      const gameId = await database.run(
        `INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']
      );

      const analysisData = {
        move_number: 5,
        move: 'Qh5',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        fen_after: 'rnbqkbnr/pppppppp/8/7Q/8/8/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
        is_blunder: true,
        categorization: null // Missing categorization
      };

      await database.insertAnalysis(gameId.lastID, analysisData);

      const blunders = await database.all(
        'SELECT * FROM blunder_details WHERE game_id = ?',
        [gameId.lastID]
      );

      // Should not insert when categorization is missing
      expect(blunders.length).toBe(0);
    });
  });

  describe('Blunder filtering by player', () => {
    let whiteGameId, blackGameId;

    beforeEach(async () => {
      // Create game where target player is white
      const whiteGame = await database.run(
        `INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']
      );
      whiteGameId = whiteGame.lastID;

      // Create game where target player is black
      const blackGame = await database.run(
        `INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['Opponent', TARGET_PLAYER, '0-1', '2024-01-01', 'Test Event', 'test pgn']
      );
      blackGameId = blackGame.lastID;

      // Add blunders for both players in each game
      // White game: target player (white) makes blunder on move 1
      await database.insertAnalysis(whiteGameId, {
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
          difficulty_level: 2
        }
      });

      // White game: opponent (black) makes blunder on move 2
      await database.insertAnalysis(whiteGameId, {
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
          difficulty_level: 2
        }
      });

      // Black game: opponent (white) makes blunder on move 1
      await database.insertAnalysis(blackGameId, {
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
          difficulty_level: 2
        }
      });

      // Black game: target player (black) makes blunder on move 2
      await database.insertAnalysis(blackGameId, {
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
          difficulty_level: 2
        }
      });
    });

    test('should filter blunders for target player only', async () => {
      // Query for target player's blunders only
      const targetPlayerBlunders = await database.all(`
        SELECT bd.*, g.white_player, g.black_player
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.is_blunder = ?
          AND ((g.white_player = ? AND bd.player_color = 'white')
            OR (g.black_player = ? AND bd.player_color = 'black'))
      `, [true, TARGET_PLAYER, TARGET_PLAYER]);

      // Should only return 2 blunders (one from each game where target player blundered)
      expect(targetPlayerBlunders.length).toBe(2);

      // Verify they are target player's blunders
      targetPlayerBlunders.forEach(blunder => {
        if (blunder.white_player === TARGET_PLAYER) {
          expect(blunder.player_color).toBe('white');
        } else {
          expect(blunder.player_color).toBe('black');
        }
      });
    });

    test('should return correct count for target player blunders per game', async () => {
      // Count blunders for white game
      const whiteGameCount = await database.get(`
        SELECT COUNT(*) as count
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.game_id = ?
          AND bd.is_blunder = ?
          AND ((g.white_player = ? AND bd.player_color = 'white')
            OR (g.black_player = ? AND bd.player_color = 'black'))
      `, [whiteGameId, true, TARGET_PLAYER, TARGET_PLAYER]);

      expect(whiteGameCount.count).toBe(1);

      // Count blunders for black game
      const blackGameCount = await database.get(`
        SELECT COUNT(*) as count
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.game_id = ?
          AND bd.is_blunder = ?
          AND ((g.white_player = ? AND bd.player_color = 'white')
            OR (g.black_player = ? AND bd.player_color = 'black'))
      `, [blackGameId, true, TARGET_PLAYER, TARGET_PLAYER]);

      expect(blackGameCount.count).toBe(1);
    });

    test('should distinguish between blunders, mistakes, and inaccuracies', async () => {
      // Add a mistake and inaccuracy for target player
      await database.insertAnalysis(whiteGameId, {
        move_number: 3,
        move: 'd4',
        fen_before: 'rnbqkbnr/pppp1ppp/4p3/8/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
        best_move: 'e4',
        is_mistake: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'positional',
          position_type: 'positional',
          blunder_severity: 'moderate',
          difficulty_level: 2
        }
      });

      await database.insertAnalysis(whiteGameId, {
        move_number: 5,
        move: 'Nc3',
        fen_before: 'rnbqkbnr/pppp1ppp/4p3/8/3P4/5P2/PPP1P1PP/RNBQKBNR b KQkq - 0 3',
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
      const blunders = await database.all(`
        SELECT COUNT(*) as count
        FROM blunder_details
        WHERE game_id = ? AND is_blunder = ?
      `, [whiteGameId, true]);

      // Query mistakes only
      const mistakes = await database.all(`
        SELECT COUNT(*) as count
        FROM blunder_details
        WHERE game_id = ? AND is_mistake = ?
      `, [whiteGameId, true]);

      // Query inaccuracies only
      const inaccuracies = await database.all(`
        SELECT COUNT(*) as count
        FROM blunder_details
        WHERE game_id = ? AND is_inaccuracy = ?
      `, [whiteGameId, true]);

      expect(blunders[0].count).toBe(2); // 2 blunders (white and black)
      expect(mistakes[0].count).toBe(1); // 1 mistake
      expect(inaccuracies[0].count).toBe(1); // 1 inaccuracy
    });
  });

  describe('Piece Type Extraction (ADR 009 Phase 5.2)', () => {
    let gameId;

    beforeEach(async () => {
      // Create a test game
      const game = await database.run(
        `INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['test.pgn', TARGET_PLAYER, 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test pgn']
      );
      gameId = game.lastID;
    });

    test('should extract Pawn (P) for lowercase moves like e4, d5', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'e4',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'd4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('P');
    });

    test('should extract Knight (N) for Nf3, Nc6 moves', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'Nf3',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('N');
    });

    test('should extract Bishop (B) for Bc4, Bb5 moves', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'Bc4',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('B');
    });

    test('should extract Rook (R) for Rd1, Re8 moves', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'Rd1',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('R');
    });

    test('should extract Queen (Q) for Qd2, Qh5 moves', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'Qh5',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('Q');
    });

    test('should extract King (K) for Ke2, Kd2 moves', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'Ke2',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('K');
    });

    test('should extract King (K) for O-O (kingside castling)', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'O-O',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('K');
    });

    test('should extract King (K) for O-O-O (queenside castling)', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'O-O-O',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('K');
    });

    test('should extract King (K) for 0-0 (alternate castling notation)', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: '0-0',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('K');
    });

    test('should extract Pawn (P) for pawn capture moves like exd5', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'exd5',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'd4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('P');
    });

    test('should handle moves with check indicator (+)', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'Qh5+',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('Q');
    });

    test('should handle moves with checkmate indicator (#)', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'Qf7#',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('Q');
    });

    test('should handle piece capture moves like Nxe5', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'Nxe5',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('N');
    });

    test('should not insert blunder when move is null/empty', async () => {
      // When move is null, the blunder details cannot be inserted due to NOT NULL constraint on player_move
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: null,
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      // Blunder should not be inserted when move is null
      expect(blunder).toBeUndefined();
    });

    test('should handle disambiguation moves like Nbd2, R1d2', async () => {
      await database.insertAnalysis(gameId, {
        move_number: 1,
        move: 'Nbd2',
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        best_move: 'e4',
        is_blunder: true,
        categorization: {
          phase: 'opening',
          tactical_theme: 'hanging_piece',
          position_type: 'tactical',
          blunder_severity: 'major',
          difficulty_level: 2
        }
      });

      const blunder = await database.get(
        'SELECT piece_type FROM blunder_details WHERE game_id = ?',
        [gameId]
      );

      expect(blunder.piece_type).toBe('N');
    });
  });
});
