class Migration003 {
  constructor(database) {
    this.db = database;
    this.version = 3;
    this.name = 'add_game_analysis_tables';
  }

  async up() {
    console.log('🔄 Running migration: Add game analysis tables for alternative moves and position evaluations');
    
    // Alternative moves table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS alternative_moves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,
        alternative_move TEXT NOT NULL,
        evaluation INTEGER NOT NULL,
        depth INTEGER NOT NULL,
        line_moves TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id)
      )
    `);
    
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_alternative_moves_game_move ON alternative_moves(game_id, move_number)
    `);
    
    // Position evaluations table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS position_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,
        fen TEXT NOT NULL,
        evaluation INTEGER NOT NULL,
        best_move TEXT NOT NULL,
        depth INTEGER NOT NULL,
        mate_in INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id)
      )
    `);
    
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_position_evaluations_game_move ON position_evaluations(game_id, move_number)
    `);
    
    console.log('✅ Game analysis tables created successfully');
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove game analysis tables');
    
    await this.db.run('DROP INDEX IF EXISTS idx_alternative_moves_game_move');
    await this.db.run('DROP INDEX IF EXISTS idx_position_evaluations_game_move');
    await this.db.run('DROP TABLE IF EXISTS alternative_moves');
    await this.db.run('DROP TABLE IF EXISTS position_evaluations');
    
    console.log('✅ Game analysis tables removed');
  }
}

module.exports = Migration003;
