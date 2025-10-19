import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { ChessBoardComponent } from '../components/chess-board/chess-board.component';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-game-analysis',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, ChessBoardComponent],
  template: `
    <div class="game-analysis-page">
      <!-- Compact Header -->
      <div class="page-header" *ngIf="gameData && !loading && !error">
        <div class="breadcrumb">
          <a routerLink="/dashboard">Dashboard</a>
          <mat-icon>chevron_right</mat-icon>
          <span>{{gameData.game.white_player}} vs {{gameData.game.black_player}}</span>
        </div>
        <div class="game-meta">
          <span>{{formatDate(gameData.game.date)}}</span>
          <span>{{gameData.game.result}}</span>
          <span>{{gameData.analysis.length}} moves</span>
        </div>
      </div>
      
      <!-- Loading State -->
      <div class="loading-container" *ngIf="loading">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading game analysis...</p>
      </div>
      
      <!-- Error State -->
      <div class="error-container" *ngIf="error && !loading">
        <mat-icon>error_outline</mat-icon>
        <h3>Game Not Found</h3>
        <p>{{error}}</p>
        <button mat-raised-button color="primary" (click)="goBack()">Go Back</button>
      </div>
      
      <!-- Main Content -->
      <div class="main-content" *ngIf="gameData && !loading && !error">
        <app-chess-board 
          [gameData]="gameData"
          [currentMoveNumber]="currentMoveNumber"
          (moveChanged)="onMoveChanged($event)">
        </app-chess-board>
      </div>
    </div>
  `,
  styles: [`
    .game-analysis-page {
      padding: 0.5rem;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .page-header {
      background: white;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 1rem;
    }
    
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }
    
    .breadcrumb a {
      color: #1976d2;
      text-decoration: none;
    }
    
    .game-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      color: #666;
    }
    
    .loading-container, .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      gap: 1rem;
    }
    
    .main-content {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 1rem;
    }
    
    @media (max-width: 768px) {
      .game-meta {
        flex-direction: column;
        gap: 0.25rem;
      }
    }
  `]
})
export class GameAnalysisComponent implements OnInit {
  gameId: number = 0;
  tournamentId: number | null = null;
  gameData: any = null;
  currentMoveNumber: number = 0;
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.gameId = parseInt(params['gameId'] || params['id']);
      this.tournamentId = params['tournamentId'] ? parseInt(params['tournamentId']) : null;
      this.loadGameAnalysis();
    });
  }

  async loadGameAnalysis() {
    try {
      this.loading = true;
      this.error = null;
      
      const response = await this.http.get<any>(`${environment.apiUrl}/api/games/${this.gameId}/analysis`).toPromise();
      
      if (response) {
        this.gameData = response;
        console.log('🎮 Loaded game analysis:', this.gameData);
      } else {
        this.error = 'Game analysis not found';
      }
      
    } catch (error: any) {
      console.error('❌ Failed to load game analysis:', error);
      this.error = error.status === 404 ? 'Game not found' : 'Failed to load game analysis';
    } finally {
      this.loading = false;
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
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  goBack() {
    if (this.tournamentId) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}
