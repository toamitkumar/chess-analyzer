import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MoveEvaluation {
  evaluation: number;
  centipawnLoss: number;
  moveQuality: 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  isMate: boolean;
  mateIn?: number;
}

@Component({
  selector: 'app-move-evaluation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="move-evaluation">
      <div class="evaluation-display">
        <span [class]="getEvaluationColor()">
          {{ getEvaluationText() }}
        </span>
        <span class="evaluation-delta" *ngIf="getEvaluationDelta() !== 0">
          ({{ getEvaluationDelta() > 0 ? '+' : '' }}{{ getEvaluationDelta().toFixed(1) }})
        </span>
      </div>
      
      <div class="move-quality">
        <span [class]="getMoveQualityColor()">
          {{ moveData.moveQuality | titlecase }}
        </span>
        <span class="centipawn-loss" *ngIf="moveData.centipawnLoss > 0">
          (-{{ moveData.centipawnLoss }}cp)
        </span>
      </div>
      
      <div class="quality-indicator">
        <div [class]="'quality-bar ' + moveData.moveQuality"></div>
      </div>
    </div>
  `,
  styles: [`
    .move-evaluation {
      @apply flex flex-col gap-1 p-2 border rounded;
    }

    .evaluation-display {
      @apply flex items-center gap-2 font-mono text-sm;
    }

    .evaluation-delta {
      @apply text-gray-500 text-xs;
    }

    .move-quality {
      @apply flex items-center gap-2 text-xs;
    }

    .quality-bar {
      @apply h-1 w-full rounded;
    }

    .quality-bar.excellent { @apply bg-green-500; }
    .quality-bar.good { @apply bg-blue-500; }
    .quality-bar.inaccuracy { @apply bg-yellow-500; }
    .quality-bar.mistake { @apply bg-orange-500; }
    .quality-bar.blunder { @apply bg-red-500; }

    .centipawn-loss {
      @apply text-red-600 font-medium;
    }
  `]
})
export class MoveEvaluationComponent {
  @Input() moveData!: MoveEvaluation;
  @Input() previousEvaluation: number = 0;

  getEvaluationText(): string {
    if (this.moveData.isMate) {
      return `M${this.moveData.mateIn}`;
    }
    return this.formatEvaluation(this.moveData.evaluation);
  }

  getEvaluationDelta(): number {
    return this.moveData.evaluation - this.previousEvaluation;
  }

  getMoveQualityColor(): string {
    const colors = {
      excellent: 'text-green-600',
      good: 'text-blue-600', 
      inaccuracy: 'text-yellow-600',
      mistake: 'text-orange-600',
      blunder: 'text-red-600'
    };
    return colors[this.moveData.moveQuality];
  }

  getEvaluationColor(): string {
    if (this.moveData.isMate) {
      return this.moveData.mateIn! > 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold';
    }
    
    if (this.moveData.evaluation > 2) return 'text-green-600 font-semibold';
    if (this.moveData.evaluation > 0.5) return 'text-green-500';
    if (this.moveData.evaluation > -0.5) return 'text-gray-600';
    if (this.moveData.evaluation > -2) return 'text-red-500';
    return 'text-red-600 font-semibold';
  }

  private formatEvaluation(evaluation: number): string {
    return evaluation > 0 ? `+${evaluation.toFixed(1)}` : evaluation.toFixed(1);
  }
}
