import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TournamentService } from '../services/tournament.service';
import { LayoutComponent } from '../components/layout/layout.component';
import { StatCardComponent } from '../components/stat-card/stat-card.component';
import { environment } from '../../environments/environment';

interface RatingData {
  date: string;
  rating: number;
  avgCPL: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule, 
    FormsModule,
    LayoutComponent,
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
  timeRange = '30';
  
  ratingData: RatingData[] = [
    { date: "Jan", rating: 1450, avgCPL: 45 },
    { date: "Feb", rating: 1465, avgCPL: 42 },
    { date: "Mar", rating: 1480, avgCPL: 38 },
    { date: "Apr", rating: 1495, avgCPL: 35 },
    { date: "May", rating: 1510, avgCPL: 33 },
    { date: "Jun", rating: 1525, avgCPL: 30 },
  ];

  constructor(
    private http: HttpClient,
    private tournamentService: TournamentService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadPerformanceData();
  }

  ngAfterViewInit() {
    // Chart initialization if needed
  }

  async loadPerformanceData() {
    try {
      this.loading = true;
      this.error = null;
      
      const apiUrl = this.selectedTournamentId 
        ? `${environment.apiUrl}/api/performance?tournament=${this.selectedTournamentId}`
        : `${environment.apiUrl}/api/performance`;
      
      console.log('📊 Loading performance data from:', apiUrl);
      const response = await this.http.get<any>(apiUrl).toPromise();
      
      if (response && (response.white?.games > 0 || response.black?.games > 0)) {
        this.performance = response;
        console.log('📊 Loaded performance data:', response);
      } else {
        this.performance = this.getEmptyPerformance();
        console.log('📊 No performance data available');
      }
      
    } catch (error) {
      console.error('❌ Failed to load performance data:', error);
      this.error = 'Failed to load performance data';
      this.performance = this.getEmptyPerformance();
    } finally {
      this.loading = false;
    }
  }

  getWinRateSubtitle(): string {
    const totalGames = this.performance.white.games + this.performance.black.games;
    if (totalGames === 0) return 'No games played';
    
    const wins = Math.round((this.performance.overall.overallWinRate || 0) * totalGames / 100);
    const losses = totalGames - wins;
    return `${wins} wins, ${losses} losses`;
  }

  getEmptyPerformance() {
    return {
      white: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
      black: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
      overall: { avgAccuracy: 0, totalBlunders: 0, overallWinRate: 0 }
    };
  }
}
