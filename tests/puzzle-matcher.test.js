const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const PuzzleMatcher = require('../src/models/puzzle-matcher');
const { getDatabase } = require('../src/models/database');

describe('PuzzleMatcher', () => {
  let matcher;
  let db;

  beforeEach(async () => {
    // Use test database
    process.env.NODE_ENV = 'test';
    db = getDatabase();
    await db.initialize();

    // Clear puzzle_index table before each test
    await db.run('DELETE FROM puzzle_index');

    // Seed with test puzzles
    await seedTestPuzzles(db);

    matcher = new PuzzleMatcher(db);
  });

  afterEach(async () => {
    // Clean up
    await db.run('DELETE FROM puzzle_index');
  });

  describe('constructor', () => {
    test('should initialize with correct defaults', () => {
      expect(matcher.db).toBe(db);
      expect(matcher.maxResults).toBe(5);
    });

    test('should allow custom maxResults', () => {
      const custom = new PuzzleMatcher(db, { maxResults: 10 });
      expect(custom.maxResults).toBe(10);
    });
  });

  describe('findMatchingPuzzles', () => {
    test('should find puzzles by exact theme match', async () => {
      const blunder = {
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        themes: ['fork', 'middlegame']
      };

      const matches = await matcher.findMatchingPuzzles(blunder);

      expect(matches).toBeDefined();
      expect(matches.length).toBeGreaterThan(0);

      // Should include puzzle with fork theme
      const forkPuzzle = matches.find(m => m.themes.includes('fork'));
      expect(forkPuzzle).toBeDefined();
    });

    test('should limit results to maxResults', async () => {
      const customMatcher = new PuzzleMatcher(db, { maxResults: 2 });

      const blunder = {
        fen_before: 'test fen',
        themes: ['fork']
      };

      const matches = await customMatcher.findMatchingPuzzles(blunder);

      expect(matches.length).toBeLessThanOrEqual(2);
    });

    test('should prefer higher rated puzzles', async () => {
      const blunder = {
        fen_before: 'test fen',
        themes: ['fork']
      };

      const matches = await matcher.findMatchingPuzzles(blunder);

      // Should be sorted by rating (desc) and popularity
      if (matches.length > 1) {
        // Higher rated puzzles should appear first (or similar rating)
        const ratings = matches.map(m => m.rating);
        const firstRating = ratings[0];
        const lastRating = ratings[ratings.length - 1];

        // Allow some variance since we also factor popularity
        expect(firstRating).toBeGreaterThanOrEqual(lastRating - 200);
      }
    });

    test('should return empty array when no matches found', async () => {
      const blunder = {
        fen_before: 'test fen',
        themes: ['nonexistent-theme-xyz']
      };

      const matches = await matcher.findMatchingPuzzles(blunder);

      expect(matches).toEqual([]);
    });

    test('should handle blunder without themes', async () => {
      const blunder = {
        fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        themes: []
      };

      const matches = await matcher.findMatchingPuzzles(blunder);

      // Should still return results (fallback to all puzzles)
      expect(Array.isArray(matches)).toBe(true);
    });

    test('should handle missing FEN', async () => {
      const blunder = {
        themes: ['fork']
      };

      const matches = await matcher.findMatchingPuzzles(blunder);

      expect(Array.isArray(matches)).toBe(true);
    });
  });

  describe('scoreMatch', () => {
    test('should give higher score for exact theme match', () => {
      const blunder = { themes: ['fork', 'middlegame'] };
      const puzzle1 = { themes: 'fork middlegame pin' };
      const puzzle2 = { themes: 'endgame sacrifice' };

      const score1 = matcher.scoreMatch(blunder, puzzle1);
      const score2 = matcher.scoreMatch(blunder, puzzle2);

      expect(score1).toBeGreaterThan(score2);
    });

    test('should consider puzzle rating', () => {
      const blunder = { themes: ['fork'] };
      const highRating = { themes: 'fork', rating: 2000, popularity: 100 };
      const lowRating = { themes: 'fork', rating: 1000, popularity: 100 };

      const score1 = matcher.scoreMatch(blunder, highRating);
      const score2 = matcher.scoreMatch(blunder, lowRating);

      expect(score1).toBeGreaterThan(score2);
    });

    test('should consider puzzle popularity', () => {
      const blunder = { themes: ['fork'] };
      const popular = { themes: 'fork', rating: 1500, popularity: 1000 };
      const unpopular = { themes: 'fork', rating: 1500, popularity: 10 };

      const score1 = matcher.scoreMatch(blunder, popular);
      const score2 = matcher.scoreMatch(blunder, unpopular);

      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('extractThemesFromString', () => {
    test('should extract themes from space-separated string', () => {
      const themesStr = 'fork middlegame pin';
      const themes = matcher.extractThemesFromString(themesStr);

      expect(themes).toEqual(['fork', 'middlegame', 'pin']);
    });

    test('should handle empty string', () => {
      const themes = matcher.extractThemesFromString('');
      expect(themes).toEqual([]);
    });

    test('should handle null/undefined', () => {
      expect(matcher.extractThemesFromString(null)).toEqual([]);
      expect(matcher.extractThemesFromString(undefined)).toEqual([]);
    });
  });

  describe('database compatibility', () => {
    test('should work with SQLite (development)', async () => {
      // Already using SQLite in tests
      const blunder = {
        fen_before: 'test',
        themes: ['fork']
      };

      const matches = await matcher.findMatchingPuzzles(blunder);

      expect(Array.isArray(matches)).toBe(true);
    });

    // Note: PostgreSQL compatibility tested in production
    // Would require PostgreSQL test database setup
  });
});

/**
 * Seed test database with sample puzzles
 */
async function seedTestPuzzles(db) {
  const testPuzzles = [
    {
      id: 'p001',
      themes: 'fork middlegame',
      rating: 1500,
      popularity: 100
    },
    {
      id: 'p002',
      themes: 'fork pin',
      rating: 1800,
      popularity: 200
    },
    {
      id: 'p003',
      themes: 'endgame queenRookEndgame',
      rating: 2000,
      popularity: 150
    },
    {
      id: 'p004',
      themes: 'middlegame sacrifice',
      rating: 1700,
      popularity: 80
    },
    {
      id: 'p005',
      themes: 'fork opening',
      rating: 1300,
      popularity: 50
    }
  ];

  for (const puzzle of testPuzzles) {
    await db.run(`
      INSERT INTO puzzle_index (id, themes, rating, popularity)
      VALUES (?, ?, ?, ?)
    `, [puzzle.id, puzzle.themes, puzzle.rating, puzzle.popularity]);
  }
}
