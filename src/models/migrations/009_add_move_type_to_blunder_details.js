/**
 * Migration: Add is_blunder, is_mistake, is_inaccuracy columns to blunder_details
 *
 * The blunder_details table stores all poor moves (blunders, mistakes, inaccuracies)
 * but lacks fields to distinguish between them. This migration adds those fields.
 */

class Migration009 {
  constructor(database) {
    this.db = database;
    this.version = 9;
    this.name = 'add_move_type_to_blunder_details';
  }

  async up() {
    console.log('🔄 Running migration: Add move type columns to blunder_details table');

    // Add columns to distinguish blunders, mistakes, and inaccuracies
    // Use FALSE instead of 0 for PostgreSQL compatibility
    try {
      await this.db.run(`
        ALTER TABLE blunder_details
        ADD COLUMN is_blunder BOOLEAN DEFAULT FALSE
      `);
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
    }

    try {
      await this.db.run(`
        ALTER TABLE blunder_details
        ADD COLUMN is_mistake BOOLEAN DEFAULT FALSE
      `);
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
    }

    try {
      await this.db.run(`
        ALTER TABLE blunder_details
        ADD COLUMN is_inaccuracy BOOLEAN DEFAULT FALSE
      `);
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
    }

    console.log('  ✓ Added is_blunder, is_mistake, is_inaccuracy columns to blunder_details table');
  }

  async down() {
    console.log('  Removing move type columns from blunder_details table...');
    console.log('  ⚠️  SQLite does not support DROP COLUMN - manual intervention required');
  }
}

module.exports = Migration009;
