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
        <!-- Left: Chess Board -->
        <div class="board-section">
          <!-- Top Player Bar -->
          <div class="player-bar">
            <span class="player-name">{{ orientation === 'white' ? (game?.black_player || 'Black') : (game?.white_player || 'White') }}</span>
            <span class="player-score">{{ getPlayerScore(orientation === 'white' ? 'black' : 'white') }}</span>
          </div>

          <!-- Board -->
          <div class="board-wrapper">
            <div #chessboard class="cg-wrap"></div>
          </div>

          <!-- Bottom Player Bar -->
          <div class="player-bar">
            <span class="player-name">{{ orientation === 'white' ? (game?.white_player || 'White') : (game?.black_player || 'Black') }}</span>
            <span class="player-score">{{ getPlayerScore(orientation === 'white' ? 'white' : 'black') }}</span>
          </div>

          <!-- Controls -->
          <div class="board-controls">
            <button class="control-btn" (click)="goToStart()" title="Start (Home)">
              <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" transform="rotate(180 12 12)"/></svg>
            </button>
            <button class="control-btn" (click)="goToPrevious()" title="Previous (Left Arrow)">
              <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button class="control-btn flip-btn" (click)="flipBoard()" title="Flip Board (F)">
              <svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
            </button>
            <button class="control-btn" (click)="goToNext()" title="Next (Right Arrow)">
              <svg viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
            </button>
            <button class="control-btn" (click)="goToEnd()" title="End (End)">
              <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>
        </div>

        <!-- Right: Analysis Panel -->
        <div class="analysis-panel">
          <!-- Engine Eval -->
          <div class="eval-header">
            <span class="eval-value" [class.winning-white]="currentEval > 0" [class.winning-black]="currentEval < 0">
              {{ formatEval(currentEval) }}
            </span>
            <span class="opening-name" *ngIf="game?.opening_name">{{ game.opening_name }}</span>
          </div>

          <!-- Move List -->
          <div class="moves-container">
            <table class="moves-table">
              <ng-container *ngFor="let pair of movePairs">
                <tr class="move-row">
                  <td class="move-number">{{ pair.moveNumber }}.</td>
                  <td class="move-cell"
                      [class.current]="currentMoveIndex === pair.whiteIndex"
                      [class.blunder]="pair.white?.is_blunder"
                      [class.mistake]="pair.white?.is_mistake"
                      [class.inaccuracy]="pair.white?.is_inaccuracy"
                      (click)="pair.white && goToMove(pair.whiteIndex)">
                    <span class="move-san" *ngIf="pair.white">{{ pair.white.move }}</span>
                    <span class="move-nag" *ngIf="pair.white && getMoveAnnotation(pair.white)">{{ getMoveAnnotation(pair.white) }}</span>
                    <span class="move-eval" *ngIf="pair.white">{{ formatEval(pair.white.evaluation) }}</span>
                  </td>
                  <td class="move-cell"
                      [class.current]="currentMoveIndex === pair.blackIndex"
                      [class.blunder]="pair.black?.is_blunder"
                      [class.mistake]="pair.black?.is_mistake"
                      [class.inaccuracy]="pair.black?.is_inaccuracy"
                      (click)="pair.black && goToMove(pair.blackIndex)">
                    <span class="move-san" *ngIf="pair.black">{{ pair.black.move }}</span>
                    <span class="move-nag" *ngIf="pair.black && getMoveAnnotation(pair.black)">{{ getMoveAnnotation(pair.black) }}</span>
                    <span class="move-eval" *ngIf="pair.black">{{ formatEval(pair.black.evaluation) }}</span>
                  </td>
                </tr>
                <!-- Annotation for white -->
                <tr class="annotation-row" *ngIf="pair.white && (pair.white.is_blunder || pair.white.is_mistake || pair.white.is_inaccuracy)">
                  <td colspan="3">
                    <div class="annotation" [ngClass]="getAnnotationClass(pair.white)">
                      {{ getAnnotationLabel(pair.white) }} <span *ngIf="pair.white.best_move">{{ pair.white.best_move }} was best.</span>
                    </div>
                  </td>
                </tr>
                <!-- Annotation for black -->
                <tr class="annotation-row" *ngIf="pair.black && (pair.black.is_blunder || pair.black.is_mistake || pair.black.is_inaccuracy)">
                  <td colspan="3">
                    <div class="annotation" [ngClass]="getAnnotationClass(pair.black)">
                      {{ getAnnotationLabel(pair.black) }} <span *ngIf="pair.black.best_move">{{ pair.black.best_move }} was best.</span>
                    </div>
                  </td>
                </tr>
              </ng-container>
            </table>

            <!-- Result -->
            <div class="result-box" *ngIf="game?.result">
              <div class="result-score">{{ game.result }}</div>
              <div class="result-text">{{ getResultText() }}</div>
            </div>
          </div>

          <!-- Player Stats - Lichess style -->
          <div class="stats-container">
            <div class="player-stats">
              <div class="stats-row">
                <span class="color-dot white"></span>
                <span class="name">{{ game?.white_player || 'White' }}</span>
              </div>
              <div class="stats-numbers">
                <span class="stat inaccuracy">{{ whiteStats.inaccuracies }} <small>Inaccuracies</small></span>
                <span class="stat mistake">{{ whiteStats.mistakes }} <small>Mistakes</small></span>
                <span class="stat blunder">{{ whiteStats.blunders }} <small>Blunders</small></span>
              </div>
              <span class="accuracy">{{ whiteStats.accuracy }}%</span>
            </div>

            <div class="player-stats">
              <div class="stats-row">
                <span class="color-dot black"></span>
                <span class="name">{{ game?.black_player || 'Black' }}</span>
              </div>
              <div class="stats-numbers">
                <span class="stat inaccuracy">{{ blackStats.inaccuracies }} <small>Inaccuracies</small></span>
                <span class="stat mistake">{{ blackStats.mistakes }} <small>Mistakes</small></span>
                <span class="stat blunder">{{ blackStats.blunders }} <small>Blunders</small></span>
              </div>
              <span class="accuracy">{{ blackStats.accuracy }}%</span>
            </div>
          </div>

          <!-- Back Button -->
          <button class="back-btn" (click)="goBack()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back to Games
          </button>
        </div>
      </div>
    </app-layout>
  `,
  styles: [`
    :host {
      --color-inaccuracy: #56b4e9;
      --color-mistake: #e69f00;
      --color-blunder: #db3434;
    }

    .lichess-layout {
      display: grid;
      grid-template-columns: 1fr 360px;
      height: calc(100vh - 64px);
      max-height: calc(100vh - 64px);
      overflow: hidden;
      background: hsl(var(--background));
      color: hsl(var(--foreground));
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    /* Board Section */
    .board-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: hsl(var(--background));
      overflow: hidden;
    }

    .player-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      max-width: min(calc(100vh - 200px), 100%);
      padding: 10px 14px;
      background: hsl(var(--card));
      color: hsl(var(--card-foreground));
      font-size: 14px;
      border: 1px solid hsl(var(--border));
      flex-shrink: 0;
    }

    .player-bar:first-child {
      border-radius: 6px 6px 0 0;
      border-bottom: none;
    }

    .player-bar:nth-of-type(3) {
      border-radius: 0 0 6px 6px;
      border-top: none;
    }

    .player-name {
      font-weight: 600;
    }

    .player-score {
      font-weight: bold;
      opacity: 0.7;
    }

    .board-wrapper {
      width: 100%;
      max-width: min(calc(100vh - 200px), 100%);
      aspect-ratio: 1;
      border-left: 1px solid hsl(var(--border));
      border-right: 1px solid hsl(var(--border));
      flex-shrink: 0;
    }

    .cg-wrap {
      width: 100%;
      height: 100%;
    }

    .board-controls {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 12px;
      flex-shrink: 0;
    }

    .control-btn {
      width: 40px;
      height: 36px;
      border: 1px solid hsl(var(--border));
      background: hsl(var(--card));
      color: hsl(var(--card-foreground));
      cursor: pointer;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .control-btn:hover {
      background: hsl(var(--muted));
      border-color: hsl(var(--primary));
    }

    .control-btn svg {
      width: 22px;
      height: 22px;
      fill: hsl(var(--card-foreground));
    }

    .flip-btn svg {
      width: 18px;
      height: 18px;
    }

    /* Analysis Panel */
    .analysis-panel {
      display: flex;
      flex-direction: column;
      background: hsl(var(--card));
      color: hsl(var(--card-foreground));
      border-left: 1px solid hsl(var(--border));
      overflow: hidden;
      height: 100%;
    }

    .eval-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: hsl(var(--card));
      border-bottom: 1px solid hsl(var(--border));
      flex-shrink: 0;
    }

    .eval-value {
      font-size: 22px;
      font-weight: bold;
      font-family: monospace;
    }

    .eval-value.winning-white { color: hsl(var(--card-foreground)); }
    .eval-value.winning-black { opacity: 0.6; }

    .opening-name {
      font-size: 13px;
      opacity: 0.7;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .moves-container {
      flex: 1;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: hsl(var(--border)) transparent;
    }

    .moves-container::-webkit-scrollbar {
      width: 8px;
    }

    .moves-container::-webkit-scrollbar-track {
      background: transparent;
    }

    .moves-container::-webkit-scrollbar-thumb {
      background-color: hsl(var(--border));
      border-radius: 4px;
    }

    .moves-container::-webkit-scrollbar-thumb:hover {
      background-color: hsl(var(--muted-foreground));
    }

    .moves-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .move-row {
      border-bottom: 1px solid hsl(var(--border) / 0.5);
    }

    .move-row:hover {
      background: hsl(var(--muted) / 0.5);
    }

    .move-number {
      width: 32px;
      padding: 6px 8px;
      text-align: right;
      opacity: 0.5;
      font-weight: 600;
      font-size: 13px;
      vertical-align: top;
    }

    .move-cell {
      padding: 6px 8px;
      cursor: pointer;
      transition: background 0.1s;
      position: relative;
      vertical-align: top;
      width: 45%;
    }

    .move-cell:hover {
      background: hsl(var(--muted) / 0.7);
    }

    .move-cell.current {
      background: hsl(var(--primary));
      color: hsl(var(--primary-foreground));
    }

    .move-cell.current .move-eval {
      opacity: 0.8;
    }

    .move-san {
      font-weight: 500;
    }

    .move-nag {
      margin-left: 1px;
      font-weight: bold;
    }

    .move-cell.blunder .move-san,
    .move-cell.blunder .move-nag { color: var(--color-blunder); }
    .move-cell.mistake .move-san,
    .move-cell.mistake .move-nag { color: var(--color-mistake); }
    .move-cell.inaccuracy .move-san,
    .move-cell.inaccuracy .move-nag { color: var(--color-inaccuracy); }

    .move-cell.current.blunder .move-san,
    .move-cell.current.blunder .move-nag,
    .move-cell.current.mistake .move-san,
    .move-cell.current.mistake .move-nag,
    .move-cell.current.inaccuracy .move-san,
    .move-cell.current.inaccuracy .move-nag {
      color: inherit;
    }

    .move-eval {
      float: right;
      opacity: 0.5;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      padding-left: 8px;
    }

    .annotation-row td {
      padding: 0;
    }

    .annotation {
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 500;
    }

    .annotation.blunder {
      background: rgba(219, 52, 52, 0.15);
      color: var(--color-blunder);
    }
    .annotation.mistake {
      background: rgba(230, 159, 0, 0.15);
      color: var(--color-mistake);
    }
    .annotation.inaccuracy {
      background: rgba(86, 180, 233, 0.15);
      color: var(--color-inaccuracy);
    }

    .annotation span {
      opacity: 0.85;
      font-weight: 400;
    }

    .result-box {
      text-align: center;
      padding: 24px;
      border-top: 1px solid hsl(var(--border));
      background: hsl(var(--muted));
    }

    .result-score {
      font-size: 28px;
      font-weight: bold;
    }

    .result-text {
      font-size: 13px;
      opacity: 0.7;
      font-style: italic;
      margin-top: 4px;
    }

    /* Stats - Lichess style */
    .stats-container {
      border-top: 1px solid hsl(var(--border));
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: hsl(var(--card));
    }

    .player-stats {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }

    .stats-row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 120px;
    }

    .color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .color-dot.white { background: #fff; border: 1px solid hsl(var(--border)); }
    .color-dot.black { background: #000; }

    .name {
      font-weight: 600;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .stats-numbers {
      display: flex;
      gap: 8px;
      flex: 1;
    }

    .stat {
      font-size: 13px;
      display: flex;
      align-items: baseline;
      gap: 3px;
    }

    .stat small {
      font-size: 11px;
      font-weight: normal;
      opacity: 0.7;
    }

    .stat.inaccuracy { color: var(--color-inaccuracy); }
    .stat.mistake { color: var(--color-mistake); }
    .stat.blunder { color: var(--color-blunder); }

    .stats-summary {
      display: none;
    }

    .accuracy {
      color: hsl(var(--success));
      font-weight: 600;
      font-size: 12px;
      margin-left: auto;
    }

    .back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 14px;
      padding: 10px 16px;
      background: hsl(var(--card));
      border: 1px solid hsl(var(--border));
      border-radius: 6px;
      color: hsl(var(--card-foreground));
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s;
    }

    .back-btn:hover {
      background: hsl(var(--muted));
      border-color: hsl(var(--primary));
    }

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

    /* Responsive */
    @media (max-width: 900px) {
      .lichess-layout {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr;
        min-height: auto;
      }

      .board-section {
        padding: 16px;
      }

      .board-wrapper {
        max-width: min(90vw, 500px);
      }

      .player-bar {
        max-width: min(90vw, 500px);
      }

      .analysis-panel {
        border-left: none;
        border-top: 1px solid hsl(var(--border));
      }

      .moves-container {
        max-height: 300px;
      }
    }

    @media (max-width: 500px) {
      .stats-numbers {
        gap: 10px;
      }

      .stat {
        font-size: 16px;
      }

      .control-btn {
        width: 40px;
        height: 36px;
      }
    }
  `]
})
export class GameDetailV2Component implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chessboard', { static: false }) chessboardElement!: ElementRef;

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
    if (this.game.result === '1/2-1/2') return '1/2';
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
  }

  goToStart() {
    this.currentMoveIndex = -1;
    this.currentEval = 0;
    this.chess.reset();
    this.updateBoardPosition();
  }

  goToPrevious() {
    if (this.currentMoveIndex >= 0) {
      this.currentMoveIndex--;
      this.currentEval = this.currentMoveIndex >= 0 ? (this.moves[this.currentMoveIndex]?.evaluation || 0) : 0;
      this.updateChessboard();
    }
  }

  goToNext() {
    if (this.currentMoveIndex < this.moves.length - 1) {
      this.currentMoveIndex++;
      this.currentEval = this.moves[this.currentMoveIndex]?.evaluation || 0;
      this.updateChessboard();
    }
  }

  goToEnd() {
    if (this.moves.length > 0) {
      this.currentMoveIndex = this.moves.length - 1;
      this.currentEval = this.moves[this.currentMoveIndex]?.evaluation || 0;
      this.updateChessboard();
    }
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
