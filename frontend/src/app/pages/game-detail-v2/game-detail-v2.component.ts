import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { Chess } from 'chess.js';
import { Chessground } from '@lichess-org/chessground';
import { Config } from '@lichess-org/chessground/config';
import { Key } from '@lichess-org/chessground/types';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ChessApiService } from '../../services/chess-api.service';
// Move quality symbol mappings (Lichess-style)
const MOVE_SYMBOLS: Record<string, string> = {
  best: '!!',
  excellent: '!',
  good: '+',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??'
};

interface MoveAnalysis {
  move_number: number;
  move: string;
  evaluation: number;
  centipawn_loss: number;
  is_blunder: boolean;
  is_mistake: boolean;
  is_inaccuracy: boolean;
  is_best?: boolean;
  is_excellent?: boolean;
  is_good?: boolean;
  move_quality?: string;
  fen_after: string;
}

interface GameData {
  id: number;
  white_player: string;
  black_player: string;
  result: string;
  date: string;
  user_color: 'white' | 'black';
  event?: string;
  opening?: string;
  pgn_content?: string;
  white_elo?: number;
  black_elo?: number;
}

interface GameAnalysisResponse {
  game: GameData;
  analysis: MoveAnalysis[];
}

/**
 * Game Detail V2 - Lichess PGN Viewer Style Layout
 *
 * Features:
 * - CSS Grid layout with responsive modes
 * - Inline move notation with flex-wrap
 * - Player info sections with clocks
 * - Navigation controls
 * - Move quality annotations
 */
@Component({
  selector: 'app-game-detail-v2',
  standalone: true,
  imports: [CommonModule, HttpClientModule, LayoutComponent],
  template: `
    <app-layout>
      <!-- Loading State -->
      <div *ngIf="loading" class="flex items-center justify-center min-h-screen">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p class="mt-4 text-gray-600">Loading game analysis...</p>
        </div>
      </div>

      <!-- Error State -->
      <div *ngIf="error && !loading" class="flex items-center justify-center min-h-screen">
        <div class="text-center max-w-md">
          <div class="text-red-500 text-5xl mb-4">&#9888;</div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Error Loading Game</h2>
          <p class="text-gray-600 mb-4">{{ error }}</p>
          <button (click)="goBack()" class="btn-primary">Back to Games</button>
        </div>
      </div>

      <!-- Main Content - Lichess PGN Viewer Style -->
      <div *ngIf="!loading && !error && gameData"
           class="lpv"
           [class.lpv--moves-auto]="showMoves === 'auto'"
           [class.lpv--moves-right]="showMoves === 'right'"
           [class.lpv--moves-bottom]="showMoves === 'bottom'"
           [class.lpv--players]="showPlayers">

        <!-- Player Top (Black by default, White if flipped) -->
        <div class="lpv__player lpv__player--top" *ngIf="showPlayers">
          <div class="lpv__player-info">
            <span class="lpv__player-piece" [class.white]="isFlipped" [class.black]="!isFlipped"></span>
            <span class="lpv__player-name">{{ isFlipped ? gameData.white_player : gameData.black_player }}</span>
            <span class="lpv__player-elo" *ngIf="getTopPlayerElo()">{{ getTopPlayerElo() }}</span>
          </div>
        </div>

        <!-- Chess Board -->
        <div class="lpv__board">
          <div class="cg-wrap" #chessBoard></div>
        </div>

        <!-- Player Bottom (White by default, Black if flipped) -->
        <div class="lpv__player lpv__player--bottom" *ngIf="showPlayers">
          <div class="lpv__player-info">
            <span class="lpv__player-piece" [class.white]="!isFlipped" [class.black]="isFlipped"></span>
            <span class="lpv__player-name">{{ isFlipped ? gameData.black_player : gameData.white_player }}</span>
            <span class="lpv__player-elo" *ngIf="getBottomPlayerElo()">{{ getBottomPlayerElo() }}</span>
          </div>
          <div class="lpv__result-badge" [class]="getResultClass()">{{ gameData.result }}</div>
        </div>

        <!-- Controls -->
        <div class="lpv__controls" *ngIf="showControls">
          <button class="lpv__ctrl-btn" (click)="goToStart()" [disabled]="currentMoveIndex < 0" title="First (Home)">
            <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button class="lpv__ctrl-btn" (click)="previousMove()" [disabled]="currentMoveIndex < 0" title="Previous (Left)">
            <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button class="lpv__ctrl-btn lpv__ctrl-btn--flip" (click)="flipBoard()" title="Flip Board">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          </button>
          <button class="lpv__ctrl-btn" (click)="nextMove()" [disabled]="currentMoveIndex >= moves.length - 1" title="Next (Right)">
            <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
          <button class="lpv__ctrl-btn" (click)="goToEnd()" [disabled]="currentMoveIndex >= moves.length - 1" title="Last (End)">
            <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
        </div>

        <!-- Side Panel (Moves) -->
        <div class="lpv__side">
          <!-- Game Info Header -->
          <div class="lpv__game-info">
            <div class="lpv__event" *ngIf="gameData.event">{{ gameData.event }}</div>
            <div class="lpv__opening" *ngIf="gameData.opening">{{ gameData.opening }}</div>
            <div class="lpv__date">{{ formatDate(gameData.date) }}</div>
          </div>

          <!-- Evaluation Bar -->
          <div class="lpv__eval" *ngIf="moves.length > 0">
            <div class="lpv__eval-bar">
              <div class="lpv__eval-white" [style.height.%]="getWhiteWinPercent()"></div>
            </div>
            <span class="lpv__eval-text">{{ formatEvaluation() }}</span>
          </div>

          <!-- Move List -->
          <div class="lpv__moves" #movesContainer>
            <ng-container *ngFor="let pair of movePairs; let i = index">
              <!-- Move Number -->
              <index>{{ i + 1 }}.</index>

              <!-- White Move -->
              <button
                class="move"
                [class.current]="pair.whiteIndex === currentMoveIndex"
                [class.ancestor]="pair.whiteIndex < currentMoveIndex"
                [class]="getMoveQualityClass(pair.white)"
                (click)="goToMove(pair.whiteIndex)"
                *ngIf="pair.white">
                {{ pair.white.move }}{{ getMoveSymbol(pair.white) }}
              </button>
              <span class="move empty" *ngIf="!pair.white"></span>

              <!-- Black Move -->
              <button
                class="move"
                [class.current]="pair.blackIndex === currentMoveIndex"
                [class.ancestor]="pair.blackIndex < currentMoveIndex"
                [class]="getMoveQualityClass(pair.black)"
                (click)="goToMove(pair.blackIndex)"
                *ngIf="pair.black">
                {{ pair.black.move }}{{ getMoveSymbol(pair.black) }}
              </button>
              <span class="move empty" *ngIf="!pair.black && pair.white"></span>
            </ng-container>

            <!-- Result -->
            <span class="lpv__result" *ngIf="gameData.result !== '*'">{{ gameData.result }}</span>
          </div>

          <!-- Move Quality Legend -->
          <div class="lpv__legend">
            <span class="lpv__legend-item"><span class="best">!!</span> Best</span>
            <span class="lpv__legend-item"><span class="excellent">!</span> Excellent</span>
            <span class="lpv__legend-item"><span class="good">+</span> Good</span>
            <span class="lpv__legend-item"><span class="inaccuracy">?!</span> Inaccuracy</span>
            <span class="lpv__legend-item"><span class="mistake">?</span> Mistake</span>
            <span class="lpv__legend-item"><span class="blunder">??</span> Blunder</span>
          </div>
        </div>
      </div>
    </app-layout>
  `,
  styles: [`
    /* CSS Variables for theming - Light Mode */
    :host {
      --c-lpv-bg: hsl(37, 12%, 96%);
      --c-lpv-bg-side: hsl(37, 12%, 98%);
      --c-lpv-accent: hsl(209, 77%, 46%);
      --c-lpv-accent-over: #fff;
      --c-lpv-font: #333;
      --c-lpv-font-shy: #666;
      --c-lpv-border: hsl(0, 0%, 85%);
      --c-lpv-current-move: hsl(209, 77%, 46%);
      --c-lpv-past-moves: #999;
      --c-lpv-move-hover: hsl(37, 12%, 90%);
      --c-lpv-blunder: #c0392b;
      --c-lpv-mistake: #d35400;
      --c-lpv-inaccuracy: #b8860b;
      --c-lpv-good: #2980b9;
      --c-lpv-excellent: #27ae60;
      --c-lpv-best: #1e8449;
      --controls-height: 3.5rem;
      --player-height: 2.5rem;
    }

    /* Main Grid Layout */
    .lpv {
      display: grid;
      overflow: hidden;
      background: var(--c-lpv-bg);
      border-radius: 8px;
      border: 1px solid var(--c-lpv-border);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      min-height: 500px;
      height: calc(100vh - 120px); /* Constrain height for internal scroll */
      max-height: 900px;
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Layout: Moves Auto (Responsive) */
    .lpv--moves-auto {
      grid-template-areas:
        'board      side'
        'controls   side';
      grid-template-columns: auto fit-content(40%);
      grid-template-rows: auto var(--controls-height);
    }

    .lpv--moves-auto.lpv--players {
      grid-template-areas:
        'player-top   side'
        'board        side'
        'player-bot   side'
        'controls     side';
      grid-template-rows: var(--player-height) auto var(--player-height) var(--controls-height);
    }

    @media (max-width: 700px) {
      .lpv--moves-auto {
        grid-template-areas:
          'board'
          'controls'
          'side';
        grid-template-columns: 1fr;
        grid-template-rows: auto var(--controls-height) 1fr;
      }

      .lpv--moves-auto.lpv--players {
        grid-template-areas:
          'player-top'
          'board'
          'player-bot'
          'controls'
          'side';
        grid-template-rows: var(--player-height) auto var(--player-height) var(--controls-height) 1fr;
      }
    }

    /* Layout: Moves Right */
    .lpv--moves-right {
      grid-template-areas:
        'board      side'
        'controls   side';
      grid-template-columns: auto fit-content(40%);
      grid-template-rows: auto var(--controls-height);
    }

    .lpv--moves-right.lpv--players {
      grid-template-areas:
        'player-top   side'
        'board        side'
        'player-bot   side'
        'controls     side';
      grid-template-rows: var(--player-height) auto var(--player-height) var(--controls-height);
    }

    /* Layout: Moves Bottom */
    .lpv--moves-bottom {
      grid-template-areas:
        'board'
        'controls'
        'side';
      grid-template-columns: 1fr;
      grid-template-rows: auto var(--controls-height) minmax(150px, 1fr);
    }

    /* Grid Area Assignments */
    .lpv__board { grid-area: board; }
    .lpv__side { grid-area: side; }
    .lpv__controls { grid-area: controls; }
    .lpv__player--top { grid-area: player-top; }
    .lpv__player--bottom { grid-area: player-bot; }

    /* Board Container */
    .lpv__board {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 8px;
    }

    .cg-wrap {
      width: clamp(300px, 55vw, 560px);
      height: clamp(300px, 55vw, 560px);
      aspect-ratio: 1;
    }

    /* Force Chessground visibility */
    :host ::ng-deep cg-board,
    :host ::ng-deep cg-container {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
    }

    /* Player Sections */
    .lpv__player {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      background: var(--c-lpv-bg-side);
      border-bottom: 1px solid var(--c-lpv-border);
    }

    .lpv__player--top {
      border-bottom: 1px solid var(--c-lpv-border);
    }

    .lpv__player--bottom {
      border-top: 1px solid var(--c-lpv-border);
      border-bottom: none;
    }

    .lpv__player-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .lpv__player-piece {
      width: 16px;
      height: 16px;
      border-radius: 2px;
      border: 1px solid var(--c-lpv-border);
    }

    .lpv__player-piece.white {
      background: #fff;
      border-color: #999;
    }

    .lpv__player-piece.black {
      background: #333;
      border-color: #333;
    }

    .lpv__player-name {
      color: var(--c-lpv-font);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .lpv__player-elo {
      color: var(--c-lpv-font-shy);
      font-size: 0.8rem;
    }

    .lpv__result-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
    }

    .lpv__result-badge.win { background: #27ae60; color: white; }
    .lpv__result-badge.loss { background: #e74c3c; color: white; }
    .lpv__result-badge.draw { background: #95a5a6; color: white; }

    /* Controls */
    .lpv__controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 8px;
      background: var(--c-lpv-bg-side);
      border-top: 1px solid var(--c-lpv-border);
    }

    .lpv__ctrl-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--c-lpv-font);
      cursor: pointer;
      transition: all 0.15s;
    }

    .lpv__ctrl-btn:hover:not(:disabled) {
      background: var(--c-lpv-move-hover);
    }

    .lpv__ctrl-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .lpv__ctrl-btn svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }

    .lpv__ctrl-btn--flip {
      color: var(--c-lpv-accent);
    }

    /* Side Panel */
    .lpv__side {
      display: flex;
      flex-direction: column;
      background: var(--c-lpv-bg-side);
      border-left: 1px solid var(--c-lpv-border);
      min-width: 280px;
      max-width: 400px;
      overflow: hidden;
      /* Height is determined by grid row span */
    }

    @media (max-width: 700px) {
      .lpv__side {
        border-left: none;
        border-top: 1px solid var(--c-lpv-border);
        max-width: none;
        height: 300px;
        min-height: 200px;
      }
    }

    /* Game Info */
    .lpv__game-info {
      padding: 12px;
      border-bottom: 1px solid var(--c-lpv-border);
    }

    .lpv__event {
      color: var(--c-lpv-font);
      font-weight: 600;
      font-size: 0.9rem;
      margin-bottom: 4px;
    }

    .lpv__opening {
      color: var(--c-lpv-accent);
      font-size: 0.85rem;
      margin-bottom: 4px;
    }

    .lpv__date {
      color: var(--c-lpv-font-shy);
      font-size: 0.75rem;
    }

    /* Evaluation */
    .lpv__eval {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--c-lpv-border);
    }

    .lpv__eval-bar {
      width: 100px;
      height: 16px;
      background: #333;
      border-radius: 2px;
      overflow: hidden;
      position: relative;
      border: 1px solid var(--c-lpv-border);
    }

    .lpv__eval-white {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: #fff;
      transition: height 0.3s ease;
    }

    .lpv__eval-text {
      color: var(--c-lpv-font);
      font-family: monospace;
      font-size: 0.9rem;
      font-weight: bold;
      min-width: 50px;
    }

    /* Move List - Lichess Style */
    .lpv__moves {
      flex: 1 1 0;
      min-height: 0; /* Critical for flex container scroll */
      display: flex;
      flex-flow: row wrap;
      align-items: center;
      align-content: flex-start;
      overflow-y: auto;
      padding: 8px;
      line-height: 1.8;
      user-select: none;
      will-change: scroll-position;
    }

    .lpv__moves > index {
      flex: 0 0 12%;
      display: flex;
      justify-content: flex-end;
      padding-right: 4px;
      color: var(--c-lpv-font-shy);
      font-size: 0.85rem;
    }

    .lpv__moves > .move {
      flex: 0 0 42%;
      padding: 2px 6px;
      border: none;
      background: transparent;
      color: var(--c-lpv-font);
      font-family: inherit;
      font-size: 0.95rem;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      border-radius: 3px;
      transition: all 0.1s;
    }

    .lpv__moves > .move:hover {
      background: var(--c-lpv-move-hover);
    }

    .lpv__moves > .move.current {
      background: var(--c-lpv-current-move);
      color: var(--c-lpv-accent-over);
    }

    .lpv__moves > .move.ancestor {
      color: var(--c-lpv-past-moves);
    }

    .lpv__moves > .move.empty {
      cursor: default;
    }

    /* Move Quality Colors */
    .lpv__moves > .move.blunder { color: var(--c-lpv-blunder); }
    .lpv__moves > .move.mistake { color: var(--c-lpv-mistake); }
    .lpv__moves > .move.inaccuracy { color: var(--c-lpv-inaccuracy); }
    .lpv__moves > .move.good { color: var(--c-lpv-good); }
    .lpv__moves > .move.excellent { color: var(--c-lpv-excellent); }
    .lpv__moves > .move.best { color: var(--c-lpv-best); }

    .lpv__moves > .move.current.blunder,
    .lpv__moves > .move.current.mistake,
    .lpv__moves > .move.current.inaccuracy,
    .lpv__moves > .move.current.good,
    .lpv__moves > .move.current.excellent,
    .lpv__moves > .move.current.best {
      color: var(--c-lpv-accent-over);
    }

    .lpv__result {
      flex: 1 1 100%;
      text-align: center;
      padding: 8px;
      color: var(--c-lpv-font);
      font-weight: bold;
    }

    /* Legend */
    .lpv__legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-top: 1px solid var(--c-lpv-border);
      font-size: 0.7rem;
      color: var(--c-lpv-font-shy);
    }

    .lpv__legend-item {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .lpv__legend-item .best { color: var(--c-lpv-best); font-weight: bold; }
    .lpv__legend-item .excellent { color: var(--c-lpv-excellent); font-weight: bold; }
    .lpv__legend-item .good { color: var(--c-lpv-good); font-weight: bold; }
    .lpv__legend-item .inaccuracy { color: var(--c-lpv-inaccuracy); font-weight: bold; }
    .lpv__legend-item .mistake { color: var(--c-lpv-mistake); font-weight: bold; }
    .lpv__legend-item .blunder { color: var(--c-lpv-blunder); font-weight: bold; }

    /* Utility */
    .btn-primary {
      @apply inline-flex items-center justify-center rounded-md bg-blue-500 text-white px-4 py-2 hover:bg-blue-600;
    }
  `]
})
export class GameDetailV2Component implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chessBoard', { static: false }) chessBoardElement!: ElementRef;
  @ViewChild('movesContainer', { static: false }) movesContainer!: ElementRef;

  // Configuration
  showMoves: 'auto' | 'right' | 'bottom' = 'auto';
  showPlayers: boolean = true;
  showControls: boolean = true;

  // Data
  gameId: number | null = null;
  gameData: GameData | null = null;
  moves: MoveAnalysis[] = [];
  movePairs: { white: MoveAnalysis | null; black: MoveAnalysis | null; whiteIndex: number; blackIndex: number }[] = [];

  // State
  loading = true;
  error: string | null = null;
  currentMoveIndex = -1;
  isFlipped = false;

  // Chess
  private board: ReturnType<typeof Chessground> | null = null;
  private game!: Chess;
  private initialPosition = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ChessApiService,
    private cdr: ChangeDetectorRef
  ) {
    const id = this.route.snapshot.paramMap.get('id');
    this.gameId = id ? parseInt(id, 10) : null;
  }

  ngOnInit() {
    this.game = new Chess(this.initialPosition);
    this.setupKeyboardListeners();

    if (this.gameId) {
      this.loadGameData();
    } else {
      this.error = 'Invalid game ID';
      this.loading = false;
    }
  }

  ngAfterViewInit() {
    // Board will be initialized after data loads
  }

  ngOnDestroy() {
    this.removeKeyboardListeners();
    if (this.board) {
      this.board.destroy();
    }
  }

  async loadGameData() {
    if (!this.gameId) return;

    try {
      this.loading = true;
      this.error = null;

      const response: GameAnalysisResponse = await this.apiService.getGameAnalysis(this.gameId).toPromise();

      if (!response || !response.game) {
        throw new Error('Game not found');
      }

      this.gameData = response.game;
      this.moves = response.analysis || [];
      this.buildMovePairs();

      this.loading = false;
      this.cdr.detectChanges();

      // Initialize board after view updates
      setTimeout(() => this.initializeBoard(), 100);
    } catch (err: any) {
      this.error = err.message || 'Failed to load game data';
      this.loading = false;
    }
  }

  private buildMovePairs() {
    this.movePairs = [];
    for (let i = 0; i < this.moves.length; i += 2) {
      this.movePairs.push({
        white: this.moves[i] || null,
        black: this.moves[i + 1] || null,
        whiteIndex: i,
        blackIndex: i + 1
      });
    }
  }

  private initializeBoard() {
    const element = this.chessBoardElement?.nativeElement;
    if (!element) return;

    try {
      const config: Config = {
        fen: this.initialPosition,
        orientation: this.isFlipped ? 'black' : 'white',
        viewOnly: true,
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
          enabled: true,
          visible: true
        }
      };

      this.board = Chessground(element, config);
    } catch (error) {
      console.error('Failed to initialize board:', error);
    }
  }

  // Navigation
  private setupKeyboardListeners() {
    document.addEventListener('keydown', this.handleKeyPress);
  }

  private removeKeyboardListeners() {
    document.removeEventListener('keydown', this.handleKeyPress);
  }

  private handleKeyPress = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.previousMove();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.nextMove();
        break;
      case 'Home':
        event.preventDefault();
        this.goToStart();
        break;
      case 'End':
        event.preventDefault();
        this.goToEnd();
        break;
    }
  };

  goToStart() {
    this.goToMove(-1);
  }

  previousMove() {
    if (this.currentMoveIndex >= 0) {
      this.goToMove(this.currentMoveIndex - 1);
    }
  }

  nextMove() {
    if (this.currentMoveIndex < this.moves.length - 1) {
      this.goToMove(this.currentMoveIndex + 1);
    }
  }

  goToEnd() {
    this.goToMove(this.moves.length - 1);
  }

  goToMove(index: number) {
    this.currentMoveIndex = index;
    this.game = new Chess(this.initialPosition);

    let lastMove: { from: Key; to: Key } | undefined;
    for (let i = 0; i <= index; i++) {
      if (this.moves[i]) {
        try {
          const move = this.game.move(this.moves[i].move);
          if (i === index) {
            lastMove = { from: move.from as Key, to: move.to as Key };
          }
        } catch (error) {
          break;
        }
      }
    }

    if (this.board) {
      this.board.set({
        fen: this.game.fen(),
        lastMove: lastMove ? [lastMove.from, lastMove.to] : undefined
      });
    }

    this.scrollToCurrentMove();
  }

  private scrollToCurrentMove() {
    if (!this.movesContainer?.nativeElement) return;

    const container = this.movesContainer.nativeElement;
    const currentBtn = container.querySelector('.move.current');
    if (currentBtn) {
      currentBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  flipBoard() {
    this.isFlipped = !this.isFlipped;
    if (this.board) {
      this.board.set({ orientation: this.isFlipped ? 'black' : 'white' });
    }
  }

  // Move Quality
  getMoveQuality(move: MoveAnalysis): string {
    if (move.move_quality) {
      return move.move_quality;
    }
    if (move.is_blunder) return 'blunder';
    if (move.is_mistake) return 'mistake';
    if (move.is_inaccuracy) return 'inaccuracy';
    if (move.is_best) return 'best';
    if (move.is_excellent) return 'excellent';
    if (move.is_good) return 'good';

    const cpLoss = move.centipawn_loss || 0;
    if (cpLoss <= 5) return 'best';
    if (cpLoss <= 10) return 'excellent';
    if (cpLoss <= 25) return 'good';
    if (cpLoss <= 50) return 'inaccuracy';
    if (cpLoss <= 100) return 'mistake';
    if (cpLoss > 100) return 'blunder';
    return '';
  }

  getMoveQualityClass(move: MoveAnalysis | null): string {
    if (!move) return '';
    return this.getMoveQuality(move);
  }

  getMoveSymbol(move: MoveAnalysis | null): string {
    if (!move) return '';
    const quality = this.getMoveQuality(move);
    if (!quality) return '';
    return MOVE_SYMBOLS[quality] || '';
  }

  // Evaluation
  getCurrentEvaluation(): number {
    if (this.currentMoveIndex >= 0 && this.currentMoveIndex < this.moves.length) {
      return this.moves[this.currentMoveIndex].evaluation;
    }
    return 0;
  }

  getWhiteWinPercent(): number {
    const cp = this.getCurrentEvaluation();
    // Lichess sigmoid formula
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  }

  formatEvaluation(): string {
    const cp = this.getCurrentEvaluation();
    if (Math.abs(cp) > 9000) {
      const mateIn = Math.ceil((10000 - Math.abs(cp)) / 10);
      return cp > 0 ? `+M${mateIn}` : `-M${mateIn}`;
    }
    const pawns = cp / 100;
    if (pawns === 0) return '0.0';
    return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
  }

  // Helpers
  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getTopPlayerElo(): number | null {
    if (!this.gameData) return null;
    return this.isFlipped ? this.gameData.white_elo || null : this.gameData.black_elo || null;
  }

  getBottomPlayerElo(): number | null {
    if (!this.gameData) return null;
    return this.isFlipped ? this.gameData.black_elo || null : this.gameData.white_elo || null;
  }

  getResultClass(): string {
    if (!this.gameData) return '';
    const userWon = (this.gameData.user_color === 'white' && this.gameData.result === '1-0') ||
                    (this.gameData.user_color === 'black' && this.gameData.result === '0-1');
    const userLost = (this.gameData.user_color === 'white' && this.gameData.result === '0-1') ||
                     (this.gameData.user_color === 'black' && this.gameData.result === '1-0');
    if (userWon) return 'win';
    if (userLost) return 'loss';
    return 'draw';
  }

  goBack() {
    this.router.navigate(['/games']);
  }
}
