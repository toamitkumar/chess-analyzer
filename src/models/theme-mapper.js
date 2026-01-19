/**
 * Maps between internal blunder themes and Lichess puzzle themes
 */

const BLUNDER_TO_LICHESS = {
  'bad_piece_placement': ['hangingPiece', 'trappedPiece', 'exposedKing'],
  'king_safety': ['kingsideAttack', 'queensideAttack', 'attackingF2F7', 'exposedKing', 'backRankMate'],
  'positional_error': ['advantage', 'crushing', 'middlegame', 'endgame'],
  'wrong_capture': ['hangingPiece', 'capturingDefender', 'intermezzo'],
  'missed_tactic': ['fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck'],
  'hanging_piece': ['hangingPiece', 'trappedPiece'],
  'fork': ['fork', 'doubleBishopMate', 'knightEndgame'],
  'pin': ['pin', 'absolutePin'],
  'skewer': ['skewer'],
  'back_rank': ['backRankMate', 'mateIn1', 'mateIn2'],
  'discovered_attack': ['discoveredAttack', 'doubleCheck'],
  'overloaded_piece': ['overloading', 'deflection'],
  'trapped_piece': ['trappedPiece', 'attraction']
};

// Reverse mapping: Lichess theme -> blunder themes
const LICHESS_TO_BLUNDER = {};
for (const [blunder, lichessThemes] of Object.entries(BLUNDER_TO_LICHESS)) {
  for (const lichess of lichessThemes) {
    if (!LICHESS_TO_BLUNDER[lichess]) {
      LICHESS_TO_BLUNDER[lichess] = [];
    }
    LICHESS_TO_BLUNDER[lichess].push(blunder);
  }
}

/**
 * Get Lichess themes that match a blunder theme
 * @param {string} blunderTheme - Internal blunder theme
 * @returns {string[]} Matching Lichess themes
 */
function getLichessThemes(blunderTheme) {
  return BLUNDER_TO_LICHESS[blunderTheme] || [];
}

/**
 * Get blunder themes that match a Lichess theme
 * @param {string} lichessTheme - Lichess puzzle theme
 * @returns {string[]} Matching blunder themes
 */
function getBlunderThemes(lichessTheme) {
  return LICHESS_TO_BLUNDER[lichessTheme] || [];
}

/**
 * Check if a puzzle's themes match a blunder theme
 * @param {string} puzzleThemes - Space-separated Lichess themes
 * @param {string} blunderTheme - Internal blunder theme
 * @returns {boolean} True if there's a match
 */
function themesMatch(puzzleThemes, blunderTheme) {
  const lichessThemes = getLichessThemes(blunderTheme);
  if (lichessThemes.length === 0) return false;
  
  const puzzleThemeList = puzzleThemes.split(' ');
  return lichessThemes.some(t => puzzleThemeList.includes(t));
}

/**
 * Get all blunder themes that match any of the puzzle's themes
 * @param {string} puzzleThemes - Space-separated Lichess themes
 * @returns {string[]} Matching blunder themes
 */
function getMatchingBlunderThemes(puzzleThemes) {
  const puzzleThemeList = puzzleThemes.split(' ');
  const matches = new Set();
  
  for (const theme of puzzleThemeList) {
    const blunderThemes = getBlunderThemes(theme);
    blunderThemes.forEach(t => matches.add(t));
  }
  
  return Array.from(matches);
}

module.exports = {
  getLichessThemes,
  getBlunderThemes,
  themesMatch,
  getMatchingBlunderThemes,
  BLUNDER_TO_LICHESS,
  LICHESS_TO_BLUNDER
};
