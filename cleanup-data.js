const { getDatabase } = require('./src/models/database');

/**
 * Database Cleanup Script
 *
 * Wipes game analysis data while preserving user authentication tables.
 *
 * Usage: node cleanup-data.js [--preserve-users]
 *
 * Options:
 *   --preserve-users   Keep user tables intact (default)
 *   --wipe-all        Wipe everything including users (DANGEROUS)
 *
 * IMPORTANT: This script ALWAYS preserves user tables by default.
 * User tables that are preserved:
 *   - users
 *   - user_sessions
 *   - user_puzzle_progress
 */

async function cleanupData() {
  const db = getDatabase();
  const args = process.argv.slice(2);
  const wipeAll = args.includes('--wipe-all');

  try {
    if (wipeAll) {
      console.log('⚠️  WARNING: Running in --wipe-all mode!');
      console.log('⚠️  This will DELETE USER DATA including accounts and sessions!');
      console.log('⚠️  Waiting 5 seconds... Press Ctrl+C to cancel.');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('🧹 Cleaning up database...');
    console.log(`📋 Mode: ${wipeAll ? 'WIPE ALL (including users)' : 'PRESERVE USERS (default)'}\n`);

    // Initialize database first
    await db.initialize();

    // Temporarily disable foreign key constraints for cleanup
    await db.run('PRAGMA foreign_keys = OFF');

    // Helper to safely delete from table if it exists
    const safeDelete = async (tableName) => {
      try {
        await db.run(`DELETE FROM ${tableName}`);
        console.log(`  ✓ Cleared ${tableName}`);
      } catch (err) {
        if (err.code === 'SQLITE_ERROR' && err.message.includes('no such table')) {
          console.log(`  ⊘ Skipped ${tableName} (doesn't exist)`);
        } else {
          throw err;
        }
      }
    };

    console.log('\n🗑️  Deleting game analysis data...');

    // Analysis-related tables (safe to delete)
    await safeDelete('blunder_details');
    await safeDelete('blunder_puzzle_links');
    await safeDelete('puzzle_cache');
    await safeDelete('alternative_moves');
    await safeDelete('position_evaluations');
    await safeDelete('analysis');
    await safeDelete('phase_analysis');
    await safeDelete('opening_analysis');
    await safeDelete('tactical_motifs');
    await safeDelete('phase_stats');
    await safeDelete('opening_stats');
    await safeDelete('games');
    await safeDelete('tournaments');

    // User-specific progress (preserve unless --wipe-all)
    if (wipeAll) {
      console.log('\n🗑️  Deleting user data (--wipe-all mode)...');
      await safeDelete('user_puzzle_progress');
      await safeDelete('puzzle_progress');
      await safeDelete('user_sessions');
      await safeDelete('users');
    } else {
      console.log('\n✅ Preserving user tables:');
      console.log('  ✓ users');
      console.log('  ✓ user_sessions');
      console.log('  ✓ user_puzzle_progress');
    }

    // Re-enable foreign key constraints
    await db.run('PRAGMA foreign_keys = ON');

    // Reset performance metrics per user (or all if wiping users)
    if (wipeAll) {
      await safeDelete('performance_metrics');
    } else {
      // Reset metrics but keep user_id associations
      try {
        await db.run(`UPDATE performance_metrics SET
          total_games = 0, wins = 0, losses = 0, draws = 0,
          total_moves = 0, total_blunders = 0, total_centipawn_loss = 0,
          last_updated = CURRENT_TIMESTAMP`);
        console.log('  ✓ Reset performance_metrics (kept user associations)');
      } catch (err) {
        // Table might not exist, safe to ignore
      }
    }

    console.log('\n✅ Database cleanup completed successfully');

    // Verify cleanup
    console.log('\n📊 Verification:');
    const gameCount = await db.get('SELECT COUNT(*) as count FROM games');
    const analysisCount = await db.get('SELECT COUNT(*) as count FROM analysis');
    const blunderCount = await db.get('SELECT COUNT(*) as count FROM blunder_details');
    const tournamentCount = await db.get('SELECT COUNT(*) as count FROM tournaments');

    console.log(`  Games: ${gameCount.count}`);
    console.log(`  Analysis: ${analysisCount.count}`);
    console.log(`  Blunders: ${blunderCount.count}`);
    console.log(`  Tournaments: ${tournamentCount.count}`);

    if (!wipeAll) {
      const userCount = await db.get('SELECT COUNT(*) as count FROM users');
      console.log(`  Users: ${userCount.count} (preserved)`);
    }

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

cleanupData();
