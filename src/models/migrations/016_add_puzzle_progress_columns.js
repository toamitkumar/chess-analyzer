/**
 * Migration: Add missing columns to user_puzzle_progress
 * Adds best_time_ms and mastery_score columns that were missing from migration 015
 *
 * This migration handles the case where migration 015 ran before these columns were added.
 */

class Migration016 {
  constructor(database) {
    this.db = database;
    this.version = 16;
    this.name = 'add_puzzle_progress_columns';
  }

  async up() {
    console.log('🔄 Running migration: Add missing puzzle progress columns');

    const isPostgres = this.db.usePostgres;
    let columnNames;

    // Get existing column names (different query for SQLite vs PostgreSQL)
    if (isPostgres) {
      const result = await this.db.all(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'user_puzzle_progress'
      `);
      columnNames = result.map(row => row.column_name);
    } else {
      const result = await this.db.all(`PRAGMA table_info(user_puzzle_progress)`);
      columnNames = result.map(col => col.name);
    }

    // Add best_time_ms if it doesn't exist
    if (!columnNames.includes('best_time_ms')) {
      await this.db.run(`
        ALTER TABLE user_puzzle_progress ADD COLUMN best_time_ms INTEGER
      `);
      console.log('✅ Added best_time_ms column');
    } else {
      console.log('ℹ️  Column best_time_ms already exists');
    }

    // Add mastery_score if it doesn't exist
    if (!columnNames.includes('mastery_score')) {
      // PostgreSQL uses DOUBLE PRECISION for REAL type
      const masteryType = isPostgres ? 'DOUBLE PRECISION' : 'REAL';
      await this.db.run(`
        ALTER TABLE user_puzzle_progress ADD COLUMN mastery_score ${masteryType} DEFAULT 0.0
      `);
      console.log('✅ Added mastery_score column');
    } else {
      console.log('ℹ️  Column mastery_score already exists');
    }

    console.log('✅ Migration completed: Puzzle progress columns updated');
    console.log(`   Database type: ${isPostgres ? 'PostgreSQL (production)' : 'SQLite (local)'}`);
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove puzzle progress columns');

    // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
    // For simplicity, we'll just log a warning since rolling back is rare
    console.log('⚠️  Warning: Rolling back this migration requires table recreation');
    console.log('⚠️  Manual intervention required to remove best_time_ms and mastery_score columns');

    console.log('✅ Migration rollback noted (manual cleanup required)');
  }
}

module.exports = Migration016;
