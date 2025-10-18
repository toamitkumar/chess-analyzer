const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Configuration - TODO: Replace with logged-in user when auth is implemented
const TARGET_PLAYER = 'AdvaitKumar1213';

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/chess_analysis.db');
    this.db = null;
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Database connection failed:', err.message);
          reject(err);
        } else {
          console.log('✅ Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  async initialize() {
    if (!this.db) {
      await this.connect();
    }
    
    await this.createTables();
    await this.runMigrations();
    await this.initializePerformanceMetrics();
    console.log('✅ Database initialized successfully');
  }

  async createTables() {
    const tables = [
      // Games table (base schema)
      `CREATE TABLE IF NOT EXISTS games (
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
      )`,
      
      // Analysis table
      `CREATE TABLE IF NOT EXISTS analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,
        move TEXT NOT NULL,
        evaluation REAL,
        centipawn_loss INTEGER,
        best_move TEXT,
        alternatives TEXT,
        is_blunder BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )`,
      
      // Performance metrics table
      `CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        color TEXT NOT NULL UNIQUE,
        total_games INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        total_moves INTEGER DEFAULT 0,
        total_blunders INTEGER DEFAULT 0,
        total_centipawn_loss INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Migration tracking table
      `CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      await this.run(
        `INSERT OR IGNORE INTO performance_metrics (color) VALUES (?)`,
        [color]
      );
    }
  }

  // Utility methods
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('❌ Database run error:', err.message);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('❌ Database get error:', err.message);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('❌ Database all error:', err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
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
      INSERT INTO analysis (game_id, move_number, move, evaluation, centipawn_loss, best_move, alternatives, is_blunder, time_spent, time_remaining)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      gameId,
      analysisData.move_number || 1, // Use move_number from analyzer
      analysisData.move || '',
      analysisData.evaluation || 0,
      analysisData.centipawn_loss || 0, // Use centipawn_loss from analyzer
      analysisData.best_move || '', // Use best_move from analyzer
      JSON.stringify(analysisData.alternatives || []),
      analysisData.is_blunder || false, // Use is_blunder from analyzer
      analysisData.timeSpent || 0,
      analysisData.timeRemaining || 0
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
    
    const wins = gameResult === '1-0' && playerColor === 'white' || gameResult === '0-1' && playerColor === 'black' ? 1 : 0;
    const draws = gameResult === '1/2-1/2' ? 1 : 0;
    const losses = wins === 0 && draws === 0 ? 1 : 0;
    
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
    const sql = `
      INSERT OR REPLACE INTO phase_stats 
      (game_id, opening_accuracy, middlegame_accuracy, endgame_accuracy, 
       opening_blunders, middlegame_blunders, endgame_blunders,
       opening_moves, middlegame_moves, endgame_moves)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
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
    
    return await this.run(sql, params);
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
        total_blunders = (SELECT COUNT(*) FROM analysis WHERE is_blunder = 1 AND game_id IN (SELECT id FROM games)),
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
        total_blunders = (SELECT COUNT(*) FROM analysis WHERE is_blunder = 1 AND game_id IN (SELECT id FROM games)),
        total_centipawn_loss = (SELECT COALESCE(SUM(centipawn_loss), 0) FROM analysis WHERE game_id IN (SELECT id FROM games)),
        last_updated = CURRENT_TIMESTAMP
      WHERE color = 'black'
    `);
  }

  async getPerformanceMetrics() {
    // Get player-specific statistics for configured target player
    const playerName = TARGET_PLAYER;

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
    `, [playerName, playerName, playerName, playerName, playerName, playerName]);

    // Get analysis statistics
    const analysisStats = await this.get(`
      SELECT 
        COUNT(*) as total_moves,
        COUNT(CASE WHEN is_blunder = 1 THEN 1 END) as total_blunders,
        COALESCE(SUM(centipawn_loss), 0) as total_centipawn_loss
      FROM analysis a
      JOIN games g ON a.game_id = g.id
    `);

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

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('❌ Database close error:', err.message);
          } else {
            console.log('✅ Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
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
