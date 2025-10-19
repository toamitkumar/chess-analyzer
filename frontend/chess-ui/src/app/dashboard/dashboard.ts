import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TournamentService } from '../services/tournament.service';
import { TournamentSelectorComponent } from '../components/tournament-selector/tournament-selector';
import { NavigationComponent } from '../components/navigation/navigation.component';
import { StatCardComponent } from '../components/stat-card/stat-card.component';
import { GameListComponent } from '../components/game-list/game-list.component';
import { Chart, registerables } from 'chart.js';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule, 
    MatToolbarModule, 
    MatCardModule, 
    MatButtonModule, 
    MatIconModule, 
    MatProgressSpinnerModule, 
    RouterModule, 
    TournamentSelectorComponent,
    NavigationComponent,
    StatCardComponent
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, AfterViewInit {
  performance: any = {
    white: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
    black: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
    overall: { avgAccuracy: 0, totalBlunders: 0, overallWinRate: 0 }
  };
  tournaments: any[] = [];
  selectedTournamentId: number | null = null;
  loading = false;
  error: string | null = null;
  
  tournamentGames: any[] = [];
  
  private ratingChart: Chart | null = null;
  private centipawnChart: Chart | null = null;

  constructor(
    private http: HttpClient,
    private tournamentService: TournamentService,
    private router: Router
  ) {
    Chart.register(...registerables);
  }

  ngOnInit() {
    this.loadPerformanceData();
  }

  ngAfterViewInit() {
    setTimeout(() => this.loadCharts(), 100);
  }

  async loadPerformanceData() {
    try {
      this.loading = true;
      this.error = null;
      
      // Build API URL with tournament filter if selected
      const apiUrl = this.selectedTournamentId 
        ? `${environment.apiUrl}/api/performance-db?tournament=${this.selectedTournamentId}`
        : `${environment.apiUrl}/api/performance-db`;
      
      console.log('📊 Loading performance data from:', apiUrl);
      const response = await this.http.get<any>(apiUrl).toPromise();
      
      if (response && (response.white?.games > 0 || response.black?.games > 0)) {
        this.performance = response;
        console.log('📊 Loaded performance data:', response);
      } else {
        // Fallback to legacy API if no data
        const fallbackResponse = await this.http.get<any>(`${environment.apiUrl}/api/performance`).toPromise();
        this.performance = fallbackResponse?.data || this.getEmptyPerformance();
        console.log('📊 Using fallback performance data');
      }
      
    } catch (error) {
      console.error('❌ Failed to load performance data:', error);
      this.error = 'Failed to load performance data';
      this.performance = this.getEmptyPerformance();
    } finally {
      this.loading = false;
    }
  }

  onTournamentChange(tournamentId: number | null) {
    this.selectedTournamentId = tournamentId;
    this.loadPerformanceData();
    this.loadCharts();
    this.loadTournamentGames();
  }

  getEmptyPerformance() {
    return {
      white: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
      black: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
      overall: { avgAccuracy: 0, totalBlunders: 0, overallWinRate: 0 }
    };
  }

  refreshData() {
    this.loadPerformanceData();
  }

  getTournamentContext(): string {
    return this.selectedTournamentId ? 'Tournament Performance' : 'Overall Performance';
  }

  async loadCharts() {
    try {
      // Build API URLs with tournament filter if selected
      const ratingUrl = this.selectedTournamentId 
        ? `${environment.apiUrl}/api/trends/rating?tournament=${this.selectedTournamentId}`
        : `${environment.apiUrl}/api/trends/rating`;
      
      const centipawnUrl = this.selectedTournamentId 
        ? `${environment.apiUrl}/api/trends/centipawn-loss?tournament=${this.selectedTournamentId}`
        : `${environment.apiUrl}/api/trends/centipawn-loss`;

      const [ratingData, centipawnData] = await Promise.all([
        this.http.get<any>(ratingUrl).toPromise(),
        this.http.get<any>(centipawnUrl).toPromise()
      ]);

      this.createRatingChart(ratingData);
      this.createCentipawnChart(centipawnData);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    }
  }

  createRatingChart(data: any) {
    if (typeof document === 'undefined') return;
    
    const canvas = document.getElementById('ratingChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Always destroy existing chart before creating new one
    if (this.ratingChart) {
      this.ratingChart.destroy();
      this.ratingChart = null;
    }

    if (!data?.data || data.data.length === 0) {
      console.log('No rating data to display');
      return;
    }

    this.ratingChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.data.map((d: any) => `Game ${d.gameNumber}`),
        datasets: [{
          label: 'Rating',
          data: data.data.map((d: any) => d.rating),
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false
          }
        }
      }
    });
  }

  createCentipawnChart(data: any) {
    if (typeof document === 'undefined') return;
    
    const canvas = document.getElementById('centipawnChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Always destroy existing chart before creating new one
    if (this.centipawnChart) {
      this.centipawnChart.destroy();
      this.centipawnChart = null;
    }

    if (!data?.data || data.data.length === 0) {
      console.log('No centipawn data to display');
      return;
    }

    this.centipawnChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.data.map((d: any) => `Game ${d.gameNumber}`),
        datasets: [{
          label: 'Avg Centipawn Loss',
          data: data.data.map((d: any) => d.avgCentipawnLoss),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  async loadTournamentGames() {
    if (!this.selectedTournamentId) {
      this.tournamentGames = [];
      return;
    }

    try {
      const games = await this.http.get<any[]>(`${environment.apiUrl}/api/tournaments/${this.selectedTournamentId}/games`).toPromise();
      
      // Enhance games with analysis summary
      this.tournamentGames = games?.map(game => ({
        ...game,
        accuracy: this.calculateGameAccuracy(game),
        blunders: this.calculateGameBlunders(game)
      })) || [];
      
      console.log('📋 Loaded tournament games:', this.tournamentGames.length);
    } catch (error) {
      console.error('❌ Failed to load tournament games:', error);
      this.tournamentGames = [];
    }
  }

  private calculateGameAccuracy(game: any): number {
    // Mock calculation - in real implementation, this would come from analysis data
    return Math.floor(Math.random() * 30) + 70; // 70-100%
  }

  private calculateGameBlunders(game: any): number {
    // Mock calculation - in real implementation, this would come from analysis data
    return Math.floor(Math.random() * 8); // 0-7 blunders
  }

  navigateToGames() {
    if (this.selectedTournamentId) {
      this.router.navigate(['/tournaments', this.selectedTournamentId, 'games']);
    } else {
      this.router.navigate(['/games']);
    }
  }
}
