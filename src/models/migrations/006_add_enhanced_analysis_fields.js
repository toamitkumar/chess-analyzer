class Migration006 {
  constructor(database) {
    this.db = database;
    this.version = 6;
    this.name = 'add_enhanced_analysis_fields';
  }

  async up() {
    console.log('🔄 Running migration: Add enhanced analysis fields (Lichess/Chess.com style)');

    // Add move_quality column (best/excellent/good/inaccuracy/mistake/blunder)
    try {
      await this.db.run(`
        ALTER TABLE analysis ADD COLUMN move_quality TEXT
      `);
      console.log('✅ Added move_quality column');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('⏭️ move_quality column already exists');
      } else {
        throw error;
      }
    }

    // Add move_accuracy column (per-move accuracy score 0-100)
    try {
      await this.db.run(`
        ALTER TABLE analysis ADD COLUMN move_accuracy REAL
      `);
      console.log('✅ Added move_accuracy column');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('⏭️ move_accuracy column already exists');
      } else {
        throw error;
      }
    }

    // Add win_probability_before column
    try {
      await this.db.run(`
        ALTER TABLE analysis ADD COLUMN win_probability_before REAL
      `);
      console.log('✅ Added win_probability_before column');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('⏭️ win_probability_before column already exists');
      } else {
        throw error;
      }
    }

    // Add win_probability_after column
    try {
      await this.db.run(`
        ALTER TABLE analysis ADD COLUMN win_probability_after REAL
      `);
      console.log('✅ Added win_probability_after column');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('⏭️ win_probability_after column already exists');
      } else {
        throw error;
      }
    }

    // Add is_best column
    try {
      await this.db.run(`
        ALTER TABLE analysis ADD COLUMN is_best BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Added is_best column');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('⏭️ is_best column already exists');
      } else {
        throw error;
      }
    }

    // Add is_excellent column
    try {
      await this.db.run(`
        ALTER TABLE analysis ADD COLUMN is_excellent BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Added is_excellent column');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('⏭️ is_excellent column already exists');
      } else {
        throw error;
      }
    }

    // Add is_good column
    try {
      await this.db.run(`
        ALTER TABLE analysis ADD COLUMN is_good BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Added is_good column');
    } catch (error) {
      if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
        console.log('⏭️ is_good column already exists');
      } else {
        throw error;
      }
    }

    console.log('✅ Enhanced analysis fields added successfully (Lichess/Chess.com compatible)');
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove enhanced analysis fields');
    console.log('⚠️ Note: SQLite does not support dropping columns. Manual intervention required for rollback.');
  }
}

module.exports = Migration006;
