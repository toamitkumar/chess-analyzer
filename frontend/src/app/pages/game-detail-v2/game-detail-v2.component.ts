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
import { MoveAnalysis, GameData, MovePair, PlayerStats, PhaseStats, MoveQualityStats } from './game-detail.models';
import { EvalGraphComponent, BoardControlsComponent, ShareExportComponent, PlayerStatsCardComponent, PhaseAnalysisComponent, MoveQualityComponent } from './components';

@Component({
  selector: 'app-game-detail-v2',
  standalone: true,
  imports: [CommonModule, HttpClientModule, LayoutComponent, EvalGraphComponent, BoardControlsComponent, ShareExportComponent, PlayerStatsCardComponent, PhaseAnalysisComponent, MoveQualityComponent],
  templateUrl: './game-detail-v2.component.html',
  styleUrls: ['./game-detail-v2.component.scss']
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

  phaseStats: { opening: PhaseStats; middlegame: PhaseStats; endgame: PhaseStats } = {
    opening: { accuracy: 0, startMove: 0, endMove: 10 },
    middlegame: { accuracy: 0, startMove: 11, endMove: 30 },
    endgame: { accuracy: 0, startMove: 31, endMove: 999 }
  };

  moveQuality: { white: MoveQualityStats; black: MoveQualityStats } = {
    white: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    black: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
  };

  // Alternative line navigation state
  altLineActive = false;
  altLineMoveIndex = -1;
  altLinePosition = 0;
  altLine: string[] = [];
  altLineIsWhite = true;
  altLineMoveNumber = 1;

  // Tab state
  activeTab: 'analysis' | 'share' = 'analysis';
  currentFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // Graph dimensions (passed to EvalGraphComponent)
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
        case 'ArrowRight': event.preventDefault(); this.altLineNext(); break;
        case 'ArrowLeft': event.preventDefault(); this.altLinePrev(); break;
        case 'Escape': event.preventDefault(); this.exitAltLine(); break;
      }
      return;
    }
    switch (event.key) {
      case 'ArrowLeft': event.preventDefault(); this.goToPrevious(); break;
      case 'ArrowRight': event.preventDefault(); this.goToNext(); break;
      case 'Home': event.preventDefault(); this.goToStart(); break;
      case 'End': event.preventDefault(); this.goToEnd(); break;
      case 'f': event.preventDefault(); this.flipBoard(); break;
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
      error: (error) => console.error('Error loading game data:', error)
    });
  }

  private processMoves() {
    this.movePairs = [];
    for (let i = 0; i < this.moves.length; i += 2) {
      this.movePairs.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: this.moves[i] || null,
        black: this.moves[i + 1] || null,
        whiteIndex: i,
        blackIndex: i + 1
      });
    }
  }

  private calculateStats() {
    let whiteCpl = 0, whiteCount = 0, blackCpl = 0, blackCount = 0;
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
    return Math.round(Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * acpl) - 3.1669)));
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
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * this.currentEval)) - 1);
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
    if (lineIndex === 0) return isWhite ? `${moveNumber}.${san}` : `${moveNumber}...${san}`;
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
    this.chess.reset();
    for (let i = 0; i < this.altLineMoveIndex; i++) {
      if (this.moves[i]) try { this.chess.move(this.moves[i].move); } catch (e) { }
    }
    for (let i = 0; i <= this.altLinePosition; i++) {
      try { this.chess.move(this.altLine[i]); } catch (e) { }
    }
    this.updateBoardPosition();
  }

  altLineNext(): void {
    if (this.altLinePosition < this.altLine.length - 1) {
      this.altLinePosition++;
      this.showAltLinePosition();
    } else this.exitAltLine();
  }

  altLinePrev(): void {
    if (this.altLinePosition > 0) {
      this.altLinePosition--;
      this.showAltLinePosition();
    } else this.exitAltLine();
  }

  exitAltLine(): void {
    this.altLineActive = false;
    this.altLine = [];
    this.altLinePosition = 0;
    this.updateChessboard();
  }

  isAltLineCurrent(moveIndex: number, lineIndex: number): boolean {
    return this.altLineActive && this.altLineMoveIndex === moveIndex && this.altLinePosition === lineIndex;
  }

  goBack() {
    this.tournamentId ? this.router.navigate(['/tournaments', this.tournamentId]) : this.router.navigate(['/games']);
  }

  navigateTo(path: string) { this.router.navigate([path]); }

  getShareUrl(): string { return window.location.href; }

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
      } else if (this.currentMoveIndex === -1) container.scrollTop = 0;
    }, 50);
  }

  flipBoard() {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
    if (this.chessground) this.chessground.set({ orientation: this.orientation });
  }

  private updateChessboard() {
    this.chess.reset();
    for (let i = 0; i <= this.currentMoveIndex; i++) {
      if (this.moves[i]) try { this.chess.move(this.moves[i].move); } catch (e) { console.warn('Invalid move:', this.moves[i].move); }
    }
    this.updateBoardPosition();
  }

  private updateBoardPosition() {
    if (!this.chessground) return;
    const lastMove = this.getLastMoveSquares();
    this.currentFen = this.chess.fen();
    this.chessground.set({
      fen: this.currentFen,
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
          return ('abcdefgh'[file] + '87654321'[rank]) as Key;
        }
      }
    }
    return undefined;
  }

}
