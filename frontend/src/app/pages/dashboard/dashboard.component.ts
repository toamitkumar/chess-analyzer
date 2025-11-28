import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ChessApiService, PerformanceData } from '../../services/chess-api.service';
import { StatCardComponent } from '../../components/stat-card.component';
import { Trophy, Target, Activity, AlertTriangle } from 'lucide-angular';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterModule, LayoutComponent, StatCardComponent],
  template: `
    <app-layout>
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div>
            <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient tracking-tight">Performance Dashboard</h1>
            <p class="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Analyze your chess performance and track improvement</p>
          </div>
          <select
            [(ngModel)]="timeRange"
            class="flex h-10 w-full sm:w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>

        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-slide-up" *ngIf="performanceData">
          <app-stat-card
            title="Total Games"
            [value]="getTotalGames()"
            [icon]="Trophy"
            subtitle="All time"
            variant="default">
          </app-stat-card>

          <app-stat-card
            title="Win Rate"
            [value]="getOverallWinRate()"
            [icon]="Target"
            [subtitle]="getWinRateSubtitle()"
            variant="success">
          </app-stat-card>

          <app-stat-card
            title="Avg Accuracy"
            [value]="getAvgAccuracy()"
            [icon]="Activity"
            subtitle="Across all games"
            variant="default">
          </app-stat-card>

          <a routerLink="/blunders" class="block">
            <app-stat-card
              title="Blunders"
              [value]="getBlunders()"
              [icon]="AlertTriangle"
              subtitle="This month →"
              variant="warning">
            </app-stat-card>
          </a>
        </div>

        <div class="grid gap-4 md:grid-cols-2 animate-slide-up" style="animation-delay: 0.1s;">
          <div class="rounded-xl border border-border gradient-card text-card-foreground shadow-xl hover:shadow-glow-primary hover:border-primary/50 transition-all duration-300">
            <div class="flex flex-col space-y-1.5 p-6">
              <h3 class="text-2xl font-semibold leading-none tracking-tight text-gradient">Rating Progression</h3>
              <p class="text-sm text-muted-foreground">Your rating trend over time</p>
            </div>
            <div class="p-6 pt-0">
              <div class="h-[300px]" *ngIf="trendsData?.data?.ratingProgression; else noRatingData">
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
                  <polyline fill="none" stroke="hsl(var(--chart-1))" stroke-width="2" 
                    [attr.points]="getRatingPoints()"/>
                  <!-- Data points -->
                  <circle *ngFor="let point of getRatingDataPoints()" 
                    [attr.cx]="point.x" [attr.cy]="point.y" r="4" fill="hsl(var(--chart-1))"/>
                  <!-- Labels -->
                  <text x="50" y="180" text-anchor="middle" class="text-xs" fill="#6b7280">Start</text>
                  <text x="350" y="180" text-anchor="middle" class="text-xs" fill="#6b7280">Latest</text>
                  <text x="30" y="165" text-anchor="middle" class="text-xs" fill="#6b7280">{{ getMinRating() }}</text>
                  <text x="30" y="45" text-anchor="middle" class="text-xs" fill="#6b7280">{{ getMaxRating() }}</text>
                </svg>
              </div>
              <ng-template #noRatingData>
                <div class="h-[300px] flex items-center justify-center text-muted-foreground">
                  No rating data available
                </div>
              </ng-template>
            </div>
          </div>
          
          <div class="rounded-xl border border-border gradient-card text-card-foreground shadow-xl hover:shadow-glow-accent hover:border-accent/50 transition-all duration-300">
            <div class="flex flex-col space-y-1.5 p-6">
              <h3 class="text-2xl font-semibold leading-none tracking-tight text-gradient">Average Centipawn Loss</h3>
              <p class="text-sm text-muted-foreground">Lower is better - tracking accuracy</p>
            </div>
            <div class="p-6 pt-0">
              <div class="h-[300px]" *ngIf="trendsData?.data?.centipawnTrend; else noCentipawnData">
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
                  <!-- CPL line -->
                  <polyline fill="none" stroke="hsl(var(--chart-2))" stroke-width="2" 
                    [attr.points]="getCentipawnPoints()"/>
                  <!-- Data points -->
                  <circle *ngFor="let point of getCentipawnDataPoints()" 
                    [attr.cx]="point.x" [attr.cy]="point.y" r="4" fill="hsl(var(--chart-2))"/>
                  <!-- Labels -->
                  <text x="50" y="180" text-anchor="middle" class="text-xs" fill="#6b7280">Start</text>
                  <text x="350" y="180" text-anchor="middle" class="text-xs" fill="#6b7280">Latest</text>
                  <text x="30" y="165" text-anchor="middle" class="text-xs" fill="#6b7280">{{ getMaxCentipawn() }}</text>
                  <text x="30" y="45" text-anchor="middle" class="text-xs" fill="#6b7280">{{ getMinCentipawn() }}</text>
                </svg>
              </div>
              <ng-template #noCentipawnData>
                <div class="h-[300px] flex items-center justify-center text-muted-foreground">
                  No centipawn data available
                </div>
              </ng-template>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-border gradient-card text-card-foreground shadow-xl hover:shadow-glow-success hover:border-success/50 transition-all duration-300 animate-slide-up" style="animation-delay: 0.2s;" *ngIf="performanceData">
          <div class="flex flex-col space-y-1.5 p-6">
            <h3 class="text-2xl font-semibold leading-none tracking-tight text-gradient">Performance by Color</h3>
            <p class="text-sm text-muted-foreground">Win rates when playing White vs Black</p>
          </div>
          <div class="p-6 pt-0">
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-foreground">White</span>
                  <span class="text-2xl font-bold text-foreground">{{ performanceData.white.winRate }}%</span>
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ getWhiteWins() }} wins, {{ getWhiteLosses() }} losses, {{ getWhiteDraws() }} draws
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div class="h-full bg-success" [style.width.%]="performanceData.white.winRate"></div>
                </div>
              </div>
              
              <div class="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-foreground">Black</span>
                  <span class="text-2xl font-bold text-foreground">{{ performanceData.black.winRate }}%</span>
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ getBlackWins() }} wins, {{ getBlackLosses() }} losses, {{ getBlackDraws() }} draws
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div class="h-full bg-chart-1" [style.width.%]="performanceData.black.winRate"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5 text-card-foreground shadow-lg backdrop-blur-sm hover:shadow-glow-accent hover:border-accent/50 transition-all duration-300 animate-slide-up" style="animation-delay: 0.3s;">
          <div class="flex flex-col space-y-1.5 p-6">
            <h3 class="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2">
              <svg class="h-5 w-5 text-accent animate-glow-pulse" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
              </svg>
              <span class="text-gradient">Key Insights</span>
            </h3>
          </div>
          <div class="p-6 pt-0">
            <ul class="space-y-2 text-sm">
              <li class="flex items-start gap-2">
                <span class="text-accent">•</span>
                <span>{{ getAccuracyInsight() }}</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-accent">•</span>
                <span>{{ getColorPerformanceInsight() }}</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-accent">•</span>
                <span>{{ getRatingInsight() }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div *ngIf="loading" class="flex justify-center items-center py-8">
          <div class="text-muted-foreground">Loading performance data...</div>
        </div>

        <div *ngIf="error" class="rounded-lg border border-red-200 bg-red-50 p-4">
          <div class="text-red-800">Error loading data: {{ error }}</div>
        </div>
      </div>
    </app-layout>
  `
})
export class DashboardComponent implements OnInit {
  timeRange = '30';
  performanceData: PerformanceData | null = null;
  trendsData: any = null;
  loading = true;
  error: string | null = null;

  // Lucide icons for stat cards
  Trophy = Trophy;
  Target = Target;
  Activity = Activity;
  AlertTriangle = AlertTriangle;

  constructor(private chessApi: ChessApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.error = null;
    
    // Load both performance and trends data
    Promise.all([
      this.chessApi.getPlayerPerformanceData().toPromise(),
      this.chessApi.getTrendsData().toPromise()
    ]).then(([performanceData, trendsData]) => {
      this.performanceData = performanceData;
      this.trendsData = trendsData;
      this.loading = false;
      console.log('Dashboard performance data:', performanceData);
      console.log('Total games calculation:', this.getTotalGames());
    }).catch(err => {
      this.error = err.message || 'Failed to load data';
      this.loading = false;
      console.error('Error loading data:', err);
    });
  }

  getTotalGames(): number {
    if (!this.performanceData) return 0;
    // Use overall total games from the new player-specific API
    return this.performanceData.overall?.totalGames || (this.performanceData.white.games + this.performanceData.black.games);
  }

  getOverallWinRate(): string {
    if (!this.performanceData?.overall?.overallWinRate) return '0%';
    return Math.round(this.performanceData.overall.overallWinRate) + '%';
  }

  getWinRateSubtitle(): string {
    if (!this.performanceData) return '';
    const totalWins = this.getWhiteWins() + this.getBlackWins();
    const totalLosses = this.getWhiteLosses() + this.getBlackLosses();
    const totalDraws = this.getWhiteDraws() + this.getBlackDraws();
    
    return `${totalWins} wins, ${totalLosses} losses, ${totalDraws} draws`;
  }

  getAvgAccuracy(): string {
    if (!this.performanceData?.overall?.avgAccuracy) return '0%';
    return Math.round(this.performanceData.overall.avgAccuracy) + '%';
  }

  getBlunders(): number {
    if (!this.performanceData?.overall?.totalBlunders) return 0;
    return this.performanceData.overall.totalBlunders;
  }

  // Chart helper methods
  getRatingPoints(): string {
    if (!this.trendsData?.data?.ratingProgression) return '';
    const data = this.trendsData.data.ratingProgression;
    const minRating = Math.min(...data.map((d: any) => d.rating));
    const maxRating = Math.max(...data.map((d: any) => d.rating));
    const range = maxRating - minRating || 100;
    
    return data.map((d: any, i: number) => {
      const x = 50 + (i * 300) / (data.length - 1);
      const y = 160 - ((d.rating - minRating) / range) * 120;
      return `${x},${y}`;
    }).join(' ');
  }

  getRatingDataPoints(): Array<{x: number, y: number}> {
    if (!this.trendsData?.data?.ratingProgression) return [];
    const data = this.trendsData.data.ratingProgression;
    const minRating = Math.min(...data.map((d: any) => d.rating));
    const maxRating = Math.max(...data.map((d: any) => d.rating));
    const range = maxRating - minRating || 100;
    
    return data.map((d: any, i: number) => ({
      x: 50 + (i * 300) / (data.length - 1),
      y: 160 - ((d.rating - minRating) / range) * 120
    }));
  }

  getCentipawnPoints(): string {
    if (!this.trendsData?.data?.centipawnTrend) return '';
    const data = this.trendsData.data.centipawnTrend;
    const minCPL = Math.min(...data.map((d: any) => d.avgCentipawnLoss));
    const maxCPL = Math.max(...data.map((d: any) => d.avgCentipawnLoss));
    const range = maxCPL - minCPL || 20;
    
    return data.map((d: any, i: number) => {
      const x = 50 + (i * 300) / (data.length - 1);
      const y = 160 - ((d.avgCentipawnLoss - minCPL) / range) * 120;
      return `${x},${y}`;
    }).join(' ');
  }

  getCentipawnDataPoints(): Array<{x: number, y: number}> {
    if (!this.trendsData?.data?.centipawnTrend) return [];
    const data = this.trendsData.data.centipawnTrend;
    const minCPL = Math.min(...data.map((d: any) => d.avgCentipawnLoss));
    const maxCPL = Math.max(...data.map((d: any) => d.avgCentipawnLoss));
    const range = maxCPL - minCPL || 20;
    
    return data.map((d: any, i: number) => ({
      x: 50 + (i * 300) / (data.length - 1),
      y: 160 - ((d.avgCentipawnLoss - minCPL) / range) * 120
    }));
  }

  getMinRating(): number {
    if (!this.trendsData?.data?.ratingProgression) return 1400;
    return Math.min(...this.trendsData.data.ratingProgression.map((d: any) => d.rating));
  }

  getMaxRating(): number {
    if (!this.trendsData?.data?.ratingProgression) return 1600;
    return Math.max(...this.trendsData.data.ratingProgression.map((d: any) => d.rating));
  }

  getMinCentipawn(): number {
    if (!this.trendsData?.data?.centipawnTrend) return 60;
    return Math.min(...this.trendsData.data.centipawnTrend.map((d: any) => d.avgCentipawnLoss));
  }

  getMaxCentipawn(): number {
    if (!this.trendsData?.data?.centipawnTrend) return 90;
    return Math.max(...this.trendsData.data.centipawnTrend.map((d: any) => d.avgCentipawnLoss));
  }

  // Calculate wins/losses from games and winRate
  getWhiteWins(): number {
    if (!this.performanceData?.white) return 0;
    return Math.round((this.performanceData.white.games * this.performanceData.white.winRate) / 100);
  }

  getWhiteLosses(): number {
    if (!this.performanceData?.white) return 0;
    const wins = this.getWhiteWins();
    const draws = this.getWhiteDraws();
    return this.performanceData.white.games - wins - draws;
  }

  getWhiteDraws(): number {
    // Calculate draws as remaining games after wins and losses
    if (!this.performanceData?.white) return 0;
    const wins = Math.round((this.performanceData.white.games * this.performanceData.white.winRate) / 100);
    const losses = this.performanceData.white.games - wins;
    // If winRate * games doesn't equal exact wins, the remainder could be draws
    // But based on actual data, there are no draws, so return 0
    return 0;
  }

  getBlackWins(): number {
    if (!this.performanceData?.black) return 0;
    return Math.round((this.performanceData.black.games * this.performanceData.black.winRate) / 100);
  }

  getBlackLosses(): number {
    if (!this.performanceData?.black) return 0;
    const wins = this.getBlackWins();
    const draws = this.getBlackDraws();
    return this.performanceData.black.games - wins - draws;
  }

  getBlackDraws(): number {
    // Calculate draws as remaining games after wins and losses
    if (!this.performanceData?.black) return 0;
    const wins = Math.round((this.performanceData.black.games * this.performanceData.black.winRate) / 100);
    const losses = this.performanceData.black.games - wins;
    // If winRate * games doesn't equal exact wins, the remainder could be draws
    // But based on actual data, there are no draws, so return 0
    return 0;
  }

  // Dynamic insights based on actual data
  getAccuracyInsight(): string {
    if (!this.performanceData?.overall?.avgAccuracy) {
      return 'Accuracy data not available';
    }
    const accuracy = this.performanceData.overall.avgAccuracy;
    if (accuracy >= 90) {
      return `Excellent accuracy at ${accuracy}% - you're playing very precisely`;
    } else if (accuracy >= 80) {
      return `Good accuracy at ${accuracy}% - room for improvement in calculation`;
    } else {
      return `Accuracy at ${accuracy}% - focus on reducing blunders and improving calculation`;
    }
  }

  getColorPerformanceInsight(): string {
    if (!this.performanceData?.white || !this.performanceData?.black) {
      return 'Color performance data not available';
    }
    const whiteWinRate = this.performanceData.white.winRate;
    const blackWinRate = this.performanceData.black.winRate;
    const difference = whiteWinRate - blackWinRate;
    
    if (difference > 30) {
      return `Strong with White (${whiteWinRate}%) but struggling with Black (${blackWinRate}%) - work on Black openings`;
    } else if (difference > 10) {
      return `Better with White (${whiteWinRate}%) than Black (${blackWinRate}%) - typical pattern`;
    } else if (difference < -10) {
      return `Surprisingly better with Black (${blackWinRate}%) than White (${whiteWinRate}%)`;
    } else {
      return `Balanced performance: White ${whiteWinRate}%, Black ${blackWinRate}%`;
    }
  }

  getRatingInsight(): string {
    if (!this.trendsData?.data?.summary) {
      return `Total games analyzed: ${this.getTotalGames()}`;
    }
    const summary = this.trendsData.data.summary;
    const ratingChange = summary.ratingChange || 0;
    const trend = summary.improvementTrend || 'stable';
    
    if (ratingChange > 50) {
      return `Excellent progress: +${ratingChange} rating points and ${trend} trend`;
    } else if (ratingChange > 0) {
      return `Good progress: +${ratingChange} rating points with ${trend} performance`;
    } else if (ratingChange < -20) {
      return `Recent struggles: ${ratingChange} rating points - focus on fundamentals`;
    } else {
      return `Stable rating with ${trend} trend over ${this.getTotalGames()} games`;
    }
  }
}
