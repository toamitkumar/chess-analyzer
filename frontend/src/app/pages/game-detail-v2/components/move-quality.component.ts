import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MoveQualityStats } from '../game-detail.models';

@Component({
  selector: 'app-move-quality',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-xl border-2 border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div class="px-4 py-2 bg-gradient-to-r from-muted/50 to-transparent border-b border-border/30">
        <h3 class="text-sm font-semibold text-foreground tracking-wide">Move Quality</h3>
      </div>
      <div class="p-3">
        <div class="grid grid-cols-[1fr_28px_28px] gap-1 text-xs">
          <div class="text-muted-foreground font-medium"></div>
          <div class="text-center text-muted-foreground font-medium">W</div>
          <div class="text-center text-muted-foreground font-medium">B</div>
          
          <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-700"></span><span class="text-foreground">Best</span></div>
          <div class="text-center text-foreground">{{ white.best }}</div>
          <div class="text-center text-foreground">{{ black.best }}</div>
          
          <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500"></span><span class="text-foreground">Excellent</span></div>
          <div class="text-center text-foreground">{{ white.excellent }}</div>
          <div class="text-center text-foreground">{{ black.excellent }}</div>
          
          <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500"></span><span class="text-foreground">Good</span></div>
          <div class="text-center text-foreground">{{ white.good }}</div>
          <div class="text-center text-foreground">{{ black.good }}</div>
          
          <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-sky-500"></span><span class="text-foreground">Inaccuracy</span></div>
          <div class="text-center text-foreground">{{ white.inaccuracy }}</div>
          <div class="text-center text-foreground">{{ black.inaccuracy }}</div>
          
          <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500"></span><span class="text-foreground">Mistake</span></div>
          <div class="text-center text-foreground">{{ white.mistake }}</div>
          <div class="text-center text-foreground">{{ black.mistake }}</div>
          
          <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500"></span><span class="text-foreground">Blunder</span></div>
          <div class="text-center text-foreground">{{ white.blunder }}</div>
          <div class="text-center text-foreground">{{ black.blunder }}</div>
        </div>
      </div>
    </div>
  `
})
export class MoveQualityComponent {
  @Input() white: MoveQualityStats = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  @Input() black: MoveQualityStats = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
}
