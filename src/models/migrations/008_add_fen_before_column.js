/**
 * Migration: Add fen_before column to analysis table
 *
 * The analyzer creates fen_before but the schema was missing this column.
 * This is needed for blunder categorization.
 */

class Migration008 {
  constructor(database) {
    this.db = database;
    this.version = 8;
    this.name = 'add_fen_before_column';
  }

  async up() {
    console.log('🔄 Running migration: Add fen_before column to analysis table');

    // Add fen_before column
    await this.db.run(`
      ALTER TABLE analysis
      ADD COLUMN fen_before TEXT
    `);

    console.log('  ✓ Added fen_before column to analysis table');
  }

  async down() {
    console.log('  Removing fen_before column from analysis table...');
    console.log('  ⚠️  SQLite does not support DROP COLUMN - manual intervention required');
  }
}

module.exports = Migration008;
