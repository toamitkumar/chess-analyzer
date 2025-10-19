import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Tournament {
  id: number;
  name: string;
  event_type: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  total_games: number;
  created_at: string;
}

export interface TournamentPerformance {
  totalGames: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
  whiteWinRate: number;
  blackWinRate: number;
  drawRate: number;
  totalMoves: number;
  totalBlunders: number;
  avgAccuracy: number;
  avgCentipawnLoss: number;
}

export interface TournamentComparison {
  tournament: Tournament;
  performance: TournamentPerformance;
}

export interface TournamentRanking {
  tournament: Tournament;
  performance: TournamentPerformance;
  score: number;
}

@Injectable({
  providedIn: 'root'
})
export class TournamentService {
  private baseUrl = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  // Create new tournament
  createTournament(tournament: {
    name: string;
    eventType?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<Tournament> {
    return this.http.post<Tournament>(`${this.baseUrl}/tournaments`, tournament);
  }

  // Get all tournaments
  getTournaments(): Observable<Tournament[]> {
    return this.http.get<Tournament[]>(`${this.baseUrl}/tournaments`);
  }

  // Get tournament details
  getTournament(id: number): Observable<Tournament> {
    return this.http.get<Tournament>(`${this.baseUrl}/tournaments/${id}`);
  }

  // Get tournament performance
  getTournamentPerformance(id: number): Observable<TournamentPerformance> {
    return this.http.get<TournamentPerformance>(`${this.baseUrl}/tournaments/${id}/performance`);
  }

  // Get tournament heatmap
  getTournamentHeatmap(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/tournaments/${id}/heatmap`);
  }

  // Get tournament trends
  getTournamentTrends(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/tournaments/${id}/trends`);
  }

  // Get tournament summary
  getTournamentSummary(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/tournaments/${id}/summary`);
  }

  // Compare tournaments
  compareTournaments(ids: number[]): Observable<TournamentComparison[]> {
    const idsParam = ids.join(',');
    return this.http.get<TournamentComparison[]>(`${this.baseUrl}/tournaments/compare?ids=${idsParam}`);
  }

  // Get tournament rankings
  getTournamentRankings(): Observable<TournamentRanking[]> {
    return this.http.get<TournamentRanking[]>(`${this.baseUrl}/tournaments/rankings`);
  }

  // Get filtered performance (overall stats filtered by tournament)
  getFilteredPerformance(tournamentId?: number): Observable<any> {
    const url = tournamentId 
      ? `${this.baseUrl}/performance?tournament=${tournamentId}`
      : `${this.baseUrl}/performance`;
    return this.http.get<any>(url);
  }

  // Get games for tournament
  getTournamentGames(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/tournaments/${id}/games`);
  }
}
