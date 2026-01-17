import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStats } from '../game-detail.models';

@Component({
  selector: 'app-player-stats-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-xl border-2 border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden mb-3">
      <div class="px-4 py-2 bg-gradient-to-r from-muted/50 to-transparent border-b border-border/30">
        <h3 class="text-sm font-semibold text-foreground tracking-wide">Player Stats</h3>
      </div>
      <div class="p-3 space-y-2">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-sm bg-gradient-to-br from-gray-100 to-gray-300 shadow-sm border border-gray-300"></div>
          <span class="flex-1 text-sm font-medium text-foreground truncate">{{ whiteName }}</span>
          <div class="flex gap-1">
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/20 text-sky-600" *ngIf="whiteStats.inaccuracies" title="Inaccuracies">{{ whiteStats.inaccuracies }}</span>
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-600" *ngIf="whiteStats.mistakes" title="Mistakes">{{ whiteStats.mistakes }}</span>
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-600" *ngIf="whiteStats.blunders" title="Blunders">{{ whiteStats.blunders }}</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-sm bg-gradient-to-br from-gray-700 to-gray-900 shadow-sm"></div>
          <span class="flex-1 text-sm font-medium text-foreground truncate">{{ blackName }}</span>
          <div class="flex gap-1">
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/20 text-sky-600" *ngIf="blackStats.inaccuracies" title="Inaccuracies">{{ blackStats.inaccuracies }}</span>
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-600" *ngIf="blackStats.mistakes" title="Mistakes">{{ blackStats.mistakes }}</span>
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-600" *ngIf="blackStats.blunders" title="Blunders">{{ blackStats.blunders }}</span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class PlayerStatsCardComponent {
  @Input() whiteName: string = 'White';
  @Input() blackName: string = 'Black';
  @Input() whiteStats: PlayerStats = { inaccuracies: 0, mistakes: 0, blunders: 0, avgCentipawnLoss: 0, accuracy: 0 };
  @Input() blackStats: PlayerStats = { inaccuracies: 0, mistakes: 0, blunders: 0, avgCentipawnLoss: 0, accuracy: 0 };
}
