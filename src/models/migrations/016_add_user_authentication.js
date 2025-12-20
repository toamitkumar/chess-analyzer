/**
 * Migration 016: Add User Authentication Support
 *
 * This migration adds:
 * 1. users table for storing user authentication data from Clerk
 * 2. user_id columns to existing tables (games, analysis, blunder_details, tournaments)
 * 3. Foreign key constraints for data integrity
 * 4. Indexes for query performance
 * 5. Default user for existing data migration
 */

class Migration016 {
  constructor(db) {
    this.db = db;
    this.version = 16;
    this.name = 'add_user_authentication';
  }

  async up() {
    console.log('🔄 Running migration 016: Add User Authentication Support');

    const isPostgres = this.db.usePostgres;
    const { textType, timestampType } = this.db.getSQLTypes();

    // 1. Create users table
    console.log('  📋 Creating users table...');
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id ${textType} PRIMARY KEY,
        email ${textType} UNIQUE NOT NULL,
        username ${textType} UNIQUE,
        chess_username ${textType},
        display_name ${textType},
        avatar_url ${textType},
        created_at ${timestampType} DEFAULT ${isPostgres ? 'NOW()' : "CURRENT_TIMESTAMP"},
        last_login ${timestampType},
        subscription_tier ${textType} DEFAULT 'free',
        preferences ${isPostgres ? 'JSONB' : 'TEXT'}
      )
    `);
    console.log('  ✅ Users table created');

    // 2. Create default user for existing data
    console.log('  👤 Creating default user...');
    await this.db.run(`
      INSERT INTO users (id, email, username, chess_username, display_name, subscription_tier)
      VALUES ('default_user', 'advait@chesspulse.com', 'AdvaitKumar1213', 'AdvaitKumar1213', 'Advait Kumar', 'free')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('  ✅ Default user created');

    // 3. Add user_id columns to existing tables
    const tablesToUpdate = [
      { name: 'games', hasUserId: false },
      { name: 'analysis', hasUserId: false },
      { name: 'blunder_details', hasUserId: false },
      { name: 'tournaments', hasUserId: false }
    ];

    for (const table of tablesToUpdate) {
      console.log(`  🔧 Adding user_id column to ${table.name}...`);

      // Check if column already exists
      let columnExists = false;
      if (isPostgres) {
        const result = await this.db.all(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = '${table.name}' AND column_name = 'user_id'
        `);
        columnExists = result.length > 0;
      } else {
        const result = await this.db.all(`PRAGMA table_info(${table.name})`);
        columnExists = result.some(col => col.name === 'user_id');
      }

      if (!columnExists) {
        await this.db.run(`
          ALTER TABLE ${table.name} ADD COLUMN user_id ${textType} DEFAULT 'default_user'
        `);
        console.log(`  ✅ Added user_id column to ${table.name}`);
      } else {
        console.log(`  ⏭️  user_id column already exists in ${table.name}`);
      }

      // Update existing NULL values
      await this.db.run(`
        UPDATE ${table.name} SET user_id = 'default_user' WHERE user_id IS NULL
      `);
    }

    // 4. Add foreign key constraints (only for new tables, can't add to existing in SQLite)
    if (isPostgres) {
      console.log('  🔗 Adding foreign key constraints...');
      for (const table of tablesToUpdate) {
        const constraintName = `fk_${table.name}_user`;

        // Check if constraint already exists
        const constraintExists = await this.db.all(`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = '${table.name}' AND constraint_name = '${constraintName}'
        `);

        if (constraintExists.length === 0) {
          await this.db.run(`
            ALTER TABLE ${table.name}
            ADD CONSTRAINT ${constraintName}
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          `);
          console.log(`  ✅ Added foreign key constraint to ${table.name}`);
        } else {
          console.log(`  ⏭️  Foreign key constraint already exists on ${table.name}`);
        }
      }
    } else {
      console.log('  ⏭️  Skipping foreign key constraints for SQLite (requires table recreation)');
    }

    // 5. Create indexes for performance
    console.log('  📑 Creating indexes...');
    const indexes = [
      { table: 'games', column: 'user_id', name: 'idx_games_user_id' },
      { table: 'analysis', column: 'user_id', name: 'idx_analysis_user_id' },
      { table: 'blunder_details', column: 'user_id', name: 'idx_blunders_user_id' },
      { table: 'tournaments', column: 'user_id', name: 'idx_tournaments_user_id' },
      { table: 'users', column: 'email', name: 'idx_users_email' },
      { table: 'users', column: 'username', name: 'idx_users_username' }
    ];

    for (const index of indexes) {
      try {
        await this.db.run(`
          CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table}(${index.column})
        `);
        console.log(`  ✅ Created index ${index.name}`);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
        console.log(`  ⏭️  Index ${index.name} already exists`);
      }
    }

    console.log('✅ Migration 016 completed successfully');
  }

  async down() {
    console.log('🔄 Rolling back migration 016: Add User Authentication Support');

    const isPostgres = this.db.usePostgres;

    // Remove foreign key constraints (PostgreSQL only)
    if (isPostgres) {
      const tables = ['games', 'analysis', 'blunder_details', 'tournaments'];
      for (const table of tables) {
        try {
          await this.db.run(`
            ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS fk_${table}_user
          `);
        } catch (error) {
          console.log(`  ⚠️  Could not drop constraint from ${table}: ${error.message}`);
        }
      }
    }

    // Drop indexes
    const indexes = [
      'idx_games_user_id',
      'idx_analysis_user_id',
      'idx_blunders_user_id',
      'idx_tournaments_user_id',
      'idx_users_email',
      'idx_users_username'
    ];

    for (const index of indexes) {
      try {
        await this.db.run(`DROP INDEX IF EXISTS ${index}`);
      } catch (error) {
        console.log(`  ⚠️  Could not drop index ${index}: ${error.message}`);
      }
    }

    // Remove user_id columns (Note: SQLite doesn't support DROP COLUMN easily)
    if (isPostgres) {
      const tables = ['games', 'analysis', 'blunder_details', 'tournaments'];
      for (const table of tables) {
        try {
          await this.db.run(`ALTER TABLE ${table} DROP COLUMN IF EXISTS user_id`);
        } catch (error) {
          console.log(`  ⚠️  Could not drop user_id from ${table}: ${error.message}`);
        }
      }
    }

    // Drop users table
    await this.db.run('DROP TABLE IF EXISTS users');

    console.log('✅ Migration 016 rollback completed');
  }
}

module.exports = Migration016;
