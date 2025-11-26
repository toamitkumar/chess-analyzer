class Migration011 {
  constructor(database) {
    this.db = database;
    this.version = 11;
    this.name = 'fix_cascade_delete_constraints';
  }

  async up() {
    console.log('🔄 Running migration: Fix CASCADE DELETE constraints for PostgreSQL compatibility');

    // PostgreSQL requires dropping and recreating constraints
    // SQLite doesn't support dropping constraints directly, so we check the database type

    const isPostgres = this.db.db && this.db.db.constructor.name === 'Client';

    if (isPostgres) {
      console.log('  ℹ️  Detected PostgreSQL - updating foreign key constraints');

      // Drop existing foreign key constraints
      await this.db.run(`
        ALTER TABLE alternative_moves
        DROP CONSTRAINT IF EXISTS alternative_moves_game_id_fkey
      `);

      await this.db.run(`
        ALTER TABLE position_evaluations
        DROP CONSTRAINT IF EXISTS position_evaluations_game_id_fkey
      `);

      // Re-add with ON DELETE CASCADE
      await this.db.run(`
        ALTER TABLE alternative_moves
        ADD CONSTRAINT alternative_moves_game_id_fkey
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      `);

      await this.db.run(`
        ALTER TABLE position_evaluations
        ADD CONSTRAINT position_evaluations_game_id_fkey
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      `);

      console.log('  ✓ Updated foreign key constraints with ON DELETE CASCADE');
    } else {
      console.log('  ℹ️  Detected SQLite - skipping (SQLite doesn\'t support altering constraints)');
      console.log('  ℹ️  For SQLite, constraints are handled at table creation time');
    }

    console.log('✅ Migration completed: CASCADE DELETE constraints fixed');
  }

  async down() {
    console.log('🔄 Rolling back migration: Revert CASCADE DELETE constraints');

    const isPostgres = this.db.db && this.db.db.constructor.name === 'Client';

    if (isPostgres) {
      // Drop CASCADE constraints
      await this.db.run(`
        ALTER TABLE alternative_moves
        DROP CONSTRAINT IF EXISTS alternative_moves_game_id_fkey
      `);

      await this.db.run(`
        ALTER TABLE position_evaluations
        DROP CONSTRAINT IF EXISTS position_evaluations_game_id_fkey
      `);

      // Re-add without CASCADE
      await this.db.run(`
        ALTER TABLE alternative_moves
        ADD CONSTRAINT alternative_moves_game_id_fkey
        FOREIGN KEY (game_id) REFERENCES games(id)
      `);

      await this.db.run(`
        ALTER TABLE position_evaluations
        ADD CONSTRAINT position_evaluations_game_id_fkey
        FOREIGN KEY (game_id) REFERENCES games(id)
      `);

      console.log('  ✓ Reverted to non-CASCADE foreign keys');
    }

    console.log('✅ Migration rolled back');
  }
}

module.exports = Migration011;
