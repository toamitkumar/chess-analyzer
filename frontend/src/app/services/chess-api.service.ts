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
}
