import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-share-export',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="share-section">
      <strong>FEN</strong>
      <div class="share-row">
        <input type="text" readonly [value]="fen" class="share-input" />
        <button class="copy-btn" (click)="copy(fen, 'fen')" title="Copy">{{ copiedField === 'fen' ? '✓' : '📋' }}</button>
      </div>
    </div>
    <div class="share-section">
      <strong>Share</strong>
      <div class="share-row">
        <input type="text" readonly [value]="shareUrl" class="share-input" />
        <button class="copy-btn" (click)="copy(shareUrl, 'url')" title="Copy">{{ copiedField === 'url' ? '✓' : '📋' }}</button>
      </div>
    </div>
    <div class="share-section" *ngIf="pgn">
      <strong>PGN</strong>
      <div class="share-row">
        <input type="text" readonly [value]="pgn" class="share-input" />
        <button class="copy-btn" (click)="copy(pgn, 'pgn')" title="Copy">{{ copiedField === 'pgn' ? '✓' : '📋' }}</button>
      </div>
    </div>
  `,
  styles: [`
    .share-section {
      margin-bottom: 12px;
      strong { display: block; margin-bottom: 4px; color: #333; }
    }
    .share-row { display: flex; gap: 4px; }
    .share-input {
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 12px;
      background: #fff;
    }
    .copy-btn {
      padding: 6px 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;
    }
    .copy-btn:hover { background: #f0f0f0; }
  `]
})
export class ShareExportComponent {
  @Input() fen: string = '';
  @Input() shareUrl: string = '';
  @Input() pgn: string = '';
  
  copiedField: string | null = null;

  copy(text: string, field: string): void {
    navigator.clipboard.writeText(text);
    this.copiedField = field;
    setTimeout(() => this.copiedField = null, 2000);
  }
}
