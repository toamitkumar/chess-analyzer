import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LucideIcon } from 'lucide-angular';

export interface Trend {
  value: number;
  isPositive: boolean;
}

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div [class]="getCardClasses()">
      <div class="flex flex-row items-center justify-between pb-2">
        <h3 class="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {{ title }}
        </h3>
        <div [class]="getIconBgClasses()">
          <lucide-angular [img]="icon" [class]="getIconColorClasses()"></lucide-angular>
        </div>
      </div>
      <div class="flex items-baseline justify-between">
        <div class="text-4xl font-bold text-foreground tracking-tight">{{ value }}</div>
        <div *ngIf="trend" [class]="getTrendClasses()">
          {{ trend.isPositive ? '↑' : '↓' }} {{ Math.abs(trend.value) }}%
        </div>
      </div>
      <p *ngIf="subtitle" class="mt-2 text-sm text-muted-foreground font-medium">{{ subtitle }}</p>
    </div>
  `
})
export class StatCardComponent {
  @Input() title!: string;
  @Input() value!: string | number;
  @Input() icon!: LucideIcon;
  @Input() subtitle?: string;
  @Input() trend?: Trend;
  @Input() variant: 'default' | 'success' | 'warning' | 'destructive' = 'default';

  Math = Math;

  getCardClasses(): string {
    const baseClasses = 'rounded-xl border border-border/50 bg-gradient-to-br from-card to-card/50 text-card-foreground shadow-lg backdrop-blur-sm transition-all duration-300 p-6 card-shine group hover:shadow-2xl hover:-translate-y-1 hover:border-primary/50';
    
    const variantClasses = {
      default: 'border-border/50',
      success: 'border-success/30 shadow-success/10',
      warning: 'border-warning/30 shadow-warning/10',
      destructive: 'border-destructive/30 shadow-destructive/10'
    };

    return `${baseClasses} ${variantClasses[this.variant]}`;
  }

  getIconBgClasses(): string {
    const baseClasses = 'p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3';
    
    const variantClasses = {
      default: 'bg-primary/10',
      success: 'bg-success/10',
      warning: 'bg-warning/10',
      destructive: 'bg-destructive/10'
    };

    return `${baseClasses} ${variantClasses[this.variant]}`;
  }

  getIconColorClasses(): string {
    const variantClasses = {
      default: 'text-primary',
      success: 'text-success',
      warning: 'text-warning',
      destructive: 'text-destructive'
    };

    return `h-5 w-5 ${variantClasses[this.variant]}`;
  }

  getTrendClasses(): string {
    const baseClasses = 'text-sm font-semibold px-2 py-1 rounded-md flex items-center gap-1';
    
    return `${baseClasses} ${
      this.trend?.isPositive 
        ? 'text-success bg-success/10' 
        : 'text-destructive bg-destructive/10'
    }`;
  }
}
