import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ChessApiService } from '../../services/chess-api.service';
import { StatCardComponent } from '../../components/stat-card.component';
import { AlertTriangle, BarChart, TrendingDown, CheckCircle } from 'lucide-angular';

interface DashboardData {
  overview: {
    totalBlunders: number;
    avgCentipawnLoss: number;
    mostCostlyBlunder: {
      gameId: number;
      moveNumber: number;
      loss: number;
    } | null;
    trend: {
      lastMonth: number;
      previousMonth: number;
      change: string;
      improving: boolean;
    };
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
  topPatterns: Array<{
    description: string;
    occurrences: number;
    avgLoss: number;
    phase: string;
    theme: string;
    learned: boolean;
    learnedCount: number;
    lastOccurrence: string;
  }>;
  learningProgress: {
    learnedCount: number;
    unlearnedCount: number;
    totalCount: number;
    percentage: string;
    masteredThemes: string[];
    recommendations: Array<{
      theme: string;
      priority: number;
      reason: string;
    }>;
  };
  recentBlunders: Array<{
    id: number;
    gameId: number;
    moveNumber: number;
    phase: string;
    theme: string;
    playerMove: string;
    bestMove: string;
    centipawnLoss: number;
    date: string;
    opponent: string;
    event: string;
    learned: boolean;
  }>;
}

@Component({
  selector: 'app-blunders',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule, LayoutComponent, StatCardComponent],
  styles: [`
    .tooltip-wrapper {
      position: relative;
      display: inline-flex;
    }

    .tooltip-content {
      visibility: hidden;
      opacity: 0;
      position: absolute;
      z-index: 50;
      bottom: 125%;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgb(15, 23, 42);
      color: white;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      line-height: 1.25rem;
      width: max-content;
      max-width: 250px;
      text-align: center;
      transition: opacity 0.2s, visibility 0.2s;
      pointer-events: none;
    }

    .tooltip-content::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      margin-left: -5px;
      border-width: 5px;
      border-style: solid;
      border-color: rgb(15, 23, 42) transparent transparent transparent;
    }

    .tooltip-wrapper:hover .tooltip-content,
    .tooltip-wrapper.active .tooltip-content {
      visibility: visible;
      opacity: 1;
    }

    @media (max-width: 768px) {
      .tooltip-content {
        max-width: 200px;
        font-size: 0.7rem;
      }
    }
  `],
  template: `
    <app-layout>
      <div class="space-y-6 sm:space-y-8 pb-8">
        <!-- Header -->
        <div class="animate-fade-in">
          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gradient tracking-tight mb-2">Blunder Analysis Dashboard</h1>
          <p class="text-sm sm:text-base text-muted-foreground">Identify patterns and improve your chess</p>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="flex flex-col justify-center items-center py-12 sm:py-16 animate-fade-in">
          <div class="relative">
            <div class="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <div class="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-transparent border-t-accent rounded-full animate-spin" style="animation-duration: 1.5s;"></div>
          </div>
          <p class="mt-6 text-sm font-medium text-muted-foreground">Loading dashboard data...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="error && !loading" class="rounded-xl sm:rounded-2xl border-2 border-destructive/30 bg-gradient-to-br from-destructive/10 to-destructive/5 p-4 sm:p-6 shadow-xl animate-slide-up">
          <div class="flex items-start gap-3 sm:gap-4">
            <div class="flex-shrink-0 p-2 rounded-lg bg-destructive/20">
              <svg class="w-5 h-5 sm:w-6 sm:h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-base sm:text-lg font-bold text-destructive mb-1">Error Loading Dashboard</h3>
              <p class="text-sm text-foreground/80">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!loading && !error && dashboardData && dashboardData.overview.totalBlunders === 0" class="text-center py-12 sm:py-16 animate-fade-in">
          <div class="rounded-2xl border-2 border-border/30 bg-gradient-to-br from-success/10 to-success/5 backdrop-blur-sm p-8 sm:p-12 max-w-md mx-auto shadow-xl">
            <svg class="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="text-lg sm:text-xl font-bold text-success mb-2">No blunders found</p>
            <p class="text-sm text-muted-foreground">Great job! Keep up the excellent play.</p>
          </div>
        </div>

        <!-- Dashboard Content -->
        <div *ngIf="!loading && !error && dashboardData && dashboardData.overview.totalBlunders > 0" class="space-y-6">

          <!-- Overview Statistics Cards -->
          <div class="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 animate-slide-up">
            <div class="group">
              <app-stat-card
                title="Total Blunders"
                [value]="dashboardData.overview.totalBlunders"
                [icon]="AlertTriangle"
                [subtitle]="getTrendText()"
                [trend]="getTrend()"
                variant="warning"
                class="transform transition-all duration-300 sm:hover:scale-105 sm:hover:-translate-y-1">
              </app-stat-card>
            </div>

            <div class="group">
              <app-stat-card
                title="Avg CP Loss"
                [value]="dashboardData.overview.avgCentipawnLoss"
                [icon]="BarChart"
                subtitle="Per blunder"
                variant="default"
                class="transform transition-all duration-300 sm:hover:scale-105 sm:hover:-translate-y-1">
              </app-stat-card>
            </div>

            <a *ngIf="dashboardData.overview.mostCostlyBlunder"
               [routerLink]="['/games', dashboardData.overview.mostCostlyBlunder.gameId]"
               [queryParams]="{move: dashboardData.overview.mostCostlyBlunder.moveNumber}"
               class="block group transform transition-all duration-300 sm:hover:scale-105 sm:hover:-translate-y-1">
              <app-stat-card
                title="Worst Blunder"
                [value]="dashboardData.overview.mostCostlyBlunder.loss"
                [icon]="TrendingDown"
                [subtitle]="getWorstBlunderSubtitle()"
                variant="destructive">
              </app-stat-card>
            </a>
            <div *ngIf="!dashboardData.overview.mostCostlyBlunder" class="group">
              <app-stat-card
                title="Worst Blunder"
                [value]="0"
                [icon]="TrendingDown"
                subtitle="No data"
                variant="destructive"
                class="transform transition-all duration-300 sm:hover:scale-105 sm:hover:-translate-y-1">
              </app-stat-card>
            </div>

            <div class="group">
              <app-stat-card
                title="Learned"
                [value]="dashboardData.learningProgress.percentage + '%'"
                [icon]="CheckCircle"
                [subtitle]="getLearningProgressSubtitle()"
                variant="success"
                class="transform transition-all duration-300 sm:hover:scale-105 sm:hover:-translate-y-1">
              </app-stat-card>
            </div>
          </div>

          <!-- Charts Row -->
          <div class="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 animate-slide-up" style="animation-delay: 0.1s;">
            <!-- Phase Distribution -->
            <div class="group rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl hover:shadow-glow-primary hover:border-primary/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
              <div class="p-4 sm:p-6 bg-gradient-to-br from-primary/5 to-transparent">
                <div class="flex items-center gap-2 mb-4">
                  <h3 class="text-lg sm:text-xl font-bold text-gradient">Blunders by Game Phase</h3>
                  <div class="tooltip-wrapper" (click)="toggleTooltip($event)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground cursor-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="16" x2="12" y2="12"/>
                      <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <div class="tooltip-content">Distribution of blunders across game phases. Opening (first 10-15 moves), Middlegame (complex positions), Endgame (fewer pieces).</div>
                  </div>
                </div>
                <div class="space-y-3">
                  <div>
                    <div class="flex items-center justify-between text-sm mb-1">
                      <span class="text-muted-foreground">Opening</span>
                      <span class="font-medium">{{ dashboardData.byPhase.opening.count }} ({{ dashboardData.byPhase.opening.percentage }}%)</span>
                    </div>
                    <div class="w-full bg-secondary rounded-full h-2">
                      <div class="bg-blue-500 h-2 rounded-full transition-all" [style.width]="dashboardData.byPhase.opening.percentage + '%'"></div>
                    </div>
                    <p class="text-xs text-muted-foreground mt-1">Avg: {{ dashboardData.byPhase.opening.avgLoss }} CP</p>
                  </div>
                  <div>
                    <div class="flex items-center justify-between text-sm mb-1">
                      <span class="text-muted-foreground">Middlegame</span>
                      <span class="font-medium">{{ dashboardData.byPhase.middlegame.count }} ({{ dashboardData.byPhase.middlegame.percentage }}%)</span>
                    </div>
                    <div class="w-full bg-secondary rounded-full h-2">
                      <div class="bg-purple-500 h-2 rounded-full transition-all" [style.width]="dashboardData.byPhase.middlegame.percentage + '%'"></div>
                    </div>
                    <p class="text-xs text-muted-foreground mt-1">Avg: {{ dashboardData.byPhase.middlegame.avgLoss }} CP</p>
                  </div>
                  <div>
                    <div class="flex items-center justify-between text-sm mb-1">
                      <span class="text-muted-foreground">Endgame</span>
                      <span class="font-medium">{{ dashboardData.byPhase.endgame.count }} ({{ dashboardData.byPhase.endgame.percentage }}%)</span>
                    </div>
                    <div class="w-full bg-secondary rounded-full h-2">
                      <div class="bg-green-500 h-2 rounded-full transition-all" [style.width]="dashboardData.byPhase.endgame.percentage + '%'"></div>
                    </div>
                    <p class="text-xs text-muted-foreground mt-1">Avg: {{ dashboardData.byPhase.endgame.avgLoss }} CP</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Theme Distribution -->
            <div class="group rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl hover:shadow-glow-accent hover:border-accent/50 transition-all duration-500 backdrop-blur-sm overflow-hidden">
              <div class="p-4 sm:p-6 bg-gradient-to-br from-accent/5 to-transparent">
                <div class="flex items-center gap-2 mb-4">
                  <h3 class="text-lg sm:text-xl font-bold text-gradient">Top Tactical Themes</h3>
                  <div class="tooltip-wrapper" (click)="toggleTooltip($event)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground cursor-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="16" x2="12" y2="12"/>
                      <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <div class="tooltip-content">Most common tactical patterns in your blunders. Examples: hanging pieces, missed forks, pins, skewers. Focus on the top themes for improvement.</div>
                  </div>
                </div>
                <div class="space-y-3">
                  <div *ngFor="let theme of dashboardData.byTheme.slice(0, 5)">
                    <div class="flex items-center justify-between text-sm mb-1">
                      <span class="text-muted-foreground capitalize">{{ formatTheme(theme.theme) }}</span>
                      <span class="font-medium">{{ theme.count }} ({{ theme.percentage }}%)</span>
                    </div>
                    <div class="w-full bg-secondary rounded-full h-2">
                      <div class="bg-orange-500 h-2 rounded-full transition-all" [style.width]="theme.percentage + '%'"></div>
                    </div>
                    <p class="text-xs text-muted-foreground mt-1">Avg: {{ theme.avgLoss }} CP</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Patterns Table -->
          <div class="rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl hover:shadow-glow-success hover:border-success/50 transition-all duration-500 backdrop-blur-sm overflow-hidden animate-slide-up" style="animation-delay: 0.2s;">
            <div class="p-4 sm:p-6 bg-gradient-to-br from-success/5 to-transparent">
              <h3 class="text-lg sm:text-xl font-bold text-gradient mb-4">Top Patterns to Study</h3>
              <div class="relative w-full overflow-auto">
                <table class="w-full caption-bottom text-xs sm:text-sm">
                  <thead class="[&_tr]:border-b">
                    <tr class="border-b transition-colors hover:bg-muted/50">
                      <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Pattern</th>
                      <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Occurrences</th>
                      <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Avg Loss</th>
                      <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody class="[&_tr:last-child]:border-0">
                    <tr *ngFor="let pattern of dashboardData.topPatterns" class="border-b transition-colors hover:bg-muted/50">
                      <td class="p-4 align-middle">
                        <div>
                          <div class="font-medium capitalize">{{ pattern.description }}</div>
                          <div class="text-xs text-muted-foreground mt-1">{{ formatDate(pattern.lastOccurrence) }}</div>
                        </div>
                      </td>
                      <td class="p-4 align-middle">{{ pattern.occurrences }}</td>
                      <td class="p-4 align-middle">
                        <span [class]="getSeverityClass(pattern.avgLoss)">{{ pattern.avgLoss }} CP</span>
                      </td>
                      <td class="p-4 align-middle">
                        <span *ngIf="pattern.learned" class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-green-100 text-green-800">
                          ✓ Mastered
                        </span>
                        <span *ngIf="!pattern.learned" class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-yellow-100 text-yellow-800">
                          📚 Study ({{ pattern.learnedCount}}/{{ pattern.occurrences }})
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Recent Blunders -->
          <div class="rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl hover:shadow-glow-accent hover:border-accent/50 transition-all duration-500 backdrop-blur-sm overflow-hidden animate-slide-up" style="animation-delay: 0.3s;">
            <div class="p-4 sm:p-6 bg-gradient-to-br from-accent/5 to-transparent">
              <h3 class="text-lg sm:text-xl font-bold text-gradient mb-4">Recent Blunders</h3>
              <div class="space-y-2 sm:space-y-3">
                <div *ngFor="let blunder of dashboardData.recentBlunders.slice(0, 10)"
                     class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-xl border-2 border-border/30 bg-card/50 hover:bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300 cursor-pointer"
                     [routerLink]="['/games', blunder.gameId]">
                  <div class="flex-1 w-full sm:w-auto">
                    <div class="flex flex-wrap items-center gap-2 mb-2">
                      <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize shadow-md"
                            [class]="getPhaseClass(blunder.phase)">
                        {{ blunder.phase }}
                      </span>
                      <span class="text-sm font-bold text-foreground">Move {{ blunder.moveNumber }}</span>
                      <span class="text-xs text-muted-foreground font-medium">vs {{ blunder.opponent }}</span>
                    </div>
                    <div class="text-xs text-muted-foreground font-medium bg-muted/30 rounded-lg p-2">
                      <span class="font-semibold text-destructive">Played:</span> {{ blunder.playerMove }} 
                      <span class="mx-1">|</span> 
                      <span class="font-semibold text-success">Best:</span> {{ blunder.bestMove }}
                    </div>
                  </div>
                  <div class="text-left sm:text-right mt-2 sm:mt-0 flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                    <div [class]="getSeverityClass(blunder.centipawnLoss)" class="font-bold text-base sm:text-lg">
                      -{{ blunder.centipawnLoss }} CP
                    </div>
                    <div class="text-xs text-muted-foreground font-medium">{{ formatDate(blunder.date) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </app-layout>
  `
})
export class BlundersComponent implements OnInit {
  dashboardData: DashboardData | null = null;
  loading = true;
  error: string | null = null;
  Math = Math;
  parseFloat = parseFloat;

  // Lucide icons for stat cards
  AlertTriangle = AlertTriangle;
  BarChart = BarChart;
  TrendingDown = TrendingDown;
  CheckCircle = CheckCircle;

  constructor(private apiService: ChessApiService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;

    this.apiService.getBlundersDashboard().subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load dashboard data';
        this.loading = false;
        console.error('Error loading blunders dashboard:', err);
      }
    });
  }

  getTrendText(): string {
    if (!this.dashboardData) return '';
    const improving = this.dashboardData.overview.trend.improving;
    const change = Math.abs(parseFloat(this.dashboardData.overview.trend.change));
    return `${improving ? '↓' : '↑'} ${change}% vs last month`;
  }

  getTrend(): { value: number; isPositive: boolean } | undefined {
    if (!this.dashboardData) return undefined;
    return {
      value: Math.abs(parseFloat(this.dashboardData.overview.trend.change)),
      isPositive: this.dashboardData.overview.trend.improving
    };
  }

  getWorstBlunderSubtitle(): string {
    if (!this.dashboardData || !this.dashboardData.overview.mostCostlyBlunder) {
      return 'No data';
    }
    return `Move ${this.dashboardData.overview.mostCostlyBlunder.moveNumber} →`;
  }

  getLearningProgressSubtitle(): string {
    if (!this.dashboardData) return '';
    return `${this.dashboardData.learningProgress.learnedCount} / ${this.dashboardData.learningProgress.totalCount} mastered`;
  }

  formatTheme(theme: string): string {
    return theme.replace(/_/g, ' ');
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  }

  getSeverityClass(cpLoss: number): string {
    if (cpLoss >= 500) return 'text-red-600 font-semibold';
    if (cpLoss >= 300) return 'text-orange-600 font-medium';
    if (cpLoss >= 150) return 'text-yellow-600';
    return 'text-muted-foreground';
  }

  getPhaseClass(phase: string): string {
    const classes = {
      'opening': 'bg-blue-100 text-blue-800',
      'middlegame': 'bg-purple-100 text-purple-800',
      'endgame': 'bg-green-100 text-green-800'
    };
    return classes[phase as keyof typeof classes] || 'bg-gray-100 text-gray-800';
  }

  toggleTooltip(event: Event): void {
    const wrapper = (event.currentTarget as HTMLElement);
    const isActive = wrapper.classList.contains('active');

    // Remove active class from all tooltips
    document.querySelectorAll('.tooltip-wrapper.active').forEach(el => {
      el.classList.remove('active');
    });

    // Toggle active class on clicked tooltip
    if (!isActive) {
      wrapper.classList.add('active');

      // Auto-hide after 3 seconds
      setTimeout(() => {
        wrapper.classList.remove('active');
      }, 3000);
    }
  }
}
