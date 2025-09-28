const fs = require('fs');
const path = require('path');

class Migration001 {
  constructor(database) {
    this.db = database;
    this.version = 1;
    this.name = 'add_pgn_content_and_tournaments';
  }

  async up() {
    console.log('🔄 Running migration: Add PGN content and tournaments');
    
    // Add new columns to games table
    await this.db.run(`ALTER TABLE games ADD COLUMN pgn_content TEXT`);
    await this.db.run(`ALTER TABLE games ADD COLUMN content_hash TEXT`);
    await this.db.run(`ALTER TABLE games ADD COLUMN tournament_id INTEGER`);
    
    // Create tournaments table
    await this.db.run(`
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
    
    // Create indexes
    await this.db.run(`CREATE INDEX idx_games_tournament_id ON games(tournament_id)`);
    await this.db.run(`CREATE INDEX idx_games_content_hash ON games(content_hash)`);
    await this.db.run(`CREATE INDEX idx_tournaments_name ON tournaments(name)`);
    
    // Migrate existing file-based games to database storage
    await this.migrateExistingGames();
    
    console.log('✅ Migration completed: PGN content and tournaments added');
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove PGN content and tournaments');
    
    // Drop indexes
    await this.db.run(`DROP INDEX IF EXISTS idx_games_tournament_id`);
    await this.db.run(`DROP INDEX IF EXISTS idx_games_content_hash`);
    await this.db.run(`DROP INDEX IF EXISTS idx_tournaments_name`);
    
    // Drop tournaments table
    await this.db.run(`DROP TABLE IF EXISTS tournaments`);
    
    // Note: SQLite doesn't support DROP COLUMN, so we can't remove the added columns
    // In a real production environment, you'd create a new table and migrate data
    
    console.log('✅ Migration rolled back');
  }

  async migrateExistingGames() {
    try {
      const { getFileStorage } = require('../file-storage');
      const fileStorage = getFileStorage();
      
      // Get all existing games without PGN content
      const games = await this.db.all(`
        SELECT id, pgn_file_path, white_player, black_player, event 
        FROM games 
        WHERE pgn_content IS NULL AND pgn_file_path != 'memory'
      `);
      
      console.log(`📁 Migrating ${games.length} existing games from file storage...`);
      
      for (const game of games) {
        try {
          if (fs.existsSync(game.pgn_file_path)) {
            // Read PGN content from file
            const pgnContent = fileStorage.readPGNFile(game.pgn_file_path);
            const contentHash = require('crypto').createHash('sha256').update(pgnContent).digest('hex');
            
            // Create or find tournament
            const tournamentId = await this.findOrCreateTournament(game.event || 'Unknown Tournament');
            
            // Update game with PGN content
            await this.db.run(`
              UPDATE games 
              SET pgn_content = ?, content_hash = ?, tournament_id = ?
              WHERE id = ?
            `, [pgnContent, contentHash, tournamentId, game.id]);
            
            console.log(`✅ Migrated game ${game.id}: ${game.white_player} vs ${game.black_player}`);
          } else {
            console.log(`⚠️ File not found for game ${game.id}: ${game.pgn_file_path}`);
          }
        } catch (error) {
          console.error(`❌ Failed to migrate game ${game.id}:`, error.message);
        }
      }
      
      // Update tournament game counts
      await this.updateTournamentCounts();
      
    } catch (error) {
      console.error('❌ Migration of existing games failed:', error.message);
      // Don't throw - migration should continue even if file migration fails
    }
  }

  async findOrCreateTournament(eventName) {
    // Try to find existing tournament
    let tournament = await this.db.get(`SELECT id FROM tournaments WHERE name = ?`, [eventName]);
    
    if (!tournament) {
      // Create new tournament
      const result = await this.db.run(`
        INSERT INTO tournaments (name, event_type) 
        VALUES (?, ?)
      `, [eventName, this.classifyEventType(eventName)]);
      
      tournament = { id: result.id };
      console.log(`🏆 Created tournament: ${eventName}`);
    }
    
    return tournament.id;
  }

  classifyEventType(eventName) {
    const name = eventName.toLowerCase();
    if (name.includes('blitz')) return 'blitz';
    if (name.includes('rapid')) return 'rapid';
    if (name.includes('classical')) return 'classical';
    if (name.includes('bullet')) return 'bullet';
    return 'standard';
  }

  async updateTournamentCounts() {
    await this.db.run(`
      UPDATE tournaments 
      SET total_games = (
        SELECT COUNT(*) 
        FROM games 
        WHERE tournament_id = tournaments.id
      )
    `);
  }
}

module.exports = Migration001;
