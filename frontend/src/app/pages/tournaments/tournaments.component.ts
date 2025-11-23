import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ChessApiService } from '../../services/chess-api.service';

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
  imports: [CommonModule, RouterModule, LayoutComponent],
  template: `
    <app-layout>
      <div class="space-y-6">
        <div>
          <h1 class="text-3xl font-bold text-foreground">Tournament Performance</h1>
          <p class="text-muted-foreground">Analyze your performance across tournaments</p>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 class="tracking-tight text-sm font-medium">Total Tournaments</h3>
              <svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
              </svg>
            </div>
            <div class="p-6 pt-0">
              <div class="text-2xl font-bold">{{ tournaments.length }}</div>
              <p class="text-xs text-muted-foreground">{{ getTotalGames() }} total games</p>
            </div>
          </div>

          <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 class="tracking-tight text-sm font-medium">Avg Win Rate</h3>
              <svg class="h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 18"/>
                <polyline points="16 7 22 7 22 13"/>
              </svg>
            </div>
            <div class="p-6 pt-0">
              <div class="text-2xl font-bold">{{ getAvgWinRate() }}%</div>
              <p class="text-xs text-muted-foreground">Across all tournaments</p>
            </div>
          </div>

          <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 class="tracking-tight text-sm font-medium">Avg Accuracy</h3>
              <svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="6"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
            </div>
            <div class="p-6 pt-0">
              <div class="text-2xl font-bold">{{ getAvgAccuracy() }}%</div>
              <p class="text-xs text-muted-foreground">Average performance</p>
            </div>
          </div>
        </div>

        <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col space-y-1.5 p-6">
            <h3 class="text-2xl font-semibold leading-none tracking-tight">Tournament History</h3>
          </div>
          <div class="p-6 pt-0">
            <!-- Desktop table view -->
            <div class="hidden md:block overflow-x-auto">
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
                         'bg-primary text-primary-foreground' :
                         'bg-secondary text-secondary-foreground')">
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
                      <div *ngIf="(tournament.totalBlunders || 0) > 0" class="flex items-center gap-1 text-yellow-600">
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
            <div class="md:hidden space-y-3">
              <div *ngFor="let tournament of tournaments"
                   class="border border-border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
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
                       'bg-primary text-primary-foreground' :
                       'bg-secondary text-secondary-foreground')">
                      {{ calculateWinRate(tournament.wins || 0, tournament.total_games) }}%
                    </span>
                  </div>
                  <div>
                    <span class="text-muted-foreground">Accuracy:</span>
                    <span class="ml-1 font-medium">{{ tournament.avgAccuracy || 0 }}%</span>
                  </div>
                </div>

                <div *ngIf="(tournament.totalBlunders || 0) > 0" class="flex items-center gap-1 text-yellow-600 text-sm">
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <path d="M12 9v4"/>
                    <path d="m12 17 .01 0"/>
                  </svg>
                  <span>{{ tournament.totalBlunders || 0 }} blunders</span>
                </div>
              </div>
            </div>
              
              <!-- Loading state -->
              <div *ngIf="loading" class="flex justify-center items-center py-8">
                <div class="text-muted-foreground">Loading tournaments...</div>
              </div>
              
              <!-- Error state -->
              <div *ngIf="error" class="rounded-lg border border-red-200 bg-red-50 p-4 mt-4">
                <div class="text-red-800">Error loading tournaments: {{ error }}</div>
              </div>
              
              <!-- Empty state -->
              <div *ngIf="!loading && !error && tournaments.length === 0" class="text-center py-12">
                <div class="text-muted-foreground">
                  <p class="text-lg font-medium">No tournaments found</p>
                  <p class="text-sm mt-2">Upload some PGN files to create tournament records.</p>
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
        tournaments.map(async (tournament) => {
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
