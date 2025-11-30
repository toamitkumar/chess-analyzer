/**
 * Puzzle Matcher
 *
 * Matches blunders to similar Lichess puzzles based on:
 * - Theme overlap (fork, pin, endgame, etc.)
 * - Puzzle rating (difficulty)
 * - Puzzle popularity (well-tested puzzles)
 *
 * Returns puzzle IDs that can be fetched from Lichess API
 */

class PuzzleMatcher {
  constructor(db, options = {}) {
    this.db = db;
    this.maxResults = options.maxResults || 5; // Top 5 matches by default
  }

  /**
   * Find matching puzzles for a blunder
   *
   * @param {Object} blunder - Blunder object with themes, fen_before, etc.
   * @returns {Promise<Array>} Array of matching puzzles with scores
   */
  async findMatchingPuzzles(blunder) {
    try {
      // Extract themes from blunder
      const blunderThemes = blunder.themes || [];

      // If no themes, return empty (no good way to match)
      if (blunderThemes.length === 0) {
        // Fallback: return highest rated popular puzzles
        return await this.getFallbackPuzzles();
      }

      // Query puzzle_index for matches
      // We'll fetch all puzzles with overlapping themes and score them in-memory
      const isPostgres = this.db.usePostgres;

      let candidates;
      if (isPostgres) {
        // PostgreSQL: Use array overlap operator
        candidates = await this.db.all(`
          SELECT id, themes, rating, popularity
          FROM puzzle_index
          WHERE themes && $1::text[]
          ORDER BY rating DESC, popularity DESC
          LIMIT 50
        `, [blunderThemes]);
      } else {
        // SQLite: Use LIKE queries for each theme
        const themeLikes = blunderThemes.map(() => 'themes LIKE ?').join(' OR ');
        const themeParams = blunderThemes.map(t => `%${t}%`);

        candidates = await this.db.all(`
          SELECT id, themes, rating, popularity
          FROM puzzle_index
          WHERE ${themeLikes}
          ORDER BY rating DESC, popularity DESC
          LIMIT 50
        `, themeParams);
      }

      // Score each candidate
      const scored = candidates.map(puzzle => ({
        ...puzzle,
        score: this.scoreMatch(blunder, puzzle)
      }));

      // Sort by score (descending) and return top N
      scored.sort((a, b) => b.score - a.score);

      return scored.slice(0, this.maxResults);

    } catch (error) {
      console.error('[PuzzleMatcher] Error finding matches:', error.message);
      return [];
    }
  }

  /**
   * Get fallback puzzles when no themes available
   * Returns highest rated, most popular puzzles
   *
   * @returns {Promise<Array>} Array of puzzles
   */
  async getFallbackPuzzles() {
    try {
      const puzzles = await this.db.all(`
        SELECT id, themes, rating, popularity
        FROM puzzle_index
        ORDER BY rating DESC, popularity DESC
        LIMIT ?
      `, [this.maxResults]);

      return puzzles.map(p => ({ ...p, score: 0 }));
    } catch (error) {
      console.error('[PuzzleMatcher] Error getting fallback puzzles:', error.message);
      return [];
    }
  }

  /**
   * Score a puzzle match against a blunder
   * Higher score = better match
   *
   * Scoring factors:
   * - Theme overlap: 100 points per matching theme
   * - Rating: rating / 10 (e.g., 1500 rating = 150 points)
   * - Popularity: popularity / 10 (e.g., 100 plays = 10 points)
   *
   * @param {Object} blunder - Blunder object
   * @param {Object} puzzle - Puzzle from puzzle_index
   * @returns {number} Match score
   */
  scoreMatch(blunder, puzzle) {
    let score = 0;

    // 1. Theme overlap (primary factor)
    const blunderThemes = blunder.themes || [];
    const puzzleThemes = this.extractThemesFromString(puzzle.themes);

    const overlap = blunderThemes.filter(t => puzzleThemes.includes(t));
    score += overlap.length * 100; // 100 points per matching theme

    // 2. Puzzle rating (higher = better)
    score += (puzzle.rating || 1500) / 10;

    // 3. Puzzle popularity (more popular = better tested)
    score += (puzzle.popularity || 0) / 10;

    return score;
  }

  /**
   * Extract themes from space-separated string
   * SQLite stores themes as "fork pin middlegame"
   * PostgreSQL stores as array, but we handle both
   *
   * @param {string|Array} themesStr - Themes string or array
   * @returns {Array<string>} Array of theme strings
   */
  extractThemesFromString(themesStr) {
    if (!themesStr) {
      return [];
    }

    // Already an array (PostgreSQL)
    if (Array.isArray(themesStr)) {
      return themesStr;
    }

    // Space-separated string (SQLite)
    return themesStr.split(' ').filter(t => t.length > 0);
  }
}

module.exports = PuzzleMatcher;
