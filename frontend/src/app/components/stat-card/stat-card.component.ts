import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-lg">
      <div class="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
        <h3 class="tracking-tight text-sm font-medium text-muted-foreground">{{ title }}</h3>
        <div class="h-4 w-4 text-muted-foreground" [class.text-red-500]="icon === 'alert-triangle'">
          <ng-container [ngSwitch]="icon">
            <svg *ngSwitchCase="'trophy'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
            <svg *ngSwitchCase="'target'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
            <svg *ngSwitchCase="'trending-up'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 18"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
            <svg *ngSwitchCase="'alert-triangle'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <path d="M12 9v4"/>
              <path d="m12 17 .01 0"/>
            </svg>
          </ng-container>
        </div>
      </div>
      <div class="p-6 pt-0">
        <div class="flex items-baseline justify-between">
          <div class="text-3xl font-bold text-foreground">{{ value }}</div>
        </div>
        <p *ngIf="subtitle" class="mt-1 text-xs text-muted-foreground">{{ subtitle }}</p>
      </div>
    </div>
  `
})
export class StatCardComponent {
  @Input() title!: string;
  @Input() value!: string | number;
  @Input() subtitle!: string;
  @Input() icon!: string;
}
