import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { Chess } from 'chess.js';
import { Chessground } from '@lichess-org/chessground';
import { Config } from '@lichess-org/chessground/config';
import { Key } from '@lichess-org/chessground/types';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ChessApiService } from '../../services/chess-api.service';

interface MoveAnalysis {
  move_number: number;
  move: string;
  evaluation: number;
  centipawn_loss: number;
  is_blunder: boolean;
  is_mistake: boolean;
  is_inaccuracy: boolean;
  best_move?: string;
  move_quality?: string;
}

interface GameData {
  id: number;
  white_player: string;
  black_player: string;
  result: string;
  date_played: string;
  opening_name?: string;
  time_control?: string;
  white_elo?: number;
  black_elo?: number;
}

interface MovePair {
  moveNumber: number;
  white: MoveAnalysis | null;
  black: MoveAnalysis | null;
  whiteIndex: number;
  blackIndex: number;
}

interface PlayerStats {
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  avgCentipawnLoss: number;
  accuracy: number;
}

@Component({
  selector: 'app-game-detail-v2',
  standalone: true,
  imports: [CommonModule, HttpClientModule, LayoutComponent],
  template: `
    <app-layout>
      <div class="lichess-layout">
        <!-- Left Panel: Player Stats -->
        <div class="analysis-panel left-panel">
          <div class="panel-header">Player Stats</div>
          <div class="stats-panel">
            <div class="stat-row">
              <span class="piece white"></span>
              <span class="name">{{ game?.white_player || 'White' }}</span>
              <div class="badges">
                <span class="badge inaccuracy" *ngIf="whiteStats.inaccuracies" title="Inaccuracies">{{ whiteStats.inaccuracies }}</span>
                <span class="badge mistake" *ngIf="whiteStats.mistakes" title="Mistakes">{{ whiteStats.mistakes }}</span>
                <span class="badge blunder" *ngIf="whiteStats.blunders" title="Blunders">{{ whiteStats.blunders }}</span>
              </div>
            </div>
            <div class="stat-row">
              <span class="piece black"></span>
              <span class="name">{{ game?.black_player || 'Black' }}</span>
              <div class="badges">
                <span class="badge inaccuracy" *ngIf="blackStats.inaccuracies" title="Inaccuracies">{{ blackStats.inaccuracies }}</span>
                <span class="badge mistake" *ngIf="blackStats.mistakes" title="Mistakes">{{ blackStats.mistakes }}</span>
                <span class="badge blunder" *ngIf="blackStats.blunders" title="Blunders">{{ blackStats.blunders }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Center: Chess Board with Eval Bar -->
        <div class="board-section">
          <!-- Board with Vertical Eval Bar -->
          <div class="board-with-eval">
            <div class="eval-bar-vertical" [class.flipped]="orientation === 'black'">
              <div class="eval-bar-white" [style.height.%]="orientation === 'white' ? getWhiteWinPercent() : 100 - getWhiteWinPercent()"></div>
              <div class="eval-bar-black" [style.height.%]="orientation === 'white' ? 100 - getWhiteWinPercent() : getWhiteWinPercent()"></div>
              <span class="eval-text" [class.eval-white]="currentEval >= 0" [class.eval-black]="currentEval < 0">
                {{ formatEval(currentEval) }}
              </span>
            </div>
            <div class="board-wrapper">
              <div #chessboard class="cg-wrap"></div>
            </div>
          </div>

          <!-- Controls -->
          <div class="board-controls">
            <button class="ctrl-btn" (click)="goToStart()" title="Start"><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" transform="rotate(180 12 12)"/></svg></button>
            <button class="ctrl-btn" (click)="goToPrevious()" title="Previous"><svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>
            <button class="ctrl-btn" (click)="flipBoard()" title="Flip"><svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg></button>
            <button class="ctrl-btn" (click)="goToNext()" title="Next"><svg viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg></button>
            <button class="ctrl-btn" (click)="goToEnd()" title="End"><svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
          </div>
        </div>

        <!-- Right Panel: Move List -->
        <div class="analysis-panel right-panel">
          <!-- Opening -->
          <div class="opening-bar" *ngIf="game?.opening_name">{{ game.opening_name }}</div>

          <!-- Move List (Lichess style) -->
          <div class="moves-container" #movesContainer>
            <div class="moves-list">
              <ng-container *ngFor="let pair of movePairs">
                <span class="move-index">{{ pair.moveNumber }}</span>
                <span class="move" [class.current]="currentMoveIndex === pair.whiteIndex" (click)="pair.white && goToMove(pair.whiteIndex)">
                  <span class="san">{{ pair.white?.move }}</span><span class="nag blunder" *ngIf="pair.white?.is_blunder" title="Blunder">??</span><span class="nag mistake" *ngIf="pair.white?.is_mistake && !pair.white?.is_blunder" title="Mistake">?</span><span class="nag inaccuracy" *ngIf="pair.white?.is_inaccuracy && !pair.white?.is_mistake && !pair.white?.is_blunder" title="Inaccuracy">?!</span>
                  <span class="eval">{{ formatInlineEval(pair.white?.evaluation) }}</span>
                </span>
                <div class="annotation" *ngIf="pair.white && (pair.white.is_blunder || pair.white.is_mistake || pair.white.is_inaccuracy)">
                  <span class="annotation-text">{{ getAnnotationLabel(pair.white) }} {{ pair.white.best_move }} was best.</span>
                </div>
                <span class="move" *ngIf="pair.black" [class.current]="currentMoveIndex === pair.blackIndex" (click)="goToMove(pair.blackIndex)">
                  <span class="san">{{ pair.black?.move }}</span><span class="nag blunder" *ngIf="pair.black?.is_blunder" title="Blunder">??</span><span class="nag mistake" *ngIf="pair.black?.is_mistake && !pair.black?.is_blunder" title="Mistake">?</span><span class="nag inaccuracy" *ngIf="pair.black?.is_inaccuracy && !pair.black?.is_mistake && !pair.black?.is_blunder" title="Inaccuracy">?!</span>
                  <span class="eval">{{ formatInlineEval(pair.black?.evaluation) }}</span>
                </span>
                <div class="annotation" *ngIf="pair.black && (pair.black.is_blunder || pair.black.is_mistake || pair.black.is_inaccuracy)">
                  <span class="annotation-text">{{ getAnnotationLabel(pair.black) }} {{ pair.black.best_move }} was best.</span>
                </div>
              </ng-container>
              <span class="result" *ngIf="game?.result">{{ game.result }}</span>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `,
  styles: [`
    :host {
      --color-inaccuracy: #56b4e9;
      --color-mistake: #e69f00;
      --color-blunder: #db3434;
      --board-size: min(720px, calc(100vh - 140px));
    }

    .lichess-layout {
      display: flex;
      justify-content: center;
      align-items: stretch;
      gap: 0;
      padding: 16px;
      min-height: calc(100vh - 64px);
      background: #edebe9;
      color: #333;
      font-family: 'Noto Sans', sans-serif;
    }

    /* Analysis Panels */
    .analysis-panel {
      width: 318px;
      display: flex;
      flex-direction: column;
      background: #d0d0d0;
      border-radius: 3px;
      overflow: hidden;
    }

    .left-panel { border-right: 1px solid #bbb; margin-right: 8px; }
    .right-panel { border-left: 1px solid #bbb; margin-left: 8px; height: calc(var(--board-size) + 40px); }

    /* Board Section */
    .board-section {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .player-bar {
      width: var(--board-size);
      padding: 3px 0;
      display: flex;
      align-items: center;
    }

    .player-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .player-piece {
      width: 18px;
      height: 18px;
      border-radius: 2px;
    }
    .player-piece.white { background: #fff; border: 1px solid #ccc; }
    .player-piece.black { background: #333; }

    .player-name {
      font-weight: 600;
      font-size: 14px;
      color: #333;
    }

    .player-rating {
      font-size: 13px;
      color: #666;
    }

    .board-with-eval {
      display: flex;
      width: calc(var(--board-size) + 24px);
      height: var(--board-size);
    }

    .eval-bar-vertical {
      width: 20px;
      display: flex;
      flex-direction: column;
      border-radius: 3px;
      overflow: hidden;
      position: relative;
      margin-right: 4px;
    }

    .eval-bar-white {
      background: #fff;
      transition: height 0.3s;
    }

    .eval-bar-black {
      background: #333;
      flex: 1;
    }

    .eval-text {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) rotate(-90deg);
      font-size: 10px;
      font-weight: bold;
      font-family: monospace;
      white-space: nowrap;
    }
    .eval-text.eval-white { color: #333; }
    .eval-text.eval-black { color: #fff; }

    .board-wrapper {
      flex: 1;
      aspect-ratio: 1;
    }

    .cg-wrap { width: 100%; height: 100%; }

    .board-controls {
      display: flex;
      gap: 2px;
      margin-top: 4px;
    }

    .ctrl-btn {
      width: 36px;
      height: 32px;
      background: #d1d1d1;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ctrl-btn:hover { background: #bbb; }
    .ctrl-btn svg { width: 20px; height: 20px; fill: #333; }

    .panel-header {
      padding: 6px 10px;
      font-size: 13px;
      font-weight: 600;
      color: #333;
      background: #c4c4c4;
      border-bottom: 1px solid #bbb;
      flex-shrink: 0;
    }

    .opening-bar {
      padding: 6px 10px;
      font-size: 13px;
      color: #b58900;
      background: #c4c4c4;
      border-bottom: 1px solid #bbb;
      flex-shrink: 0;
    }

    /* Move List */
    .moves-container {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }

    .moves-list {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      font-size: 15px;
      line-height: 1.7;
      padding: 5px;
    }

    .move-index {
      color: #999;
      font-size: 12px;
      min-width: 20px;
      text-align: right;
      padding-right: 5px;
    }

    .move {
      display: inline-flex;
      align-items: baseline;
      padding: 1px 3px;
      border-radius: 2px;
      cursor: pointer;
      font-family: inherit;
    }
    .move:hover { background: rgba(0,0,0,0.1); }
    .move.current { background: #3893e8; color: #fff; }
    .move.current .eval { color: rgba(255,255,255,0.7); }

    .move .san { font-weight: 500; }

    .move .nag {
      font-size: 11px;
      font-weight: bold;
      padding: 0 3px;
      border-radius: 2px;
      margin-left: 1px;
    }
    .move .nag.blunder { background: var(--color-blunder); color: #fff; }
    .move .nag.mistake { background: var(--color-mistake); color: #fff; }
    .move .nag.inaccuracy { background: var(--color-inaccuracy); color: #fff; }

    .move .eval {
      font-size: 11px;
      color: #999;
      margin-left: 3px;
      font-family: monospace;
    }

    .annotation {
      width: 100%;
      background: rgba(0,0,0,0.05);
      border-left: 3px solid #888;
      margin: 3px 0 5px 0;
      padding: 4px 8px;
      font-size: 13px;
    }

    .annotation-text {
      color: #555;
      font-style: italic;
    }

    .result {
      display: block;
      width: 100%;
      font-weight: bold;
      color: #333;
      margin-top: 8px;
      padding: 8px 5px;
      border-top: 1px solid #bbb;
    }

    /* Stats Panel */
    .stats-panel {
      padding: 6px 10px;
      background: #d0d0d0;
    }

    .stat-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
    }

    .piece {
      width: 14px;
      height: 14px;
      border-radius: 2px;
    }
    .piece.white { background: #fff; border: 1px solid #ccc; }
    .piece.black { background: #333; }

    .name {
      flex: 1;
      font-size: 13px;
      color: #333;
    }

    .badges { display: flex; gap: 4px; }

    .badge {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge.inaccuracy { background: rgba(86,180,233,0.2); color: var(--color-inaccuracy); }
    .badge.mistake { background: rgba(230,159,0,0.2); color: var(--color-mistake); }
    .badge.blunder { background: rgba(219,52,52,0.2); color: var(--color-blunder); }

    /* Chessground */
    :host ::ng-deep cg-board { background-color: #b58863; }
    :host ::ng-deep .cg-wrap piece { background-size: cover; }
    :host ::ng-deep .cg-wrap piece.pawn.white { background-image: url('https://lichess1.org/assets/piece/cburnett/wP.svg'); }
    :host ::ng-deep .cg-wrap piece.knight.white { background-image: url('https://lichess1.org/assets/piece/cburnett/wN.svg'); }
    :host ::ng-deep .cg-wrap piece.bishop.white { background-image: url('https://lichess1.org/assets/piece/cburnett/wB.svg'); }
    :host ::ng-deep .cg-wrap piece.rook.white { background-image: url('https://lichess1.org/assets/piece/cburnett/wR.svg'); }
    :host ::ng-deep .cg-wrap piece.queen.white { background-image: url('https://lichess1.org/assets/piece/cburnett/wQ.svg'); }
    :host ::ng-deep .cg-wrap piece.king.white { background-image: url('https://lichess1.org/assets/piece/cburnett/wK.svg'); }
    :host ::ng-deep .cg-wrap piece.pawn.black { background-image: url('https://lichess1.org/assets/piece/cburnett/bP.svg'); }
    :host ::ng-deep .cg-wrap piece.knight.black { background-image: url('https://lichess1.org/assets/piece/cburnett/bN.svg'); }
    :host ::ng-deep .cg-wrap piece.bishop.black { background-image: url('https://lichess1.org/assets/piece/cburnett/bB.svg'); }
    :host ::ng-deep .cg-wrap piece.rook.black { background-image: url('https://lichess1.org/assets/piece/cburnett/bR.svg'); }
    :host ::ng-deep .cg-wrap piece.queen.black { background-image: url('https://lichess1.org/assets/piece/cburnett/bQ.svg'); }
    :host ::ng-deep .cg-wrap piece.king.black { background-image: url('https://lichess1.org/assets/piece/cburnett/bK.svg'); }
    :host ::ng-deep .cg-wrap square.light { background-color: #f0d9b5; }
    :host ::ng-deep .cg-wrap square.dark { background-color: #b58863; }
    :host ::ng-deep .cg-wrap square.last-move { background-color: rgba(155, 199, 0, 0.41); }

    @media (max-width: 900px) {
      .lichess-layout {
        flex-direction: column;
        align-items: center;
      }
      .analysis-panel {
        width: 100%;
        max-width: var(--board-size);
        height: auto;
        max-height: 200px;
      }
      .left-panel {
        order: 2;
        border-right: none;
        border-top: 1px solid #bbb;
      }
      .board-section { order: 1; }
      .right-panel {
        order: 3;
        border-left: none;
        border-top: 1px solid #bbb;
      }
    }
  `]
})
export class GameDetailV2Component implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chessboard', { static: false }) chessboardElement!: ElementRef;
  @ViewChild('movesContainer', { static: false }) movesContainer!: ElementRef;

  gameId: string = '';
  game: GameData | null = null;
  moves: MoveAnalysis[] = [];
  movePairs: MovePair[] = [];
  currentMoveIndex: number = -1;
  currentEval: number = 0;
  chessground: any;
  chess = new Chess();
  orientation: 'white' | 'black' = 'white';

  whiteStats: PlayerStats = { inaccuracies: 0, mistakes: 0, blunders: 0, avgCentipawnLoss: 0, accuracy: 0 };
  blackStats: PlayerStats = { inaccuracies: 0, mistakes: 0, blunders: 0, avgCentipawnLoss: 0, accuracy: 0 };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chessApiService: ChessApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.gameId = params['id'];
      this.loadGameData();
    });
  }

  ngAfterViewInit() {
    this.initializeChessboard();
  }

  ngOnDestroy() {
    if (this.chessground) {
      this.chessground.destroy();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.goToPrevious();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.goToNext();
        break;
      case 'Home':
        event.preventDefault();
        this.goToStart();
        break;
      case 'End':
        event.preventDefault();
        this.goToEnd();
        break;
      case 'f':
        event.preventDefault();
        this.flipBoard();
        break;
    }
  }

  private loadGameData() {
    this.chessApiService.getGameAnalysis(+this.gameId).subscribe({
      next: (data) => {
        this.game = data.game;
        this.moves = data.analysis || [];
        this.processMoves();
        this.calculateStats();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading game data:', error);
      }
    });
  }

  private processMoves() {
    this.movePairs = [];
    for (let i = 0; i < this.moves.length; i += 2) {
      const whiteMove = this.moves[i] || null;
      const blackMove = this.moves[i + 1] || null;
      this.movePairs.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: whiteMove,
        black: blackMove,
        whiteIndex: i,
        blackIndex: i + 1
      });
    }
  }

  private calculateStats() {
    let whiteCpl = 0, whiteCount = 0;
    let blackCpl = 0, blackCount = 0;

    this.whiteStats = { inaccuracies: 0, mistakes: 0, blunders: 0, avgCentipawnLoss: 0, accuracy: 0 };
    this.blackStats = { inaccuracies: 0, mistakes: 0, blunders: 0, avgCentipawnLoss: 0, accuracy: 0 };

    this.moves.forEach((move, index) => {
      const isWhite = index % 2 === 0;
      const stats = isWhite ? this.whiteStats : this.blackStats;

      if (move.is_blunder) stats.blunders++;
      else if (move.is_mistake) stats.mistakes++;
      else if (move.is_inaccuracy) stats.inaccuracies++;

      if (move.centipawn_loss !== undefined) {
        if (isWhite) {
          whiteCpl += move.centipawn_loss;
          whiteCount++;
        } else {
          blackCpl += move.centipawn_loss;
          blackCount++;
        }
      }
    });

    this.whiteStats.avgCentipawnLoss = whiteCount > 0 ? Math.round(whiteCpl / whiteCount) : 0;
    this.blackStats.avgCentipawnLoss = blackCount > 0 ? Math.round(blackCpl / blackCount) : 0;

    this.whiteStats.accuracy = this.calculateAccuracy(this.whiteStats.avgCentipawnLoss);
    this.blackStats.accuracy = this.calculateAccuracy(this.blackStats.avgCentipawnLoss);
  }

  private calculateAccuracy(acpl: number): number {
    if (acpl === 0) return 100;
    const accuracy = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * acpl) - 3.1669));
    return Math.round(accuracy);
  }

  private initializeChessboard() {
    if (!this.chessboardElement) return;

    const config: Config = {
      fen: this.chess.fen(),
      orientation: this.orientation,
      coordinates: true,
      viewOnly: true,
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 200 }
    };

    this.chessground = Chessground(this.chessboardElement.nativeElement, config);
  }

  formatEval(evaluation: number): string {
    if (evaluation === undefined || evaluation === null) return '0.0';
    if (Math.abs(evaluation) > 1000) {
      const mateIn = Math.ceil((10000 - Math.abs(evaluation)) / 100);
      return evaluation > 0 ? `#${mateIn}` : `#-${mateIn}`;
    }
    const val = evaluation / 100;
    return val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
  }

  formatInlineEval(evaluation: number | undefined): string {
    if (evaluation === undefined || evaluation === null) return '';
    if (Math.abs(evaluation) > 1000) {
      const mateIn = Math.ceil((10000 - Math.abs(evaluation)) / 100);
      return evaluation > 0 ? `#${mateIn}` : `#-${mateIn}`;
    }
    const val = evaluation / 100;
    return val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
  }

  getWhiteWinPercent(): number {
    const cp = this.currentEval;
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  }

  getPlayerRating(color: 'white' | 'black'): string {
    if (!this.game) return '';
    const rating = color === 'white' ? this.game.white_elo : this.game.black_elo;
    return rating ? rating.toString() : '';
  }

  formatGameDate(): string {
    if (!this.game?.date_played) return '';
    try {
      const date = new Date(this.game.date_played);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch {
      return this.game.date_played;
    }
  }

  getMoveAnnotation(move: MoveAnalysis): string {
    if (move.is_blunder) return '??';
    if (move.is_mistake) return '?';
    if (move.is_inaccuracy) return '?!';
    return '';
  }

  getAnnotationLabel(move: MoveAnalysis): string {
    if (move.is_blunder) return 'Blunder.';
    if (move.is_mistake) return 'Mistake.';
    if (move.is_inaccuracy) return 'Inaccuracy.';
    return '';
  }

  getEvalChange(moveIndex: number): string {
    if (moveIndex < 0 || moveIndex >= this.moves.length) return '';
    const move = this.moves[moveIndex];
    const prevEval = moveIndex > 0 ? this.moves[moveIndex - 1]?.evaluation || 0 : 0;
    const currEval = move?.evaluation || 0;
    const prev = (prevEval / 100).toFixed(2);
    const curr = (currEval / 100).toFixed(2);
    return `(${prev >= '0' ? '+' + prev : prev} → ${curr >= '0' ? '+' + curr : curr})`;
  }

  getAnnotationClass(move: MoveAnalysis): string {
    if (move.is_blunder) return 'blunder';
    if (move.is_mistake) return 'mistake';
    if (move.is_inaccuracy) return 'inaccuracy';
    return '';
  }

  getResultText(): string {
    if (!this.game?.result) return '';
    switch (this.game.result) {
      case '1-0': return 'White is victorious';
      case '0-1': return 'Black is victorious';
      case '1/2-1/2': return 'Draw';
      default: return '';
    }
  }

  getPlayerScore(color: 'white' | 'black'): string {
    if (!this.game?.result) return '';
    if (this.game.result === '1-0') return color === 'white' ? '1' : '0';
    if (this.game.result === '0-1') return color === 'white' ? '0' : '1';
    if (this.game.result === '1/2-1/2') return '½';
    return '';
  }

  goBack() {
    this.router.navigate(['/games']);
  }

  goToMove(index: number) {
    if (index < 0 || index >= this.moves.length) return;
    this.currentMoveIndex = index;
    this.currentEval = this.moves[index]?.evaluation || 0;
    this.updateChessboard();
    this.scrollToCurrentMove();
  }

  goToStart() {
    this.currentMoveIndex = -1;
    this.currentEval = 0;
    this.chess.reset();
    this.updateBoardPosition();
    this.scrollToCurrentMove();
  }

  goToPrevious() {
    if (this.currentMoveIndex >= 0) {
      this.currentMoveIndex--;
      this.currentEval = this.currentMoveIndex >= 0 ? (this.moves[this.currentMoveIndex]?.evaluation || 0) : 0;
      this.updateChessboard();
      this.scrollToCurrentMove();
    }
  }

  goToNext() {
    if (this.currentMoveIndex < this.moves.length - 1) {
      this.currentMoveIndex++;
      this.currentEval = this.moves[this.currentMoveIndex]?.evaluation || 0;
      this.updateChessboard();
      this.scrollToCurrentMove();
    }
  }

  goToEnd() {
    if (this.moves.length > 0) {
      this.currentMoveIndex = this.moves.length - 1;
      this.currentEval = this.moves[this.currentMoveIndex]?.evaluation || 0;
      this.updateChessboard();
      this.scrollToCurrentMove();
    }
  }

  private scrollToCurrentMove() {
    if (!this.movesContainer) return;

    setTimeout(() => {
      const container = this.movesContainer.nativeElement;
      const currentMove = container.querySelector('.move.current');

      if (currentMove) {
        const containerRect = container.getBoundingClientRect();
        const moveRect = currentMove.getBoundingClientRect();

        if (moveRect.top < containerRect.top || moveRect.bottom > containerRect.bottom) {
          currentMove.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (this.currentMoveIndex === -1) {
        container.scrollTop = 0;
      }
    }, 50);
  }

  flipBoard() {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
    if (this.chessground) {
      this.chessground.set({ orientation: this.orientation });
    }
  }

  private updateChessboard() {
    this.chess.reset();
    for (let i = 0; i <= this.currentMoveIndex; i++) {
      if (this.moves[i]) {
        try {
          this.chess.move(this.moves[i].move);
        } catch (e) {
          console.warn('Invalid move:', this.moves[i].move);
        }
      }
    }
    this.updateBoardPosition();
  }

  private updateBoardPosition() {
    if (!this.chessground) return;

    const lastMove = this.getLastMoveSquares();
    this.chessground.set({
      fen: this.chess.fen(),
      lastMove: lastMove,
      check: this.chess.isCheck() ? this.getKingSquare() : undefined
    });
  }

  private getLastMoveSquares(): [Key, Key] | undefined {
    if (this.currentMoveIndex < 0) return undefined;

    const history = this.chess.history({ verbose: true });
    if (history.length === 0) return undefined;

    const lastMove = history[history.length - 1];
    return [lastMove.from as Key, lastMove.to as Key];
  }

  private getKingSquare(): Key | undefined {
    const turn = this.chess.turn();
    const board = this.chess.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'k' && piece.color === turn) {
          const files = 'abcdefgh';
          const ranks = '87654321';
          return (files[file] + ranks[rank]) as Key;
        }
      }
    }
    return undefined;
  }
}
