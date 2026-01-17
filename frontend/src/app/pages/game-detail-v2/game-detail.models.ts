export interface Alternative {
  move: string;
  evaluation: number;
  line?: string[];
}

export interface MoveAnalysis {
  move_number: number;
  move: string;
  evaluation: number;
  centipawn_loss: number;
  is_blunder: boolean;
  is_mistake: boolean;
  is_inaccuracy: boolean;
  best_move?: string;
  move_quality?: string;
  alternatives?: Alternative[];
}

export interface GameData {
  id: number;
  white_player: string;
  black_player: string;
  result: string;
  date_played: string;
  opening_name?: string;
  time_control?: string;
  white_elo?: number;
  black_elo?: number;
  tournament_id?: number;
  event?: string;
}

export interface MovePair {
  moveNumber: number;
  white: MoveAnalysis | null;
  black: MoveAnalysis | null;
  whiteIndex: number;
  blackIndex: number;
}

export interface PlayerStats {
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  avgCentipawnLoss: number;
  accuracy: number;
  acpl?: number;
}

export interface PhaseStats {
  accuracy: number;
  startMove: number;
  endMove: number;
}

export interface MoveQualityStats {
  best: number;
  excellent: number;
  good: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
}
