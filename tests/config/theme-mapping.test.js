const {
  BLUNDER_TO_LICHESS_THEME,
  mapToLichessTheme,
  getSupportedBlunderThemes,
  hasLichessMapping
} = require('../../src/config/theme-mapping');

describe('Theme Mapping', () => {
  describe('BLUNDER_TO_LICHESS_THEME', () => {
    it('should have mappings for common tactical themes', () => {
      expect(BLUNDER_TO_LICHESS_THEME).toHaveProperty('fork', 'fork');
      expect(BLUNDER_TO_LICHESS_THEME).toHaveProperty('pin', 'pin');
      expect(BLUNDER_TO_LICHESS_THEME).toHaveProperty('skewer', 'skewer');
      expect(BLUNDER_TO_LICHESS_THEME).toHaveProperty('hanging_piece', 'hangingPiece');
    });

    it('should have mappings for positional themes', () => {
      expect(BLUNDER_TO_LICHESS_THEME).toHaveProperty('positional_error', 'advantage');
      expect(BLUNDER_TO_LICHESS_THEME).toHaveProperty('king_safety', 'kingsideAttack');
      expect(BLUNDER_TO_LICHESS_THEME).toHaveProperty('bad_piece_placement', 'trappedPiece');
    });
  });

  describe('mapToLichessTheme', () => {
    it('should map known blunder themes to Lichess themes', () => {
      expect(mapToLichessTheme('fork')).toBe('fork');
      expect(mapToLichessTheme('hanging_piece')).toBe('hangingPiece');
      expect(mapToLichessTheme('discovered_attack')).toBe('discoveredAttack');
      expect(mapToLichessTheme('back_rank')).toBe('backRankMate');
    });

    it('should map positional themes to closest Lichess equivalent', () => {
      expect(mapToLichessTheme('positional_error')).toBe('advantage');
      expect(mapToLichessTheme('king_safety')).toBe('kingsideAttack');
    });

    it('should return original theme if no mapping exists', () => {
      expect(mapToLichessTheme('unknown_theme')).toBe('unknown_theme');
      expect(mapToLichessTheme('custom')).toBe('custom');
    });
  });

  describe('getSupportedBlunderThemes', () => {
    it('should return array of supported themes', () => {
      const themes = getSupportedBlunderThemes();
      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBeGreaterThan(0);
      expect(themes).toContain('fork');
      expect(themes).toContain('positional_error');
    });
  });

  describe('hasLichessMapping', () => {
    it('should return true for mapped themes', () => {
      expect(hasLichessMapping('fork')).toBe(true);
      expect(hasLichessMapping('positional_error')).toBe(true);
    });

    it('should return false for unmapped themes', () => {
      expect(hasLichessMapping('unknown')).toBe(false);
      expect(hasLichessMapping('')).toBe(false);
    });
  });
});
