const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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

  // Analysis operations (unchanged)
  async insertAnalysis(gameId, analysisData) {
    const sql = `
      INSERT INTO analysis (game_id, move_number, move, evaluation, centipawn_loss, best_move, alternatives, is_blunder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const results = [];
    for (const moveAnalysis of analysisData) {
      const params = [
        gameId,
        moveAnalysis.moveNumber,
        moveAnalysis.move,
        moveAnalysis.evaluation,
        moveAnalysis.centipawnLoss,
        moveAnalysis.bestMove,
        JSON.stringify(moveAnalysis.alternatives || []),
        moveAnalysis.centipawnLoss > 100 ? 1 : 0
      ];
      
      const result = await this.run(sql, params);
      results.push(result);
    }
    
    return results;
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
    const metrics = await this.all('SELECT * FROM performance_metrics');
    const result = {};
    
    metrics.forEach(metric => {
      const winRate = metric.total_games > 0 ? Math.round((metric.wins / metric.total_games) * 100) : 0;
      const avgAccuracy = metric.total_moves > 0 ? Math.max(0, Math.min(100, 100 - (metric.total_centipawn_loss / metric.total_moves / 8))) : 0;
      
      result[metric.color] = {
        games: metric.total_games,
        winRate: winRate,
        avgAccuracy: Math.round(avgAccuracy),
        blunders: metric.total_blunders
      };
    });
    
    // Calculate overall metrics
    const totalGames = (result.white?.games || 0) + (result.black?.games || 0);
    const totalBlunders = (result.white?.blunders || 0) + (result.black?.blunders || 0);
    const avgAccuracy = totalGames > 0 ? Math.round(((result.white?.avgAccuracy || 0) + (result.black?.avgAccuracy || 0)) / 2) : 0;
    
    result.overall = {
      avgAccuracy: avgAccuracy,
      totalBlunders: totalBlunders
    };
    
    return result;
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
