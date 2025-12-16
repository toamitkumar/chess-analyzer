#!/usr/bin/env node

/**
 * Link Blunders to Puzzles (Backfill Script)
 *
 * Automatically links all existing blunders to matching puzzles
 * Run this once to populate blunder_puzzle_links for existing data
 */

const { getDatabase } = require('../src/models/database');
const BlunderPuzzleLinker = require('../src/models/blunder-puzzle-linker');

async function linkAllBlunders() {
  console.log('🔗 Linking Blunders to Puzzles');
  console.log('==============================\n');

  try {
    // Initialize database
    const db = getDatabase();
    await db.initialize();

    // Create linker
    const linker = new BlunderPuzzleLinker(db);

    // Get counts
    const totalBlunders = await db.get(`
      SELECT COUNT(*) as count FROM blunder_details
      WHERE tactical_theme IS NOT NULL
    `);

    const alreadyLinked = await db.get(`
      SELECT COUNT(DISTINCT blunder_id) as count FROM blunder_puzzle_links
    `);

    console.log(`📊 Current Status:`);
    console.log(`   Total blunders: ${totalBlunders.count}`);
    console.log(`   Already linked: ${alreadyLinked.count}`);
    console.log(`   To be linked: ${totalBlunders.count - alreadyLinked.count}`);
    console.log('');

    if (totalBlunders.count === alreadyLinked.count) {
      console.log('✅ All blunders already linked!');
      return;
    }

    // Link unlinked blunders
    console.log('🔄 Starting auto-linking...\n');
    const startTime = Date.now();

    const stats = await linker.linkUnlinkedBlunders();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('✅ Linking Complete!');
    console.log('===================\n');
    console.log(`📈 Statistics:`);
    console.log(`   Blunders processed: ${stats.total}`);
    console.log(`   Successfully linked: ${stats.linked}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Total puzzles linked: ${stats.totalPuzzles}`);
    console.log(`   Average puzzles per blunder: ${(stats.totalPuzzles / stats.linked).toFixed(1)}`);
    console.log(`   Duration: ${duration} seconds`);
    console.log('');

    // Show sample
    console.log('📝 Sample Links:');
    const sampleLinks = await db.all(`
      SELECT
        bd.id,
        bd.tactical_theme,
        bd.phase,
        COUNT(bpl.puzzle_id) as puzzle_count,
        GROUP_CONCAT(bpl.puzzle_id, ', ') as puzzle_ids
      FROM blunder_details bd
      JOIN blunder_puzzle_links bpl ON bd.id = bpl.blunder_id
      GROUP BY bd.id
      LIMIT 5
    `);

    sampleLinks.forEach(link => {
      console.log(`   Blunder ${link.id} (${link.tactical_theme}, ${link.phase}): ${link.puzzle_count} puzzles`);
      console.log(`     Puzzles: ${link.puzzle_ids.substring(0, 60)}...`);
    });

    console.log('');
    console.log('🎉 Ready to practice!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Test API: curl http://localhost:3000/api/puzzles/blunder/1');
    console.log('  2. View blunder dashboard to see "Practice" buttons');
    console.log('  3. Start building puzzle practice UI');

  } catch (error) {
    console.error('❌ Linking failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  linkAllBlunders().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = linkAllBlunders;
