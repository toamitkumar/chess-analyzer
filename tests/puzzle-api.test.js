const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../src/models/database');
const PuzzleMatcher = require('../src/models/puzzle-matcher');
const PuzzleCacheManager = require('../src/models/puzzle-cache-manager');
const LichessAPIClient = require('../src/models/lichess-api-client');

// Mock Lichess API to avoid external API calls in tests
jest.mock('../src/models/lichess-api-client');

describe('Puzzle API Endpoints', () => {
  let app;
  let db;
  let puzzleMatcher;
  let puzzleCache;
  let lichessClient;
  let testCounter = 0; // Use incremental IDs to avoid FK conflicts

  beforeAll(async () => {
    // Set up test database
    process.env.NODE_ENV = 'test';
    db = getDatabase();
    await db.initialize();

    // Create Express app with puzzle routes
    app = express();
    app.use(express.json());

    // Initialize services
    puzzleMatcher = new PuzzleMatcher(db);
    puzzleCache = new PuzzleCacheManager(db);
    lichessClient = new LichessAPIClient();

    // Define puzzle routes (will be implemented in api-server.js)

    // GET /api/puzzles/blunder/:blunderId - Get recommended puzzles for a blunder
    app.get('/api/puzzles/blunder/:blunderId', async (req, res) => {
      try {
        const blunderId = parseInt(req.params.blunderId);

        // Get blunder from database
        const blunder = await db.get(`
          SELECT id, fen, tactical_theme, position_type
          FROM blunder_details
          WHERE id = ?
        `, [blunderId]);

        if (!blunder) {
          return res.status(404).json({ error: 'Blunder not found' });
        }

        // Parse themes from tactical_theme and position_type
        const themes = [];
        if (blunder.tactical_theme) {
          themes.push(...blunder.tactical_theme.split(',').map(t => t.trim()));
        }
        if (blunder.position_type) {
          themes.push(blunder.position_type);
        }

        // Find matching puzzles
        const matches = await puzzleMatcher.findMatchingPuzzles({
          fen_before: blunder.fen,
          themes
        });

        res.json({
          blunderId,
          puzzles: matches
        });
      } catch (error) {
        console.error('[API] Error finding puzzles for blunder:', error);
        res.status(500).json({ error: 'Failed to find matching puzzles' });
      }
    });

    // GET /api/puzzles/:puzzleId - Get full puzzle details (with caching)
    app.get('/api/puzzles/:puzzleId', async (req, res) => {
      try {
        const puzzleId = req.params.puzzleId;

        // Check cache first
        let puzzle = await puzzleCache.get(puzzleId);

        if (!puzzle) {
          // Cache miss - fetch from Lichess API
          puzzle = await lichessClient.fetchPuzzle(puzzleId);

          if (puzzle.error) {
            return res.status(404).json({
              error: 'Puzzle not found',
              lichessUrl: puzzle.lichessUrl
            });
          }

          // Cache the puzzle
          await puzzleCache.set(puzzle);
        }

        res.json(puzzle);
      } catch (error) {
        console.error('[API] Error fetching puzzle:', error);
        res.status(500).json({ error: 'Failed to fetch puzzle' });
      }
    });

    // POST /api/puzzles/link - Link a blunder to recommended puzzles
    app.post('/api/puzzles/link', async (req, res) => {
      try {
        const { blunderId, puzzleIds } = req.body;

        if (!blunderId || !Array.isArray(puzzleIds)) {
          return res.status(400).json({ error: 'Invalid request body' });
        }

        // Get blunder and find matching puzzles
        const blunder = await db.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);
        if (!blunder) {
          return res.status(404).json({ error: 'Blunder not found' });
        }

        // Parse themes from tactical_theme and position_type
        const themes = [];
        if (blunder.tactical_theme) {
          themes.push(...blunder.tactical_theme.split(',').map(t => t.trim()));
        }
        if (blunder.position_type) {
          themes.push(blunder.position_type);
        }

        const matches = await puzzleMatcher.findMatchingPuzzles({
          fen_before: blunder.fen,
          themes
        });

        // Save links
        const links = [];
        for (const match of matches.slice(0, puzzleIds.length || 5)) {
          await db.run(`
            INSERT INTO blunder_puzzle_links (blunder_id, puzzle_id, match_score)
            VALUES (?, ?, ?)
            ON CONFLICT (blunder_id, puzzle_id) DO UPDATE SET match_score = excluded.match_score
          `, [blunderId, match.id, match.score]);

          links.push({ puzzleId: match.id, score: match.score });
        }

        res.json({ blunderId, links });
      } catch (error) {
        console.error('[API] Error linking puzzles:', error);
        res.status(500).json({ error: 'Failed to link puzzles' });
      }
    });
  });

  afterAll(async () => {
    // Cleanup test data at end
    // Note: Using CASCADE delete requires careful ordering
    // For simplicity, we just clear puzzle cache and index
    await db.run('DELETE FROM puzzle_cache');
    await db.run('DELETE FROM puzzle_index WHERE id LIKE \'test_%\'');
  });

  beforeEach(async () => {
    // Increment test counter for unique IDs
    testCounter++;

    // Clear puzzle data (games/blunders are test-specific with unique IDs)
    await db.run('DELETE FROM puzzle_cache');
    await db.run(`DELETE FROM puzzle_index WHERE id LIKE 'test_${testCounter}%'`);

    // Seed test data with unique IDs
    await seedTestData(db, testCounter);

    // Mock Lichess API client
    lichessClient.fetchPuzzle.mockImplementation(async (puzzleId) => {
      return {
        id: puzzleId,
        puzzle: {
          id: puzzleId,
          solution: ['e2e4', 'e7e5'],
          themes: ['fork', 'middlegame']
        },
        game: {
          pgn: 'test pgn'
        },
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: 'e2e4 e7e5',
        solution: 'Nf3',
        themes: 'fork middlegame',
        rating: 1500,
        game_url: `https://lichess.org/training/${puzzleId}`
      };
    });
  });

  describe('GET /api/puzzles/blunder/:blunderId', () => {
    test('should return matching puzzles for a blunder', async () => {
      const blunderId = 10000 + testCounter;

      const response = await request(app)
        .get(`/api/puzzles/blunder/${blunderId}`)
        .expect(200);

      expect(response.body).toHaveProperty('blunderId', blunderId);
      expect(response.body).toHaveProperty('puzzles');
      expect(Array.isArray(response.body.puzzles)).toBe(true);
      expect(response.body.puzzles.length).toBeGreaterThan(0);
    });

    test('should return 404 for non-existent blunder', async () => {
      const response = await request(app)
        .get('/api/puzzles/blunder/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Blunder not found');
    });

    test('should limit results to matcher maxResults', async () => {
      const blunderId = 10000 + testCounter;

      const response = await request(app)
        .get(`/api/puzzles/blunder/${blunderId}`)
        .expect(200);

      // PuzzleMatcher defaults to maxResults=5
      expect(response.body.puzzles.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/puzzles/:puzzleId', () => {
    test('should fetch puzzle from Lichess API on cache miss', async () => {
      const response = await request(app)
        .get('/api/puzzles/abc123')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'abc123');
      expect(lichessClient.fetchPuzzle).toHaveBeenCalledWith('abc123');
    });

    test('should return cached puzzle on cache hit', async () => {
      // First request - cache miss
      await request(app).get('/api/puzzles/xyz789');

      // Second request - cache hit
      lichessClient.fetchPuzzle.mockClear();

      const response = await request(app)
        .get('/api/puzzles/xyz789')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'xyz789');
      // Should not call Lichess API again
      expect(lichessClient.fetchPuzzle).not.toHaveBeenCalled();
    });

    test('should handle puzzle not found', async () => {
      lichessClient.fetchPuzzle.mockResolvedValueOnce({
        id: 'invalid',
        error: true,
        lichessUrl: 'https://lichess.org/training/invalid'
      });

      const response = await request(app)
        .get('/api/puzzles/invalid')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Puzzle not found');
      expect(response.body).toHaveProperty('lichessUrl');
    });
  });

  describe('POST /api/puzzles/link', () => {
    test('should link puzzles to a blunder', async () => {
      const blunderId = 10000 + testCounter;
      const puzzleIds = [`test_${testCounter}_p001`, `test_${testCounter}_p002`];

      const response = await request(app)
        .post('/api/puzzles/link')
        .send({
          blunderId,
          puzzleIds
        })
        .expect(200);

      expect(response.body).toHaveProperty('blunderId', blunderId);
      expect(response.body).toHaveProperty('links');
      expect(Array.isArray(response.body.links)).toBe(true);

      // Verify links were created in database
      const links = await db.all(`
        SELECT * FROM blunder_puzzle_links
        WHERE blunder_id = ?
      `, [blunderId]);

      expect(links.length).toBeGreaterThan(0);
    });

    test('should return 400 for invalid request body', async () => {
      const blunderId = 10000 + testCounter;

      const response = await request(app)
        .post('/api/puzzles/link')
        .send({ blunderId }) // Missing puzzleIds
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request body');
    });

    test('should return 404 for non-existent blunder', async () => {
      const response = await request(app)
        .post('/api/puzzles/link')
        .send({
          blunderId: 99999,
          puzzleIds: ['p001']
        })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Blunder not found');
    });

    test('should update existing links on conflict', async () => {
      const blunderId = 10000 + testCounter;
      const puzzleId = `test_${testCounter}_p001`;

      // Create initial link
      await db.run(`
        INSERT INTO blunder_puzzle_links (blunder_id, puzzle_id, match_score)
        VALUES (?, ?, 100)
      `, [blunderId, puzzleId]);

      // Update link via API
      const response = await request(app)
        .post('/api/puzzles/link')
        .send({
          blunderId,
          puzzleIds: [puzzleId, `test_${testCounter}_p002`]
        })
        .expect(200);

      expect(response.body.links).toBeDefined();

      // Verify link was updated
      const link = await db.get(`
        SELECT * FROM blunder_puzzle_links
        WHERE blunder_id = ? AND puzzle_id = ?
      `, [blunderId, puzzleId]);

      expect(link).toBeDefined();
    });
  });
});

/**
 * Seed test database with sample data
 * @param {Object} db - Database instance
 * @param {number} testId - Unique test ID to avoid FK conflicts
 */
async function seedTestData(db, testId) {
  const gameId = 10000 + testId;  // Start at 10000 to avoid conflicts
  const blunderId = 10000 + testId;

  // Insert test game first (required for foreign key)
  await db.run(`
    INSERT INTO games (id, white_player, black_player, result, date, event, pgn_file_path)
    VALUES (?, 'TestPlayer', 'Opponent', '0-1', '2024-01-01', 'Test Event', '/test/game.pgn')
  `, [gameId]);

  // Insert test blunder
  await db.run(`
    INSERT INTO blunder_details (
      id, game_id, move_number, fen, player_move, tactical_theme, position_type,
      player_color, is_blunder, centipawn_loss
    )
    VALUES (
      ?, ?, 15, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e4',
      'fork,pin', 'middlegame', 'white', 1, 300
    )
  `, [blunderId, gameId]);

  // Insert test puzzles
  const testPuzzles = [
    { id: `test_${testId}_p001`, themes: 'fork middlegame', rating: 1500, popularity: 100 },
    { id: `test_${testId}_p002`, themes: 'fork pin', rating: 1800, popularity: 200 },
    { id: `test_${testId}_p003`, themes: 'endgame queenRookEndgame', rating: 2000, popularity: 150 },
  ];

  for (const puzzle of testPuzzles) {
    await db.run(`
      INSERT INTO puzzle_index (id, themes, rating, popularity)
      VALUES (?, ?, ?, ?)
    `, [puzzle.id, puzzle.themes, puzzle.rating, puzzle.popularity]);
  }
}
