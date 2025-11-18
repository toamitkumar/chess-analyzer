import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface AlternativeMove {
  move: string;
  evaluation: number;
  depth: number;
  line: string[];
  rank?: number;
  evaluationDiff?: number;
}

@Component({
  selector: 'app-alternative-moves-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="alternatives-panel">
      <div class="panel-header">
        <div class="header-left">
          <h4 class="panel-title">Engine Analysis</h4>
          <span class="move-info" *ngIf="currentMoveNumber > 0">
            Move {{ currentMoveNumber }}
          </span>
        </div>
        <div class="header-right">
          <span class="depth-badge">Depth {{ analysisDepth }}</span>
        </div>
      </div>

      <div class="alternatives-list" *ngIf="alternatives.length > 0">
        <div
          *ngFor="let alt of alternatives; let i = index"
          [class]="'alternative-row ' + (selectedIndex === i ? 'selected ' : '') + getEvalClass(alt.evaluation)"
          (click)="selectAlternative(alt, i)"
          (mouseenter)="previewAlternative(alt)"
          (mouseleave)="clearPreview()">

          <div class="rank-badge">{{ i + 1 }}</div>

          <div class="move-info-section">
            <div class="primary-move">{{ alt.move }}</div>
            <div class="continuation-line" *ngIf="alt.line && alt.line.length > 1">
              <span *ngFor="let m of alt.line.slice(1); let j = index" class="line-move">
                {{ m }}{{ j < alt.line.length - 2 ? ' ' : '' }}
              </span>
            </div>
          </div>

          <div class="evaluation-section">
            <div [class]="'eval-score ' + getEvalClass(alt.evaluation)">
              {{ formatEvaluation(alt.evaluation) }}
            </div>
            <div class="eval-bar-container">
              <div class="eval-bar" [style.width.%]="getEvalBarWidth(alt.evaluation)"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="no-alternatives" *ngIf="alternatives.length === 0 && !loading">
        <svg class="info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No alternatives available for this position</p>
        <span class="help-text">Select a move to see engine suggestions</span>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="spinner"></div>
        <span>Analyzing position...</span>
      </div>

      <div class="panel-footer" *ngIf="alternatives.length > 0">
        <div class="legend">
          <span class="legend-item winning">
            <span class="dot"></span> Winning
          </span>
          <span class="legend-item equal">
            <span class="dot"></span> Equal
          </span>
          <span class="legend-item losing">
            <span class="dot"></span> Losing
          </span>
        </div>
        <button class="analyze-btn" (click)="analyzeDeeper()" *ngIf="showAnalyzeDeeper">
          Analyze Deeper
        </button>
      </div>
    </div>
  `,
  styles: [`
    .alternatives-panel {
      @apply bg-white border rounded-lg shadow-sm overflow-hidden;
    }

    .panel-header {
      @apply flex items-center justify-between px-4 py-3 bg-gray-50 border-b;
    }

    .header-left {
      @apply flex items-center gap-3;
    }

    .panel-title {
      @apply text-sm font-semibold text-gray-900 m-0;
    }

    .move-info {
      @apply text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded;
    }

    .depth-badge {
      @apply text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-medium;
    }

    .alternatives-list {
      @apply divide-y divide-gray-100;
    }

    .alternative-row {
      @apply flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all hover:bg-gray-50;
    }

    .alternative-row.selected {
      @apply bg-blue-50 border-l-4 border-blue-500;
    }

    .alternative-row:hover {
      @apply bg-gray-100;
    }

    .rank-badge {
      @apply w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold flex items-center justify-center flex-shrink-0;
    }

    .alternative-row:first-child .rank-badge {
      @apply bg-green-100 text-green-700;
    }

    .move-info-section {
      @apply flex-1 min-w-0;
    }

    .primary-move {
      @apply font-mono text-sm font-semibold text-gray-900;
    }

    .continuation-line {
      @apply text-xs font-mono text-gray-500 truncate mt-0.5;
    }

    .line-move {
      @apply hover:text-gray-700;
    }

    .evaluation-section {
      @apply flex flex-col items-end gap-1 flex-shrink-0;
    }

    .eval-score {
      @apply font-mono text-sm font-bold;
    }

    .eval-score.winning {
      @apply text-green-600;
    }

    .eval-score.equal {
      @apply text-gray-600;
    }

    .eval-score.losing {
      @apply text-red-600;
    }

    .eval-bar-container {
      @apply w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden;
    }

    .eval-bar {
      @apply h-full bg-gradient-to-r from-green-400 to-green-500 transition-all;
    }

    .alternative-row.losing .eval-bar {
      @apply bg-gradient-to-r from-red-400 to-red-500;
    }

    .alternative-row.equal .eval-bar {
      @apply bg-gradient-to-r from-gray-400 to-gray-500;
    }

    .no-alternatives {
      @apply flex flex-col items-center justify-center py-8 px-4 text-center;
    }

    .info-icon {
      @apply w-10 h-10 text-gray-400 mb-3;
    }

    .no-alternatives p {
      @apply text-sm text-gray-600 m-0;
    }

    .help-text {
      @apply text-xs text-gray-400 mt-1;
    }

    .loading-state {
      @apply flex items-center justify-center gap-3 py-8;
    }

    .spinner {
      @apply w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin;
    }

    .loading-state span {
      @apply text-sm text-gray-600;
    }

    .panel-footer {
      @apply flex items-center justify-between px-4 py-3 bg-gray-50 border-t;
    }

    .legend {
      @apply flex items-center gap-4;
    }

    .legend-item {
      @apply flex items-center gap-1 text-xs text-gray-600;
    }

    .dot {
      @apply w-2 h-2 rounded-full;
    }

    .legend-item.winning .dot {
      @apply bg-green-500;
    }

    .legend-item.equal .dot {
      @apply bg-gray-500;
    }

    .legend-item.losing .dot {
      @apply bg-red-500;
    }

    .analyze-btn {
      @apply text-xs bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 transition-colors font-medium;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .panel-header {
        @apply px-3 py-2;
      }

      .alternative-row {
        @apply px-3 py-2;
      }

      .continuation-line {
        @apply hidden;
      }

      .eval-bar-container {
        @apply w-12;
      }

      .panel-footer {
        @apply flex-col gap-2;
      }

      .legend {
        @apply gap-2;
      }
    }
  `]
})
export class AlternativesMovesPanelComponent implements OnChanges {
  @Input() alternatives: AlternativeMove[] = [];
  @Input() currentMoveNumber: number = 0;
  @Input() loading: boolean = false;
  @Input() analysisDepth: number = 12;
  @Input() showAnalyzeDeeper: boolean = false;

  @Output() alternativeSelected = new EventEmitter<AlternativeMove>();
  @Output() alternativePreview = new EventEmitter<AlternativeMove | null>();
  @Output() deeperAnalysisRequested = new EventEmitter<void>();

  selectedIndex: number = -1;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['alternatives'] || changes['currentMoveNumber']) {
      this.selectedIndex = -1;
    }
  }

  selectAlternative(alt: AlternativeMove, index: number): void {
    this.selectedIndex = index;
    this.alternativeSelected.emit(alt);
  }

  previewAlternative(alt: AlternativeMove): void {
    this.alternativePreview.emit(alt);
  }

  clearPreview(): void {
    this.alternativePreview.emit(null);
  }

  analyzeDeeper(): void {
    this.deeperAnalysisRequested.emit();
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

  getEvalBarWidth(centipawns: number): number {
    // Convert centipawns to percentage (0-100)
    // +500cp = 100%, -500cp = 0%, 0cp = 50%
    const capped = Math.max(-500, Math.min(500, centipawns));
    return ((capped + 500) / 1000) * 100;
  }
}
