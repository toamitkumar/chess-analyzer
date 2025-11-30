/**
 * Migration: Create blunder_puzzle_links table
 * Links blunders to recommended Lichess puzzles
 *
 * Phase 2: Puzzle Matching & Lichess API Client (Issue #78)
 */

class Migration014 {
  constructor(database) {
    this.db = database;
    this.version = 14;
    this.name = 'create_blunder_puzzle_links';
  }

  async up() {
    console.log('🔄 Running migration: Create blunder_puzzle_links table');

    const { idType, timestampType, textType } = this.db.getSQLTypes();
    const isPostgres = this.db.usePostgres;

    // Create blunder_puzzle_links table
    // Links blunders to recommended Lichess puzzles based on theme similarity
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS blunder_puzzle_links (
        id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
        blunder_id INTEGER NOT NULL,
        puzzle_id ${textType} NOT NULL,
        match_score REAL DEFAULT 0,
        created_at ${timestampType} DEFAULT ${isPostgres ? 'NOW()' : 'CURRENT_TIMESTAMP'},

        FOREIGN KEY (blunder_id) REFERENCES blunder_details(id) ON DELETE CASCADE,
        FOREIGN KEY (puzzle_id) REFERENCES puzzle_index(id) ON DELETE CASCADE,

        UNIQUE(blunder_id, puzzle_id)
      )
    `);

    // Create indexes for performance
    const indexes = [
      // Index for looking up puzzles by blunder
      'CREATE INDEX IF NOT EXISTS idx_blunder_puzzle_links_blunder_id ON blunder_puzzle_links(blunder_id)',

      // Index for looking up blunders by puzzle
      'CREATE INDEX IF NOT EXISTS idx_blunder_puzzle_links_puzzle_id ON blunder_puzzle_links(puzzle_id)',

      // Index for sorting by match score
      'CREATE INDEX IF NOT EXISTS idx_blunder_puzzle_links_score ON blunder_puzzle_links(blunder_id, match_score DESC)',
    ];

    for (const indexSQL of indexes) {
      await this.db.run(indexSQL);
    }

    console.log('✅ Migration completed: blunder_puzzle_links table created with indexes');
    console.log(`   Database type: ${isPostgres ? 'PostgreSQL (production)' : 'SQLite (local)'}`);
    console.log('   Purpose: Link blunders to recommended Lichess puzzles for practice');
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove blunder_puzzle_links table');

    // Drop indexes
    const indexes = [
      'DROP INDEX IF EXISTS idx_blunder_puzzle_links_blunder_id',
      'DROP INDEX IF EXISTS idx_blunder_puzzle_links_puzzle_id',
      'DROP INDEX IF EXISTS idx_blunder_puzzle_links_score'
    ];

    for (const indexSQL of indexes) {
      await this.db.run(indexSQL);
    }

    // Drop table
    await this.db.run('DROP TABLE IF EXISTS blunder_puzzle_links');

    console.log('✅ Migration rolled back: blunder_puzzle_links table removed');
  }
}

module.exports = Migration014;
