import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LayoutComponent } from '../../components/layout/layout.component';
import { StatCardComponent } from '../../components/stat-card/stat-card.component';
import { ChessApiService } from '../../services/chess-api.service';

interface TournamentGame {
  id: number;
  opponent: string;
  result: string;
  playerColor: 'white' | 'black';
  accuracy?: number;
  blunders?: number;
  opening?: string;
  round: number;
  white_player: string;
  black_player: string;
  white_elo?: number;
  black_elo?: number;
  moves_count: number;
  date: string;
  event: string;
}

interface Tournament {
  id: number;
  name: string;
  event_type: string;
  location: string;
  start_date: string;
  end_date?: string;
  total_games: number;
  created_at: string;
  games: TournamentGame[];
}

@Component({
  selector: 'app-tournament-detail',
  standalone: true,
  imports: [CommonModule, LayoutComponent, StatCardComponent],
  template: `
    <app-layout>
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <button
            (click)="goBack()"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10">
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
          </button>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <svg class="h-5 w-5 sm:h-6 sm:w-6 text-primary" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
              </svg>
              <h1 class="text-2xl sm:text-3xl font-bold text-foreground">{{ tournamentName }}</h1>
            </div>
            <p class="text-sm sm:text-base text-muted-foreground">{{ dateRange }}</p>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4" *ngIf="tournament && !loading">
          <app-stat-card
            title="Tournament Score"
            [value]="getScore() + ' / ' + (tournament?.games?.length || 0)"
            subtitle="{{ getWins() }}W {{ getDraws() }}D {{ getLosses() }}L"
            icon="trophy">
          </app-stat-card>
          <app-stat-card
            title="Win Rate"
            [value]="getWinRate() + '%'"
            subtitle="Tournament performance"
            icon="trending-up">
          </app-stat-card>
          <app-stat-card
            title="Avg Accuracy"
            [value]="getAvgAccuracy() + '%'"
            subtitle="Average move accuracy"
            icon="target">
          </app-stat-card>
          <app-stat-card
            title="Total Blunders"
            [value]="getTotalBlunders()"
            subtitle="Across all games"
            icon="alert-triangle">
          </app-stat-card>
        </div>

        <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col space-y-1.5 p-6">
            <h3 class="text-2xl font-semibold leading-none tracking-tight">Round-by-Round Results</h3>
          </div>
          <div class="p-6 pt-0">
            <div class="space-y-3">
              <div *ngFor="let game of tournament?.games || []"
                   class="flex items-center justify-between rounded-lg border p-3 sm:p-4 transition-all hover:bg-muted/50 cursor-pointer"
                   (click)="navigateToGame(game.id)">
                <div class="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div class="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span class="text-xs sm:text-sm font-bold text-primary">R{{ game.round }}</span>
                  </div>
                  <div class="space-y-1 flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span [class]="'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' + getResultBadgeClass(game.result, game.playerColor)">
                        {{ getResultText(game.result, game.playerColor) }}
                      </span>
                      <span class="text-xs sm:text-sm text-muted-foreground">vs</span>
                      <span class="text-sm sm:text-base font-medium truncate">{{ game.opponent }}</span>
                      <div class="flex items-center gap-1">
                        <div [class]="'h-4 w-4 rounded-full flex items-center justify-center ' + (game.playerColor === 'white' ? 'bg-muted' : 'bg-secondary')">
                          <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 20h20l-2-6-4 2-4-4-4 4-4-2z"/>
                            <path d="M6 4l2 4 4-2 4 2 2-4"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                      <span class="hidden sm:inline truncate">{{ game.opening || 'Unknown' }}</span>
                      <div class="flex items-center gap-1">
                        <svg class="h-3 w-3 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <circle cx="12" cy="12" r="6"/>
                          <circle cx="12" cy="12" r="2"/>
                        </svg>
                        {{ game.accuracy || 0 }}% accuracy
                      </div>
                      <div *ngIf="(game.blunders || 0) > 0" class="flex items-center gap-1 text-yellow-600">
                        <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                          <path d="M12 9v4"/>
                          <path d="m12 17 .01 0"/>
                        </svg>
                        {{ game.blunders }} blunder{{ game.blunders > 1 ? 's' : '' }}
                      </div>
                    </div>
                  </div>
                </div>
                <button class="inline-flex flex-shrink-0 items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 sm:h-10 sm:w-10">
                  <svg class="h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `
})
export class TournamentDetailComponent implements OnInit {
  tournamentId: number | null = null;
  tournament: Tournament | null = null;
  tournamentPerformance: any = null; // Backend performance data
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute, 
    private router: Router,
    private chessApi: ChessApiService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.tournamentId = parseInt(id);
      this.loadTournamentData();
    }
  }

  async loadTournamentData() {
    if (!this.tournamentId) return;
    
    this.loading = true;
    this.error = null;
    
    try {
      // Load tournament details, games, and performance data from BE
      const [tournamentData, games, performance] = await Promise.all([
        this.chessApi.getTournamentById(this.tournamentId).toPromise(),
        this.chessApi.getTournamentGames(this.tournamentId).toPromise(),
        this.chessApi.getTournamentPerformance(this.tournamentId).toPromise()
      ]);
      
      this.tournamentPerformance = performance;
      
      // Process games to add round numbers and opponent info (data already comes from BE)
      const processedGames = games.map((game: any, index: number) => {
        const targetPlayer = this.chessApi.targetPlayer;
        const isPlayerWhite = game.white_player === targetPlayer;
        const opponent = isPlayerWhite ? game.black_player : game.white_player;
        
        return {
          ...game,
          opponent,
          round: index + 1,
          // All performance data already comes from /api/tournaments/:id/games
          // accuracy, blunders, opening, playerColor are already included
        };
      });
      
      this.tournament = {
        ...tournamentData,
        games: processedGames
      };
      
      this.loading = false;
    } catch (err: any) {
      this.error = err.message || 'Failed to load tournament data';
      this.loading = false;
      console.error('Error loading tournament:', err);
    }
  }

  getAvgAccuracy(): string {
    // Use BE-calculated accuracy from AccuracyCalculator module
    return this.tournamentPerformance?.avgAccuracy?.toFixed(1) || '0.0';
  }

  getTotalBlunders(): number {
    // Use BE-calculated blunders from AccuracyCalculator module
    return this.tournamentPerformance?.totalBlunders || 0;
  }

  get tournamentName(): string {
    return this.tournament?.name || 'Tournament';
  }

  get dateRange(): string {
    if (!this.tournament) return '';
    const start = new Date(this.tournament.start_date).toLocaleDateString();
    if (this.tournament.end_date && this.tournament.end_date !== this.tournament.start_date) {
      const end = new Date(this.tournament.end_date).toLocaleDateString();
      return `${start} - ${end}`;
    }
    return start;
  }

  goBack() {
    this.router.navigate(['/tournaments']);
  }

  navigateToGame(gameId: number) {
    this.router.navigate(['/games', gameId]);
  }

  getWins(): number {
    // Use BE-calculated wins from AccuracyCalculator module
    return this.tournamentPerformance?.whiteWins || 0;
  }

  getDraws(): number {
    // Use BE-calculated draws from AccuracyCalculator module
    return this.tournamentPerformance?.draws || 0;
  }

  getLosses(): number {
    // Calculate losses from BE data
    const totalGames = this.tournamentPerformance?.totalGames || 0;
    const wins = this.getWins();
    const draws = this.getDraws();
    return totalGames - wins - draws;
  }

  getScore(): number {
    return this.getWins() + this.getDraws() * 0.5;
  }

  getWinRate(): string {
    // Use BE-calculated win rate from AccuracyCalculator module
    const totalGames = this.tournamentPerformance?.totalGames || 0;
    const wins = this.getWins();
    if (totalGames === 0) return '0.0';
    return ((wins / totalGames) * 100).toFixed(1);
  }

  formatDate(dateStr: string): string {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return date.toLocaleDateString();
    }
    return dateStr;
  }

  getResultBadgeClass(result: string, playerColor: 'white' | 'black'): string {
    const isWin = (result === '1-0' && playerColor === 'white') || 
                  (result === '0-1' && playerColor === 'black');
    const isDraw = result === '1/2-1/2';
    
    if (isWin) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (isDraw) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  }

  getResultText(result: string, playerColor: 'white' | 'black'): string {
    const isWin = (result === '1-0' && playerColor === 'white') || 
                  (result === '0-1' && playerColor === 'black');
    const isDraw = result === '1/2-1/2';
    
    if (isWin) return 'Win';
    if (isDraw) return 'Draw';
    return 'Loss';
  }
}
