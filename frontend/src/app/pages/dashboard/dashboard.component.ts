import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LayoutComponent } from '../../components/layout/layout.component';
import { StatCardComponent } from '../../components/stat-card/stat-card.component';

interface PerformanceData {
  white: {
    games: number;
    winRate: number;
    avgAccuracy: number;
    blunders: number;
  };
  black: {
    games: number;
    winRate: number;
    avgAccuracy: number;
    blunders: number;
  };
  overall: {
    avgAccuracy: number;
    totalBlunders: number;
    overallWinRate?: number;
  };
}

interface RatingData {
  gameNumber: number;
  rating: number;
  date?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent, StatCardComponent],
  template: `
    <app-layout>
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-foreground">Performance Dashboard</h1>
            <p class="text-muted-foreground">Analyze your chess performance and track improvement</p>
          </div>
          <div class="relative">
            <select 
              [(ngModel)]="selectedTournament" 
              (ngModelChange)="onTournamentChange()"
              class="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none">
              <option value="">All Tournaments</option>
              <option *ngFor="let tournament of tournaments" [value]="tournament.id">
                {{ tournament.name }}
              </option>
            </select>
            <svg class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <app-stat-card
            title="Total Games"
            [value]="performance.white.games + performance.black.games"
            subtitle="All time"
            icon="trophy">
          </app-stat-card>
          <app-stat-card
            title="Overall Win Rate"
            [value]="performance.overall.overallWinRate + '%'"
            [subtitle]="getWinRateSubtitle()"
            icon="target">
          </app-stat-card>
          <app-stat-card
            title="Avg Accuracy"
            [value]="performance.overall.avgAccuracy + '%'"
            subtitle="Across all games"
            icon="trending-up">
          </app-stat-card>
          <app-stat-card
            title="Total Blunders"
            [value]="performance.overall.totalBlunders"
            subtitle="All games combined"
            icon="alert-triangle">
          </app-stat-card>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div class="flex flex-col space-y-1.5 p-6">
              <h3 class="text-2xl font-semibold leading-none tracking-tight">Rating Progression</h3>
              <p class="text-sm text-muted-foreground">Your rating trend over time</p>
            </div>
            <div class="p-6 pt-0">
              <div class="h-[300px] flex items-center justify-center" *ngIf="ratingData.length === 0">
                <p class="text-muted-foreground">No rating data available</p>
              </div>
              <div class="h-[300px]" *ngIf="ratingData.length > 0">
                <svg class="w-full h-full" viewBox="0 0 400 200">
                  <!-- Grid lines -->
                  <g stroke="#e5e7eb" stroke-width="1" opacity="0.3">
                    <line x1="50" y1="20" x2="50" y2="160"/>
                    <line x1="120" y1="20" x2="120" y2="160"/>
                    <line x1="190" y1="20" x2="190" y2="160"/>
                    <line x1="260" y1="20" x2="260" y2="160"/>
                    <line x1="330" y1="20" x2="330" y2="160"/>
                    <line x1="50" y1="160" x2="350" y2="160"/>
                    <line x1="50" y1="120" x2="350" y2="120"/>
                    <line x1="50" y1="80" x2="350" y2="80"/>
                    <line x1="50" y1="40" x2="350" y2="40"/>
                  </g>
                  <!-- Rating line -->
                  <polyline 
                    fill="none" 
                    stroke="#3b82f6" 
                    stroke-width="2" 
                    [attr.points]="getRatingPoints()"/>
                  <!-- Data points -->
                  <circle 
                    *ngFor="let point of getRatingCircles()" 
                    [attr.cx]="point.x" 
                    [attr.cy]="point.y" 
                    r="4" 
                    fill="#3b82f6"/>
                </svg>
              </div>
            </div>
          </div>
          
          <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div class="flex flex-col space-y-1.5 p-6">
              <h3 class="text-2xl font-semibold leading-none tracking-tight">Performance by Color</h3>
              <p class="text-sm text-muted-foreground">Win rates when playing White vs Black</p>
            </div>
            <div class="p-6 pt-0">
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-foreground">White</span>
                    <span class="text-2xl font-bold text-foreground">{{ performance.white.winRate }}%</span>
                  </div>
                  <div class="text-xs text-muted-foreground">{{ performance.white.games }} games</div>
                  <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div class="h-full bg-green-500" [style.width.%]="performance.white.winRate"></div>
                  </div>
                </div>
                
                <div class="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-foreground">Black</span>
                    <span class="text-2xl font-bold text-foreground">{{ performance.black.winRate }}%</span>
                  </div>
                  <div class="text-xs text-muted-foreground">{{ performance.black.games }} games</div>
                  <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div class="h-full bg-blue-500" [style.width.%]="performance.black.winRate"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-blue-200 bg-blue-50 text-card-foreground shadow-sm" *ngIf="loading">
          <div class="p-6">
            <p class="text-center text-muted-foreground">Loading performance data...</p>
          </div>
        </div>

        <div class="rounded-lg border border-red-200 bg-red-50 text-card-foreground shadow-sm" *ngIf="error">
          <div class="p-6">
            <p class="text-center text-red-600">{{ error }}</p>
          </div>
        </div>
      </div>
    </app-layout>
  `
})
export class DashboardComponent implements OnInit {
  selectedTournament = '';
  tournaments: any[] = [];
  loading = false;
  error: string | null = null;
  
  performance: PerformanceData = {
    white: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
    black: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
    overall: { avgAccuracy: 0, totalBlunders: 0, overallWinRate: 0 }
  };
  
  ratingData: RatingData[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadTournaments();
    this.loadPerformanceData();
    this.loadRatingData();
  }

  async loadTournaments() {
    try {
      const tournaments = await this.http.get<any[]>('http://localhost:3000/api/tournaments').toPromise();
      this.tournaments = tournaments || [];
    } catch (error) {
      console.error('Failed to load tournaments:', error);
    }
  }

  async loadPerformanceData() {
    try {
      this.loading = true;
      this.error = null;
      
      const url = this.selectedTournament 
        ? `http://localhost:3000/api/performance?tournament=${this.selectedTournament}`
        : 'http://localhost:3000/api/performance';
      
      const data = await this.http.get<PerformanceData>(url).toPromise();
      this.performance = data || this.performance;
    } catch (error) {
      console.error('Failed to load performance data:', error);
      this.error = 'Failed to load performance data';
    } finally {
      this.loading = false;
    }
  }

  async loadRatingData() {
    try {
      const url = this.selectedTournament 
        ? `http://localhost:3000/api/trends/rating?tournament=${this.selectedTournament}`
        : 'http://localhost:3000/api/trends/rating';
      
      const response = await this.http.get<{data: RatingData[]}>(url).toPromise();
      this.ratingData = response?.data || [];
    } catch (error) {
      console.error('Failed to load rating data:', error);
    }
  }

  onTournamentChange() {
    this.loadPerformanceData();
    this.loadRatingData();
  }

  getWinRateSubtitle(): string {
    const totalGames = this.performance.white.games + this.performance.black.games;
    if (totalGames === 0) return 'No games played';
    
    const wins = Math.round((this.performance.overall.overallWinRate || 0) * totalGames / 100);
    const losses = totalGames - wins;
    return `${wins} wins, ${losses} losses`;
  }

  getRatingPoints(): string {
    if (this.ratingData.length === 0) return '';
    
    const width = 300;
    const height = 140;
    const padding = 50;
    
    const minRating = Math.min(...this.ratingData.map(d => d.rating));
    const maxRating = Math.max(...this.ratingData.map(d => d.rating));
    const ratingRange = maxRating - minRating || 100;
    
    return this.ratingData.map((point, index) => {
      const x = padding + (index * (width - padding) / (this.ratingData.length - 1));
      const y = height + 20 - ((point.rating - minRating) / ratingRange * height);
      return `${x},${y}`;
    }).join(' ');
  }

  getRatingCircles(): {x: number, y: number}[] {
    if (this.ratingData.length === 0) return [];
    
    const width = 300;
    const height = 140;
    const padding = 50;
    
    const minRating = Math.min(...this.ratingData.map(d => d.rating));
    const maxRating = Math.max(...this.ratingData.map(d => d.rating));
    const ratingRange = maxRating - minRating || 100;
    
    return this.ratingData.map((point, index) => ({
      x: padding + (index * (width - padding) / (this.ratingData.length - 1)),
      y: height + 20 - ((point.rating - minRating) / ratingRange * height)
    }));
  }
}
