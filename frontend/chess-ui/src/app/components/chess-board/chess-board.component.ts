import { Component, OnInit, AfterViewInit, Input, Output, EventEmitter, HostListener, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Chess } from 'chess.js';

declare var Chessboard: any;

export interface GameAnalysis {
  game: any;
  analysis: any[];
}

@Component({
  selector: 'app-chess-board',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="chess-board-container">
      <!-- Player Names (flip based on board orientation) -->
      <div class="player-name-top" *ngIf="gameData">
        {{boardFlipped ? gameData.game.white_player : gameData.game.black_player}}
      </div>
      
      <!-- Chess Board with Side Win Probability -->
      <div class="board-with-probability">
        <div class="board-wrapper">
          <div id="chess-board" class="chess-board"></div>
          <div class="board-fallback" *ngIf="!boardLoaded">
            <mat-icon>sports_esports</mat-icon>
            <p>Loading chess board...</p>
          </div>
          <div class="last-move-arrow" *ngIf="lastMoveArrow" [innerHTML]="lastMoveArrow"></div>
          <div class="move-quality-icon" *ngIf="moveQualityIcon" [innerHTML]="moveQualityIcon"></div>
        </div>
        
        <!-- Vertical Win Probability Bar -->
        <div class="win-probability-vertical">
          <div class="win-bar-container">
            <div class="black-advantage-vertical" [style.height.%]="getBlackWinPercentage()"></div>
            <div class="white-advantage-vertical" [style.height.%]="getWhiteWinPercentage()"></div>
          </div>
        </div>
      </div>
      
      <!-- Player Names (flip based on board orientation) -->
      <div class="player-name-bottom" *ngIf="gameData">
        {{boardFlipped ? gameData.game.black_player : gameData.game.white_player}}
      </div>
      
      <!-- Move Controls with Flip Button -->
      <div class="move-controls">
        <button mat-icon-button (click)="goToStart()" [disabled]="currentMoveNumber === 0">
          <mat-icon>skip_previous</mat-icon>
        </button>
        <button mat-icon-button (click)="previousMove()" [disabled]="currentMoveNumber === 0">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="move-counter">{{currentMoveNumber}} / {{totalMoves}}</span>
        <button mat-icon-button (click)="nextMove()" [disabled]="currentMoveNumber >= totalMoves">
          <mat-icon>chevron_right</mat-icon>
        </button>
        <button mat-icon-button (click)="goToEnd()" [disabled]="currentMoveNumber >= totalMoves">
          <mat-icon>skip_next</mat-icon>
        </button>
        <button mat-icon-button (click)="flipBoard()" title="Flip Board">
          <mat-icon>flip</mat-icon>
        </button>
      </div>
      
      <!-- Win Probability Bar -->
      <div class="win-probability-container" *ngIf="currentAnalysis">
        <div class="win-probability-bar">
          <div class="white-advantage" [style.width.%]="getWhiteWinPercentage()"></div>
          <div class="black-advantage" [style.width.%]="getBlackWinPercentage()"></div>
        </div>
        <div class="win-probability-labels">
          <span class="white-label">White {{getWhiteWinPercentage()}}%</span>
          <span class="black-label">Black {{getBlackWinPercentage()}}%</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chess-board-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      max-width: 580px;
    }
    
    .board-with-probability {
      display: flex;
      align-items: center;
      gap: 1rem;
      width: 100%;
    }
    
    .board-wrapper {
      position: relative;
      width: 500px;
      height: 500px;
    }
    
    .chess-board {
      width: 500px;
      height: 500px;
    }
    
    .player-name-top, .player-name-bottom {
      text-align: center;
      font-size: 0.85rem;
      font-weight: 500;
      color: #333;
      padding: 0.25rem 0.5rem;
      background: #f5f5f5;
      border-radius: 4px;
      width: 100%;
    }
    
    .board-fallback {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      border: 2px solid #ddd;
      border-radius: 8px;
      color: #666;
    }
    
    .board-fallback mat-icon {
      font-size: 48px !important;
      width: 48px !important;
      height: 48px !important;
      margin-bottom: 1rem;
    }
    
    .last-move-arrow {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    }
    
    .move-quality-icon {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 15;
    }
    
    .move-controls {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      background: #f5f5f5;
      padding: 0.25rem;
      border-radius: 6px;
      width: 100%;
      justify-content: center;
    }
    
    .move-counter {
      font-weight: 600;
      min-width: 60px;
      text-align: center;
      font-size: 0.9rem;
    }
    
    .position-info {
      display: flex;
      gap: 1rem;
      padding: 0.5rem;
      background: #fafafa;
      border-radius: 6px;
      width: 500px;
      font-size: 0.85rem;
      justify-content: center;
    }
    
    .label {
      font-weight: 600;
      color: #666;
    }
    
    .value {
      margin-left: 0.5rem;
    }
    
    .move-quality.book { color: #8b5cf6; font-weight: 500; }
    .move-quality.excellent { color: #10b981; }
    .move-quality.good { color: #059669; }
    .move-quality.inaccuracy { color: #f59e0b; }
    .move-quality.mistake { color: #ef4444; }
    .move-quality.blunder { color: #dc2626; font-weight: bold; }
    
    .win-probability-vertical {
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 500px;
    }
    
    .win-bar-container {
      width: 12px;
      height: 500px;
      display: flex;
      flex-direction: column;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e0e0e0;
      background: #f8f9fa;
    }
    
    .black-advantage-vertical {
      background: linear-gradient(180deg, #6c757d 0%, #868e96 100%);
      transition: height 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      min-height: 5%;
    }
    
    .white-advantage-vertical {
      background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%);
      transition: height 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      min-height: 5%;
    }
    
    @media (max-width: 768px) {
      .board-wrapper {
        width: 320px;
        height: 320px;
      }
      
      .chess-board {
        width: 320px;
        height: 320px;
      }
      
      .board-with-probability {
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .win-probability-vertical {
        height: auto;
      }
      
      .win-bar-container {
        width: 100%;
        height: 8px;
        flex-direction: row;
      }
    }
  `]
})
export class ChessBoardComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() gameData: GameAnalysis | null = null;
  @Input() currentMoveNumber: number = 0;
  @Output() moveChanged = new EventEmitter<number>();

  private board: any;
  private game: Chess = new Chess();
  private gamePositions: string[] = [];
  private gameMoves: any[] = [];
  
  boardFlipped = false;
  totalMoves = 0;
  currentAnalysis: any = null;
  lastMoveArrow: SafeHtml = '';
  moveQualityIcon: SafeHtml = '';
  boardLoaded = false;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit() {
    if (this.gameData) {
      this.initializeGame();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['gameData'] && this.gameData) {
      this.initializeGame();
      if (this.board) {
        this.updatePosition();
      }
    }
    if (changes['currentMoveNumber']) {
      this.updatePosition();
    }
  }

  ngAfterViewInit() {
    this.loadChessboardCSS();
    setTimeout(() => {
      this.initializeBoard();
    }, 100);
  }

  ngOnDestroy() {
    if (this.board) {
      this.board.destroy();
    }
  }

  flipBoard() {
    if (!this.board) return;
    this.boardFlipped = !this.boardFlipped;
    this.board.flip();
    this.updateLastMoveArrow();
    this.updateMoveQualityIcon();
  }

  private initializeGame() {
    if (!this.gameData) return;

    this.game.reset();
    this.gamePositions = [this.game.fen()];
    this.gameMoves = [];
    this.totalMoves = this.gameData.analysis.length;

    for (let i = 0; i < this.gameData.analysis.length; i++) {
      const analysis = this.gameData.analysis[i];
      try {
        const moveObj = this.game.move(analysis.move);
        this.gamePositions.push(this.game.fen());
        this.gameMoves.push(moveObj);
      } catch (error) {
        console.error(`Error making move ${analysis.move}:`, error);
        break;
      }
    }

    this.updateCurrentAnalysis();
  }

  private loadChessboardCSS() {
    if (typeof document === 'undefined') return;
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.css';
    document.head.appendChild(link);
    
    const jqueryScript = document.createElement('script');
    jqueryScript.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
    jqueryScript.onload = () => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.js';
      script.onload = () => {
        this.initializeBoard();
      };
      document.head.appendChild(script);
    };
    document.head.appendChild(jqueryScript);
  }

  private initializeBoard() {
    if (typeof document === 'undefined') return;
    
    if (typeof (window as any).Chessboard === 'undefined') {
      setTimeout(() => this.initializeBoard(), 100);
      return;
    }

    this.board = (window as any).Chessboard('chess-board', {
      position: 'start',
      draggable: false,
      pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });

    this.boardLoaded = true;

    if (this.gameData) {
      this.updatePosition();
    }
  }

  private updatePosition() {
    if (!this.board || this.gamePositions.length === 0) return;

    const position = this.gamePositions[this.currentMoveNumber] || 'start';
    this.board.position(position);
    this.updateCurrentAnalysis();
    this.updateLastMoveArrow();
    this.updateMoveQualityIcon();
  }

  private updateCurrentAnalysis() {
    if (this.gameData && this.currentMoveNumber > 0) {
      this.currentAnalysis = this.gameData.analysis[this.currentMoveNumber - 1];
      console.log('Current analysis data:', this.currentAnalysis);
    } else {
      this.currentAnalysis = null;
    }
  }

  private updateLastMoveArrow() {
    if (this.currentMoveNumber === 0 || this.gameMoves.length === 0) {
      this.lastMoveArrow = '';
      return;
    }

    const moveObj = this.gameMoves[this.currentMoveNumber - 1];
    if (moveObj && moveObj.from && moveObj.to) {
      const svgContent = this.createArrowSVG(moveObj.from, moveObj.to);
      this.lastMoveArrow = this.sanitizer.bypassSecurityTrustHtml(svgContent);
    } else {
      this.lastMoveArrow = '';
    }
  }

  private updateMoveQualityIcon() {
    if (this.currentMoveNumber === 0 || this.gameMoves.length === 0) {
      this.moveQualityIcon = '';
      return;
    }

    const moveObj = this.gameMoves[this.currentMoveNumber - 1];
    if (!moveObj || !moveObj.to) {
      this.moveQualityIcon = '';
      return;
    }

    const quality = this.getMoveQualityClass();
    const icon = this.getMoveQualityIconSymbol(quality);
    
    if (icon) {
      const coords = this.squareToCoords(moveObj.to);
      if (coords) {
        const svgContent = this.createQualityIconSVG(coords, icon, quality);
        this.moveQualityIcon = this.sanitizer.bypassSecurityTrustHtml(svgContent);
      }
    } else {
      this.moveQualityIcon = '';
    }
  }

  private getMoveQualityIconSymbol(quality: string): string {
    switch (quality) {
      case 'book': return '📖';
      case 'excellent': return '✓';
      case 'good': return '✓';
      case 'inaccuracy': return '?!';
      case 'mistake': return '?';
      case 'blunder': return '??';
      default: return '';
    }
  }

  private createQualityIconSVG(coords: {x: number, y: number}, icon: string, quality: string): string {
    const color = this.getQualityColor(quality);
    
    return `
      <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
        <circle cx="${coords.x}%" cy="${coords.y}%" r="10" fill="${color}" stroke="white" stroke-width="1"/>
        <text x="${coords.x}%" y="${coords.y}%" text-anchor="middle" dominant-baseline="central" 
              fill="white" font-size="12" font-weight="bold">${icon}</text>
      </svg>
    `;
  }

  private getQualityColor(quality: string): string {
    switch (quality) {
      case 'book': return '#8b5cf6';
      case 'excellent': return '#10b981';
      case 'good': return '#059669';
      case 'inaccuracy': return '#f59e0b';
      case 'mistake': return '#ef4444';
      case 'blunder': return '#dc2626';
      default: return '#666';
    }
  }

  private createArrowSVG(from: string, to: string): string {
    const fromCoords = this.squareToCoords(from);
    const toCoords = this.squareToCoords(to);
    
    if (!fromCoords || !toCoords) return '';

    return `
      <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                  refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#ff6b6b" />
          </marker>
        </defs>
        <line x1="${fromCoords.x}%" y1="${fromCoords.y}%" 
              x2="${toCoords.x}%" y2="${toCoords.y}%" 
              stroke="#ff6b6b" stroke-width="3" 
              marker-end="url(#arrowhead)" />
      </svg>
    `;
  }

  private squareToCoords(square: string): {x: number, y: number} | null {
    if (square.length !== 2) return null;
    
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1]) - 1;
    
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
    
    // Position at top-right corner of square
    let x = (file + 0.85) * 12.5; // 85% across the square
    let y = (7 - rank + 0.15) * 12.5; // 15% down from top
    
    if (this.boardFlipped) {
      x = 100 - (file + 0.15) * 12.5; // 15% from left when flipped
      y = 100 - (7 - rank + 0.85) * 12.5; // 85% down when flipped
    }
    
    return { x, y };
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
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
  }

  goToStart() {
    this.currentMoveNumber = 0;
    this.updatePosition();
    this.moveChanged.emit(this.currentMoveNumber);
  }

  previousMove() {
    if (this.currentMoveNumber > 0) {
      this.currentMoveNumber--;
      this.updatePosition();
      this.moveChanged.emit(this.currentMoveNumber);
    }
  }

  nextMove() {
    if (this.currentMoveNumber < this.totalMoves) {
      this.currentMoveNumber++;
      this.updatePosition();
      this.moveChanged.emit(this.currentMoveNumber);
    }
  }

  goToEnd() {
    this.currentMoveNumber = this.totalMoves;
    this.updatePosition();
    this.moveChanged.emit(this.currentMoveNumber);
  }

  formatEvaluation(evaluation: number): string {
    if (!evaluation) return '0.00';
    return (evaluation / 100).toFixed(2);
  }

  getWhiteWinPercentage(): number {
    if (!this.currentAnalysis || !this.currentAnalysis.evaluation) return 50;
    
    const evaluation = this.currentAnalysis.evaluation / 100; // Convert centipawns to pawns
    const winProbability = 1 / (1 + Math.exp(-0.4 * evaluation)); // Sigmoid function
    return Math.round(winProbability * 100);
  }

  getBlackWinPercentage(): number {
    if (!this.currentAnalysis || !this.currentAnalysis.evaluation) return 50;
    return 100 - this.getWhiteWinPercentage();
  }

  getMoveQuality(): string {
    if (!this.currentAnalysis) return 'Start Position';
    
    if (this.currentAnalysis.book || this.currentAnalysis.is_book || this.currentMoveNumber <= 10) {
      return 'Book';
    }
    
    const cp = this.currentAnalysis?.centipawnLoss || 
               this.currentAnalysis?.centipawn_loss || 
               this.currentAnalysis?.cp_loss ||
               this.currentAnalysis?.loss ||
               0;
    
    if (cp <= 10) return 'Excellent';
    if (cp <= 25) return 'Good';
    if (cp <= 100) return 'Inaccuracy';
    if (cp <= 300) return 'Mistake';
    return 'Blunder';
  }

  getMoveQualityClass(): string {
    if (!this.currentAnalysis) return '';
    
    if (this.currentAnalysis.book || this.currentAnalysis.is_book || this.currentMoveNumber <= 10) {
      return 'book';
    }
    
    const cp = this.currentAnalysis?.centipawnLoss || 
               this.currentAnalysis?.centipawn_loss || 
               this.currentAnalysis?.cp_loss ||
               this.currentAnalysis?.loss ||
               0;
    
    if (cp <= 10) return 'excellent';
    if (cp <= 25) return 'good';
    if (cp <= 100) return 'inaccuracy';
    if (cp <= 300) return 'mistake';
    return 'blunder';
  }
}
