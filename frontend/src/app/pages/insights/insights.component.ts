import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { LayoutComponent } from '../../components/layout/layout.component';
import {
  ChessApiService,
  AccuracyByResultData,
  PhaseDistributionData,
  AccuracyByPhaseData,
  OpeningPerformanceData,
  TacticalOpportunitiesData,
  FreePiecesData
} from '../../services/chess-api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface BlunderDashboardData {
  overview: {
    totalBlunders: number;
    avgCentipawnLoss: number;
  };
  byPhase: {
    opening: { count: number; percentage: string; avgLoss: number };
    middlegame: { count: number; percentage: string; avgLoss: number };
    endgame: { count: number; percentage: string; avgLoss: number };
  };
  byTheme: Array<{
    theme: string;
    count: number;
    percentage: string;
    avgLoss: number;
  }>;
  bySeverity: {
    critical: number;
    major: number;
    moderate: number;
    minor: number;
  };
}

@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterModule, LayoutComponent],
  template: `
    <app-layout>
      <div class="space-y-6 sm:space-y-8 pb-8">
        <!-- Header Section -->
        <div class="flex flex-col gap-4 animate-fade-in">
          <div>
            <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient tracking-tight mb-2">Chess Insights</h1>
            <p class="text-sm sm:text-base text-muted-foreground">Deep analysis of your playing patterns and performance</p>
          </div>

          <!-- Color Filter -->
          <div class="flex flex-wrap gap-2">
            <button
              (click)="setColorFilter(null)"
              [class]="'px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ' + (colorFilter === null ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-muted')">
              All
            </button>
            <button
              (click)="setColorFilter('white')"
              [class]="'px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ' + (colorFilter === 'white' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-muted')">
              <div class="w-3 h-3 rounded-full bg-gradient-to-br from-gray-100 to-gray-300 border border-gray-400"></div>
              White
            </button>
            <button
              (click)="setColorFilter('black')"
              [class]="'px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ' + (colorFilter === 'black' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-muted')">
              <div class="w-3 h-3 rounded-full bg-gradient-to-br from-gray-700 to-gray-900"></div>
              Black
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="flex flex-col justify-center items-center py-12 sm:py-16 animate-fade-in">
          <div class="relative">
            <div class="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <div class="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-transparent border-t-accent rounded-full animate-spin" style="animation-duration: 1.5s;"></div>
          </div>
          <p class="text-muted-foreground mt-6 text-sm font-medium">Loading insights...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="error" class="rounded-xl sm:rounded-2xl border-2 border-destructive/30 bg-gradient-to-br from-destructive/10 to-destructive/5 p-4 sm:p-6 shadow-xl animate-slide-up">
          <div class="flex items-start gap-3 sm:gap-4">
            <div class="flex-shrink-0 p-2 rounded-lg bg-destructive/20">
              <svg class="w-5 h-5 sm:w-6 sm:h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-base sm:text-lg font-bold text-destructive mb-1">Error Loading Insights</h3>
              <p class="text-sm text-foreground/80">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- Insights Grid -->
        <div *ngIf="!loading && !error" class="grid gap-4 sm:gap-6 md:grid-cols-2 animate-slide-up">

          <!-- Accuracy by Result Card -->
          <div *ngIf="accuracyByResult" class="group rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-xl sm:shadow-2xl hover:shadow-glow-success hover:border-success/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
            <div class="flex flex-col space-y-2 p-4 sm:p-6 bg-gradient-to-br from-success/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-success/10 group-hover:bg-success/20 transition-colors duration-300">
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg sm:text-xl font-bold leading-none tracking-tight text-gradient">Accuracy by Result</h3>
                  <p class="text-xs sm:text-sm text-muted-foreground mt-1">How accurately you play in wins vs losses</p>
                </div>
              </div>
            </div>
            <div class="p-4 sm:p-6 pt-2">
              <div class="space-y-3 sm:space-y-4">
                <!-- Overall -->
                <div class="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30">
                  <span class="font-medium text-sm sm:text-base text-foreground">Overall</span>
                  <div class="text-right">
                    <span class="text-xl sm:text-2xl font-bold text-gradient">{{ accuracyByResult.overall.accuracy | number:'1.1-1' }}%</span>
                    <span class="text-xs text-muted-foreground ml-1 sm:ml-2">({{ accuracyByResult.overall.games }})</span>
                  </div>
                </div>
                <!-- Wins -->
                <div class="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-success/5 border border-success/20">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-success"></div>
                    <span class="font-medium text-sm sm:text-base text-success">Wins</span>
                  </div>
                  <div class="text-right">
                    <span class="text-lg sm:text-xl font-bold text-success">{{ accuracyByResult.wins.accuracy | number:'1.1-1' }}%</span>
                    <span class="text-xs text-muted-foreground ml-1 sm:ml-2">({{ accuracyByResult.wins.games }})</span>
                  </div>
                </div>
                <!-- Draws -->
                <div class="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-muted-foreground"></div>
                    <span class="font-medium text-sm sm:text-base text-muted-foreground">Draws</span>
                  </div>
                  <div class="text-right">
                    <span class="text-lg sm:text-xl font-bold">{{ accuracyByResult.draws.accuracy | number:'1.1-1' }}%</span>
                    <span class="text-xs text-muted-foreground ml-1 sm:ml-2">({{ accuracyByResult.draws.games }})</span>
                  </div>
                </div>
                <!-- Losses -->
                <div class="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-destructive"></div>
                    <span class="font-medium text-sm sm:text-base text-destructive">Losses</span>
                  </div>
                  <div class="text-right">
                    <span class="text-lg sm:text-xl font-bold text-destructive">{{ accuracyByResult.losses.accuracy | number:'1.1-1' }}%</span>
                    <span class="text-xs text-muted-foreground ml-1 sm:ml-2">({{ accuracyByResult.losses.games }})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Accuracy by Phase Card -->
          <div *ngIf="accuracyByPhase" class="group rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-xl sm:shadow-2xl hover:shadow-glow-accent hover:border-accent/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
            <div class="flex flex-col space-y-2 p-4 sm:p-6 bg-gradient-to-br from-accent/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors duration-300">
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg sm:text-xl font-bold leading-none tracking-tight text-gradient">Accuracy by Phase</h3>
                  <p class="text-xs sm:text-sm text-muted-foreground mt-1">Your accuracy in different game phases</p>
                </div>
              </div>
            </div>
            <div class="p-4 sm:p-6 pt-2">
              <div class="space-y-3 sm:space-y-4">
                <!-- Opening -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-sm sm:text-base text-foreground">Opening</span>
                    <span class="text-base sm:text-lg font-bold text-chart-1">{{ accuracyByPhase.opening.accuracy | number:'1.1-1' }}%</span>
                  </div>
                  <div class="relative h-2 sm:h-3 w-full overflow-hidden rounded-full bg-muted/50">
                    <div class="h-full bg-gradient-to-r from-chart-1 to-chart-1/80 rounded-full transition-all duration-1000"
                      [style.width.%]="accuracyByPhase.opening.accuracy"></div>
                  </div>
                  <p class="text-xs text-muted-foreground">{{ accuracyByPhase.opening.gamesWithData }} games</p>
                </div>
                <!-- Middlegame -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-sm sm:text-base text-foreground">Middlegame</span>
                    <span class="text-base sm:text-lg font-bold text-chart-2">{{ accuracyByPhase.middlegame.accuracy | number:'1.1-1' }}%</span>
                  </div>
                  <div class="relative h-2 sm:h-3 w-full overflow-hidden rounded-full bg-muted/50">
                    <div class="h-full bg-gradient-to-r from-chart-2 to-chart-2/80 rounded-full transition-all duration-1000"
                      [style.width.%]="accuracyByPhase.middlegame.accuracy"></div>
                  </div>
                  <p class="text-xs text-muted-foreground">{{ accuracyByPhase.middlegame.gamesWithData }} games</p>
                </div>
                <!-- Endgame -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-sm sm:text-base text-foreground">Endgame</span>
                    <span class="text-base sm:text-lg font-bold text-chart-3">{{ accuracyByPhase.endgame.accuracy | number:'1.1-1' }}%</span>
                  </div>
                  <div class="relative h-2 sm:h-3 w-full overflow-hidden rounded-full bg-muted/50">
                    <div class="h-full bg-gradient-to-r from-chart-3 to-chart-3/80 rounded-full transition-all duration-1000"
                      [style.width.%]="accuracyByPhase.endgame.accuracy"></div>
                  </div>
                  <p class="text-xs text-muted-foreground">{{ accuracyByPhase.endgame.gamesWithData }} games</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Phase Distribution Card -->
          <div *ngIf="phaseDistribution" class="group rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-xl sm:shadow-2xl hover:shadow-glow-primary hover:border-primary/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
            <div class="flex flex-col space-y-2 p-4 sm:p-6 bg-gradient-to-br from-primary/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg sm:text-xl font-bold leading-none tracking-tight text-gradient">Phase Distribution</h3>
                  <p class="text-xs sm:text-sm text-muted-foreground mt-1">When do your games typically end?</p>
                </div>
              </div>
            </div>
            <div class="p-4 sm:p-6 pt-2">
              <div class="space-y-3 sm:space-y-4">
                <p class="text-xs sm:text-sm text-muted-foreground text-center mb-2 sm:mb-4">{{ phaseDistribution.totalGames }} games analyzed</p>

                <!-- Horizontal Bar Chart -->
                <div class="space-y-3">
                  <!-- Opening -->
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs sm:text-sm">
                      <span class="font-medium">Opening</span>
                      <span class="text-muted-foreground">{{ phaseDistribution.overall.opening.count }} ({{ phaseDistribution.overall.opening.percentage | number:'1.0-0' }}%)</span>
                    </div>
                    <div class="relative h-5 sm:h-6 w-full overflow-hidden rounded-lg bg-muted/30">
                      <div class="h-full bg-gradient-to-r from-chart-1 to-chart-1/60 rounded-lg flex items-center justify-end pr-2 transition-all duration-1000"
                        [style.width.%]="phaseDistribution.overall.opening.percentage || 1">
                        <span *ngIf="phaseDistribution.overall.opening.percentage > 15" class="text-xs font-bold text-white">
                          {{ phaseDistribution.overall.opening.percentage | number:'1.0-0' }}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <!-- Middlegame -->
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs sm:text-sm">
                      <span class="font-medium">Middlegame</span>
                      <span class="text-muted-foreground">{{ phaseDistribution.overall.middlegame.count }} ({{ phaseDistribution.overall.middlegame.percentage | number:'1.0-0' }}%)</span>
                    </div>
                    <div class="relative h-5 sm:h-6 w-full overflow-hidden rounded-lg bg-muted/30">
                      <div class="h-full bg-gradient-to-r from-chart-2 to-chart-2/60 rounded-lg flex items-center justify-end pr-2 transition-all duration-1000"
                        [style.width.%]="phaseDistribution.overall.middlegame.percentage || 1">
                        <span *ngIf="phaseDistribution.overall.middlegame.percentage > 15" class="text-xs font-bold text-white">
                          {{ phaseDistribution.overall.middlegame.percentage | number:'1.0-0' }}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <!-- Endgame -->
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs sm:text-sm">
                      <span class="font-medium">Endgame</span>
                      <span class="text-muted-foreground">{{ phaseDistribution.overall.endgame.count }} ({{ phaseDistribution.overall.endgame.percentage | number:'1.0-0' }}%)</span>
                    </div>
                    <div class="relative h-5 sm:h-6 w-full overflow-hidden rounded-lg bg-muted/30">
                      <div class="h-full bg-gradient-to-r from-chart-3 to-chart-3/60 rounded-lg flex items-center justify-end pr-2 transition-all duration-1000"
                        [style.width.%]="phaseDistribution.overall.endgame.percentage || 1">
                        <span *ngIf="phaseDistribution.overall.endgame.percentage > 15" class="text-xs font-bold text-white">
                          {{ phaseDistribution.overall.endgame.percentage | number:'1.0-0' }}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tactical Patterns Card -->
          <div *ngIf="blunderData" class="group rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-xl sm:shadow-2xl hover:shadow-glow-warning hover:border-warning/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
            <div class="flex flex-col space-y-2 p-4 sm:p-6 bg-gradient-to-br from-warning/5 to-transparent">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="p-2 rounded-lg bg-warning/10 group-hover:bg-warning/20 transition-colors duration-300">
                    <svg class="w-4 h-4 sm:w-5 sm:h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-lg sm:text-xl font-bold leading-none tracking-tight text-gradient">Tactical Patterns</h3>
                    <p class="text-xs sm:text-sm text-muted-foreground mt-1">Your most common blunder types</p>
                  </div>
                </div>
                <a routerLink="/blunders" class="text-xs sm:text-sm text-primary hover:underline font-medium">View all &rarr;</a>
              </div>
            </div>
            <div class="p-4 sm:p-6 pt-2">
              <div class="space-y-3 sm:space-y-4">
                <!-- Overview Stats -->
                <div class="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
                  <div class="p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30 text-center">
                    <div class="text-xl sm:text-2xl font-bold text-warning">{{ blunderData.overview.totalBlunders }}</div>
                    <div class="text-xs text-muted-foreground">Total Blunders</div>
                  </div>
                  <div class="p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30 text-center">
                    <div class="text-xl sm:text-2xl font-bold text-foreground">{{ blunderData.overview.avgCentipawnLoss }}</div>
                    <div class="text-xs text-muted-foreground">Avg CP Loss</div>
                  </div>
                </div>

                <!-- Top Themes -->
                <div class="space-y-2">
                  <h4 class="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Top Themes</h4>
                  <div *ngFor="let theme of blunderData.byTheme.slice(0, 4)" class="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full" [ngClass]="getThemeColor(theme.theme)"></span>
                      <span class="text-xs sm:text-sm font-medium capitalize">{{ formatTheme(theme.theme) }}</span>
                    </div>
                    <div class="text-right">
                      <span class="text-xs sm:text-sm font-bold">{{ theme.count }}</span>
                      <span class="text-xs text-muted-foreground ml-1">({{ theme.percentage }}%)</span>
                    </div>
                  </div>
                </div>

                <!-- Blunders by Phase -->
                <div class="space-y-2 pt-2 border-t border-border/30">
                  <h4 class="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">By Phase</h4>
                  <div class="grid grid-cols-3 gap-2">
                    <div class="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                      <div class="text-sm sm:text-base font-bold text-blue-500">{{ blunderData.byPhase.opening.count }}</div>
                      <div class="text-xs text-muted-foreground">Opening</div>
                    </div>
                    <div class="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
                      <div class="text-sm sm:text-base font-bold text-purple-500">{{ blunderData.byPhase.middlegame.count }}</div>
                      <div class="text-xs text-muted-foreground">Middle</div>
                    </div>
                    <div class="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                      <div class="text-sm sm:text-base font-bold text-green-500">{{ blunderData.byPhase.endgame.count }}</div>
                      <div class="text-xs text-muted-foreground">Endgame</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Opening Performance Card (Full Width) -->
          <div *ngIf="openingPerformance && openingPerformance.length > 0" class="md:col-span-2 group rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-xl sm:shadow-2xl hover:shadow-glow-primary hover:border-primary/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
            <div class="flex flex-col space-y-2 p-4 sm:p-6 bg-gradient-to-br from-primary/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg sm:text-xl font-bold leading-none tracking-tight text-gradient">Opening Performance</h3>
                  <p class="text-xs sm:text-sm text-muted-foreground mt-1">Your most played openings and their success rates</p>
                </div>
              </div>
            </div>
            <div class="p-4 sm:p-6 pt-2">
              <!-- Desktop Table View -->
              <div class="hidden sm:block overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="border-b border-border/30">
                      <th class="text-left py-3 px-4 font-semibold text-muted-foreground text-sm">Opening</th>
                      <th class="text-center py-3 px-4 font-semibold text-muted-foreground text-sm">Games</th>
                      <th class="text-center py-3 px-4 font-semibold text-muted-foreground text-sm">Win Rate</th>
                      <th class="text-center py-3 px-4 font-semibold text-muted-foreground text-sm">W/D/L</th>
                      <th class="text-right py-3 px-4 font-semibold text-muted-foreground text-sm">Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let opening of openingPerformance"
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
                      <td class="text-center py-3 px-4">
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

              <!-- Mobile Card View -->
              <div class="sm:hidden space-y-3">
                <div *ngFor="let opening of openingPerformance"
                     class="p-3 rounded-xl border border-border/30 hover:border-primary/30 transition-colors"
                     [ngClass]="{'bg-success/5 border-success/20': opening.winRate >= 60, 'bg-destructive/5 border-destructive/20': opening.winRate < 40}">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">{{ opening.ecoCode }}</span>
                      </div>
                      <p class="text-sm font-medium text-foreground truncate" [title]="opening.name">{{ opening.name }}</p>
                    </div>
                    <span class="text-xl font-bold ml-2"
                      [ngClass]="{'text-success': opening.winRate >= 60, 'text-destructive': opening.winRate < 40, 'text-foreground': opening.winRate >= 40 && opening.winRate < 60}">
                      {{ opening.winRate | number:'1.0-0' }}%
                    </span>
                  </div>
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-3">
                      <span class="text-muted-foreground">{{ opening.games }} games</span>
                      <span>
                        <span class="text-success font-medium">{{ opening.wins }}W</span>
                        <span class="text-muted-foreground mx-0.5">/</span>
                        <span class="text-muted-foreground">{{ opening.draws }}D</span>
                        <span class="text-muted-foreground mx-0.5">/</span>
                        <span class="text-destructive font-medium">{{ opening.losses }}L</span>
                      </span>
                    </div>
                  </div>
                  <div class="mt-2 w-full h-1.5 rounded-full bg-muted/30 overflow-hidden flex">
                    <div class="h-full bg-success" [style.width.%]="opening.winRate"></div>
                    <div class="h-full bg-muted-foreground" [style.width.%]="opening.drawRate"></div>
                    <div class="h-full bg-destructive" [style.width.%]="opening.lossRate"></div>
                  </div>
                </div>
              </div>

              <!-- Empty state for no openings -->
              <div *ngIf="openingPerformance.length === 0" class="text-center py-8">
                <p class="text-muted-foreground text-sm">No opening data available yet. Play more games to see your opening statistics.</p>
              </div>
            </div>
          </div>

          <!-- Tactical Opportunities Card (Phase 5) -->
          <div *ngIf="tacticalOpportunities && tacticalOpportunities.total > 0" class="group rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-xl sm:shadow-2xl hover:shadow-glow-accent hover:border-accent/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
            <div class="flex flex-col space-y-2 p-4 sm:p-6 bg-gradient-to-br from-accent/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors duration-300">
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg sm:text-xl font-bold leading-none tracking-tight text-gradient">Tactical Opportunities</h3>
                  <p class="text-xs sm:text-sm text-muted-foreground mt-1">Forks, pins, and other tactics you found vs missed</p>
                </div>
              </div>
            </div>
            <div class="p-4 sm:p-6 pt-2">
              <div class="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                <div class="p-2 sm:p-3 rounded-lg bg-success/10 border border-success/20 text-center">
                  <div class="text-xl sm:text-2xl font-bold text-success">{{ tacticalOpportunities.found }}</div>
                  <div class="text-xs text-muted-foreground">Found</div>
                </div>
                <div class="p-2 sm:p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                  <div class="text-xl sm:text-2xl font-bold text-destructive">{{ tacticalOpportunities.missed }}</div>
                  <div class="text-xs text-muted-foreground">Missed</div>
                </div>
                <div class="p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30 text-center">
                  <div class="text-xl sm:text-2xl font-bold text-foreground">{{ tacticalOpportunities.findRate }}%</div>
                  <div class="text-xs text-muted-foreground">Find Rate</div>
                </div>
              </div>
              <div class="space-y-2">
                <h4 class="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">By Type</h4>
                <div *ngFor="let type of getTacticTypes()" class="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                  <span class="text-xs sm:text-sm font-medium capitalize">{{ formatTheme(type) }}</span>
                  <div class="text-right">
                    <span class="text-xs sm:text-sm text-success font-medium">{{ tacticalOpportunities.byType[type].found }}</span>
                    <span class="text-xs text-muted-foreground mx-1">/</span>
                    <span class="text-xs sm:text-sm text-destructive font-medium">{{ tacticalOpportunities.byType[type].missed }}</span>
                    <span class="text-xs text-muted-foreground ml-2">({{ tacticalOpportunities.byType[type].findRate }}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Free Pieces Card (Phase 5) -->
          <div *ngIf="freePieces && freePieces.total > 0" class="group rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-xl sm:shadow-2xl hover:shadow-glow-success hover:border-success/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
            <div class="flex flex-col space-y-2 p-4 sm:p-6 bg-gradient-to-br from-success/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-success/10 group-hover:bg-success/20 transition-colors duration-300">
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg sm:text-xl font-bold leading-none tracking-tight text-gradient">Free Pieces</h3>
                  <p class="text-xs sm:text-sm text-muted-foreground mt-1">Opponent's hanging pieces you captured vs missed</p>
                </div>
              </div>
            </div>
            <div class="p-4 sm:p-6 pt-2">
              <div class="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                <div class="p-2 sm:p-3 rounded-lg bg-success/10 border border-success/20 text-center">
                  <div class="text-xl sm:text-2xl font-bold text-success">{{ freePieces.captured }}</div>
                  <div class="text-xs text-muted-foreground">Captured</div>
                </div>
                <div class="p-2 sm:p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                  <div class="text-xl sm:text-2xl font-bold text-destructive">{{ freePieces.missed }}</div>
                  <div class="text-xs text-muted-foreground">Missed</div>
                </div>
                <div class="p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30 text-center">
                  <div class="text-xl sm:text-2xl font-bold text-foreground">{{ freePieces.captureRate }}%</div>
                  <div class="text-xs text-muted-foreground">Capture Rate</div>
                </div>
              </div>
              <div class="space-y-2">
                <h4 class="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">By Piece</h4>
                <div *ngFor="let piece of getPieceTypes()" class="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                  <span class="text-xs sm:text-sm font-medium">{{ getPieceName(piece) }}</span>
                  <div class="text-right">
                    <span class="text-xs sm:text-sm text-success font-medium">{{ freePieces.byPiece[piece].captured }}</span>
                    <span class="text-xs text-muted-foreground mx-1">/</span>
                    <span class="text-xs sm:text-sm text-destructive font-medium">{{ freePieces.byPiece[piece].missed }}</span>
                    <span class="text-xs text-muted-foreground ml-2">({{ freePieces.byPiece[piece].captureRate }}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Data State -->
        <div *ngIf="!loading && !error && !accuracyByResult && !phaseDistribution && !accuracyByPhase && (!openingPerformance || openingPerformance.length === 0)"
             class="text-center py-12 sm:py-16 animate-fade-in">
          <div class="p-4 rounded-full bg-muted/30 w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 flex items-center justify-center">
            <svg class="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <h3 class="text-lg sm:text-xl font-bold text-foreground mb-2">No Insights Available</h3>
          <p class="text-sm text-muted-foreground">Upload and analyze some games to see your chess insights.</p>
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
  blunderData: BlunderDashboardData | null = null;
  tacticalOpportunities: TacticalOpportunitiesData | null = null;
  freePieces: FreePiecesData | null = null;

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
      openingPerformance: this.chessApi.getOpeningPerformance(10, color),
      blunderDashboard: this.chessApi.getBlundersDashboard(),
      tacticalOpportunities: this.chessApi.getTacticalOpportunities().pipe(catchError(() => of({ success: true, data: null }))),
      freePieces: this.chessApi.getFreePieces().pipe(catchError(() => of({ success: true, data: null })))
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
        if (results.blunderDashboard) {
          this.blunderData = results.blunderDashboard as BlunderDashboardData;
        }
        if (results.tacticalOpportunities?.success && results.tacticalOpportunities.data) {
          this.tacticalOpportunities = results.tacticalOpportunities.data;
        }
        if (results.freePieces?.success && results.freePieces.data) {
          this.freePieces = results.freePieces.data;
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

  formatTheme(theme: string): string {
    return theme.replace(/_/g, ' ');
  }

  getThemeColor(theme: string): string {
    const colors: { [key: string]: string } = {
      'hanging_piece': 'bg-red-500',
      'fork': 'bg-orange-500',
      'pin': 'bg-yellow-500',
      'skewer': 'bg-purple-500',
      'discovered_attack': 'bg-blue-500',
      'back_rank': 'bg-pink-500',
      'trapped_piece': 'bg-indigo-500',
      'overloaded_piece': 'bg-teal-500'
    };
    return colors[theme] || 'bg-gray-500';
  }

  getTacticTypes(): string[] {
    return this.tacticalOpportunities ? Object.keys(this.tacticalOpportunities.byType) : [];
  }

  getPieceTypes(): string[] {
    return this.freePieces ? Object.keys(this.freePieces.byPiece) : [];
  }

  getPieceName(piece: string): string {
    const names: { [key: string]: string } = { 'P': 'Pawn', 'N': 'Knight', 'B': 'Bishop', 'R': 'Rook', 'Q': 'Queen' };
    return names[piece] || piece;
  }
}
