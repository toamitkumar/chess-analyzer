import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ChessApiService } from '../../services/chess-api.service';

interface Game {
  id: number;
  white_player: string;
  black_player: string;
  result: string;
  date: string;
  event: string;
  white_elo?: number;
  black_elo?: number;
  moves_count: number;
  playerColor: 'white' | 'black';
  // Analysis data
  accuracy?: { white: number; black: number };
  blunders?: number;
  opening?: string;
  eco?: string;
}

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HttpClientModule, LayoutComponent],
  template: `
    <app-layout>
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-foreground">Game Analysis</h1>
            <p class="text-muted-foreground">Review and analyze your chess games</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <label class="text-sm text-muted-foreground">Games per page:</label>
              <select 
                [(ngModel)]="gamesPerPage"
                (ngModelChange)="onGamesPerPageChange()"
                class="flex h-8 w-16 items-center justify-center rounded-md border border-input bg-background px-2 py-1 text-sm">
                <option *ngFor="let option of gamesPerPageOptions" [value]="option">{{ option }}</option>
              </select>
            </div>
            <div class="relative">
              <select 
                [(ngModel)]="filter"
                (ngModelChange)="onFilterChange()"
                class="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none">
                <option value="all">All Games</option>
                <option value="wins">Wins Only</option>
                <option value="losses">Losses Only</option>
                <option value="draws">Draws Only</option>
              </select>
              <svg class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
          </div>
        </div>

        <div class="grid gap-4">
          <div *ngFor="let game of filteredGames" 
               class="rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-lg cursor-pointer"
               [routerLink]="['/games', game.id]">
            <div class="p-6">
              <div class="flex items-start justify-between">
                <div class="flex-1 space-y-3">
                  <div class="flex items-center gap-3">
                    <span [class]="'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' + getResultBadgeClass(game.result, game.playerColor)">
                      {{ getResultText(game.result, game.playerColor) }}
                    </span>
                    <span *ngIf="game.event" class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 gap-1">
                      <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                        <path d="M4 22h16"/>
                        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                      </svg>
                      {{ game.event }}
                    </span>
                    <span class="text-sm text-muted-foreground">{{ formatDate(game.date) }}</span>
                  </div>
                  
                  <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <svg class="h-4 w-4 text-foreground" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M2 20h20l-2-6-4 2-4-4-4 4-4-2z"/>
                          <path d="M6 4l2 4 4-2 4 2 2-4"/>
                        </svg>
                      </div>
                      <div>
                        <p class="text-sm font-medium text-foreground">{{ game.white_player }}</p>
                        <div class="flex items-center gap-1 text-xs text-muted-foreground">
                          <span *ngIf="game.white_elo">{{ game.white_elo }} ELO</span>
                          <span *ngIf="!game.white_elo">Unrated</span>
                        </div>
                      </div>
                    </div>
                    
                    <span class="text-muted-foreground">vs</span>
                    
                    <div class="flex items-center gap-2">
                      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                        <svg class="h-4 w-4 text-secondary-foreground" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M2 20h20l-2-6-4 2-4-4-4 4-4-2z"/>
                          <path d="M6 4l2 4 4-2 4 2 2-4"/>
                        </svg>
                      </div>
                      <div>
                        <p class="text-sm font-medium text-foreground">{{ game.black_player }}</p>
                        <div class="flex items-center gap-1 text-xs text-muted-foreground">
                          <span *ngIf="game.black_elo">{{ game.black_elo }} ELO</span>
                          <span *ngIf="!game.black_elo">Unrated</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Analysis Data -->
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div class="flex items-center gap-2">
                      <svg class="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 11H5a2 2 0 0 0-2 2v3c0 5.5 4.5 10 10 10s10-4.5 10-10v-3a2 2 0 0 0-2-2h-4"/>
                        <path d="M9 7V4a2 2 0 0 1 4 0v3"/>
                      </svg>
                      <span class="text-muted-foreground">Moves:</span>
                      <span class="text-foreground font-medium">{{ game.moves_count }}</span>
                    </div>
                    
                    <div *ngIf="game.accuracy" class="flex items-center gap-2">
                      <svg class="h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                      </svg>
                      <span class="text-muted-foreground">Accuracy:</span>
                      <span class="text-foreground font-medium">{{ getPlayerAccuracy(game) }}%</span>
                    </div>
                    
                    <div *ngIf="game.blunders !== undefined" class="flex items-center gap-2">
                      <svg class="h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span class="text-muted-foreground">Blunders:</span>
                      <span class="text-foreground font-medium">{{ game.blunders }}</span>
                    </div>
                    
                    <div *ngIf="game.opening" class="flex items-center gap-2">
                      <svg class="h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14,2 14,8 20,8"/>
                      </svg>
                      <span class="text-muted-foreground">Opening:</span>
                      <span class="text-foreground font-medium text-xs">{{ game.opening }}</span>
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
          
          <!-- Empty state when no games match filter -->
          <div *ngIf="!loading && filteredGames.length === 0" class="text-center py-12">
            <div class="text-muted-foreground">
              <p class="text-lg font-medium">No {{ getFilterDisplayName() }} found</p>
              <p class="text-sm mt-2">{{ getEmptyStateMessage() }}</p>
            </div>
          </div>
        </div>

        <div *ngIf="loading" class="flex justify-center items-center py-8">
          <div class="text-muted-foreground">Loading games...</div>
        </div>

        <div *ngIf="error" class="rounded-lg border border-red-200 bg-red-50 p-4">
          <div class="text-red-800">Error loading games: {{ error }}</div>
        </div>

        <!-- Pagination Controls -->
        <div *ngIf="!loading && totalPages > 1" class="flex items-center justify-between border-t pt-4">
          <div class="text-sm text-muted-foreground">
            Showing {{ (currentPage - 1) * gamesPerPage + 1 }} to {{ Math.min(currentPage * gamesPerPage, totalFilteredGames) }} of {{ totalFilteredGames }} games
          </div>
          <div class="flex items-center gap-2">
            <button 
              (click)="previousPage()"
              [disabled]="currentPage === 1"
              class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8">
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            
            <div class="flex items-center gap-1">
              <button 
                *ngFor="let page of [].constructor(totalPages); let i = index"
                (click)="goToPage(i + 1)"
                [class]="'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-8 w-8 ' + (currentPage === i + 1 ? 'bg-primary text-primary-foreground' : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground')">
                {{ i + 1 }}
              </button>
            </div>
            
            <button 
              (click)="nextPage()"
              [disabled]="currentPage === totalPages"
              class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8">
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </app-layout>
  `
})
export class GamesComponent implements OnInit {
  filter = 'all';
  games: Game[] = [];
  loading = true;
  error: string | null = null;
  
  // Pagination properties
  currentPage = 1;
  gamesPerPage = 10;
  gamesPerPageOptions = [5, 10, 20, 50];
  
  // Make Math available in template
  Math = Math;

  constructor(private chessApi: ChessApiService) {}

  get targetPlayer(): string {
    return this.chessApi.targetPlayer;
  }

  ngOnInit() {
    this.loadGames();
  }

  loadGames() {
    this.loading = true;
    this.error = null;
    
    this.chessApi.getGames().subscribe({
      next: async (games) => {
        // Process games and add analysis data
        const gamesWithAnalysis = await Promise.all(
          games.map(async (game) => { // Show all games
            const gameWithColor = {
              ...game,
              playerColor: (game.white_player === this.targetPlayer ? 'white' : 'black') as 'white' | 'black'
            };
            
            try {
              const analysis = await this.chessApi.getGameAnalysis(game.id).toPromise();
              
              // Calculate player-specific blunders (only target player's moves)
              const isPlayerWhite = gameWithColor.playerColor === 'white';
              const playerMoves = analysis.analysis?.filter((move: any) => 
                (isPlayerWhite && move.move_number % 2 === 1) ||
                (!isPlayerWhite && move.move_number % 2 === 0)
              ) || [];
              const blunderCount = playerMoves.filter((move: any) => move.is_blunder === 1).length;
              
              // Extract ECO and opening from PGN content
              const ecoMatch = analysis.game?.pgn_content?.match(/\[ECO "([^"]+)"\]/);
              const eco = ecoMatch ? ecoMatch[1] : undefined;
              
              // Calculate accuracy based on centipawn loss
              const accuracy = this.calculateAccuracyFromAnalysis(analysis.analysis, gameWithColor.playerColor);
              
              return {
                ...gameWithColor,
                blunders: blunderCount,
                eco: eco,
                opening: this.getOpeningName(eco),
                accuracy: accuracy
              };
            } catch (error) {
              console.warn(`Failed to load analysis for game ${game.id}:`, error);
              return gameWithColor;
            }
          })
        );
        
        // Sort games by date (newest first)
        this.games = gamesWithAnalysis.sort((a, b) => {
          const dateA = new Date(a.date.replace(/\./g, '-'));
          const dateB = new Date(b.date.replace(/\./g, '-'));
          return dateB.getTime() - dateA.getTime();
        });
        
        this.loading = false;
        console.log('Games with analysis loaded:', this.games);
      },
      error: (err) => {
        this.error = err.message || 'Failed to load games';
        this.loading = false;
        console.error('Error loading games:', err);
      }
    });
  }

  get filteredGames(): Game[] {
    let filtered = this.games;
    
    if (this.filter !== 'all') {
      filtered = this.games.filter(game => {
        const isWin = (game.result === '1-0' && game.playerColor === 'white') || 
                      (game.result === '0-1' && game.playerColor === 'black');
        const isDraw = game.result === '1/2-1/2';
        const isLoss = !isWin && !isDraw;
        
        switch (this.filter) {
          case 'wins': return isWin;
          case 'losses': return isLoss;
          case 'draws': return isDraw;
          default: return true;
        }
      });
    }
    
    // Apply pagination
    const startIndex = (this.currentPage - 1) * this.gamesPerPage;
    const endIndex = startIndex + this.gamesPerPage;
    return filtered.slice(startIndex, endIndex);
  }

  get totalFilteredGames(): number {
    if (this.filter === 'all') return this.games.length;
    
    return this.games.filter(game => {
      const isWin = (game.result === '1-0' && game.playerColor === 'white') || 
                    (game.result === '0-1' && game.playerColor === 'black');
      const isDraw = game.result === '1/2-1/2';
      const isLoss = !isWin && !isDraw;
      
      switch (this.filter) {
        case 'wins': return isWin;
        case 'losses': return isLoss;
        case 'draws': return isDraw;
        default: return true;
      }
    }).length;
  }

  get totalPages(): number {
    return Math.ceil(this.totalFilteredGames / this.gamesPerPage);
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

  getFilterDisplayName(): string {
    switch (this.filter) {
      case 'wins': return 'wins';
      case 'losses': return 'losses';
      case 'draws': return 'draws';
      default: return 'games';
    }
  }

  getEmptyStateMessage(): string {
    switch (this.filter) {
      case 'wins': return 'You haven\'t won any games yet. Keep practicing!';
      case 'losses': return 'Great! You haven\'t lost any games.';
      case 'draws': return 'You haven\'t drawn any games yet. All your games have decisive results.';
      default: return 'No games found. Upload some PGN files to get started.';
    }
  }

  calculateAccuracy(analysis: any[], totalMoves: number): { white: number; black: number } {
    if (!analysis || analysis.length === 0) return { white: 0, black: 0 };
    
    const whiteMoves = analysis.filter((_, i) => i % 2 === 0); // Odd indices (1st, 3rd, 5th...)
    const blackMoves = analysis.filter((_, i) => i % 2 === 1); // Even indices (2nd, 4th, 6th...)
    
    const whiteAccuracy = whiteMoves.length > 0 ? 
      Math.round((1 - (whiteMoves.reduce((sum, move) => sum + move.centipawn_loss, 0) / (whiteMoves.length * 100))) * 100) : 0;
    const blackAccuracy = blackMoves.length > 0 ? 
      Math.round((1 - (blackMoves.reduce((sum, move) => sum + move.centipawn_loss, 0) / (blackMoves.length * 100))) * 100) : 0;
    
    return { 
      white: Math.max(0, Math.min(100, whiteAccuracy)), 
      black: Math.max(0, Math.min(100, blackAccuracy)) 
    };
  }

  calculateAccuracyFromAnalysis(analysis: any[], playerColor: 'white' | 'black'): { white: number; black: number } {
    if (!analysis || analysis.length === 0) return { white: 0, black: 0 };
    
    // Separate moves by color (move_number 1, 3, 5... are white, 2, 4, 6... are black)
    const whiteMoves = analysis.filter(move => move.move_number % 2 === 1);
    const blackMoves = analysis.filter(move => move.move_number % 2 === 0);
    
    const calculatePlayerAccuracy = (moves: any[]) => {
      if (moves.length === 0) return 0;
      const avgCentipawnLoss = moves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0) / moves.length;
      // Convert centipawn loss to accuracy percentage (lower loss = higher accuracy)
      return Math.max(0, Math.min(100, Math.round(100 - (avgCentipawnLoss / 2))));
    };
    
    return {
      white: calculatePlayerAccuracy(whiteMoves),
      black: calculatePlayerAccuracy(blackMoves)
    };
  }

  getPlayerAccuracy(game: Game): number {
    if (!game.accuracy) return 0;
    return game.playerColor === 'white' ? game.accuracy.white : game.accuracy.black;
  }

  onFilterChange() {
    this.currentPage = 1; // Reset to first page when filter changes
  }

  onGamesPerPageChange() {
    this.currentPage = 1; // Reset to first page when changing page size
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  getOpeningName(eco?: string): string {
    if (!eco) return 'Unknown Opening';
    
    // Comprehensive ECO to opening name mapping
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
      'A21': 'English Opening',
      'A22': 'English Opening',
      'A23': 'English Opening',
      'A24': 'English Opening',
      'A25': 'English Opening',
      'A26': 'English Opening',
      'A27': 'English Opening',
      'A28': 'English Opening',
      'A29': 'English Opening',
      'A30': 'English Opening',
      
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
      'B11': 'Caro-Kann Defense',
      'B12': 'Caro-Kann Defense',
      'B13': 'Caro-Kann Defense',
      'B14': 'Caro-Kann Defense',
      'B15': 'Caro-Kann Defense',
      'B16': 'Caro-Kann Defense',
      'B17': 'Caro-Kann Defense',
      'B18': 'Caro-Kann Defense',
      'B19': 'Caro-Kann Defense',
      'B20': 'Sicilian Defense',
      'B21': 'Sicilian Defense',
      'B22': 'Sicilian Defense',
      'B23': 'Sicilian Defense',
      'B24': 'Sicilian Defense',
      'B25': 'Sicilian Defense',
      'B26': 'Sicilian Defense',
      'B27': 'Sicilian Defense',
      'B28': 'Sicilian Defense',
      'B29': 'Sicilian Defense',
      'B30': 'Sicilian Defense',
      
      // C codes - Open games
      'C00': 'French Defense',
      'C01': 'French Defense',
      'C02': 'French Defense',
      'C03': 'French Defense',
      'C04': 'French Defense',
      'C05': 'French Defense',
      'C06': 'French Defense',
      'C07': 'French Defense',
      'C08': 'French Defense',
      'C09': 'French Defense',
      'C10': 'French Defense',
      'C11': 'French Defense',
      'C12': 'French Defense',
      'C13': 'French Defense',
      'C14': 'French Defense',
      'C15': 'French Defense',
      'C16': 'French Defense',
      'C17': 'French Defense',
      'C18': 'French Defense',
      'C19': 'French Defense',
      'C20': 'King\'s Pawn Game',
      'C21': 'Center Game',
      'C22': 'Center Game',
      'C23': 'Bishop\'s Opening',
      'C24': 'Bishop\'s Opening',
      'C25': 'Vienna Game',
      'C26': 'Vienna Game',
      'C27': 'Vienna Game',
      'C28': 'Vienna Game',
      'C29': 'Vienna Game',
      'C30': 'King\'s Gambit',
      'C40': 'King\'s Knight Opening',
      'C41': 'Philidor Defense',
      'C42': 'Petrov Defense',
      'C43': 'Petrov Defense',
      'C44': 'King\'s Pawn Game',
      'C45': 'Scotch Game',
      'C46': 'Three Knights Opening',
      'C47': 'Four Knights Game',
      'C48': 'Four Knights Game',
      'C49': 'Four Knights Game',
      'C50': 'Italian Game',
      'C51': 'Italian Game',
      'C52': 'Italian Game',
      'C53': 'Italian Game',
      'C54': 'Italian Game',
      'C55': 'Italian Game',
      'C56': 'Italian Game',
      'C57': 'Italian Game',
      'C58': 'Italian Game',
      'C59': 'Italian Game',
      'C60': 'Ruy Lopez',
      'C61': 'Ruy Lopez',
      'C62': 'Ruy Lopez',
      'C63': 'Ruy Lopez',
      'C64': 'Ruy Lopez',
      'C65': 'Ruy Lopez',
      'C66': 'Ruy Lopez',
      'C67': 'Ruy Lopez',
      'C68': 'Ruy Lopez',
      'C69': 'Ruy Lopez',
      'C70': 'Ruy Lopez',
      'C71': 'Ruy Lopez',
      'C72': 'Ruy Lopez',
      'C73': 'Ruy Lopez',
      'C74': 'Ruy Lopez',
      'C75': 'Ruy Lopez',
      'C76': 'Ruy Lopez',
      'C77': 'Ruy Lopez',
      'C78': 'Ruy Lopez',
      'C79': 'Ruy Lopez',
      'C80': 'Ruy Lopez',
      'C81': 'Ruy Lopez',
      'C82': 'Ruy Lopez',
      'C83': 'Ruy Lopez',
      'C84': 'Ruy Lopez',
      'C85': 'Ruy Lopez',
      'C86': 'Ruy Lopez',
      'C87': 'Ruy Lopez',
      'C88': 'Ruy Lopez',
      'C89': 'Ruy Lopez',
      'C90': 'Ruy Lopez',
      'C91': 'Ruy Lopez',
      'C92': 'Ruy Lopez',
      'C93': 'Ruy Lopez',
      'C94': 'Ruy Lopez',
      'C95': 'Ruy Lopez',
      'C96': 'Ruy Lopez',
      'C97': 'Ruy Lopez',
      'C98': 'Ruy Lopez',
      'C99': 'Ruy Lopez',
      
      // D codes - Closed games
      'D00': 'Queen\'s Pawn Game',
      'D01': 'Richter-Veresov Attack',
      'D02': 'Queen\'s Pawn Game',
      'D03': 'Torre Attack',
      'D04': 'Queen\'s Pawn Game',
      'D05': 'Queen\'s Pawn Game',
      'D06': 'Queen\'s Gambit',
      'D07': 'Queen\'s Gambit',
      'D08': 'Queen\'s Gambit',
      'D09': 'Queen\'s Gambit',
      'D10': 'Queen\'s Gambit Declined',
      'D11': 'Queen\'s Gambit Declined',
      'D12': 'Queen\'s Gambit Declined',
      'D13': 'Queen\'s Gambit Declined',
      'D14': 'Queen\'s Gambit Declined',
      'D15': 'Queen\'s Gambit Declined',
      'D16': 'Queen\'s Gambit Declined',
      'D17': 'Queen\'s Gambit Declined',
      'D18': 'Queen\'s Gambit Declined',
      'D19': 'Queen\'s Gambit Declined',
      'D20': 'Queen\'s Gambit Accepted',
      'D21': 'Queen\'s Gambit Accepted',
      'D22': 'Queen\'s Gambit Accepted',
      'D23': 'Queen\'s Gambit Accepted',
      'D24': 'Queen\'s Gambit Accepted',
      'D25': 'Queen\'s Gambit Accepted',
      'D26': 'Queen\'s Gambit Accepted',
      'D27': 'Queen\'s Gambit Accepted',
      'D28': 'Queen\'s Gambit Accepted',
      'D29': 'Queen\'s Gambit Accepted',
      'D30': 'Queen\'s Gambit Declined',
      'D31': 'Queen\'s Gambit Declined',
      'D32': 'Queen\'s Gambit Declined',
      'D33': 'Queen\'s Gambit Declined',
      'D34': 'Queen\'s Gambit Declined',
      'D35': 'Queen\'s Gambit Declined',
      'D36': 'Queen\'s Gambit Declined',
      'D37': 'Queen\'s Gambit Declined',
      'D38': 'Queen\'s Gambit Declined',
      'D39': 'Queen\'s Gambit Declined',
      'D40': 'Queen\'s Gambit Declined',
      'D41': 'Queen\'s Gambit Declined',
      'D42': 'Queen\'s Gambit Declined',
      'D43': 'Queen\'s Gambit Declined',
      'D44': 'Queen\'s Gambit Declined',
      'D45': 'Queen\'s Gambit Declined',
      'D46': 'Queen\'s Gambit Declined',
      'D47': 'Queen\'s Gambit Declined',
      'D48': 'Queen\'s Gambit Declined',
      'D49': 'Queen\'s Gambit Declined',
      'D50': 'Queen\'s Gambit Declined',
      'D60': 'Queen\'s Gambit Declined',
      'D70': 'Neo-Grünfeld Defense',
      'D80': 'Grünfeld Defense',
      'D85': 'Grünfeld Defense',
      'D90': 'Grünfeld Defense',
      
      // E codes - Indian defenses
      'E00': 'Queen\'s Pawn Game',
      'E01': 'Catalan Opening',
      'E02': 'Catalan Opening',
      'E03': 'Catalan Opening',
      'E04': 'Catalan Opening',
      'E05': 'Catalan Opening',
      'E06': 'Catalan Opening',
      'E07': 'Catalan Opening',
      'E08': 'Catalan Opening',
      'E09': 'Catalan Opening',
      'E10': 'Queen\'s Pawn Game',
      'E11': 'Bogo-Indian Defense',
      'E12': 'Queen\'s Indian Defense',
      'E13': 'Queen\'s Indian Defense',
      'E14': 'Queen\'s Indian Defense',
      'E15': 'Queen\'s Indian Defense',
      'E16': 'Queen\'s Indian Defense',
      'E17': 'Queen\'s Indian Defense',
      'E18': 'Queen\'s Indian Defense',
      'E19': 'Queen\'s Indian Defense',
      'E20': 'Nimzo-Indian Defense',
      'E21': 'Nimzo-Indian Defense',
      'E22': 'Nimzo-Indian Defense',
      'E23': 'Nimzo-Indian Defense',
      'E24': 'Nimzo-Indian Defense',
      'E25': 'Nimzo-Indian Defense',
      'E26': 'Nimzo-Indian Defense',
      'E27': 'Nimzo-Indian Defense',
      'E28': 'Nimzo-Indian Defense',
      'E29': 'Nimzo-Indian Defense',
      'E30': 'Nimzo-Indian Defense',
      'E31': 'Nimzo-Indian Defense',
      'E32': 'Nimzo-Indian Defense',
      'E33': 'Nimzo-Indian Defense',
      'E34': 'Nimzo-Indian Defense',
      'E35': 'Nimzo-Indian Defense',
      'E36': 'Nimzo-Indian Defense',
      'E37': 'Nimzo-Indian Defense',
      'E38': 'Nimzo-Indian Defense',
      'E39': 'Nimzo-Indian Defense',
      'E40': 'Nimzo-Indian Defense',
      'E41': 'Nimzo-Indian Defense',
      'E42': 'Nimzo-Indian Defense',
      'E43': 'Nimzo-Indian Defense',
      'E44': 'Nimzo-Indian Defense',
      'E45': 'Nimzo-Indian Defense',
      'E46': 'Nimzo-Indian Defense',
      'E47': 'Nimzo-Indian Defense',
      'E48': 'Nimzo-Indian Defense',
      'E49': 'Nimzo-Indian Defense',
      'E50': 'Nimzo-Indian Defense',
      'E51': 'Nimzo-Indian Defense',
      'E52': 'Nimzo-Indian Defense',
      'E53': 'Nimzo-Indian Defense',
      'E54': 'Nimzo-Indian Defense',
      'E55': 'Nimzo-Indian Defense',
      'E56': 'Nimzo-Indian Defense',
      'E57': 'Nimzo-Indian Defense',
      'E58': 'Nimzo-Indian Defense',
      'E59': 'Nimzo-Indian Defense',
      'E60': 'King\'s Indian Defense',
      'E61': 'King\'s Indian Defense',
      'E62': 'King\'s Indian Defense',
      'E63': 'King\'s Indian Defense',
      'E64': 'King\'s Indian Defense',
      'E65': 'King\'s Indian Defense',
      'E66': 'King\'s Indian Defense',
      'E67': 'King\'s Indian Defense',
      'E68': 'King\'s Indian Defense',
      'E69': 'King\'s Indian Defense',
      'E70': 'King\'s Indian Defense',
      'E71': 'King\'s Indian Defense',
      'E72': 'King\'s Indian Defense',
      'E73': 'King\'s Indian Defense',
      'E74': 'King\'s Indian Defense',
      'E75': 'King\'s Indian Defense',
      'E76': 'King\'s Indian Defense',
      'E77': 'King\'s Indian Defense',
      'E78': 'King\'s Indian Defense',
      'E79': 'King\'s Indian Defense',
      'E80': 'King\'s Indian Defense',
      'E81': 'King\'s Indian Defense',
      'E82': 'King\'s Indian Defense',
      'E83': 'King\'s Indian Defense',
      'E84': 'King\'s Indian Defense',
      'E85': 'King\'s Indian Defense',
      'E86': 'King\'s Indian Defense',
      'E87': 'King\'s Indian Defense',
      'E88': 'King\'s Indian Defense',
      'E89': 'King\'s Indian Defense',
      'E90': 'King\'s Indian Defense',
      'E91': 'King\'s Indian Defense',
      'E92': 'King\'s Indian Defense',
      'E93': 'King\'s Indian Defense',
      'E94': 'King\'s Indian Defense',
      'E95': 'King\'s Indian Defense',
      'E96': 'King\'s Indian Defense',
      'E97': 'King\'s Indian Defense',
      'E98': 'King\'s Indian Defense',
      'E99': 'King\'s Indian Defense'
    };
    
    return openings[eco] || `${eco} Opening`;
  }
}
