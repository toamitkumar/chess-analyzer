import { Component, AfterViewInit, ViewChild, ElementRef, OnDestroy, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChessApiService } from '../../services/chess-api.service';
import { Chess } from 'chess.js';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';

interface ManualPGNForm {
  tournamentName: string;
  date: string;
  opponent: string;
  opponentElo: number | null;
  playerElo: number | null;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  variant: 'Rapid' | 'Classic' | 'Blitz';
  termination: 'mate' | 'resigned' | 'time-over' | 'draw-agreement';
  playerColor: 'white' | 'black';
  moves: string;
}

@Component({
  selector: 'app-manual-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    @import '@lichess-org/chessground/assets/chessground.base.css';
    @import '@lichess-org/chessground/assets/chessground.brown.css';
    @import '@lichess-org/chessground/assets/chessground.cburnett.css';

    :host { --board-size: min(520px, calc(100vw - 400px)); }

    .lichess-analysis-layout { display: flex; gap: 24px; padding: 16px; justify-content: center; align-items: flex-start; }
    .board-column { display: flex; flex-direction: column; gap: 8px; width: var(--board-size); }
    .board-container { width: var(--board-size); height: var(--board-size); border-radius: 12px; overflow: hidden; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15); }
    .chessboard { width: 100%; height: 100%; }

    .board-controls { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px; background: hsl(var(--card)); border-radius: 12px; border: 2px solid hsl(var(--border) / 0.3); }
    .nav-btn, .action-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); border-radius: 4px; cursor: pointer; color: hsl(var(--foreground)); }
    .nav-btn:hover:not(:disabled), .action-btn:hover:not(:disabled) { background: hsl(var(--accent)); }
    .nav-btn:disabled, .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .move-counter { min-width: 50px; text-align: center; font-size: 13px; font-weight: 500; color: hsl(var(--foreground)); }
    .board-actions { display: flex; gap: 4px; margin-left: 12px; padding-left: 12px; border-left: 1px solid hsl(var(--border)); }

    .fen-section, .pgn-section { display: flex; flex-direction: column; gap: 4px; }
    .fen-section label, .pgn-section label { font-size: 12px; font-weight: 500; color: hsl(var(--muted-foreground)); text-transform: uppercase; }
    .pgn-header { display: flex; justify-content: space-between; align-items: center; }
    .verify-btn { padding: 4px 10px; font-size: 11px; font-weight: 500; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); color: hsl(var(--foreground)); border-radius: 4px; cursor: pointer; }
    .verify-btn:hover:not(:disabled) { background: hsl(var(--accent)); }
    .verify-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .fen-input, .pgn-input { width: 100%; padding: 8px; font-size: 12px; font-family: monospace; border: 1px solid hsl(var(--border)); border-radius: 4px; background: hsl(var(--background)); color: hsl(var(--foreground)); }
    .pgn-input { resize: vertical; min-height: 80px; }
    .pgn-input.error { border-color: #ef4444; }
    .validation-error { font-size: 12px; color: #ef4444; }
    .validation-success { font-size: 12px; color: #22c55e; }

    .form-column { width: 320px; }
    .form-panel { background: hsl(var(--card) / 0.5); border: 2px solid hsl(var(--border) / 0.3); border-radius: 12px; padding: 16px; backdrop-filter: blur(8px); }
    .panel-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: hsl(var(--foreground)); }
    .game-form { display: flex; flex-direction: column; gap: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group label { font-size: 12px; font-weight: 500; color: hsl(var(--muted-foreground)); }
    .form-group input, .form-group select { height: 36px; padding: 0 10px; font-size: 13px; border: 1px solid hsl(var(--border)); border-radius: 4px; background: hsl(var(--background)); color: hsl(var(--foreground)); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .radio-group { display: flex; gap: 16px; }
    .radio-label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; color: hsl(var(--foreground)); }

    .form-actions { display: flex; gap: 8px; margin-top: 8px; }
    .btn-secondary, .btn-primary { flex: 1; height: 40px; font-size: 13px; font-weight: 500; border-radius: 6px; cursor: pointer; }
    .btn-secondary { background: hsl(var(--background)); border: 1px solid hsl(var(--border)); color: hsl(var(--foreground)); }
    .btn-secondary:hover:not(:disabled) { background: hsl(var(--accent)); }
    .btn-primary { background: hsl(var(--primary)); border: none; color: hsl(var(--primary-foreground)); display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-primary:hover:not(:disabled) { opacity: 0.9; }
    .btn-secondary:disabled, .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .spinner { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .status-success { padding: 12px; font-size: 13px; color: #22c55e; background: #22c55e20; border-radius: 4px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .status-error { padding: 8px; font-size: 13px; color: #ef4444; background: #ef444420; border-radius: 4px; text-align: center; }

    @media (max-width: 900px) {
      :host { --board-size: calc(100vw - 32px); }
      .lichess-analysis-layout { flex-direction: column; align-items: center; padding: 8px; }
      .board-column { width: 100%; max-width: var(--board-size); }
      .board-container { width: 100%; height: auto; aspect-ratio: 1; }
      .form-column { width: 100%; max-width: var(--board-size); }
    }
  `],
  templateUrl: './manual-entry.component.html'
})
export class ManualEntryComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chessboard') chessboardEl!: ElementRef;
  @Input() isActive = false;

  private chessboard: Api | null = null;
  private chessGame: Chess = new Chess();
  moveHistory: string[] = [];
  currentMoveIndex = -1;

  manualPGN: ManualPGNForm = {
    tournamentName: '', date: new Date().toISOString().split('T')[0], opponent: '',
    opponentElo: null, playerElo: null, result: '1-0', variant: 'Rapid',
    termination: 'mate', playerColor: 'white', moves: ''
  };
  movesValidationError: string | null = null;
  manualSubmitStatus: 'idle' | 'uploading' | 'success' | 'error' = 'idle';
  manualSubmitError = '';

  constructor(private chessApi: ChessApiService) {}

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    if ((event.target as HTMLElement).tagName === 'INPUT' || (event.target as HTMLElement).tagName === 'TEXTAREA') return;
    switch (event.key) {
      case 'ArrowLeft': event.preventDefault(); this.goToPreviousMove(); break;
      case 'ArrowRight': event.preventDefault(); this.goToNextMove(); break;
      case 'Home': event.preventDefault(); this.goToFirstMove(); break;
      case 'End': event.preventDefault(); this.goToLastMove(); break;
    }
  }

  ngAfterViewInit() { if (this.isActive) setTimeout(() => this.initializeChessboard(), 0); }
  ngOnDestroy() { if (this.chessboard) this.chessboard.destroy(); }

  initializeChessboard() {
    if (!this.chessboardEl || this.chessboard) return;
    this.chessboard = Chessground(this.chessboardEl.nativeElement, {
      movable: { free: false, color: 'both', dests: this.getLegalMoves(), events: { after: (orig: Key, dest: Key) => this.onBoardMove(orig, dest) } },
      draggable: { enabled: true, showGhost: true },
      highlight: { lastMove: true, check: true },
      selectable: { enabled: true }
    });
  }

  private getLegalMoves(): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    for (const move of this.chessGame.moves({ verbose: true })) {
      const from = move.from as Key;
      if (!dests.has(from)) dests.set(from, []);
      dests.get(from)!.push(move.to as Key);
    }
    return dests;
  }

  private getCheckmateHighlight() {
    if (!this.chessGame.isCheckmate()) return [];
    const board = this.chessGame.board();
    const turn = this.chessGame.turn();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = board[row][col];
        if (square?.type === 'k' && square.color === turn) {
          return [{ orig: (String.fromCharCode(97 + col) + String(8 - row)) as Key, brush: 'red' }];
        }
      }
    }
    return [];
  }

  private onBoardMove(from: Key, to: Key) {
    try {
      const move = this.chessGame.move({ from, to, promotion: 'q' }, { strict: false });
      if (move) {
        this.chessboard?.set({ fen: this.chessGame.fen(), movable: { dests: this.getLegalMoves() }, drawable: { shapes: this.getCheckmateHighlight() } });
        this.updateMovesFromGame();
      } else {
        this.chessboard?.set({ fen: this.chessGame.fen() });
      }
    } catch { this.chessboard?.set({ fen: this.chessGame.fen() }); }
  }

  private updateMovesFromGame() {
    const history = this.chessGame.history();
    this.moveHistory = [...history];
    this.currentMoveIndex = this.moveHistory.length - 1;
    this.manualPGN.moves = history.join(' ');
    this.validateMoves();
  }

  resetBoard() {
    this.chessGame.reset();
    this.moveHistory = [];
    this.currentMoveIndex = -1;
    this.chessboard?.set({ fen: this.chessGame.fen(), movable: { dests: this.getLegalMoves() }, drawable: { shapes: [] } });
    this.manualPGN.moves = '';
    this.movesValidationError = null;
  }

  undoMove() {
    if (this.chessGame.undo()) {
      this.chessboard?.set({ fen: this.chessGame.fen(), movable: { dests: this.getLegalMoves() }, drawable: { shapes: this.getCheckmateHighlight() } });
      this.updateMovesFromGame();
    }
  }

  verifyMoves() {
    this.validateMoves();
    if (!this.movesValidationError) alert('✓ All moves are valid and ready to submit!');
  }

  onPgnPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    if (!pastedText.trim()) return;

    try {
      const movesText = pastedText.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\d+\.\s*/g, ' ').replace(/1-0|0-1|1\/2-1\/2|\*/g, '').replace(/\s+/g, ' ').trim();
      const moves = movesText.split(' ').filter(m => m.length > 0);
      if (moves.length === 0) { alert('No valid moves found'); return; }

      const chess = new Chess();
      const validMoves: string[] = [];
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i].trim();
        if (!move) continue;
        try {
          const result = chess.move(move, { strict: false });
          if (result) validMoves.push(result.san);
          else { alert(`Invalid move "${move}" at position ${i + 1}`); break; }
        } catch { alert(`Error parsing move "${move}" at position ${i + 1}`); break; }
      }

      if (validMoves.length > 0) {
        this.chessGame.reset();
        this.moveHistory = [];
        for (const move of validMoves) { this.chessGame.move(move, { strict: false }); this.moveHistory.push(move); }
        this.currentMoveIndex = this.moveHistory.length - 1;
        this.chessboard?.set({ fen: this.chessGame.fen(), movable: { dests: this.getLegalMoves() }, drawable: { shapes: this.getCheckmateHighlight() } });
        this.manualPGN.moves = validMoves.join(' ');
        this.validateMoves();
      }
    } catch (error: any) { alert(`Error pasting PGN: ${error.message}`); }
  }

  goToFirstMove() {
    if (this.moveHistory.length === 0) return;
    this.currentMoveIndex = -1;
    this.chessGame.reset();
    this.chessboard?.set({ fen: this.chessGame.fen(), movable: { dests: new Map() }, drawable: { shapes: [] } });
  }

  goToPreviousMove() {
    if (this.currentMoveIndex < 0) return;
    this.currentMoveIndex--;
    this.chessGame.reset();
    for (let i = 0; i <= this.currentMoveIndex; i++) this.chessGame.move(this.moveHistory[i], { strict: false });
    this.chessboard?.set({ fen: this.chessGame.fen(), movable: { dests: new Map() }, drawable: { shapes: this.getCheckmateHighlight() } });
  }

  goToNextMove() {
    if (this.currentMoveIndex >= this.moveHistory.length - 1) return;
    this.currentMoveIndex++;
    this.chessGame.move(this.moveHistory[this.currentMoveIndex], { strict: false });
    const isAtLast = this.currentMoveIndex === this.moveHistory.length - 1;
    this.chessboard?.set({ fen: this.chessGame.fen(), movable: { dests: isAtLast ? this.getLegalMoves() : new Map() }, drawable: { shapes: this.getCheckmateHighlight() } });
  }

  goToLastMove() {
    if (this.moveHistory.length === 0) return;
    this.currentMoveIndex = this.moveHistory.length - 1;
    this.chessGame.reset();
    for (const move of this.moveHistory) this.chessGame.move(move, { strict: false });
    this.chessboard?.set({ fen: this.chessGame.fen(), movable: { dests: this.getLegalMoves() }, drawable: { shapes: this.getCheckmateHighlight() } });
  }

  getCurrentMoveDisplay(): string {
    if (this.moveHistory.length === 0) return '0/0';
    return `${this.currentMoveIndex === -1 ? 0 : this.currentMoveIndex + 1}/${this.moveHistory.length}`;
  }

  getCurrentFen(): string {
    return this.chessGame.fen();
  }

  onPgnInput() {
    this.syncBoardFromPgn();
  }

  private syncBoardFromPgn() {
    const text = this.manualPGN.moves.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\d+\.\s*/g, ' ').replace(/1-0|0-1|1\/2-1\/2|\*/g, '').replace(/\s+/g, ' ').trim();
    const moves = text.split(' ').filter(m => m.length > 0);
    const chess = new Chess();
    const validMoves: string[] = [];
    for (const move of moves) {
      try { if (chess.move(move, { strict: false })) validMoves.push(chess.history().slice(-1)[0]); else break; }
      catch { break; }
    }
    this.chessGame.reset();
    this.moveHistory = [];
    for (const m of validMoves) { this.chessGame.move(m, { strict: false }); this.moveHistory.push(m); }
    this.currentMoveIndex = this.moveHistory.length - 1;
    this.chessboard?.set({ fen: this.chessGame.fen(), movable: { dests: this.getLegalMoves() }, drawable: { shapes: this.getCheckmateHighlight() } });
    this.validateMoves();
  }

  validateMoves() {
    if (!this.manualPGN.moves.trim()) { this.movesValidationError = null; return; }
    try {
      const movesText = this.manualPGN.moves.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\d+\.\s*/g, ' ').replace(/1-0|0-1|1\/2-1\/2|\*/g, '').replace(/\s+/g, ' ').trim();
      const moves = movesText.split(' ').filter(m => m.length > 0);
      if (moves.length === 0) { this.movesValidationError = 'Please enter at least one move'; return; }

      const chess = new Chess();
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i].trim();
        if (!move) continue;
        try {
          const result = chess.move(move, { strict: false });
          if (!result) { this.movesValidationError = `Illegal move "${move}" at position ${i + 1}`; return; }
        } catch (error: any) { this.movesValidationError = `Invalid move "${move}" at position ${i + 1}: ${error.message || 'Invalid notation'}`; return; }
      }
      this.movesValidationError = null;
    } catch (error: any) { this.movesValidationError = `Error validating moves: ${error.message || 'Unknown error'}`; }
  }

  async handleManualSubmit() {
    this.validateMoves();
    if (this.movesValidationError || !this.manualPGN.moves.trim()) {
      if (!this.movesValidationError) this.movesValidationError = 'Please enter at least one move';
      return;
    }

    this.manualSubmitStatus = 'uploading';
    this.manualSubmitError = '';

    try {
      await this.chessApi.submitManualPGN(this.manualPGN).toPromise();
      this.manualSubmitStatus = 'success';
      setTimeout(() => {
        this.manualPGN = { tournamentName: '', date: new Date().toISOString().split('T')[0], opponent: '', opponentElo: null, playerElo: null, result: '1-0', variant: 'Rapid', termination: 'mate', playerColor: 'white', moves: '' };
        this.manualSubmitStatus = 'idle';
        this.movesValidationError = null;
        this.resetBoard();
      }, 3000);
    } catch (error: any) {
      this.manualSubmitStatus = 'error';
      this.manualSubmitError = error.error?.error || error.message || 'Failed to submit game';
    }
  }
}
