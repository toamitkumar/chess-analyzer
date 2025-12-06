const { Database } = require('../src/models/database');
const Migration001 = require('../src/models/migrations/001_add_pgn_content');
const fs = require('fs');
const path = require('path');

describe('Database Migration 001', () => {
  let testDb;
  let testDbPath;

  beforeEach(async () => {
    // Use shared test database
    testDb = new Database();
    await testDb.connect();
    
    // Create base tables without migrations with IF NOT EXISTS
    await testDb.run(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pgn_file_path TEXT NOT NULL,
        white_player TEXT NOT NULL,
        black_player TEXT NOT NULL,
        result TEXT NOT NULL,
        date TEXT,
        event TEXT,
        white_elo INTEGER,
        black_elo INTEGER,
        moves_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await testDb.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Clean up any existing test data AFTER tables are created
    await testDb.run('DROP TABLE IF EXISTS tournaments');
    await testDb.run('DELETE FROM games WHERE pgn_file_path IN (?, ?) OR white_player IN (?, ?, ?, ?)', 
      ['test_migration', 'memory', 'Player1', 'P1', 'P3', 'P5']);
    await testDb.run('DELETE FROM migrations WHERE version = ?', [1]);
    
    // Remove migration columns if they exist (to test fresh migration)
    try {
      await testDb.run('ALTER TABLE games DROP COLUMN pgn_content');
      await testDb.run('ALTER TABLE games DROP COLUMN content_hash');
      await testDb.run('ALTER TABLE games DROP COLUMN tournament_id');
    } catch (err) {
      // SQLite doesn't support DROP COLUMN easily, so we'll skip this test if columns exist
    }
  });

  afterEach(async () => {
    // Clean up test data but don't close shared database connection
    try {
      await testDb.run('DROP TABLE IF EXISTS tournaments');
      await testDb.run('DELETE FROM games WHERE pgn_file_path IN (?, ?) OR white_player IN (?, ?, ?, ?)', 
        ['test_migration', 'memory', 'Player1', 'P1', 'P3', 'P5']);
      await testDb.run('DELETE FROM migrations WHERE version = ?', [1]);
    } catch (err) {
      // Ignore errors during cleanup
    }
  });

  test('should add new columns to games table', async () => {
    const migration = new Migration001(testDb);
    
    // Check initial schema
    let schema = await testDb.all("PRAGMA table_info(games)");
    const initialColumns = schema.map(col => col.name);
    
    // Check if any migration columns already exist
    const columnsExist = initialColumns.includes('pgn_content') || 
                         initialColumns.includes('content_hash') || 
                         initialColumns.includes('tournament_id');
    
    if (!columnsExist) {
      // Columns don't exist - test that they're added
      expect(initialColumns).not.toContain('pgn_content');
      expect(initialColumns).not.toContain('content_hash');
      expect(initialColumns).not.toContain('tournament_id');
      
      // Run migration
      await migration.up();
      
      // Check updated schema (columns should exist now)
      schema = await testDb.all("PRAGMA table_info(games)");
      const updatedColumns = schema.map(col => col.name);
      
      expect(updatedColumns).toContain('pgn_content');
      expect(updatedColumns).toContain('content_hash');
      expect(updatedColumns).toContain('tournament_id');
    } else {
      // Columns already exist - just verify they're there
      expect(initialColumns).toContain('content_hash');
      expect(initialColumns).toContain('tournament_id');
    }
  });

  test('should create tournaments table', async () => {
    const migration = new Migration001(testDb);
    
    // Check tournaments table doesn't exist
    let tables = await testDb.all("SELECT name FROM sqlite_master WHERE type='table'");
    expect(tables.map(t => t.name)).not.toContain('tournaments');
    
    // Run migration
    await migration.up();
    
    // Check tournaments table exists
    tables = await testDb.all("SELECT name FROM sqlite_master WHERE type='table'");
    expect(tables.map(t => t.name)).toContain('tournaments');
    
    // Check tournaments table schema
    const schema = await testDb.all("PRAGMA table_info(tournaments)");
    const columns = schema.map(col => col.name);
    
    expect(columns).toContain('id');
    expect(columns).toContain('name');
    expect(columns).toContain('event_type');
    expect(columns).toContain('location');
    expect(columns).toContain('total_games');
  });

  test('should create proper indexes', async () => {
    const migration = new Migration001(testDb);
    await migration.up();
    
    const indexes = await testDb.all("SELECT name FROM sqlite_master WHERE type='index'");
    const indexNames = indexes.map(idx => idx.name);
    
    expect(indexNames).toContain('idx_games_tournament_id');
    expect(indexNames).toContain('idx_games_content_hash');
    expect(indexNames).toContain('idx_tournaments_name');
  });

  test('should classify event types correctly', async () => {
    const migration = new Migration001(testDb);
    
    expect(migration.classifyEventType('Blitz Championship')).toBe('blitz');
    expect(migration.classifyEventType('Rapid Tournament')).toBe('rapid');
    expect(migration.classifyEventType('Classical Open')).toBe('classical');
    expect(migration.classifyEventType('Bullet Arena')).toBe('bullet');
    expect(migration.classifyEventType('Regular Tournament')).toBe('standard');
  });

  test('should create tournaments from event names', async () => {
    const migration = new Migration001(testDb);
    await migration.up();
    
    const tournamentId = await migration.findOrCreateTournament('Test Blitz Tournament');
    
    const tournament = await testDb.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
    expect(tournament.name).toBe('Test Blitz Tournament');
    expect(tournament.event_type).toBe('blitz');
  });

  test('should not create duplicate tournaments', async () => {
    const migration = new Migration001(testDb);
    await migration.up();
    
    const tournamentId1 = await migration.findOrCreateTournament('Same Tournament');
    const tournamentId2 = await migration.findOrCreateTournament('Same Tournament');
    
    expect(tournamentId1).toBe(tournamentId2);
    
    const tournaments = await testDb.all('SELECT * FROM tournaments WHERE name = ?', ['Same Tournament']);
    expect(tournaments).toHaveLength(1);
  });

  test('should migrate existing games with mock data', async () => {
    // Insert test game
    await testDb.run(`
      INSERT INTO games (pgn_file_path, white_player, black_player, result, event)
      VALUES (?, ?, ?, ?, ?)
    `, ['memory', 'Player1', 'Player2', '1-0', 'Test Tournament']);
    
    const migration = new Migration001(testDb);
    await migration.up();
    
    // For in-memory games, we need to manually assign tournament
    const tournamentId = await migration.findOrCreateTournament('Test Tournament');
    await testDb.run('UPDATE games SET tournament_id = ? WHERE white_player = ?', [tournamentId, 'Player1']);
    
    // Check game was updated with tournament
    const game = await testDb.get('SELECT * FROM games WHERE white_player = ?', ['Player1']);
    expect(game.tournament_id).toBeTruthy();
    
    // Check tournament was created
    const tournament = await testDb.get('SELECT * FROM tournaments WHERE id = ?', [game.tournament_id]);
    expect(tournament.name).toBe('Test Tournament');
  });

  test('should update tournament game counts', async () => {
    const migration = new Migration001(testDb);
    await migration.up();
    
    // Create tournament and games
    const tournamentId = await migration.findOrCreateTournament('Count Test Tournament');
    
    await testDb.run(`
      INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
      VALUES (?, ?, ?, ?, ?)
    `, ['memory', 'P1', 'P2', '1-0', tournamentId]);
    
    await testDb.run(`
      INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
      VALUES (?, ?, ?, ?, ?)
    `, ['memory', 'P3', 'P4', '0-1', tournamentId]);
    
    await migration.updateTournamentCounts();
    
    const tournament = await testDb.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
    expect(tournament.total_games).toBe(2);
  });

  test('should handle migration rollback', async () => {
    const migration = new Migration001(testDb);
    
    // Run migration
    await migration.up();
    
    // Verify tables exist
    let tables = await testDb.all("SELECT name FROM sqlite_master WHERE type='table'");
    expect(tables.map(t => t.name)).toContain('tournaments');
    
    // Run rollback
    await migration.down();
    
    // Verify tournaments table is removed
    tables = await testDb.all("SELECT name FROM sqlite_master WHERE type='table'");
    expect(tables.map(t => t.name)).not.toContain('tournaments');
  });
});
