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
    background: '#7ED321',
    text: '#FFFFFF', 
    border: '#5BA617'
  },
  [MoveQuality.GOOD]: {
    background: '#B8E986',
    text: '#2D5016',
    border: '#9ADB5C'
  },
  [MoveQuality.INACCURACY]: {
    background: '#56b4e9', // Lichess light blue
    text: '#FFFFFF',
    border: '#3a9fd5'
  },
  [MoveQuality.MISTAKE]: {
    background: '#e69f00', // Lichess orange
    text: '#FFFFFF',
    border: '#cc8a00'
  },
  [MoveQuality.BLUNDER]: {
    background: '#db3434', // Lichess red
    text: '#FFFFFF',
    border: '#c02020'
  }
};
