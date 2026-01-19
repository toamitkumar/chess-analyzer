import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Puzzle {
  id: string;
  fen: string;
  moves: string;
  solution?: string;
  themes: string;
  rating: number;
  popularity?: number;
  gameUrl?: string;
  lichessUrl?: string;
  error?: boolean;
}

export interface PuzzleProgress {
  puzzle_id: string;
  attempts: number;
  solved: boolean;
  first_attempt_correct: boolean;
  total_time_ms: number;
  streak: number;
  mastery_score?: number;
  mastery_status?: string;
}

export interface LearningPath {
  recommendations: Puzzle[];
  dailyGoals: {
    puzzlesTarget: number;
    puzzlesCompleted: number;
    puzzlesSolved: number;
    progress: number;
  };
  weakestThemes: Array<{ theme: string; mastery: number; count: number }>;
  statistics: {
    totalPuzzles: number;
    totalSolved: number;
    averageMastery: number;
    successRate: number;
  };
}

@Injectable({ providedIn: 'root' })
export class PuzzleService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  // Get puzzle by ID (cache-aware)
  getPuzzle(puzzleId: string): Observable<Puzzle> {
    return this.http.get<Puzzle>(`${this.apiUrl}/puzzles/${puzzleId}`);
  }

  // Get recommended puzzles for a blunder
  getPuzzlesForBlunder(blunderId: number): Observable<{ puzzles: Puzzle[] }> {
    return this.http.get<{ puzzles: Puzzle[] }>(`${this.apiUrl}/puzzles/blunder/${blunderId}`);
  }

  // Record puzzle attempt
  recordAttempt(puzzleId: string, data: {
    solved: boolean;
    timeSpent: number;
    movesCount?: number;
    hintsUsed?: number;
  }): Observable<{ success: boolean; progress: PuzzleProgress }> {
    return this.http.post<{ success: boolean; progress: PuzzleProgress }>(
      `${this.apiUrl}/puzzle-progress`,
      { puzzleId, ...data }
    );
  }

  // Get progress for a puzzle
  getProgress(puzzleId: string): Observable<PuzzleProgress> {
    return this.http.get<PuzzleProgress>(`${this.apiUrl}/puzzle-progress/${puzzleId}`);
  }

  // Get learning path
  getLearningPath(): Observable<LearningPath> {
    return this.http.get<LearningPath>(`${this.apiUrl}/learning-path`);
  }

  // Get puzzle recommendations
  getRecommendations(limit = 10, rating = 1500): Observable<Puzzle[]> {
    return this.http.get<{ recommendations: Puzzle[] }>(`${this.apiUrl}/learning-path/recommendations`, {
      params: { limit: limit.toString(), rating: rating.toString() }
    }).pipe(
      map(response => response.recommendations || [])
    );
  }

  // Get daily goals
  getDailyGoals(): Observable<LearningPath['dailyGoals']> {
    return this.http.get<LearningPath['dailyGoals']>(`${this.apiUrl}/learning-path/daily-goals`);
  }

  // Get puzzles due for review
  getReviewPuzzles(): Observable<{ puzzles: Puzzle[]; count: number }> {
    return this.http.get<{ puzzles: Puzzle[]; count: number }>(`${this.apiUrl}/learning-path/review`);
  }

  // Get theme mastery
  getThemeMastery(): Observable<{ themes: Array<{ theme: string; mastery: number; status: string }> }> {
    return this.http.get<{ themes: Array<{ theme: string; mastery: number; status: string }> }>(
      `${this.apiUrl}/learning-path/theme-mastery`
    );
  }

  // Get statistics
  getStatistics(): Observable<LearningPath['statistics']> {
    return this.http.get<LearningPath['statistics']>(`${this.apiUrl}/puzzle-statistics`);
  }
}
