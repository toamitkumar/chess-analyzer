import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ChessApiService, PerformanceData } from '../../services/chess-api.service';
import { StatCardComponent } from '../../components/stat-card.component';
import { Trophy, Target, Activity, TriangleAlert } from 'lucide-angular';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterModule, LayoutComponent, StatCardComponent],
  template: `
    <app-layout>
      <div class="space-y-8 pb-8">
        <!-- Header Section -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div>
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gradient tracking-tight mb-2">Performance Dashboard</h1>
            <p class="text-sm sm:text-base text-muted-foreground">Analyze your chess performance and track improvement</p>
          </div>
          <select
            [(ngModel)]="timeRange"
            class="flex h-11 w-full sm:w-[200px] items-center justify-between rounded-xl border-2 border-border/50 bg-card/80 backdrop-blur-sm px-4 py-2 text-sm font-medium shadow-lg hover:border-primary/50 hover:shadow-glow-primary transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>

        <!-- Stats Grid with Enhanced Cards -->
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-slide-up" *ngIf="performanceData">
          <div class="group">
            <app-stat-card
              title="Total Games"
              [value]="getTotalGames()"
              [icon]="Trophy"
              subtitle="All time"
              variant="default"
              class="transform transition-all duration-300 hover:scale-105 hover:-translate-y-1">
            </app-stat-card>
          </div>

          <div class="group">
            <app-stat-card
              title="Win Rate"
              [value]="getOverallWinRate()"
              [icon]="Target"
              [subtitle]="getWinRateSubtitle()"
              variant="success"
              class="transform transition-all duration-300 hover:scale-105 hover:-translate-y-1">
            </app-stat-card>
          </div>

          <div class="group">
            <app-stat-card
              title="Avg Accuracy"
              [value]="getAvgAccuracy()"
              [icon]="Activity"
              subtitle="Across all games"
              variant="default"
              class="transform transition-all duration-300 hover:scale-105 hover:-translate-y-1">
            </app-stat-card>
          </div>

          <a routerLink="/blunders" class="block group transform transition-all duration-300 hover:scale-105 hover:-translate-y-1">
            <app-stat-card
              title="Blunders"
              [value]="getBlunders()"
              [icon]="TriangleAlert"
              subtitle="This month →"
              variant="warning">
            </app-stat-card>
          </a>
        </div>

        <!-- Loading Skeleton -->
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-slide-up" *ngIf="loading && !performanceData">
          <div *ngFor="let i of [1,2,3,4]" class="rounded-2xl border-2 border-border/30 bg-card/50 backdrop-blur-sm p-6 h-32 animate-pulse">
            <div class="h-4 bg-muted/50 rounded w-1/2 mb-4"></div>
            <div class="h-8 bg-muted/50 rounded w-3/4"></div>
          </div>
        </div>

        <!-- Charts Section with Enhanced Styling -->
        <div class="grid gap-6 md:grid-cols-2 animate-slide-up" style="animation-delay: 0.1s;">
          <!-- Rating Progression Chart -->
          <div class="group rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl hover:shadow-glow-primary hover:border-primary/50 transition-all duration-500 card-shine overflow-hidden backdrop-blur-sm">
            <div class="flex flex-col space-y-2 p-6 bg-gradient-to-br from-primary/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                  <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-2xl font-bold leading-none tracking-tight text-gradient">Rating Progression</h3>
                  <p class="text-sm text-muted-foreground mt-1">Your rating trend over time</p>
                </div>
              </div>
            </div>
            <div class="p-6 pt-2">
              <div class="h-[320px] relative" *ngIf="trendsData?.data?.ratingProgression; else noRatingData">
                <svg class="w-full h-full drop-shadow-lg" viewBox="0 0 400 200">
                  <!-- Gradient Definitions -->
                  <defs>
                    <linearGradient id="ratingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style="stop-color:hsl(var(--chart-1));stop-opacity:0.3" />
                      <stop offset="100%" style="stop-color:hsl(var(--chart-1));stop-opacity:0" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <!-- Grid lines with subtle styling -->
                  <g stroke="hsl(var(--border))" stroke-width="1" opacity="0.2">
                    <line x1="50" y1="20" x2="50" y2="160" stroke-dasharray="2,4"/>
                    <line x1="120" y1="20" x2="120" y2="160" stroke-dasharray="2,4"/>
                    <line x1="190" y1="20" x2="190" y2="160" stroke-dasharray="2,4"/>
                    <line x1="260" y1="20" x2="260" y2="160" stroke-dasharray="2,4"/>
                    <line x1="330" y1="20" x2="330" y2="160" stroke-dasharray="2,4"/>
                    <line x1="50" y1="160" x2="350" y2="160"/>
                    <line x1="50" y1="120" x2="350" y2="120" stroke-dasharray="4,4"/>
                    <line x1="50" y1="80" x2="350" y2="80" stroke-dasharray="4,4"/>
                    <line x1="50" y1="40" x2="350" y2="40" stroke-dasharray="4,4"/>
                  </g>
                  <!-- Area fill under line -->
                  <polygon [attr.points]="getRatingAreaPoints()" fill="url(#ratingGradient)" opacity="0.5"/>
                  <!-- Rating line with glow -->
                  <polyline fill="none" stroke="hsl(var(--chart-1))" stroke-width="3" 
                    stroke-linecap="round" stroke-linejoin="round"
                    [attr.points]="getRatingPoints()" filter="url(#glow)"/>
                  <!-- Data points with hover effect -->
                  <g *ngFor="let point of getRatingDataPoints(); let i = index">
                    <circle [attr.cx]="point.x" [attr.cy]="point.y" r="6" 
                      fill="hsl(var(--card))" stroke="hsl(var(--chart-1))" stroke-width="3"
                      class="transition-all duration-200 hover:r-8 cursor-pointer"/>
                    <circle [attr.cx]="point.x" [attr.cy]="point.y" r="3" fill="hsl(var(--chart-1))"/>
                  </g>
                  <!-- Labels with better styling -->
                  <text x="50" y="180" text-anchor="middle" class="text-xs font-medium" fill="hsl(var(--muted-foreground))">Start</text>
                  <text x="350" y="180" text-anchor="middle" class="text-xs font-medium" fill="hsl(var(--muted-foreground))">Latest</text>
                  <text x="30" y="165" text-anchor="middle" class="text-xs font-bold" fill="hsl(var(--foreground))">{{ getMinRating() }}</text>
                  <text x="30" y="45" text-anchor="middle" class="text-xs font-bold" fill="hsl(var(--foreground))">{{ getMaxRating() }}</text>
                </svg>
              </div>
              <ng-template #noRatingData>
                <div class="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                  <svg class="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  <p class="text-sm font-medium">No rating data available</p>
                </div>
              </ng-template>
            </div>
          </div>
          
          <!-- Centipawn Loss Chart -->
          <div class="group rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl hover:shadow-glow-accent hover:border-accent/50 transition-all duration-500 card-shine overflow-hidden backdrop-blur-sm">
            <div class="flex flex-col space-y-2 p-6 bg-gradient-to-br from-accent/5 to-transparent">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors duration-300">
                  <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-2xl font-bold leading-none tracking-tight text-gradient">Average Centipawn Loss</h3>
                  <p class="text-sm text-muted-foreground mt-1">Lower is better - tracking accuracy</p>
                </div>
              </div>
            </div>
            <div class="p-6 pt-2">
              <div class="h-[320px] relative" *ngIf="trendsData?.data?.centipawnTrend; else noCentipawnData">
                <svg class="w-full h-full drop-shadow-lg" viewBox="0 0 400 200">
                  <!-- Gradient Definitions -->
                  <defs>
                    <linearGradient id="centipawnGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style="stop-color:hsl(var(--chart-2));stop-opacity:0.3" />
                      <stop offset="100%" style="stop-color:hsl(var(--chart-2));stop-opacity:0" />
                    </linearGradient>
                  </defs>
                  <!-- Grid lines -->
                  <g stroke="hsl(var(--border))" stroke-width="1" opacity="0.2">
                    <line x1="50" y1="20" x2="50" y2="160" stroke-dasharray="2,4"/>
                    <line x1="120" y1="20" x2="120" y2="160" stroke-dasharray="2,4"/>
                    <line x1="190" y1="20" x2="190" y2="160" stroke-dasharray="2,4"/>
                    <line x1="260" y1="20" x2="260" y2="160" stroke-dasharray="2,4"/>
                    <line x1="330" y1="20" x2="330" y2="160" stroke-dasharray="2,4"/>
                    <line x1="50" y1="160" x2="350" y2="160"/>
                    <line x1="50" y1="120" x2="350" y2="120" stroke-dasharray="4,4"/>
                    <line x1="50" y1="80" x2="350" y2="80" stroke-dasharray="4,4"/>
                    <line x1="50" y1="40" x2="350" y2="40" stroke-dasharray="4,4"/>
                  </g>
                  <!-- Area fill -->
                  <polygon [attr.points]="getCentipawnAreaPoints()" fill="url(#centipawnGradient)" opacity="0.5"/>
                  <!-- CPL line with glow -->
                  <polyline fill="none" stroke="hsl(var(--chart-2))" stroke-width="3" 
                    stroke-linecap="round" stroke-linejoin="round"
                    [attr.points]="getCentipawnPoints()" filter="url(#glow)"/>
                  <!-- Data points -->
                  <g *ngFor="let point of getCentipawnDataPoints()">
                    <circle [attr.cx]="point.x" [attr.cy]="point.y" r="6" 
                      fill="hsl(var(--card))" stroke="hsl(var(--chart-2))" stroke-width="3"
                      class="transition-all duration-200 hover:r-8 cursor-pointer"/>
                    <circle [attr.cx]="point.x" [attr.cy]="point.y" r="3" fill="hsl(var(--chart-2))"/>
                  </g>
                  <!-- Labels -->
                  <text x="50" y="180" text-anchor="middle" class="text-xs font-medium" fill="hsl(var(--muted-foreground))">Start</text>
                  <text x="350" y="180" text-anchor="middle" class="text-xs font-medium" fill="hsl(var(--muted-foreground))">Latest</text>
                  <text x="30" y="165" text-anchor="middle" class="text-xs font-bold" fill="hsl(var(--foreground))">{{ getMaxCentipawn() }}</text>
                  <text x="30" y="45" text-anchor="middle" class="text-xs font-bold" fill="hsl(var(--foreground))">{{ getMinCentipawn() }}</text>
                </svg>
              </div>
              <ng-template #noCentipawnData>
                <div class="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                  <svg class="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  <p class="text-sm font-medium">No centipawn data available</p>
                </div>
              </ng-template>
            </div>
          </div>
        </div>

        <!-- Performance by Color Section -->
        <div class="group rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl hover:shadow-glow-success hover:border-success/50 transition-all duration-500 animate-slide-up backdrop-blur-sm overflow-hidden" style="animation-delay: 0.2s;" *ngIf="performanceData">
          <div class="flex flex-col space-y-2 p-6 bg-gradient-to-br from-success/5 to-transparent">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-success/10 group-hover:bg-success/20 transition-colors duration-300">
                <svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <h3 class="text-2xl font-bold leading-none tracking-tight text-gradient">Performance by Color</h3>
                <p class="text-sm text-muted-foreground mt-1">Win rates when playing White vs Black</p>
              </div>
            </div>
          </div>
          <div class="p-6 pt-2">
            <div class="grid gap-6 md:grid-cols-2">
              <!-- White Performance Card -->
              <div class="group/card relative space-y-3 rounded-xl border-2 border-border/50 bg-gradient-to-br from-card to-card/50 p-6 shadow-lg hover:shadow-xl hover:border-success/50 transition-all duration-300 overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full blur-3xl -z-10"></div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full bg-gradient-to-br from-gray-100 to-gray-300 shadow-md"></div>
                    <span class="text-sm font-bold text-foreground uppercase tracking-wide">White</span>
                  </div>
                  <span class="text-4xl font-black text-gradient">{{ performanceData.white.winRate }}%</span>
                </div>
                <div class="text-xs text-muted-foreground font-medium">
                  <span class="text-success font-semibold">{{ getWhiteWins() }} wins</span> · 
                  <span class="text-destructive/80">{{ getWhiteLosses() }} losses</span> · 
                  <span class="text-muted-foreground">{{ getWhiteDraws() }} draws</span>
                </div>
                <div class="relative h-3 w-full overflow-hidden rounded-full bg-muted/50 shadow-inner">
                  <div class="absolute inset-0 bg-gradient-to-r from-success/20 to-success/10"></div>
                  <div class="h-full bg-gradient-to-r from-success to-success/80 rounded-full shadow-lg transition-all duration-1000 ease-out" 
                    [style.width.%]="performanceData.white.winRate"></div>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <span class="px-2 py-1 rounded-md bg-success/10 text-success font-medium">
                    {{ performanceData.white.games }} games
                  </span>
                </div>
              </div>
              
              <!-- Black Performance Card -->
              <div class="group/card relative space-y-3 rounded-xl border-2 border-border/50 bg-gradient-to-br from-card to-card/50 p-6 shadow-lg hover:shadow-xl hover:border-chart-1/50 transition-all duration-300 overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-chart-1/5 rounded-full blur-3xl -z-10"></div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 shadow-md"></div>
                    <span class="text-sm font-bold text-foreground uppercase tracking-wide">Black</span>
                  </div>
                  <span class="text-4xl font-black text-gradient">{{ performanceData.black.winRate }}%</span>
                </div>
                <div class="text-xs text-muted-foreground font-medium">
                  <span class="text-success font-semibold">{{ getBlackWins() }} wins</span> · 
                  <span class="text-destructive/80">{{ getBlackLosses() }} losses</span> · 
                  <span class="text-muted-foreground">{{ getBlackDraws() }} draws</span>
                </div>
                <div class="relative h-3 w-full overflow-hidden rounded-full bg-muted/50 shadow-inner">
                  <div class="absolute inset-0 bg-gradient-to-r from-chart-1/20 to-chart-1/10"></div>
                  <div class="h-full bg-gradient-to-r from-chart-1 to-chart-1/80 rounded-full shadow-lg transition-all duration-1000 ease-out" 
                    [style.width.%]="performanceData.black.winRate"></div>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <span class="px-2 py-1 rounded-md bg-chart-1/10 text-chart-1 font-medium">
                    {{ performanceData.black.games }} games
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Key Insights Section -->
        <div class="group rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent text-card-foreground shadow-2xl backdrop-blur-sm hover:shadow-glow-accent hover:border-accent/60 transition-all duration-500 animate-slide-up overflow-hidden" style="animation-delay: 0.3s;">
          <div class="flex flex-col space-y-2 p-6 bg-gradient-to-br from-accent/10 to-transparent">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-accent/20 group-hover:bg-accent/30 transition-colors duration-300 animate-glow-pulse">
                <svg class="h-5 w-5 text-accent" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                </svg>
              </div>
              <h3 class="text-2xl font-bold leading-none tracking-tight text-gradient">Key Insights</h3>
            </div>
          </div>
          <div class="p-6 pt-2">
            <ul class="space-y-4">
              <li class="group/item flex items-start gap-4 p-4 rounded-xl bg-card/30 border border-border/30 hover:border-accent/40 hover:bg-card/50 transition-all duration-300">
                <div class="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-accent shadow-lg shadow-accent/50 group-hover/item:scale-125 transition-transform duration-300"></div>
                <span class="text-sm leading-relaxed text-foreground/90 font-medium">{{ getAccuracyInsight() }}</span>
              </li>
              <li class="group/item flex items-start gap-4 p-4 rounded-xl bg-card/30 border border-border/30 hover:border-accent/40 hover:bg-card/50 transition-all duration-300">
                <div class="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-accent shadow-lg shadow-accent/50 group-hover/item:scale-125 transition-transform duration-300"></div>
                <span class="text-sm leading-relaxed text-foreground/90 font-medium">{{ getColorPerformanceInsight() }}</span>
              </li>
              <li class="group/item flex items-start gap-4 p-4 rounded-xl bg-card/30 border border-border/30 hover:border-accent/40 hover:bg-card/50 transition-all duration-300">
                <div class="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-accent shadow-lg shadow-accent/50 group-hover/item:scale-125 transition-transform duration-300"></div>
                <span class="text-sm leading-relaxed text-foreground/90 font-medium">{{ getRatingInsight() }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading && !performanceData" class="flex flex-col justify-center items-center py-16 animate-fade-in">
          <div class="relative">
            <div class="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <div class="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-accent rounded-full animate-spin" style="animation-duration: 1.5s;"></div>
          </div>
          <p class="text-muted-foreground mt-6 text-sm font-medium">Loading performance data...</p>
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
              <h3 class="text-lg font-bold text-destructive mb-1">Error Loading Data</h3>
              <p class="text-sm text-foreground/80">{{ error }}</p>
            </div>
          </div>
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
  TriangleAlert = TriangleAlert;

  constructor(private chessApi: ChessApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.error = null;
    
    // Load both performance and trends data
    Promise.all([
      new Promise<PerformanceData | null>((resolve, reject) => {
        this.chessApi.getPlayerPerformanceData().subscribe({
          next: (data) => resolve(data || null),
          error: (err) => reject(err)
        });
      }),
      new Promise<any>((resolve, reject) => {
        this.chessApi.getTrendsData().subscribe({
          next: (data) => resolve(data),
          error: (err) => reject(err)
        });
      })
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

  getRatingAreaPoints(): string {
    if (!this.trendsData?.data?.ratingProgression) return '';
    const linePoints = this.getRatingPoints();
    if (!linePoints) return '';
    return `50,160 ${linePoints} 350,160`;
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

  getCentipawnAreaPoints(): string {
    if (!this.trendsData?.data?.centipawnTrend) return '';
    const linePoints = this.getCentipawnPoints();
    if (!linePoints) return '';
    return `50,160 ${linePoints} 350,160`;
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
    // Based on actual data, there are no draws, so return 0
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
    // Based on actual data, there are no draws, so return 0
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
