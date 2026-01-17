import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhaseStats } from '../game-detail.models';

@Component({
  selector: 'app-phase-analysis',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-xl border-2 border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden mb-3">
      <div class="px-4 py-2 bg-gradient-to-r from-muted/50 to-transparent border-b border-border/30">
        <h3 class="text-sm font-semibold text-foreground tracking-wide">Phase Analysis</h3>
      </div>
      <div class="p-3 space-y-1">
        <div class="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" (click)="phaseClick.emit('opening')">
          <span class="text-sm text-foreground">Opening</span>
          <span class="text-sm font-semibold text-success">{{ opening.accuracy }}%</span>
        </div>
        <div class="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" (click)="phaseClick.emit('middlegame')">
          <span class="text-sm text-foreground">Middlegame</span>
          <span class="text-sm font-semibold text-success">{{ middlegame.accuracy }}%</span>
        </div>
        <div class="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" (click)="phaseClick.emit('endgame')">
          <span class="text-sm text-foreground">Endgame</span>
          <span class="text-sm font-semibold text-success">{{ endgame.accuracy }}%</span>
        </div>
      </div>
    </div>
  `
})
export class PhaseAnalysisComponent {
  @Input() opening: PhaseStats = { accuracy: 0, startMove: 0, endMove: 10 };
  @Input() middlegame: PhaseStats = { accuracy: 0, startMove: 11, endMove: 30 };
  @Input() endgame: PhaseStats = { accuracy: 0, startMove: 31, endMove: 999 };
  @Output() phaseClick = new EventEmitter<'opening' | 'middlegame' | 'endgame'>();
}
