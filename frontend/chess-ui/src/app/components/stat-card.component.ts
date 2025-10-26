import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-lg border bg-card shadow-sm transition-all hover:shadow-lg">
      <div class="flex-col space-y-1.5 p-6">
        <div class="flex items-center justify-between pb-2">
          <h3 class="text-sm font-medium text-muted-foreground">{{ title }}</h3>
          <span class="h-4 w-4">{{ icon }}</span>
        </div>
        <div class="text-3xl text-foreground">{{ value }}</div>
        <p *ngIf="subtitle" class="text-sm text-muted-foreground">{{ subtitle }}</p>
      </div>
    </div>
  `
})
export class StatCardComponent {
  @Input() title = '';
  @Input() value: string | number = '';
  @Input() subtitle = '';
  @Input() icon = '📊';
}
