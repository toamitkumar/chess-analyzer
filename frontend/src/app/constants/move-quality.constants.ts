export enum MoveQuality {
  BOOK = 'book',
  EXCELLENT = 'excellent', // 0-10cp loss
  GOOD = 'good',          // 10-25cp loss
  INACCURACY = 'inaccuracy', // 25-100cp loss
  MISTAKE = 'mistake',    // 100-200cp loss
  BLUNDER = 'blunder'     // 200+ cp loss
}

export const MOVE_QUALITY_COLORS = {
  [MoveQuality.BOOK]: {
    background: '#4A90E2',
    text: '#FFFFFF',
    border: '#357ABD'
  },
  [MoveQuality.EXCELLENT]: {
    background: '#7ED321', // Bright green for excellent moves
    text: '#FFFFFF', 
    border: '#5BA617'
  },
  [MoveQuality.GOOD]: {
    background: '#B8E986', // Light green for good moves
    text: '#2D5016',
    border: '#9ADB5C'
  },
  [MoveQuality.INACCURACY]: {
    background: '#F8A532', // Orange for inaccuracies
    text: '#FFFFFF',
    border: '#E8941A'
  },
  [MoveQuality.MISTAKE]: {
    background: '#FF6B35', // Red-orange for mistakes
    text: '#FFFFFF',
    border: '#E8941A'
  },
  [MoveQuality.BLUNDER]: {
    background: '#D0021B', // Dark red for blunders
    text: '#FFFFFF',
    border: '#B8021A'
  }
};
