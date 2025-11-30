// Simple script to test migrations
const { getDatabase } = require('./src/models/database');

async function testMigrations() {
  console.log('🧪 Testing migrations on SQLite (local)...\n');

  try {
    const db = getDatabase();
    await db.initialize();

    console.log('\n✅ Database initialized successfully');
    console.log('   Checking puzzle tables...');

    // Check if puzzle_index exists
    const puzzleIndex = await db.get(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='puzzle_index'
    `);

    if (puzzleIndex) {
      console.log('   ✅ puzzle_index table created');

      // Check schema
      const schema = await db.all('PRAGMA table_info(puzzle_index)');
      console.log('      Columns:', schema.map(c => `${c.name} (${c.type})`).join(', '));
    } else {
      console.log('   ❌ puzzle_index table NOT found');
    }

    // Check if puzzle_cache exists
    const puzzleCache = await db.get(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='puzzle_cache'
    `);

    if (puzzleCache) {
      console.log('   ✅ puzzle_cache table created');

      // Check schema
      const schema = await db.all('PRAGMA table_info(puzzle_cache)');
      console.log('      Columns:', schema.map(c => `${c.name} (${c.type})`).join(', '));
    } else {
      console.log('   ❌ puzzle_cache table NOT found');
    }

    // Check indexes
    const indexes = await db.all(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND (
        name LIKE 'idx_puzzle_%'
      )
    `);
    console.log('\n   📊 Indexes created:', indexes.map(i => i.name).join(', '));

    // Check migrations table
    const migrations = await db.all('SELECT * FROM migrations ORDER BY version');
    console.log('\n   📋 Applied migrations:');
    migrations.forEach(m => {
      console.log(`      ${m.version}. ${m.name} (${m.applied_at})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testMigrations();
