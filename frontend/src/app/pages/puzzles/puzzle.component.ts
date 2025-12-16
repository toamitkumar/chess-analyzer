import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Chess, Move } from 'chess.js';
import { Chessground } from '@lichess-org/chessground';
import { Config } from '@lichess-org/chessground/config';
import { Key } from '@lichess-org/chessground/types';
import { PuzzleService, Puzzle, AttemptRequest } from '../../services/puzzle.service';

type PuzzleStatus = 'loading' | 'playing' | 'correct' | 'incorrect' | 'complete' | 'failed';

@Component({
  selector: 'app-puzzle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="puzzle-container">
      <!-- Header -->
      <div class="puzzle-header">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Puzzle Practice</h1>
            <div *ngIf="puzzle" class="text-sm text-gray-600 mt-1">
              <span>Rating: {{ puzzle.puzzle.rating }}</span>
              <span class="mx-2">•</span>
              <span>Played {{ puzzle.puzzle.plays }} times</span>
            </div>
          </div>
          <button
            (click)="goBack()"
            class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors">
            ← Back
          </button>
        </div>

        <!-- Themes -->
        <div *ngIf="puzzle && puzzle.puzzle.themes.length > 0" class="flex gap-2 mt-3">
          <span *ngFor="let theme of puzzle.puzzle.themes"
                class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
            {{ theme }}
          </span>
        </div>
      </div>

      <!-- Loading state -->
      <div *ngIf="status === 'loading'" class="puzzle-loading">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading puzzle...</p>
      </div>

      <!-- Puzzle content -->
      <div *ngIf="status !== 'loading'" class="puzzle-content">
        <!-- Board section -->
        <div class="board-section">
          <!-- Instruction -->
          <div *ngIf="status === 'playing'" class="puzzle-instruction">
            <svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>{{ getTurnInstruction() }}</span>
          </div>

          <!-- Chess board -->
          <div class="chess-board-wrapper">
            <div #chessBoard class="chess-board"></div>
          </div>

          <!-- Controls -->
          <div class="puzzle-controls">
            <button
              (click)="showHint()"
              [disabled]="status !== 'playing' || hintsUsed >= maxHints"
              class="control-btn hint-btn">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              <span>Hint</span>
              <span class="text-xs">({{ maxHints - hintsUsed }} left)</span>
            </button>

            <button
              (click)="showSolution()"
              [disabled]="status !== 'playing'"
              class="control-btn solution-btn">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              <span>Show Solution</span>
            </button>

            <button
              (click)="resetPuzzle()"
              class="control-btn reset-btn">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <span>Reset</span>
            </button>
          </div>
        </div>

        <!-- Feedback section -->
        <div class="feedback-section">
          <!-- Success feedback -->
          <div *ngIf="status === 'correct'" class="feedback-card success">
            <div class="feedback-icon">
              <svg class="h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 class="feedback-title">Excellent!</h3>
            <p class="feedback-message">Continue the sequence...</p>
          </div>

          <!-- Error feedback -->
          <div *ngIf="status === 'incorrect'" class="feedback-card error">
            <div class="feedback-icon">
              <svg class="h-12 w-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 class="feedback-title">Not quite!</h3>
            <p class="feedback-message">{{ feedbackMessage }}</p>
            <button (click)="retryMove()" class="retry-btn">Try Again</button>
          </div>

          <!-- Complete feedback -->
          <div *ngIf="status === 'complete'" class="feedback-card complete">
            <div class="feedback-icon">
              <svg class="h-16 w-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Puzzle Solved!</h3>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">Time</span>
                <span class="stat-value">{{ formatTime(elapsedTime) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Attempts</span>
                <span class="stat-value">{{ attempts }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Hints Used</span>
                <span class="stat-value">{{ hintsUsed }}</span>
              </div>
            </div>
            <div class="mt-6 flex gap-3">
              <button (click)="nextPuzzle()" class="primary-btn">
                Next Puzzle →
              </button>
              <button (click)="goToRecommendations()" class="secondary-btn">
                More Puzzles
              </button>
            </div>
          </div>

          <!-- Failed feedback -->
          <div *ngIf="status === 'failed'" class="feedback-card complete">
            <div class="feedback-icon">
              <svg class="h-16 w-16 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Solution Shown</h3>
            <p class="text-gray-600 mb-4">Review the moves to understand the pattern</p>
            <div class="mt-6 flex gap-3">
              <button (click)="nextPuzzle()" class="primary-btn">
                Next Puzzle →
              </button>
              <button (click)="resetPuzzle()" class="secondary-btn">
                Try Again
              </button>
            </div>
          </div>

          <!-- Progress info -->
          <div *ngIf="status === 'playing'" class="progress-info">
            <div class="progress-item">
              <span class="progress-label">⏱️ Time</span>
              <span class="progress-value">{{ formatTime(elapsedTime) }}</span>
            </div>
            <div class="progress-item">
              <span class="progress-label">🎯 Attempts</span>
              <span class="progress-value">{{ attempts }}</span>
            </div>
            <div class="progress-item">
              <span class="progress-label">💡 Hints</span>
              <span class="progress-value">{{ hintsUsed }}/{{ maxHints }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .puzzle-container {
      @apply max-w-7xl mx-auto p-4;
    }

    .puzzle-header {
      @apply bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6;
    }

    .puzzle-loading {
      @apply flex flex-col items-center justify-center py-20;
    }

    .puzzle-content {
      @apply grid grid-cols-1 lg:grid-cols-2 gap-6;
    }

    .board-section {
      @apply bg-white rounded-lg shadow-sm border border-gray-200 p-6;
    }

    .puzzle-instruction {
      @apply flex items-center gap-2 px-4 py-3 mb-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-md;
    }

    .chess-board-wrapper {
      @apply relative mx-auto;
      width: clamp(320px, 100%, 520px);
      aspect-ratio: 1;
    }

    .chess-board {
      width: 100%;
      height: 100%;
      background: #f0d9b5;
    }

    .puzzle-controls {
      @apply flex flex-wrap items-center justify-center gap-3 mt-6;
    }

    .control-btn {
      @apply flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all;
      @apply focus:outline-none focus:ring-2 focus:ring-offset-2;
    }

    .hint-btn {
      @apply bg-yellow-100 hover:bg-yellow-200 text-yellow-900 focus:ring-yellow-500;
    }

    .solution-btn {
      @apply bg-orange-100 hover:bg-orange-200 text-orange-900 focus:ring-orange-500;
    }

    .reset-btn {
      @apply bg-gray-100 hover:bg-gray-200 text-gray-700 focus:ring-gray-500;
    }

    .control-btn:disabled {
      @apply opacity-50 cursor-not-allowed;
    }

    .feedback-section {
      @apply bg-white rounded-lg shadow-sm border border-gray-200 p-6;
    }

    .feedback-card {
      @apply flex flex-col items-center text-center p-6 rounded-lg;
    }

    .feedback-card.success {
      @apply bg-green-50 border border-green-200;
    }

    .feedback-card.error {
      @apply bg-red-50 border border-red-200;
    }

    .feedback-card.complete {
      @apply bg-gradient-to-br from-green-50 to-blue-50 border border-green-200;
    }

    .feedback-icon {
      @apply mb-4;
    }

    .feedback-title {
      @apply text-xl font-bold text-gray-900 mb-2;
    }

    .feedback-message {
      @apply text-gray-700;
    }

    .retry-btn {
      @apply mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors;
    }

    .stats-grid {
      @apply grid grid-cols-3 gap-4 w-full mt-4;
    }

    .stat-item {
      @apply flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200;
    }

    .stat-label {
      @apply text-sm text-gray-600 mb-1;
    }

    .stat-value {
      @apply text-lg font-bold text-gray-900;
    }

    .primary-btn {
      @apply px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors;
      @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
    }

    .secondary-btn {
      @apply px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition-colors;
      @apply focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2;
    }

    .progress-info {
      @apply grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4;
    }

    .progress-item {
      @apply flex flex-col items-center p-4 bg-gray-50 rounded-lg border border-gray-200;
    }

    .progress-label {
      @apply text-sm text-gray-600 mb-1;
    }

    .progress-value {
      @apply text-xl font-bold text-gray-900;
    }

    @media (max-width: 1024px) {
      .puzzle-content {
        @apply grid-cols-1;
      }
    }
  `]
})
export class PuzzleComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chessBoard', { static: false }) chessBoardElement!: ElementRef;

  puzzle: Puzzle | null = null;
  status: PuzzleStatus = 'loading';
  feedbackMessage: string = '';

  private board: ReturnType<typeof Chessground> | null = null;
  private game!: Chess;
  private solutionMoves: string[] = []; // UCI format moves
  private currentMoveIndex: number = 0;
  private userMoves: string[] = [];
  private timer: any;

  startTime: number = 0;
  elapsedTime: number = 0;
  attempts: number = 0;
  hintsUsed: number = 0;
  maxHints: number = 3;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private puzzleService: PuzzleService
  ) {}

  ngOnInit() {
    const puzzleId = this.route.snapshot.params['id'];
    if (puzzleId) {
      this.loadPuzzle(puzzleId);
    } else {
      // Load a recommended puzzle
      this.loadRecommendedPuzzle();
    }
  }

  ngAfterViewInit() {
    // Board will be initialized after puzzle loads
  }

  ngOnDestroy() {
    this.stopTimer();
    if (this.board) {
      this.board.destroy();
    }
  }

  private async loadPuzzle(puzzleId: string) {
    try {
      this.status = 'loading';
      this.puzzle = await this.puzzleService.getPuzzle(puzzleId).toPromise() || null;

      if (this.puzzle) {
        this.solutionMoves = this.puzzle.puzzle.solution;
        this.game = new Chess(this.puzzle.puzzle.fen);

        // Play the first move (opponent's move that sets up the puzzle)
        setTimeout(() => {
          this.initializeBoard();
          this.startPuzzle();
        }, 100);
      }
    } catch (error) {
      console.error('Error loading puzzle:', error);
      this.feedbackMessage = 'Failed to load puzzle';
      this.status = 'failed';
    }
  }

  private async loadRecommendedPuzzle() {
    try {
      const response = await this.puzzleService.getRecommendations(1).toPromise();
      if (response && 'recommendations' in response && response.recommendations.length > 0) {
        const puzzleId = response.recommendations[0].id;
        this.loadPuzzle(puzzleId);
      } else {
        this.feedbackMessage = 'No puzzles available';
        this.status = 'failed';
      }
    } catch (error) {
      console.error('Error loading recommended puzzle:', error);
      this.feedbackMessage = 'Failed to load recommendations';
      this.status = 'failed';
    }
  }

  private initializeBoard() {
    const element = this.chessBoardElement?.nativeElement;
    if (!element || !this.puzzle) {
      return;
    }

    const turnColor = this.game.turn() === 'w' ? 'white' : 'black';

    const config: Config = {
      fen: this.game.fen(),
      orientation: turnColor as 'white' | 'black',
      movable: {
        free: false,
        color: turnColor as 'white' | 'black',
        dests: this.getMoveDests()
      },
      events: {
        move: (orig: Key, dest: Key) => {
          this.onUserMove(orig, dest);
        }
      },
      coordinates: true,
      highlight: {
        lastMove: true,
        check: true
      },
      animation: {
        enabled: true,
        duration: 200
      },
      drawable: {
        enabled: false
      }
    };

    this.board = Chessground(element, config);
  }

  private getMoveDests(): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    const moves = this.game.moves({ verbose: true });

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

  private startPuzzle() {
    this.status = 'playing';
    this.currentMoveIndex = 0;
    this.userMoves = [];
    this.startTimer();
  }

  private startTimer() {
    this.startTime = Date.now();
    this.timer = setInterval(() => {
      this.elapsedTime = Date.now() - this.startTime;
    }, 100);
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private onUserMove(from: Key, to: Key) {
    const moveString = from + to;
    const expectedMove = this.solutionMoves[this.currentMoveIndex];

    // Check for promotion
    const piece = this.game.get(from as any);
    let promotion: string | undefined;
    if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
      promotion = 'q'; // Default to queen
    }

    try {
      // Make the move in chess.js
      const move = this.game.move({
        from: from as any,
        to: to as any,
        promotion: promotion as any
      });

      if (!move) {
        // Illegal move - reset board
        this.board?.set({ fen: this.game.fen() });
        return;
      }

      const userMoveUci = move.from + move.to + (move.promotion || '');

      // Check if it matches expected move
      if (userMoveUci === expectedMove || moveString === expectedMove) {
        // Correct move!
        this.status = 'correct';
        this.userMoves.push(userMoveUci);
        this.currentMoveIndex++;

        // Update board
        this.board?.set({
          fen: this.game.fen(),
          lastMove: [from, to]
        });

        // Check if puzzle is complete
        if (this.currentMoveIndex >= this.solutionMoves.length) {
          this.completePuzzle(true);
        } else {
          // Play opponent's next move
          setTimeout(() => {
            this.playNextOpponentMove();
          }, 600);
        }
      } else {
        // Wrong move!
        this.game.undo();
        this.attempts++;
        this.status = 'incorrect';
        this.feedbackMessage = 'That\'s not the best move. Try to find a better continuation!';

        // Reset board
        this.board?.set({ fen: this.game.fen() });
      }
    } catch (error) {
      console.error('Move error:', error);
      this.board?.set({ fen: this.game.fen() });
    }
  }

  private playNextOpponentMove() {
    if (this.currentMoveIndex >= this.solutionMoves.length) {
      return;
    }

    const opponentMove = this.solutionMoves[this.currentMoveIndex];
    const from = opponentMove.substring(0, 2);
    const to = opponentMove.substring(2, 4);
    const promotion = opponentMove.length > 4 ? opponentMove[4] : undefined;

    try {
      this.game.move({
        from: from as any,
        to: to as any,
        promotion: promotion as any
      });

      this.board?.set({
        fen: this.game.fen(),
        lastMove: [from as Key, to as Key]
      });

      this.board?.set({
        movable: {
          color: this.game.turn() === 'w' ? 'white' : 'black',
          dests: this.getMoveDests()
        }
      });

      this.currentMoveIndex++;
      this.status = 'playing';

      // Check if that was the last move
      if (this.currentMoveIndex >= this.solutionMoves.length) {
        this.completePuzzle(true);
      }
    } catch (error) {
      console.error('Error playing opponent move:', error);
    }
  }

  showHint() {
    if (this.hintsUsed >= this.maxHints) {
      return;
    }

    const nextMove = this.solutionMoves[this.currentMoveIndex];
    if (nextMove) {
      const from = nextMove.substring(0, 2) as Key;
      const to = nextMove.substring(2, 4) as Key;

      // Highlight the target square
      this.board?.setShapes([
        {
          orig: to,
          brush: 'yellow'
        }
      ]);

      this.hintsUsed++;
      this.feedbackMessage = 'Look at the highlighted square!';

      setTimeout(() => {
        this.board?.setShapes([]);
      }, 2000);
    }
  }

  showSolution() {
    this.status = 'failed';
    this.stopTimer();

    // Play all remaining moves
    let moveIndex = this.currentMoveIndex;
    const playMove = () => {
      if (moveIndex >= this.solutionMoves.length) {
        return;
      }

      const move = this.solutionMoves[moveIndex];
      const from = move.substring(0, 2);
      const to = move.substring(2, 4);
      const promotion = move.length > 4 ? move[4] : undefined;

      try {
        this.game.move({
          from: from as any,
          to: to as any,
          promotion: promotion as any
        });

        this.board?.set({
          fen: this.game.fen(),
          lastMove: [from as Key, to as Key]
        });

        moveIndex++;
        if (moveIndex < this.solutionMoves.length) {
          setTimeout(playMove, 800);
        }
      } catch (error) {
        console.error('Error showing solution:', error);
      }
    };

    playMove();
  }

  retryMove() {
    this.status = 'playing';
    this.feedbackMessage = '';
  }

  resetPuzzle() {
    if (this.puzzle) {
      this.game = new Chess(this.puzzle.puzzle.fen);
      this.board?.set({ fen: this.game.fen() });
      this.currentMoveIndex = 0;
      this.userMoves = [];
      this.attempts = 0;
      this.hintsUsed = 0;
      this.startTimer();
      this.status = 'playing';
      this.feedbackMessage = '';
    }
  }

  private async completePuzzle(solved: boolean) {
    this.status = 'complete';
    this.stopTimer();

    if (!this.puzzle) return;

    const attempt: AttemptRequest = {
      solved,
      timeSpent: this.elapsedTime,
      movesCount: this.userMoves.length,
      hintsUsed: this.hintsUsed
    };

    try {
      await this.puzzleService.recordAttempt(this.puzzle.puzzle.id, attempt).toPromise();
    } catch (error) {
      console.error('Error recording attempt:', error);
    }
  }

  getTurnInstruction(): string {
    const turn = this.game.turn();
    return turn === 'w' ? 'White to move - find the best move!' : 'Black to move - find the best move!';
  }

  formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  nextPuzzle() {
    this.loadRecommendedPuzzle();
  }

  goToRecommendations() {
    this.router.navigate(['/puzzles']);
  }

  goBack() {
    this.router.navigate(['/puzzles']);
  }
}
