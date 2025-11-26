class Migration007 {
  constructor(database) {
    this.db = database;
    this.version = 7;
    this.name = 'create_blunder_details';
  }

  async up() {
    console.log('🔄 Running migration: Create blunder_details table for enhanced blunder tracking');

    const { idType, timestampType, textType, boolType } = this.db.getSQLTypes();

    // Create blunder_details table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS blunder_details (
        id ${idType},
        game_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,

        -- Position context
        fen ${textType} NOT NULL,
        phase ${textType} NOT NULL CHECK (phase IN ('opening', 'middlegame', 'endgame')),

        -- Move information
        player_move ${textType} NOT NULL,
        best_move ${textType} NOT NULL,
        alternative_moves ${textType}, -- JSON array of top 3 moves

        -- Evaluation metrics
        evaluation_before REAL NOT NULL,
        evaluation_after REAL NOT NULL,
        centipawn_loss INTEGER NOT NULL,
        win_probability_before REAL,
        win_probability_after REAL,

        -- Categorization
        tactical_theme ${textType}, -- fork, pin, skewer, hanging_piece, etc.
        position_type ${textType}, -- attacking, defensive, positional, tactical, transition
        blunder_severity ${textType} CHECK (blunder_severity IN ('minor', 'moderate', 'major', 'critical')),
        difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),

        -- Learning tracking
        learned ${boolType} DEFAULT FALSE,
        review_count INTEGER DEFAULT 0,
        last_reviewed ${timestampType},
        mastery_score REAL DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 100),
        notes ${textType},

        -- Timestamps
        created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,
        updated_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_blunder_details_game ON blunder_details(game_id)',
      'CREATE INDEX IF NOT EXISTS idx_blunder_details_phase ON blunder_details(phase)',
      'CREATE INDEX IF NOT EXISTS idx_blunder_details_theme ON blunder_details(tactical_theme)',
      'CREATE INDEX IF NOT EXISTS idx_blunder_details_learned ON blunder_details(learned)',
      'CREATE INDEX IF NOT EXISTS idx_blunder_details_severity ON blunder_details(blunder_severity)',
      'CREATE INDEX IF NOT EXISTS idx_blunder_details_move ON blunder_details(game_id, move_number)'
    ];

    for (const index of indexes) {
      await this.db.run(index);
    }

    console.log('✅ Migration completed: blunder_details table created with indexes');
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove blunder_details table');

    // Drop indexes
    const indexes = [
      'DROP INDEX IF EXISTS idx_blunder_details_game',
      'DROP INDEX IF EXISTS idx_blunder_details_phase',
      'DROP INDEX IF EXISTS idx_blunder_details_theme',
      'DROP INDEX IF EXISTS idx_blunder_details_learned',
      'DROP INDEX IF EXISTS idx_blunder_details_severity',
      'DROP INDEX IF EXISTS idx_blunder_details_move'
    ];

    for (const index of indexes) {
      await this.db.run(index);
    }

    // Drop table
    await this.db.run('DROP TABLE IF EXISTS blunder_details');

    console.log('✅ Migration rolled back: blunder_details table removed');
  }
}

module.exports = Migration007;
