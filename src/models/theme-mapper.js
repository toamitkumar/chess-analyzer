/**
 * Theme Mapper
 *
 * Maps blunder tactical themes to Lichess puzzle themes
 * Allows puzzle matching system to find relevant training puzzles
 */

class ThemeMapper {
  /**
   * Map blunder tactical theme to Lichess puzzle themes
   *
   * @param {string} tacticalTheme - Blunder tactical theme (e.g., "positional_error")
   * @param {string} phase - Game phase (opening, middlegame, endgame)
   * @returns {Array<string>} Array of Lichess theme keywords
   */
  static mapBlunderToLichessThemes(tacticalTheme, phase = null) {
    const mapping = {
      // Tactical blunders → Tactical puzzles
      'hanging_piece': ['hangingPiece', 'attraction', 'defensiveMove'],
      'missed_fork': ['fork', 'doubleCheck', 'attackingF2F7'],
      'missed_pin': ['pin'],
      'missed_skewer': ['skewer'],
      'missed_discovery': ['discoveredAttack', 'doubleCheck'],
      'missed_deflection': ['deflection', 'attraction'],
      'missed_decoy': ['decoy', 'attraction'],
      'wrong_capture': ['hangingPiece', 'capturingDefender'],
      'missed_mate': ['mate', 'mateIn1', 'mateIn2', 'mateIn3'],

      // Positional blunders → Phase-based puzzles
      'positional_error': this._getPositionalThemes(phase),
      'weak_pawn_structure': ['pawnEndgame', 'advancedPawn', 'endgame'],
      'king_safety': ['mateIn2', 'mateIn3', 'mate', 'attackingF2F7', 'kingsideAttack', 'queensideAttack'],
      'bad_piece_placement': ['trappedPiece', 'defensiveMove', 'advantage'],

      // Opening blunders → Opening puzzles
      'opening_mistake': ['opening', 'master', 'short'],
      'development_error': ['master', 'opening'],

      // Endgame blunders → Endgame technique puzzles
      'technique_error': ['endgame', 'advancedPawn'],
      'pawn_endgame_error': ['pawnEndgame', 'promotion'],
      'missed_promotion': ['promotion', 'pawnEndgame'],
      'rook_endgame_error': ['rookEndgame', 'endgame'],
      'bishop_endgame_error': ['bishopEndgame', 'endgame'],
      'knight_endgame_error': ['endgame']
    };

    const themes = mapping[tacticalTheme] || [];

    // Add phase if not already included
    if (phase && !themes.includes(phase)) {
      themes.push(phase);
    }

    return themes;
  }

  /**
   * Get positional themes based on game phase
   * @private
   */
  static _getPositionalThemes(phase) {
    const baseThemes = ['advantage', 'defensiveMove'];

    if (phase === 'opening') {
      return [...baseThemes, 'opening', 'master'];
    } else if (phase === 'middlegame') {
      return [...baseThemes, 'middlegame', 'attackingF2F7'];
    } else if (phase === 'endgame') {
      return [...baseThemes, 'endgame', 'advancedPawn'];
    }

    return baseThemes;
  }

  /**
   * Map position type to Lichess themes
   *
   * @param {string} positionType - Position type (attacking, defensive, etc.)
   * @returns {Array<string>} Array of Lichess themes
   */
  static mapPositionType(positionType) {
    const mapping = {
      'attacking': ['attackingF2F7', 'kingsideAttack', 'queensideAttack'],
      'defensive': ['defensiveMove', 'attraction'],
      'tactical': ['fork', 'pin', 'discoveredAttack'],
      'positional': ['advantage', 'endgame', 'middlegame'],
      'transition': ['middlegame']
    };

    return mapping[positionType] || [];
  }

  /**
   * Combine tactical theme and position type into full theme set
   *
   * @param {string} tacticalTheme - Tactical theme
   * @param {string} positionType - Position type
   * @param {string} phase - Game phase
   * @returns {Array<string>} Combined unique themes
   */
  static getCombinedThemes(tacticalTheme, positionType, phase) {
    const themes = new Set();

    // Add tactical theme mappings
    if (tacticalTheme) {
      const tacticalMapped = this.mapBlunderToLichessThemes(tacticalTheme, phase);
      tacticalMapped.forEach(t => themes.add(t));
    }

    // Add position type mappings
    if (positionType) {
      const positionMapped = this.mapPositionType(positionType);
      positionMapped.forEach(t => themes.add(t));
    }

    // Always include phase
    if (phase) {
      themes.add(phase);
    }

    return Array.from(themes);
  }

  /**
   * Get all known Lichess puzzle themes
   * @returns {Array<string>} List of all Lichess themes
   */
  static getAllLichessThemes() {
    return [
      // Tactical themes
      'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck',
      'hangingPiece', 'attraction', 'deflection', 'decoy',
      'capturingDefender', 'defensiveMove', 'trappedPiece',

      // Mating patterns
      'mate', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5',
      'smotheredMate', 'backRankMate', 'doubleBishopMate',
      'attackingF2F7', 'kingsideAttack', 'queensideAttack',

      // Endgame themes
      'endgame', 'pawnEndgame', 'rookEndgame', 'bishopEndgame',
      'advancedPawn', 'promotion',

      // Phase tags
      'opening', 'middlegame', 'endgame',

      // Difficulty/quality
      'master', 'short', 'long', 'veryLong',
      'advantage', 'crushing', 'sacrifice'
    ];
  }
}

module.exports = ThemeMapper;
