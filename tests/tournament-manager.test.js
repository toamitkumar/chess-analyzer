const { TournamentManager } = require('../src/models/tournament-manager');
const { Database } = require('../src/models/database');
const fs = require('fs');
const path = require('path');

describe('TournamentManager', () => {
  let tournamentManager;
  let testDb;
  let testDbPath;

  beforeEach(async () => {
    // Create temporary test database
    testDbPath = path.join(__dirname, '../data/test_tournament.db');
    
    // Remove test db if exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create test database instance
    testDb = new Database();
    testDb.dbPath = testDbPath;
    await testDb.connect();
    
    // Create base tables
    await testDb.run(`
      CREATE TABLE tournaments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        event_type TEXT,
        location TEXT,
        start_date TEXT,
        end_date TEXT,
        total_games INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await testDb.run(`
      CREATE TABLE games (
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
        tournament_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create tournament manager with test database
    tournamentManager = new TournamentManager();
    tournamentManager.db = testDb;
  });

  afterEach(async () => {
    await testDb.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('detectTournament', () => {
    test('should extract tournament info from PGN headers', () => {
      const headers = {
        Event: 'World Championship 2024',
        Site: 'Singapore',
        Date: '2024.03.15'
      };

      const result = tournamentManager.detectTournament(headers);

      expect(result.name).toBe('World Championship 2024');
      expect(result.location).toBe('Singapore');
      expect(result.date).toBe('2024-03-15');
      expect(result.eventType).toBe('standard');
    });

    test('should handle missing headers gracefully', () => {
      const headers = {};

      const result = tournamentManager.detectTournament(headers);

      expect(result.name).toBe('Unknown Tournament');
      expect(result.location).toBeNull();
      expect(result.date).toBeNull();
      expect(result.eventType).toBe('standard');
    });

    test('should handle case-insensitive headers', () => {
      const headers = {
        event: 'Rapid Championship',
        site: 'Online',
        date: '2024.01.01'
      };

      const result = tournamentManager.detectTournament(headers);

      expect(result.name).toBe('Rapid Championship');
      expect(result.location).toBe('Online');
      expect(result.eventType).toBe('rapid');
    });
  });

  describe('classifyEventType', () => {
    test('should classify blitz tournaments', () => {
      expect(tournamentManager.classifyEventType('Blitz Championship')).toBe('blitz');
      expect(tournamentManager.classifyEventType('World Blitz 2024')).toBe('blitz');
    });

    test('should classify rapid tournaments', () => {
      expect(tournamentManager.classifyEventType('Rapid Open')).toBe('rapid');
      expect(tournamentManager.classifyEventType('FIDE Rapid Championship')).toBe('rapid');
    });

    test('should classify classical tournaments', () => {
      expect(tournamentManager.classifyEventType('Classical Tournament')).toBe('classical');
      expect(tournamentManager.classifyEventType('World Classical Championship')).toBe('classical');
    });

    test('should classify bullet tournaments', () => {
      expect(tournamentManager.classifyEventType('Bullet Arena')).toBe('bullet');
    });

    test('should default to standard for unknown types', () => {
      expect(tournamentManager.classifyEventType('Regular Tournament')).toBe('standard');
      expect(tournamentManager.classifyEventType('')).toBe('standard');
      expect(tournamentManager.classifyEventType(null)).toBe('standard');
    });
  });

  describe('parseDate', () => {
    test('should parse valid PGN dates', () => {
      expect(tournamentManager.parseDate('2024.03.15')).toBe('2024-03-15');
      expect(tournamentManager.parseDate('2024.1.5')).toBe('2024-01-05');
    });

    test('should handle invalid dates', () => {
      expect(tournamentManager.parseDate('???.??.??')).toBeNull();
      expect(tournamentManager.parseDate('')).toBeNull();
      expect(tournamentManager.parseDate(null)).toBeNull();
      expect(tournamentManager.parseDate('invalid')).toBeNull();
    });
  });

  describe('findOrCreateTournament', () => {
    test('should create new tournament', async () => {
      const tournamentInfo = {
        name: 'Test Tournament',
        eventType: 'blitz',
        location: 'Online',
        date: '2024-01-01'
      };

      const tournament = await tournamentManager.findOrCreateTournament(tournamentInfo);

      expect(tournament.id).toBeTruthy();
      expect(tournament.name).toBe('Test Tournament');
      expect(tournament.event_type).toBe('blitz');
      expect(tournament.location).toBe('Online');
    });

    test('should find existing tournament', async () => {
      // Create tournament first
      await testDb.run(`
        INSERT INTO tournaments (name, event_type, location)
        VALUES (?, ?, ?)
      `, ['Existing Tournament', 'rapid', 'New York']);

      const tournamentInfo = {
        name: 'Existing Tournament',
        eventType: 'rapid',
        location: 'New York',
        date: '2024-01-01'
      };

      const tournament = await tournamentManager.findOrCreateTournament(tournamentInfo);

      expect(tournament.name).toBe('Existing Tournament');
      expect(tournament.event_type).toBe('rapid');
      
      // Should not create duplicate
      const tournaments = await testDb.all('SELECT * FROM tournaments WHERE name = ?', ['Existing Tournament']);
      expect(tournaments).toHaveLength(1);
    });
  });

  describe('extractPGNHeaders', () => {
    test('should extract headers from PGN content', () => {
      const pgnContent = `
[Event "Test Tournament"]
[Site "Online"]
[Date "2024.01.01"]
[Round "1"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 1-0
      `;

      const headers = tournamentManager.extractPGNHeaders(pgnContent);

      expect(headers.Event).toBe('Test Tournament');
      expect(headers.Site).toBe('Online');
      expect(headers.Date).toBe('2024.01.01');
      expect(headers.White).toBe('Player1');
      expect(headers.Black).toBe('Player2');
      expect(headers.Result).toBe('1-0');
    });

    test('should handle malformed headers', () => {
      const pgnContent = `
[Event "Test Tournament"]
[InvalidHeader
[Site "Online"]
      `;

      const headers = tournamentManager.extractPGNHeaders(pgnContent);

      expect(headers.Event).toBe('Test Tournament');
      expect(headers.Site).toBe('Online');
      expect(headers.InvalidHeader).toBeUndefined();
    });
  });

  describe('processPGNForTournament', () => {
    test('should process PGN and create tournament', async () => {
      const pgnContent = `
[Event "Processing Test Tournament"]
[Site "Test Location"]
[Date "2024.01.01"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 1-0
      `;

      const result = await tournamentManager.processPGNForTournament(pgnContent);

      expect(result.tournament.name).toBe('Processing Test Tournament');
      expect(result.headers.Event).toBe('Processing Test Tournament');
      expect(result.tournamentInfo.name).toBe('Processing Test Tournament');
      expect(result.tournamentInfo.location).toBe('Test Location');
    });
  });

  describe('getTournamentStats', () => {
    test('should calculate tournament statistics', async () => {
      // Create tournament
      const tournamentResult = await testDb.run(`
        INSERT INTO tournaments (name, event_type)
        VALUES (?, ?)
      `, ['Stats Test Tournament', 'standard']);
      
      const tournamentId = tournamentResult.id;

      // Add games
      await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, white_elo, black_elo, tournament_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['db', 'P1', 'P2', '1-0', 1500, 1400, tournamentId]);

      await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, white_elo, black_elo, tournament_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['db', 'P3', 'P4', '0-1', 1600, 1550, tournamentId]);

      await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, white_elo, black_elo, tournament_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['db', 'P5', 'P6', '1/2-1/2', 1700, 1650, tournamentId]);

      const stats = await tournamentManager.getTournamentStats(tournamentId);

      expect(stats.total_games).toBe(3);
      expect(stats.white_wins).toBe(1);
      expect(stats.black_wins).toBe(1);
      expect(stats.draws).toBe(1);
      expect(stats.avg_white_elo).toBe(1600);
      expect(stats.avg_black_elo).toBe(1533.3333333333333);
    });
  });

  describe('updateTournamentGameCount', () => {
    test('should update tournament game count', async () => {
      // Create tournament
      const tournamentResult = await testDb.run(`
        INSERT INTO tournaments (name, event_type, total_games)
        VALUES (?, ?, ?)
      `, ['Count Test Tournament', 'standard', 0]);
      
      const tournamentId = tournamentResult.id;

      // Add games
      await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'P1', 'P2', '1-0', tournamentId]);

      await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'P3', 'P4', '0-1', tournamentId]);

      // Update count
      await tournamentManager.updateTournamentGameCount(tournamentId);

      // Check updated count
      const tournament = await testDb.get('SELECT total_games FROM tournaments WHERE id = ?', [tournamentId]);
      expect(tournament.total_games).toBe(2);
    });
  });

  describe('mergeTournaments', () => {
    test('should merge tournaments correctly', async () => {
      // Create two tournaments
      const tournament1 = await testDb.run(`
        INSERT INTO tournaments (name, event_type)
        VALUES (?, ?)
      `, ['Tournament 1', 'standard']);

      const tournament2 = await testDb.run(`
        INSERT INTO tournaments (name, event_type)
        VALUES (?, ?)
      `, ['Tournament 2', 'standard']);

      // Add games to both tournaments
      await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'P1', 'P2', '1-0', tournament1.id]);

      await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'P3', 'P4', '0-1', tournament2.id]);

      // Merge tournaments
      await tournamentManager.mergeTournaments(tournament1.id, tournament2.id);

      // Check that all games are now in tournament1
      const games = await testDb.all('SELECT * FROM games WHERE tournament_id = ?', [tournament1.id]);
      expect(games).toHaveLength(2);

      // Check that tournament2 is deleted
      const deletedTournament = await testDb.get('SELECT * FROM tournaments WHERE id = ?', [tournament2.id]);
      expect(deletedTournament).toBeUndefined();

      // Check that tournament1 game count is updated
      const tournament = await testDb.get('SELECT total_games FROM tournaments WHERE id = ?', [tournament1.id]);
      expect(tournament.total_games).toBe(2);
    });
  });
});
