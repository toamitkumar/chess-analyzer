/**
 * Migration 017: Add user_color to Games Table
 *
 * This migration adds:
 * 1. user_color column to games table to explicitly store which color (white/black)
 *    the authenticated user played in each game
 * 2. CHECK constraint to ensure only valid values ('white' or 'black')
 * 3. Index for query performance
 *
 * Related:
 * - GitHub Issue: #101
 * - ADR: docs/adr/001-user-color-field-in-games-table.md
 */

class Migration017 {
  constructor(db) {
    this.db = db;
    this.version = 17;
    this.name = 'add_user_color';
  }

  async up() {
    console.log('🔄 Running migration 017: Add user_color to Games Table');

    const isPostgres = this.db.usePostgres;
    const { textType } = this.db.getSQLTypes();

    // 1. Check if column already exists
    console.log('  🔍 Checking if user_color column already exists...');
    let columnExists = false;

    if (isPostgres) {
      const result = await this.db.all(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'games' AND column_name = 'user_color'
      `);
      columnExists = result.length > 0;
    } else {
      const result = await this.db.all(`PRAGMA table_info(games)`);
      columnExists = result.some(col => col.name === 'user_color');
    }

    if (columnExists) {
      console.log('  ℹ️  user_color column already exists, skipping...');
      return;
    }

    // 2. Add user_color column
    console.log('  📋 Adding user_color column to games table...');

    if (isPostgres) {
      // PostgreSQL: Add column with CHECK constraint in one statement
      await this.db.run(`
        ALTER TABLE games
        ADD COLUMN user_color ${textType}
        CHECK (user_color IN ('white', 'black'))
      `);
    } else {
      // SQLite: Add column (CHECK constraint not enforced in SQLite ALTER TABLE)
      await this.db.run(`
        ALTER TABLE games ADD COLUMN user_color ${textType}
      `);

      // Note: SQLite doesn't enforce CHECK constraints added via ALTER TABLE
      // They will be enforced when table is recreated or in application logic
    }

    console.log('  ✅ user_color column added');

    // 3. Create index for query performance
    console.log('  🔧 Creating index on user_color...');
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_games_user_color ON games(user_color)
    `);
    console.log('  ✅ Index created');

    // 4. Create composite index for common query pattern (user_id + user_color)
    console.log('  🔧 Creating composite index on user_id and user_color...');
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_games_user_id_color ON games(user_id, user_color)
    `);
    console.log('  ✅ Composite index created');

    console.log('✅ Migration 017 completed: user_color column added to games table');
    console.log('📝 Note: Column is nullable to support existing games without user_color');
    console.log('📝 Valid values: "white" or "black"');
  }

  async down() {
    console.log('🔄 Reverting migration 017: Remove user_color from Games Table');

    const isPostgres = this.db.usePostgres;

    // 1. Drop indexes
    console.log('  🗑️  Dropping indexes...');
    await this.db.run(`DROP INDEX IF EXISTS idx_games_user_id_color`);
    await this.db.run(`DROP INDEX IF EXISTS idx_games_user_color`);
    console.log('  ✅ Indexes dropped');

    // 2. Drop column
    console.log('  🗑️  Dropping user_color column...');

    if (isPostgres) {
      await this.db.run(`ALTER TABLE games DROP COLUMN IF EXISTS user_color`);
    } else {
      // SQLite doesn't support DROP COLUMN directly before version 3.35.0
      // For older versions, we'd need to recreate the table
      // For now, we'll just log a warning
      console.log('  ⚠️  SQLite: Column drop may require table recreation on older versions');
      await this.db.run(`ALTER TABLE games DROP COLUMN user_color`);
    }

    console.log('  ✅ user_color column dropped');
    console.log('✅ Migration 017 reverted');
  }
}

module.exports = Migration017;
