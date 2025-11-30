class Migration013 {
  constructor(database) {
    this.db = database;
    this.version = 13;
    this.name = 'create_puzzle_cache';
  }

  async up() {
    console.log('🔄 Running migration: Create puzzle_cache table for LRU cache');

    const { idType, timestampType, textType } = this.db.getSQLTypes();
    const isPostgres = this.db.usePostgres;

    // Create puzzle_cache table
    // Stores full puzzle details fetched from Lichess API
    // LRU cache with 24-hour TTL, max 2000 puzzles (~10MB)
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS puzzle_cache (
        id ${textType} PRIMARY KEY,
        fen ${textType} NOT NULL,
        moves ${textType} NOT NULL,
        solution ${textType},
        themes ${textType} NOT NULL,
        rating INTEGER,
        game_url ${textType},
        cached_at ${timestampType} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'},
        last_accessed ${timestampType} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'}
      )
    `);

    // Create indexes for LRU eviction and TTL cleanup
    const indexes = [
      // For LRU eviction (find least recently accessed)
      'CREATE INDEX IF NOT EXISTS idx_puzzle_cache_accessed ON puzzle_cache(last_accessed)',
      // For TTL cleanup (find expired entries)
      'CREATE INDEX IF NOT EXISTS idx_puzzle_cache_age ON puzzle_cache(cached_at)'
    ];

    for (const index of indexes) {
      await this.db.run(index);
    }

    console.log('✅ Migration completed: puzzle_cache table created with indexes');
    console.log(`   Database type: ${isPostgres ? 'PostgreSQL (production)' : 'SQLite (local)'}`);
    console.log('   Cache strategy: 24-hour TTL + LRU eviction at 2000 puzzles');
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove puzzle_cache table');

    // Drop indexes
    const indexes = [
      'DROP INDEX IF EXISTS idx_puzzle_cache_accessed',
      'DROP INDEX IF EXISTS idx_puzzle_cache_age'
    ];

    for (const index of indexes) {
      await this.db.run(index);
    }

    // Drop table
    await this.db.run('DROP TABLE IF EXISTS puzzle_cache');

    console.log('✅ Migration rolled back: puzzle_cache table removed');
  }
}

module.exports = Migration013;
