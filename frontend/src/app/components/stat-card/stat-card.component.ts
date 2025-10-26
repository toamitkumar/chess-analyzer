import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 class="tracking-tight text-sm font-medium">{{ title }}</h3>
        <svg class="h-4 w-4 text-muted-foreground" [ngSwitch]="icon">
          <!-- Trophy icon -->
          <g *ngSwitchCase="'trophy'">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M4 22h16" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M10 14.66V17c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-2.34" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" stroke="currentColor" stroke-width="2" fill="none"/>
          </g>
          <!-- Target icon -->
          <g *ngSwitchCase="'target'">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
            <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
            <circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="2" fill="none"/>
          </g>
          <!-- Trending up icon -->
          <g *ngSwitchCase="'trending-up'">
            <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" stroke="currentColor" stroke-width="2" fill="none"/>
            <polyline points="16,7 22,7 22,13" stroke="currentColor" stroke-width="2" fill="none"/>
          </g>
          <!-- Alert triangle icon -->
          <g *ngSwitchCase="'alert-triangle'">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M12 9v4" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="m12 17 .01 0" stroke="currentColor" stroke-width="2" fill="none"/>
          </g>
        </svg>
      </div>
      <div class="p-6 pt-0">
        <div class="text-2xl font-bold">{{ value }}</div>
        <p class="text-xs text-muted-foreground">{{ subtitle }}</p>
      </div>
    </div>
  `
})
export class StatCardComponent {
  @Input() title: string = '';
  @Input() value: string | number = '';
  @Input() subtitle: string = '';
  @Input() icon: string = 'trophy';
}
