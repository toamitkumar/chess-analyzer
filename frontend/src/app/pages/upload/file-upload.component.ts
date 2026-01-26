import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChessApiService } from '../../services/chess-api.service';

interface UploadFile {
  name: string;
  size: number;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  userColor: 'white' | 'black' | null;
  result?: any;
  error?: string;
}

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl backdrop-blur-sm overflow-hidden" style="animation-delay: 0.1s;">
      <div class="flex flex-col space-y-2 p-4 sm:p-6 bg-gradient-to-br from-primary/5 to-transparent">
        <h3 class="text-xl sm:text-2xl font-bold text-gradient">PGN File Upload</h3>
        <p class="text-xs sm:text-sm text-muted-foreground">Upload your chess games in PGN format for comprehensive analysis</p>
      </div>
      <div class="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
        <div
          [class]="'relative flex min-h-[250px] sm:min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-xl border-3 border-dashed transition-all duration-300 p-4 sm:p-6 ' +
            (dragActive ? 'border-primary bg-primary/10 scale-[1.02] shadow-glow-primary' : 'border-border/50 bg-gradient-to-br from-muted/20 to-muted/40 hover:border-primary/50 hover:bg-muted/50 hover:shadow-xl')"
          (dragenter)="handleDragEnter($event)"
          (dragleave)="handleDragLeave($event)"
          (dragover)="handleDragOver($event)"
          (drop)="handleDrop($event)"
          (click)="fileInput.click()">

          <input #fileInput type="file" multiple accept=".pgn" (change)="handleFileInput($event)" class="hidden" />

          <div class="flex flex-col items-center gap-3 sm:gap-4 text-center">
            <div class="rounded-full bg-primary/10 p-4 sm:p-6 shadow-lg">
              <svg class="h-10 w-10 sm:h-12 sm:w-12 text-primary" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" x2="12" y1="3" y2="15"/>
              </svg>
            </div>
            <div>
              <p class="text-base sm:text-lg font-bold text-foreground">Drop your PGN files here</p>
              <p class="text-sm text-muted-foreground mt-1">or click to browse files</p>
            </div>
            <p class="text-xs text-muted-foreground">Supports multiple files • Max 10MB each</p>
          </div>
        </div>

        <div *ngIf="files.length > 0" class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-foreground">Selected Files ({{ files.length }})</h3>
            <div *ngIf="uploadStatus === 'uploading'" class="text-sm text-muted-foreground">
              {{ getCompletionPercentage() }}% complete
            </div>
          </div>

          <div *ngIf="uploadStatus === 'uploading'" class="w-full bg-muted rounded-full h-2">
            <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" [style.width.%]="getCompletionPercentage()"></div>
          </div>

          <div class="space-y-2">
            <div *ngFor="let file of files; let i = index" class="rounded-lg border border-border bg-card p-3 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div [ngSwitch]="file.status">
                    <svg *ngSwitchCase="'success'" class="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22,4 12,14.01 9,11.01"/>
                    </svg>
                    <svg *ngSwitchCase="'error'" class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="m15 9-6 6"/>
                      <path d="m9 9 6 6"/>
                    </svg>
                    <svg *ngSwitchCase="'uploading'" class="h-5 w-5 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    <svg *ngSwitchDefault class="h-5 w-5 text-accent" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" x2="8" y1="13" y2="13"/>
                      <line x1="16" x2="8" y1="17" y2="17"/>
                      <polyline points="10,9 9,9 8,9"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-foreground">{{ file.name }}</p>
                    <p class="text-xs text-muted-foreground">
                      {{ (file.size / 1024).toFixed(2) }} KB
                      <span *ngIf="file.status === 'success' && file.result?.gamesProcessed" class="ml-2">
                        • {{ file.result.gamesProcessed }} games processed
                      </span>
                      <span *ngIf="file.status === 'error'" class="ml-2 text-red-500">
                        • {{ file.error }}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  (click)="removeFile(i); $event.stopPropagation()"
                  class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3">
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="m15 9-6 6"/>
                    <path d="m9 9 6 6"/>
                  </svg>
                </button>
              </div>
              <div class="flex items-center gap-2 ml-8">
                <label class="text-xs font-medium text-muted-foreground">You played as:</label>
                <select
                  [(ngModel)]="file.userColor"
                  [disabled]="file.status === 'uploading' || file.status === 'success'"
                  [class]="'flex h-8 rounded-md border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ' +
                    (!file.userColor ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-input bg-background')">
                  <option [ngValue]="null">Select color *</option>
                  <option value="white">⚪ White</option>
                  <option value="black">⚫ Black</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <button
          (click)="handleUpload()"
          [disabled]="files.length === 0 || uploadStatus === 'uploading' || hasFilesWithoutColor()"
          class="w-full inline-flex items-center justify-center rounded-xl text-sm sm:text-base font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:shadow-glow-primary hover:scale-[1.02] h-12 sm:h-14 px-8 shadow-lg">
          <ng-container [ngSwitch]="uploadStatus">
            <span *ngSwitchCase="'uploading'" class="flex items-center gap-2">
              <svg class="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              Processing...
            </span>
            <span *ngSwitchCase="'success'" class="flex items-center gap-2">
              <svg class="h-5 w-5 sm:h-6 sm:w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
              Upload Complete
            </span>
            <span *ngSwitchDefault class="flex items-center gap-2">
              <svg class="h-5 w-5 sm:h-6 sm:w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" x2="12" y1="3" y2="15"/>
              </svg>
              Analyze {{ files.length }} Game{{ files.length !== 1 ? 's' : '' }}
            </span>
          </ng-container>
        </button>
      </div>
    </div>
  `
})
export class FileUploadComponent {
  dragActive = false;
  files: UploadFile[] = [];
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error' = 'idle';

  constructor(private chessApi: ChessApiService) {}

  handleDragEnter(e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.dragActive = true; }
  handleDragLeave(e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.dragActive = false; }
  handleDragOver(e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.dragActive = true; }

  handleDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation(); this.dragActive = false;
    const droppedFiles = Array.from(e.dataTransfer?.files || []).filter(file => file.name.endsWith('.pgn'));
    if (droppedFiles.length > 0) {
      this.files = [...this.files, ...droppedFiles.map(f => ({ name: f.name, size: f.size, file: f, status: 'pending' as const, userColor: null }))];
    }
  }

  handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      const selectedFiles = Array.from(target.files).filter(file => file.name.endsWith('.pgn'));
      if (selectedFiles.length > 0) {
        this.files = [...this.files, ...selectedFiles.map(f => ({ name: f.name, size: f.size, file: f, status: 'pending' as const, userColor: null }))];
      }
    }
  }

  hasFilesWithoutColor(): boolean { return this.files.some(f => f.userColor === null && f.status === 'pending'); }
  removeFile(index: number) { this.files = this.files.filter((_, i) => i !== index); }
  getCompletionPercentage(): number {
    if (this.files.length === 0) return 0;
    return Math.round((this.files.filter(f => f.status === 'success' || f.status === 'error').length / this.files.length) * 100);
  }

  async handleUpload() {
    if (this.files.length === 0) return;
    this.uploadStatus = 'uploading';

    for (const fileItem of this.files) {
      fileItem.status = 'uploading';
      try {
        const result = await this.chessApi.uploadPgnFile(fileItem.file, fileItem.userColor).toPromise();
        fileItem.status = 'success';
        fileItem.result = result;
      } catch (error: any) {
        fileItem.status = 'error';
        fileItem.error = error.message || 'Upload failed';
      }
    }

    const errorCount = this.files.filter(f => f.status === 'error').length;
    this.uploadStatus = errorCount === 0 ? 'success' : 'error';

    setTimeout(() => { this.files = []; this.uploadStatus = 'idle'; }, 3000);
  }
}
