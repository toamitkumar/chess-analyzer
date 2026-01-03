import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChildren, QueryList, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MoveVariant {
  move: string;
  evaluation: number;
  evaluationDiff: number;
  isEngineTop: boolean;
  explanation?: string;
}

export interface AlternativeMoveDetail {
  move: string;
  evaluation: number;
  depth: number;
  line: string[];
  rank?: number;
}

export interface MoveAnnotation {
  evalChange: string;
  label: string;
  betterMove: string;
  alternatives?: string[];
  alternativeDetails?: AlternativeMoveDetail[];
}

export interface EnhancedMove {
  moveNumber: number;
  move: string;
  evaluation: number;
  centipawnLoss: number;
  moveQuality: 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder';
  moveAccuracy?: number; // Per-move accuracy 0-100
  winProbabilityBefore?: number;
  winProbabilityAfter?: number;
  variants?: MoveVariant[];
  annotation?: MoveAnnotation;
  showVariants: boolean;
}

interface MovePair {
  moveNumber: number;
  white: EnhancedMove;
  black?: EnhancedMove;
  whiteIndex: number;
  blackIndex?: number;
}

@Component({
  selector: 'app-move-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="move-list-container">
      <div class="move-list">
        <div *ngFor="let pair of movePairs" class="move-pair-wrapper">
          <!-- Move Pair Row -->
          <div class="move-pair-row">
            <!-- Move Number -->
            <span class="move-number">{{ pair.moveNumber }}.</span>

            <!-- White's Move -->
            <span
              #moveCell
              [attr.data-move-index]="pair.whiteIndex"
              [class]="'move-cell ' + (pair.whiteIndex === currentMoveIndex ? 'active' : '') + ' ' + pair.white.moveQuality"
              (click)="selectMove(pair.whiteIndex)">
              {{ pair.white.move }}
              <span *ngIf="pair.white.moveQuality === 'best'" class="quality-badge best" title="Best move">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </span>
              <span *ngIf="pair.white.moveQuality === 'excellent'" class="quality-badge excellent" title="Excellent move">!</span>
              <span *ngIf="pair.white.moveQuality === 'good'" class="quality-badge good" title="Good move">👍</span>
              <span *ngIf="pair.white.moveQuality === 'inaccuracy'" class="quality-badge inaccuracy" title="Inaccuracy">?!</span>
              <span *ngIf="pair.white.moveQuality === 'mistake'" class="quality-badge mistake" title="Mistake">?</span>
              <span *ngIf="pair.white.moveQuality === 'blunder'" class="quality-badge blunder" title="Blunder">??</span>
            </span>

            <!-- Black's Move -->
            <span
              #moveCell
              *ngIf="pair.black"
              [attr.data-move-index]="pair.blackIndex"
              [class]="'move-cell ' + (pair.blackIndex === currentMoveIndex ? 'active' : '') + ' ' + pair.black.moveQuality"
              (click)="selectMove(pair.blackIndex!)">
              {{ pair.black.move }}
              <span *ngIf="pair.black.moveQuality === 'best'" class="quality-badge best" title="Best move">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </span>
              <span *ngIf="pair.black.moveQuality === 'excellent'" class="quality-badge excellent" title="Excellent move">!</span>
              <span *ngIf="pair.black.moveQuality === 'good'" class="quality-badge good" title="Good move">👍</span>
              <span *ngIf="pair.black.moveQuality === 'inaccuracy'" class="quality-badge inaccuracy" title="Inaccuracy">?!</span>
              <span *ngIf="pair.black.moveQuality === 'mistake'" class="quality-badge mistake" title="Mistake">?</span>
              <span *ngIf="pair.black.moveQuality === 'blunder'" class="quality-badge blunder" title="Blunder">??</span>
            </span>
          </div>

          <!-- White's Annotation -->
          <div class="annotation-wrapper" *ngIf="pair.white.annotation">
            <div class="annotation-content">
              <span [class]="'eval-change ' + pair.white.annotation.label.toLowerCase()">
                {{ pair.white.annotation.evalChange }}
              </span>
              <span [class]="'annotation-label ' + pair.white.annotation.label.toLowerCase()">
                {{ pair.white.annotation.label }}.
              </span>
              <span class="better-move">{{ pair.white.annotation.betterMove }}</span>

              <!-- Show alternatives toggle button -->
              <button
                *ngIf="pair.white.annotation.alternativeDetails && pair.white.annotation.alternativeDetails.length > 0"
                class="show-alternatives-btn"
                (click)="toggleAlternatives(pair.whiteIndex, $event)">
                <svg class="chevron-icon" [class.rotated]="isAlternativesExpanded(pair.whiteIndex)" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
                {{ isAlternativesExpanded(pair.whiteIndex) ? 'Hide' : 'Show' }} alternatives
              </button>
            </div>

            <!-- Expanded alternatives list -->
            <div class="alternatives-expanded" *ngIf="isAlternativesExpanded(pair.whiteIndex) && pair.white.annotation.alternativeDetails">
              <div
                *ngFor="let alt of pair.white.annotation.alternativeDetails; let i = index"
                class="alternative-row"
                (click)="selectAlternative(alt.move, pair.whiteIndex)">
                <div class="alt-rank">{{ i + 1 }}</div>
                <div class="alt-move-section">
                  <div class="alt-primary-move">{{ alt.move }}</div>
                  <div class="alt-continuation" *ngIf="alt.line && alt.line.length > 1">
                    {{ alt.line.slice(1, 4).join(' ') }}{{ alt.line.length > 4 ? '..' : '' }}
                  </div>
                </div>
                <div [class]="'alt-eval ' + getEvalClass(alt.evaluation)">
                  {{ formatEvaluation(alt.evaluation) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Black's Annotation -->
          <div class="annotation-wrapper" *ngIf="pair.black?.annotation">
            <div class="annotation-content">
              <span [class]="'eval-change ' + pair.black.annotation.label.toLowerCase()">
                {{ pair.black.annotation.evalChange }}
              </span>
              <span [class]="'annotation-label ' + pair.black.annotation.label.toLowerCase()">
                {{ pair.black.annotation.label }}.
              </span>
              <span class="better-move">{{ pair.black.annotation.betterMove }}</span>

              <!-- Show alternatives toggle button -->
              <button
                *ngIf="pair.black.annotation.alternativeDetails && pair.black.annotation.alternativeDetails.length > 0"
                class="show-alternatives-btn"
                (click)="toggleAlternatives(pair.blackIndex!, $event)">
                <svg class="chevron-icon" [class.rotated]="isAlternativesExpanded(pair.blackIndex!)" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
                {{ isAlternativesExpanded(pair.blackIndex!) ? 'Hide' : 'Show' }} alternatives
              </button>
            </div>

            <!-- Expanded alternatives list -->
            <div class="alternatives-expanded" *ngIf="isAlternativesExpanded(pair.blackIndex!) && pair.black.annotation.alternativeDetails">
              <div
                *ngFor="let alt of pair.black.annotation.alternativeDetails; let i = index"
                class="alternative-row"
                (click)="selectAlternative(alt.move, pair.blackIndex!)">
                <div class="alt-rank">{{ i + 1 }}</div>
                <div class="alt-move-section">
                  <div class="alt-primary-move">{{ alt.move }}</div>
                  <div class="alt-continuation" *ngIf="alt.line && alt.line.length > 1">
                    {{ alt.line.slice(1, 4).join(' ') }}{{ alt.line.length > 4 ? '...' : '' }}
                  </div>
                </div>
                <div [class]="'alt-eval ' + getEvalClass(alt.evaluation)">
                  {{ formatEvaluation(alt.evaluation) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .move-list-container {
      @apply h-full overflow-y-auto;
      scrollbar-width: thin;
    }

    .move-list {
      @apply px-4 sm:px-6 pb-4 space-y-0;
    }

    .move-pair-wrapper {
      @apply mb-1;
    }

    .move-pair-row {
      @apply flex items-baseline gap-2 py-1.5 text-sm;
    }

    .move-number {
      @apply text-gray-500 font-medium min-w-[2rem] text-right select-none;
    }

    .move-cell {
      @apply px-2 py-1 rounded cursor-pointer transition-all font-medium;
      @apply text-gray-900 hover:bg-gray-200;
    }

    .move-cell.active {
      @apply bg-blue-500 text-white hover:bg-blue-600;
    }

    /* Move quality background hints */
    .move-cell.best {
      @apply bg-green-50;
    }

    .move-cell.excellent {
      @apply bg-green-50;
    }

    .move-cell.good {
      @apply bg-blue-50;
    }

    .move-cell.inaccuracy {
      @apply bg-yellow-50;
    }

    .move-cell.mistake {
      @apply bg-orange-50;
    }

    .move-cell.blunder {
      @apply bg-red-50;
    }

    .move-cell.active.best,
    .move-cell.active.excellent,
    .move-cell.active.good,
    .move-cell.active.inaccuracy,
    .move-cell.active.mistake,
    .move-cell.active.blunder {
      @apply bg-blue-500;
    }

    .quality-badge {
      @apply ml-1 text-xs font-bold inline-flex items-center;
    }

    .quality-badge.best {
      @apply text-green-600;
    }

    .quality-badge.best svg {
      @apply w-3 h-3;
    }

    .quality-badge.excellent {
      @apply text-green-500;
    }

    .quality-badge.good {
      @apply text-blue-500;
    }

    .quality-badge.inaccuracy {
      @apply text-yellow-600;
    }

    .quality-badge.mistake {
      @apply text-orange-600;
    }

    .quality-badge.blunder {
      @apply text-red-600;
    }

    /* Active state colors for badges */
    .move-cell.active .quality-badge.best {
      @apply text-green-200;
    }

    .move-cell.active .quality-badge.excellent {
      @apply text-green-200;
    }

    .move-cell.active .quality-badge.good {
      @apply text-blue-200;
    }

    .move-cell.active .quality-badge.inaccuracy {
      @apply text-yellow-200;
    }

    .move-cell.active .quality-badge.mistake {
      @apply text-orange-200;
    }

    .move-cell.active .quality-badge.blunder {
      @apply text-red-200;
    }

    .annotation-wrapper {
      @apply ml-[2.5rem] mb-2 text-xs space-y-1;
    }

    .annotation-content {
      @apply text-gray-600;
    }

    .eval-change {
      @apply font-medium;
    }

    .eval-change.blunder,
    .annotation-label.blunder {
      @apply text-red-600;
    }

    .eval-change.mistake,
    .annotation-label.mistake {
      @apply text-orange-600;
    }

    .eval-change.inaccuracy,
    .annotation-label.inaccuracy {
      @apply text-yellow-600;
    }

    .better-move {
      @apply text-gray-700;
    }

    .show-alternatives-btn {
      @apply ml-2 text-xs text-blue-600 hover:text-blue-800 font-medium;
      @apply inline-flex items-center gap-1 transition-colors;
      @apply border-none bg-transparent cursor-pointer p-0;
    }

    .chevron-icon {
      @apply w-3 h-3 transition-transform duration-200;
    }

    .chevron-icon.rotated {
      @apply rotate-180;
    }

    .alternatives-expanded {
      @apply mt-2 space-y-1 bg-gray-50 rounded p-2 border border-gray-200;
    }

    .alternative-row {
      @apply flex items-center gap-2 p-2 rounded cursor-pointer;
      @apply hover:bg-white hover:shadow-sm transition-all;
      @apply border border-transparent hover:border-gray-200;
    }

    .alt-rank {
      @apply w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold;
      @apply flex items-center justify-center flex-shrink-0;
    }

    .alternative-row:first-child .alt-rank {
      @apply bg-green-100 text-green-700;
    }

    .alt-move-section {
      @apply flex-1 min-w-0;
    }

    .alt-primary-move {
      @apply font-mono text-xs font-semibold text-gray-900;
    }

    .alt-continuation {
      @apply text-xs font-mono text-gray-500 truncate;
    }

    .alt-eval {
      @apply font-mono text-xs font-bold flex-shrink-0;
    }

    .alt-eval.winning {
      @apply text-green-600;
    }

    .alt-eval.equal {
      @apply text-gray-600;
    }

    .alt-eval.losing {
      @apply text-red-600;
    }

    /* Scrollbar styling */
    .move-list-container::-webkit-scrollbar {
      width: 6px;
    }

    .move-list-container::-webkit-scrollbar-track {
      @apply bg-gray-100 rounded;
    }

    .move-list-container::-webkit-scrollbar-thumb {
      @apply bg-gray-300 rounded hover:bg-gray-400;
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .move-list {
        @apply px-3;
      }

      .move-number {
        @apply min-w-[1.5rem] text-xs;
      }

      .move-cell {
        @apply px-1.5 py-0.5 text-xs;
      }

      .annotation-wrapper {
        @apply ml-[2rem];
      }
    }
  `]
})
export class MoveListComponent implements OnChanges, AfterViewInit {
  @Input() moves: EnhancedMove[] = [];
  @Input() currentMoveIndex: number = -1;

  @Output() moveSelected = new EventEmitter<number>();
  @Output() alternativeSelected = new EventEmitter<{alternative: string, moveIndex: number}>();

  @ViewChildren('moveCell') moveCells!: QueryList<ElementRef>;

  movePairs: MovePair[] = [];
  private previousMoveIndex: number = -1;
  expandedAlternatives: Set<number> = new Set(); // Track which moves have expanded alternatives

  ngAfterViewInit() {
    setTimeout(() => this.scrollToCurrentMove(), 100);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['moves']) {
      this.updateMovePairs();
    }

    if (changes['currentMoveIndex'] && !changes['currentMoveIndex'].firstChange) {
      setTimeout(() => this.scrollToCurrentMove(), 50);
    }
  }

  scrollToCurrentMove() {
    if (this.currentMoveIndex === this.previousMoveIndex) {
      return;
    }

    this.previousMoveIndex = this.currentMoveIndex;

    if (this.currentMoveIndex < 0) {
      return;
    }

    const currentMoveElement = this.moveCells?.find(cell => {
      const index = cell.nativeElement.getAttribute('data-move-index');
      return index && parseInt(index, 10) === this.currentMoveIndex;
    });

    if (currentMoveElement) {
      currentMoveElement.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }

  updateMovePairs() {
    this.movePairs = [];
    for (let i = 0; i < this.moves.length; i += 2) {
      const white = this.moves[i];
      const black = i + 1 < this.moves.length ? this.moves[i + 1] : undefined;

      this.movePairs.push({
        moveNumber: white.moveNumber,
        white: white,
        black: black,
        whiteIndex: i,
        blackIndex: black ? i + 1 : undefined
      });
    }
  }

  selectMove(moveIndex: number): void {
    this.moveSelected.emit(moveIndex);
  }

  selectAlternative(alternative: string, moveIndex: number): void {
    this.alternativeSelected.emit({ alternative, moveIndex });
  }

  toggleAlternatives(moveIndex: number, event: Event): void {
    event.stopPropagation(); // Prevent triggering move selection
    if (this.expandedAlternatives.has(moveIndex)) {
      this.expandedAlternatives.delete(moveIndex);
    } else {
      this.expandedAlternatives.add(moveIndex);
    }
  }

  isAlternativesExpanded(moveIndex: number): boolean {
    return this.expandedAlternatives.has(moveIndex);
  }

  formatEvaluation(centipawns: number): string {
    if (Math.abs(centipawns) > 9000) {
      const mateIn = Math.ceil((10000 - Math.abs(centipawns)) / 10);
      return centipawns > 0 ? `+M${mateIn}` : `-M${mateIn}`;
    }

    const pawns = centipawns / 100;
    if (pawns === 0) return '0.00';
    return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
  }

  getEvalClass(centipawns: number): string {
    if (centipawns > 50) return 'winning';
    if (centipawns < -50) return 'losing';
    return 'equal';
  }
}
