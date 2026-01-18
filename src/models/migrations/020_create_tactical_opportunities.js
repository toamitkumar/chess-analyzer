/**
 * Migration: Create tactical_opportunities table
 *
 * Track when players found or missed tactical patterns (forks, pins, skewers, etc.)
 * This enables the "Found vs Missed" insights feature from Chess.com
 *
 * Reference: ADR 009 Phase 5.1 - Found vs Missed Tactical Opportunities
 */

class Migration020 {
  constructor(database) {
    this.db = database;
    this.version = 20;
    this.name = 'create_tactical_opportunities';
  }

  async up() {
    console.log('🔄 Running migration: Create tactical_opportunities table');

    // Create the tactical_opportunities table
    try {
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS tactical_opportunities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
          move_number INTEGER NOT NULL,
          player_color TEXT NOT NULL CHECK (player_color IN ('white', 'black')),
          tactic_type TEXT NOT NULL,
          attacking_piece TEXT CHECK (attacking_piece IN ('P', 'N', 'B', 'R', 'Q', 'K')),
          target_pieces TEXT,
          was_found BOOLEAN NOT NULL DEFAULT FALSE,
          best_move TEXT,
          played_move TEXT,
          eval_gain INTEGER,
          fen_position TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('  ✓ Created tactical_opportunities table');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('  ⏭️  Table tactical_opportunities already exists, skipping');
      } else {
        throw err;
      }
    }

    // Create indexes for efficient querying
    const indexes = [
      {
        name: 'idx_tactical_opp_game',
        sql: 'CREATE INDEX IF NOT EXISTS idx_tactical_opp_game ON tactical_opportunities(game_id)'
      },
      {
        name: 'idx_tactical_opp_type',
        sql: 'CREATE INDEX IF NOT EXISTS idx_tactical_opp_type ON tactical_opportunities(tactic_type)'
      },
      {
        name: 'idx_tactical_opp_found',
        sql: 'CREATE INDEX IF NOT EXISTS idx_tactical_opp_found ON tactical_opportunities(was_found)'
      },
      {
        name: 'idx_tactical_opp_player',
        sql: 'CREATE INDEX IF NOT EXISTS idx_tactical_opp_player ON tactical_opportunities(player_color)'
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

    console.log('✅ Migration completed: tactical_opportunities table created');
  }

  async down() {
    console.log('🔄 Rolling back migration: Drop tactical_opportunities table');

    // Drop indexes first
    const indexes = [
      'idx_tactical_opp_game',
      'idx_tactical_opp_type',
      'idx_tactical_opp_found',
      'idx_tactical_opp_player'
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
      await this.db.run('DROP TABLE IF EXISTS tactical_opportunities');
      console.log('  ✓ Dropped tactical_opportunities table');
    } catch (err) {
      console.log('  ⚠️  Table drop failed:', err.message);
    }

    console.log('✅ Rollback completed: tactical_opportunities table dropped');
  }
}

module.exports = Migration020;
