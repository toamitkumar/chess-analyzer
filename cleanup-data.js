const { getDatabase } = require('./src/models/database');

async function cleanupData() {
  const db = getDatabase();
  
  try {
    console.log('🧹 Cleaning up all data...');
    
    // Initialize database first
    await db.initialize();
    
    // Delete in correct order to respect foreign key constraints
    await db.run('DELETE FROM analysis');
    await db.run('DELETE FROM phase_analysis');
    await db.run('DELETE FROM opening_analysis');
    await db.run('DELETE FROM tactical_motifs');
    await db.run('DELETE FROM phase_stats');
    await db.run('DELETE FROM opening_stats');
    await db.run('DELETE FROM games');
    await db.run('DELETE FROM tournaments');
    
    // Reset performance metrics
    await db.run(`UPDATE performance_metrics SET 
      total_games = 0, wins = 0, losses = 0, draws = 0,
      total_moves = 0, total_blunders = 0, total_centipawn_loss = 0,
      last_updated = CURRENT_TIMESTAMP`);
    
    console.log('✅ All data cleaned successfully');
    
    // Verify cleanup
    const gameCount = await db.get('SELECT COUNT(*) as count FROM games');
    const analysisCount = await db.get('SELECT COUNT(*) as count FROM analysis');
    const tournamentCount = await db.get('SELECT COUNT(*) as count FROM tournaments');
    
    console.log(`📊 Verification - Games: ${gameCount.count}, Analysis: ${analysisCount.count}, Tournaments: ${tournamentCount.count}`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await db.close();
  }
}

cleanupData();
