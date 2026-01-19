const {
  getLichessThemes,
  getBlunderThemes,
  themesMatch,
  getMatchingBlunderThemes
} = require('../../src/models/theme-mapper');

describe('ThemeMapper', () => {
  describe('getLichessThemes', () => {
    it('returns Lichess themes for known blunder theme', () => {
      const themes = getLichessThemes('king_safety');
      expect(themes).toContain('kingsideAttack');
      expect(themes).toContain('backRankMate');
    });

    it('returns empty array for unknown theme', () => {
      expect(getLichessThemes('unknown_theme')).toEqual([]);
    });
  });

  describe('getBlunderThemes', () => {
    it('returns blunder themes for known Lichess theme', () => {
      const themes = getBlunderThemes('hangingPiece');
      expect(themes).toContain('bad_piece_placement');
      expect(themes).toContain('hanging_piece');
    });

    it('returns empty array for unknown theme', () => {
      expect(getBlunderThemes('unknownTheme')).toEqual([]);
    });
  });

  describe('themesMatch', () => {
    it('returns true when puzzle theme matches blunder theme', () => {
      expect(themesMatch('advantage middlegame short', 'positional_error')).toBe(true);
    });

    it('returns true for hangingPiece matching bad_piece_placement', () => {
      expect(themesMatch('hangingPiece endgame', 'bad_piece_placement')).toBe(true);
    });

    it('returns false when no themes match', () => {
      expect(themesMatch('fork pin', 'king_safety')).toBe(false);
    });

    it('returns false for unknown blunder theme', () => {
      expect(themesMatch('advantage', 'unknown')).toBe(false);
    });
  });

  describe('getMatchingBlunderThemes', () => {
    it('returns all matching blunder themes for puzzle', () => {
      const matches = getMatchingBlunderThemes('hangingPiece advantage');
      expect(matches).toContain('bad_piece_placement');
      expect(matches).toContain('positional_error');
    });

    it('returns empty array when no matches', () => {
      expect(getMatchingBlunderThemes('unknownTheme')).toEqual([]);
    });

    it('deduplicates results', () => {
      const matches = getMatchingBlunderThemes('hangingPiece trappedPiece');
      const uniqueMatches = [...new Set(matches)];
      expect(matches.length).toBe(uniqueMatches.length);
    });
  });
});
