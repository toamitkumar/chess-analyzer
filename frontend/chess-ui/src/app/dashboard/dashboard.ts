import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TournamentService } from '../services/tournament.service';
import { TournamentSelectorComponent } from '../components/tournament-selector/tournament-selector';
import { Chart, registerables } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, MatToolbarModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, RouterModule, TournamentSelectorComponent],
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
  
  private ratingChart: Chart | null = null;
  private centipawnChart: Chart | null = null;

  constructor(
    private http: HttpClient,
    private tournamentService: TournamentService
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
      
      // Use database API directly for now
      const response = await this.http.get<any>('http://localhost:3000/api/performance-db').toPromise();
      
      if (response && (response.white?.games > 0 || response.black?.games > 0)) {
        this.performance = response;
        console.log('📊 Loaded performance data from database:', response);
      } else {
        // Fallback to legacy API if no data
        const fallbackResponse = await this.http.get<any>('http://localhost:3000/api/performance').toPromise();
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
      const [ratingData, centipawnData] = await Promise.all([
        this.http.get<any>('http://localhost:3000/api/trends/rating').toPromise(),
        this.http.get<any>('http://localhost:3000/api/trends/centipawn-loss').toPromise()
      ]);

      this.createRatingChart(ratingData);
      this.createCentipawnChart(centipawnData);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    }
  }

  createRatingChart(data: any) {
    const canvas = document.getElementById('ratingChart') as HTMLCanvasElement;
    if (!canvas || !data?.data) return;

    if (this.ratingChart) {
      this.ratingChart.destroy();
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
    const canvas = document.getElementById('centipawnChart') as HTMLCanvasElement;
    if (!canvas || !data?.data) return;

    if (this.centipawnChart) {
      this.centipawnChart.destroy();
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
}
