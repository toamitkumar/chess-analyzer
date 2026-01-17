import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-board-controls',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="board-controls">
      <button class="ctrl-btn" (click)="start.emit()" title="Start">
        <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" transform="rotate(180 12 12)"/></svg>
      </button>
      <button class="ctrl-btn" (click)="previous.emit()" title="Previous">
        <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </button>
      <button class="ctrl-btn" (click)="flip.emit()" title="Flip">
        <svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
      </button>
      <button class="ctrl-btn" (click)="next.emit()" title="Next">
        <svg viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
      </button>
      <button class="ctrl-btn" (click)="end.emit()" title="End">
        <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </button>
    </div>
  `,
  styles: [`
    .board-controls {
      display: flex;
      gap: 2px;
      padding: 4px;
      background: #c4c4c4;
      border-top: 1px solid #bbb;
      flex-shrink: 0;
    }
    .ctrl-btn {
      flex: 1;
      height: 32px;
      background: #d1d1d1;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ctrl-btn:hover { background: hsl(var(--accent)); }
    .ctrl-btn svg { width: 20px; height: 20px; fill: #333; }
  `]
})
export class BoardControlsComponent {
  @Output() start = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();
  @Output() flip = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() end = new EventEmitter<void>();
}
