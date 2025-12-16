/**
 * Blunder-Puzzle Linker
 *
 * Automatically links blunders to matching puzzles when blunders are detected
 * Runs asynchronously to avoid slowing down game analysis
 */

const PuzzleMatcher = require('./puzzle-matcher');
const ThemeMapper = require('./theme-mapper');

class BlunderPuzzleLinker {
  constructor(database) {
    this.db = database;
    this.matcher = new PuzzleMatcher(database, { maxResults: 10 });
  }

  /**
   * Link a blunder to matching puzzles
   * Called automatically after a blunder is inserted
   *
   * @param {number} blunderId - ID of the blunder
   * @returns {Promise<number>} Number of puzzles linked
   */
  async linkBlunderToPuzzles(blunderId) {
    try {
      // Get blunder details
      const blunder = await this.db.get(`
        SELECT id, tactical_theme, position_type, phase, fen
        FROM blunder_details
        WHERE id = ?
      `, [blunderId]);

      if (!blunder) {
        console.warn(`[BlunderPuzzleLinker] Blunder ${blunderId} not found`);
        return 0;
      }

      // Map themes
      const themes = ThemeMapper.getCombinedThemes(
        blunder.tactical_theme,
        blunder.position_type,
        blunder.phase
      );

      // Find matching puzzles
      const matches = await this.matcher.findMatchingPuzzles({
        fen_before: blunder.fen,
        themes: themes
      });

      if (matches.length === 0) {
        console.log(`[BlunderPuzzleLinker] No puzzles found for blunder ${blunderId} (theme: ${blunder.tactical_theme})`);
        return 0;
      }

      // Save links to database
      let linked = 0;
      for (let i = 0; i < matches.length; i++) {
        const puzzle = matches[i];

        await this.db.run(`
          INSERT OR IGNORE INTO blunder_puzzle_links (
            blunder_id, puzzle_id, match_score
          ) VALUES (?, ?, ?)
        `, [
          blunderId,
          puzzle.id,
          puzzle.score
        ]);

        linked++;
      }

      console.log(`[BlunderPuzzleLinker] Linked ${linked} puzzles to blunder ${blunderId} (theme: ${blunder.tactical_theme})`);
      return linked;

    } catch (error) {
      console.error(`[BlunderPuzzleLinker] Error linking blunder ${blunderId}:`, error.message);
      return 0;
    }
  }

  /**
   * Link multiple blunders in batch
   * Useful for backfilling existing blunders
   *
   * @param {Array<number>} blunderIds - Array of blunder IDs
   * @returns {Promise<Object>} Statistics
   */
  async linkBlundersBatch(blunderIds) {
    const stats = {
      total: blunderIds.length,
      linked: 0,
      failed: 0,
      totalPuzzles: 0
    };

    for (const blunderId of blunderIds) {
      try {
        const count = await this.linkBlunderToPuzzles(blunderId);
        if (count > 0) {
          stats.linked++;
          stats.totalPuzzles += count;
        }
      } catch (error) {
        stats.failed++;
        console.error(`[BlunderPuzzleLinker] Failed to link blunder ${blunderId}:`, error.message);
      }
    }

    return stats;
  }

  /**
   * Link all unlinked blunders
   * Finds blunders that don't have puzzle links yet
   *
   * @returns {Promise<Object>} Statistics
   */
  async linkUnlinkedBlunders() {
    console.log('[BlunderPuzzleLinker] Finding unlinked blunders...');

    // Find blunders without puzzle links
    const unlinked = await this.db.all(`
      SELECT bd.id
      FROM blunder_details bd
      LEFT JOIN blunder_puzzle_links bpl ON bd.id = bpl.blunder_id
      WHERE bpl.id IS NULL
        AND bd.tactical_theme IS NOT NULL
    `);

    console.log(`[BlunderPuzzleLinker] Found ${unlinked.length} unlinked blunders`);

    if (unlinked.length === 0) {
      return { total: 0, linked: 0, failed: 0, totalPuzzles: 0 };
    }

    const blunderIds = unlinked.map(row => row.id);
    return await this.linkBlundersBatch(blunderIds);
  }

  /**
   * Refresh puzzle links for a blunder
   * Deletes old links and creates new ones
   *
   * @param {number} blunderId - Blunder ID
   * @returns {Promise<number>} Number of new puzzles linked
   */
  async refreshBlunderLinks(blunderId) {
    // Delete existing links
    await this.db.run(`
      DELETE FROM blunder_puzzle_links WHERE blunder_id = ?
    `, [blunderId]);

    // Create new links
    return await this.linkBlunderToPuzzles(blunderId);
  }
}

module.exports = BlunderPuzzleLinker;
