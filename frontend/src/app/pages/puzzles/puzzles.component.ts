import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PuzzleService, Puzzle, PuzzleProgress, LearningPath } from '../../services/puzzle.service';

@Component({
  selector: 'app-puzzles',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="puzzles-container">
      <!-- Header -->
      <div class="header">
        <h1>Puzzle Training</h1>
        <div class="daily-progress" *ngIf="dailyGoals">
          <span>Today: {{ dailyGoals.puzzlesSolved }}/{{ dailyGoals.puzzlesTarget }}</span>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="dailyGoals.progress"></div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading" *ngIf="loading">
        <div class="spinner"></div>
        <p>Loading puzzle...</p>
      </div>

      <!-- Error State -->
      <div class="error" *ngIf="error">
        <p>{{ error }}</p>
        <button (click)="loadNextPuzzle()">Try Again</button>
        <a *ngIf="currentPuzzle?.lichessUrl" [href]="currentPuzzle.lichessUrl" target="_blank" class="lichess-link">
          Open on Lichess ↗
        </a>
      </div>

      <!-- Puzzle Board -->
      <div class="puzzle-content" *ngIf="currentPuzzle && !loading && !error">
        <div class="puzzle-info">
          <span class="rating">Rating: {{ currentPuzzle.rating }}</span>
          <span class="themes">{{ formatThemes(currentPuzzle.themes) }}</span>
        </div>

        <div class="board-container">
          <div class="chessboard" #boardElement></div>
        </div>

        <!-- Controls -->
        <div class="controls">
          <button (click)="showHint()" [disabled]="hintShown || solved" class="btn-hint">
            💡 Hint
          </button>
          <button (click)="showSolution()" [disabled]="solved" class="btn-solution">
            👁 Solution
          </button>
          <button (click)="loadNextPuzzle()" class="btn-next">
            Next →
          </button>
        </div>

        <!-- Feedback -->
        <div class="feedback" *ngIf="feedback" [class]="feedbackClass">
          {{ feedback }}
        </div>

        <!-- Timer -->
        <div class="timer">
          ⏱ {{ formatTime(elapsedTime) }}
        </div>
      </div>

      <!-- Statistics -->
      <div class="stats-panel" *ngIf="statistics">
        <h3>Your Progress</h3>
        <div class="stat-grid">
          <div class="stat">
            <span class="value">{{ statistics.totalSolved }}</span>
            <span class="label">Solved</span>
          </div>
          <div class="stat">
            <span class="value">{{ statistics.successRate }}%</span>
            <span class="label">Success Rate</span>
          </div>
          <div class="stat">
            <span class="value">{{ statistics.averageMastery }}</span>
            <span class="label">Avg Mastery</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .puzzles-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .header h1 { margin: 0; }
    .daily-progress {
      text-align: right;
    }
    .progress-bar {
      width: 150px;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 4px;
    }
    .progress-fill {
      height: 100%;
      background: #4caf50;
      transition: width 0.3s;
    }
    .loading, .error {
      text-align: center;
      padding: 40px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error { color: #e74c3c; }
    .lichess-link {
      display: inline-block;
      margin-top: 10px;
      color: #3498db;
    }
    .puzzle-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
      color: #666;
    }
    .board-container {
      aspect-ratio: 1;
      max-width: 500px;
      margin: 0 auto;
      background: #f0d9b5;
      border-radius: 4px;
    }
    .chessboard {
      width: 100%;
      height: 100%;
    }
    .controls {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-top: 20px;
    }
    .controls button {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .btn-hint { background: #f39c12; color: white; }
    .btn-solution { background: #9b59b6; color: white; }
    .btn-next { background: #3498db; color: white; }
    .controls button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .feedback {
      text-align: center;
      padding: 15px;
      margin-top: 15px;
      border-radius: 4px;
      font-weight: bold;
    }
    .feedback.correct { background: #d4edda; color: #155724; }
    .feedback.incorrect { background: #f8d7da; color: #721c24; }
    .timer {
      text-align: center;
      margin-top: 10px;
      font-size: 18px;
      color: #666;
    }
    .stats-panel {
      margin-top: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .stats-panel h3 { margin: 0 0 15px; }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .stat {
      text-align: center;
    }
    .stat .value {
      display: block;
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
    }
    .stat .label {
      font-size: 12px;
      color: #666;
    }
  `]
})
export class PuzzlesComponent implements OnInit, OnDestroy {
  currentPuzzle: Puzzle | null = null;
  loading = false;
  error: string | null = null;
  solved = false;
  hintShown = false;
  feedback: string | null = null;
  feedbackClass = '';
  elapsedTime = 0;
  dailyGoals: LearningPath['dailyGoals'] | null = null;
  statistics: LearningPath['statistics'] | null = null;

  private timerInterval: any;
  private moveIndex = 0;
  private solutionMoves: string[] = [];

  constructor(
    private puzzleService: PuzzleService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadDailyGoals();
    this.loadStatistics();
    
    const puzzleId = this.route.snapshot.paramMap.get('id');
    if (puzzleId) {
      this.loadPuzzle(puzzleId);
    } else {
      this.loadNextPuzzle();
    }
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  loadPuzzle(puzzleId: string) {
    this.loading = true;
    this.error = null;
    this.resetState();

    this.puzzleService.getPuzzle(puzzleId).subscribe({
      next: (puzzle) => {
        if (puzzle.error) {
          this.error = 'Failed to load puzzle';
          this.currentPuzzle = puzzle;
        } else {
          this.currentPuzzle = puzzle;
          this.solutionMoves = puzzle.moves.split(' ');
          this.initBoard();
          this.startTimer();
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load puzzle';
        this.loading = false;
      }
    });
  }

  loadNextPuzzle() {
    this.loading = true;
    this.error = null;

    this.puzzleService.getRecommendations(1).subscribe({
      next: (puzzles) => {
        if (puzzles.length > 0) {
          this.loadPuzzle(puzzles[0].id);
        } else {
          this.error = 'No puzzles available';
          this.loading = false;
        }
      },
      error: () => {
        this.error = 'Failed to get recommendations';
        this.loading = false;
      }
    });
  }

  private resetState() {
    this.solved = false;
    this.hintShown = false;
    this.feedback = null;
    this.feedbackClass = '';
    this.moveIndex = 0;
    this.elapsedTime = 0;
    this.stopTimer();
  }

  private initBoard() {
    // Board initialization will use chessground library
    // For now, placeholder - actual implementation needs chessground
  }

  private startTimer() {
    this.timerInterval = setInterval(() => {
      this.elapsedTime++;
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  showHint() {
    if (this.solutionMoves.length > this.moveIndex) {
      this.hintShown = true;
      // Highlight the target square of the next move
      this.feedback = `Hint: Look at ${this.solutionMoves[this.moveIndex].slice(-2)}`;
      this.feedbackClass = '';
    }
  }

  showSolution() {
    this.solved = true;
    this.stopTimer();
    this.feedback = `Solution: ${this.solutionMoves.join(' ')}`;
    this.feedbackClass = '';
    this.recordAttempt(false);
  }

  private recordAttempt(solved: boolean) {
    if (!this.currentPuzzle) return;

    this.puzzleService.recordAttempt(this.currentPuzzle.id, {
      solved,
      timeSpent: this.elapsedTime,
      hintsUsed: this.hintShown ? 1 : 0
    }).subscribe({
      next: () => {
        this.loadDailyGoals();
        this.loadStatistics();
      }
    });
  }

  private loadDailyGoals() {
    this.puzzleService.getDailyGoals().subscribe({
      next: (goals) => this.dailyGoals = goals
    });
  }

  private loadStatistics() {
    this.puzzleService.getStatistics().subscribe({
      next: (stats) => this.statistics = stats
    });
  }

  formatThemes(themes: string): string {
    return themes.split(' ').slice(0, 3).join(', ');
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
