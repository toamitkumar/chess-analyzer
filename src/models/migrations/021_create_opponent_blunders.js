/**
 * Migration: Create opponent_blunders table
 *
 * Track pieces opponents leave hanging and whether the player captured them.
 * This enables the "Free Pieces" insights feature from Chess.com
 *
 * Reference: ADR 009 Phase 5.3 - Free Pieces (Opponent Blunders)
 */

class Migration021 {
  constructor(database) {
    this.db = database;
    this.version = 21;
    this.name = 'create_opponent_blunders';
  }

  async up() {
    console.log('🔄 Running migration: Create opponent_blunders table');

    // Create the opponent_blunders table
    try {
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS opponent_blunders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
          move_number INTEGER NOT NULL,
          player_color TEXT NOT NULL CHECK (player_color IN ('white', 'black')),
          opponent_piece TEXT CHECK (opponent_piece IN ('P', 'N', 'B', 'R', 'Q')),
          was_captured BOOLEAN NOT NULL DEFAULT FALSE,
          capture_move TEXT,
          played_move TEXT,
          piece_value INTEGER,
          fen_position TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('  ✓ Created opponent_blunders table');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('  ⏭️  Table opponent_blunders already exists, skipping');
      } else {
        throw err;
      }
    }

    // Create indexes for efficient querying
    const indexes = [
      {
        name: 'idx_opp_blunder_game',
        sql: 'CREATE INDEX IF NOT EXISTS idx_opp_blunder_game ON opponent_blunders(game_id)'
      },
      {
        name: 'idx_opp_blunder_captured',
        sql: 'CREATE INDEX IF NOT EXISTS idx_opp_blunder_captured ON opponent_blunders(was_captured)'
      },
      {
        name: 'idx_opp_blunder_piece',
        sql: 'CREATE INDEX IF NOT EXISTS idx_opp_blunder_piece ON opponent_blunders(opponent_piece)'
      }
    ];

    for (const index of indexes) {
      try {
        await this.db.run(index.sql);
        console.log(`  ✓ Created index ${index.name}`);
      } catch (err) {
        console.log(`  ⚠️  Index ${index.name} creation failed (may already exist):`, err.message);
      }
    }

    console.log('✅ Migration completed: opponent_blunders table created');
  }

  async down() {
    console.log('🔄 Rolling back migration: Drop opponent_blunders table');

    // Drop indexes first
    const indexes = [
      'idx_opp_blunder_game',
      'idx_opp_blunder_captured',
      'idx_opp_blunder_piece'
    ];

    for (const indexName of indexes) {
      try {
        await this.db.run(`DROP INDEX IF EXISTS ${indexName}`);
        console.log(`  ✓ Dropped index ${indexName}`);
      } catch (err) {
        console.log(`  ⚠️  Index drop failed:`, err.message);
      }
    }

    // Drop the table
    try {
      await this.db.run('DROP TABLE IF EXISTS opponent_blunders');
      console.log('  ✓ Dropped opponent_blunders table');
    } catch (err) {
      console.log('  ⚠️  Table drop failed:', err.message);
    }

    console.log('✅ Rollback completed: opponent_blunders table dropped');
  }
}

module.exports = Migration021;
