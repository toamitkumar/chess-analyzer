const path = require('path');
const fs = require('fs');
const db = require('../config/database');

// Configuration - TODO: Replace with logged-in user when auth is implemented
const TARGET_PLAYER = 'AdvaitKumar1213';

class Database {
  constructor() {
    // Use different database for testing vs development
    const isTestEnvironment = process.env.NODE_ENV === 'test';
    const dbFileName = isTestEnvironment ? 'chess_analysis_test.db' : 'chess_analysis.db';
    this.dbPath = path.join(__dirname, '../../data', dbFileName);
    this.db = db; // Use the dual database layer
    this.usePostgres = !!process.env.DATABASE_URL;
    this.ensureDataDirectory();
  }

  // Helper method for database-agnostic SQL types
  getSQLTypes() {
    return {
      idType: this.usePostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT',
      timestampType: this.usePostgres ? 'TIMESTAMP' : 'DATETIME',
      textType: 'TEXT',
      boolType: 'BOOLEAN'
    };
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  async connect() {
    // Database connection is handled automatically by the config/database layer
    console.log('✅ Database connection ready (dual-mode: SQLite/PostgreSQL)');
  }

  async initialize() {
    await this.connect();
    await this.createTables();
    await this.runMigrations();
    await this.initializePerformanceMetrics();
    console.log('✅ Database initialized successfully');
  }

  async createTables() {
    const { idType, timestampType, textType, boolType } = this.getSQLTypes();

    const tables = [
      // Games table (base schema)
      `CREATE TABLE IF NOT EXISTS games (
        id ${idType},
        pgn_file_path ${textType} NOT NULL,
        white_player ${textType} NOT NULL,
        black_player ${textType} NOT NULL,
        result ${textType} NOT NULL,
        date ${textType},
        event ${textType},
        white_elo INTEGER,
        black_elo INTEGER,
        moves_count INTEGER,
        created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP
      )`,

      // Analysis table
      `CREATE TABLE IF NOT EXISTS analysis (
        id ${idType},
        game_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,
        move ${textType} NOT NULL,
        evaluation REAL,
        centipawn_loss INTEGER,
        best_move ${textType},
        alternatives ${textType},
        is_blunder ${boolType} DEFAULT FALSE,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )`,

      // Performance metrics table
      `CREATE TABLE IF NOT EXISTS performance_metrics (
        id ${idType},
        color ${textType} NOT NULL UNIQUE,
        total_games INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        total_moves INTEGER DEFAULT 0,
        total_blunders INTEGER DEFAULT 0,
        total_centipawn_loss INTEGER DEFAULT 0,
        last_updated ${timestampType} DEFAULT CURRENT_TIMESTAMP
      )`,

      // Migration tracking table
      `CREATE TABLE IF NOT EXISTS migrations (
        id ${idType},
        version INTEGER NOT NULL UNIQUE,
        name ${textType} NOT NULL,
        applied_at ${timestampType} DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create base indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_games_result ON games(result)',
      'CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)',
      'CREATE INDEX IF NOT EXISTS idx_analysis_game_id ON analysis(game_id)',
      'CREATE INDEX IF NOT EXISTS idx_analysis_blunder ON analysis(is_blunder)',
      'CREATE INDEX IF NOT EXISTS idx_performance_color ON performance_metrics(color)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }
  }

  async runMigrations() {
    try {
      const migrationsDir = path.join(__dirname, 'migrations');
      
      if (!fs.existsSync(migrationsDir)) {
        console.log('📁 No migrations directory found, skipping migrations');
        return;
      }

      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.js'))
        .sort();

      for (const file of migrationFiles) {
        const migrationPath = path.join(migrationsDir, file);
        const Migration = require(migrationPath);
        const migration = new Migration(this);

        // Check if migration already applied
        const applied = await this.get(
          'SELECT * FROM migrations WHERE version = ?',
          [migration.version]
        );

        if (!applied) {
          console.log(`🔄 Applying migration: ${migration.name}`);
          await migration.up();
          
          // Record migration as applied
          await this.run(
            'INSERT INTO migrations (version, name) VALUES (?, ?)',
            [migration.version, migration.name]
          );
          
          console.log(`✅ Migration applied: ${migration.name}`);
        } else {
          console.log(`⏭️ Migration already applied: ${migration.name}`);
        }
      }
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }

  async initializePerformanceMetrics() {
    // Initialize white and black performance metrics if they don't exist
    const colors = ['white', 'black'];

    for (const color of colors) {
      if (this.usePostgres) {
        // PostgreSQL: INSERT ... ON CONFLICT DO NOTHING
        await this.run(
          `INSERT INTO performance_metrics (color) VALUES ($1) ON CONFLICT (color) DO NOTHING`,
          [color]
        );
      } else {
        // SQLite: INSERT OR IGNORE
        await this.run(
          `INSERT OR IGNORE INTO performance_metrics (color) VALUES (?)`,
          [color]
        );
      }
    }
  }

  // Utility methods - now using dual database layer
  async run(sql, params = []) {
    try {
      return await this.db.run(sql, params);
    } catch (err) {
      console.error('❌ Database run error:', err.message);
      throw err;
    }
  }

  async get(sql, params = []) {
    try {
      return await this.db.get(sql, params);
    } catch (err) {
      console.error('❌ Database get error:', err.message);
      throw err;
    }
  }

  async all(sql, params = []) {
    try {
      return await this.db.query(sql, params);
    } catch (err) {
      console.error('❌ Database all error:', err.message);
      throw err;
    }
  }

  // Game operations (updated for database storage)
  async insertGame(gameData, pgnContent = null) {
    const contentHash = pgnContent ? 
      require('crypto').createHash('sha256').update(pgnContent).digest('hex') : null;

    const sql = `
      INSERT INTO games (pgn_file_path, white_player, black_player, result, date, event, white_elo, black_elo, moves_count, pgn_content, content_hash, tournament_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      gameData.pgnFilePath || 'database',
      gameData.whitePlayer,
      gameData.blackPlayer,
      gameData.result,
      gameData.date,
      gameData.event,
      gameData.whiteElo,
      gameData.blackElo,
      gameData.movesCount,
      pgnContent,
      contentHash,
      gameData.tournamentId || null
    ];
    
    return await this.run(sql, params);
  }

  // Check for duplicate PGN content
  async findGameByContentHash(contentHash) {
    return await this.get(
      'SELECT id FROM games WHERE content_hash = ?',
      [contentHash]
    );
  }

  // Tournament operations
  async insertTournament(tournamentData) {
    const sql = `
      INSERT INTO tournaments (name, event_type, location, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const params = [
      tournamentData.name,
      tournamentData.eventType,
      tournamentData.location,
      tournamentData.startDate,
      tournamentData.endDate
    ];
    
    return await this.run(sql, params);
  }

  async findTournamentByName(name) {
    return await this.get('SELECT * FROM tournaments WHERE name = ?', [name]);
  }

  async getAllTournaments() {
    return await this.all('SELECT * FROM tournaments ORDER BY created_at DESC');
  }

  // Analysis operations
  async insertAnalysis(gameId, analysisData) {
    const sql = `
      INSERT INTO analysis (
        game_id, move_number, move, evaluation, centipawn_loss, best_move, alternatives,
        is_blunder, is_mistake, is_inaccuracy, fen_after, time_spent, time_remaining,
        move_quality, move_accuracy, win_probability_before, win_probability_after,
        is_best, is_excellent, is_good
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      gameId,
      analysisData.move_number || 1,
      analysisData.move || '',
      analysisData.evaluation || 0,
      analysisData.centipawn_loss || 0,
      analysisData.best_move || '',
      JSON.stringify(analysisData.alternatives || []),
      analysisData.is_blunder || false,
      analysisData.is_mistake || false,
      analysisData.is_inaccuracy || false,
      analysisData.fen_after || null,
      analysisData.timeSpent || 0,
      analysisData.timeRemaining || 0,
      // New Lichess/Chess.com style fields
      analysisData.move_quality || null,
      analysisData.move_accuracy || null,
      analysisData.win_probability_before || null,
      analysisData.win_probability_after || null,
      analysisData.is_best || false,
      analysisData.is_excellent || false,
      analysisData.is_good || false
    ];

    return await this.run(sql, params);
  }

  // Phase analysis operations
  async insertPhaseAnalysis(gameId, phaseData) {
    const sql = `
      INSERT INTO phase_analysis (game_id, phase, accuracy, blunders, centipawn_loss, time_spent, move_start, move_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      gameId,
      phaseData.phase,
      phaseData.accuracy,
      phaseData.blunders,
      phaseData.centipawnLoss,
      phaseData.timeSpent || 0,
      phaseData.moveStart,
      phaseData.moveEnd
    ];
    
    return await this.run(sql, params);
  }

  async getPhaseAnalysis(gameId) {
    return await this.all('SELECT * FROM phase_analysis WHERE game_id = ?', [gameId]);
  }

  // Opening analysis operations
  async insertOpeningAnalysis(gameId, openingData) {
    const sql = `
      INSERT INTO opening_analysis (game_id, eco_code, opening_name, moves_in_book, first_deviation_move, evaluation_at_deviation, player_color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      gameId,
      openingData.ecoCode,
      openingData.openingName,
      openingData.movesInBook,
      openingData.firstDeviationMove,
      openingData.evaluationAtDeviation,
      openingData.playerColor
    ];
    
    return await this.run(sql, params);
  }

  async updateOpeningStats(ecoCode, playerColor, gameResult, accuracy, blunders) {
    const wins = gameResult === '1-0' && playerColor === 'white' || gameResult === '0-1' && playerColor === 'black' ? 1 : 0;
    const draws = gameResult === '1/2-1/2' ? 1 : 0;
    const losses = wins === 0 && draws === 0 ? 1 : 0;

    if (this.usePostgres) {
      // PostgreSQL: INSERT ... ON CONFLICT ... DO UPDATE
      const sql = `
        INSERT INTO opening_stats
        (eco_code, player_color, games_played, wins, draws, losses, avg_accuracy, total_blunders, last_played)
        VALUES ($1, $2, 1, $3, $4, $5, $6, $7, CURRENT_DATE)
        ON CONFLICT (eco_code, player_color) DO UPDATE SET
          games_played = opening_stats.games_played + 1,
          wins = opening_stats.wins + $3,
          draws = opening_stats.draws + $4,
          losses = opening_stats.losses + $5,
          avg_accuracy = $6,
          total_blunders = opening_stats.total_blunders + $7,
          last_played = CURRENT_DATE
      `;
      const params = [ecoCode, playerColor, wins, draws, losses, accuracy, blunders];
      return await this.run(sql, params);
    } else {
      // SQLite: INSERT OR REPLACE
      const sql = `
        INSERT OR REPLACE INTO opening_stats
        (eco_code, player_color, games_played, wins, draws, losses, avg_accuracy, total_blunders, last_played)
        VALUES (
          ?, ?,
          COALESCE((SELECT games_played FROM opening_stats WHERE eco_code = ? AND player_color = ?), 0) + 1,
          COALESCE((SELECT wins FROM opening_stats WHERE eco_code = ? AND player_color = ?), 0) + ?,
          COALESCE((SELECT draws FROM opening_stats WHERE eco_code = ? AND player_color = ?), 0) + ?,
          COALESCE((SELECT losses FROM opening_stats WHERE eco_code = ? AND player_color = ?), 0) + ?,
          ?, ?, DATE('now')
        )
      `;
      const params = [
        ecoCode, playerColor,
        ecoCode, playerColor,
        ecoCode, playerColor, wins,
        ecoCode, playerColor, draws,
        ecoCode, playerColor, losses,
        accuracy, blunders
      ];
      return await this.run(sql, params);
    }
  }

  // Tactical motifs operations
  async insertTacticalMotif(gameId, motifData) {
    const sql = `
      INSERT INTO tactical_motifs (game_id, move_number, motif_type, missed, difficulty_rating, square, evaluation_loss)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      gameId,
      motifData.moveNumber,
      motifData.motifType,
      motifData.missed || false,
      motifData.difficultyRating || 1,
      motifData.square,
      motifData.evaluationLoss || 0
    ];
    
    return await this.run(sql, params);
  }

  async getTacticalMotifs(gameId) {
    return await this.all('SELECT * FROM tactical_motifs WHERE game_id = ?', [gameId]);
  }

  // Phase statistics operations
  async insertPhaseStats(gameId, statsData) {
    const params = [
      gameId,
      statsData.openingAccuracy || 0,
      statsData.middlegameAccuracy || 0,
      statsData.endgameAccuracy || 0,
      statsData.openingBlunders || 0,
      statsData.middlegameBlunders || 0,
      statsData.endgameBlunders || 0,
      statsData.openingMoves || 0,
      statsData.middlegameMoves || 0,
      statsData.endgameMoves || 0
    ];

    if (this.usePostgres) {
      // PostgreSQL: INSERT ... ON CONFLICT ... DO UPDATE
      const sql = `
        INSERT INTO phase_stats
        (game_id, opening_accuracy, middlegame_accuracy, endgame_accuracy,
         opening_blunders, middlegame_blunders, endgame_blunders,
         opening_moves, middlegame_moves, endgame_moves)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (game_id) DO UPDATE SET
          opening_accuracy = $2,
          middlegame_accuracy = $3,
          endgame_accuracy = $4,
          opening_blunders = $5,
          middlegame_blunders = $6,
          endgame_blunders = $7,
          opening_moves = $8,
          middlegame_moves = $9,
          endgame_moves = $10
      `;
      return await this.run(sql, params);
    } else {
      // SQLite: INSERT OR REPLACE
      const sql = `
        INSERT OR REPLACE INTO phase_stats
        (game_id, opening_accuracy, middlegame_accuracy, endgame_accuracy,
         opening_blunders, middlegame_blunders, endgame_blunders,
         opening_moves, middlegame_moves, endgame_moves)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      return await this.run(sql, params);
    }
  }

  // Performance metrics operations (unchanged)
  async updatePerformanceMetrics() {
    // Update white performance
    await this.run(`
      UPDATE performance_metrics 
      SET 
        total_games = (SELECT COUNT(*) FROM games),
        wins = (SELECT COUNT(*) FROM games WHERE result = '1-0'),
        losses = (SELECT COUNT(*) FROM games WHERE result = '0-1'),
        draws = (SELECT COUNT(*) FROM games WHERE result = '1/2-1/2'),
        total_moves = (SELECT COUNT(*) FROM analysis WHERE game_id IN (SELECT id FROM games)),
        total_blunders = (SELECT COUNT(*) FROM analysis WHERE is_blunder = TRUE AND game_id IN (SELECT id FROM games)),
        total_centipawn_loss = (SELECT COALESCE(SUM(centipawn_loss), 0) FROM analysis WHERE game_id IN (SELECT id FROM games)),
        last_updated = CURRENT_TIMESTAMP
      WHERE color = 'white'
    `);

    // Update black performance
    await this.run(`
      UPDATE performance_metrics 
      SET 
        total_games = (SELECT COUNT(*) FROM games),
        wins = (SELECT COUNT(*) FROM games WHERE result = '0-1'),
        losses = (SELECT COUNT(*) FROM games WHERE result = '1-0'),
        draws = (SELECT COUNT(*) FROM games WHERE result = '1/2-1/2'),
        total_moves = (SELECT COUNT(*) FROM analysis WHERE game_id IN (SELECT id FROM games)),
        total_blunders = (SELECT COUNT(*) FROM analysis WHERE is_blunder = TRUE AND game_id IN (SELECT id FROM games)),
        total_centipawn_loss = (SELECT COALESCE(SUM(centipawn_loss), 0) FROM analysis WHERE game_id IN (SELECT id FROM games)),
        last_updated = CURRENT_TIMESTAMP
      WHERE color = 'black'
    `);
  }

  async getPerformanceMetrics(tournamentId = null) {
    // Get player-specific statistics for configured target player
    const playerName = TARGET_PLAYER;
    
    // Build WHERE clause for tournament filtering
    const tournamentFilter = tournamentId ? 'AND tournament_id = ?' : '';
    const params = tournamentId ? [playerName, playerName, playerName, playerName, playerName, playerName, playerName, playerName, tournamentId] : [playerName, playerName, playerName, playerName, playerName, playerName, playerName, playerName];

    const playerStats = await this.get(`
      SELECT 
        COUNT(*) as total_games,
        -- Games as white
        COUNT(CASE WHEN white_player = ? THEN 1 END) as games_as_white,
        COUNT(CASE WHEN white_player = ? AND result = '1-0' THEN 1 END) as wins_as_white,
        -- Games as black  
        COUNT(CASE WHEN black_player = ? THEN 1 END) as games_as_black,
        COUNT(CASE WHEN black_player = ? AND result = '0-1' THEN 1 END) as wins_as_black,
        -- Overall wins
        COUNT(CASE WHEN (white_player = ? AND result = '1-0') 
                     OR (black_player = ? AND result = '0-1') THEN 1 END) as total_wins
      FROM games
      WHERE (white_player = ? OR black_player = ?) ${tournamentFilter}
    `, params);

    // Get analysis statistics for target player only
    const analysisParams = tournamentId ? [playerName, playerName, tournamentId] : [playerName, playerName];
    const analysisStats = await this.get(`
      SELECT
        COUNT(*) as total_moves,
        COUNT(CASE WHEN is_blunder = TRUE THEN 1 END) as total_blunders,
        COALESCE(SUM(centipawn_loss), 0) as total_centipawn_loss
      FROM analysis a
      JOIN games g ON a.game_id = g.id
      WHERE (g.white_player = ? OR g.black_player = ?) ${tournamentFilter}
    `, analysisParams);

    const totalGames = playerStats.total_games || 0;
    const gamesAsWhite = playerStats.games_as_white || 0;
    const winsAsWhite = playerStats.wins_as_white || 0;
    const gamesAsBlack = playerStats.games_as_black || 0;
    const winsAsBlack = playerStats.wins_as_black || 0;
    const totalMoves = analysisStats.total_moves || 0;
    const totalBlunders = analysisStats.total_blunders || 0;
    const totalCentipawnLoss = analysisStats.total_centipawn_loss || 0;

    // Calculate win rates based on player's performance in each color
    const whiteWinRate = gamesAsWhite > 0 ? Math.round((winsAsWhite / gamesAsWhite) * 100) : 0;
    const blackWinRate = gamesAsBlack > 0 ? Math.round((winsAsBlack / gamesAsBlack) * 100) : 0;
    
    // Calculate overall win rate
    const totalWins = winsAsWhite + winsAsBlack;
    const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
    
    // Calculate accuracy based on centipawn loss (same as analyzer)
    let avgAccuracy = 0;
    if (totalMoves > 0 && totalCentipawnLoss > 0) {
      const averageCentipawnLoss = totalCentipawnLoss / totalMoves;
      avgAccuracy = Math.max(0, Math.min(100, 100 - (averageCentipawnLoss / 25)));
    } else if (totalMoves > 0) {
      // Fallback to blunder-based calculation if no centipawn data
      const nonBlunderMoves = totalMoves - totalBlunders;
      avgAccuracy = Math.round((nonBlunderMoves / totalMoves) * 100);
    }

    return {
      white: {
        games: totalGames,
        winRate: whiteWinRate,
        avgAccuracy: Math.round(avgAccuracy),
        blunders: totalBlunders
      },
      black: {
        games: totalGames,
        winRate: blackWinRate,
        avgAccuracy: Math.round(avgAccuracy),
        blunders: totalBlunders
      },
      overall: {
        avgAccuracy: Math.round(avgAccuracy),
        totalBlunders: totalBlunders,
        overallWinRate: overallWinRate
      }
    };
  }

  // Alternative moves methods
  async storeAlternativeMoves(gameId, moveNumber, alternatives) {
    for (const alt of alternatives) {
      await this.run(`
        INSERT INTO alternative_moves (game_id, move_number, alternative_move, evaluation, depth, line_moves)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [gameId, moveNumber, alt.move, alt.evaluation, alt.depth || 15, alt.line ? alt.line.join(' ') : null]);
    }
  }

  async getAlternativeMoves(gameId, moveNumber) {
    return await this.all(`
      SELECT * FROM alternative_moves 
      WHERE game_id = ? AND move_number = ?
      ORDER BY evaluation DESC
    `, [gameId, moveNumber]);
  }

  // Position evaluation methods
  async storePositionEvaluation(gameId, moveNumber, fen, evaluation, bestMove, depth, mateIn = null) {
    await this.run(`
      INSERT INTO position_evaluations (game_id, move_number, fen, evaluation, best_move, depth, mate_in)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [gameId, moveNumber, fen, evaluation, bestMove, depth, mateIn]);
  }

  async getPositionEvaluation(gameId, moveNumber) {
    return await this.get(`
      SELECT * FROM position_evaluations 
      WHERE game_id = ? AND move_number = ?
    `, [gameId, moveNumber]);
  }

  async getGameAnalysis(gameId) {
    const game = await this.get('SELECT * FROM games WHERE id = ?', [gameId]);
    if (!game) return null;

    const analysis = await this.all(`
      SELECT * FROM analysis WHERE game_id = ? ORDER BY move_number
    `, [gameId]);

    return { game, analysis };
  }

  async close() {
    try {
      if (this.db) {
        await this.db.close();
        console.log('✅ Database connection closed');
      }
    } catch (err) {
      console.error('❌ Database close error:', err.message);
    }
  }
}

// Singleton instance
let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

module.exports = { Database, getDatabase };
