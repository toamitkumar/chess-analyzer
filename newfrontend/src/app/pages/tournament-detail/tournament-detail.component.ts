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
        <div class="flex items-center gap-4">
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
              <svg class="h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
              </svg>
              <h1 class="text-3xl font-bold text-foreground">{{ tournamentName }}</h1>
            </div>
            <p class="text-muted-foreground">{{ dateRange }}</p>
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
                   class="flex items-center justify-between rounded-lg border p-4 transition-all hover:bg-muted/50 cursor-pointer"
                   (click)="navigateToGame(game.id)">
                <div class="flex items-center gap-4">
                  <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <span class="text-sm font-bold text-primary">R{{ game.round }}</span>
                  </div>
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span [class]="'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' + getResultBadgeClass(game.result, game.playerColor)">
                        {{ getResultText(game.result, game.playerColor) }}
                      </span>
                      <span class="text-sm text-muted-foreground">vs</span>
                      <span class="font-medium">{{ game.opponent }}</span>
                      <div class="flex items-center gap-1">
                        <div [class]="'h-4 w-4 rounded-full flex items-center justify-center ' + (game.playerColor === 'white' ? 'bg-muted' : 'bg-secondary')">
                          <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 20h20l-2-6-4 2-4-4-4 4-4-2z"/>
                            <path d="M6 4l2 4 4-2 4 2 2-4"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{{ game.opening }}</span>
                      <div class="flex items-center gap-1">
                        <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <circle cx="12" cy="12" r="6"/>
                          <circle cx="12" cy="12" r="2"/>
                        </svg>
                        {{ game.accuracy }}% accuracy
                      </div>
                      <div *ngIf="game.blunders > 0" class="flex items-center gap-1 text-yellow-600">
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
                <button class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10">
                  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
      // Load tournament details and games
      const [tournamentData, games] = await Promise.all([
        this.chessApi.getTournamentById(this.tournamentId).toPromise(),
        this.chessApi.getTournamentGames(this.tournamentId).toPromise()
      ]);
      
      // Process games to add analysis data and determine player perspective
      const gamesWithAnalysis = await Promise.all(
        games.map(async (game, index) => {
          const targetPlayer = this.chessApi.targetPlayer;
          const isPlayerWhite = game.white_player === targetPlayer;
          const isPlayerBlack = game.black_player === targetPlayer;
          const opponent = isPlayerWhite ? game.black_player : game.white_player;
          
          try {
            const analysis = await this.chessApi.getGameAnalysis(game.id).toPromise();
            
            // Calculate player-specific blunders (only target player's moves)
            const playerMoves = analysis.analysis?.filter((move: any) => 
              (isPlayerWhite && move.move_number % 2 === 1) ||
              (isPlayerBlack && move.move_number % 2 === 0)
            ) || [];
            const blunderCount = playerMoves.filter((move: any) => move.is_blunder === 1).length;
            
            // Extract ECO and opening from PGN content
            const ecoMatch = analysis.game?.pgn_content?.match(/\[ECO "([^"]+)"\]/);
            const eco = ecoMatch ? ecoMatch[1] : undefined;
            
            // Calculate accuracy for the target player
            const accuracy = this.calculatePlayerAccuracy(analysis.analysis, isPlayerWhite ? 'white' : 'black');
            
            return {
              ...game,
              opponent,
              playerColor: (isPlayerWhite ? 'white' : 'black') as 'white' | 'black',
              round: index + 1, // Simple round numbering
              accuracy,
              blunders: blunderCount,
              opening: this.getOpeningName(eco)
            };
          } catch (error) {
            console.warn(`Failed to load analysis for game ${game.id}:`, error);
            return {
              ...game,
              opponent,
              playerColor: (isPlayerWhite ? 'white' : 'black') as 'white' | 'black',
              round: index + 1,
              accuracy: 0,
              blunders: 0,
              opening: 'Unknown Opening'
            };
          }
        })
      );
      
      this.tournament = {
        ...tournamentData,
        games: gamesWithAnalysis
      };
      
      this.loading = false;
    } catch (err: any) {
      this.error = err.message || 'Failed to load tournament data';
      this.loading = false;
      console.error('Error loading tournament:', err);
    }
  }

  calculatePlayerAccuracy(analysis: any[], playerColor: 'white' | 'black'): number {
    if (!analysis || analysis.length === 0) return 0;
    
    // Filter moves for the target player (odd move numbers for white, even for black)
    const playerMoves = analysis.filter(move => 
      (playerColor === 'white' && move.move_number % 2 === 1) ||
      (playerColor === 'black' && move.move_number % 2 === 0)
    );
    
    if (playerMoves.length === 0) return 0;
    
    const avgCentipawnLoss = playerMoves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0) / playerMoves.length;
    return Math.max(0, Math.min(100, Math.round(100 - (avgCentipawnLoss / 2))));
  }

  getOpeningName(eco?: string): string {
    if (!eco) return 'Unknown Opening';
    
    // Comprehensive ECO to opening name mapping (same as games component)
    const openings: { [key: string]: string } = {
      // A codes - Flank openings
      'A00': 'Uncommon Opening',
      'A01': 'Nimzowitsch-Larsen Attack',
      'A02': 'Bird\'s Opening',
      'A03': 'Bird\'s Opening',
      'A04': 'Reti Opening',
      'A05': 'Reti Opening',
      'A06': 'Reti Opening',
      'A07': 'King\'s Indian Attack',
      'A08': 'King\'s Indian Attack',
      'A09': 'Reti Opening',
      'A10': 'English Opening',
      'A11': 'English Opening: Caro-Kann Defensive System',
      'A12': 'English Opening',
      'A13': 'English Opening',
      'A14': 'English Opening',
      'A15': 'English Opening',
      'A16': 'English Opening',
      'A17': 'English Opening',
      'A18': 'English Opening',
      'A19': 'English Opening',
      'A20': 'English Opening',
      
      // B codes - Semi-open games
      'B00': 'King\'s Pawn Game',
      'B01': 'Scandinavian Defense',
      'B02': 'Alekhine\'s Defense',
      'B03': 'Alekhine\'s Defense',
      'B04': 'Alekhine\'s Defense',
      'B05': 'Alekhine\'s Defense',
      'B06': 'Modern Defense',
      'B07': 'Pirc Defense',
      'B08': 'Pirc Defense',
      'B09': 'Pirc Defense',
      'B10': 'Caro-Kann Defense',
      'B20': 'Sicilian Defense',
      'B21': 'Sicilian Defense',
      'B22': 'Sicilian Defense',
      
      // C codes - Open games
      'C00': 'French Defense',
      'C01': 'French Defense',
      'C02': 'French Defense',
      'C03': 'French Defense',
      'C04': 'French Defense',
      'C05': 'French Defense',
      'C20': 'King\'s Pawn Game',
      'C21': 'Center Game',
      'C22': 'Center Game',
      'C23': 'Bishop\'s Opening',
      'C24': 'Bishop\'s Opening',
      'C25': 'Vienna Game',
      'C40': 'King\'s Knight Opening',
      'C41': 'Philidor Defense',
      'C42': 'Petrov Defense',
      'C43': 'Petrov Defense',
      'C44': 'King\'s Pawn Game',
      'C45': 'Scotch Game',
      'C46': 'Three Knights Opening',
      'C47': 'Four Knights Game',
      'C50': 'Italian Game',
      'C60': 'Ruy Lopez',
      'C61': 'Ruy Lopez',
      'C62': 'Ruy Lopez',
      
      // D codes - Closed games
      'D00': 'Queen\'s Pawn Game',
      'D01': 'Richter-Veresov Attack',
      'D02': 'Queen\'s Pawn Game',
      'D03': 'Torre Attack',
      'D04': 'Queen\'s Pawn Game',
      'D05': 'Queen\'s Pawn Game',
      'D06': 'Queen\'s Gambit',
      'D10': 'Queen\'s Gambit Declined',
      'D20': 'Queen\'s Gambit Accepted',
      'D30': 'Queen\'s Gambit Declined',
      
      // E codes - Indian defenses
      'E00': 'Queen\'s Pawn Game',
      'E01': 'Catalan Opening',
      'E02': 'Catalan Opening',
      'E03': 'Catalan Opening',
      'E04': 'Catalan Opening',
      'E05': 'Catalan Opening',
      'E10': 'Queen\'s Pawn Game',
      'E11': 'Bogo-Indian Defense',
      'E12': 'Queen\'s Indian Defense',
      'E20': 'Nimzo-Indian Defense',
      'E60': 'King\'s Indian Defense',
      'E70': 'King\'s Indian Defense',
      'E80': 'King\'s Indian Defense',
      'E90': 'King\'s Indian Defense'
    };
    
    return openings[eco] || `${eco} Opening`;
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
    if (!this.tournament) return 0;
    return this.tournament.games.filter(
      (g) =>
        (g.result === '1-0' && g.playerColor === 'white') ||
        (g.result === '0-1' && g.playerColor === 'black')
    ).length;
  }

  getDraws(): number {
    if (!this.tournament) return 0;
    return this.tournament.games.filter((g) => g.result === '1/2-1/2').length;
  }

  getLosses(): number {
    if (!this.tournament) return 0;
    return this.tournament.games.length - this.getWins() - this.getDraws();
  }

  getScore(): number {
    return this.getWins() + this.getDraws() * 0.5;
  }

  getWinRate(): string {
    if (!this.tournament || this.tournament.games.length === 0) return '0.0';
    return ((this.getWins() / this.tournament.games.length) * 100).toFixed(1);
  }

  getAvgAccuracy(): string {
    if (!this.tournament || this.tournament.games.length === 0) return '0.0';
    const gamesWithAccuracy = this.tournament.games.filter(g => g.accuracy && g.accuracy > 0);
    if (gamesWithAccuracy.length === 0) return '0.0';
    
    const avg = gamesWithAccuracy.reduce((sum, g) => sum + (g.accuracy || 0), 0) / gamesWithAccuracy.length;
    return avg.toFixed(1);
  }

  getTotalBlunders(): number {
    if (!this.tournament || this.tournament.games.length === 0) return 0;
    return this.tournament.games.reduce((sum, g) => sum + (g.blunders || 0), 0);
  }

  formatDate(dateStr: string): string {
    // Convert "2025.10.24" format to readable date
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
