import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../components/layout/layout.component';

interface UploadFile {
  name: string;
  size: number;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, LayoutComponent],
  template: `
    <app-layout>
      <div class="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 class="text-3xl font-bold text-foreground">Upload Games</h1>
          <p class="text-muted-foreground">Import PGN files to analyze your chess games</p>
        </div>

        <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col space-y-1.5 p-6">
            <h3 class="text-2xl font-semibold leading-none tracking-tight">PGN File Upload</h3>
            <p class="text-sm text-muted-foreground">Upload your chess games in PGN format for comprehensive analysis</p>
          </div>
          <div class="p-6 pt-0 space-y-6">
            <div
              [class]="'relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all ' + 
                (dragActive ? 'border-accent bg-accent/10' : 'border-border bg-muted/20 hover:border-accent/50 hover:bg-muted/40')"
              (dragenter)="handleDragEnter($event)"
              (dragleave)="handleDragLeave($event)"
              (dragover)="handleDragOver($event)"
              (drop)="handleDrop($event)"
              (click)="fileInput.click()">
              
              <input
                #fileInput
                type="file"
                multiple
                accept=".pgn"
                (change)="handleFileInput($event)"
                class="hidden" />
              
              <div class="flex flex-col items-center gap-4 text-center">
                <div class="rounded-full bg-accent/10 p-6">
                  <svg class="h-12 w-12 text-accent" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17,8 12,3 7,8"/>
                    <line x1="12" x2="12" y1="3" y2="15"/>
                  </svg>
                </div>
                <div>
                  <p class="text-lg font-semibold text-foreground">Drop your PGN files here</p>
                  <p class="text-sm text-muted-foreground">or click to browse files</p>
                </div>
                <p class="text-xs text-muted-foreground">Supports multiple file selection • Max 10MB per file</p>
              </div>
            </div>

            <div *ngIf="files.length > 0" class="space-y-3">
              <h3 class="text-sm font-semibold text-foreground">Selected Files ({{ files.length }})</h3>
              <div class="space-y-2">
                <div *ngFor="let file of files; let i = index"
                     class="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <div class="flex items-center gap-3">
                    <svg class="h-5 w-5 text-accent" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" x2="8" y1="13" y2="13"/>
                      <line x1="16" x2="8" y1="17" y2="17"/>
                      <polyline points="10,9 9,9 8,9"/>
                    </svg>
                    <div>
                      <p class="text-sm font-medium text-foreground">{{ file.name }}</p>
                      <p class="text-xs text-muted-foreground">{{ (file.size / 1024).toFixed(2) }} KB</p>
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
              </div>
            </div>

            <button
              (click)="handleUpload()"
              [disabled]="files.length === 0 || uploadStatus === 'uploading'"
              class="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus:visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8">
              <ng-container [ngSwitch]="uploadStatus">
                <span *ngSwitchCase="'uploading'">Processing...</span>
                <span *ngSwitchCase="'success'" class="flex items-center gap-2">
                  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                  Upload Complete
                </span>
                <span *ngSwitchDefault class="flex items-center gap-2">
                  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

        <div class="rounded-lg border border-accent/20 bg-accent/5 text-card-foreground shadow-sm">
          <div class="flex flex-col space-y-1.5 p-6">
            <h3 class="text-base font-semibold leading-none tracking-tight">How it works</h3>
          </div>
          <div class="p-6 pt-0">
            <ol class="space-y-2 text-sm text-foreground">
              <li class="flex gap-2">
                <span class="font-semibold text-accent">1.</span>
                <span>Upload your PGN files containing chess games</span>
              </li>
              <li class="flex gap-2">
                <span class="font-semibold text-accent">2.</span>
                <span>Our engine analyzes each move for accuracy and mistakes</span>
              </li>
              <li class="flex gap-2">
                <span class="font-semibold text-accent">3.</span>
                <span>View detailed insights on the dashboard and individual game pages</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </app-layout>
  `
})
export class Import {
  dragActive = false;
  files: UploadFile[] = [];
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error' = 'idle';

  handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive = true;
  }

  handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive = false;
  }

  handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive = true;
  }

  handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive = false;

    const droppedFiles = Array.from(e.dataTransfer?.files || []).filter(
      file => file.name.endsWith('.pgn')
    );

    if (droppedFiles.length > 0) {
      this.files = [...this.files, ...droppedFiles.map(f => ({ name: f.name, size: f.size }))];
      console.log(`${droppedFiles.length} PGN file(s) added`);
    } else {
      console.error('Please upload PGN files only');
    }
  }

  handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      const selectedFiles = Array.from(target.files).filter(
        file => file.name.endsWith('.pgn')
      );
      if (selectedFiles.length > 0) {
        this.files = [...this.files, ...selectedFiles.map(f => ({ name: f.name, size: f.size }))];
        console.log(`${selectedFiles.length} PGN file(s) added`);
      } else {
        console.error('Please upload PGN files only');
      }
    }
  }

  handleUpload() {
    if (this.files.length === 0) {
      console.error('Please select files to upload');
      return;
    }

    this.uploadStatus = 'uploading';
    
    // Simulate upload
    setTimeout(() => {
      this.uploadStatus = 'success';
      console.log(`Successfully processed ${this.files.length} game(s)`);
      
      // Reset after success
      setTimeout(() => {
        this.files = [];
        this.uploadStatus = 'idle';
      }, 2000);
    }, 2000);
  }

  removeFile(index: number) {
    this.files = this.files.filter((_, i) => i !== index);
    console.log('File removed');
  }
}
