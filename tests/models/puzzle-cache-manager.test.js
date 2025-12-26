const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const PuzzleCacheManager = require('../../src/models/puzzle-cache-manager');
const { getDatabase } = require('../../src/models/database');

describe('PuzzleCacheManager', () => {
  let cacheManager;
  let db;

  beforeEach(async () => {
    // Use test database
    process.env.NODE_ENV = 'test';
    db = getDatabase();
    await db.initialize();

    // Clear cache table before each test
    await db.run('DELETE FROM puzzle_cache');

    cacheManager = new PuzzleCacheManager(db);
  });

  afterEach(async () => {
    // Clean up
    await db.run('DELETE FROM puzzle_cache');
  });

  describe('constructor', () => {
    test('should initialize with correct defaults', () => {
      expect(cacheManager.db).toBe(db);
      expect(cacheManager.maxSize).toBe(2000);
      expect(cacheManager.ttl).toBe(24 * 3600); // 24 hours in seconds
    });

    test('should allow custom maxSize', () => {
      const custom = new PuzzleCacheManager(db, { maxSize: 1000 });
      expect(custom.maxSize).toBe(1000);
    });
  });

  describe('get', () => {
    test('should return null for cache miss', async () => {
      const result = await cacheManager.get('nonexistent');
      expect(result).toBeNull();
    });

    test('should return cached puzzle on cache hit', async () => {
      const puzzle = {
        id: '00123',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
        moves: 'e2e4 e7e5',
        solution: 'Nf3',
        themes: 'fork middlegame',
        rating: 1500
      };

      await cacheManager.set(puzzle);

      const cached = await cacheManager.get('00123');

      expect(cached).toBeDefined();
      expect(cached.id).toBe('00123');
      expect(cached.fen).toBe(puzzle.fen);
    });

    test('should return null for expired cache entry', async () => {
      const puzzle = {
        id: '00456',
        fen: 'test',
        moves: 'e2e4',
        themes: 'test'
      };

      await cacheManager.set(puzzle);

      // Manually set cached_at to 25 hours ago (beyond 24h TTL)
      await db.run(`
        UPDATE puzzle_cache
        SET cached_at = datetime('now', '-25 hours')
        WHERE id = ?
      `, ['00456']);

      const cached = await cacheManager.get('00456');
      expect(cached).toBeNull();
    });

    test('should update last_accessed on cache hit', async () => {
      const puzzle = {
        id: '00789',
        fen: 'test',
        moves: 'e2e4',
        themes: 'test'
      };

      await cacheManager.set(puzzle);

      // Get initial last_accessed
      const before = await db.get('SELECT last_accessed FROM puzzle_cache WHERE id = ?', ['00789']);

      // Wait a bit to ensure timestamp difference (1 second for reliable SQLite timestamp granularity)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Access the puzzle
      await cacheManager.get('00789');

      // Check that last_accessed was updated
      const after = await db.get('SELECT last_accessed FROM puzzle_cache WHERE id = ?', ['00789']);

      expect(new Date(after.last_accessed).getTime()).toBeGreaterThan(new Date(before.last_accessed).getTime());
    });
  });

  describe('set', () => {
    test('should cache a new puzzle', async () => {
      const puzzle = {
        id: 'new123',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
        moves: 'e2e4 e7e5',
        solution: 'Nf3',
        themes: 'fork middlegame',
        rating: 1600,
        game_url: 'https://lichess.org/abc123'
      };

      await cacheManager.set(puzzle);

      const cached = await db.get('SELECT * FROM puzzle_cache WHERE id = ?', ['new123']);

      expect(cached).toBeDefined();
      expect(cached.id).toBe('new123');
      expect(cached.fen).toBe(puzzle.fen);
      expect(cached.rating).toBe(1600);
    });

    test('should update existing puzzle on duplicate', async () => {
      const puzzle1 = {
        id: 'dup123',
        fen: 'old fen',
        moves: 'e2e4',
        themes: 'old'
      };

      const puzzle2 = {
        id: 'dup123',
        fen: 'new fen',
        moves: 'e2e4',
        themes: 'new'
      };

      await cacheManager.set(puzzle1);
      await cacheManager.set(puzzle2);

      const cached = await db.get('SELECT * FROM puzzle_cache WHERE id = ?', ['dup123']);

      expect(cached.fen).toBe('new fen');
      expect(cached.themes).toBe('new');

      // Should still only have one entry
      const count = await cacheManager.getSize();
      expect(count).toBe(1);
    });
  });

  describe('evictLRU', () => {
    test('should evict least recently accessed puzzle', async () => {
      // Add 3 puzzles
      await cacheManager.set({ id: 'p1', fen: 'f1', moves: 'm1', themes: 't1' });
      await cacheManager.set({ id: 'p2', fen: 'f2', moves: 'm2', themes: 't2' });
      await cacheManager.set({ id: 'p3', fen: 'f3', moves: 'm3', themes: 't3' });

      // Access p2 and p3, making p1 the least recently accessed
      await cacheManager.get('p2');
      await cacheManager.get('p3');

      // Evict LRU (should be p1)
      await cacheManager.evictLRU();

      const p1 = await db.get('SELECT * FROM puzzle_cache WHERE id = ?', ['p1']);
      const p2 = await db.get('SELECT * FROM puzzle_cache WHERE id = ?', ['p2']);
      const p3 = await db.get('SELECT * FROM puzzle_cache WHERE id = ?', ['p3']);

      expect(p1).toBeUndefined(); // Evicted
      expect(p2).toBeDefined();   // Still there
      expect(p3).toBeDefined();   // Still there
    });
  });

  describe('getSize', () => {
    test('should return 0 for empty cache', async () => {
      const size = await cacheManager.getSize();
      expect(size).toBe(0);
    });

    test('should return correct count', async () => {
      await cacheManager.set({ id: 'p1', fen: 'f1', moves: 'm1', themes: 't1' });
      await cacheManager.set({ id: 'p2', fen: 'f2', moves: 'm2', themes: 't2' });
      await cacheManager.set({ id: 'p3', fen: 'f3', moves: 'm3', themes: 't3' });

      const size = await cacheManager.getSize();
      expect(size).toBe(3);
    });
  });

  describe('LRU eviction on maxSize', () => {
    test('should auto-evict when maxSize reached', async () => {
      // Create cache with small maxSize for testing
      const smallCache = new PuzzleCacheManager(db, { maxSize: 3 });

      // Add 3 puzzles (at maxSize)
      await smallCache.set({ id: 'p1', fen: 'f1', moves: 'm1', themes: 't1' });
      await smallCache.set({ id: 'p2', fen: 'f2', moves: 'm2', themes: 't2' });
      await smallCache.set({ id: 'p3', fen: 'f3', moves: 'm3', themes: 't3' });

      expect(await smallCache.getSize()).toBe(3);

      // Add 4th puzzle - should trigger eviction
      await smallCache.set({ id: 'p4', fen: 'f4', moves: 'm4', themes: 't4' });

      // Size should still be 3
      expect(await smallCache.getSize()).toBe(3);

      // p1 should be evicted (least recently accessed)
      const p1 = await db.get('SELECT * FROM puzzle_cache WHERE id = ?', ['p1']);
      expect(p1).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    test('should remove expired entries', async () => {
      // Add fresh puzzle
      await cacheManager.set({ id: 'fresh', fen: 'f1', moves: 'm1', themes: 't1' });

      // Add expired puzzle
      await cacheManager.set({ id: 'expired', fen: 'f2', moves: 'm2', themes: 't2' });
      await db.run(`
        UPDATE puzzle_cache
        SET cached_at = datetime('now', '-25 hours')
        WHERE id = ?
      `, ['expired']);

      // Run cleanup
      const removedCount = await cacheManager.cleanup();

      expect(removedCount).toBe(1);

      // Verify fresh puzzle still exists
      const fresh = await db.get('SELECT * FROM puzzle_cache WHERE id = ?', ['fresh']);
      expect(fresh).toBeDefined();

      // Verify expired puzzle was removed
      const expired = await db.get('SELECT * FROM puzzle_cache WHERE id = ?', ['expired']);
      expect(expired).toBeUndefined();
    });

    test('should return 0 if no expired entries', async () => {
      await cacheManager.set({ id: 'p1', fen: 'f1', moves: 'm1', themes: 't1' });
      await cacheManager.set({ id: 'p2', fen: 'f2', moves: 'm2', themes: 't2' });

      const removedCount = await cacheManager.cleanup();

      expect(removedCount).toBe(0);
      expect(await cacheManager.getSize()).toBe(2);
    });
  });
});
