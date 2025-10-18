const { TournamentAnalyzer } = require('../src/models/tournament-analyzer');
const { Database } = require('../src/models/database');
const fs = require('fs');
const path = require('path');

describe('TournamentAnalyzer', () => {
  let tournamentAnalyzer;
  let testDb;
  let testDbPath;
  let tournamentId;

  beforeEach(async () => {
    // Create temporary test database
    testDbPath = path.join(__dirname, '../data/test_tournament_analyzer.db');
    
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

    await testDb.run(`
      CREATE TABLE analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,
        move TEXT NOT NULL,
        evaluation REAL,
        centipawn_loss INTEGER,
        best_move TEXT,
        alternatives TEXT,
        is_blunder BOOLEAN DEFAULT FALSE
      )
    `);

    // Create test tournament
    const tournamentResult = await testDb.run(`
      INSERT INTO tournaments (name, event_type, location)
      VALUES (?, ?, ?)
    `, ['Test Tournament', 'blitz', 'Online']);
    
    tournamentId = tournamentResult.id;

    // Create tournament analyzer with test database
    tournamentAnalyzer = new TournamentAnalyzer();
    tournamentAnalyzer.db = testDb;
  });

  afterEach(async () => {
    await testDb.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('getTournamentPerformance', () => {
    test('should calculate tournament performance metrics', async () => {
      // Add test games
      const game1 = await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'Player1', 'Player2', '1-0', tournamentId]);

      const game2 = await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'Player3', 'Player4', '0-1', tournamentId]);

      const game3 = await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'Player5', 'Player6', '1/2-1/2', tournamentId]);

      // Add analysis data
      await testDb.run(`
        INSERT INTO analysis (game_id, move_number, move, evaluation, centipawn_loss, best_move, is_blunder)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [game1.id, 1, 'e4', 0.2, 20, 'e4', 0]);

      await testDb.run(`
        INSERT INTO analysis (game_id, move_number, move, evaluation, centipawn_loss, best_move, is_blunder)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [game1.id, 2, 'e5', -0.1, 150, 'd4', 1]);

      const performance = await tournamentAnalyzer.getTournamentPerformance(tournamentId);

      expect(performance.totalGames).toBe(3);
      expect(performance.whiteWins).toBe(1);
      expect(performance.blackWins).toBe(1);
      expect(performance.draws).toBe(1);
      expect(performance.whiteWinRate).toBe(33); // 1/3 * 100
      expect(performance.blackWinRate).toBe(33);
      expect(performance.drawRate).toBe(33);
      expect(performance.totalMoves).toBe(2);
      expect(performance.totalBlunders).toBe(1);
    });

    test('should handle tournament with no games', async () => {
      const performance = await tournamentAnalyzer.getTournamentPerformance(tournamentId);

      expect(performance.totalGames).toBe(0);
      expect(performance.whiteWinRate).toBe(0);
      expect(performance.blackWinRate).toBe(0);
      expect(performance.avgAccuracy).toBe(0);
      expect(performance.totalBlunders).toBe(0);
    });
  });

  describe('compareTournaments', () => {
    test('should compare multiple tournaments', async () => {
      // Create second tournament
      const tournament2 = await testDb.run(`
        INSERT INTO tournaments (name, event_type)
        VALUES (?, ?)
      `, ['Tournament 2', 'rapid']);

      // Add games to both tournaments
      await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'P1', 'P2', '1-0', tournamentId]);

      await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'P3', 'P4', '0-1', tournament2.id]);

      const comparison = await tournamentAnalyzer.compareTournaments([tournamentId, tournament2.id]);

      expect(comparison).toHaveLength(2);
      expect(comparison[0].tournament.name).toBe('Test Tournament');
      expect(comparison[1].tournament.name).toBe('Tournament 2');
      expect(comparison[0].performance.totalGames).toBe(1);
      expect(comparison[1].performance.totalGames).toBe(1);
    });
  });

  describe('getTournamentHeatmap', () => {
    test('should generate tournament-specific heatmap', async () => {
      // Add game with blunder analysis
      const game = await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'Player1', 'Player2', '1-0', tournamentId]);

      await testDb.run(`
        INSERT INTO analysis (game_id, move_number, move, evaluation, centipawn_loss, best_move, is_blunder)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [game.id, 1, 'Qh5', -0.5, 120, 'e4', 1]);

      const heatmap = await tournamentAnalyzer.getTournamentHeatmap(tournamentId);

      expect(heatmap).toHaveLength(64); // 8x8 board
      
      const h5Square = heatmap.find(square => square.square === 'h5');
      expect(h5Square.count).toBe(1);
      expect(h5Square.severity).toBe(120);
      expect(h5Square.intensity).toBeGreaterThan(0);
    });
  });

  describe('getTournamentTrends', () => {
    test('should calculate tournament trends over time', async () => {
      // Add games with different accuracies
      const game1 = await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['db', 'P1', 'P2', '1-0', tournamentId, '2024-01-01 10:00:00']);

      const game2 = await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['db', 'P3', 'P4', '0-1', tournamentId, '2024-01-01 11:00:00']);

      // Add analysis with different centipawn losses
      await testDb.run(`
        INSERT INTO analysis (game_id, move_number, move, centipawn_loss, is_blunder)
        VALUES (?, ?, ?, ?, ?)
      `, [game1.id, 1, 'e4', 50, 0]);

      await testDb.run(`
        INSERT INTO analysis (game_id, move_number, move, centipawn_loss, is_blunder)
        VALUES (?, ?, ?, ?, ?)
      `, [game2.id, 1, 'e4', 20, 0]);

      const trends = await tournamentAnalyzer.getTournamentTrends(tournamentId);

      expect(trends).toHaveLength(2);
      expect(trends[0].gameNumber).toBe(1);
      expect(trends[1].gameNumber).toBe(2);
      expect(trends[0].gameId).toBe(game1.id);
      expect(trends[1].gameId).toBe(game2.id);
      expect(trends[1].accuracy).toBeGreaterThan(trends[0].accuracy); // Better accuracy in game 2
    });
  });

  describe('rankTournaments', () => {
    test('should rank tournaments by performance', async () => {
      // Create second tournament
      const tournament2 = await testDb.run(`
        INSERT INTO tournaments (name, event_type, total_games)
        VALUES (?, ?, ?)
      `, ['Better Tournament', 'rapid', 1]);

      // Update first tournament game count
      await testDb.run('UPDATE tournaments SET total_games = 1 WHERE id = ?', [tournamentId]);

      // Add games with different performance levels
      const game1 = await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'P1', 'P2', '1-0', tournamentId]);

      const game2 = await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'P3', 'P4', '1-0', tournament2.id]);

      // Add analysis - tournament2 has better accuracy
      await testDb.run(`
        INSERT INTO analysis (game_id, move_number, move, centipawn_loss)
        VALUES (?, ?, ?, ?)
      `, [game1.id, 1, 'e4', 80]); // Lower accuracy

      await testDb.run(`
        INSERT INTO analysis (game_id, move_number, move, centipawn_loss)
        VALUES (?, ?, ?, ?)
      `, [game2.id, 1, 'e4', 20]); // Higher accuracy

      const rankings = await tournamentAnalyzer.rankTournaments();

      expect(rankings).toHaveLength(2);
      expect(rankings[0].tournament.name).toBe('Better Tournament'); // Should rank higher
      expect(rankings[0].score).toBeGreaterThan(rankings[1].score);
    });
  });

  describe('getFilteredPerformance', () => {
    test('should get overall performance when no tournament specified', async () => {
      // Add test game
      const game = await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'Player1', 'Player2', '1-0', tournamentId]);

      await testDb.run(`
        INSERT INTO analysis (game_id, move_number, move, centipawn_loss)
        VALUES (?, ?, ?, ?)
      `, [game.id, 1, 'e4', 30]);

      const performance = await tournamentAnalyzer.getFilteredPerformance();

      expect(performance.white.games).toBe(1);
      expect(performance.white.winRate).toBe(100);
      expect(performance.black.games).toBe(1);
      expect(performance.black.winRate).toBe(0);
    });

    test('should get tournament-filtered performance', async () => {
      // Create second tournament
      const tournament2 = await testDb.run(`
        INSERT INTO tournaments (name, event_type)
        VALUES (?, ?)
      `, ['Tournament 2', 'rapid']);

      // Add games to both tournaments
      await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'P1', 'P2', '1-0', tournamentId]);

      await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['db', 'P3', 'P4', '0-1', tournament2.id]);

      const performance = await tournamentAnalyzer.getFilteredPerformance(tournamentId);

      expect(performance.white.games).toBe(1);
      expect(performance.white.winRate).toBe(100); // Only tournament 1 game counted
    });
  });

  describe('calculateConsistency', () => {
    test('should calculate consistency score', () => {
      const consistentAccuracies = [85, 87, 86, 88, 85]; // Low variance
      const inconsistentAccuracies = [60, 95, 70, 90, 65]; // High variance

      const consistentScore = tournamentAnalyzer.calculateConsistency(consistentAccuracies);
      const inconsistentScore = tournamentAnalyzer.calculateConsistency(inconsistentAccuracies);

      expect(consistentScore).toBeGreaterThan(inconsistentScore);
      expect(consistentScore).toBeGreaterThan(90); // Should be high
      expect(inconsistentScore).toBeLessThan(90); // Should be lower
    });

    test('should handle edge cases', () => {
      expect(tournamentAnalyzer.calculateConsistency([])).toBe(100);
      expect(tournamentAnalyzer.calculateConsistency([85])).toBe(100);
    });
  });

  describe('getTournamentSummary', () => {
    test('should generate comprehensive tournament summary', async () => {
      // Add games with trends
      const game1 = await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['db', 'P1', 'P2', '1-0', tournamentId, '2024-01-01 10:00:00']);

      const game2 = await testDb.run(`
        INSERT INTO games (pgn_file_path, white_player, black_player, result, tournament_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['db', 'P3', 'P4', '0-1', tournamentId, '2024-01-01 11:00:00']);

      // Add analysis
      await testDb.run(`
        INSERT INTO analysis (game_id, move_number, move, centipawn_loss)
        VALUES (?, ?, ?, ?)
      `, [game1.id, 1, 'e4', 60]);

      await testDb.run(`
        INSERT INTO analysis (game_id, move_number, move, centipawn_loss)
        VALUES (?, ?, ?, ?)
      `, [game2.id, 1, 'e4', 20]);

      const summary = await tournamentAnalyzer.getTournamentSummary(tournamentId);

      expect(summary.tournament.name).toBe('Test Tournament');
      expect(summary.performance.totalGames).toBe(2);
      expect(summary.trends).toHaveLength(2);
      expect(summary.insights.bestGame).toBeTruthy();
      expect(summary.insights.worstGame).toBeTruthy();
      expect(summary.insights.improvement).toBeGreaterThan(0); // Should show improvement
    });
  });
});
