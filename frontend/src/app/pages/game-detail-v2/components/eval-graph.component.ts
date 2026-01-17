import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MoveAnalysis } from '../game-detail.models';

@Component({
  selector: 'app-eval-graph',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="eval-graph-container" *ngIf="moves.length > 0">
      <svg class="eval-graph" [attr.viewBox]="'0 -' + padding + ' ' + width + ' ' + (height + padding * 2)">
        <rect x="0" y="0" [attr.width]="width" [attr.height]="height/2" fill="#fff"/>
        <rect x="0" [attr.y]="height/2" [attr.width]="width" [attr.height]="height/2" fill="#888"/>
        <line x1="0" [attr.y1]="height/2" [attr.x1]="width" [attr.y2]="height/2" stroke="#666" stroke-width="1"/>
        <path [attr.d]="getEvalPath()" fill="rgba(255,255,255,0.8)" stroke="#333" stroke-width="1.5"/>
        <ng-container *ngFor="let move of moves; let i = index">
          <circle *ngIf="move.is_blunder" [attr.cx]="getGraphX(i)" [attr.cy]="getGraphY(move.evaluation)" r="5" fill="#db3434" stroke="#fff" stroke-width="2" class="eval-dot" (click)="onMoveClick(i)"/>
          <circle *ngIf="move.is_mistake && !move.is_blunder" [attr.cx]="getGraphX(i)" [attr.cy]="getGraphY(move.evaluation)" r="5" fill="#e69f00" stroke="#fff" stroke-width="2" class="eval-dot" (click)="onMoveClick(i)"/>
          <circle *ngIf="move.is_inaccuracy && !move.is_mistake && !move.is_blunder" [attr.cx]="getGraphX(i)" [attr.cy]="getGraphY(move.evaluation)" r="5" fill="#56b4e9" stroke="#fff" stroke-width="2" class="eval-dot" (click)="onMoveClick(i)"/>
        </ng-container>
        <line *ngIf="currentMoveIndex >= 0" [attr.x1]="getGraphX(currentMoveIndex)" y1="0" [attr.x2]="getGraphX(currentMoveIndex)" [attr.y2]="height" stroke="#3893e8" stroke-width="2" opacity="0.7"/>
      </svg>
    </div>
  `,
  styles: [`
    .eval-graph-container {
      width: 100%;
      padding: 12px;
      border-radius: 4px;
      overflow: hidden;
      cursor: pointer;
      background: #e8e8e8;
    }
    .eval-graph {
      width: 100%;
      display: block;
    }
    .eval-dot {
      cursor: pointer;
      transition: r 0.15s;
    }
    .eval-dot:hover { r: 6; }
  `]
})
export class EvalGraphComponent {
  @Input() moves: MoveAnalysis[] = [];
  @Input() currentMoveIndex: number = -1;
  @Input() width: number = 600;
  @Input() height: number = 60;
  @Input() padding: number = 10;
  @Output() moveSelected = new EventEmitter<number>();

  onMoveClick(index: number): void {
    this.moveSelected.emit(index);
  }

  getGraphX(moveIndex: number): number {
    if (this.moves.length <= 1) return this.width / 2;
    return (moveIndex / (this.moves.length - 1)) * this.width;
  }

  getGraphY(evaluation: number): number {
    const clampedEval = Math.max(-500, Math.min(500, evaluation));
    return (this.height / 2) - (clampedEval / 500) * (this.height / 2);
  }

  getEvalPath(): string {
    if (this.moves.length === 0) return '';
    const points: string[] = [`M 0 ${this.height / 2}`];
    points.push(`L ${this.getGraphX(0)} ${this.getGraphY(this.moves[0]?.evaluation || 0)}`);
    for (let i = 1; i < this.moves.length; i++) {
      points.push(`L ${this.getGraphX(i)} ${this.getGraphY(this.moves[i]?.evaluation || 0)}`);
    }
    points.push(`L ${this.width} ${this.height / 2}`, 'Z');
    return points.join(' ');
  }
}
