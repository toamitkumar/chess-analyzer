const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { getDatabase } = require('../src/models/database');
const PuzzleProgressTracker = require('../src/models/puzzle-progress-tracker');

describe('PuzzleProgressTracker', () => {
  let db;
  let tracker;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    db = getDatabase();
    await db.initialize();
    tracker = new PuzzleProgressTracker(db);
  });

  beforeEach(async () => {
    // Clean up test data
    await db.run('DELETE FROM user_puzzle_progress');
    await db.run('DELETE FROM puzzle_index');
    
    // Insert test puzzles into puzzle_index (required for foreign key)
    const testPuzzles = [
      'puzzle_001', 'puzzle_002', 'puzzle_003', 'puzzle_004', 'puzzle_005',
      'puzzle_006', 'puzzle_007', 'puzzle_008', 'puzzle_009', 'puzzle_010'
    ];
    
    for (const puzzleId of testPuzzles) {
      await db.run(`
        INSERT OR IGNORE INTO puzzle_index (id, themes, rating, popularity)
        VALUES (?, 'fork middlegame', 1500, 100)
      `, [puzzleId]);
    }
  });

  afterAll(async () => {
    await db.run('DELETE FROM user_puzzle_progress');
    await db.run('DELETE FROM puzzle_index');
    await db.close();
  });

  describe('recordAttempt', () => {
    test('should create new progress record for first attempt', async () => {
      const progress = await tracker.recordAttempt('puzzle_001', {
        solved: true,
        timeSpent: 45,
        movesCount: 3,
        hintsUsed: 0
      });

      expect(progress).toBeDefined();
      expect(progress.puzzle_id).toBe('puzzle_001');
      expect(progress.attempts).toBe(1);
      expect(progress.solved).toBe(1);
      expect(progress.first_attempt_correct).toBe(1);
      expect(progress.streak).toBe(1);
    });

    test('should update existing progress record', async () => {
      // First attempt - failed
      await tracker.recordAttempt('puzzle_001', {
        solved: false,
        timeSpent: 60
      });

      // Second attempt - solved
      const progress = await tracker.recordAttempt('puzzle_001', {
        solved: true,
        timeSpent: 45
      });

      expect(progress.attempts).toBe(2);
      expect(progress.solved).toBe(1);
      expect(progress.first_attempt_correct).toBe(0);
    });

    test('should track streak correctly', async () => {
      // Solve first puzzle
      const progress1 = await tracker.recordAttempt('puzzle_001', {
        solved: true,
        timeSpent: 30
      });
      expect(progress1.streak).toBe(1);

      // Solve second puzzle - streak continues
      const progress2 = await tracker.recordAttempt('puzzle_002', {
        solved: true,
        timeSpent: 35
      });
      expect(progress2.streak).toBe(1); // Each puzzle has its own streak

      // Fail third puzzle
      const progress3 = await tracker.recordAttempt('puzzle_003', {
        solved: false,
        timeSpent: 60
      });
      expect(progress3.streak).toBe(0);
    });

    test('should convert time to milliseconds', async () => {
      const progress = await tracker.recordAttempt('puzzle_001', {
        solved: true,
        timeSpent: 45 // seconds
      });

      expect(progress.total_time_ms).toBe(45000); // milliseconds
    });

    test('should maintain solved status once achieved', async () => {
      // First attempt - solved
      await tracker.recordAttempt('puzzle_001', {
        solved: true,
        timeSpent: 30
      });

      // Second attempt - failed (but puzzle remains solved)
      const progress = await tracker.recordAttempt('puzzle_001', {
        solved: false,
        timeSpent: 60
      });

      expect(progress.solved).toBe(1); // Still marked as solved
      expect(progress.attempts).toBe(2);
    });
  });

  describe('getProgress', () => {
    test('should return null for non-existent puzzle', async () => {
      const progress = await tracker.getProgress('non_existent');
      expect(progress).toBeNull();
    });

    test('should return progress for existing puzzle', async () => {
      await tracker.recordAttempt('puzzle_001', {
        solved: true,
        timeSpent: 45
      });

      const progress = await tracker.getProgress('puzzle_001');
      expect(progress).toBeDefined();
      expect(progress.puzzle_id).toBe('puzzle_001');
    });
  });

  describe('calculateMasteryScore', () => {
    test('should return 0 for no attempts', () => {
      const score = tracker.calculateMasteryScore({ attempts: 0 });
      expect(score).toBe(0);
    });

    test('should calculate high mastery for quick solve on first attempt', () => {
      const progress = {
        attempts: 1,
        solved: true,
        first_attempt_correct: true,
        total_time_ms: 30000 // 30 seconds
      };

      const score = tracker.calculateMasteryScore(progress);
      expect(score).toBeGreaterThan(70);
    });

    test('should calculate lower mastery for slow solve', () => {
      const progress = {
        attempts: 1,
        solved: true,
        first_attempt_correct: true,
        total_time_ms: 120000 // 120 seconds
      };

      const score = tracker.calculateMasteryScore(progress);
      expect(score).toBeLessThan(80);
    });

    test('should calculate low mastery for unsolved puzzle', () => {
      const progress = {
        attempts: 3,
        solved: false,
        first_attempt_correct: false,
        total_time_ms: 180000
      };

      const score = tracker.calculateMasteryScore(progress);
      expect(score).toBeLessThan(30);
    });

    test('should penalize for not solving on first attempt', () => {
      const firstAttemptSolved = {
        attempts: 1,
        solved: true,
        first_attempt_correct: true,
        total_time_ms: 45000
      };

      const secondAttemptSolved = {
        attempts: 2,
        solved: true,
        first_attempt_correct: false,
        total_time_ms: 90000
      };

      const score1 = tracker.calculateMasteryScore(firstAttemptSolved);
      const score2 = tracker.calculateMasteryScore(secondAttemptSolved);

      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('getMasteryStatus', () => {
    test('should return "learning" for low mastery', () => {
      expect(tracker.getMasteryStatus(30)).toBe('learning');
    });

    test('should return "improving" for medium mastery', () => {
      expect(tracker.getMasteryStatus(60)).toBe('improving');
    });

    test('should return "mastered" for high mastery', () => {
      expect(tracker.getMasteryStatus(85)).toBe('mastered');
    });

    test('should handle boundary cases', () => {
      expect(tracker.getMasteryStatus(49)).toBe('learning');
      expect(tracker.getMasteryStatus(50)).toBe('improving');
      expect(tracker.getMasteryStatus(79)).toBe('improving');
      expect(tracker.getMasteryStatus(80)).toBe('mastered');
    });
  });

  describe('getAllProgress', () => {
    test('should return empty array for no progress', async () => {
      const progress = await tracker.getAllProgress();
      expect(progress).toEqual([]);
    });

    test('should return all progress records', async () => {
      await tracker.recordAttempt('puzzle_001', { solved: true, timeSpent: 30 });
      await tracker.recordAttempt('puzzle_002', { solved: true, timeSpent: 40 });
      await tracker.recordAttempt('puzzle_003', { solved: false, timeSpent: 60 });

      const progress = await tracker.getAllProgress();
      expect(progress.length).toBe(3);
    });

    test('should include mastery scores', async () => {
      await tracker.recordAttempt('puzzle_001', { solved: true, timeSpent: 30 });

      const progress = await tracker.getAllProgress();
      expect(progress[0]).toHaveProperty('mastery_score');
      expect(progress[0]).toHaveProperty('mastery_status');
    });

    test('should filter by minimum mastery', async () => {
      await tracker.recordAttempt('puzzle_001', { solved: true, timeSpent: 30 }); // High mastery
      await tracker.recordAttempt('puzzle_002', { solved: false, timeSpent: 120 }); // Low mastery

      const progress = await tracker.getAllProgress({ minMastery: 50 });
      expect(progress.length).toBe(1);
      expect(progress[0].puzzle_id).toBe('puzzle_001');
    });

    test('should respect limit parameter', async () => {
      for (let i = 1; i <= 5; i++) {
        await tracker.recordAttempt(`puzzle_00${i}`, { solved: true, timeSpent: 30 });
      }

      const progress = await tracker.getAllProgress({ limit: 3 });
      expect(progress.length).toBe(3);
    });

    test('should order by specified column', async () => {
      await tracker.recordAttempt('puzzle_001', { solved: true, timeSpent: 30 });
      await new Promise(resolve => setTimeout(resolve, 1100)); // 1 second delay to ensure different timestamps
      await tracker.recordAttempt('puzzle_002', { solved: true, timeSpent: 40 });

      const progress = await tracker.getAllProgress({ 
        orderBy: 'last_attempted_at', 
        order: 'DESC' 
      });

      expect(progress[0].puzzle_id).toBe('puzzle_002'); // Most recent first
    });
  });

  describe('getStatistics', () => {
    test('should return zero statistics for no progress', async () => {
      const stats = await tracker.getStatistics();

      expect(stats.totalPuzzles).toBe(0);
      expect(stats.totalAttempts).toBe(0);
      expect(stats.totalSolved).toBe(0);
      expect(stats.averageMastery).toBe(0);
      expect(stats.bestStreak).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    test('should calculate statistics correctly', async () => {
      // Record mixed performance
      await tracker.recordAttempt('puzzle_001', { solved: true, timeSpent: 30 });
      await tracker.recordAttempt('puzzle_002', { solved: true, timeSpent: 40 });
      await tracker.recordAttempt('puzzle_003', { solved: false, timeSpent: 60 });

      const stats = await tracker.getStatistics();

      expect(stats.totalPuzzles).toBe(3);
      expect(stats.totalAttempts).toBe(3);
      expect(stats.totalSolved).toBe(2);
      expect(stats.successRate).toBe(67); // 2/3 = 66.67% rounded
      expect(stats.bestStreak).toBe(1); // Each puzzle tracks its own streak
      expect(stats.averageMastery).toBeGreaterThan(0);
    });

    test('should track streak per puzzle', async () => {
      // Solve puzzle_001 - streak starts at 1
      const progress1 = await tracker.recordAttempt('puzzle_001', { solved: true, timeSpent: 30 });
      expect(progress1.streak).toBe(1);

      // Solve puzzle_002 - each puzzle has independent streak
      const progress2 = await tracker.recordAttempt('puzzle_002', { solved: true, timeSpent: 30 });
      expect(progress2.streak).toBe(1);

      // Fail puzzle_003
      const progress3 = await tracker.recordAttempt('puzzle_003', { solved: false, timeSpent: 60 });
      expect(progress3.streak).toBe(0);

      const stats = await tracker.getStatistics();
      expect(stats.bestStreak).toBe(1); // Best streak across all puzzles
    });
  });
});
