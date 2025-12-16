#!/usr/bin/env node

/**
 * Test Puzzle Matching
 *
 * Verify that blunders can be matched to puzzles from the 3M+ puzzle database
 */

const { getDatabase } = require('../src/models/database');
const PuzzleMatcher = require('../src/models/puzzle-matcher');

async function testPuzzleMatching() {
  console.log('🧪 Testing Puzzle Matching System');
  console.log('=================================\n');

  try {
    // Initialize database
    const db = getDatabase();
    await db.initialize();

    // Get a sample blunder
    const blunder = await db.get(`
      SELECT id, game_id, move_number, tactical_theme, position_type, phase, centipawn_loss
      FROM blunder_details
      WHERE tactical_theme IS NOT NULL
      LIMIT 1
    `);

    if (!blunder) {
      console.log('❌ No blunders found in database');
      console.log('   Run some game analysis first');
      return;
    }

    console.log('📍 Test Blunder:');
    console.log(`   ID: ${blunder.id}`);
    console.log(`   Game: ${blunder.game_id}, Move: ${blunder.move_number}`);
    console.log(`   Theme: ${blunder.tactical_theme}`);
    console.log(`   Phase: ${blunder.phase}`);
    console.log(`   Loss: ${blunder.centipawn_loss} centipawns`);
    console.log('');

    // Map blunder themes to Lichess themes (same logic as API)
    const ThemeMapper = require('../src/models/theme-mapper');
    const themes = ThemeMapper.getCombinedThemes(
      blunder.tactical_theme,
      blunder.position_type,
      blunder.phase
    );

    console.log(`🗺️  Original theme: ${blunder.tactical_theme}`);
    console.log(`🎯 Mapped to Lichess themes: [${themes.join(', ')}]`);
    console.log('');

    // Match puzzles
    const matcher = new PuzzleMatcher(db, { maxResults: 5 });
    const matches = await matcher.findMatchingPuzzles({
      themes: themes,
      phase: blunder.phase
    });

    if (matches.length === 0) {
      console.log('⚠️  No puzzle matches found');
      console.log('   This might happen if:');
      console.log('   - Theme names don\'t match Lichess puzzle themes');
      console.log('   - Need to map tactical_theme to Lichess themes');
      return;
    }

    console.log(`✅ Found ${matches.length} matching puzzles:`);
    console.log('');

    matches.forEach((puzzle, index) => {
      console.log(`${index + 1}. Puzzle ${puzzle.id}`);
      console.log(`   Rating: ${puzzle.rating}`);
      console.log(`   Themes: ${puzzle.themes}`);
      console.log(`   Popularity: ${puzzle.popularity}`);
      console.log(`   Match Score: ${puzzle.score}`);
      console.log('');
    });

    // Test fetching full puzzle details
    console.log('📦 Testing puzzle detail fetch...');
    const firstPuzzle = matches[0];

    // Check if puzzle is in cache
    const cached = await db.get(`
      SELECT * FROM puzzle_cache WHERE id = ?
    `, [firstPuzzle.id]);

    if (cached) {
      console.log(`✅ Puzzle ${firstPuzzle.id} found in cache`);
    } else {
      console.log(`ℹ️  Puzzle ${firstPuzzle.id} not cached yet`);
      console.log('   Would be fetched from Lichess API on demand');
    }

    console.log('');
    console.log('🎉 Puzzle matching system is working!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Map tactical_theme names to Lichess themes');
    console.log('  2. Auto-link all blunders to puzzles');
    console.log('  3. Complete API endpoints');
    console.log('  4. Build frontend UI');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  testPuzzleMatching().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = testPuzzleMatching;
