import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ChessApiService } from '../../services/chess-api.service';
import { StatCardComponent } from '../../components/stat-card.component';
import { Trophy, TrendingUp, Target } from 'lucide-angular';

interface Tournament {
  id: number;
  name: string;
  event_type: string;
  location: string;
  start_date: string;
  end_date?: string;
  total_games: number;
  created_at: string;
  // Calculated fields
  wins?: number;
  draws?: number;
  losses?: number;
  avgAccuracy?: number;
  totalBlunders?: number;
}

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [CommonModule, RouterModule, LayoutComponent, StatCardComponent],
  template: `
    <app-layout>
      <div class="space-y-6 sm:space-y-8 pb-8">
        <!-- Header -->
        <div class="animate-fade-in">
          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gradient tracking-tight mb-2">Tournament Performance</h1>
          <p class="text-sm sm:text-base text-muted-foreground">Analyze your performance across tournaments</p>
        </div>

        <!-- Stats Cards -->
        <div class="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 animate-slide-up">
          <div class="group">
            <app-stat-card
              title="Total Tournaments"
              [value]="tournaments.length"
              [icon]="Trophy"
              [subtitle]="getTotalGames() + ' total games'"
              variant="default"
              class="transform transition-all duration-300 sm:hover:scale-105 sm:hover:-translate-y-1">
            </app-stat-card>
          </div>

          <div class="group">
            <app-stat-card
              title="Avg Win Rate"
              [value]="getAvgWinRate() + '%'"
              [icon]="TrendingUp"
              subtitle="Across all tournaments"
              variant="success"
              class="transform transition-all duration-300 sm:hover:scale-105 sm:hover:-translate-y-1">
            </app-stat-card>
          </div>

          <div class="group sm:col-span-2 lg:col-span-1">
            <app-stat-card
              title="Avg Accuracy"
              [value]="getAvgAccuracy() + '%'"
              [icon]="Target"
              subtitle="Average performance"
              variant="default"
              class="transform transition-all duration-300 sm:hover:scale-105 sm:hover:-translate-y-1">
            </app-stat-card>
          </div>
        </div>

        <!-- Tournament History Card -->
        <div class="rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl backdrop-blur-sm overflow-hidden animate-slide-up" style="animation-delay: 0.1s;">
          <div class="flex flex-col space-y-2 p-4 sm:p-6 bg-gradient-to-br from-primary/5 to-transparent">
            <h3 class="text-xl sm:text-2xl font-bold text-gradient">Tournament History</h3>
          </div>
          <div class="p-4 sm:p-6 pt-0">
            <!-- Loading state -->
            <div *ngIf="loading" class="flex flex-col justify-center items-center py-12 sm:py-16">
              <div class="relative">
                <div class="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <div class="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-transparent border-t-accent rounded-full animate-spin" style="animation-duration: 1.5s;"></div>
              </div>
              <p class="mt-6 text-sm font-medium text-muted-foreground">Loading tournaments...</p>
            </div>

            <!-- Error state -->
            <div *ngIf="error && !loading" class="rounded-xl border-2 border-destructive/30 bg-gradient-to-br from-destructive/10 to-destructive/5 p-4 sm:p-6 shadow-lg">
              <div class="flex items-start gap-3 sm:gap-4">
                <div class="flex-shrink-0 p-2 rounded-lg bg-destructive/20">
                  <svg class="w-5 h-5 sm:w-6 sm:h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-base sm:text-lg font-bold text-destructive mb-1">Error Loading Tournaments</h3>
                  <p class="text-sm text-foreground/80">{{ error }}</p>
                </div>
              </div>
            </div>

            <!-- Empty state -->
            <div *ngIf="!loading && !error && tournaments.length === 0" class="text-center py-12 sm:py-16">
              <div class="rounded-2xl border-2 border-border/30 bg-card/50 backdrop-blur-sm p-8 sm:p-12 max-w-md mx-auto">
                <svg class="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                <p class="text-lg sm:text-xl font-bold text-foreground mb-2">No tournaments found</p>
                <p class="text-sm text-muted-foreground">Upload some PGN files to create tournament records.</p>
              </div>
            </div>

            <!-- Desktop table view -->
            <div *ngIf="!loading && !error && tournaments.length > 0" class="hidden md:block overflow-x-auto">
              <table class="w-full caption-bottom text-sm">
                <thead class="[&_tr]:border-b">
                  <tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">Tournament</th>
                    <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">Date Range</th>
                    <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">Games</th>
                    <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">Score</th>
                    <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">Win Rate</th>
                    <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">Accuracy</th>
                    <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">Blunders</th>
                  </tr>
                </thead>
                <tbody class="[&_tr:last-child]:border-0">
                  <tr *ngFor="let tournament of tournaments"
                      class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted cursor-pointer"
                      [routerLink]="['/tournaments', tournament.id]">
                    <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      <div class="flex items-center gap-2">
                        <svg class="h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                          <path d="M4 22h16"/>
                          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                        </svg>
                        <span class="font-medium">{{ tournament.name }}</span>
                      </div>
                    </td>
                    <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0 text-muted-foreground">
                      {{ formatDateRange(tournament.start_date, tournament.end_date) }}
                    </td>
                    <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      {{ tournament.total_games }}
                    </td>
                    <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      <div class="flex items-center gap-1">
                        <span class="font-medium">{{ calculateScore(tournament.wins || 0, tournament.draws || 0) }}</span>
                        <span class="text-xs text-muted-foreground">/ {{ tournament.total_games }}</span>
                      </div>
                    </td>
                    <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      <span [class]="'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                        (calculateWinRate(tournament.wins || 0, tournament.total_games) > 50 ?
                         'bg-success/20 text-success border border-success/30' :
                         'bg-muted text-muted-foreground border border-border')">
                        {{ calculateWinRate(tournament.wins || 0, tournament.total_games) }}%
                      </span>
                    </td>
                    <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      <div class="flex items-center gap-1">
                        <svg class="h-3 w-3 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <circle cx="12" cy="12" r="6"/>
                          <circle cx="12" cy="12" r="2"/>
                        </svg>
                        <span>{{ tournament.avgAccuracy || 0 }}%</span>
                      </div>
                    </td>
                    <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                      <div *ngIf="(tournament.totalBlunders || 0) > 0" class="flex items-center gap-1 text-warning">
                        <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                          <path d="M12 9v4"/>
                          <path d="m12 17 .01 0"/>
                        </svg>
                        <span>{{ tournament.totalBlunders || 0 }}</span>
                      </div>
                      <span *ngIf="(tournament.totalBlunders || 0) === 0" class="text-muted-foreground">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile card view -->
            <div *ngIf="!loading && !error && tournaments.length > 0" class="md:hidden space-y-3 sm:space-y-4">
              <div *ngFor="let tournament of tournaments"
                   class="rounded-xl border-2 border-border/30 gradient-card text-card-foreground shadow-xl hover:shadow-glow-primary hover:border-primary/50 p-4 space-y-3 cursor-pointer transition-all duration-300"
                   [routerLink]="['/tournaments', tournament.id]">
                <div class="flex items-start gap-2">
                  <svg class="h-5 w-5 text-primary mt-0.5" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                    <path d="M4 22h16"/>
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                  </svg>
                  <div class="flex-1">
                    <h3 class="font-medium text-foreground">{{ tournament.name }}</h3>
                    <p class="text-xs text-muted-foreground mt-1">{{ formatDateRange(tournament.start_date, tournament.end_date) }}</p>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span class="text-muted-foreground">Games:</span>
                    <span class="ml-1 font-medium">{{ tournament.total_games }}</span>
                  </div>
                  <div>
                    <span class="text-muted-foreground">Score:</span>
                    <span class="ml-1 font-medium">
                      {{ calculateScore(tournament.wins || 0, tournament.draws || 0) }}/{{ tournament.total_games }}
                    </span>
                  </div>
                  <div>
                    <span class="text-muted-foreground">Win Rate:</span>
                    <span [class]="'ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                      (calculateWinRate(tournament.wins || 0, tournament.total_games) > 50 ?
                       'bg-success/20 text-success border border-success/30' :
                       'bg-muted text-muted-foreground border border-border')">
                      {{ calculateWinRate(tournament.wins || 0, tournament.total_games) }}%
                    </span>
                  </div>
                  <div>
                    <span class="text-muted-foreground">Accuracy:</span>
                    <span class="ml-1 font-medium">{{ tournament.avgAccuracy || 0 }}%</span>
                  </div>
                </div>

                <div *ngIf="(tournament.totalBlunders || 0) > 0" class="flex items-center gap-1 text-warning text-sm">
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <path d="M12 9v4"/>
                    <path d="m12 17 .01 0"/>
                  </svg>
                  <span>{{ tournament.totalBlunders || 0 }} blunders</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `
})
export class TournamentsComponent implements OnInit {
  tournaments: Tournament[] = [];
  overallPerformance: any = null;
  loading = true;
  error: string | null = null;

  // Lucide icons for stat cards
  Trophy = Trophy;
  TrendingUp = TrendingUp;
  Target = Target;

  constructor(private chessApi: ChessApiService) {}

  ngOnInit() {
    this.loadTournaments();
  }

  async loadTournaments() {
    this.loading = true;
    this.error = null;
    
    try {
      // Load tournaments and overall performance from BE
      const [tournaments, overallPerformance] = await Promise.all([
        this.chessApi.getTournaments().toPromise(),
        this.chessApi.getPlayerPerformanceData().toPromise()
      ]);
      
      this.overallPerformance = overallPerformance;
      
      // Load performance data for each tournament using BE calculation
      this.tournaments = await Promise.all(
        (tournaments || []).map(async (tournament) => {
          try {
            const performance = await this.chessApi.getTournamentPerformance(tournament.id).toPromise();
            
            return {
              ...tournament,
              wins: performance.whiteWins, // Actually player wins regardless of color
              draws: performance.draws,
              losses: performance.totalGames - (performance.whiteWins + performance.draws),
              avgAccuracy: performance.avgAccuracy || 0,
              totalBlunders: performance.totalBlunders || 0
            };
          } catch (error) {
            console.warn(`Failed to load performance for tournament ${tournament.id}:`, error);
            return {
              ...tournament,
              wins: 0,
              draws: 0,
              losses: 0,
              avgAccuracy: 0,
              totalBlunders: 0
            };
          }
        })
      );
      
      // Sort tournaments by start date (newest first)
      this.tournaments = this.tournaments.sort((a, b) => {
        const dateA = new Date(a.start_date);
        const dateB = new Date(b.start_date);
        return dateB.getTime() - dateA.getTime();
      });
      
      this.loading = false;
    } catch (err: any) {
      this.error = err.message || 'Failed to load tournaments';
      this.loading = false;
      console.error('Error loading tournaments:', err);
    }
  }

  getTotalGames(): number {
    return this.tournaments.reduce((sum, t) => sum + t.total_games, 0);
  }

  getAvgWinRate(): string {
    if (this.tournaments.length === 0) return '0.0';
    const avgRate = this.tournaments.reduce(
      (sum, t) => sum + this.calculateWinRate(t.wins || 0, t.total_games),
      0
    ) / this.tournaments.length;
    return avgRate.toFixed(1);
  }

  getAvgAccuracy(): string {
    // Use same BE calculation as dashboard
    if (!this.overallPerformance?.overall?.avgAccuracy) return '0.0';
    return this.overallPerformance.overall.avgAccuracy.toFixed(1);
  }

  calculateWinRate(wins: number, total: number): number {
    if (total === 0) return 0;
    return parseFloat(((wins / total) * 100).toFixed(1));
  }

  calculateScore(wins: number, draws: number): number {
    return wins + draws * 0.5;
  }

  formatDateRange(startDate: string, endDate?: string): string {
    const start = new Date(startDate).toLocaleDateString();
    if (endDate && endDate !== startDate) {
      const end = new Date(endDate).toLocaleDateString();
      return `${start} - ${end}`;
    }
    return start; // Single date tournament
  }
}
