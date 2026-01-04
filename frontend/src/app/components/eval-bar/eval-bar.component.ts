import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Lichess-style evaluation bar component
 * Displays centipawn evaluation with engine info
 *
 * Based on ADR 006: Lichess-Style Game Analysis UI
 */
@Component({
  selector: 'app-eval-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="eval-bar-container">
      <!-- Analyzed indicator -->
      <div class="analyzed-indicator" *ngIf="isAnalyzed">
        <svg class="checkmark" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>

      <!-- Main evaluation display -->
      <div [class]="'eval-display ' + evalClass">
        <span class="eval-value">{{ formattedEval }}</span>
      </div>

      <!-- Engine info -->
      <div class="engine-info" *ngIf="showEngineInfo">
        <span class="engine-name">{{ engineName }}</span>
        <span class="depth-badge" *ngIf="depth">Depth {{ depth }}</span>
      </div>
    </div>
  `,
  styles: [`
    .eval-bar-container {
      @apply flex items-center gap-2 px-3 py-2 rounded-lg;
      @apply bg-gray-100 border border-gray-200;
    }

    .analyzed-indicator {
      @apply flex items-center;
    }

    .checkmark {
      @apply w-5 h-5 text-green-500;
    }

    .eval-display {
      @apply font-mono text-lg font-bold px-2 py-0.5 rounded;
      min-width: 60px;
      text-align: center;
    }

    .eval-display.eval-winning {
      @apply bg-white text-gray-900;
    }

    .eval-display.eval-losing {
      @apply bg-gray-800 text-white;
    }

    .eval-display.eval-equal {
      @apply bg-gray-400 text-white;
    }

    .eval-display.eval-mate-white {
      @apply bg-white text-green-600 border border-green-300;
    }

    .eval-display.eval-mate-black {
      @apply bg-gray-900 text-red-400;
    }

    .engine-info {
      @apply flex items-center gap-2 text-xs text-gray-500;
    }

    .engine-name {
      @apply font-medium;
    }

    .depth-badge {
      @apply px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium;
    }

    /* Compact mode for smaller displays */
    :host(.compact) .eval-bar-container {
      @apply px-2 py-1 gap-1;
    }

    :host(.compact) .eval-display {
      @apply text-sm;
      min-width: 50px;
    }

    :host(.compact) .engine-info {
      @apply hidden;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .eval-bar-container {
        @apply px-2 py-1.5;
      }

      .eval-display {
        @apply text-base;
        min-width: 50px;
      }

      .engine-info {
        @apply hidden sm:flex;
      }
    }
  `]
})
export class EvalBarComponent implements OnChanges {
  @Input() evaluation: number = 0; // Centipawns
  @Input() isMate: boolean = false;
  @Input() mateIn: number | null = null;
  @Input() depth: number | null = null;
  @Input() engineName: string = 'SF 17';
  @Input() isAnalyzed: boolean = true;
  @Input() showEngineInfo: boolean = true;

  formattedEval: string = '0.0';
  evalClass: string = 'eval-equal';

  ngOnChanges(changes: SimpleChanges): void {
    this.updateDisplay();
  }

  private updateDisplay(): void {
    if (this.isMate && this.mateIn !== null) {
      // Mate score
      if (this.mateIn > 0) {
        this.formattedEval = `+M${Math.abs(this.mateIn)}`;
        this.evalClass = 'eval-mate-white';
      } else {
        this.formattedEval = `-M${Math.abs(this.mateIn)}`;
        this.evalClass = 'eval-mate-black';
      }
    } else {
      // Regular centipawn evaluation
      const pawns = this.evaluation / 100;

      if (pawns === 0) {
        this.formattedEval = '0.0';
        this.evalClass = 'eval-equal';
      } else if (pawns > 0) {
        this.formattedEval = `+${pawns.toFixed(1)}`;
        this.evalClass = 'eval-winning';
      } else {
        this.formattedEval = pawns.toFixed(1);
        this.evalClass = 'eval-losing';
      }

      // Adjust class for extreme evaluations
      if (Math.abs(pawns) > 5) {
        this.evalClass = pawns > 0 ? 'eval-mate-white' : 'eval-mate-black';
      }
    }
  }

  /**
   * Convert centipawn evaluation to win probability percentage
   * Uses Lichess sigmoid formula
   */
  getWinProbability(): number {
    if (this.isMate && this.mateIn !== null) {
      return this.mateIn > 0 ? 100 : 0;
    }

    // Lichess formula: 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
    const cp = this.evaluation;
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  }
}
