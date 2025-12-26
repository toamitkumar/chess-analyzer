/**
 * Migration Compatibility Test
 * Verifies that all migrations work correctly on both SQLite and PostgreSQL
 */

const { getDatabase } = require('../../src/models/database');
const fs = require('fs');
const path = require('path');

describe('Migration Compatibility', () => {
  let database;
  const testDbPath = path.join(__dirname, '../data/test_migrations.db');

  beforeAll(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterAll(async () => {
    await database.close();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(async () => {
    // Initialize fresh database
    database = getDatabase();
    await database.initialize();
  });

  test('all migrations should complete without errors', async () => {
    // Check that all migrations were applied
    const migrations = await database.all(
      'SELECT * FROM migrations ORDER BY version'
    );

    expect(migrations.length).toBeGreaterThan(0);

    // Verify migrations are in order
    for (let i = 0; i < migrations.length; i++) {
      expect(migrations[i].version).toBe(i + 1);
    }

    console.log(`✓ Successfully applied ${migrations.length} migrations`);
  });

  test('boolean columns should work on both databases', async () => {
    // Test boolean column functionality
    const game = await database.run(`
      INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['test.pgn', 'Player1', 'Player2', '1-0', '2024-01-01', 'Test', 'test']);

    await database.insertAnalysis(game.lastID, {
      move_number: 1,
      move: 'e4',
      fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      best_move: 'e4',
      is_blunder: true,
      is_mistake: false,
      is_inaccuracy: false,
      categorization: {
        phase: 'opening',
        tactical_theme: 'test',
        position_type: 'tactical',
        blunder_severity: 'major',
        difficulty_level: 3
      }
    });

    // Verify boolean values work correctly
    const analysis = await database.get(
      'SELECT is_blunder, is_mistake, is_inaccuracy FROM analysis WHERE game_id = ?',
      [game.lastID]
    );

    // Both SQLite (0/1) and PostgreSQL (true/false) should be truthy/falsy
    expect(analysis.is_blunder).toBeTruthy();
    expect(analysis.is_mistake).toBeFalsy();
    expect(analysis.is_inaccuracy).toBeFalsy();
  });

  test('foreign key cascades should work', async () => {
    // Create a game
    const game = await database.run(`
      INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, pgn_content)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['test.pgn', 'Player1', 'Player2', '1-0', '2024-01-01', 'Test', 'test']);

    // Add analysis
    await database.insertAnalysis(game.lastID, {
      move_number: 1,
      move: 'e4',
      fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      best_move: 'e4',
      is_blunder: true,
      categorization: {
        phase: 'opening',
        tactical_theme: 'test',
        position_type: 'tactical',
        blunder_severity: 'major',
        difficulty_level: 3
      }
    });

    // Verify analysis exists
    const analysisBefore = await database.all(
      'SELECT * FROM analysis WHERE game_id = ?',
      [game.lastID]
    );
    expect(analysisBefore.length).toBe(1);

    // Delete the game - analysis should be cascaded
    await database.run('DELETE FROM games WHERE id = ?', [game.lastID]);

    // Verify analysis was deleted
    const analysisAfter = await database.all(
      'SELECT * FROM analysis WHERE game_id = ?',
      [game.lastID]
    );
    expect(analysisAfter.length).toBe(0);
  });

  test('all required tables should exist', async () => {
    // Core tables created by migrations
    const requiredTables = [
      'games',
      'analysis',
      'performance_metrics',
      'migrations',
      'tournaments',
      'phase_analysis',
      'opening_analysis',
      'alternative_moves',
      'position_evaluations',
      'chess_openings',
      'blunder_details'
    ];

    for (const tableName of requiredTables) {
      // SQLite way to check if table exists
      const table = await database.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
      );

      expect(table).toBeDefined();
      if (table) {
        expect(table.name).toBe(tableName);
      }
    }
  });

  test('migrations should be idempotent', async () => {
    // Running migrations again should not cause errors
    await database.runMigrations();

    // All migrations should still be marked as applied
    const migrations = await database.all(
      'SELECT * FROM migrations ORDER BY version'
    );

    expect(migrations.length).toBeGreaterThan(0);
  });

  test('database types should be compatible', async () => {
    const types = database.getSQLTypes();

    expect(types).toHaveProperty('idType');
    expect(types).toHaveProperty('timestampType');
    expect(types).toHaveProperty('textType');
    expect(types).toHaveProperty('boolType');

    // Verify TEXT type works
    expect(types.textType).toBe('TEXT');

    // Verify BOOLEAN type works
    expect(types.boolType).toBe('BOOLEAN');
  });
});
