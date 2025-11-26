import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ChessApiService } from '../../services/chess-api.service';

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
  imports: [CommonModule, RouterModule, HttpClientModule, LayoutComponent],
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
      <div class="space-y-6">
        <!-- Header -->
        <div>
          <h1 class="text-3xl font-bold text-foreground">Blunder Analysis Dashboard</h1>
          <p class="text-muted-foreground">Identify patterns and improve your chess</p>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="flex items-center justify-center py-12">
          <div class="text-center">
            <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
            <p class="mt-2 text-sm text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>

        <!-- Error State -->
        <div *ngIf="error && !loading" class="rounded-lg border border-red-200 bg-red-50 p-4">
          <div class="text-red-800">Error loading dashboard: {{ error }}</div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!loading && !error && dashboardData && dashboardData.overview.totalBlunders === 0" class="text-center py-12">
          <div class="text-muted-foreground">
            <p class="text-lg font-medium">No blunders found</p>
            <p class="text-sm mt-2">Great job! Keep up the excellent play.</p>
          </div>
        </div>

        <!-- Dashboard Content -->
        <div *ngIf="!loading && !error && dashboardData && dashboardData.overview.totalBlunders > 0" class="space-y-6">

          <!-- Overview Statistics Cards -->
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <!-- Total Blunders Card -->
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div class="p-6">
                <div class="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-medium text-muted-foreground">Total Blunders</h3>
                    <div class="tooltip-wrapper" (click)="toggleTooltip($event)">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-muted-foreground cursor-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                      <div class="tooltip-content">Critical moves with 300+ centipawn loss. Trend compares last 30 days vs previous 30 days.</div>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div class="pt-2">
                  <div class="text-2xl font-bold">{{ dashboardData.overview.totalBlunders }}</div>
                  <p class="text-xs text-muted-foreground mt-1">
                    <span [class]="dashboardData.overview.trend.improving ? 'text-green-600' : 'text-red-600'">
                      {{ dashboardData.overview.trend.improving ? '↓' : '↑' }} {{ Math.abs(parseFloat(dashboardData.overview.trend.change)) }}%
                    </span>
                    vs last month
                  </p>
                </div>
              </div>
            </div>

            <!-- Avg Centipawn Loss Card -->
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div class="p-6">
                <div class="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-medium text-muted-foreground">Avg CP Loss</h3>
                    <div class="tooltip-wrapper" (click)="toggleTooltip($event)">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-muted-foreground cursor-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                      <div class="tooltip-content">Average centipawn loss per blunder. Lower is better. (100 centipawns = 1 pawn of material value)</div>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="20" x2="12" y2="10"/>
                    <line x1="18" y1="20" x2="18" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="16"/>
                  </svg>
                </div>
                <div class="pt-2">
                  <div class="text-2xl font-bold">{{ dashboardData.overview.avgCentipawnLoss }}</div>
                  <p class="text-xs text-muted-foreground mt-1">Per blunder</p>
                </div>
              </div>
            </div>

            <!-- Most Costly Blunder Card -->
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div class="p-6">
                <div class="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-medium text-muted-foreground">Worst Blunder</h3>
                    <div class="tooltip-wrapper" (click)="toggleTooltip($event)">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-muted-foreground cursor-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                      <div class="tooltip-content">Your most costly blunder by centipawn loss. This represents how much evaluation dropped (e.g., 402 = lost 4 pawns of advantage in one move).</div>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <path d="M12 9v4"/>
                    <path d="M12 17h.01"/>
                  </svg>
                </div>
                <div class="pt-2">
                  <div class="text-2xl font-bold text-red-600">{{ dashboardData.overview.mostCostlyBlunder?.loss || 0 }}</div>
                  <p class="text-xs text-muted-foreground mt-1" *ngIf="dashboardData.overview.mostCostlyBlunder">
                    <a [routerLink]="['/games', dashboardData.overview.mostCostlyBlunder.gameId]" class="hover:underline">
                      Move {{ dashboardData.overview.mostCostlyBlunder.moveNumber }}
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <!-- Learning Progress Card -->
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div class="p-6">
                <div class="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-medium text-muted-foreground">Learned</h3>
                    <div class="tooltip-wrapper" (click)="toggleTooltip($event)">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-muted-foreground cursor-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                      <div class="tooltip-content">Percentage of blunder patterns you've mastered. Patterns are marked as learned when you avoid similar mistakes consistently.</div>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div class="pt-2">
                  <div class="text-2xl font-bold">{{ dashboardData.learningProgress.percentage }}%</div>
                  <p class="text-xs text-muted-foreground mt-1">
                    {{ dashboardData.learningProgress.learnedCount }} / {{ dashboardData.learningProgress.totalCount }} mastered
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Charts Row -->
          <div class="grid gap-6 md:grid-cols-2">
            <!-- Phase Distribution -->
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div class="p-6">
                <div class="flex items-center gap-2 mb-4">
                  <h3 class="text-lg font-semibold">Blunders by Game Phase</h3>
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
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div class="p-6">
                <div class="flex items-center gap-2 mb-4">
                  <h3 class="text-lg font-semibold">Top Tactical Themes</h3>
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
          <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div class="p-6">
              <h3 class="text-lg font-semibold mb-4">Top Patterns to Study</h3>
              <div class="relative w-full overflow-auto">
                <table class="w-full caption-bottom text-sm">
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
          <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div class="p-6">
              <h3 class="text-lg font-semibold mb-4">Recent Blunders</h3>
              <div class="space-y-3">
                <div *ngFor="let blunder of dashboardData.recentBlunders.slice(0, 10)"
                     class="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors cursor-pointer"
                     [routerLink]="['/games', blunder.gameId]">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                            [class]="getPhaseClass(blunder.phase)">
                        {{ blunder.phase }}
                      </span>
                      <span class="text-sm font-medium">Move {{ blunder.moveNumber }}</span>
                      <span class="text-xs text-muted-foreground">vs {{ blunder.opponent }}</span>
                    </div>
                    <div class="text-xs text-muted-foreground mt-1">
                      Played: {{ blunder.playerMove }} | Best: {{ blunder.bestMove }}
                    </div>
                  </div>
                  <div class="text-right">
                    <div [class]="getSeverityClass(blunder.centipawnLoss)" class="font-medium">
                      -{{ blunder.centipawnLoss }} CP
                    </div>
                    <div class="text-xs text-muted-foreground">{{ formatDate(blunder.date) }}</div>
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
