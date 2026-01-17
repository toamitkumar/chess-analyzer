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

interface Alternative {
  move: string;
  evaluation: number;
  line?: string[];
}

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
  alternatives?: Alternative[];
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
  tournament_id?: number;
  event?: string;
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
  acpl?: number;
}

@Component({
  selector: 'app-game-detail-v2',
  standalone: true,
  imports: [CommonModule, HttpClientModule, LayoutComponent],
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
          <h1 class="text-2xl sm:text-3xl font-bold text-foreground">Game Analysis</h1>
          <p class="text-sm text-muted-foreground">Review moves, accuracy, and engine evaluation</p>
        </div>
      </div>

      <div class="lichess-layout">
        <!-- Left Panel: Player Stats, Phase Analysis, Move Quality -->
        <div class="analysis-panel left-panel">
          <!-- Back to Games Button -->
          <button
            (click)="navigateTo('/games')"
            class="w-full mb-3 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
            </svg>
            Back to Games
          </button>
          <!-- Player Stats -->
          <div class="rounded-xl border-2 border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden mb-3">
            <div class="px-4 py-2 bg-gradient-to-r from-muted/50 to-transparent border-b border-border/30">
              <h3 class="text-sm font-semibold text-foreground tracking-wide">Player Stats</h3>
            </div>
            <div class="p-3 space-y-2">
              <div class="flex items-center gap-3">
                <div class="w-3 h-3 rounded-sm bg-gradient-to-br from-gray-100 to-gray-300 shadow-sm border border-gray-300"></div>
                <span class="flex-1 text-sm font-medium text-foreground truncate">{{ game?.white_player || 'White' }}</span>
                <div class="flex gap-1">
                  <span class="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/20 text-sky-600" *ngIf="whiteStats.inaccuracies" title="Inaccuracies">{{ whiteStats.inaccuracies }}</span>
                  <span class="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-600" *ngIf="whiteStats.mistakes" title="Mistakes">{{ whiteStats.mistakes }}</span>
                  <span class="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-600" *ngIf="whiteStats.blunders" title="Blunders">{{ whiteStats.blunders }}</span>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-3 h-3 rounded-sm bg-gradient-to-br from-gray-700 to-gray-900 shadow-sm"></div>
                <span class="flex-1 text-sm font-medium text-foreground truncate">{{ game?.black_player || 'Black' }}</span>
                <div class="flex gap-1">
                  <span class="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/20 text-sky-600" *ngIf="blackStats.inaccuracies" title="Inaccuracies">{{ blackStats.inaccuracies }}</span>
                  <span class="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-600" *ngIf="blackStats.mistakes" title="Mistakes">{{ blackStats.mistakes }}</span>
                  <span class="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-600" *ngIf="blackStats.blunders" title="Blunders">{{ blackStats.blunders }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Phase Analysis -->
          <div class="rounded-xl border-2 border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden mb-3">
            <div class="px-4 py-2 bg-gradient-to-r from-muted/50 to-transparent border-b border-border/30">
              <h3 class="text-sm font-semibold text-foreground tracking-wide">Phase Analysis</h3>
            </div>
            <div class="p-3 space-y-1">
              <div class="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" (click)="goToPhase('opening')">
                <span class="text-sm text-foreground">Opening</span>
                <span class="text-sm font-semibold text-success">{{ phaseStats.opening.accuracy }}%</span>
              </div>
              <div class="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" (click)="goToPhase('middlegame')">
                <span class="text-sm text-foreground">Middlegame</span>
                <span class="text-sm font-semibold text-success">{{ phaseStats.middlegame.accuracy }}%</span>
              </div>
              <div class="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" (click)="goToPhase('endgame')">
                <span class="text-sm text-foreground">Endgame</span>
                <span class="text-sm font-semibold text-success">{{ phaseStats.endgame.accuracy }}%</span>
              </div>
            </div>
          </div>

          <!-- Move Quality Distribution -->
          <div class="rounded-xl border-2 border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
            <div class="px-4 py-2 bg-gradient-to-r from-muted/50 to-transparent border-b border-border/30">
              <h3 class="text-sm font-semibold text-foreground tracking-wide">Move Quality</h3>
            </div>
            <div class="p-3">
              <div class="grid grid-cols-[1fr_28px_28px] gap-1 text-xs">
                <div class="text-muted-foreground font-medium"></div>
                <div class="text-center text-muted-foreground font-medium">W</div>
                <div class="text-center text-muted-foreground font-medium">B</div>
                
                <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-700"></span><span class="text-foreground">Best</span></div>
                <div class="text-center text-foreground">{{ moveQuality.white.best }}</div>
                <div class="text-center text-foreground">{{ moveQuality.black.best }}</div>
                
                <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500"></span><span class="text-foreground">Excellent</span></div>
                <div class="text-center text-foreground">{{ moveQuality.white.excellent }}</div>
                <div class="text-center text-foreground">{{ moveQuality.black.excellent }}</div>
                
                <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500"></span><span class="text-foreground">Good</span></div>
                <div class="text-center text-foreground">{{ moveQuality.white.good }}</div>
                <div class="text-center text-foreground">{{ moveQuality.black.good }}</div>
                
                <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-sky-500"></span><span class="text-foreground">Inaccuracy</span></div>
                <div class="text-center text-foreground">{{ moveQuality.white.inaccuracy }}</div>
                <div class="text-center text-foreground">{{ moveQuality.black.inaccuracy }}</div>
                
                <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500"></span><span class="text-foreground">Mistake</span></div>
                <div class="text-center text-foreground">{{ moveQuality.white.mistake }}</div>
                <div class="text-center text-foreground">{{ moveQuality.black.mistake }}</div>
                
                <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500"></span><span class="text-foreground">Blunder</span></div>
                <div class="text-center text-foreground">{{ moveQuality.white.blunder }}</div>
                <div class="text-center text-foreground">{{ moveQuality.black.blunder }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Center: Chess Board with Eval Bar -->
        <div class="board-section">
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
          <!-- Tabs below board -->
          <div class="board-tabs">
            <div class="tabs-header">
              <button class="tab-btn" [class.active]="activeTab === 'analysis'" (click)="activeTab = 'analysis'">Computer analysis</button>
              <button class="tab-btn" [class.active]="activeTab === 'share'" (click)="activeTab = 'share'">Share & export</button>
            </div>
            <div class="tabs-content">
              <div *ngIf="activeTab === 'analysis'" class="tab-panel">
                <div class="eval-graph-container" *ngIf="moves.length > 0">
                  <svg class="eval-graph" [attr.viewBox]="'0 0 ' + graphWidth + ' ' + graphHeight">
                    <rect x="0" y="0" [attr.width]="graphWidth" [attr.height]="graphHeight/2" fill="#fff"/>
                    <rect x="0" [attr.y]="graphHeight/2" [attr.width]="graphWidth" [attr.height]="graphHeight/2" fill="#888"/>
                    <line x1="0" [attr.y1]="graphHeight/2" [attr.x1]="graphWidth" [attr.y2]="graphHeight/2" stroke="#666" stroke-width="1"/>
                    <path [attr.d]="getEvalPath()" fill="rgba(255,255,255,0.8)" stroke="#333" stroke-width="1.5"/>
                    <ng-container *ngFor="let move of moves; let i = index">
                      <circle *ngIf="move.is_blunder" [attr.cx]="getGraphX(i)" [attr.cy]="getGraphY(move.evaluation)" r="5" fill="#db3434" class="eval-dot" (click)="goToMove(i)"/>
                      <circle *ngIf="move.is_mistake && !move.is_blunder" [attr.cx]="getGraphX(i)" [attr.cy]="getGraphY(move.evaluation)" r="5" fill="#e69f00" class="eval-dot" (click)="goToMove(i)"/>
                      <circle *ngIf="move.is_inaccuracy && !move.is_mistake && !move.is_blunder" [attr.cx]="getGraphX(i)" [attr.cy]="getGraphY(move.evaluation)" r="4" fill="#56b4e9" class="eval-dot" (click)="goToMove(i)"/>
                    </ng-container>
                    <line *ngIf="currentMoveIndex >= 0" [attr.x1]="getGraphX(currentMoveIndex)" y1="0" [attr.x2]="getGraphX(currentMoveIndex)" [attr.y2]="graphHeight" stroke="#3893e8" stroke-width="2" opacity="0.7"/>
                  </svg>
                </div>
              </div>
              <div *ngIf="activeTab === 'share'" class="tab-panel">
                <div class="share-section">
                  <strong>FEN</strong>
                  <div class="share-row">
                    <input type="text" readonly [value]="currentFen" class="share-input" />
                    <button class="copy-btn" (click)="copyToClipboard(currentFen, 'fen')" title="Copy">{{ copiedField === 'fen' ? '✓' : '📋' }}</button>
                  </div>
                </div>
                <div class="share-section">
                  <strong>Share</strong>
                  <div class="share-row">
                    <input type="text" readonly [value]="getShareUrl()" class="share-input" />
                    <button class="copy-btn" (click)="copyToClipboard(getShareUrl(), 'url')" title="Copy">{{ copiedField === 'url' ? '✓' : '📋' }}</button>
                  </div>
                </div>
                <div class="share-section" *ngIf="moves.length">
                  <strong>PGN</strong>
                  <div class="share-row">
                    <input type="text" readonly [value]="getPgn()" class="share-input" />
                    <button class="copy-btn" (click)="copyToClipboard(getPgn(), 'pgn')" title="Copy">{{ copiedField === 'pgn' ? '✓' : '📋' }}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel: Move List with Controls at Bottom -->
        <div class="analysis-panel right-panel">
          <div class="opening-bar" *ngIf="game?.opening_name">{{ game.opening_name }}</div>
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
                  <span class="best-line" *ngIf="getBestLine(pair.white) as line">
                    <span class="line-move" [class.current]="isAltLineCurrent(pair.whiteIndex, i)" *ngFor="let m of line; let i = index" (click)="playBestLine(pair.whiteIndex, i, $event)">{{ formatLineMove(pair.moveNumber, i, true, m) }}</span>
                  </span>
                </div>
                <span class="move" *ngIf="pair.black" [class.current]="currentMoveIndex === pair.blackIndex" (click)="goToMove(pair.blackIndex)">
                  <span class="san">{{ pair.black?.move }}</span><span class="nag blunder" *ngIf="pair.black?.is_blunder" title="Blunder">??</span><span class="nag mistake" *ngIf="pair.black?.is_mistake && !pair.black?.is_blunder" title="Mistake">?</span><span class="nag inaccuracy" *ngIf="pair.black?.is_inaccuracy && !pair.black?.is_mistake && !pair.black?.is_blunder" title="Inaccuracy">?!</span>
                  <span class="eval">{{ formatInlineEval(pair.black?.evaluation) }}</span>
                </span>
                <div class="annotation" *ngIf="pair.black && (pair.black.is_blunder || pair.black.is_mistake || pair.black.is_inaccuracy)">
                  <span class="annotation-text">{{ getAnnotationLabel(pair.black) }} {{ pair.black.best_move }} was best.</span>
                  <span class="best-line" *ngIf="getBestLine(pair.black) as line">
                    <span class="line-move" [class.current]="isAltLineCurrent(pair.blackIndex, i)" *ngFor="let m of line; let i = index" (click)="playBestLine(pair.blackIndex, i, $event)">{{ formatLineMove(pair.moveNumber, i, false, m) }}</span>
                  </span>
                </div>
              </ng-container>
              <span class="result" *ngIf="game?.result">{{ game.result }}</span>
            </div>
          </div>
          <div class="board-controls">
            <button class="ctrl-btn hover:bg-accent hover:text-accent-foreground" (click)="goToStart()" title="Start"><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" transform="rotate(180 12 12)"/></svg></button>
            <button class="ctrl-btn hover:bg-accent hover:text-accent-foreground" (click)="goToPrevious()" title="Previous"><svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>
            <button class="ctrl-btn hover:bg-accent hover:text-accent-foreground" (click)="flipBoard()" title="Flip"><svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg></button>
            <button class="ctrl-btn hover:bg-accent hover:text-accent-foreground" (click)="goToNext()" title="Next"><svg viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg></button>
            <button class="ctrl-btn hover:bg-accent hover:text-accent-foreground" (click)="goToEnd()" title="End"><svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
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
      --board-size: min(620px, calc(100vh - 100px));
    }

    .lichess-layout {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      gap: 0;
      padding: 8px 16px;
      min-height: calc(100vh - 64px);
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
    .right-panel { border-left: 1px solid #bbb; margin-left: 8px; height: var(--board-size); display: flex; flex-direction: column; }

    /* Board Section */
    .board-section {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* Board Tabs */
    .board-tabs {
      width: 100%;
      max-width: var(--board-size);
      margin-top: 8px;
    }
    .tabs-header {
      display: flex;
      border-bottom: 1px solid #ccc;
    }
    .tab-btn {
      padding: 8px 16px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      color: #666;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    .tab-btn:hover { color: #333; }
    .tab-btn.active {
      color: #333;
      border-bottom-color: #333;
      font-weight: 500;
    }
    .tabs-content {
      padding: 12px 0;
    }
    .tab-panel { font-size: 13px; }
    .eval-graph-container {
      width: 100%;
      border-radius: 4px;
      overflow: hidden;
      cursor: pointer;
    }
    .eval-graph {
      width: 100%;
      display: block;
    }
    .eval-dot {
      cursor: pointer;
      transition: r 0.15s;
    }
    .eval-dot:hover {
      r: 6;
    }
    .analysis-summary {
      display: flex;
      gap: 24px;
    }
    .player-analysis {
      flex: 1;
      padding: 8px 12px;
      background: rgba(0,0,0,0.03);
      border-radius: 6px;
    }
    .player-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .player-icon {
      width: 14px;
      height: 14px;
      border-radius: 2px;
    }
    .white-icon { background: #fff; border: 1px solid #ccc; }
    .black-icon { background: #333; }
    .player-analysis .player-name { font-weight: 600; }
    .stats-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .stats-row .stat { color: #555; }
    .stats-row .stat strong { margin-right: 2px; }
    .acpl { margin-top: 6px; color: #555; }
    .acpl strong { margin-right: 4px; }
    .share-section { margin-bottom: 12px; }
    .share-section strong { display: block; margin-bottom: 4px; color: #333; }
    .share-row {
      display: flex;
      gap: 4px;
    }
    .share-input {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 12px;
      background: #fff;
    }
    .copy-btn {
      padding: 6px 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;
    }
    .copy-btn:hover { background: #f0f0f0; }
    .copy-btn.full-width { width: 100%; margin-top: 6px; }
    .pgn-textarea {
      width: 100%;
      height: 80px;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      resize: vertical;
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
      background: #888;
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
      padding: 4px;
      background: #c4c4c4;
      border-top: 1px solid #bbb;
      flex-shrink: 0;
    }

    .ctrl-btn {
      flex: 1;
      height: 32px;
      background: #d1d1d1;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ctrl-btn:hover { background: hsl(var(--accent)); }
    .ctrl-btn svg { width: 20px; height: 20px; fill: #333; }

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
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .annotation-text {
      color: #555;
      font-style: italic;
    }

    .best-line {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }

    .line-move {
      color: #3893e8;
      cursor: pointer;
      padding: 1px 3px;
      border-radius: 2px;
    }

    .line-move:hover {
      background: rgba(56, 147, 232, 0.15);
    }

    .line-move.current {
      background: #3893e8;
      color: #fff;
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

    /* Left Panel - Tailwind handles most styling */
    .left-panel {
      display: flex;
      flex-direction: column;
      padding: 8px;
      background: transparent;
      border: none;
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

    @media (max-width: 900px) {
      :host { --board-size: calc(100vw - 16px); }
      .lichess-layout { display: flex; flex-direction: column; align-items: center; padding: 8px; }
      .lichess-layout > * { order: 0; }
      .analysis-panel { width: calc(100vw - 16px); max-width: none; height: auto; margin: 0; border: none; }
      .board-section { order: -2 !important; width: 100%; }
      .board-with-eval { width: calc(100vw - 16px); margin: 0 auto; }
      .eval-bar-vertical { display: none; }
      .right-panel { order: -1 !important; border-top: 1px solid #bbb; height: auto; max-height: 300px; }
      .left-panel { order: 0 !important; border-top: 1px solid #bbb; max-height: 250px; }
    }
  `]
})
export class GameDetailV2Component implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chessboard', { static: false }) chessboardElement!: ElementRef;
  @ViewChild('movesContainer', { static: false }) movesContainer!: ElementRef;

  gameId: string = '';
  tournamentId: number | null = null;
  tournamentName: string = '';
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

  phaseStats = {
    opening: { accuracy: 0, startMove: 0, endMove: 10 },
    middlegame: { accuracy: 0, startMove: 11, endMove: 30 },
    endgame: { accuracy: 0, startMove: 31, endMove: 999 }
  };

  moveQuality = {
    white: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    black: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
  };

  // Alternative line navigation state
  altLineActive = false;
  altLineMoveIndex = -1; // The main move index where the alternative starts
  altLinePosition = 0;   // Current position within the alternative line
  altLine: string[] = [];
  altLineIsWhite = true;
  altLineMoveNumber = 1;

  // Tab state
  activeTab: 'analysis' | 'share' = 'analysis';
  currentFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  copiedField: string | null = null;

  // Graph dimensions
  graphWidth = 600;
  graphHeight = 60;

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
    if (this.altLineActive) {
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          this.altLineNext();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          this.altLinePrev();
          break;
        case 'Escape':
          event.preventDefault();
          this.exitAltLine();
          break;
      }
      return;
    }
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

  @HostListener('document:click', ['$event'])
  handleClick(event: MouseEvent) {
    if (this.altLineActive) {
      const target = event.target as HTMLElement;
      if (!target.closest('.line-move') && !target.closest('.best-line')) {
        this.exitAltLine();
      }
    }
  }

  private loadGameData() {
    this.chessApiService.getGameAnalysis(+this.gameId).subscribe({
      next: (data) => {
        this.game = data.game;
        this.moves = data.analysis || [];
        this.tournamentId = data.game?.tournament_id || null;
        this.tournamentName = data.game?.event || '';
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
    this.moveQuality = {
      white: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
      black: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
    };

    const phaseCpl = { opening: { total: 0, count: 0 }, middlegame: { total: 0, count: 0 }, endgame: { total: 0, count: 0 } };

    this.moves.forEach((move, index) => {
      const isWhite = index % 2 === 0;
      const stats = isWhite ? this.whiteStats : this.blackStats;
      const quality = isWhite ? this.moveQuality.white : this.moveQuality.black;
      const moveNum = Math.floor(index / 2) + 1;

      if (move.is_blunder) { stats.blunders++; quality.blunder++; }
      else if (move.is_mistake) { stats.mistakes++; quality.mistake++; }
      else if (move.is_inaccuracy) { stats.inaccuracies++; quality.inaccuracy++; }
      else if (move.centipawn_loss <= 5) quality.best++;
      else if (move.centipawn_loss <= 15) quality.excellent++;
      else quality.good++;

      if (move.centipawn_loss !== undefined) {
        if (isWhite) { whiteCpl += move.centipawn_loss; whiteCount++; }
        else { blackCpl += move.centipawn_loss; blackCount++; }

        const phase = moveNum <= 10 ? 'opening' : moveNum <= 30 ? 'middlegame' : 'endgame';
        phaseCpl[phase].total += move.centipawn_loss;
        phaseCpl[phase].count++;
      }
    });

    this.whiteStats.avgCentipawnLoss = whiteCount > 0 ? Math.round(whiteCpl / whiteCount) : 0;
    this.blackStats.avgCentipawnLoss = blackCount > 0 ? Math.round(blackCpl / blackCount) : 0;
    this.whiteStats.accuracy = this.calculateAccuracy(this.whiteStats.avgCentipawnLoss);
    this.blackStats.accuracy = this.calculateAccuracy(this.blackStats.avgCentipawnLoss);

    for (const phase of ['opening', 'middlegame', 'endgame'] as const) {
      const avg = phaseCpl[phase].count > 0 ? phaseCpl[phase].total / phaseCpl[phase].count : 0;
      this.phaseStats[phase].accuracy = this.calculateAccuracy(avg);
    }
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

  getBestLine(move: MoveAnalysis): string[] | null {
    if (!move.alternatives || move.alternatives.length === 0) return null;
    const best = move.alternatives[0];
    return best.line && best.line.length > 0 ? best.line : null;
  }

  formatLineMove(moveNumber: number, lineIndex: number, isWhite: boolean, san: string): string {
    // First move in line: show move number with dots
    // isWhite means the bad move was white's, so best line starts with white's alternative
    if (lineIndex === 0) {
      return isWhite ? `${moveNumber}.${san}` : `${moveNumber}...${san}`;
    }
    // Subsequent moves: show number only at start of white's move
    const adjustedIndex = isWhite ? lineIndex : lineIndex + 1;
    const isWhiteMove = adjustedIndex % 2 === 0;
    if (isWhiteMove) {
      const num = moveNumber + Math.floor((adjustedIndex + 1) / 2);
      return `${num}.${san}`;
    }
    return san;
  }

  playBestLine(moveIndex: number, lineIndex: number, event: MouseEvent): void {
    event.stopPropagation();
    const move = this.moves[moveIndex];
    const line = this.getBestLine(move);
    if (!line) return;

    this.altLineActive = true;
    this.altLineMoveIndex = moveIndex;
    this.altLine = line;
    this.altLinePosition = lineIndex;
    this.altLineIsWhite = moveIndex % 2 === 0;
    this.altLineMoveNumber = Math.floor(moveIndex / 2) + 1;

    this.showAltLinePosition();
  }

  private showAltLinePosition(): void {
    // Reset to position before the bad move
    this.chess.reset();
    for (let i = 0; i < this.altLineMoveIndex; i++) {
      if (this.moves[i]) {
        try { this.chess.move(this.moves[i].move); } catch (e) { }
      }
    }
    // Play the alternative line up to current position
    for (let i = 0; i <= this.altLinePosition; i++) {
      try { this.chess.move(this.altLine[i]); } catch (e) { }
    }
    this.updateBoardPosition();
  }

  altLineNext(): void {
    if (this.altLinePosition < this.altLine.length - 1) {
      this.altLinePosition++;
      this.showAltLinePosition();
    } else {
      this.exitAltLine();
    }
  }

  altLinePrev(): void {
    if (this.altLinePosition > 0) {
      this.altLinePosition--;
      this.showAltLinePosition();
    } else {
      this.exitAltLine();
    }
  }

  exitAltLine(): void {
    this.altLineActive = false;
    this.altLine = [];
    this.altLinePosition = 0;
    // Restore main line position
    this.updateChessboard();
  }

  isAltLineCurrent(moveIndex: number, lineIndex: number): boolean {
    return this.altLineActive && this.altLineMoveIndex === moveIndex && this.altLinePosition === lineIndex;
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
    if (this.tournamentId) {
      this.router.navigate(['/tournaments', this.tournamentId]);
    } else {
      this.router.navigate(['/games']);
    }
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  getShareUrl(): string {
    return window.location.href;
  }

  copyToClipboard(text: string, field: string = '') {
    navigator.clipboard.writeText(text);
    this.copiedField = field;
    setTimeout(() => this.copiedField = null, 2000);
  }

  getPgn(): string {
    if (!this.game || !this.moves.length) return '';
    const headers = [
      `[Event "${this.game.event || '?'}"]`,
      `[Date "${this.game.date_played || '?'}"]`,
      `[White "${this.game.white_player}"]`,
      `[Black "${this.game.black_player}"]`,
      `[Result "${this.game.result}"]`,
      this.game.white_elo ? `[WhiteElo "${this.game.white_elo}"]` : '',
      this.game.black_elo ? `[BlackElo "${this.game.black_elo}"]` : '',
      this.game.opening_name ? `[Opening "${this.game.opening_name}"]` : '',
    ].filter(h => h).join('\n');
    const moveText = this.movePairs.map(p => 
      `${p.moveNumber}. ${p.white?.move || ''}${p.black ? ' ' + p.black.move : ''}`
    ).join(' ');
    return `${headers}\n\n${moveText} ${this.game.result}`;
  }

  goToPhase(phase: 'opening' | 'middlegame' | 'endgame') {
    const startMove = phase === 'opening' ? 0 : phase === 'middlegame' ? 20 : 60;
    const targetIndex = Math.min(startMove, this.moves.length - 1);
    if (targetIndex >= 0) this.goToMove(targetIndex);
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
    const fen = this.chess.fen();
    this.currentFen = fen;
    this.chessground.set({
      fen: fen,
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

  // Evaluation graph methods
  getGraphX(moveIndex: number): number {
    if (this.moves.length <= 1) return this.graphWidth / 2;
    return (moveIndex / (this.moves.length - 1)) * this.graphWidth;
  }

  getGraphY(evaluation: number): number {
    // Clamp eval to ±500cp for display, map to graph height
    const clampedEval = Math.max(-500, Math.min(500, evaluation));
    // Positive eval = top (white advantage), negative = bottom (black advantage)
    return (this.graphHeight / 2) - (clampedEval / 500) * (this.graphHeight / 2);
  }

  getEvalPath(): string {
    if (this.moves.length === 0) return '';
    const points: string[] = [];
    // Start at center-left
    points.push(`M 0 ${this.graphHeight / 2}`);
    // Line to first point
    points.push(`L ${this.getGraphX(0)} ${this.getGraphY(this.moves[0]?.evaluation || 0)}`);
    // Connect all points
    for (let i = 1; i < this.moves.length; i++) {
      points.push(`L ${this.getGraphX(i)} ${this.getGraphY(this.moves[i]?.evaluation || 0)}`);
    }
    // Close path back to baseline
    points.push(`L ${this.graphWidth} ${this.graphHeight / 2}`);
    points.push('Z');
    return points.join(' ');
  }
}
