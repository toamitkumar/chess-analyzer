/**
 * Migration 018: Fix Tournament Name Unique Constraint
 *
 * Problem: tournaments.name has a UNIQUE constraint that's global across all users.
 * This prevents multiple users from having tournaments with the same name.
 *
 * Solution: Change UNIQUE constraint from (name) to (name, user_id) composite key.
 *
 * Note: SQLite doesn't support modifying constraints on existing tables,
 * so we need to recreate the table with the correct schema.
 */

class Migration018 {
  constructor(db) {
    this.db = db;
    this.version = 18;
    this.name = 'fix_tournament_unique_constraint';
  }

  async up() {
    console.log('🔄 Running migration 018: Fix Tournament Unique Constraint');

    const isPostgres = this.db.usePostgres;
    const { idType, textType, timestampType } = this.db.getSQLTypes();

    if (isPostgres) {
      // PostgreSQL: Drop existing constraint and add composite unique constraint
      console.log('  🔧 Dropping existing unique constraint on tournaments.name...');
      await this.db.run(`
        ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_name_key
      `);

      console.log('  🔧 Adding composite unique constraint on (name, user_id)...');
      await this.db.run(`
        ALTER TABLE tournaments ADD CONSTRAINT tournaments_name_user_id_key UNIQUE (name, user_id)
      `);
    } else {
      // SQLite: Need to recreate table with new constraint
      console.log('  🔧 Recreating tournaments table with composite unique constraint...');

      // 1. Create new table with correct schema
      await this.db.run(`
        CREATE TABLE tournaments_new (
          id ${idType},
          name ${textType} NOT NULL,
          event_type ${textType},
          location ${textType},
          start_date ${textType},
          end_date ${textType},
          total_games INTEGER DEFAULT 0,
          user_id ${textType} DEFAULT 'default_user',
          created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(name, user_id)
        )
      `);

      // 2. Copy data from old table
      console.log('  📋 Copying data from old table...');
      await this.db.run(`
        INSERT INTO tournaments_new (id, name, event_type, location, start_date, end_date, total_games, user_id, created_at)
        SELECT id, name, event_type, location, start_date, end_date, total_games, user_id, created_at
        FROM tournaments
      `);

      // 3. Drop old table
      console.log('  🗑️  Dropping old table...');
      await this.db.run('DROP TABLE tournaments');

      // 4. Rename new table
      console.log('  ♻️  Renaming new table...');
      await this.db.run('ALTER TABLE tournaments_new RENAME TO tournaments');

      // 5. Recreate indexes
      console.log('  📑 Recreating indexes...');
      await this.db.run('CREATE INDEX IF NOT EXISTS idx_tournaments_user_id ON tournaments(user_id)');
      await this.db.run('CREATE INDEX IF NOT EXISTS idx_tournaments_name ON tournaments(name)');
    }

    console.log('✅ Migration 018 completed: Tournament unique constraint fixed');
  }

  async down() {
    console.log('🔄 Rolling back migration 018: Fix Tournament Unique Constraint');

    const isPostgres = this.db.usePostgres;
    const { idType, textType, timestampType } = this.db.getSQLTypes();

    if (isPostgres) {
      // PostgreSQL: Drop composite constraint and add single-column unique
      await this.db.run(`
        ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_name_user_id_key
      `);
      await this.db.run(`
        ALTER TABLE tournaments ADD CONSTRAINT tournaments_name_key UNIQUE (name)
      `);
    } else {
      // SQLite: Recreate table with old schema
      await this.db.run(`
        CREATE TABLE tournaments_new (
          id ${idType},
          name ${textType} NOT NULL UNIQUE,
          event_type ${textType},
          location ${textType},
          start_date ${textType},
          end_date ${textType},
          total_games INTEGER DEFAULT 0,
          user_id ${textType} DEFAULT 'default_user',
          created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.db.run(`
        INSERT INTO tournaments_new (id, name, event_type, location, start_date, end_date, total_games, user_id, created_at)
        SELECT id, name, event_type, location, start_date, end_date, total_games, user_id, created_at
        FROM tournaments
      `);

      await this.db.run('DROP TABLE tournaments');
      await this.db.run('ALTER TABLE tournaments_new RENAME TO tournaments');

      // Recreate indexes
      await this.db.run('CREATE INDEX IF NOT EXISTS idx_tournaments_user_id ON tournaments(user_id)');
      await this.db.run('CREATE INDEX IF NOT EXISTS idx_tournaments_name ON tournaments(name)');
    }

    console.log('✅ Migration 018 rollback completed');
  }
}

module.exports = Migration018;
