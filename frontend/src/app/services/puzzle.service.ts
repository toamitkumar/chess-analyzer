import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Puzzle {
  puzzle: {
    id: string;
    fen: string;
    rating: number;
    plays: number;
    solution: string[];
    themes: string[];
  };
  game: {
    id: string;
    pgn: string;
  };
}

export interface PuzzleRecommendation {
  id: string;
  themes: string;
  rating: number;
  popularity: number;
}

export interface PuzzleRecommendationsResponse {
  recommendations: PuzzleRecommendation[];
  playerRating: number;
}

export interface EnhancedRecommendationsResponse {
  recommendations: PuzzleRecommendation[];
  adaptiveDifficulty: {
    min: number;
    max: number;
    adjustment: number;
    successRate: number;
    avgMastery: number;
  };
  reviewCount: number;
  newCount: number;
}

export interface PuzzleProgress {
  puzzle_id: string;
  attempts: number;
  times_solved: number;
  times_failed: number;
  mastery_score: number;
  last_attempted_at: string;
}

export interface AttemptRequest {
  solved: boolean;
  timeSpent: number;
  movesCount: number;
  hintsUsed: number;
}

export interface AttemptResponse {
  success: boolean;
  progress: PuzzleProgress & {
    masteryScore: number;
  };
}

export interface LearningPath {
  recommendations: PuzzleRecommendation[];
  dailyGoals: {
    puzzlesTarget: number;
    puzzlesCompleted: number;
    puzzlesSolved: number;
    progress: number;
  };
  weakThemes: Array<{
    theme: string;
    frequency: number;
    mastery: number;
  }>;
  statistics: {
    totalPuzzles: number;
    totalAttempts: number;
    totalSolved: number;
    averageMastery: number;
    bestStreak: number;
    successRate: number;
  };
}

export interface BlunderPuzzlesResponse {
  blunderId: number;
  blunderTheme: string;
  mappedThemes: string[];
  puzzles: PuzzleRecommendation[];
}

@Injectable({
  providedIn: 'root'
})
export class PuzzleService {
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  /**
   * Get personalized puzzle recommendations
   * @param limit Number of puzzles to return (default: 10)
   * @param rating Target puzzle rating (optional, auto-detected if not provided)
   * @param enhanced Enable enhanced recommendations with spaced repetition
   */
  getRecommendations(
    limit: number = 10,
    rating?: number,
    enhanced: boolean = false
  ): Observable<PuzzleRecommendationsResponse | EnhancedRecommendationsResponse> {
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('enhanced', enhanced.toString());

    if (rating) {
      params = params.set('rating', rating.toString());
    }

    return this.http.get<PuzzleRecommendationsResponse | EnhancedRecommendationsResponse>(
      `${this.baseUrl}/puzzles/recommended`,
      { params }
    );
  }

  /**
   * Get full puzzle details (from cache or Lichess API)
   * @param puzzleId Puzzle ID
   */
  getPuzzle(puzzleId: string): Observable<Puzzle> {
    return this.http.get<Puzzle>(`${this.baseUrl}/puzzles/${puzzleId}`);
  }

  /**
   * Record a puzzle solving attempt
   * @param puzzleId Puzzle ID
   * @param attempt Attempt data
   */
  recordAttempt(puzzleId: string, attempt: AttemptRequest): Observable<AttemptResponse> {
    return this.http.post<AttemptResponse>(
      `${this.baseUrl}/puzzles/${puzzleId}/attempt`,
      attempt
    );
  }

  /**
   * Get progress for a specific puzzle
   * @param puzzleId Puzzle ID
   */
  getPuzzleProgress(puzzleId: string): Observable<PuzzleProgress> {
    return this.http.get<PuzzleProgress>(`${this.baseUrl}/puzzle-progress/${puzzleId}`);
  }

  /**
   * Get all puzzle progress data
   */
  getAllProgress(): Observable<PuzzleProgress[]> {
    return this.http.get<PuzzleProgress[]>(`${this.baseUrl}/puzzle-progress`);
  }

  /**
   * Get comprehensive learning path with recommendations, goals, and statistics
   */
  getLearningPath(): Observable<LearningPath> {
    return this.http.get<LearningPath>(`${this.baseUrl}/learning-path`);
  }

  /**
   * Get puzzles linked to a specific blunder
   * @param blunderId Blunder ID
   */
  getPuzzlesForBlunder(blunderId: number): Observable<BlunderPuzzlesResponse> {
    return this.http.get<BlunderPuzzlesResponse>(`${this.baseUrl}/puzzles/blunder/${blunderId}`);
  }
}
