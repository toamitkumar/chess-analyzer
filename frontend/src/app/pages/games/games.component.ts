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
      <div class="space-y-8 pb-8">
        <!-- Header Section with Glass Effect -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in sticky top-0 z-10 -mx-6 px-6 py-4 glass-effect">
          <div>
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gradient tracking-tight mb-2">Game Analysis</h1>
            <p class="text-sm sm:text-base text-muted-foreground">Review and analyze your chess games</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <label class="text-sm text-muted-foreground font-medium">Per page:</label>
              <select 
                [(ngModel)]="gamesPerPage"
                (ngModelChange)="onGamesPerPageChange()"
                class="flex h-9 w-16 items-center justify-center rounded-lg border-2 border-border/50 bg-card/80 backdrop-blur-sm px-2 py-1 text-sm font-medium shadow-md hover:border-primary/50 transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option *ngFor="let option of gamesPerPageOptions" [value]="option">{{ option }}</option>
              </select>
            </div>
            <div class="relative">
              <select 
                [(ngModel)]="filter"
                (ngModelChange)="onFilterChange()"
                class="flex h-11 w-[200px] items-center justify-between rounded-xl border-2 border-border/50 bg-card/80 backdrop-blur-sm px-4 py-2 text-sm font-medium shadow-lg hover:border-primary/50 hover:shadow-glow-primary transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none">
                <option value="all">All Games</option>
                <option value="wins">Wins Only</option>
                <option value="losses">Losses Only</option>
                <option value="draws">Draws Only</option>
              </select>
              <svg class="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- Games Grid -->
        <div class="grid gap-4 sm:gap-6 animate-slide-up">
          <div *ngFor="let game of filteredGames" 
               class="group rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-xl hover:shadow-glow-primary hover:border-primary/50 transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-sm sm:hover:scale-[1.01] sm:hover:-translate-y-1"
               [routerLink]="['/games', game.id]">
            <div class="p-4 sm:p-6 bg-gradient-to-br from-primary/5 to-transparent">
              <div class="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 sm:gap-0">
                <div class="flex-1 space-y-3 w-full">
                  <div class="flex flex-wrap items-center gap-2">
                    <span [class]="'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold shadow-md ' + getResultBadgeClass(game.result, game.playerColor)">
                      {{ getResultText(game.result, game.playerColor) }}
                    </span>
                    <span *ngIf="game.event" class="inline-flex items-center rounded-full border-2 border-border/50 px-3 py-1 text-xs font-semibold bg-card/80 backdrop-blur-sm shadow-md gap-1.5">
                      <svg class="h-3 w-3 text-primary" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                        <path d="M4 22h16"/>
                        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                      </svg>
                      {{ game.event }}
                    </span>
                    <span class="text-xs sm:text-sm text-muted-foreground font-medium">{{ formatDate(game.date) }}</span>
                  </div>
                  
                  <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <div class="flex items-center gap-2.5">
                      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-300 shadow-md border-2 border-white/50">
                        <svg class="h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M2 20h20l-2-6-4 2-4-4-4 4-4-2z"/>
                          <path d="M6 4l2 4 4-2 4 2 2-4"/>
                        </svg>
                      </div>
                      <div>
                        <p class="text-sm font-bold text-foreground">{{ game.white_player }}</p>
                        <div class="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                          <span *ngIf="game.white_elo">{{ game.white_elo }} ELO</span>
                          <span *ngIf="!game.white_elo">Unrated</span>
                        </div>
                      </div>
                    </div>
                    
                    <span class="hidden sm:inline text-muted-foreground font-medium">vs</span>
                    
                    <div class="flex items-center gap-2.5">
                      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 shadow-md border-2 border-gray-600/50">
                        <svg class="h-5 w-5 text-gray-100" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M2 20h20l-2-6-4 2-4-4-4 4-4-2z"/>
                          <path d="M6 4l2 4 4-2 4 2 2-4"/>
                        </svg>
                      </div>
                      <div>
                        <p class="text-sm font-bold text-foreground">{{ game.black_player }}</p>
                        <div class="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                          <span *ngIf="game.black_elo">{{ game.black_elo }} ELO</span>
                          <span *ngIf="!game.black_elo">Unrated</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Analysis Data -->
                  <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div class="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-card/50 border border-border/30">
                      <svg class="h-4 w-4 text-primary flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 11H5a2 2 0 0 0-2 2v3c0 5.5 4.5 10 10 10s10-4.5 10-10v-3a2 2 0 0 0-2-2h-4"/>
                        <path d="M9 7V4a2 2 0 0 1 4 0v3"/>
                      </svg>
                      <div class="flex flex-col">
                        <span class="text-muted-foreground text-xs">Moves</span>
                        <span class="text-foreground font-bold">{{ game.moves_count }}</span>
                      </div>
                    </div>
                    
                    <div *ngIf="game.accuracy" class="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-success/10 border border-success/30">
                      <svg class="h-4 w-4 text-success flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                      </svg>
                      <div class="flex flex-col">
                        <span class="text-success/80 text-xs">Accuracy</span>
                        <span class="text-success font-bold">{{ getPlayerAccuracy(game) }}%</span>
                      </div>
                    </div>
                    
                    <div *ngIf="game.blunders !== undefined" class="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                      <svg class="h-4 w-4 text-destructive flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <div class="flex flex-col">
                        <span class="text-destructive/80 text-xs">Blunders</span>
                        <span class="text-destructive font-bold">{{ game.blunders }}</span>
                      </div>
                    </div>
                    
                    <div *ngIf="game.opening" class="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-chart-1/10 border border-chart-1/30 col-span-2 sm:col-span-1">
                      <svg class="h-4 w-4 text-chart-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14,2 14,8 20,8"/>
                      </svg>
                      <div class="flex flex-col min-w-0">
                        <span class="text-chart-1/80 text-xs">Opening</span>
                        <span class="text-chart-1 font-bold text-xs truncate">{{ game.opening }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button class="hidden sm:inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-300 hover:bg-primary/10 hover:text-primary h-12 w-12 flex-shrink-0 group-hover:scale-110">
                  <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          <!-- Empty state when no games match filter -->
          <div *ngIf="!loading && filteredGames.length === 0" class="text-center py-12 sm:py-16 animate-fade-in">
            <div class="rounded-2xl border-2 border-border/30 bg-card/50 backdrop-blur-sm p-8 sm:p-12 max-w-md mx-auto">
              <svg class="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p class="text-lg sm:text-xl font-bold text-foreground mb-2">No {{ getFilterDisplayName() }} found</p>
              <p class="text-sm text-muted-foreground">{{ getEmptyStateMessage() }}</p>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="flex flex-col justify-center items-center py-12 sm:py-16 animate-fade-in">
          <div class="relative">
            <div class="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <div class="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-transparent border-t-accent rounded-full animate-spin" style="animation-duration: 1.5s;"></div>
          </div>
          <p class="text-muted-foreground mt-6 text-sm font-medium">Loading games...</p>
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
              <h3 class="text-base sm:text-lg font-bold text-destructive mb-1">Error Loading Games</h3>
              <p class="text-sm text-foreground/80">{{ error }}</p>
            </div>
          </div>
        </div>

        <!-- Pagination Controls -->
        <div *ngIf="!loading && totalPages > 1" class="flex flex-col sm:flex-row items-center justify-between gap-4 border-t-2 border-border/30 pt-6 animate-fade-in">
          <div class="text-xs sm:text-sm text-muted-foreground font-medium order-2 sm:order-1">
            Showing <span class="font-bold text-foreground">{{ (currentPage - 1) * gamesPerPage + 1 }}</span> to <span class="font-bold text-foreground">{{ Math.min(currentPage * gamesPerPage, totalFilteredGames) }}</span> of <span class="font-bold text-foreground">{{ totalFilteredGames }}</span> games
          </div>
          <div class="flex items-center gap-2 order-1 sm:order-2">
            <button 
              (click)="previousPage()"
              [disabled]="currentPage === 1"
              class="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-30 border-2 border-border/50 bg-card/80 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-md hover:shadow-lg h-9 w-9 sm:h-10 sm:w-10">
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            
            <div class="flex items-center gap-1 sm:gap-2">
              <button 
                *ngFor="let page of [].constructor(totalPages); let i = index"
                (click)="goToPage(i + 1)"
                [class]="'inline-flex items-center justify-center rounded-lg text-sm font-bold transition-all duration-300 h-9 w-9 sm:h-10 sm:w-10 shadow-md ' + (currentPage === i + 1 ? 'bg-primary text-primary-foreground border-2 border-primary scale-110 shadow-glow-primary' : 'border-2 border-border/50 bg-card/80 backdrop-blur-sm hover:bg-accent hover:border-accent hover:scale-105')">
                {{ i + 1 }}
              </button>
            </div>
            
            <button 
              (click)="nextPage()"
              [disabled]="currentPage === totalPages"
              class="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-30 border-2 border-border/50 bg-card/80 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-md hover:shadow-lg h-9 w-9 sm:h-10 sm:w-10">
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
