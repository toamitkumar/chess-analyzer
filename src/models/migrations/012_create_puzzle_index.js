class Migration012 {
  constructor(database) {
    this.db = database;
    this.version = 12;
    this.name = 'create_puzzle_index';
  }

  async up() {
    console.log('🔄 Running migration: Create puzzle_index table for Lichess puzzle metadata');

    const { idType, timestampType, textType } = this.db.getSQLTypes();
    const isPostgres = this.db.usePostgres;

    // Create puzzle_index table
    // SQLite: stores themes as TEXT (space-separated string like "fork middlegame")
    // PostgreSQL: stores themes as TEXT[] (native array)
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS puzzle_index (
        id ${textType} PRIMARY KEY,
        themes ${isPostgres ? 'TEXT[]' : textType} NOT NULL,
        rating INTEGER,
        popularity INTEGER,
        created_at ${timestampType} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'}
      )
    `);

    // Create indexes for fast querying
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_puzzle_index_rating ON puzzle_index(rating)',
      'CREATE INDEX IF NOT EXISTS idx_puzzle_index_popularity ON puzzle_index(popularity)'
    ];

    // Add theme index - different for SQLite vs PostgreSQL
    if (isPostgres) {
      // PostgreSQL: Use GIN index for array operations
      indexes.push('CREATE INDEX IF NOT EXISTS idx_puzzle_index_themes ON puzzle_index USING GIN(themes)');
    } else {
      // SQLite: Regular index on TEXT column
      indexes.push('CREATE INDEX IF NOT EXISTS idx_puzzle_index_themes ON puzzle_index(themes)');
    }

    for (const index of indexes) {
      await this.db.run(index);
    }

    console.log('✅ Migration completed: puzzle_index table created with indexes');
    console.log(`   Database type: ${isPostgres ? 'PostgreSQL (production)' : 'SQLite (local)'}`);
    console.log(`   Themes storage: ${isPostgres ? 'TEXT[] (native array)' : 'TEXT (space-separated)'}`);
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove puzzle_index table');

    // Drop indexes
    const indexes = [
      'DROP INDEX IF EXISTS idx_puzzle_index_rating',
      'DROP INDEX IF EXISTS idx_puzzle_index_popularity',
      'DROP INDEX IF EXISTS idx_puzzle_index_themes'
    ];

    for (const index of indexes) {
      await this.db.run(index);
    }

    // Drop table
    await this.db.run('DROP TABLE IF EXISTS puzzle_index');

    console.log('✅ Migration rolled back: puzzle_index table removed');
  }
}

module.exports = Migration012;
