import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Chess } from 'chess.js';
import { Chessground } from '@lichess-org/chessground';
import { Key } from '@lichess-org/chessground/types';
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
          <div #boardElement class="chessboard"></div>
        </div>

        <div class="turn-indicator" [class.white]="isWhiteToMove" [class.black]="!isWhiteToMove">
          {{ isWhiteToMove ? 'White' : 'Black' }} to move
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
    @import '@lichess-org/chessground/assets/chessground.base.css';
    @import '@lichess-org/chessground/assets/chessground.brown.css';
    @import '@lichess-org/chessground/assets/chessground.cburnett.css';

    .puzzles-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .header h1 { margin: 0; font-size: 24px; }
    .daily-progress { text-align: right; }
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
      width: 100%;
      aspect-ratio: 1;
      max-width: 500px;
      margin: 0 auto;
    }
    .chessboard {
      width: 100%;
      height: 100%;
    }
    .turn-indicator {
      text-align: center;
      padding: 8px;
      margin-top: 10px;
      border-radius: 4px;
      font-weight: 500;
    }
    .turn-indicator.white { background: #f0f0f0; color: #333; }
    .turn-indicator.black { background: #333; color: #fff; }
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
    .stat { text-align: center; }
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
export class PuzzlesComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('boardElement') boardElement!: ElementRef<HTMLElement>;

  currentPuzzle: Puzzle | null = null;
  loading = false;
  error: string | null = null;
  solved = false;
  hintShown = false;
  feedback: string | null = null;
  feedbackClass = '';
  elapsedTime = 0;
  isWhiteToMove = true;
  dailyGoals: LearningPath['dailyGoals'] | null = null;
  statistics: LearningPath['statistics'] | null = null;

  private timerInterval: any;
  private moveIndex = 0;
  private solutionMoves: string[] = [];
  private chess = new Chess();
  private board: any = null;

  constructor(
    private puzzleService: PuzzleService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadDailyGoals();
    this.loadStatistics();
  }

  ngAfterViewInit() {
    const puzzleId = this.route.snapshot.paramMap.get('id');
    if (puzzleId) {
      this.loadPuzzle(puzzleId);
    } else {
      this.loadNextPuzzle();
    }
  }

  ngOnDestroy() {
    this.stopTimer();
    if (this.board) {
      this.board.destroy();
    }
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
          this.initBoard(puzzle.fen);
          this.startTimer();
        }
        this.loading = false;
      },
      error: () => {
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
          this.error = 'No puzzles available. Import puzzles first.';
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

  private initBoard(fen: string) {
    this.chess.load(fen);
    this.isWhiteToMove = this.chess.turn() === 'w';

    if (this.board) {
      this.board.destroy();
    }

    const orientation = this.isWhiteToMove ? 'white' : 'black';

    this.board = Chessground(this.boardElement.nativeElement, {
      fen: fen,
      orientation: orientation,
      turnColor: this.isWhiteToMove ? 'white' : 'black',
      movable: {
        free: false,
        color: orientation,
        dests: this.getLegalMoves(),
        events: {
          after: (orig: string, dest: string) => this.onMove(orig, dest)
        }
      },
      draggable: { enabled: true },
      selectable: { enabled: true },
      highlight: { lastMove: true, check: true }
    });

    // Play opponent's first move if puzzle starts with opponent
    if (this.solutionMoves.length > 0) {
      setTimeout(() => this.playOpponentMove(), 500);
    }
  }

  private getLegalMoves(): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    const moves = this.chess.moves({ verbose: true });
    for (const move of moves) {
      const from = move.from as Key;
      const to = move.to as Key;
      if (!dests.has(from)) {
        dests.set(from, []);
      }
      dests.get(from)!.push(to);
    }
    return dests;
  }

  private onMove(orig: string, dest: string) {
    const expectedMove = this.solutionMoves[this.moveIndex];
    const userMove = orig + dest;

    // Check if move matches (handle promotions)
    if (expectedMove.startsWith(userMove)) {
      // Correct move
      const promotion = expectedMove.length > 4 ? expectedMove[4] : undefined;
      this.chess.move({ from: orig, to: dest, promotion });
      this.moveIndex++;

      if (this.moveIndex >= this.solutionMoves.length) {
        // Puzzle solved!
        this.solved = true;
        this.feedback = '✓ Correct! Puzzle solved!';
        this.feedbackClass = 'correct';
        this.stopTimer();
        this.recordAttempt(true);
      } else {
        // Play opponent's response
        this.feedback = '✓ Correct!';
        this.feedbackClass = 'correct';
        setTimeout(() => this.playOpponentMove(), 300);
      }
    } else {
      // Wrong move - reset board
      this.feedback = '✗ Incorrect. Try again.';
      this.feedbackClass = 'incorrect';
      this.board.set({ fen: this.chess.fen(), movable: { dests: this.getLegalMoves() } });
    }
  }

  private playOpponentMove() {
    if (this.moveIndex >= this.solutionMoves.length) return;

    const move = this.solutionMoves[this.moveIndex];
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move.length > 4 ? move[4] : undefined;

    this.chess.move({ from, to, promotion });
    this.moveIndex++;

    this.board.set({
      fen: this.chess.fen(),
      lastMove: [from, to],
      turnColor: this.chess.turn() === 'w' ? 'white' : 'black',
      movable: { dests: this.getLegalMoves() }
    });

    this.feedback = null;
  }

  private startTimer() {
    this.timerInterval = setInterval(() => this.elapsedTime++, 1000);
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
      const move = this.solutionMoves[this.moveIndex];
      this.feedback = `Hint: Move to ${move.slice(2, 4)}`;
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
