import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

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
        <div class="text-4xl font-bold tracking-tight text-gradient">{{ value }}</div>
        <div *ngIf="trend" [class]="getTrendClasses()">
          <span class="text-xs font-bold">{{ trend.isPositive ? '↑' : '↓' }}</span>
          <span class="ml-1">{{ Math.abs(trend.value) }}%</span>
        </div>
      </div>
      <p *ngIf="subtitle" class="mt-2 text-sm text-muted-foreground font-medium">{{ subtitle }}</p>
    </div>
  `
})
export class StatCardComponent {
  @Input() title!: string;
  @Input() value!: string | number;
  @Input() icon!: any;
  @Input() subtitle?: string;
  @Input() trend?: Trend;
  @Input() variant: 'default' | 'success' | 'warning' | 'destructive' = 'default';

  Math = Math;

  getCardClasses(): string {
    const baseClasses = 'rounded-xl border gradient-card text-card-foreground shadow-xl transition-all duration-300 p-6 card-shine group hover:shadow-2xl hover:-translate-y-1';

    const variantClasses = {
      default: 'border-border hover:border-primary/50 hover:shadow-glow-primary',
      success: 'border-border hover:border-success/50 hover:shadow-glow-success',
      warning: 'border-border hover:border-warning/50 hover:shadow-glow-accent',
      destructive: 'border-border hover:border-destructive/50 hover:shadow-glow'
    };

    return `${baseClasses} ${variantClasses[this.variant]}`;
  }

  getIconBgClasses(): string {
    const baseClasses = 'p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3';

    const variantClasses = {
      default: 'bg-primary/10 group-hover:bg-primary/20',
      success: 'bg-success/10 group-hover:bg-success/20',
      warning: 'bg-warning/10 group-hover:bg-warning/20',
      destructive: 'bg-destructive/10 group-hover:bg-destructive/20'
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
