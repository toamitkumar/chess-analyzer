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
  private baseUrl = 'http://localhost:3000/api';
  public readonly targetPlayer = 'AdvaitKumar1213'; // Centralized target player

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

  uploadPgnFile(file: File, tournamentId?: number): Observable<any> {
    const formData = new FormData();
    formData.append('pgn', file);
    if (tournamentId) {
      formData.append('tournamentId', tournamentId.toString());
    }
    return this.http.post(`${this.baseUrl}/upload`, formData);
  }

  getGames(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/games`);
  }

  getGameAnalysis(gameId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/games/${gameId}/analysis`);
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
}
