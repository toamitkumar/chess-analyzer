/**
 * Migration: Create puzzle progress and theme mastery tables
 * Tracks user progress on puzzles and theme mastery levels
 *
 * Phase 3: Learning Path API (Issue #78)
 */

class Migration015 {
  constructor(database) {
    this.db = database;
    this.version = 15;
    this.name = 'create_puzzle_progress_tables';
  }

  async up() {
    console.log('🔄 Running migration: Create puzzle progress and theme mastery tables');

    const { idType, timestampType, textType } = this.db.getSQLTypes();
    const isPostgres = this.db.usePostgres;

    // Create user_puzzle_progress table
    // Tracks individual puzzle attempts and solutions
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS user_puzzle_progress (
        id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
        puzzle_id ${textType} NOT NULL,
        user_id ${textType} DEFAULT 'default_user',
        attempts INTEGER DEFAULT 0,
        solved BOOLEAN DEFAULT FALSE,
        first_attempt_correct BOOLEAN DEFAULT FALSE,
        total_time_ms INTEGER DEFAULT 0,
        last_attempted_at ${timestampType},
        solved_at ${timestampType},
        streak INTEGER DEFAULT 0,
        created_at ${timestampType} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'},
        updated_at ${timestampType} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'},

        FOREIGN KEY (puzzle_id) REFERENCES puzzle_index(id) ON DELETE CASCADE,
        UNIQUE(puzzle_id, user_id)
      )
    `);

    // Create indexes for user_puzzle_progress
    const progressIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_user_puzzle_progress_user ON user_puzzle_progress(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_puzzle_progress_puzzle ON user_puzzle_progress(puzzle_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_puzzle_progress_solved ON user_puzzle_progress(user_id, solved)',
      'CREATE INDEX IF NOT EXISTS idx_user_puzzle_progress_updated ON user_puzzle_progress(updated_at DESC)'
    ];

    for (const indexSQL of progressIndexes) {
      await this.db.run(indexSQL);
    }

    console.log('✅ Created user_puzzle_progress table with indexes');

    // Create theme_mastery table
    // Tracks mastery level for each puzzle theme
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS theme_mastery (
        id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
        user_id ${textType} DEFAULT 'default_user',
        theme ${textType} NOT NULL,
        puzzles_attempted INTEGER DEFAULT 0,
        puzzles_solved INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0.0,
        avg_time_ms INTEGER DEFAULT 0,
        mastery_score REAL DEFAULT 0.0,
        mastery_status ${textType} DEFAULT 'learning',
        last_practiced_at ${timestampType},
        created_at ${timestampType} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'},
        updated_at ${timestampType} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'},

        UNIQUE(user_id, theme)
      )
    `);

    // Create indexes for theme_mastery
    const masteryIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_theme_mastery_user ON theme_mastery(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_theme_mastery_theme ON theme_mastery(theme)',
      'CREATE INDEX IF NOT EXISTS idx_theme_mastery_status ON theme_mastery(user_id, mastery_status)',
      'CREATE INDEX IF NOT EXISTS idx_theme_mastery_score ON theme_mastery(user_id, mastery_score DESC)'
    ];

    for (const indexSQL of masteryIndexes) {
      await this.db.run(indexSQL);
    }

    console.log('✅ Created theme_mastery table with indexes');

    console.log('✅ Migration completed: Puzzle progress tracking tables created');
    console.log(`   Database type: ${isPostgres ? 'PostgreSQL (production)' : 'SQLite (local)'}`);
    console.log('   Purpose: Track user puzzle progress and theme mastery for learning paths');
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove puzzle progress tables');

    // Drop indexes for theme_mastery
    const masteryIndexes = [
      'DROP INDEX IF EXISTS idx_theme_mastery_user',
      'DROP INDEX IF EXISTS idx_theme_mastery_theme',
      'DROP INDEX IF EXISTS idx_theme_mastery_status',
      'DROP INDEX IF EXISTS idx_theme_mastery_score'
    ];

    for (const indexSQL of masteryIndexes) {
      await this.db.run(indexSQL);
    }

    // Drop indexes for user_puzzle_progress
    const progressIndexes = [
      'DROP INDEX IF EXISTS idx_user_puzzle_progress_user',
      'DROP INDEX IF EXISTS idx_user_puzzle_progress_puzzle',
      'DROP INDEX IF EXISTS idx_user_puzzle_progress_solved',
      'DROP INDEX IF EXISTS idx_user_puzzle_progress_updated'
    ];

    for (const indexSQL of progressIndexes) {
      await this.db.run(indexSQL);
    }

    // Drop tables
    await this.db.run('DROP TABLE IF EXISTS theme_mastery');
    await this.db.run('DROP TABLE IF EXISTS user_puzzle_progress');

    console.log('✅ Migration rolled back: Puzzle progress tables removed');
  }
}

module.exports = Migration015;
