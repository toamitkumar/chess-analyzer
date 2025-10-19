import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { ChessBoardComponent } from '../components/chess-board/chess-board.component';
import { NavigationComponent } from '../components/navigation/navigation.component';
import { environment } from '../../environments/environment';

interface GameSummary {
  id: number;
  white_player: string;
  black_player: string;
  result: string;
  date: string;
  moves_count?: number;
}

@Component({
  selector: 'app-games-page',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, ChessBoardComponent, NavigationComponent],
  template: `
    <app-navigation></app-navigation>
    
    <div class="games-layout">
      <div class="container">
        <!-- Header -->
        <div class="page-header">
          <div class="header-content">
            <h1 class="page-title">Game Analysis</h1>
            <p class="page-subtitle">Analyze your chess games with detailed move-by-move insights</p>
          </div>
        </div>

        <!-- Main Content: Side by Side Layout -->
        <div class="games-content">
          <!-- Chess Board Section (Left) -->
          <div class="board-section">
            <div *ngIf="selectedGameData" class="board-container">
              <app-chess-board 
                [gameData]="selectedGameData"
                [currentMoveNumber]="currentMoveNumber"
                (moveChanged)="onMoveChanged($event)">
              </app-chess-board>
            </div>
            <div *ngIf="!selectedGameData" class="no-game-selected">
              <mat-icon>sports_esports</mat-icon>
              <p>Select a game to analyze</p>
            </div>
          </div>

          <!-- Games List Section (Right) -->
          <div class="games-list-section">
            <div class="section-header">
              <h2 class="section-title">
                <mat-icon>list</mat-icon>
                Games ({{games.length}})
              </h2>
            </div>
            
            <div class="loading-state" *ngIf="loading">
              <mat-spinner diameter="30"></mat-spinner>
              <p>Loading games...</p>
            </div>

            <div class="games-list" *ngIf="!loading">
              <div *ngFor="let game of games" 
                   class="game-card"
                   [class.selected]="selectedGame?.id === game.id"
                   (click)="selectGame(game)">
                <div class="game-content">
                  <div class="mini-board-container">
                    <div class="mini-board">
                      <div class="mini-squares">
                        <div class="square light"></div><div class="square dark"></div><div class="square light"></div><div class="square dark"></div>
                        <div class="square dark"></div><div class="square light"></div><div class="square dark"></div><div class="square light"></div>
                        <div class="square light"></div><div class="square dark"></div><div class="square light"></div><div class="square dark"></div>
                        <div class="square dark"></div><div class="square light"></div><div class="square dark"></div><div class="square light"></div>
                      </div>
                      <div class="pieces-overlay">
                        <span class="piece" style="top: 10%; left: 10%;">♜</span>
                        <span class="piece" style="top: 10%; right: 10%;">♜</span>
                        <span class="piece" style="top: 20%; left: 50%;">♛</span>
                        <span class="piece" style="bottom: 10%; left: 10%;">♖</span>
                        <span class="piece" style="bottom: 10%; right: 10%;">♖</span>
                        <span class="piece" style="bottom: 20%; left: 50%;">♕</span>
                      </div>
                    </div>
                  </div>
                  <div class="game-info">
                    <div class="game-title">{{game.white_player}} vs {{game.black_player}}</div>
                    <div class="game-meta">
                      <span>{{formatDate(game.date)}}</span>
                      <span>{{game.result}}</span>
                      <span>{{game.moves_count || 0}} moves</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .games-layout {
      min-height: calc(100vh - 4rem);
      background: var(--gray-50);
      padding: var(--space-8) 0;
    }
    
    .page-header {
      margin-bottom: var(--space-8);
    }
    
    .page-title {
      font-size: var(--text-3xl);
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: var(--space-2);
    }
    
    .page-subtitle {
      font-size: var(--text-lg);
      color: var(--gray-600);
    }
    
    .games-content {
      display: flex;
      gap: var(--space-6);
      overflow: hidden;
    }
    
    .board-section {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    
    .no-game-selected {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--gray-500);
      gap: var(--space-4);
      height: 400px;
      background: white;
      border-radius: var(--radius-xl);
      border: 1px solid var(--gray-200);
      padding: var(--space-8);
    }
    
    .no-game-selected mat-icon {
      font-size: 3rem !important;
      width: 3rem !important;
      height: 3rem !important;
      color: var(--gray-400);
    }
    
    .games-list-section {
      flex: 0 0 350px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    .section-header {
      margin-bottom: var(--space-4);
    }
    
    .section-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xl);
      font-weight: 600;
      color: var(--gray-900);
      margin: 0;
    }
    
    .section-title mat-icon {
      color: var(--primary-600);
    }
    
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-8);
      color: var(--gray-600);
    }
    
    .games-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    
    .game-card {
      background: white;
      border-radius: var(--radius-lg);
      border: 1px solid var(--gray-200);
      cursor: pointer;
      transition: all 0.2s ease;
      padding: var(--space-4);
    }
    
    .game-card:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
      border-color: var(--primary-200);
    }
    
    .game-card.selected {
      border-color: var(--primary-500);
      background: var(--primary-50);
      box-shadow: var(--shadow-lg);
    }
    
    .game-content {
      display: flex;
      gap: var(--space-3);
      align-items: center;
    }
    
    .mini-board-container {
      flex-shrink: 0;
    }
    
    .mini-board {
      width: 45px;
      height: 45px;
      border: 1px solid var(--gray-300);
      border-radius: var(--radius-sm);
      position: relative;
      overflow: hidden;
    }
    
    .mini-squares {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(4, 1fr);
      width: 100%;
      height: 100%;
    }
    
    .square {
      width: 100%;
      height: 100%;
    }
    
    .square.light { background: #f0d9b5; }
    .square.dark { background: #b58863; }
    
    .pieces-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    
    .piece {
      position: absolute;
      font-size: 8px;
      color: #333;
      text-shadow: 0 0 1px rgba(255,255,255,0.8);
      transform: translate(-50%, -50%);
    }
    
    .game-info {
      flex: 1;
      min-width: 0;
    }
    
    .game-title {
      font-weight: 600;
      margin-bottom: var(--space-1);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: var(--text-sm);
      color: var(--gray-900);
    }
    
    .game-meta {
      display: flex;
      gap: var(--space-2);
      font-size: var(--text-xs);
      color: var(--gray-500);
      flex-wrap: wrap;
    }
    
    @media (max-width: 768px) {
      .games-content {
        flex-direction: column;
        gap: var(--space-4);
      }
      
      .games-list-section {
        flex: none;
      }
      
      .page-title {
        font-size: var(--text-2xl);
      }
    }
  `]
})
export class GamesPageComponent implements OnInit {
  tournamentId: number | null = null;
  tournamentName: string = '';
  games: GameSummary[] = [];
  selectedGame: GameSummary | null = null;
  selectedGameData: any = null;
  currentMoveNumber: number = 0;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.tournamentId = params['tournamentId'] ? parseInt(params['tournamentId']) : null;
      this.loadGames();
    });
  }

  async loadGames() {
    try {
      this.loading = true;
      
      // Load tournament name if we have a tournament ID
      if (this.tournamentId) {
        try {
          const tournament = await this.http.get<any>(`${environment.apiUrl}/api/tournaments/${this.tournamentId}`).toPromise();
          this.tournamentName = tournament?.name || 'Tournament Games';
        } catch (error) {
          console.error('Failed to load tournament details:', error);
          this.tournamentName = 'Tournament Games';
        }
      }
      
      const url = this.tournamentId 
        ? `${environment.apiUrl}/api/tournaments/${this.tournamentId}/games`
        : `${environment.apiUrl}/api/games`;
      
      this.games = await this.http.get<GameSummary[]>(url).toPromise() || [];
      
      // Load first game by default
      if (this.games.length > 0) {
        await this.selectGame(this.games[0]);
      }
    } catch (error) {
      console.error('Failed to load games:', error);
      this.games = [];
    } finally {
      this.loading = false;
    }
  }

  async selectGame(game: GameSummary) {
    // Don't reload if same game is clicked
    if (this.selectedGame?.id === game.id) {
      return;
    }
    
    this.selectedGame = game;
    this.currentMoveNumber = 0;
    
    try {
      this.selectedGameData = await this.http.get<any>(`${environment.apiUrl}/api/games/${game.id}/analysis`).toPromise();
    } catch (error) {
      console.error('Failed to load game analysis:', error);
      this.selectedGameData = null;
    }
  }

  onMoveChanged(moveNumber: number) {
    this.currentMoveNumber = moveNumber;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Unknown date';
    
    try {
      const cleanDate = dateStr.replace(/\./g, '-');
      const date = new Date(cleanDate);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }
}
