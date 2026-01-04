import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chess } from 'chess.js';
import { Chessground } from '@lichess-org/chessground';
import { Config } from '@lichess-org/chessground/config';
import { Key } from '@lichess-org/chessground/types';
import { MoveQualityEnum, MOVE_QUALITY_COLORS, getMoveQualitySymbol, type MoveQuality } from '../../constants/move-quality.constants';

interface MoveAnalysis {
  move_number: number;
  move: string;
  evaluation: number;
  centipawn_loss: number;
  is_blunder: boolean;
  is_mistake: boolean;
  is_inaccuracy: boolean;
  fen_after: string;
  fen_before?: string;
  best_move?: string; // UCI notation (e.g., "e2e4")
}

@Component({
  selector: 'app-chess-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chess-board-container">
      <div class="board-and-evaluation">
        <div class="chess-board-wrapper" [class.flipped]="isFlipped">
          <!-- Player names -->
          <div *ngIf="whitePlayer" [class]="getPlayerNameClass('white')">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-white border border-gray-400 rounded-sm"></div>
              <span>{{ whitePlayer }}</span>
            </div>
          </div>
          
          <div *ngIf="blackPlayer" [class]="getPlayerNameClass('black')">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-gray-800 border border-gray-600 rounded-sm"></div>
              <span>{{ blackPlayer }}</span>
            </div>
          </div>

          <div class="board-with-eval">
            <div #chessBoard class="chess-board"></div>
          </div>
        </div>
      </div>
      
      <div class="board-controls">
        <button 
          (click)="goToStart()" 
          [disabled]="internalMoveIndex === 0"
          class="control-btn">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
          </svg>
        </button>
        
        <button 
          (click)="previousMove()" 
          [disabled]="internalMoveIndex === 0"
          class="control-btn">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>

        <button 
          (click)="flipBoard()" 
          class="control-btn flip-btn"
          title="Flip Board">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
          </svg>
        </button>
        
        <button 
          (click)="nextMove()" 
          [disabled]="internalMoveIndex >= moves.length - 1"
          class="control-btn">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
        
        <button 
          (click)="goToEnd()" 
          [disabled]="internalMoveIndex >= moves.length - 1"
          class="control-btn">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .chess-board-container {
      @apply flex flex-col items-center gap-4 p-4;
      max-width: 100%;
    }

    .board-and-evaluation {
      @apply flex items-start gap-1;
    }

    .chess-board-wrapper {
      @apply relative;
      width: clamp(360px, 60vw, 520px);
      height: clamp(360px, 60vw, 520px);
      aspect-ratio: 1;
    }

    .board-with-eval {
      @apply flex items-start gap-1;
      width: 100%;
      height: 100%;
    }

    .chess-board {
      width: 100%;
      height: 100%;
      min-width: 320px;
      min-height: 320px;
      background: #f0d9b5;
    }

    /* Force Chessground visibility */
    :host ::ng-deep cg-board {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
    }

    :host ::ng-deep cg-container {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
    }

    /* Move quality piece annotations */
    :host ::ng-deep .move-quality-annotation {
      pointer-events: none;
      z-index: 100;
    }

    :host ::ng-deep .move-quality-annotation text {
      font-family: 'Arial', sans-serif;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    }

    /* Evaluation section positioned on the side */
    .evaluation-section {
      @apply flex;
      height: 100%;
    }

    /* Player name styling */
    .player-name {
      @apply absolute z-20 px-3 py-2 rounded-md font-semibold text-sm;
      @apply bg-white/90 backdrop-blur-sm border border-gray-200 shadow-md;
      @apply transition-all duration-200;
      min-width: 120px;
      text-align: center;
    }

    .player-name:hover {
      @apply bg-white shadow-lg scale-105;
    }

    .player-name.bottom-left {
      bottom: -40px;
      left: 0px;
    }

    .player-name.top-left {
      top: -40px;
      left: 0px;
    }

    .player-name.player-white {
      @apply text-gray-800 border-gray-300;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    }

    .player-name.player-black {
      @apply text-white border-gray-600;
      background: linear-gradient(135deg, #343a40 0%, #212529 100%);
    }

    /* Board controls */
    .board-controls {
      @apply flex items-center justify-center gap-2 mt-4;
      @apply bg-white rounded-lg p-2 shadow-sm border border-gray-200;
    }

    .control-btn {
      @apply flex items-center justify-center w-10 h-10 rounded-md;
      @apply bg-gray-100 hover:bg-gray-200 text-gray-700;
      @apply transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500;
    }

    .control-btn:hover {
      @apply shadow-md transform scale-105;
    }

    .control-btn:disabled {
      @apply opacity-50 cursor-not-allowed;
    }

    .flip-btn {
      @apply bg-blue-100 hover:bg-blue-200 text-blue-700;
    }

    /* Evaluation section */
    .evaluation-section {
      @apply flex justify-center mt-4;
    }

    /* Responsive design */
    @media (max-width: 640px) {
      .chess-board-container {
        @apply p-2 gap-2;
      }

      .board-and-evaluation {
        @apply flex-col gap-2;
      }
      
      .chess-board-wrapper {
        width: calc(100vw - 32px);
        height: calc(100vw - 32px);
        max-width: 360px;
        max-height: 360px;
      }

      .evaluation-section {
        height: auto;
      }
      
      .player-name {
        @apply px-2 py-1 text-xs;
        min-width: 100px;
      }
      
      .control-btn {
        @apply w-8 h-8;
      }
    }
  `]
})
export class ChessBoardComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('chessBoard', { static: true }) chessBoardElement!: ElementRef;
  @Input() moves: MoveAnalysis[] = [];
  @Input() currentMoveIndex: number = -1;
  @Input() initialPosition: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  @Input() whitePlayer: string = '';
  @Input() blackPlayer: string = '';
  @Input() previewFen: string | null = null; // For previewing alternative moves
  @Input() showBestMoveArrow: boolean = true; // Show arrow for best move on mistakes/blunders
  @Input() bestMoveUci: string | null = null; // UCI notation for best move (e.g., "e2e4")
  @Output() moveChanged = new EventEmitter<number>();

  private board: ReturnType<typeof Chessground> | null = null;
  private game!: Chess;
  internalMoveIndex: number = -1;
  currentMove: MoveAnalysis | null = null;
  isFlipped: boolean = false;
  
  // Make Math available in template
  Math = Math;

  ngOnInit() {
    this.game = new Chess(this.initialPosition);
    this.setupKeyboardListeners();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['moves'] && this.moves) {
      // Reset to initial position when moves change
      this.internalMoveIndex = -1;
      this.currentMove = null;
      if (this.game) {
        this.game.reset();
        this.game.load(this.initialPosition);
      }
    }

    if (changes['currentMoveIndex'] && changes['currentMoveIndex'].currentValue !== undefined) {
      // Update board position when currentMoveIndex input changes
      this.goToMove(changes['currentMoveIndex'].currentValue);
    }

    if (changes['previewFen']) {
      // Update board to show preview position or return to current position
      this.updateBoardPosition();
    }
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initializeBoard();
    }, 100);
  }

  private initializeBoard() {
    
    const element = this.chessBoardElement?.nativeElement;
    if (!element) {
      return;
    }


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
          visible: true,
          brushes: {
            // Custom brushes for best-move arrows
            green: { key: 'g', color: '#15781B', opacity: 0.8, lineWidth: 10 },
            red: { key: 'r', color: '#882020', opacity: 0.8, lineWidth: 10 },
            blue: { key: 'b', color: '#003088', opacity: 0.8, lineWidth: 10 },
            yellow: { key: 'y', color: '#e68f00', opacity: 0.8, lineWidth: 10 },
            purple: { key: 'p', color: '#68217a', opacity: 0.8, lineWidth: 10 }
          }
        }
      };

      this.board = Chessground(element, config);
      
      // Force a redraw and set position
      if (this.board) {
        this.board.set({
          fen: this.initialPosition
        });
        this.board.redrawAll();
      }
    } catch (error) {
    }
  }

  ngOnDestroy() {
    this.removeKeyboardListeners();
    if (this.board) {
      this.board.destroy();
    }
  }

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
    if (this.internalMoveIndex > -1) {
      this.goToMove(this.internalMoveIndex - 1);
    }
  }

  nextMove() {
    if (this.internalMoveIndex < this.moves.length - 1) {
      this.goToMove(this.internalMoveIndex + 1);
    }
  }

  goToEnd() {
    this.goToMove(this.moves.length - 1);
  }

  goToMove(moveIndex: number) {
    this.internalMoveIndex = moveIndex;
    this.currentMove = moveIndex >= 0 ? this.moves[moveIndex] : null;

    // Reset game to initial position
    this.game = new Chess(this.initialPosition);

    // Play moves up to current position
    let lastMove: { from: Key; to: Key } | undefined;
    for (let i = 0; i <= moveIndex; i++) {
      if (this.moves[i]) {
        try {
          const move = this.game.move(this.moves[i].move);
          if (i === moveIndex) {
            lastMove = { from: move.from as Key, to: move.to as Key };
          }
        } catch (error) {
          break;
        }
      }
    }

    // Update board position with move quality highlighting
    this.updateBoardPosition();

    // Emit move change event
    this.moveChanged.emit(moveIndex);
  }

  private updateBoardPosition(): void {
    if (!this.board) return;

    // If preview FEN is provided, show it instead of the current position
    if (this.previewFen) {
      try {
        // Create a temporary chess instance to validate the preview FEN and get last move
        const previewGame = new Chess(this.previewFen);
        this.board.set({
          fen: this.previewFen,
          drawable: {
            autoShapes: [] // Clear any move quality annotations when previewing
          }
        });
      } catch (error) {
        console.error('Invalid preview FEN:', error);
      }
    } else {
      // Show the current position from the game
      let lastMove: { from: Key; to: Key } | undefined;

      // Recalculate last move for current position
      const tempGame = new Chess(this.initialPosition);
      for (let i = 0; i <= this.internalMoveIndex; i++) {
        if (this.moves[i]) {
          try {
            const move = tempGame.move(this.moves[i].move);
            if (i === this.internalMoveIndex) {
              lastMove = { from: move.from as Key, to: move.to as Key };
            }
          } catch (error) {
            break;
          }
        }
      }

      this.board.set({
        fen: this.game.fen(),
        lastMove: lastMove ? [lastMove.from, lastMove.to] : undefined
      });

      // Add move quality highlighting
      if (lastMove && this.currentMove) {
        this.highlightMoveQuality(lastMove.from, lastMove.to);
      }
    }
  }

  private highlightMoveQuality(from: Key, to: Key): void {
    if (!this.board || !this.currentMove) return;

    const quality = this.getMoveQuality();
    const icon = this.getMoveQualityIcon(quality);
    const color = this.getMoveQualityColor(quality);

    const shapes: any[] = [];

    // Add move quality badge at top-right corner of square
    if (icon) {
      shapes.push({
        orig: to,
        customSvg: {
          html: `<circle cx="85%" cy="15%" r="24" fill="${color}" stroke="white" stroke-width="3" opacity="0.95"/>
                 <text x="85%" y="18%" text-anchor="middle" dominant-baseline="middle"
                       font-size="26" font-weight="bold" fill="white" font-family="Arial, sans-serif">
                   ${icon}
                 </text>`
        }
      });
    }

    // Add best-move arrow for mistakes/blunders/inaccuracies
    if (this.showBestMoveArrow && this.shouldShowBestMoveArrow(quality)) {
      const bestMove = this.bestMoveUci || this.currentMove.best_move;
      if (bestMove && bestMove.length >= 4) {
        const bestFrom = bestMove.substring(0, 2) as Key;
        const bestTo = bestMove.substring(2, 4) as Key;

        // Only show arrow if best move is different from played move
        if (bestFrom !== from || bestTo !== to) {
          shapes.push({
            orig: bestFrom,
            dest: bestTo,
            brush: this.getBestMoveArrowBrush(quality)
          });
        }
      }
    }

    if (shapes.length > 0) {
      this.board.set({
        drawable: {
          autoShapes: shapes
        }
      });
    }
  }

  private shouldShowBestMoveArrow(quality: string): boolean {
    return quality === 'blunder' || quality === 'mistake' || quality === 'inaccuracy';
  }

  private getBestMoveArrowBrush(quality: string): string {
    // Use different colors based on severity
    switch (quality) {
      case 'blunder': return 'red';
      case 'mistake': return 'yellow';
      case 'inaccuracy': return 'blue';
      default: return 'green';
    }
  }

  private getMoveQualityIcon(quality: string): string {
    // Use Lichess-style symbols from the config
    const symbol = getMoveQualitySymbol(quality as MoveQuality);
    if (symbol) return symbol;

    // Fallback for book moves
    if (quality === 'book') return '📖';
    return '';
  }

  private getMoveQualityColor(quality: string): string {
    const colors = MOVE_QUALITY_COLORS[quality as MoveQuality];
    return colors?.background || '#666';
  }

  formatEvaluation(evaluation: number): string {
    if (Math.abs(evaluation) > 900) {
      return evaluation > 0 ? '+M' : '-M';
    }
    return (evaluation / 100).toFixed(1);
  }

  getEvaluationClass(): string {
    if (!this.currentMove) return 'eval-neutral';
    const evaluation = this.currentMove.evaluation;
    if (evaluation > 50) return 'eval-positive';
    if (evaluation < -50) return 'eval-negative';
    return 'eval-neutral';
  }

  getMoveQuality(): string {
    if (!this.currentMove) return '';

    if (this.currentMove.is_blunder) return 'blunder';
    if (this.currentMove.is_mistake) return 'mistake';
    if (this.currentMove.is_inaccuracy) return 'inaccuracy';

    // For good moves, check centipawn loss
    const cpLoss = this.currentMove.centipawn_loss || 0;
    if (cpLoss <= 5) return 'best';
    if (cpLoss <= 15) return 'excellent';
    if (cpLoss <= 30) return 'good';

    return '';
  }

  getMoveQualityStyle(): any {
    const quality = this.getMoveQuality() as MoveQuality;
    const colors = MOVE_QUALITY_COLORS[quality];
    if (!colors) return {};
    
    return {
      'background-color': colors.background,
      'color': colors.text,
      'border-color': colors.border
    };
  }

  getMoveQualityClass(): string {
    const quality = this.getMoveQuality().toLowerCase();
    return `move-${quality}`;
  }

  flipBoard(): void {
    this.isFlipped = !this.isFlipped;
    if (this.board) {
      this.board.set({
        orientation: this.isFlipped ? 'black' : 'white'
      });
    }
  }

  getPlayerNameClass(player: 'white' | 'black'): string {
    const baseClass = 'player-name';
    const colorClass = `player-${player}`;
    
    let positionClass: string;
    if (player === 'white') {
      positionClass = this.isFlipped ? 'top-left' : 'bottom-left';
    } else {
      positionClass = this.isFlipped ? 'bottom-left' : 'top-left';
    }
    
    return `${baseClass} ${colorClass} ${positionClass}`;
  }

  getBoardHeight(): number {
    const viewportWidth = window.innerWidth;
    if (viewportWidth < 640) return Math.min(400, viewportWidth - 32);
    if (viewportWidth < 1024) return Math.min(520, viewportWidth * 0.6);
    return 520;
  }
}
