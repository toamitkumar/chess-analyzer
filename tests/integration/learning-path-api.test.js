const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../src/models/database');
const LearningPathGenerator = require('../../src/models/learning-path-generator');
const PuzzleProgressTracker = require('../../src/models/puzzle-progress-tracker');

describe('Learning Path API Endpoints', () => {
  let app;
  let db;
  let pathGenerator;
  let progressTracker;

  beforeAll(async () => {
    // Set up test database
    process.env.NODE_ENV = 'test';
    db = getDatabase();
    await db.initialize();

    // Create Express app with learning path routes
    app = express();
    app.use(express.json());

    // Initialize services
    pathGenerator = new LearningPathGenerator(db);
    progressTracker = new PuzzleProgressTracker(db);

    // Define learning path routes
    app.get('/api/learning-path', async (req, res) => {
      try {
        const learningPath = await pathGenerator.getLearningPath();
        res.json(learningPath);
      } catch (error) {
        res.status(500).json({ error: 'Failed to generate learning path' });
      }
    });

    app.get('/api/learning-path/recommendations', async (req, res) => {
      try {
        const { limit = 10, rating = 1500, enhanced = false } = req.query;
        
        if (enhanced === 'true') {
          const recommendations = await pathGenerator.generateEnhancedRecommendations({
            limit: parseInt(limit),
            playerRating: parseInt(rating)
          });
          res.json(recommendations);
        } else {
          const recommendations = await pathGenerator.generateRecommendations({
            limit: parseInt(limit),
            playerRating: parseInt(rating)
          });
          res.json({ recommendations });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to get recommendations' });
      }
    });

    app.get('/api/learning-path/daily-goals', async (req, res) => {
      try {
        const dailyGoals = await pathGenerator.generateDailyGoals();
        res.json(dailyGoals);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get daily goals' });
      }
    });

    app.get('/api/learning-path/review', async (req, res) => {
      try {
        const reviewPuzzles = await pathGenerator.getPuzzlesDueForReview();
        res.json({ puzzles: reviewPuzzles, count: reviewPuzzles.length });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get review puzzles' });
      }
    });

    app.get('/api/learning-path/adaptive-difficulty', async (req, res) => {
      try {
        const { rating = 1500 } = req.query;
        const adaptiveDifficulty = await pathGenerator.getAdaptiveDifficulty(parseInt(rating));
        res.json(adaptiveDifficulty);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get adaptive difficulty' });
      }
    });

    app.get('/api/learning-path/trends', async (req, res) => {
      try {
        const { days = 30 } = req.query;
        const trends = await pathGenerator.getPerformanceTrends(parseInt(days));
        res.json(trends);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get performance trends' });
      }
    });

    app.get('/api/learning-path/theme-mastery', async (req, res) => {
      try {
        const themeMastery = await pathGenerator.getThemeMasteryLevels();
        res.json({ themes: themeMastery });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get theme mastery' });
      }
    });

    app.post('/api/puzzle-progress', async (req, res) => {
      try {
        const { puzzleId, solved, timeSpent, movesCount, hintsUsed } = req.body;
        
        if (!puzzleId) {
          return res.status(400).json({ error: 'Puzzle ID is required' });
        }

        const progress = await progressTracker.recordAttempt(puzzleId, {
          solved: Boolean(solved),
          timeSpent: parseInt(timeSpent) || 0,
          movesCount: parseInt(movesCount) || 0,
          hintsUsed: parseInt(hintsUsed) || 0
        });

        res.json({ success: true, progress });
      } catch (error) {
        res.status(500).json({ error: 'Failed to record progress' });
      }
    });

    app.get('/api/puzzle-progress/:puzzleId', async (req, res) => {
      try {
        const { puzzleId } = req.params;
        const progress = await progressTracker.getProgress(puzzleId);
        
        if (!progress) {
          return res.status(404).json({ error: 'Progress not found' });
        }

        res.json(progress);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get progress' });
      }
    });

    app.get('/api/puzzle-progress', async (req, res) => {
      try {
        const { limit = 100, orderBy = 'last_attempted_at', order = 'DESC', minMastery = 0 } = req.query;
        const progress = await progressTracker.getAllProgress({
          limit: parseInt(limit),
          orderBy,
          order,
          minMastery: parseInt(minMastery)
        });

        res.json({ progress });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get progress' });
      }
    });

    app.get('/api/puzzle-statistics', async (req, res) => {
      try {
        const statistics = await progressTracker.getStatistics();
        res.json(statistics);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get statistics' });
      }
    });
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.run('DELETE FROM user_puzzle_progress');
    await db.run('DELETE FROM blunder_details');
    await db.run('DELETE FROM games');
    await db.run('DELETE FROM puzzle_index');
    
    // Insert test puzzles into puzzle_index (required for foreign key)
    const testPuzzles = [
      'test_puzzle_1', 'test_puzzle_2', 'test_puzzle_3', 'test_puzzle_4', 'test_puzzle_5',
      'test_puzzle_6', 'test_puzzle_7', 'test_puzzle_8', 'test_puzzle_9', 'test_puzzle_10'
    ];
    
    for (const puzzleId of testPuzzles) {
      await db.run(`
        INSERT OR IGNORE INTO puzzle_index (id, themes, rating, popularity)
        VALUES (?, 'fork middlegame', 1500, 100)
      `, [puzzleId]);
    }
  });

  afterAll(async () => {
    // Clean up and close database
    await db.run('DELETE FROM user_puzzle_progress');
    await db.run('DELETE FROM blunder_details');
    await db.run('DELETE FROM games');
    await db.run('DELETE FROM puzzle_index');
    await db.close();
  });

  describe('GET /api/learning-path', () => {
    test('should return learning path with empty data for new user', async () => {
      const response = await request(app)
        .get('/api/learning-path')
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('dailyGoals');
      expect(response.body).toHaveProperty('statistics');
      expect(response.body).toHaveProperty('weakThemes');
      
      // Recommendations may be empty or contain popular puzzles (no blunders yet)
      expect(Array.isArray(response.body.recommendations)).toBe(true);
      expect(response.body.dailyGoals.puzzlesTarget).toBe(10);
      expect(response.body.statistics.totalPuzzles).toBe(0);
    });

    test('should return learning path with blunder-based recommendations', async () => {
      // Insert test game first (required for foreign key)
      await db.run(`
        INSERT INTO games (id, white_player, black_player, result, date, event, pgn_file_path)
        VALUES (1, 'TestPlayer', 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test.pgn')
      `);

      // Insert test blunder with correct schema
      await db.run(`
        INSERT INTO blunder_details (
          game_id, move_number, fen, phase, player_move, best_move,
          evaluation_before, evaluation_after, centipawn_loss,
          tactical_theme, is_blunder
        ) VALUES (
          1, 10, 'test_fen', 'middlegame', 'e4', 'd4',
          0.5, -1.5, 200, 'fork', 1
        )
      `);

      const response = await request(app)
        .get('/api/learning-path')
        .expect(200);

      expect(response.body.weakThemes.length).toBeGreaterThan(0);
      // Check that fork is in the weak themes
      const forkTheme = response.body.weakThemes.find(t => t.theme === 'fork');
      expect(forkTheme).toBeDefined();
    });
  });

  describe('GET /api/learning-path/recommendations', () => {
    test('should return basic recommendations', async () => {
      const response = await request(app)
        .get('/api/learning-path/recommendations')
        .query({ limit: 5, rating: 1500 })
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });

    test('should return enhanced recommendations with adaptive difficulty', async () => {
      const response = await request(app)
        .get('/api/learning-path/recommendations')
        .query({ limit: 5, rating: 1500, enhanced: 'true' })
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('adaptiveDifficulty');
      expect(response.body).toHaveProperty('reviewCount');
      expect(response.body).toHaveProperty('newCount');
      
      expect(response.body.adaptiveDifficulty).toHaveProperty('min');
      expect(response.body.adaptiveDifficulty).toHaveProperty('max');
      expect(response.body.adaptiveDifficulty).toHaveProperty('adjustment');
    });

    test('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/learning-path/recommendations')
        .query({ limit: 3 })
        .expect(200);

      expect(response.body.recommendations.length).toBeLessThanOrEqual(3);
    });
  });

  describe('GET /api/learning-path/daily-goals', () => {
    test('should return daily goals with zero progress for new user', async () => {
      const response = await request(app)
        .get('/api/learning-path/daily-goals')
        .expect(200);

      expect(response.body).toHaveProperty('puzzlesTarget');
      expect(response.body).toHaveProperty('puzzlesCompleted');
      expect(response.body).toHaveProperty('puzzlesSolved');
      expect(response.body).toHaveProperty('progress');
      
      expect(response.body.puzzlesTarget).toBe(10);
      expect(response.body.puzzlesCompleted).toBe(0);
      expect(response.body.progress).toBe(0);
    });

    test('should track daily progress correctly', async () => {
      // Record a puzzle attempt today
      await progressTracker.recordAttempt('test_puzzle_1', {
        solved: true,
        timeSpent: 30
      });

      const response = await request(app)
        .get('/api/learning-path/daily-goals')
        .expect(200);

      expect(response.body.puzzlesCompleted).toBe(1);
      expect(response.body.puzzlesSolved).toBe(1);
      expect(response.body.progress).toBe(10); // 1/10 = 10%
    });
  });

  describe('GET /api/learning-path/adaptive-difficulty', () => {
    test('should return base difficulty for new user', async () => {
      const response = await request(app)
        .get('/api/learning-path/adaptive-difficulty')
        .query({ rating: 1500 })
        .expect(200);

      expect(response.body).toHaveProperty('min');
      expect(response.body).toHaveProperty('max');
      expect(response.body).toHaveProperty('adjustment');
      
      expect(response.body.min).toBe(1300);
      expect(response.body.max).toBe(1700);
      expect(response.body.adjustment).toBe(0);
    });

    test('should increase difficulty for strong performance', async () => {
      // Record 10 successful puzzle attempts
      for (let i = 1; i <= 10; i++) {
        await progressTracker.recordAttempt(`test_puzzle_${i}`, {
          solved: true,
          timeSpent: 30
        });
      }

      const response = await request(app)
        .get('/api/learning-path/adaptive-difficulty')
        .query({ rating: 1500 })
        .expect(200);

      expect(response.body.adjustment).toBeGreaterThan(0);
      expect(response.body.successRate).toBe(100);
      expect(response.body.avgMastery).toBeGreaterThan(70);
    });

    test('should decrease difficulty for poor performance', async () => {
      // Record 10 failed puzzle attempts
      for (let i = 1; i <= 10; i++) {
        await progressTracker.recordAttempt(`test_puzzle_${i}`, {
          solved: false,
          timeSpent: 120
        });
      }

      const response = await request(app)
        .get('/api/learning-path/adaptive-difficulty')
        .query({ rating: 1500 })
        .expect(200);

      expect(response.body.adjustment).toBeLessThan(0);
      expect(response.body.successRate).toBe(0);
    });
  });

  describe('GET /api/learning-path/trends', () => {
    test('should return empty trends for new user', async () => {
      const response = await request(app)
        .get('/api/learning-path/trends')
        .query({ days: 7 })
        .expect(200);

      expect(response.body).toHaveProperty('trends');
      expect(response.body).toHaveProperty('improvementRate');
      expect(response.body).toHaveProperty('daysAnalyzed');
      expect(response.body).toHaveProperty('totalDaysActive');
      
      expect(response.body.trends).toEqual([]);
      expect(response.body.improvementRate).toBe(0);
      expect(response.body.totalDaysActive).toBe(0);
    });

    test('should track daily trends', async () => {
      // Record puzzle attempts
      await progressTracker.recordAttempt('test_puzzle_1', {
        solved: true,
        timeSpent: 30
      });

      const response = await request(app)
        .get('/api/learning-path/trends')
        .query({ days: 7 })
        .expect(200);

      expect(response.body.trends.length).toBeGreaterThan(0);
      expect(response.body.totalDaysActive).toBe(1);
    });
  });

  describe('GET /api/learning-path/theme-mastery', () => {
    test('should return empty themes for new user', async () => {
      const response = await request(app)
        .get('/api/learning-path/theme-mastery')
        .expect(200);

      expect(response.body).toHaveProperty('themes');
      expect(Array.isArray(response.body.themes)).toBe(true);
    });

    test('should show theme mastery with blunders', async () => {
      // Insert test game first (required for foreign key)
      await db.run(`
        INSERT INTO games (id, white_player, black_player, result, date, event, pgn_file_path)
        VALUES (1, 'TestPlayer', 'Opponent', '1-0', '2024-01-01', 'Test Event', 'test.pgn')
      `);

      // Insert test blunders with correct schema
      await db.run(`
        INSERT INTO blunder_details (
          game_id, move_number, fen, phase, player_move, best_move,
          evaluation_before, evaluation_after, centipawn_loss,
          tactical_theme, is_blunder
        ) VALUES (
          1, 10, 'test_fen', 'middlegame', 'e4', 'd4',
          0.5, -1.5, 200, 'fork', 1
        )
      `);

      const response = await request(app)
        .get('/api/learning-path/theme-mastery')
        .expect(200);

      expect(response.body).toHaveProperty('themes');
      expect(Array.isArray(response.body.themes)).toBe(true);
      
      if (response.body.themes.length > 0) {
        expect(response.body.themes[0]).toHaveProperty('theme');
        expect(response.body.themes[0]).toHaveProperty('mastery');
        expect(response.body.themes[0]).toHaveProperty('level');
      }
    });
  });

  describe('POST /api/puzzle-progress', () => {
    test('should record puzzle attempt successfully', async () => {
      const response = await request(app)
        .post('/api/puzzle-progress')
        .send({
          puzzleId: 'test_puzzle_1',
          solved: true,
          timeSpent: 45,
          movesCount: 3,
          hintsUsed: 0
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('progress');
      expect(response.body.progress.puzzle_id).toBe('test_puzzle_1');
      expect(response.body.progress.attempts).toBe(1);
      expect(response.body.progress.solved).toBe(1);
    });

    test('should return 400 if puzzleId is missing', async () => {
      const response = await request(app)
        .post('/api/puzzle-progress')
        .send({
          solved: true,
          timeSpent: 45
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Puzzle ID is required');
    });

    test('should track multiple attempts correctly', async () => {
      // First attempt - failed
      await request(app)
        .post('/api/puzzle-progress')
        .send({
          puzzleId: 'test_puzzle_1',
          solved: false,
          timeSpent: 60
        })
        .expect(200);

      // Second attempt - solved
      const response = await request(app)
        .post('/api/puzzle-progress')
        .send({
          puzzleId: 'test_puzzle_1',
          solved: true,
          timeSpent: 45
        })
        .expect(200);

      expect(response.body.progress.attempts).toBe(2);
      expect(response.body.progress.solved).toBe(1);
      expect(response.body.progress.first_attempt_correct).toBe(0);
    });

    test('should track streak correctly', async () => {
      // Solve same puzzle 3 times in a row to build streak
      for (let i = 1; i <= 3; i++) {
        const response = await request(app)
          .post('/api/puzzle-progress')
          .send({
            puzzleId: 'test_puzzle_1',
            solved: true,
            timeSpent: 30
          })
          .expect(200);

        expect(response.body.progress.streak).toBe(i);
      }
    });

    test('should reset streak on failure', async () => {
      // Solve puzzle twice
      await request(app)
        .post('/api/puzzle-progress')
        .send({ puzzleId: 'test_puzzle_1', solved: true, timeSpent: 30 })
        .expect(200);

      await request(app)
        .post('/api/puzzle-progress')
        .send({ puzzleId: 'test_puzzle_1', solved: true, timeSpent: 30 })
        .expect(200);

      // Fail the same puzzle
      const response = await request(app)
        .post('/api/puzzle-progress')
        .send({ puzzleId: 'test_puzzle_1', solved: false, timeSpent: 60 })
        .expect(200);

      expect(response.body.progress.streak).toBe(0);
    });
  });

  describe('GET /api/puzzle-progress/:puzzleId', () => {
    test('should return 404 for non-existent puzzle', async () => {
      const response = await request(app)
        .get('/api/puzzle-progress/non_existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should return progress for existing puzzle', async () => {
      // Record an attempt first
      await progressTracker.recordAttempt('test_puzzle_1', {
        solved: true,
        timeSpent: 45
      });

      const response = await request(app)
        .get('/api/puzzle-progress/test_puzzle_1')
        .expect(200);

      expect(response.body.puzzle_id).toBe('test_puzzle_1');
      expect(response.body.attempts).toBe(1);
      expect(response.body.solved).toBe(1);
    });
  });

  describe('GET /api/puzzle-progress', () => {
    test('should return empty array for new user', async () => {
      const response = await request(app)
        .get('/api/puzzle-progress')
        .expect(200);

      expect(response.body).toHaveProperty('progress');
      expect(response.body.progress).toEqual([]);
    });

    test('should return all progress records', async () => {
      // Record multiple attempts
      await progressTracker.recordAttempt('test_puzzle_1', { solved: true, timeSpent: 30 });
      await progressTracker.recordAttempt('test_puzzle_2', { solved: true, timeSpent: 40 });
      await progressTracker.recordAttempt('test_puzzle_3', { solved: false, timeSpent: 60 });

      const response = await request(app)
        .get('/api/puzzle-progress')
        .expect(200);

      expect(response.body.progress.length).toBe(3);
    });

    test('should respect limit parameter', async () => {
      // Record 5 attempts
      for (let i = 1; i <= 5; i++) {
        await progressTracker.recordAttempt(`test_puzzle_${i}`, { solved: true, timeSpent: 30 });
      }

      const response = await request(app)
        .get('/api/puzzle-progress')
        .query({ limit: 3 })
        .expect(200);

      expect(response.body.progress.length).toBe(3);
    });

    test('should filter by minimum mastery', async () => {
      // Record attempts with different performance
      await progressTracker.recordAttempt('test_puzzle_1', { solved: true, timeSpent: 30 }); // High mastery
      await progressTracker.recordAttempt('test_puzzle_2', { solved: false, timeSpent: 120 }); // Low mastery

      const response = await request(app)
        .get('/api/puzzle-progress')
        .query({ minMastery: 50 })
        .expect(200);

      expect(response.body.progress.length).toBe(1);
      expect(response.body.progress[0].puzzle_id).toBe('test_puzzle_1');
    });
  });

  describe('GET /api/puzzle-statistics', () => {
    test('should return zero statistics for new user', async () => {
      const response = await request(app)
        .get('/api/puzzle-statistics')
        .expect(200);

      expect(response.body).toHaveProperty('totalPuzzles', 0);
      expect(response.body).toHaveProperty('totalAttempts', 0);
      expect(response.body).toHaveProperty('totalSolved', 0);
      expect(response.body).toHaveProperty('averageMastery', 0);
      expect(response.body).toHaveProperty('bestStreak', 0);
      expect(response.body).toHaveProperty('successRate', 0);
    });

    test('should calculate statistics correctly', async () => {
      // Record mixed performance
      await progressTracker.recordAttempt('test_puzzle_1', { solved: true, timeSpent: 30 });
      await progressTracker.recordAttempt('test_puzzle_2', { solved: true, timeSpent: 40 });
      await progressTracker.recordAttempt('test_puzzle_3', { solved: false, timeSpent: 60 });

      const response = await request(app)
        .get('/api/puzzle-statistics')
        .expect(200);

      expect(response.body.totalPuzzles).toBe(3);
      expect(response.body.totalAttempts).toBe(3);
      expect(response.body.totalSolved).toBe(2);
      expect(response.body.successRate).toBe(67); // 2/3 = 66.67% rounded to 67
      expect(response.body.bestStreak).toBe(1); // Each puzzle has independent streak
    });
  });
});
