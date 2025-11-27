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
              const [analysis, gameBlunders] = await Promise.all([
                this.chessApi.getGameAnalysis(game.id).toPromise(),
                this.chessApi.getGameBlunders(game.id).toPromise()
              ]);

              // Count blunders from blunder_details table (single source of truth)
              const blunderCount = gameBlunders?.length || 0;

              // Extract ECO and opening from PGN content
              const ecoMatch = analysis.game?.pgn_content?.match(/\[ECO "([^"]+)"\]/);
              const eco = ecoMatch ? ecoMatch[1] : undefined;

              // Calculate accuracy based on centipawn loss
              const accuracy = this.calculateAccuracyFromAnalysis(analysis.analysis, gameWithColor.playerColor);

              return {
                ...gameWithColor,
                blunders: blunderCount,
                eco: eco,
                opening: game.opening || 'Unknown Opening', // Use opening from backend API
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
}
