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

@Component({
  selector: 'app-game-detail-v2',
  standalone: true,
  imports: [CommonModule, HttpClientModule, LayoutComponent],
  template: `
    <app-layout>
      <div class="game-detail-container">
        <div class="game-header">
          <h1>Game Analysis Comparison</h1>
          <div class="view-toggle">
            <button 
              [class.active]="viewMode === 'original'"
              (click)="viewMode = 'original'">
              Original
            </button>
            <button 
              [class.active]="viewMode === 'inline'"
              (click)="viewMode = 'inline'">
              Inline
            </button>
            <button 
              [class.active]="viewMode === 'both'"
              (click)="viewMode = 'both'">
              Both
            </button>
          </div>
        </div>

        <div class="game-content" [ngClass]="viewMode">
          <!-- Chess Board -->
          <div class="board-section">
            <div #chessboard class="chessboard"></div>
          </div>

          <!-- Original View -->
          <div class="moves-section original" *ngIf="viewMode === 'original' || viewMode === 'both'">
            <h3>Original: Separate Critical Points</h3>
            <div class="move-list" *ngIf="moves.length > 0; else noData">
              <div class="moves-grid">
                <div *ngFor="let move of moves; let i = index" 
                     class="move-item"
                     [class.current]="currentMoveIndex === i"
                     (click)="goToMove(i)">
                  <span class="move-number" *ngIf="i % 2 === 0">{{Math.floor(i/2) + 1}}.</span>
                  <span class="move-text" 
                        [ngClass]="getMoveClass(move)">
                    {{move.move}}
                    <span class="move-symbol" *ngIf="getMoveSymbol(move)">{{getMoveSymbol(move)}}</span>
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Critical Points Section -->
            <div class="critical-points" *ngIf="criticalMoves.length > 0">
              <h4>Critical Points</h4>
              <div *ngFor="let critical of criticalMoves" class="critical-move">
                <div class="critical-header">
                  <span class="move-info">Move {{critical.move_number}}: {{critical.move}}</span>
                  <span class="quality-badge" [ngClass]="critical.move_quality">
                    {{critical.move_quality | titlecase}}
                  </span>
                </div>
                <div class="critical-details">
                  <span class="centipawn-loss">Loss: {{critical.centipawn_loss}}cp</span>
                  <span class="best-move" *ngIf="critical.best_move">Best: {{critical.best_move}}</span>
                </div>
              </div>
            </div>

            <ng-template #noData>
              <p>No game data available.</p>
            </ng-template>
          </div>

          <!-- Inline Annotations View -->
          <div class="moves-section inline" *ngIf="viewMode === 'inline' || viewMode === 'both'">
            <h3>Inline: Lichess-style Annotations</h3>
            <div class="lpv__side" *ngIf="moves.length > 0; else noDataInline">
              <div class="lpv__moves" role="complementary" aria-label="Game moves">
                <div [innerHTML]="renderedMovesHTML" (click)="onMoveClick($event)"></div>
              </div>
            </div>

            <ng-template #noDataInline>
              <p>No game data available.</p>
            </ng-template>
          </div>
        </div>
      </div>
    </app-layout>
  `,
  styles: [`
    .game-detail-container {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .game-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .view-toggle {
      display: flex;
      gap: 10px;
    }

    .view-toggle button {
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: white;
      cursor: pointer;
      border-radius: 4px;
    }

    .view-toggle button.active {
      background: #007bff;
      color: white;
    }

    .game-content {
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 20px;
    }

    .game-content.both {
      grid-template-columns: 400px 1fr 1fr;
    }

    .board-section {
      display: flex;
      flex-direction: column;
    }

    .chessboard {
      width: 400px;
      height: 400px;
    }

    .moves-section {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
      background: white;
    }

    .moves-section h3 {
      margin-top: 0;
      color: #333;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }

    /* Original View Styles */
    .moves-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-bottom: 20px;
    }

    .move-item {
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 3px;
    }

    .move-item:hover {
      background: #f0f0f0;
    }

    .move-item.current {
      background: #007bff;
      color: white;
    }

    .move-number {
      font-weight: bold;
      margin-right: 5px;
      min-width: 25px;
    }

    .move-text {
      color: #000;
    }

    .move-text.mistake {
      color: #ff6b35;
    }

    .move-text.inaccuracy {
      color: #ffa500;
    }

    .move-text.blunder {
      color: #dc3545;
    }

    .move-symbol {
      margin-left: 2px;
      font-weight: bold;
    }

    .critical-points {
      border-top: 1px solid #eee;
      padding-top: 15px;
    }

    .critical-move {
      margin-bottom: 15px;
      padding: 10px;
      border: 1px solid #eee;
      border-radius: 5px;
    }

    .critical-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }

    .quality-badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }

    .quality-badge.mistake {
      background: #ff6b35;
      color: white;
    }

    .quality-badge.inaccuracy {
      background: #ffa500;
      color: white;
    }

    .quality-badge.blunder {
      background: #dc3545;
      color: white;
    }

    .critical-details {
      display: flex;
      gap: 15px;
      font-size: 14px;
      color: #666;
    }

    /* Inline View Styles */
    .lpv__moves {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
    }

    .lpv__moves index {
      font-weight: bold;
      color: #666;
      margin-right: 5px;
    }

    .lpv__moves button.move {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 4px;
      margin: 0 2px;
      border-radius: 3px;
      color: #000;
    }

    .lpv__moves button.move:hover {
      background: #f0f0f0;
    }

    .lpv__moves button.move.current {
      background: #007bff;
      color: white;
    }

    .lpv__moves button.move.mistake {
      color: #ff6b35;
    }

    .lpv__moves button.move.inaccuracy {
      color: #ffa500;
    }

    .lpv__moves button.move.blunder {
      color: #dc3545;
    }

    .lpv__moves button.move.empty {
      color: #999;
      cursor: default;
    }

    .lpv__moves nag {
      font-weight: bold;
      margin-left: 1px;
    }

    .lpv__moves comment {
      display: block;
      color: #666;
      font-style: italic;
      margin: 5px 0;
      font-size: 14px;
    }

    .lpv__moves comment.result {
      font-weight: bold;
      color: #333;
      margin-top: 15px;
    }

    @media (max-width: 1200px) {
      .game-content.both {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto;
      }
      
      .chessboard {
        width: 300px;
        height: 300px;
      }
    }
  `]
})
export class GameDetailV2Component implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chessboard', { static: false }) chessboardElement!: ElementRef;

  gameId: string = '';
  moves: MoveAnalysis[] = [];
  criticalMoves: MoveAnalysis[] = [];
  currentMoveIndex: number = -1;
  chessground: any;
  chess = new Chess();
  viewMode: 'original' | 'inline' | 'both' = 'both';
  renderedMovesHTML: string = '';
  Math = Math;

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

  private loadGameData() {
    this.chessApiService.getGameAnalysis(+this.gameId).subscribe({
      next: (data) => {
        this.moves = data.analysis || [];
        this.criticalMoves = this.moves.filter(move => 
          move.is_blunder || move.is_mistake || move.is_inaccuracy
        );
        this.generateInlineMovesHTML();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading game data:', error);
      }
    });
  }

  private initializeChessboard() {
    if (!this.chessboardElement) return;

    const config: Config = {
      fen: this.chess.fen(),
      orientation: 'white',
      coordinates: true,
      highlight: {
        lastMove: true,
        check: true
      }
    };

    this.chessground = Chessground(this.chessboardElement.nativeElement, config);
  }

  private generateInlineMovesHTML() {
    let html = '';
    
    this.moves.forEach((move, index) => {
      // Add move number for white moves
      if (index % 2 === 0) {
        const moveNumber = Math.floor(index / 2) + 1;
        html += `<index>${moveNumber}.</index>`;
      }
      
      // Determine move quality
      let moveClass = 'move';
      let nagSymbol = '';
      
      if (move.is_blunder) {
        moveClass = 'move blunder';
        nagSymbol = '<nag title="Blunder">??</nag>';
      } else if (move.is_mistake) {
        moveClass = 'move mistake';
        nagSymbol = '<nag title="Mistake">?</nag>';
      } else if (move.is_inaccuracy) {
        moveClass = 'move inaccuracy';
        nagSymbol = '<nag title="Inaccuracy">?!</nag>';
      }
      
      // Add move button with click handler
      html += `<button class="${moveClass}" data-move="${index}">
        ${move.move}${nagSymbol}
      </button>`;
      
      // Add empty placeholder for black moves when white has annotation
      if ((move.is_blunder || move.is_mistake || move.is_inaccuracy) && index % 2 === 0) {
        html += `<button class="move empty" disabled>...</button>`;
      }
      
      // Add inline comment for problematic moves
      if (move.is_blunder || move.is_mistake || move.is_inaccuracy) {
        const quality = move.is_blunder ? 'Blunder' : move.is_mistake ? 'Mistake' : 'Inaccuracy';
        const bestMove = move.best_move ? ` ${move.best_move} was best.` : '';
        html += `<comment>(${move.centipawn_loss}cp) ${quality}.${bestMove}</comment>`;
      }
    });
    
    html += `<comment class="result">Game Analysis Complete</comment>`;
    this.renderedMovesHTML = html;
  }

  getMoveClass(move: MoveAnalysis): string {
    if (move.is_blunder) return 'blunder';
    if (move.is_mistake) return 'mistake';
    if (move.is_inaccuracy) return 'inaccuracy';
    return '';
  }

  getMoveSymbol(move: MoveAnalysis): string {
    if (move.is_blunder) return '??';
    if (move.is_mistake) return '?';
    if (move.is_inaccuracy) return '?!';
    return '';
  }

  goToMove(index: number) {
    this.currentMoveIndex = index;
    this.updateChessboard();
  }

  onMoveClick(event: Event) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('move') && !target.classList.contains('empty')) {
      const moveIndex = parseInt(target.getAttribute('data-move') || '0');
      this.goToMove(moveIndex);
    }
  }

  private updateChessboard() {
    if (!this.chessground || this.currentMoveIndex < 0) return;
    
    // Reset chess position and replay moves up to current index
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
    
    this.chessground.set({
      fen: this.chess.fen(),
      lastMove: this.currentMoveIndex >= 0 ? this.getLastMoveSquares() : undefined
    });
  }

  private getLastMoveSquares(): [Key, Key] | undefined {
    if (this.currentMoveIndex < 0 || !this.moves[this.currentMoveIndex]) return undefined;
    
    // This would need proper move parsing to get from/to squares
    // For now, return undefined - full implementation would parse UCI moves
    return undefined;
  }
}
