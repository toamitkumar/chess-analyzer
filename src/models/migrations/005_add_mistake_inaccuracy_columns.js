class Migration005 {
  constructor(database) {
    this.db = database;
    this.version = 5;
    this.name = 'add_mistake_inaccuracy_columns';
  }

  async up() {
    console.log('🔄 Running migration: Add is_mistake and is_inaccuracy columns to analysis table');

    // Add is_mistake column
    try {
      await this.db.run(`
        ALTER TABLE analysis ADD COLUMN is_mistake BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Added is_mistake column');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('⏭️ is_mistake column already exists');
      } else {
        throw error;
      }
    }

    // Add is_inaccuracy column
    try {
      await this.db.run(`
        ALTER TABLE analysis ADD COLUMN is_inaccuracy BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Added is_inaccuracy column');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('⏭️ is_inaccuracy column already exists');
      } else {
        throw error;
      }
    }

    // Add fen_after column for storing the position after each move
    try {
      await this.db.run(`
        ALTER TABLE analysis ADD COLUMN fen_after TEXT
      `);
      console.log('✅ Added fen_after column');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('⏭️ fen_after column already exists');
      } else {
        throw error;
      }
    }

    console.log('✅ Analysis table enhanced with mistake and inaccuracy tracking');
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove mistake and inaccuracy columns');
    // SQLite doesn't support DROP COLUMN easily, so we would need to recreate the table
    // For simplicity, we'll just log that this migration can't be easily rolled back
    console.log('⚠️ Note: SQLite does not support dropping columns. Manual intervention required for rollback.');
  }
}

module.exports = Migration005;
