/**
 * Move Quality Constants - Lichess-style symbols and colors
 * Based on ADR 006: Lichess-Style Game Analysis UI
 */

export type MoveQuality = 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder';
export type MoveQualitySymbol = '!!' | '!' | '+' | '' | '?!' | '?' | '??';

export interface MoveQualityConfig {
  symbol: MoveQualitySymbol;
  label: string;
  color: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}

/**
 * Move quality configuration following Lichess conventions
 *
 * Symbol mapping:
 * - !! = Best (engine's top choice)
 * - !  = Excellent (strong move)
 * - +  = Good (solid move)
 * - ?! = Inaccuracy (suboptimal)
 * - ?  = Mistake (clear error)
 * - ?? = Blunder (serious error)
 */
export const MOVE_QUALITY_CONFIG: Record<MoveQuality, MoveQualityConfig> = {
  best: {
    symbol: '!!',
    label: 'Best',
    color: '#4caf50',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    textColor: '#1b5e20',
    borderColor: '#4caf50'
  },
  excellent: {
    symbol: '!',
    label: 'Excellent',
    color: '#8bc34a',
    backgroundColor: 'rgba(139, 195, 74, 0.15)',
    textColor: '#33691e',
    borderColor: '#8bc34a'
  },
  good: {
    symbol: '+',
    label: 'Good',
    color: '#2196f3',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    textColor: '#0d47a1',
    borderColor: '#2196f3'
  },
  book: {
    symbol: '',
    label: 'Book',
    color: '#9c27b0',
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
    textColor: '#4a148c',
    borderColor: '#9c27b0'
  },
  inaccuracy: {
    symbol: '?!',
    label: 'Inaccuracy',
    color: '#ffeb3b',
    backgroundColor: 'rgba(255, 235, 59, 0.25)',
    textColor: '#f57f17',
    borderColor: '#fbc02d'
  },
  mistake: {
    symbol: '?',
    label: 'Mistake',
    color: '#ff9800',
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    textColor: '#e65100',
    borderColor: '#ff9800'
  },
  blunder: {
    symbol: '??',
    label: 'Blunder',
    color: '#f44336',
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    textColor: '#b71c1c',
    borderColor: '#f44336'
  }
};

/**
 * Get the symbol for a move quality
 */
export function getMoveQualitySymbol(quality: MoveQuality): MoveQualitySymbol {
  return MOVE_QUALITY_CONFIG[quality]?.symbol || '';
}

/**
 * Get the full config for a move quality
 */
export function getMoveQualityConfig(quality: MoveQuality): MoveQualityConfig | undefined {
  return MOVE_QUALITY_CONFIG[quality];
}

/**
 * Check if a move quality should show inline annotation
 * (only for inaccuracies, mistakes, and blunders)
 */
export function shouldShowAnnotation(quality: MoveQuality): boolean {
  return quality === 'inaccuracy' || quality === 'mistake' || quality === 'blunder';
}

/**
 * Legacy enum for backwards compatibility
 * @deprecated Use MoveQuality type instead
 */
export enum MoveQualityEnum {
  BEST = 'best',
  EXCELLENT = 'excellent',
  GOOD = 'good',
  BOOK = 'book',
  INACCURACY = 'inaccuracy',
  MISTAKE = 'mistake',
  BLUNDER = 'blunder'
}

/**
 * Legacy colors for backwards compatibility
 * @deprecated Use MOVE_QUALITY_CONFIG instead
 */
export const MOVE_QUALITY_COLORS = {
  [MoveQualityEnum.BOOK]: {
    background: '#9c27b0',
    text: '#FFFFFF',
    border: '#7b1fa2'
  },
  [MoveQualityEnum.BEST]: {
    background: '#4caf50',
    text: '#FFFFFF',
    border: '#388e3c'
  },
  [MoveQualityEnum.EXCELLENT]: {
    background: '#8bc34a',
    text: '#FFFFFF',
    border: '#689f38'
  },
  [MoveQualityEnum.GOOD]: {
    background: '#2196f3',
    text: '#FFFFFF',
    border: '#1976d2'
  },
  [MoveQualityEnum.INACCURACY]: {
    background: '#ffeb3b',
    text: '#000000',
    border: '#fbc02d'
  },
  [MoveQualityEnum.MISTAKE]: {
    background: '#ff9800',
    text: '#FFFFFF',
    border: '#f57c00'
  },
  [MoveQualityEnum.BLUNDER]: {
    background: '#f44336',
    text: '#FFFFFF',
    border: '#d32f2f'
  }
};
