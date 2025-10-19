import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="stat-card" [class]="variant" (click)="onClick()">
      <div class="stat-header">
        <div class="stat-icon" [class]="iconColor">
          <mat-icon>{{ icon }}</mat-icon>
        </div>
        <div class="stat-trend" *ngIf="trend" [class]="trendClass">
          <mat-icon class="trend-icon">
            {{ trend > 0 ? 'trending_up' : 'trending_down' }}
          </mat-icon>
          <span class="trend-value">{{ Math.abs(trend) }}%</span>
        </div>
      </div>
      
      <div class="stat-content">
        <div class="stat-value">{{ value }}</div>
        <div class="stat-label">{{ label }}</div>
        <div class="stat-description" *ngIf="description">{{ description }}</div>
      </div>
    </div>
  `,
  styles: [`
    .stat-card {
      background: white;
      border-radius: var(--radius-xl);
      padding: var(--space-6);
      border: 1px solid var(--gray-200);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--primary-500);
      transform: scaleX(0);
      transition: transform 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
      border-color: var(--primary-200);
    }

    .stat-card:hover::before {
      transform: scaleX(1);
    }

    .stat-card.success::before {
      background: var(--success-500);
    }

    .stat-card.warning::before {
      background: var(--warning-500);
    }

    .stat-card.error::before {
      background: var(--error-500);
    }

    .stat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-4);
    }

    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border-radius: var(--radius-lg);
      background: var(--primary-50);
    }

    .stat-icon.success {
      background: rgba(16, 185, 129, 0.1);
      color: var(--success-500);
    }

    .stat-icon.warning {
      background: rgba(245, 158, 11, 0.1);
      color: var(--warning-500);
    }

    .stat-icon.error {
      background: rgba(239, 68, 68, 0.1);
      color: var(--error-500);
    }

    .stat-icon mat-icon {
      font-size: 1.5rem !important;
      width: 1.5rem !important;
      height: 1.5rem !important;
      color: var(--primary-600);
    }

    .stat-icon.success mat-icon {
      color: var(--success-500);
    }

    .stat-icon.warning mat-icon {
      color: var(--warning-500);
    }

    .stat-icon.error mat-icon {
      color: var(--error-500);
    }

    .stat-trend {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-md);
      font-size: var(--text-xs);
      font-weight: 600;
    }

    .stat-trend.positive {
      background: rgba(16, 185, 129, 0.1);
      color: var(--success-500);
    }

    .stat-trend.negative {
      background: rgba(239, 68, 68, 0.1);
      color: var(--error-500);
    }

    .trend-icon {
      font-size: 1rem !important;
      width: 1rem !important;
      height: 1rem !important;
    }

    .stat-content {
      text-align: left;
    }

    .stat-value {
      font-size: var(--text-3xl);
      font-weight: 700;
      color: var(--gray-900);
      line-height: 1;
      margin-bottom: var(--space-2);
    }

    .stat-label {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--gray-600);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: var(--space-1);
    }

    .stat-description {
      font-size: var(--text-xs);
      color: var(--gray-500);
      line-height: 1.4;
    }

    @media (max-width: 768px) {
      .stat-card {
        padding: var(--space-4);
      }

      .stat-value {
        font-size: var(--text-2xl);
      }

      .stat-icon {
        width: 2.5rem;
        height: 2.5rem;
      }

      .stat-icon mat-icon {
        font-size: 1.25rem !important;
        width: 1.25rem !important;
        height: 1.25rem !important;
      }
    }
  `]
})
export class StatCardComponent {
  @Input() icon: string = 'analytics';
  @Input() value: string | number = '0';
  @Input() label: string = '';
  @Input() description?: string;
  @Input() variant: 'default' | 'success' | 'warning' | 'error' = 'default';
  @Input() iconColor: 'default' | 'success' | 'warning' | 'error' = 'default';
  @Input() trend?: number;
  @Output() cardClick = new EventEmitter<void>();

  Math = Math;

  get trendClass() {
    return this.trend && this.trend > 0 ? 'positive' : 'negative';
  }

  onClick() {
    this.cardClick.emit();
  }
}
