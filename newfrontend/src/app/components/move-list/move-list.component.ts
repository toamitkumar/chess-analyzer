import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChildren, QueryList, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MoveVariant {
  move: string;
  evaluation: number;
  evaluationDiff: number;
  isEngineTop: boolean;
  explanation?: string;
}

export interface MoveAnnotation {
  evalChange: string;
  label: string;
  betterMove: string;
  alternatives?: string[];
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
              <span *ngIf="pair.white.moveQuality === 'good'" class="quality-badge good" title="Good move">○</span>
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
              <span *ngIf="pair.black.moveQuality === 'good'" class="quality-badge good" title="Good move">○</span>
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
              <span class="better-move">{{ pair.white.annotation.betterMove }}.</span>
            </div>
            <div class="alternatives-list" *ngIf="pair.white.annotation.alternatives && pair.white.annotation.alternatives.length > 0">
              <span *ngFor="let alt of pair.white.annotation.alternatives; let i = index">
                <span *ngIf="i > 0"> </span>
                <span class="alternative-item" (click)="selectAlternative(alt, pair.whiteIndex)">
                  {{ pair.moveNumber }}. {{ alt }}
                </span>
              </span>
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
              <span class="better-move">{{ pair.black.annotation.betterMove }}.</span>
            </div>
            <div class="alternatives-list" *ngIf="pair.black.annotation.alternatives && pair.black.annotation.alternatives.length > 0">
              <span *ngFor="let alt of pair.black.annotation.alternatives; let i = index">
                <span *ngIf="i > 0"> </span>
                <span class="alternative-item" (click)="selectAlternative(alt, pair.blackIndex!)">
                  {{ pair.moveNumber }}... {{ alt }}
                </span>
              </span>
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

    .alternatives-list {
      @apply text-gray-500;
    }

    .alternative-item {
      @apply hover:text-gray-900 hover:underline cursor-pointer transition-colors;
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
}
