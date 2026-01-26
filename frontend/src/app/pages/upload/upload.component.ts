import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../components/layout/layout.component';
import { FileUploadComponent } from './file-upload.component';
import { ManualEntryComponent } from './manual-entry.component';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, LayoutComponent, FileUploadComponent, ManualEntryComponent],
  template: `
    <app-layout>
      <div class="mx-auto max-w-4xl space-y-6 sm:space-y-8 pb-8">
        <!-- Header -->
        <div class="animate-fade-in">
          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gradient tracking-tight mb-2">Upload Games</h1>
          <p class="text-sm sm:text-base text-muted-foreground">Import PGN files or enter games manually</p>
        </div>

        <!-- Tab Navigation -->
        <div class="flex gap-2 sm:gap-4 border-b-2 border-border/30 animate-slide-up">
          <button
            (click)="activeTab = 'file'"
            [class]="'px-4 sm:px-6 py-3 font-bold text-sm sm:text-base transition-all duration-300 rounded-t-lg ' +
              (activeTab === 'file' ? 'border-b-4 border-primary text-primary bg-primary/10 -mb-0.5' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')">
            <span class="flex items-center gap-2">
              <svg class="h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" x2="12" y1="3" y2="15"/>
              </svg>
              <span class="hidden sm:inline">File Upload</span>
              <span class="sm:hidden">Upload</span>
            </span>
          </button>
          <button
            (click)="activeTab = 'manual'; onManualTabClick()"
            [class]="'px-4 sm:px-6 py-3 font-bold text-sm sm:text-base transition-all duration-300 rounded-t-lg ' +
              (activeTab === 'manual' ? 'border-b-4 border-primary text-primary bg-primary/10 -mb-0.5' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')">
            <span class="flex items-center gap-2">
              <svg class="h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span class="hidden sm:inline">Manual Entry</span>
              <span class="sm:hidden">Manual</span>
            </span>
          </button>
        </div>

        <!-- File Upload Tab -->
        <app-file-upload *ngIf="activeTab === 'file'" class="animate-slide-up"></app-file-upload>

        <!-- Manual Entry Tab -->
        <app-manual-entry *ngIf="activeTab === 'manual'" [isActive]="activeTab === 'manual'" class="animate-slide-up"></app-manual-entry>

        <!-- How it works -->
        <div class="rounded-xl sm:rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5 text-card-foreground shadow-xl backdrop-blur-sm overflow-hidden animate-slide-up" style="animation-delay: 0.2s;">
          <div class="flex items-center gap-3 p-4 sm:p-6 pb-3 sm:pb-4">
            <div class="p-2 rounded-lg bg-accent/20">
              <svg class="h-5 w-5 text-accent" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
            </div>
            <h3 class="text-base sm:text-lg font-bold text-gradient">How it works</h3>
          </div>
          <div class="p-4 sm:p-6 pt-0">
            <ol class="space-y-3 sm:space-y-4 text-sm sm:text-base">
              <li class="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-card/50 border border-border/30">
                <span class="flex-shrink-0 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent text-accent-foreground font-bold text-sm sm:text-base shadow-md">1</span>
                <span class="text-foreground font-medium">Upload PGN files or enter game details manually</span>
              </li>
              <li class="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-card/50 border border-border/30">
                <span class="flex-shrink-0 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent text-accent-foreground font-bold text-sm sm:text-base shadow-md">2</span>
                <span class="text-foreground font-medium">Our Stockfish engine analyzes each move for accuracy and mistakes</span>
              </li>
              <li class="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-card/50 border border-border/30">
                <span class="flex-shrink-0 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent text-accent-foreground font-bold text-sm sm:text-base shadow-md">3</span>
                <span class="text-foreground font-medium">View detailed insights on the dashboard and individual game pages</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </app-layout>
  `
})
export class UploadComponent {
  @ViewChild(ManualEntryComponent) manualEntryComponent!: ManualEntryComponent;

  activeTab: 'file' | 'manual' = 'file';

  onManualTabClick() {
    setTimeout(() => {
      if (this.manualEntryComponent) {
        this.manualEntryComponent.initializeChessboard();
      }
    }, 100);
  }
}
