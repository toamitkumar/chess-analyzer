const { getDatabase } = require('./src/models/database');

async function cleanupData() {
  const db = getDatabase();
  
  try {
    console.log('🧹 Cleaning up all data...');

    // Initialize database first
    await db.initialize();

    // Temporarily disable foreign key constraints for cleanup
    await db.run('PRAGMA foreign_keys = OFF');

    // Delete all data from tables (only tables that exist)
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

    await safeDelete('blunder_details');
    await safeDelete('blunder_puzzle_links');
    await safeDelete('puzzle_progress');
    await safeDelete('user_puzzle_progress');
    await safeDelete('puzzle_cache');
    await safeDelete('analysis');
    await safeDelete('phase_analysis');
    await safeDelete('opening_analysis');
    await safeDelete('tactical_motifs');
    await safeDelete('phase_stats');
    await safeDelete('opening_stats');
    await safeDelete('games');
    await safeDelete('tournaments');

    // Re-enable foreign key constraints
    await db.run('PRAGMA foreign_keys = ON');
    
    // Reset performance metrics
    await db.run(`UPDATE performance_metrics SET 
      total_games = 0, wins = 0, losses = 0, draws = 0,
      total_moves = 0, total_blunders = 0, total_centipawn_loss = 0,
      last_updated = CURRENT_TIMESTAMP`);
    
    console.log('✅ All data cleaned successfully');
    
    // Verify cleanup
    const gameCount = await db.get('SELECT COUNT(*) as count FROM games');
    const analysisCount = await db.get('SELECT COUNT(*) as count FROM analysis');
    const blunderCount = await db.get('SELECT COUNT(*) as count FROM blunder_details');
    const tournamentCount = await db.get('SELECT COUNT(*) as count FROM tournaments');

    console.log(`📊 Verification - Games: ${gameCount.count}, Analysis: ${analysisCount.count}, Blunders: ${blunderCount.count}, Tournaments: ${tournamentCount.count}`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await db.close();
  }
}

cleanupData();
