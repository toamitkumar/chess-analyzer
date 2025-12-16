/**
 * Test Phase 3 API Endpoints
 * Tests the puzzle recommendation and progress tracking endpoints
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function testPhase3Endpoints() {
  console.log('🧪 Testing Phase 3 API Endpoints\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: GET /api/puzzles/recommended
    console.log('\n1️⃣  Testing GET /api/puzzles/recommended');
    console.log('-'.repeat(60));

    const recommended = await makeRequest('/api/puzzles/recommended?limit=5');
    console.log(`   Status: ${recommended.status}`);

    if (recommended.status === 200) {
      console.log(`   ✅ Success! Got ${recommended.data.recommendations?.length || 0} recommendations`);
      if (recommended.data.recommendations?.length > 0) {
        console.log(`   First puzzle: ${recommended.data.recommendations[0].id}`);
        console.log(`   Player rating: ${recommended.data.playerRating}`);
      }
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(recommended.data)}`);
    }

    // Test 2: GET /api/puzzles/recommended?enhanced=true
    console.log('\n2️⃣  Testing GET /api/puzzles/recommended?enhanced=true');
    console.log('-'.repeat(60));

    const enhanced = await makeRequest('/api/puzzles/recommended?limit=5&enhanced=true');
    console.log(`   Status: ${enhanced.status}`);

    if (enhanced.status === 200) {
      console.log(`   ✅ Success! Got ${enhanced.data.recommendations?.length || 0} enhanced recommendations`);
      console.log(`   Review count: ${enhanced.data.reviewCount || 0}`);
      console.log(`   New count: ${enhanced.data.newCount || 0}`);
      console.log(`   Adaptive difficulty: ${JSON.stringify(enhanced.data.adaptiveDifficulty)}`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(enhanced.data)}`);
    }

    // Get a puzzle ID for testing
    let testPuzzleId = null;
    if (recommended.data.recommendations?.length > 0) {
      testPuzzleId = recommended.data.recommendations[0].id;
    } else {
      // Fallback: get a puzzle ID from the index
      const { Database } = require('../src/models/database');
      const db = new Database();
      await db.initialize();
      const puzzle = await db.get('SELECT id FROM puzzle_index LIMIT 1');
      testPuzzleId = puzzle?.id;
      await db.close();
    }

    if (!testPuzzleId) {
      console.log('\n⚠️  No puzzle ID available for testing. Skipping remaining tests.');
      return;
    }

    // Test 3: GET /api/puzzles/:id
    console.log(`\n3️⃣  Testing GET /api/puzzles/${testPuzzleId}`);
    console.log('-'.repeat(60));

    const puzzleDetails = await makeRequest(`/api/puzzles/${testPuzzleId}`);
    console.log(`   Status: ${puzzleDetails.status}`);

    if (puzzleDetails.status === 200) {
      console.log(`   ✅ Success! Got puzzle details`);
      console.log(`   Puzzle ID: ${puzzleDetails.data.puzzle?.id}`);
      console.log(`   Rating: ${puzzleDetails.data.puzzle?.rating}`);
      console.log(`   Themes: ${puzzleDetails.data.puzzle?.themes?.join(', ')}`);
      console.log(`   FEN: ${puzzleDetails.data.game?.fen?.substring(0, 50)}...`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(puzzleDetails.data)}`);
    }

    // Test 4: POST /api/puzzles/:id/attempt (success)
    console.log(`\n4️⃣  Testing POST /api/puzzles/${testPuzzleId}/attempt (solved)`);
    console.log('-'.repeat(60));

    const attemptSuccess = await makeRequest(
      `/api/puzzles/${testPuzzleId}/attempt`,
      'POST',
      {
        solved: true,
        timeSpent: 15000, // 15 seconds
        movesCount: 3,
        hintsUsed: 0
      }
    );
    console.log(`   Status: ${attemptSuccess.status}`);

    if (attemptSuccess.status === 200) {
      console.log(`   ✅ Success! Attempt recorded`);
      console.log(`   Puzzle ID: ${attemptSuccess.data.progress?.puzzle_id}`);
      console.log(`   Solved: ${attemptSuccess.data.progress?.solved}`);
      console.log(`   Attempts: ${attemptSuccess.data.progress?.attempts}`);
      console.log(`   Mastery score: ${attemptSuccess.data.progress?.masteryScore}`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(attemptSuccess.data)}`);
    }

    // Test 5: POST /api/puzzles/:id/attempt (failure)
    console.log(`\n5️⃣  Testing POST /api/puzzles/${testPuzzleId}/attempt (failed)`);
    console.log('-'.repeat(60));

    const attemptFail = await makeRequest(
      `/api/puzzles/${testPuzzleId}/attempt`,
      'POST',
      {
        solved: false,
        timeSpent: 30000, // 30 seconds
        movesCount: 5,
        hintsUsed: 2
      }
    );
    console.log(`   Status: ${attemptFail.status}`);

    if (attemptFail.status === 200) {
      console.log(`   ✅ Success! Attempt recorded`);
      console.log(`   Puzzle ID: ${attemptFail.data.progress?.puzzle_id}`);
      console.log(`   Solved: ${attemptFail.data.progress?.solved}`);
      console.log(`   Attempts: ${attemptFail.data.progress?.attempts}`);
      console.log(`   Mastery score: ${attemptFail.data.progress?.masteryScore}`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(attemptFail.data)}`);
    }

    // Test 6: GET /api/puzzle-progress/:puzzleId
    console.log(`\n6️⃣  Testing GET /api/puzzle-progress/${testPuzzleId}`);
    console.log('-'.repeat(60));

    const progress = await makeRequest(`/api/puzzle-progress/${testPuzzleId}`);
    console.log(`   Status: ${progress.status}`);

    if (progress.status === 200) {
      console.log(`   ✅ Success! Got progress data`);
      console.log(`   Puzzle ID: ${progress.data.puzzle_id}`);
      console.log(`   Total attempts: ${progress.data.attempts}`);
      console.log(`   Times solved: ${progress.data.times_solved}`);
      console.log(`   Times failed: ${progress.data.times_failed}`);
      console.log(`   Mastery score: ${progress.data.mastery_score}`);
      console.log(`   Last attempted: ${progress.data.last_attempted_at}`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(progress.data)}`);
    }

    // Test 7: GET /api/puzzle-progress (all)
    console.log(`\n7️⃣  Testing GET /api/puzzle-progress (all progress)`);
    console.log('-'.repeat(60));

    const allProgress = await makeRequest('/api/puzzle-progress');
    console.log(`   Status: ${allProgress.status}`);

    if (allProgress.status === 200) {
      console.log(`   ✅ Success! Got all progress data`);
      console.log(`   Total puzzles attempted: ${allProgress.data.length || 0}`);
      if (allProgress.data.length > 0) {
        console.log(`   Sample: ${allProgress.data[0].puzzle_id} - ${allProgress.data[0].attempts} attempts`);
      }
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(allProgress.data)}`);
    }

    // Test 8: GET /api/learning-path
    console.log(`\n8️⃣  Testing GET /api/learning-path`);
    console.log('-'.repeat(60));

    const learningPath = await makeRequest('/api/learning-path');
    console.log(`   Status: ${learningPath.status}`);

    if (learningPath.status === 200) {
      console.log(`   ✅ Success! Got learning path`);
      console.log(`   Recommendations: ${learningPath.data.recommendations?.length || 0}`);
      console.log(`   Daily goal progress: ${learningPath.data.dailyGoals?.progress || 0}%`);
      console.log(`   Weak themes: ${learningPath.data.weakThemes?.length || 0}`);
      console.log(`   Statistics: ${JSON.stringify(learningPath.data.statistics)}`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(learningPath.data)}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All Phase 3 endpoint tests completed!\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run tests
console.log('📋 Make sure the API server is running on port 3000');
console.log('   Run: npm run dashboard\n');

setTimeout(() => {
  testPhase3Endpoints()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}, 1000);
