import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PerformanceData {
  overall?: {
    overallWinRate: number;
    avgAccuracy: number;
    totalGames?: number;
    totalBlunders: number;
    rating?: number;
  };
  white: {
    games: number;
    wins?: number;
    losses?: number;
    draws?: number;
    winRate: number;
    avgAccuracy: number;
    blunders: number;
  };
  black: {
    games: number;
    wins?: number;
    losses?: number;
    draws?: number;
    winRate: number;
    avgAccuracy: number;
    blunders: number;
  };
  recentGames?: Array<{
    opponent: string;
    result: 'win' | 'loss' | 'draw';
    color: 'white' | 'black';
    date: string;
  }>;
}

// Chess.com Insights Dashboard Interfaces (ADR 009)
export interface AccuracyByResultData {
  overall: { accuracy: number; games: number; avgCentipawnLoss?: number };
  wins: { accuracy: number; games: number; avgCentipawnLoss?: number };
  draws: { accuracy: number; games: number; avgCentipawnLoss?: number };
  losses: { accuracy: number; games: number; avgCentipawnLoss?: number };
}

export interface PhaseDistributionData {
  overall: {
    opening: { count: number; percentage: number };
    middlegame: { count: number; percentage: number };
    endgame: { count: number; percentage: number };
  };
  totalGames: number;
}

export interface AccuracyByPhaseData {
  opening: { accuracy: number; gamesWithData: number; avgCentipawnLoss?: number };
  middlegame: { accuracy: number; gamesWithData: number; avgCentipawnLoss?: number };
  endgame: { accuracy: number; gamesWithData: number; avgCentipawnLoss?: number };
  totalGames: number;
}

export interface OpeningPerformanceData {
  ecoCode: string;
  name: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
}

export interface InsightsApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// Phase 5: Advanced Tactical Features (ADR 009)
export interface TacticalOpportunitiesData {
  total: number;
  found: number;
  missed: number;
  findRate: number;
  byType: {
    [key: string]: {
      total: number;
      found: number;
      missed: number;
      findRate: number;
    };
  };
}

export interface FreePiecesData {
  total: number;
  captured: number;
  missed: number;
  captureRate: number;
  byPiece: {
    [key: string]: {
      total: number;
      captured: number;
      missed: number;
      captureRate: number;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class ChessApiService {
  // Use relative URL - works in both development (with proxy) and production
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  getPerformanceData(): Observable<PerformanceData> {
    return this.http.get<PerformanceData>(`${this.baseUrl}/performance`);
  }

  getPlayerPerformanceData(): Observable<PerformanceData> {
    return this.http.get<PerformanceData>(`${this.baseUrl}/player-performance`);
  }

  getTrendsData(): Observable<any> {
    return this.http.get(`${this.baseUrl}/trends`);
  }

  getHeatmapData(): Observable<any> {
    return this.http.get(`${this.baseUrl}/heatmap`);
  }

  uploadPgnFile(file: File, userColor: 'white' | 'black' | null, tournamentId?: number): Observable<any> {
    const formData = new FormData();
    formData.append('pgn', file);
    if (userColor) {
      formData.append('userColor', userColor);
    }
    if (tournamentId) {
      formData.append('tournamentId', tournamentId.toString());
    }
    return this.http.post(`${this.baseUrl}/upload`, formData);
  }

  submitManualPGN(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/manual-pgn`, data);
  }

  getGames(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/games`);
  }

  getGame(gameId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/games/${gameId}`);
  }

  getGameAnalysis(gameId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/games/${gameId}/analysis`);
  }

  getGamePerformance(gameId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/games/${gameId}/performance`);
  }

  getGameAlternatives(gameId: number, moveNumber: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/games/${gameId}/alternatives/${moveNumber}`);
  }

  getGameBlunders(gameId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/games/${gameId}/blunders`);
  }

  getGameAccuracy(gameId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/games/${gameId}/accuracy`);
  }

  getGamePhases(gameId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/games/${gameId}/phases`);
  }

  // Tournament API methods
  getTournaments(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/tournaments`);
  }

  getTournamentById(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournaments/${id}`);
  }

  getTournamentPerformance(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournaments/${id}/performance`);
  }

  getTournamentPlayerPerformance(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournaments/${id}/player-performance`);
  }

  getTournamentGames(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/tournaments/${id}/games`);
  }

  // Blunders API methods
  getBlundersDashboard(): Observable<any> {
    return this.http.get(`${this.baseUrl}/blunders/dashboard`);
  }

  getBlundersTimeline(startDate?: string, endDate?: string): Observable<any> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return this.http.get(`${this.baseUrl}/blunders/timeline`, { params });
  }

  // ============================================
  // Chess.com Insights Dashboard API (ADR 009)
  // ============================================

  /**
   * Get accuracy breakdown by game result (win/draw/loss)
   * @param color Optional filter by player color
   */
  getAccuracyByResult(color?: 'white' | 'black'): Observable<InsightsApiResponse<AccuracyByResultData>> {
    const params: any = {};
    if (color) params.color = color;
    return this.http.get<InsightsApiResponse<AccuracyByResultData>>(
      `${this.baseUrl}/insights/accuracy`,
      { params }
    );
  }

  /**
   * Get distribution of which game phase games typically end in
   * @param color Optional filter by player color
   */
  getPhaseDistribution(color?: 'white' | 'black'): Observable<InsightsApiResponse<PhaseDistributionData>> {
    const params: any = {};
    if (color) params.color = color;
    return this.http.get<InsightsApiResponse<PhaseDistributionData>>(
      `${this.baseUrl}/insights/phases`,
      { params }
    );
  }

  /**
   * Get aggregate accuracy by game phase across all games
   * @param color Optional filter by player color
   */
  getAccuracyByPhase(color?: 'white' | 'black'): Observable<InsightsApiResponse<AccuracyByPhaseData>> {
    const params: any = {};
    if (color) params.color = color;
    return this.http.get<InsightsApiResponse<AccuracyByPhaseData>>(
      `${this.baseUrl}/insights/accuracy-by-phase`,
      { params }
    );
  }

  /**
   * Get performance statistics for most frequently played openings
   * @param limit Number of openings to return (default: 10)
   * @param color Optional filter by player color
   */
  getOpeningPerformance(limit: number = 10, color?: 'white' | 'black'): Observable<InsightsApiResponse<OpeningPerformanceData[]>> {
    const params: any = { limit: limit.toString() };
    if (color) params.color = color;
    return this.http.get<InsightsApiResponse<OpeningPerformanceData[]>>(
      `${this.baseUrl}/insights/openings`,
      { params }
    );
  }

  // ============================================
  // Phase 5: Advanced Tactical Features (ADR 009)
  // ============================================

  /**
   * Get tactical opportunities statistics (found vs missed forks, pins, etc.)
   */
  getTacticalOpportunities(): Observable<InsightsApiResponse<TacticalOpportunitiesData>> {
    return this.http.get<InsightsApiResponse<TacticalOpportunitiesData>>(
      `${this.baseUrl}/insights/tactics/opportunities`
    );
  }

  /**
   * Get free pieces statistics (opponent blunders found vs missed)
   */
  getFreePieces(): Observable<InsightsApiResponse<FreePiecesData>> {
    return this.http.get<InsightsApiResponse<FreePiecesData>>(
      `${this.baseUrl}/insights/tactics/free-pieces`
    );
  }
}
