import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Chess } from 'chess.js';
import { Chessground } from '@lichess-org/chessground';
import { Key } from '@lichess-org/chessground/types';
import { PuzzleService, Puzzle, LearningPath } from '../../services/puzzle.service';
import { LayoutComponent } from '../../components/layout/layout.component';
import { BoardControlsComponent } from '../game-detail-v2/components/board-controls.component';

@Component({
  selector: 'app-puzzles',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LayoutComponent, BoardControlsComponent],
  template: `
    <app-layout>
      <!-- Page Header with Back Button -->
      <div class="flex items-center gap-4 px-4 py-4">
        <button
          (click)="goBack()"
          class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-10 w-10">
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
          </svg>
        </button>
        <div class="flex-1">
          <h1 class="text-2xl sm:text-3xl font-bold text-foreground">Puzzle Training</h1>
          <p class="text-sm text-muted-foreground">Improve your tactics with targeted puzzles</p>
        </div>
      </div>

      <div class="space-y-6 pb-8">
        <!-- Loading -->
        <div *ngIf="loading" class="flex flex-col justify-center items-center py-16 animate-fade-in">
          <div class="relative">
            <div class="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
          <p class="text-muted-foreground mt-6 text-sm font-medium">Loading puzzle...</p>
        </div>

        <!-- Error -->
        <div *ngIf="error" class="rounded-2xl border-2 border-destructive/30 bg-gradient-to-br from-destructive/10 to-destructive/5 p-6 shadow-xl">
          <p class="text-sm text-destructive">{{ error }}</p>
        </div>

        <!-- Main Layout -->
        <div *ngIf="currentPuzzle && !loading" class="lichess-layout">
          <!-- Left Panel -->
          <div class="left-panel">
            <div class="panel-card">
              <div class="flex gap-3 items-start">
                <div class="puzzle-icon">♟</div>
                <div class="flex-1">
                  <p class="text-sm text-muted-foreground">Puzzle <a class="text-primary hover:underline">#{{ currentPuzzle.id }}</a></p>
                  <p class="text-sm text-foreground mt-1">Rating: ⭐ {{ currentPuzzle.rating }}</p>
                  <p class="text-xs text-muted-foreground mt-1">{{ formatThemes(currentPuzzle.themes) }}</p>
                </div>
              </div>
            </div>

            <div class="panel-card">
              <label class="flex items-center gap-3 cursor-pointer text-sm text-foreground">
                <input type="checkbox" [(ngModel)]="autoNext" class="w-4 h-4 rounded border-border">
                <span>Jump to next immediately</span>
              </label>
            </div>

            <div class="panel-card">
              <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span class="block text-xl font-bold text-foreground">{{ statistics?.totalSolved || 0 }}</span>
                  <span class="text-xs text-muted-foreground uppercase">Solved</span>
                </div>
                <div>
                  <span class="block text-xl font-bold text-foreground">{{ statistics?.successRate | number:'1.0-0' }}%</span>
                  <span class="text-xs text-muted-foreground uppercase">Accuracy</span>
                </div>
                <div>
                  <span class="block text-xl font-bold text-foreground">{{ dailyGoals?.puzzlesSolved || 0 }}/{{ dailyGoals?.puzzlesTarget || 10 }}</span>
                  <span class="text-xs text-muted-foreground uppercase">Today</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Center: Board -->
          <div class="board-section">
            <div class="board-wrapper">
              <div #boardElement class="board cg-wrap"></div>
              <app-board-controls
                (start)="goToStart()"
                (previous)="goToPrevious()"
                (flip)="flipBoard()"
                (next)="goToNext()"
                (end)="goToEnd()"
              ></app-board-controls>
            </div>
            <div class="move-list">
              <span *ngFor="let move of playedMoves; let i = index" class="move" [class.current]="i === currentMoveIndex" (click)="goToMove(i)">
                <span class="move-num" *ngIf="i % 2 === 0">{{ getMoveNumber(i) }}.</span>{{ move }}
              </span>
            </div>
          </div>

          <!-- Right Panel -->
          <div class="right-panel">
            <div class="instruction-card" [class.correct]="feedbackClass === 'correct'" [class.incorrect]="feedbackClass === 'incorrect'">
              <div *ngIf="!feedback" class="flex gap-3 items-center">
                <span class="turn-icon" [class.white]="isWhiteToMove">{{ isWhiteToMove ? '♔' : '♚' }}</span>
                <div>
                  <p class="text-sm font-semibold text-foreground">Your turn</p>
                  <p class="text-xs text-muted-foreground">Find the best move for {{ isWhiteToMove ? 'white' : 'black' }}.</p>
                </div>
              </div>
              <p *ngIf="feedback" class="text-sm font-semibold text-center">{{ feedback }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <button class="btn-secondary" (click)="showHint()" [disabled]="solved || hintShown">
                💡 Get a hint
              </button>
              <button class="btn-secondary" (click)="showSolution()" [disabled]="solved">
                👁 View the solution
              </button>
            </div>

            <div class="panel-card text-center">
              <span class="text-lg font-bold text-foreground">⏱ {{ formatTime(elapsedTime) }}</span>
            </div>

            <button class="btn-primary" (click)="loadNextPuzzle()">Continue →</button>
          </div>
        </div>
      </div>
    </app-layout>
  `,
  styles: [`
    :host { --board-size: min(520px, calc(100vh - 180px)); }

    .lichess-layout {
      display: flex;
      justify-content: center;
      gap: 16px;
    }

    .left-panel, .right-panel {
      width: 240px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .panel-card {
      background: hsl(var(--card));
      border: 1px solid hsl(var(--border));
      border-radius: 12px;
      padding: 14px;
    }

    .puzzle-icon {
      font-size: 28px;
      background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)));
      border-radius: 8px;
      padding: 6px 10px;
      flex-shrink: 0;
      line-height: 1;
    }

    .board-section { display: flex; flex-direction: column; align-items: center; }
    .board-wrapper { width: var(--board-size); }
    .board { width: 100%; height: var(--board-size); }

    .move-list {
      width: var(--board-size);
      background: hsl(var(--card));
      border: 1px solid hsl(var(--border));
      border-radius: 0 0 8px 8px;
      padding: 10px 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 13px;
      min-height: 40px;
      color: hsl(var(--foreground));
    }
    .move { padding: 2px 6px; border-radius: 4px; cursor: pointer; }
    .move:hover { background: hsl(var(--accent)); }
    .move.current { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
    .move-num { color: hsl(var(--muted-foreground)); margin-right: 2px; }

    .instruction-card {
      background: hsl(var(--card));
      border: 1px solid hsl(var(--border));
      border-radius: 12px;
      padding: 14px;
      transition: all 0.2s;
    }
    .instruction-card.correct { background: hsl(var(--success)); border-color: hsl(var(--success)); }
    .instruction-card.correct p { color: #fff !important; }
    .instruction-card.incorrect { background: hsl(var(--destructive)); border-color: hsl(var(--destructive)); }
    .instruction-card.incorrect p { color: #fff !important; }

    .turn-icon {
      font-size: 24px;
      background: hsl(var(--muted));
      color: hsl(var(--foreground));
      border-radius: 6px;
      padding: 4px 8px;
    }
    .turn-icon.white { background: #fff; color: #333; }

    .btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 16px;
      background: hsl(var(--primary));
      color: hsl(var(--primary-foreground));
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .btn-primary:hover { opacity: 0.9; }

    .btn-secondary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 14px;
      background: hsl(var(--muted));
      color: hsl(var(--foreground));
      border: 1px solid hsl(var(--border));
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn-secondary:hover:not(:disabled) { background: hsl(var(--accent)); }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

    @media (max-width: 900px) {
      :host { --board-size: calc(100vw - 32px); }
      .lichess-layout { flex-direction: column; align-items: center; }
      .left-panel, .right-panel { width: 100%; max-width: var(--board-size); }
      .board-section { order: -1; }
      .right-panel { order: 0; }
      .left-panel { order: 1; }
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
  autoNext = false;
  playedMoves: string[] = [];
  currentMoveIndex = -1;
  dailyGoals: LearningPath['dailyGoals'] | null = null;
  statistics: LearningPath['statistics'] | null = null;

  private timerInterval: any;
  private moveIndex = 0;
  private solutionMoves: string[] = [];
  private chess = new Chess();
  private board: any = null;
  private positionHistory: string[] = [];

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
    setTimeout(() => {
      const puzzleId = this.route.snapshot.paramMap.get('id');
      puzzleId ? this.loadPuzzle(puzzleId) : this.loadNextPuzzle();
    }, 100);
  }

  ngOnDestroy() {
    this.stopTimer();
    if (this.board) this.board.destroy();
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
        }
        this.loading = false;
        setTimeout(() => {
          this.initBoard(puzzle.fen);
          this.startTimer();
        }, 50);
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

  goBack() {
    this.router.navigate(['/blunders']);
  }

  flipBoard() {
    if (this.board) {
      this.board.toggleOrientation();
    }
  }

  goToMove(index: number) {
    if (index < 0 || index >= this.positionHistory.length) return;
    this.currentMoveIndex = index;
    const fen = this.positionHistory[index];
    this.chess.load(fen);
    this.updateBoard();
  }

  goToStart() { if (this.positionHistory.length) this.goToMove(0); }
  goToPrevious() { if (this.currentMoveIndex > 0) this.goToMove(this.currentMoveIndex - 1); }
  goToNext() { if (this.currentMoveIndex < this.positionHistory.length - 1) this.goToMove(this.currentMoveIndex + 1); }
  goToEnd() { if (this.positionHistory.length) this.goToMove(this.positionHistory.length - 1); }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') this.goToPrevious();
    else if (event.key === 'ArrowRight') this.goToNext();
    else if (event.key === 'ArrowUp') this.goToStart();
    else if (event.key === 'ArrowDown') this.goToEnd();
  }

  private updateBoard() {
    if (!this.board) return;
    this.board.set({
      fen: this.chess.fen(),
      turnColor: this.chess.turn() === 'w' ? 'white' : 'black',
      movable: { dests: this.getLegalMoves() }
    });
  }

  private resetState() {
    this.solved = false;
    this.hintShown = false;
    this.feedback = null;
    this.feedbackClass = '';
    this.moveIndex = 0;
    this.elapsedTime = 0;
    this.playedMoves = [];
    this.currentMoveIndex = -1;
    this.positionHistory = [];
    this.stopTimer();
  }

  private initBoard(fen: string) {
    if (!this.boardElement?.nativeElement) return;

    this.chess.load(fen);
    const userColor = this.chess.turn() === 'w' ? 'white' : 'black';
    this.isWhiteToMove = userColor === 'white';

    if (this.board) this.board.destroy();

    this.board = Chessground(this.boardElement.nativeElement, {
      fen,
      orientation: userColor,
      turnColor: userColor,
      movable: {
        free: false,
        color: userColor,
        dests: this.getLegalMoves(),
        events: { after: (orig: string, dest: string) => this.onMove(orig, dest) }
      },
      draggable: { enabled: true },
      selectable: { enabled: true },
      highlight: { lastMove: true, check: true }
    });
  }

  private getLegalMoves(): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    for (const move of this.chess.moves({ verbose: true })) {
      const from = move.from as Key;
      if (!dests.has(from)) dests.set(from, []);
      dests.get(from)!.push(move.to as Key);
    }
    return dests;
  }

  private onMove(orig: string, dest: string) {
    const expectedMove = this.solutionMoves[this.moveIndex];
    const userMove = orig + dest;

    if (expectedMove.startsWith(userMove)) {
      const promotion = expectedMove.length > 4 ? expectedMove[4] : undefined;
      const move = this.chess.move({ from: orig, to: dest, promotion });
      if (move) {
        this.playedMoves.push(move.san);
        this.positionHistory.push(this.chess.fen());
        this.currentMoveIndex = this.playedMoves.length - 1;
      }
      this.moveIndex++;

      if (this.moveIndex >= this.solutionMoves.length) {
        this.solved = true;
        this.feedback = '✓ Puzzle solved!';
        this.feedbackClass = 'correct';
        this.stopTimer();
        this.recordAttempt(true);
        if (this.autoNext) setTimeout(() => this.loadNextPuzzle(), 1000);
      } else {
        this.feedback = '✓ Correct!';
        this.feedbackClass = 'correct';
        setTimeout(() => this.playOpponentMove(), 300);
      }
    } else {
      this.feedback = '✗ Try again';
      this.feedbackClass = 'incorrect';
      const color = this.chess.turn() === 'w' ? 'white' : 'black';
      this.board.set({ 
        fen: this.chess.fen(), 
        turnColor: color,
        movable: { color, dests: this.getLegalMoves() } 
      });
    }
  }

  private playOpponentMove() {
    if (this.moveIndex >= this.solutionMoves.length) return;

    const move = this.solutionMoves[this.moveIndex];
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move.length > 4 ? move[4] : undefined;

    const result = this.chess.move({ from, to, promotion });
    if (result) {
      this.playedMoves.push(result.san);
      this.positionHistory.push(this.chess.fen());
      this.currentMoveIndex = this.playedMoves.length - 1;
    }
    this.moveIndex++;

    this.board.set({
      fen: this.chess.fen(),
      lastMove: [from, to],
      turnColor: this.chess.turn() === 'w' ? 'white' : 'black',
      movable: { dests: this.getLegalMoves() }
    });

    this.feedback = null;
    this.feedbackClass = '';
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
      const uci = this.solutionMoves[this.moveIndex];
      const san = this.chess.moves({ verbose: true }).find(m => m.from === uci.slice(0, 2) && m.to === uci.slice(2, 4))?.san || uci;
      this.feedback = `Hint: ${san}`;
      this.feedbackClass = '';
    }
  }

  showSolution() {
    this.solved = true;
    this.stopTimer();
    this.feedback = `Solution: ${this.getSolutionInSAN()}`;
    this.feedbackClass = '';
    this.recordAttempt(false);
  }

  private getSolutionInSAN(): string {
    const tempChess = new Chess(this.currentPuzzle?.fen || '');
    return this.solutionMoves.map(uci => {
      const move = tempChess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      return move?.san || uci;
    }).join(' ');
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
    this.puzzleService.getDailyGoals().subscribe({ next: (goals) => this.dailyGoals = goals });
  }

  private loadStatistics() {
    this.puzzleService.getStatistics().subscribe({ next: (stats) => this.statistics = stats });
  }

  formatThemes(themes: string): string {
    return themes.split(' ').slice(0, 3).join(', ');
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getMoveNumber(index: number): number {
    return Math.floor(index / 2) + 1;
  }
}
