import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { LayoutComponent } from '../../components/layout/layout.component';
import {
  ChessApiService,
  AccuracyByResultData,
  PhaseDistributionData,
  AccuracyByPhaseData,
  OpeningPerformanceData
} from '../../services/chess-api.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [CommonModule, HttpClientModule, LayoutComponent],
  template: `
    <app-layout>
      <div class="space-y-8 pb-8">
        <!-- Header Section -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div>
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gradient tracking-tight mb-2">Chess Insights</h1>
            <p class="text-sm sm:text-base text-muted-foreground">Deep analysis of your playing patterns and performance</p>
          </div>

          <!-- Color Filter -->
          <div class="flex gap-2">
            <button
              (click)="setColorFilter(null)"
              [class]="'px-4 py-2 rounded-lg font-medium transition-all duration-300 ' + (colorFilter === null ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-muted')">
              All
            </button>
            <button
              (click)="setColorFilter('white')"
              [class]="'px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ' + (colorFilter === 'white' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-muted')">
              <div class="w-3 h-3 rounded-full bg-gradient-to-br from-gray-100 to-gray-300 border border-gray-400"></div>
              White
            </button>
            <button
              (click)="setColorFilter('black')"
              [class]="'px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ' + (colorFilter === 'black' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-muted')">
              <div class="w-3 h-3 rounded-full bg-gradient-to-br from-gray-700 to-gray-900"></div>
              Black
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="flex flex-col justify-center items-center py-16 animate-fade-in">
          <div class="relative">
            <div class="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <div class="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-accent rounded-full animate-spin" style="animation-duration: 1.5s;"></div>
          </div>
          <p class="text-muted-foreground mt-6 text-sm font-medium">Loading insights...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="error" class="rounded-2xl border-2 border-destructive/30 bg-gradient-to-br from-destructive/10 to-destructive/5 p-6 shadow-xl animate-slide-up">
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0 p-2 rounded-lg bg-destructive/20">
              <svg class="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-bold text-destructive mb-1">Error Loading Insights</h3>
              <p class="text-sm text-foreground/80">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- Insights Grid -->
        <div *ngIf="!loading && !error" class="grid gap-6 lg:grid-cols-2 animate-slide-up">

          <!-- Accuracy by Result Card -->
          <div *ngIf="accuracyByResult" class="group rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl hover:shadow-glow-success hover:border-success/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
            <div class="flex flex-col space-y-2 p-6 bg-gradient-to-br from-success/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-success/10 group-hover:bg-success/20 transition-colors duration-300">
                  <svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-xl font-bold leading-none tracking-tight text-gradient">Accuracy by Result</h3>
                  <p class="text-sm text-muted-foreground mt-1">How accurately you play in wins vs losses</p>
                </div>
              </div>
            </div>
            <div class="p-6 pt-2">
              <div class="space-y-4">
                <!-- Overall -->
                <div class="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
                  <span class="font-medium text-foreground">Overall</span>
                  <div class="text-right">
                    <span class="text-2xl font-bold text-gradient">{{ accuracyByResult.overall.accuracy | number:'1.1-1' }}%</span>
                    <span class="text-xs text-muted-foreground ml-2">({{ accuracyByResult.overall.games }} games)</span>
                  </div>
                </div>
                <!-- Wins -->
                <div class="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-success"></div>
                    <span class="font-medium text-success">Wins</span>
                  </div>
                  <div class="text-right">
                    <span class="text-xl font-bold text-success">{{ accuracyByResult.wins.accuracy | number:'1.1-1' }}%</span>
                    <span class="text-xs text-muted-foreground ml-2">({{ accuracyByResult.wins.games }} games)</span>
                  </div>
                </div>
                <!-- Draws -->
                <div class="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-muted-foreground"></div>
                    <span class="font-medium text-muted-foreground">Draws</span>
                  </div>
                  <div class="text-right">
                    <span class="text-xl font-bold">{{ accuracyByResult.draws.accuracy | number:'1.1-1' }}%</span>
                    <span class="text-xs text-muted-foreground ml-2">({{ accuracyByResult.draws.games }} games)</span>
                  </div>
                </div>
                <!-- Losses -->
                <div class="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-destructive"></div>
                    <span class="font-medium text-destructive">Losses</span>
                  </div>
                  <div class="text-right">
                    <span class="text-xl font-bold text-destructive">{{ accuracyByResult.losses.accuracy | number:'1.1-1' }}%</span>
                    <span class="text-xs text-muted-foreground ml-2">({{ accuracyByResult.losses.games }} games)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Accuracy by Phase Card -->
          <div *ngIf="accuracyByPhase" class="group rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl hover:shadow-glow-accent hover:border-accent/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
            <div class="flex flex-col space-y-2 p-6 bg-gradient-to-br from-accent/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors duration-300">
                  <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-xl font-bold leading-none tracking-tight text-gradient">Accuracy by Phase</h3>
                  <p class="text-sm text-muted-foreground mt-1">Your accuracy in different game phases</p>
                </div>
              </div>
            </div>
            <div class="p-6 pt-2">
              <div class="space-y-4">
                <!-- Opening -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-foreground">Opening</span>
                    <span class="text-lg font-bold text-chart-1">{{ accuracyByPhase.opening.accuracy | number:'1.1-1' }}%</span>
                  </div>
                  <div class="relative h-3 w-full overflow-hidden rounded-full bg-muted/50">
                    <div class="h-full bg-gradient-to-r from-chart-1 to-chart-1/80 rounded-full transition-all duration-1000"
                      [style.width.%]="accuracyByPhase.opening.accuracy"></div>
                  </div>
                  <p class="text-xs text-muted-foreground">{{ accuracyByPhase.opening.gamesWithData }} games with data</p>
                </div>
                <!-- Middlegame -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-foreground">Middlegame</span>
                    <span class="text-lg font-bold text-chart-2">{{ accuracyByPhase.middlegame.accuracy | number:'1.1-1' }}%</span>
                  </div>
                  <div class="relative h-3 w-full overflow-hidden rounded-full bg-muted/50">
                    <div class="h-full bg-gradient-to-r from-chart-2 to-chart-2/80 rounded-full transition-all duration-1000"
                      [style.width.%]="accuracyByPhase.middlegame.accuracy"></div>
                  </div>
                  <p class="text-xs text-muted-foreground">{{ accuracyByPhase.middlegame.gamesWithData }} games with data</p>
                </div>
                <!-- Endgame -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-foreground">Endgame</span>
                    <span class="text-lg font-bold text-chart-3">{{ accuracyByPhase.endgame.accuracy | number:'1.1-1' }}%</span>
                  </div>
                  <div class="relative h-3 w-full overflow-hidden rounded-full bg-muted/50">
                    <div class="h-full bg-gradient-to-r from-chart-3 to-chart-3/80 rounded-full transition-all duration-1000"
                      [style.width.%]="accuracyByPhase.endgame.accuracy"></div>
                  </div>
                  <p class="text-xs text-muted-foreground">{{ accuracyByPhase.endgame.gamesWithData }} games with data</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Phase Distribution Card -->
          <div *ngIf="phaseDistribution" class="group rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl hover:shadow-glow-primary hover:border-primary/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
            <div class="flex flex-col space-y-2 p-6 bg-gradient-to-br from-primary/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                  <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-xl font-bold leading-none tracking-tight text-gradient">Phase Distribution</h3>
                  <p class="text-sm text-muted-foreground mt-1">When do your games typically end?</p>
                </div>
              </div>
            </div>
            <div class="p-6 pt-2">
              <div class="space-y-4">
                <p class="text-sm text-muted-foreground text-center mb-4">{{ phaseDistribution.totalGames }} games analyzed</p>

                <!-- Horizontal Bar Chart -->
                <div class="space-y-3">
                  <!-- Opening -->
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-sm">
                      <span class="font-medium">Opening</span>
                      <span class="text-muted-foreground">{{ phaseDistribution.overall.opening.count }} ({{ phaseDistribution.overall.opening.percentage | number:'1.0-0' }}%)</span>
                    </div>
                    <div class="relative h-6 w-full overflow-hidden rounded-lg bg-muted/30">
                      <div class="h-full bg-gradient-to-r from-chart-1 to-chart-1/60 rounded-lg flex items-center justify-end pr-2 transition-all duration-1000"
                        [style.width.%]="phaseDistribution.overall.opening.percentage">
                        <span *ngIf="phaseDistribution.overall.opening.percentage > 10" class="text-xs font-bold text-white">
                          {{ phaseDistribution.overall.opening.percentage | number:'1.0-0' }}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <!-- Middlegame -->
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-sm">
                      <span class="font-medium">Middlegame</span>
                      <span class="text-muted-foreground">{{ phaseDistribution.overall.middlegame.count }} ({{ phaseDistribution.overall.middlegame.percentage | number:'1.0-0' }}%)</span>
                    </div>
                    <div class="relative h-6 w-full overflow-hidden rounded-lg bg-muted/30">
                      <div class="h-full bg-gradient-to-r from-chart-2 to-chart-2/60 rounded-lg flex items-center justify-end pr-2 transition-all duration-1000"
                        [style.width.%]="phaseDistribution.overall.middlegame.percentage">
                        <span *ngIf="phaseDistribution.overall.middlegame.percentage > 10" class="text-xs font-bold text-white">
                          {{ phaseDistribution.overall.middlegame.percentage | number:'1.0-0' }}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <!-- Endgame -->
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-sm">
                      <span class="font-medium">Endgame</span>
                      <span class="text-muted-foreground">{{ phaseDistribution.overall.endgame.count }} ({{ phaseDistribution.overall.endgame.percentage | number:'1.0-0' }}%)</span>
                    </div>
                    <div class="relative h-6 w-full overflow-hidden rounded-lg bg-muted/30">
                      <div class="h-full bg-gradient-to-r from-chart-3 to-chart-3/60 rounded-lg flex items-center justify-end pr-2 transition-all duration-1000"
                        [style.width.%]="phaseDistribution.overall.endgame.percentage">
                        <span *ngIf="phaseDistribution.overall.endgame.percentage > 10" class="text-xs font-bold text-white">
                          {{ phaseDistribution.overall.endgame.percentage | number:'1.0-0' }}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Opening Performance Card (Full Width) -->
          <div *ngIf="openingPerformance && openingPerformance.length > 0" class="lg:col-span-2 group rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl hover:shadow-glow-warning hover:border-warning/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
            <div class="flex flex-col space-y-2 p-6 bg-gradient-to-br from-warning/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-warning/10 group-hover:bg-warning/20 transition-colors duration-300">
                  <svg class="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-xl font-bold leading-none tracking-tight text-gradient">Opening Performance</h3>
                  <p class="text-sm text-muted-foreground mt-1">Your most played openings and their success rates</p>
                </div>
              </div>
            </div>
            <div class="p-6 pt-2">
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="border-b border-border/30">
                      <th class="text-left py-3 px-4 font-semibold text-muted-foreground text-sm">Opening</th>
                      <th class="text-center py-3 px-4 font-semibold text-muted-foreground text-sm">Games</th>
                      <th class="text-center py-3 px-4 font-semibold text-muted-foreground text-sm">Win Rate</th>
                      <th class="text-center py-3 px-4 font-semibold text-muted-foreground text-sm hidden sm:table-cell">W/D/L</th>
                      <th class="text-right py-3 px-4 font-semibold text-muted-foreground text-sm">Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let opening of openingPerformance; let i = index"
                        class="border-b border-border/20 hover:bg-muted/20 transition-colors duration-200"
                        [ngClass]="{'bg-success/5': opening.winRate >= 60, 'bg-destructive/5': opening.winRate < 40}">
                      <td class="py-3 px-4">
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">{{ opening.ecoCode }}</span>
                          <span class="font-medium text-foreground truncate max-w-[200px]" [title]="opening.name">{{ opening.name }}</span>
                        </div>
                      </td>
                      <td class="text-center py-3 px-4">
                        <span class="font-semibold">{{ opening.games }}</span>
                      </td>
                      <td class="text-center py-3 px-4">
                        <span class="font-bold text-lg"
                          [ngClass]="{'text-success': opening.winRate >= 60, 'text-destructive': opening.winRate < 40, 'text-foreground': opening.winRate >= 40 && opening.winRate < 60}">
                          {{ opening.winRate | number:'1.0-0' }}%
                        </span>
                      </td>
                      <td class="text-center py-3 px-4 hidden sm:table-cell">
                        <span class="text-success">{{ opening.wins }}</span>
                        <span class="text-muted-foreground">/</span>
                        <span class="text-muted-foreground">{{ opening.draws }}</span>
                        <span class="text-muted-foreground">/</span>
                        <span class="text-destructive">{{ opening.losses }}</span>
                      </td>
                      <td class="py-3 px-4">
                        <div class="flex items-center justify-end gap-1">
                          <div class="w-24 h-2 rounded-full bg-muted/30 overflow-hidden flex">
                            <div class="h-full bg-success" [style.width.%]="opening.winRate"></div>
                            <div class="h-full bg-muted-foreground" [style.width.%]="opening.drawRate"></div>
                            <div class="h-full bg-destructive" [style.width.%]="opening.lossRate"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Empty state for no openings -->
              <div *ngIf="openingPerformance.length === 0" class="text-center py-8">
                <p class="text-muted-foreground">No opening data available yet. Play more games to see your opening statistics.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- No Data State -->
        <div *ngIf="!loading && !error && !accuracyByResult && !phaseDistribution && !accuracyByPhase && (!openingPerformance || openingPerformance.length === 0)"
             class="text-center py-16 animate-fade-in">
          <div class="p-4 rounded-full bg-muted/30 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <svg class="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-foreground mb-2">No Insights Available</h3>
          <p class="text-muted-foreground">Upload and analyze some games to see your chess insights.</p>
        </div>
      </div>
    </app-layout>
  `
})
export class InsightsComponent implements OnInit {
  accuracyByResult: AccuracyByResultData | null = null;
  phaseDistribution: PhaseDistributionData | null = null;
  accuracyByPhase: AccuracyByPhaseData | null = null;
  openingPerformance: OpeningPerformanceData[] = [];

  loading = true;
  error: string | null = null;
  colorFilter: 'white' | 'black' | null = null;

  constructor(private chessApi: ChessApiService) {}

  ngOnInit() {
    this.loadData();
  }

  setColorFilter(color: 'white' | 'black' | null) {
    this.colorFilter = color;
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.error = null;

    const color = this.colorFilter || undefined;

    forkJoin({
      accuracyByResult: this.chessApi.getAccuracyByResult(color),
      phaseDistribution: this.chessApi.getPhaseDistribution(color),
      accuracyByPhase: this.chessApi.getAccuracyByPhase(color),
      openingPerformance: this.chessApi.getOpeningPerformance(10, color)
    }).subscribe({
      next: (results) => {
        if (results.accuracyByResult.success) {
          this.accuracyByResult = results.accuracyByResult.data;
        }
        if (results.phaseDistribution.success) {
          this.phaseDistribution = results.phaseDistribution.data;
        }
        if (results.accuracyByPhase.success) {
          this.accuracyByPhase = results.accuracyByPhase.data;
        }
        if (results.openingPerformance.success) {
          this.openingPerformance = results.openingPerformance.data;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading insights:', err);
        this.error = err.message || 'Failed to load insights data';
        this.loading = false;
      }
    });
  }
}
