/**
 * Migration: Add player_color column to blunder_details
 *
 * Track which player (white/black) made each blunder so we can filter
 * for only the target player's blunders on the dashboard.
 */

class Migration010 {
  constructor(database) {
    this.db = database;
    this.version = 10;
    this.name = 'add_player_to_blunder_details';
  }

  async up() {
    console.log('🔄 Running migration: Add player_color to blunder_details table');

    // Add column to track which player made the blunder
    await this.db.run(`
      ALTER TABLE blunder_details
      ADD COLUMN player_color TEXT CHECK (player_color IN ('white', 'black'))
    `);

    console.log('  ✓ Added player_color column to blunder_details table');
  }

  async down() {
    console.log('  Removing player_color column from blunder_details table...');
    console.log('  ⚠️  SQLite does not support DROP COLUMN - manual intervention required');
  }
}

module.exports = Migration010;
