import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

export interface GameSummary {
  id: number;
  white_player: string;
  black_player: string;
  result: string;
  date: string;
  accuracy?: number;
  blunders?: number;
  moves_count?: number;
}

@Component({
  selector: 'app-game-list',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="games-section" *ngIf="games.length > 0">
      <h3 class="section-title">
        <mat-icon>sports_esports</mat-icon>
        Tournament Games ({{games.length}})
      </h3>
      
      <div class="games-grid">
        <mat-card *ngFor="let game of games" 
                  class="game-card"
                  [class]="getPerformanceClass(game)">
          <mat-card-header class="game-header">
            <mat-card-title class="game-title">
              {{game.white_player}} vs {{game.black_player}}
            </mat-card-title>
            <mat-card-subtitle class="game-subtitle">
              {{formatDate(game.date)}} • {{game.result}} • {{game.moves_count || 0}} moves
            </mat-card-subtitle>
          </mat-card-header>
          
          <mat-card-content class="game-content">
            <div class="game-metrics">
              <div class="metric" *ngIf="game.accuracy !== undefined">
                <mat-icon class="metric-icon">target</mat-icon>
                <span class="metric-value">{{game.accuracy}}%</span>
                <span class="metric-label">accuracy</span>
              </div>
              <div class="metric" *ngIf="game.blunders !== undefined">
                <mat-icon class="metric-icon">warning</mat-icon>
                <span class="metric-value">{{game.blunders}}</span>
                <span class="metric-label">blunders</span>
              </div>
            </div>
          </mat-card-content>
          
          <mat-card-actions class="game-actions">
            <button mat-raised-button color="primary" 
                    (click)="viewAnalysis(game.id)"
                    class="analysis-btn">
              <mat-icon>analytics</mat-icon>
              View Analysis
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
    
    <div class="no-games" *ngIf="games.length === 0">
      <mat-icon class="no-games-icon">sports_esports</mat-icon>
      <h3>No Games Found</h3>
      <p>No games available for this tournament.</p>
    </div>
  `,
  styles: [`
    .games-section {
      margin-top: 2rem;
    }
    
    .section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.25rem;
      font-weight: 600;
      color: #333;
      margin-bottom: 1rem;
    }
    
    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }
    
    .game-card {
      transition: all 0.3s ease;
      cursor: pointer;
    }
    
    .game-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .game-card.excellent {
      border-left: 4px solid #10b981;
    }
    
    .game-card.good {
      border-left: 4px solid #059669;
    }
    
    .game-card.average {
      border-left: 4px solid #f59e0b;
    }
    
    .game-card.poor {
      border-left: 4px solid #ef4444;
    }
    
    .game-header {
      padding-bottom: 0.5rem;
    }
    
    .game-title {
      font-size: 1rem;
      font-weight: 600;
    }
    
    .game-subtitle {
      font-size: 0.85rem;
      color: #666;
    }
    
    .game-content {
      padding: 0.75rem 1rem;
    }
    
    .game-metrics {
      display: flex;
      gap: 1.5rem;
    }
    
    .metric {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    
    .metric-icon {
      font-size: 1rem !important;
      width: 1rem !important;
      height: 1rem !important;
      color: #666;
    }
    
    .metric-value {
      font-weight: 600;
      color: #333;
    }
    
    .metric-label {
      font-size: 0.8rem;
      color: #666;
    }
    
    .game-actions {
      padding: 0.5rem 1rem 1rem 1rem;
    }
    
    .analysis-btn {
      width: 100%;
    }
    
    .no-games {
      text-align: center;
      padding: 3rem 1rem;
      color: #666;
    }
    
    .no-games-icon {
      font-size: 3rem !important;
      width: 3rem !important;
      height: 3rem !important;
      margin-bottom: 1rem;
      color: #ccc;
    }
    
    @media (max-width: 768px) {
      .games-grid {
        grid-template-columns: 1fr;
      }
      
      .game-metrics {
        justify-content: space-around;
      }
    }
  `]
})
export class GameListComponent {
  @Input() games: GameSummary[] = [];
  @Input() tournamentId: number | null = null;

  constructor(private router: Router) {}

  viewAnalysis(gameId: number) {
    if (this.tournamentId) {
      this.router.navigate(['/tournaments', this.tournamentId, 'games', gameId, 'analysis']);
    } else {
      this.router.navigate(['/games', gameId, 'analysis']);
    }
  }

  getPerformanceClass(game: GameSummary): string {
    if (!game.accuracy) return '';
    
    if (game.accuracy >= 90 && (game.blunders || 0) <= 3) return 'excellent';
    if (game.accuracy >= 80 && (game.blunders || 0) <= 6) return 'good';
    if (game.accuracy >= 70 && (game.blunders || 0) <= 10) return 'average';
    return 'poor';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Unknown date';
    
    try {
      // Handle PGN date format (YYYY.MM.DD)
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
