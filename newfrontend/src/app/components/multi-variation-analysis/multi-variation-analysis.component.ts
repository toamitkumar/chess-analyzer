import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Variation {
  id: string;
  moves: string[];
  evaluation: number;
  depth: number;
  rank: number;
  isCritical: boolean;
  description?: string;
}

export interface VariationNode {
  move: string;
  evaluation: number;
  children: VariationNode[];
  isMainLine: boolean;
}

@Component({
  selector: 'app-multi-variation-analysis',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="multi-variation-analysis">
      <div class="analysis-header">
        <h4 class="text-sm font-semibold text-gray-900">Engine Lines</h4>
        <div class="analysis-controls">
          <button
            [class]="'toggle-btn ' + (showCriticalOnly ? 'active' : '')"
            (click)="toggleCriticalOnly()">
            Critical Only
          </button>
        </div>
      </div>

      <div class="variations-list">
        <div
          *ngFor="let variation of getDisplayVariations(); trackBy: trackByVariationId"
          [class]="'variation-item ' + (selectedVariation?.id === variation.id ? 'selected ' : '') + (variation.isCritical ? 'critical' : '')">

          <!-- Variation Header -->
          <div class="variation-header" (click)="toggleVariationExpansion(variation.id)">
            <div class="variation-info">
              <span class="variation-rank">#{{ variation.rank }}</span>
              <span class="variation-evaluation">
                {{ variation.evaluation > 0 ? '+' : '' }}{{ variation.evaluation.toFixed(2) }}
              </span>
              <span class="evaluation-diff" *ngIf="variation.rank > 1">
                ({{ getEvaluationDifference(variation) > 0 ? '+' : '' }}{{ getEvaluationDifference(variation).toFixed(2) }})
              </span>
              <span class="critical-badge" *ngIf="variation.isCritical">!</span>
            </div>

            <div class="variation-preview">
              {{ getVariationPreview(variation) }}
              <span class="more-moves" *ngIf="variation.moves.length > 4">...</span>
            </div>

            <button class="expand-btn">
              <svg [class]="'h-4 w-4 transition-transform ' + (isVariationExpanded(variation.id) ? 'rotate-180' : '')"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          </div>

          <!-- Expanded Variation -->
          <div class="variation-content" *ngIf="isVariationExpanded(variation.id)">
            <div class="full-variation">
              <div class="move-sequence">
                <span class="move-pair" *ngFor="let move of variation.moves; let i = index">
                  <span class="move-number" *ngIf="i % 2 === 0">{{ Math.floor(i/2) + 1 }}.</span>
                  <span class="move-notation clickable"
                        (click)="previewMove(move, i)">
                    {{ move }}
                  </span>
                </span>
              </div>

              <div class="variation-meta">
                <span class="depth-info">Depth: {{ variation.depth }}</span>
                <button class="analyze-btn" (click)="selectVariation(variation)">
                  Analyze Line
                </button>
              </div>
            </div>

            <div class="variation-description" *ngIf="variation.description">
              <p class="text-xs text-gray-600">{{ variation.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- No Variations Message -->
      <div class="no-variations" *ngIf="getDisplayVariations().length === 0">
        <p class="text-sm text-gray-500">No significant variations found</p>
      </div>
    </div>
  `,
  styles: [`
    .multi-variation-analysis {
      @apply bg-white border rounded-lg p-3 sm:p-4 space-y-3 shadow-sm;
    }

    .analysis-header {
      @apply flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-200 pb-2 gap-2;
    }

    .analysis-controls {
      @apply flex gap-2;
    }

    .toggle-btn {
      @apply px-2 sm:px-3 py-1 text-xs border rounded transition-colors;
      @apply border-gray-300 text-gray-700 bg-white hover:bg-gray-50;
    }

    .toggle-btn.active {
      @apply bg-blue-500 text-white border-blue-500 hover:bg-blue-600;
    }

    .variations-list {
      @apply space-y-2;
    }

    .variation-item {
      @apply border border-gray-200 rounded-lg overflow-hidden transition-all;
    }

    .variation-item.selected {
      @apply border-blue-500 bg-blue-50;
    }

    .variation-item.critical {
      @apply border-orange-400 bg-orange-50;
    }

    .variation-header {
      @apply flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 sm:p-3 cursor-pointer hover:bg-gray-50 transition-colors gap-2;
    }

    .variation-info {
      @apply flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm;
    }

    .variation-rank {
      @apply bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-medium;
    }

    .variation-evaluation {
      @apply font-mono text-sm sm:text-base font-semibold text-gray-900;
    }

    .evaluation-diff {
      @apply text-gray-500 text-xs font-mono;
    }

    .critical-badge {
      @apply bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold;
    }

    .variation-preview {
      @apply flex-1 text-xs sm:text-sm font-mono text-gray-700 mx-0 sm:mx-4 truncate mt-1 sm:mt-0;
    }

    .more-moves {
      @apply text-gray-400;
    }

    .expand-btn {
      @apply p-1 hover:bg-gray-200 rounded transition-colors;
    }

    .variation-content {
      @apply border-t border-gray-200 p-2 sm:p-3 bg-gray-50;
    }

    .move-sequence {
      @apply flex flex-wrap gap-1 mb-2 sm:mb-3;
    }

    .move-pair {
      @apply flex items-center gap-0.5 sm:gap-1;
    }

    .move-number {
      @apply text-xs text-gray-500 font-medium;
    }

    .move-notation {
      @apply text-xs sm:text-sm font-mono text-gray-900;
    }

    .move-notation.clickable {
      @apply cursor-pointer hover:bg-blue-100 px-1 rounded transition-colors;
    }

    .variation-meta {
      @apply flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-gray-600 gap-2;
    }

    .analyze-btn {
      @apply bg-blue-500 text-white px-2 sm:px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors whitespace-nowrap;
    }

    .variation-description {
      @apply mt-2 pt-2 border-t border-gray-300;
    }

    .no-variations {
      @apply text-center py-6 sm:py-8;
    }

    @media (max-width: 640px) {
      .variation-header {
        @apply flex-col items-start;
      }

      .variation-info {
        @apply w-full;
      }

      .variation-preview {
        @apply w-full mx-0 text-xs;
      }
    }
  `]
})
export class MultiVariationAnalysisComponent {
  @Input() variations: Variation[] = [];
  @Input() currentPosition: string = '';
  @Input() showCriticalOnly: boolean = false;

  @Output() variationSelected = new EventEmitter<Variation>();
  @Output() movePreview = new EventEmitter<{move: string, index: number}>();

  selectedVariation: Variation | null = null;
  expandedVariations: Set<string> = new Set();

  // Make Math available in template
  Math = Math;

  getCriticalVariations(): Variation[] {
    return this.variations.filter(v => v.isCritical);
  }

  getDisplayVariations(): Variation[] {
    return this.showCriticalOnly ?
      this.getCriticalVariations() :
      this.variations.slice(0, 5);
  }

  selectVariation(variation: Variation): void {
    this.selectedVariation = variation;
    this.variationSelected.emit(variation);
  }

  toggleVariationExpansion(variationId: string): void {
    if (this.expandedVariations.has(variationId)) {
      this.expandedVariations.delete(variationId);
    } else {
      this.expandedVariations.add(variationId);
    }
  }

  isVariationExpanded(variationId: string): boolean {
    return this.expandedVariations.has(variationId);
  }

  getVariationPreview(variation: Variation): string {
    return variation.moves.slice(0, 4).join(' ');
  }

  getEvaluationDifference(variation: Variation): number {
    const bestEval = this.variations[0]?.evaluation || 0;
    return variation.evaluation - bestEval;
  }

  toggleCriticalOnly(): void {
    this.showCriticalOnly = !this.showCriticalOnly;
  }

  previewMove(move: string, index: number): void {
    this.movePreview.emit({move, index});
  }

  trackByVariationId(index: number, variation: Variation): string {
    return variation.id;
  }
}
