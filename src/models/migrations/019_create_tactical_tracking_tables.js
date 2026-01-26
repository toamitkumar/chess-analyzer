/**
 * Migration 019: Create tactical tracking tables
 *
 * Creates tables for tracking tactical opportunities and opponent blunders
 * per ADR 009 Phase 5 - Chess.com Insights Dashboard
 *
 * Tables created:
 * - tactical_opportunities: Tracks found vs missed tactics (forks, pins, skewers, discovered attacks)
 * - opponent_blunders: Tracks free pieces left by opponents (hanging pieces)
 */

class Migration019 {
  constructor(db) {
    this.db = db;
    this.version = 19;
    this.name = 'create_tactical_tracking_tables';
  }

  async up() {
    console.log('🔄 Running migration 019: Create tactical tracking tables');

    const isPostgres = this.db.usePostgres;
    const { idType, textType, timestampType } = this.db.getSQLTypes();

    // Create tactical_opportunities table
    console.log('  🔧 Creating tactical_opportunities table...');
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS tactical_opportunities (
        id ${idType},
        game_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,
        player_color ${textType} NOT NULL,
        tactic_type ${textType} NOT NULL,
        attacking_piece ${textType},
        target_pieces ${textType},
        was_found INTEGER NOT NULL DEFAULT 0,
        best_move ${textType},
        played_move ${textType},
        eval_gain INTEGER DEFAULT 0,
        fen_position ${textType},
        created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for tactical_opportunities
    console.log('  📑 Creating indexes for tactical_opportunities...');
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_tactical_opportunities_game_id
      ON tactical_opportunities(game_id)
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_tactical_opportunities_tactic_type
      ON tactical_opportunities(tactic_type)
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_tactical_opportunities_was_found
      ON tactical_opportunities(was_found)
    `);

    // Create opponent_blunders table
    console.log('  🔧 Creating opponent_blunders table...');
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS opponent_blunders (
        id ${idType},
        game_id INTEGER NOT NULL,
        move_number INTEGER NOT NULL,
        player_color ${textType} NOT NULL,
        opponent_piece ${textType} NOT NULL,
        was_captured INTEGER NOT NULL DEFAULT 0,
        capture_move ${textType},
        played_move ${textType},
        fen_position ${textType},
        created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for opponent_blunders
    console.log('  📑 Creating indexes for opponent_blunders...');
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_opponent_blunders_game_id
      ON opponent_blunders(game_id)
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_opponent_blunders_opponent_piece
      ON opponent_blunders(opponent_piece)
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_opponent_blunders_was_captured
      ON opponent_blunders(was_captured)
    `);

    console.log('✅ Migration 019 completed: Tactical tracking tables created');
  }

  async down() {
    console.log('🔄 Rolling back migration 019: Create tactical tracking tables');

    await this.db.run('DROP TABLE IF EXISTS tactical_opportunities');
    await this.db.run('DROP TABLE IF EXISTS opponent_blunders');

    console.log('✅ Migration 019 rollback completed');
  }
}

module.exports = Migration019;
