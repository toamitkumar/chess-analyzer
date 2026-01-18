/**
 * Migration: Add piece_type column to blunder_details
 *
 * Track which piece was involved in each blunder (especially hanging pieces)
 * so we can show breakdown by piece type on the insights dashboard.
 *
 * Values: 'P' (pawn), 'N' (knight), 'B' (bishop), 'R' (rook), 'Q' (queen), 'K' (king)
 *
 * Reference: ADR 009 Phase 5.2 - Hanging Pieces by Piece Type
 */

class Migration019 {
  constructor(database) {
    this.db = database;
    this.version = 19;
    this.name = 'add_piece_type_to_blunder_details';
  }

  async up() {
    console.log('🔄 Running migration: Add piece_type to blunder_details table');

    // Add column to track which piece was involved in the blunder
    try {
      await this.db.run(`
        ALTER TABLE blunder_details
        ADD COLUMN piece_type TEXT CHECK (piece_type IN ('P', 'N', 'B', 'R', 'Q', 'K'))
      `);
      console.log('  ✓ Added piece_type column to blunder_details table');
    } catch (err) {
      if (err.message.includes('duplicate column')) {
        console.log('  ⏭️  Column piece_type already exists, skipping');
      } else {
        throw err;
      }
    }

    // Create index for efficient querying by piece type
    try {
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_blunder_details_piece_type
        ON blunder_details(piece_type)
      `);
      console.log('  ✓ Created index on piece_type column');
    } catch (err) {
      console.log('  ⚠️  Index creation failed (may already exist):', err.message);
    }

    console.log('✅ Migration completed: piece_type column added to blunder_details');
  }

  async down() {
    console.log('🔄 Rolling back migration: Remove piece_type from blunder_details');

    // Drop index
    try {
      await this.db.run('DROP INDEX IF EXISTS idx_blunder_details_piece_type');
      console.log('  ✓ Dropped index idx_blunder_details_piece_type');
    } catch (err) {
      console.log('  ⚠️  Index drop failed:', err.message);
    }

    console.log('  ⚠️  SQLite does not support DROP COLUMN - manual intervention required');
  }
}

module.exports = Migration019;
