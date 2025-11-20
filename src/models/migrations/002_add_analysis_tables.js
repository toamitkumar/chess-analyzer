class Migration002 {
  constructor(database) {
    this.db = database;
    this.version = 2;
    this.name = 'add_phase_opening_tactical_analysis_tables';
  }

  async up() {
    console.log('🔄 Running migration: Add phase, opening, and tactical analysis tables');

    const { idType } = this.db.getSQLTypes();

    // Phase-specific analysis table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS phase_analysis (
        id ${idType},
        game_id INTEGER NOT NULL,
        phase TEXT NOT NULL CHECK (phase IN ('opening', 'middlegame', 'endgame')),
        accuracy REAL DEFAULT 0,
        blunders INTEGER DEFAULT 0,
        centipawn_loss INTEGER DEFAULT 0,
        time_spent INTEGER DEFAULT 0,
        move_start INTEGER,
        move_end INTEGER,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )
    `);

    // Opening analysis table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS opening_analysis (
        id ${idType},
        game_id INTEGER NOT NULL,
        eco_code TEXT,
        opening_name TEXT,
        moves_in_book INTEGER DEFAULT 0,
        first_deviation_move INTEGER,
        evaluation_at_deviation REAL,
        player_color TEXT CHECK (player_color IN ('white', 'black')),
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )
    `);

    // Tactical motifs table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS tactical_motifs (
        id ${idType},
        game_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,
        motif_type TEXT NOT NULL,
        missed BOOLEAN DEFAULT FALSE,
        difficulty_rating INTEGER DEFAULT 1 CHECK (difficulty_rating BETWEEN 1 AND 5),
        square TEXT,
        evaluation_loss REAL DEFAULT 0,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )
    `);

    // Phase statistics summary table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS phase_stats (
        id ${idType},
        game_id INTEGER NOT NULL,
        opening_accuracy REAL DEFAULT 0,
        middlegame_accuracy REAL DEFAULT 0,
        endgame_accuracy REAL DEFAULT 0,
        opening_blunders INTEGER DEFAULT 0,
        middlegame_blunders INTEGER DEFAULT 0,
        endgame_blunders INTEGER DEFAULT 0,
        opening_moves INTEGER DEFAULT 0,
        middlegame_moves INTEGER DEFAULT 0,
        endgame_moves INTEGER DEFAULT 0,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )
    `);

    // Opening repertoire statistics
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS opening_stats (
        id ${idType},
        eco_code TEXT NOT NULL,
        opening_name TEXT,
        player_color TEXT NOT NULL CHECK (player_color IN ('white', 'black')),
        games_played INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        win_rate REAL DEFAULT 0,
        avg_accuracy REAL DEFAULT 0,
        total_blunders INTEGER DEFAULT 0,
        last_played DATE,
        UNIQUE(eco_code, player_color)
      )
    `);

    // Add time management columns to analysis table
    await this.db.run(`ALTER TABLE analysis ADD COLUMN time_spent INTEGER DEFAULT 0`);
    await this.db.run(`ALTER TABLE analysis ADD COLUMN time_remaining INTEGER DEFAULT 0`);

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_phase_analysis_game_phase ON phase_analysis(game_id, phase)',
      'CREATE INDEX IF NOT EXISTS idx_opening_analysis_game_id ON opening_analysis(game_id)',
      'CREATE INDEX IF NOT EXISTS idx_opening_analysis_eco ON opening_analysis(eco_code)',
      'CREATE INDEX IF NOT EXISTS idx_tactical_motifs_game_id ON tactical_motifs(game_id)',
      'CREATE INDEX IF NOT EXISTS idx_tactical_motifs_type ON tactical_motifs(motif_type)',
      'CREATE INDEX IF NOT EXISTS idx_phase_stats_game_id ON phase_stats(game_id)',
      'CREATE INDEX IF NOT EXISTS idx_opening_stats_eco_color ON opening_stats(eco_code, player_color)'
    ];

    for (const index of indexes) {
      await this.db.run(index);
    }
    
    console.log('✅ Migration completed: Analysis tables added');
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove analysis tables');
    
    // Drop indexes
    const indexes = [
      'DROP INDEX IF EXISTS idx_phase_analysis_game_phase',
      'DROP INDEX IF EXISTS idx_opening_analysis_game_id',
      'DROP INDEX IF EXISTS idx_opening_analysis_eco',
      'DROP INDEX IF EXISTS idx_tactical_motifs_game_id',
      'DROP INDEX IF EXISTS idx_tactical_motifs_type',
      'DROP INDEX IF EXISTS idx_phase_stats_game_id',
      'DROP INDEX IF EXISTS idx_opening_stats_eco_color'
    ];

    for (const index of indexes) {
      await this.db.run(index);
    }

    // Drop tables
    await this.db.run('DROP TABLE IF EXISTS opening_stats');
    await this.db.run('DROP TABLE IF EXISTS phase_stats');
    await this.db.run('DROP TABLE IF EXISTS tactical_motifs');
    await this.db.run('DROP TABLE IF EXISTS opening_analysis');
    await this.db.run('DROP TABLE IF EXISTS phase_analysis');
    
    console.log('✅ Migration rolled back');
  }
}

module.exports = Migration002;
