/**
 * Puzzle-Blunder linking service
 */
const { getMatchingBlunderThemes } = require('./theme-mapper');

/**
 * Auto-link puzzles to blunders with matching themes
 * @param {Object} db - Database instance
 * @param {Array} puzzles - Puzzles with themes
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of links created
 */
async function linkPuzzlesToBlunders(db, puzzles, userId) {
  let linksCreated = 0;
  
  for (const puzzle of puzzles) {
    if (puzzle.themes) {
      const blunderThemes = getMatchingBlunderThemes(puzzle.themes);
      for (const theme of blunderThemes) {
        const result = await db.run(`
          INSERT OR IGNORE INTO blunder_puzzle_links (blunder_id, puzzle_id, match_score)
          SELECT bd.id, ?, 0.5
          FROM blunder_details bd
          JOIN games g ON bd.game_id = g.id
          WHERE g.user_id = ? AND bd.tactical_theme = ? AND bd.learned = 0
          LIMIT 1
        `, [puzzle.id, userId, theme]);
        
        if (result.changes > 0) linksCreated++;
      }
    }
  }
  
  return linksCreated;
}

/**
 * Mark linked blunders as learned when puzzle is solved
 * @param {Object} db - Database instance
 * @param {string} puzzleId - Solved puzzle ID
 * @returns {Promise<number>} Number of blunders updated
 */
async function markLinkedBlundersLearned(db, puzzleId) {
  const result = await db.run(`
    UPDATE blunder_details 
    SET learned = 1, mastery_score = MAX(COALESCE(mastery_score, 0), 0.5)
    WHERE id IN (
      SELECT blunder_id FROM blunder_puzzle_links WHERE puzzle_id = ?
    ) AND learned = 0
  `, [puzzleId]);
  
  return result.changes || 0;
}

module.exports = {
  linkPuzzlesToBlunders,
  markLinkedBlundersLearned
};
