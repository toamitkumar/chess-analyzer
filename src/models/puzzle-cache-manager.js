/**
 * Puzzle Cache Manager
 *
 * LRU cache for puzzle details fetched from Lichess API
 * - 24-hour TTL (time-to-live)
 * - Max 2000 puzzles (~10MB storage)
 * - LRU (Least Recently Used) eviction
 * - Automatic cleanup of expired entries
 */

class PuzzleCacheManager {
  constructor(db, options = {}) {
    this.db = db;
    this.maxSize = options.maxSize || 2000; // Max 2000 puzzles = ~10MB
    this.ttl = options.ttl || 24 * 3600; // 24 hours in seconds
  }

  /**
   * Get puzzle from cache
   * Returns null if not found or expired
   *
   * @param {string} puzzleId - Puzzle ID
   * @returns {Promise<Object|null>} Cached puzzle or null
   */
  async get(puzzleId) {
    try {
      // Check cache with TTL
      const isPostgres = this.db.usePostgres;

      let cached;
      if (isPostgres) {
        cached = await this.db.get(`
          SELECT * FROM puzzle_cache
          WHERE id = $1
          AND cached_at > NOW() - INTERVAL '24 hours'
        `, [puzzleId]);
      } else {
        // SQLite
        cached = await this.db.get(`
          SELECT * FROM puzzle_cache
          WHERE id = ?
          AND cached_at > datetime('now', '-24 hours')
        `, [puzzleId]);
      }

      if (cached) {
        // Cache HIT - update last_accessed
        await this.touch(puzzleId);
        return cached;
      }

      // Cache MISS
      return null;

    } catch (error) {
      console.error(`[PuzzleCache] Error getting puzzle ${puzzleId}:`, error.message);
      return null;
    }
  }

  /**
   * Cache a puzzle
   * Evicts LRU if maxSize reached
   *
   * @param {Object} puzzle - Puzzle data to cache
   * @returns {Promise<void>}
   */
  async set(puzzle) {
    try {
      // Check if we need to evict
      const currentSize = await this.getSize();
      if (currentSize >= this.maxSize) {
        await this.evictLRU();
      }

      const isPostgres = this.db.usePostgres;

      if (isPostgres) {
        // PostgreSQL
        await this.db.run(`
          INSERT INTO puzzle_cache (
            id, fen, moves, solution, themes, rating, game_url, cached_at, last_accessed
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE
          SET
            fen = EXCLUDED.fen,
            moves = EXCLUDED.moves,
            solution = EXCLUDED.solution,
            themes = EXCLUDED.themes,
            rating = EXCLUDED.rating,
            game_url = EXCLUDED.game_url,
            cached_at = NOW(),
            last_accessed = NOW()
        `, [
          puzzle.id,
          puzzle.fen || null,
          puzzle.moves || null,
          puzzle.solution || null,
          puzzle.themes || null,
          puzzle.rating || null,
          puzzle.game_url || puzzle.gameUrl || null
        ]);
      } else {
        // SQLite
        await this.db.run(`
          INSERT INTO puzzle_cache (
            id, fen, moves, solution, themes, rating, game_url, cached_at, last_accessed
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT (id) DO UPDATE
          SET
            fen = excluded.fen,
            moves = excluded.moves,
            solution = excluded.solution,
            themes = excluded.themes,
            rating = excluded.rating,
            game_url = excluded.game_url,
            cached_at = datetime('now'),
            last_accessed = datetime('now')
        `, [
          puzzle.id,
          puzzle.fen || null,
          puzzle.moves || null,
          puzzle.solution || null,
          puzzle.themes || null,
          puzzle.rating || null,
          puzzle.game_url || puzzle.gameUrl || null
        ]);
      }

    } catch (error) {
      console.error(`[PuzzleCache] Error caching puzzle ${puzzle.id}:`, error.message);
    }
  }

  /**
   * Update last_accessed timestamp for a puzzle
   * Used to track LRU ordering
   *
   * @param {string} puzzleId - Puzzle ID
   * @returns {Promise<void>}
   */
  async touch(puzzleId) {
    const isPostgres = this.db.usePostgres;

    if (isPostgres) {
      await this.db.run(`
        UPDATE puzzle_cache
        SET last_accessed = NOW()
        WHERE id = $1
      `, [puzzleId]);
    } else {
      await this.db.run(`
        UPDATE puzzle_cache
        SET last_accessed = datetime('now')
        WHERE id = ?
      `, [puzzleId]);
    }
  }

  /**
   * Evict least recently accessed puzzle
   * Used when cache reaches maxSize
   *
   * @returns {Promise<void>}
   */
  async evictLRU() {
    try {
      // Find least recently accessed puzzle
      const lru = await this.db.get(`
        SELECT id FROM puzzle_cache
        ORDER BY last_accessed ASC
        LIMIT 1
      `);

      if (lru) {
        await this.db.run(`
          DELETE FROM puzzle_cache
          WHERE id = ?
        `, [lru.id]);

        console.log(`[PuzzleCache] Evicted LRU puzzle: ${lru.id}`);
      }

    } catch (error) {
      console.error('[PuzzleCache] Error evicting LRU:', error.message);
    }
  }

  /**
   * Get current cache size
   *
   * @returns {Promise<number>} Number of cached puzzles
   */
  async getSize() {
    try {
      const result = await this.db.get('SELECT COUNT(*) as count FROM puzzle_cache');
      return result.count || 0;
    } catch (error) {
      console.error('[PuzzleCache] Error getting size:', error.message);
      return 0;
    }
  }

  /**
   * Remove expired cache entries (older than 24 hours)
   * Should be run periodically (hourly)
   *
   * @returns {Promise<number>} Number of entries removed
   */
  async cleanup() {
    try {
      const isPostgres = this.db.usePostgres;

      let result;
      if (isPostgres) {
        result = await this.db.run(`
          DELETE FROM puzzle_cache
          WHERE cached_at < NOW() - INTERVAL '24 hours'
        `);
      } else {
        result = await this.db.run(`
          DELETE FROM puzzle_cache
          WHERE cached_at < datetime('now', '-24 hours')
        `);
      }

      const removedCount = result.changes || 0;

      if (removedCount > 0) {
        console.log(`[PuzzleCache] Cleaned up ${removedCount} expired puzzles`);
      }

      return removedCount;

    } catch (error) {
      console.error('[PuzzleCache] Error during cleanup:', error.message);
      return 0;
    }
  }
}

module.exports = PuzzleCacheManager;
