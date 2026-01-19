/**
 * Theme Mapping Configuration
 * Maps internal blunder themes to Lichess puzzle themes
 */

const BLUNDER_TO_LICHESS_THEME = {
  // Direct mappings
  'hanging_piece': 'hangingPiece',
  'fork': 'fork',
  'pin': 'pin',
  'skewer': 'skewer',
  'discovered_attack': 'discoveredAttack',
  'back_rank': 'backRankMate',
  'trapped_piece': 'trappedPiece',
  'overloaded_piece': 'overloading',
  
  // Approximate mappings
  'positional_error': 'advantage',
  'king_safety': 'kingsideAttack',
  'bad_piece_placement': 'trappedPiece',
  'wrong_capture': 'hangingPiece',
  'missed_tactic': 'short',
  'undefended_piece': 'hangingPiece'
};

/**
 * Convert blunder theme to Lichess puzzle theme
 * @param {string} blunderTheme - Internal blunder theme
 * @returns {string} Lichess puzzle theme
 */
function mapToLichessTheme(blunderTheme) {
  return BLUNDER_TO_LICHESS_THEME[blunderTheme] || blunderTheme;
}

/**
 * Get all supported blunder themes
 * @returns {string[]} Array of blunder theme names
 */
function getSupportedBlunderThemes() {
  return Object.keys(BLUNDER_TO_LICHESS_THEME);
}

/**
 * Check if a blunder theme has a Lichess mapping
 * @param {string} blunderTheme - Internal blunder theme
 * @returns {boolean}
 */
function hasLichessMapping(blunderTheme) {
  return blunderTheme in BLUNDER_TO_LICHESS_THEME;
}

module.exports = {
  BLUNDER_TO_LICHESS_THEME,
  mapToLichessTheme,
  getSupportedBlunderThemes,
  hasLichessMapping
};
