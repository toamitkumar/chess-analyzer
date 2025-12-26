import { Component, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ChessApiService } from '../../services/chess-api.service';
import { Chess } from 'chess.js';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Color, Key } from '@lichess-org/chessground/types';

interface UploadFile {
  name: string;
  size: number;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  userColor: 'white' | 'black' | null;
  result?: any;
  error?: string;
}

interface ManualPGNForm {
  tournamentName: string;
  date: string;
  opponent: string;
  opponentElo: number | null;
  playerElo: number | null;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  variant: 'Rapid' | 'Classic' | 'Blitz';
  termination: 'mate' | 'resigned' | 'time-over' | 'draw-agreement';
  playerColor: 'white' | 'black';
  moves: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, LayoutComponent],
  styles: [`
    @import '@lichess-org/chessground/assets/chessground.base.css';
    @import '@lichess-org/chessground/assets/chessground.brown.css';
    @import '@lichess-org/chessground/assets/chessground.cburnett.css';

    .chessboard {
      width: 100%;
      aspect-ratio: 1;
    }
  `],
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
        <div *ngIf="activeTab === 'file'" class="rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl backdrop-blur-sm overflow-hidden animate-slide-up" style="animation-delay: 0.1s;">
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

              <input
                #fileInput
                type="file"
                multiple
                accept=".pgn"
                (change)="handleFileInput($event)"
                class="hidden" />

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

              <!-- Progress bar -->
              <div *ngIf="uploadStatus === 'uploading'" class="w-full bg-muted rounded-full h-2">
                <div class="bg-blue-500 h-2 rounded-full transition-all duration-300"
                     [style.width.%]="getCompletionPercentage()"></div>
              </div>

              <div class="space-y-2">
                <div *ngFor="let file of files; let i = index"
                     class="rounded-lg border border-border bg-card p-3 space-y-2">
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
                  <!-- Color Selection for each file -->
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

        <!-- Manual Entry Tab -->
        <div *ngIf="activeTab === 'manual'" class="rounded-xl sm:rounded-2xl border-2 border-border/30 gradient-card text-card-foreground shadow-2xl backdrop-blur-sm overflow-hidden animate-slide-up" style="animation-delay: 0.1s;">
          <div class="flex flex-col space-y-2 p-4 sm:p-6 bg-gradient-to-br from-accent/5 to-transparent">
            <h3 class="text-xl sm:text-2xl font-bold text-gradient">Manual Game Entry</h3>
            <p class="text-xs sm:text-sm text-muted-foreground">Enter game details and moves from your tournament</p>
          </div>
          <div class="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
            <form (ngSubmit)="handleManualSubmit()" #manualForm="ngForm">
              <!-- Tournament Name -->
              <div class="space-y-2">
                <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Tournament Name *
                </label>
                <input
                  type="text"
                  [(ngModel)]="manualPGN.tournamentName"
                  name="tournamentName"
                  required
                  placeholder="e.g., Club Championship 2025"
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
              </div>

              <!-- Player Color Selection -->
              <div class="space-y-2">
                <label class="text-sm font-medium leading-none">
                  Your Color *
                </label>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      [(ngModel)]="manualPGN.playerColor"
                      name="playerColor"
                      value="white"
                      required
                      class="w-4 h-4 text-accent border-gray-300 focus:ring-accent" />
                    <span class="text-sm">White</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      [(ngModel)]="manualPGN.playerColor"
                      name="playerColor"
                      value="black"
                      required
                      class="w-4 h-4 text-accent border-gray-300 focus:ring-accent" />
                    <span class="text-sm">Black</span>
                  </label>
                </div>
              </div>

              <!-- Opponent Name -->
              <div class="space-y-2">
                <label class="text-sm font-medium leading-none">
                  Opponent Name *
                </label>
                <input
                  type="text"
                  [(ngModel)]="manualPGN.opponent"
                  name="opponent"
                  required
                  placeholder="e.g., John Doe"
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
              </div>

              <!-- Ratings -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-sm font-medium leading-none">
                    Your Rating (Elo)
                  </label>
                  <input
                    type="number"
                    [(ngModel)]="manualPGN.playerElo"
                    name="playerElo"
                    placeholder="e.g., 1500"
                    min="0"
                    max="3000"
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                </div>
                <div class="space-y-2">
                  <label class="text-sm font-medium leading-none">
                    Opponent Rating (Elo)
                  </label>
                  <input
                    type="number"
                    [(ngModel)]="manualPGN.opponentElo"
                    name="opponentElo"
                    placeholder="e.g., 1600"
                    min="0"
                    max="3000"
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                </div>
              </div>

              <!-- Date and Result -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-sm font-medium leading-none">
                    Date *
                  </label>
                  <input
                    type="date"
                    [(ngModel)]="manualPGN.date"
                    name="date"
                    required
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                </div>
                <div class="space-y-2">
                  <label class="text-sm font-medium leading-none">
                    Result *
                  </label>
                  <select
                    [(ngModel)]="manualPGN.result"
                    name="result"
                    required
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="1-0">White Wins (1-0)</option>
                    <option value="0-1">Black Wins (0-1)</option>
                    <option value="1/2-1/2">Draw (1/2-1/2)</option>
                    <option value="*">Ongoing (*)</option>
                  </select>
                </div>
              </div>

              <!-- Variant and Termination -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-sm font-medium leading-none">
                    Time Control *
                  </label>
                  <select
                    [(ngModel)]="manualPGN.variant"
                    name="variant"
                    required
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="Rapid">Rapid</option>
                    <option value="Classic">Classic</option>
                    <option value="Blitz">Blitz</option>
                  </select>
                </div>
                <div class="space-y-2">
                  <label class="text-sm font-medium leading-none">
                    Termination *
                  </label>
                  <select
                    [(ngModel)]="manualPGN.termination"
                    name="termination"
                    required
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="mate">Checkmate</option>
                    <option value="resigned">Resigned</option>
                    <option value="time-over">Time Over</option>
                    <option value="draw-agreement">Draw Agreement</option>
                  </select>
                </div>
              </div>

              <!-- Interactive Chessboard -->
              <div class="space-y-2">
                <label class="text-sm font-medium leading-none">
                  Play Moves on Board
                </label>
                <div class="rounded-md border border-input p-4 bg-background">
                  <div class="flex justify-between items-center mb-3">
                    <span class="text-sm text-muted-foreground">Drag pieces to make moves</span>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        (click)="undoMove()"
                        class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                        <svg class="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 7v6h6"/>
                          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                        </svg>
                        Undo
                      </button>
                      <button
                        type="button"
                        (click)="resetBoard()"
                        class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                        <svg class="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                          <path d="M21 3v5h-5"/>
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                          <path d="M8 16H3v5"/>
                        </svg>
                        Reset
                      </button>
                    </div>
                  </div>
                  <div #chessboard class="chessboard mx-auto" style="max-width: 400px;"></div>

                  <!-- Move Navigation Controls -->
                  <div *ngIf="moveHistory.length > 0" class="mt-4 space-y-2">
                    <div class="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        (click)="goToFirstMove()"
                        [disabled]="currentMoveIndex === -1"
                        class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 disabled:pointer-events-none disabled:opacity-50"
                        title="Go to start">
                        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="11,17 6,12 11,7"/>
                          <polyline points="18,17 13,12 18,7"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        (click)="goToPreviousMove()"
                        [disabled]="currentMoveIndex < 0"
                        class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 disabled:pointer-events-none disabled:opacity-50"
                        title="Previous move">
                        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="15,18 9,12 15,6"/>
                        </svg>
                      </button>
                      <span class="px-4 py-2 text-sm font-medium text-foreground min-w-[60px] text-center">
                        {{ getCurrentMoveDisplay() }}
                      </span>
                      <button
                        type="button"
                        (click)="goToNextMove()"
                        [disabled]="currentMoveIndex >= moveHistory.length - 1"
                        class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 disabled:pointer-events-none disabled:opacity-50"
                        title="Next move">
                        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="9,18 15,12 9,6"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        (click)="goToLastMove()"
                        [disabled]="currentMoveIndex >= moveHistory.length - 1"
                        class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 disabled:pointer-events-none disabled:opacity-50"
                        title="Go to end">
                        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="13,17 18,12 13,7"/>
                          <polyline points="6,17 11,12 6,7"/>
                        </svg>
                      </button>
                    </div>
                    <div class="text-center text-xs text-muted-foreground">
                      Navigate through game moves
                    </div>
                  </div>
                </div>
              </div>

              <!-- Moves -->
              <div class="space-y-2">
                <label class="text-sm font-medium leading-none">
                  Moves (Generated from Board or Paste PGN) *
                </label>
                <textarea
                  [(ngModel)]="manualPGN.moves"
                  name="moves"
                  required
                  rows="8"
                  readonly
                  placeholder="Play moves on the board above, or paste PGN here (Ctrl/Cmd+V) and it will be plotted on the board..."
                  [class]="'flex min-h-[80px] w-full rounded-md border border-input bg-muted px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' + (movesValidationError ? 'border-red-500' : '')"
                  (paste)="onPgnPaste($event)"></textarea>
                <div *ngIf="movesValidationError" class="text-sm text-red-500 flex items-center gap-2">
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {{ movesValidationError }}
                </div>
                <div *ngIf="!movesValidationError && manualPGN.moves" class="text-sm text-green-500 flex items-center gap-2">
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                  Moves appear valid
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-3">
                <!-- Verify Button -->
                <button
                  type="button"
                  (click)="verifyMoves()"
                  [disabled]="!manualPGN.moves.trim() || manualSubmitStatus === 'uploading'"
                  class="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-8 disabled:pointer-events-none disabled:opacity-50">
                  <svg class="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                  Verify Moves
                </button>

                <!-- Submit Button -->
                <button
                  type="submit"
                  [disabled]="!manualForm.valid || !!movesValidationError || manualSubmitStatus === 'uploading'"
                  class="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8">
                <ng-container [ngSwitch]="manualSubmitStatus">
                  <span *ngSwitchCase="'uploading'">Submitting...</span>
                  <span *ngSwitchCase="'success'" class="flex items-center gap-2">
                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22,4 12,14.01 9,11.01"/>
                    </svg>
                    Game Submitted Successfully
                  </span>
                  <span *ngSwitchDefault class="flex items-center gap-2">
                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 12h14"/>
                      <path d="m12 5 7 7-7 7"/>
                    </svg>
                    Submit Game for Analysis
                  </span>
                </ng-container>
                </button>
              </div>

              <div *ngIf="manualSubmitStatus === 'error'" class="text-sm text-red-500 p-4 bg-red-50 dark:bg-red-900/10 rounded-lg">
                {{ manualSubmitError }}
              </div>
            </form>
          </div>
        </div>

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
export class UploadComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chessboard') chessboardEl!: ElementRef;

  // Chessboard properties
  private chessboard: Api | null = null;
  private chessGame: Chess = new Chess();
  private moveHistory: string[] = [];
  currentMoveIndex: number = -1; // -1 means at starting position
  activeTab: 'file' | 'manual' = 'file';
  dragActive = false;
  files: UploadFile[] = [];
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error' = 'idle';

  // Manual PGN entry
  manualPGN: ManualPGNForm = {
    tournamentName: '',
    date: new Date().toISOString().split('T')[0],
    opponent: '',
    opponentElo: null,
    playerElo: null,
    result: '1-0',
    variant: 'Rapid',
    termination: 'mate',
    playerColor: 'white',
    moves: ''
  };
  movesValidationError: string | null = null;
  manualSubmitStatus: 'idle' | 'uploading' | 'success' | 'error' = 'idle';
  manualSubmitError: string = '';

  constructor(
    private chessApi: ChessApiService
  ) {}

  ngAfterViewInit() {
    // Initialize chessboard when view is ready and manual tab is active
    if (this.activeTab === 'manual') {
      setTimeout(() => this.initializeChessboard(), 0);
    }
  }

  ngOnDestroy() {
    // Cleanup chessboard
    if (this.chessboard) {
      this.chessboard.destroy();
    }
  }

  onManualTabClick() {
    // Initialize board after a short delay to ensure the DOM element is rendered
    setTimeout(() => this.initializeChessboard(), 100);
  }

  private initializeChessboard() {
    if (!this.chessboardEl || this.chessboard) return;

    this.chessboard = Chessground(this.chessboardEl.nativeElement, {
      movable: {
        free: false,
        color: 'both',
        dests: this.getLegalMoves(),
        events: {
          after: (orig: Key, dest: Key) => this.onBoardMove(orig, dest)
        }
      },
      draggable: {
        enabled: true,
        showGhost: true
      },
      highlight: {
        lastMove: true,
        check: true
      },
      selectable: {
        enabled: true
      }
    });
  }

  private getLegalMoves(): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    const moves = this.chessGame.moves({ verbose: true });

    for (const move of moves) {
      const from = move.from as Key;
      const to = move.to as Key;

      if (!dests.has(from)) {
        dests.set(from, []);
      }
      dests.get(from)!.push(to);
    }

    return dests;
  }

  private getCheckmateHighlight() {
    if (!this.chessGame.isCheckmate()) {
      return [];
    }

    // Find the king that is in checkmate (the king of the side to move)
    const board = this.chessGame.board();
    const turn = this.chessGame.turn(); // 'w' or 'b' - the side that is checkmated

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = board[row][col];
        if (square && square.type === 'k' && square.color === turn) {
          // Found the checkmated king
          const file = String.fromCharCode(97 + col); // a-h
          const rank = String(8 - row); // 8-1
          return [{
            orig: (file + rank) as Key,
            brush: 'red'
          }];
        }
      }
    }

    return [];
  }

  private onBoardMove(from: Key, to: Key) {
    try {
      // Try to make the move
      const move = this.chessGame.move({
        from,
        to,
        promotion: 'q' // Always promote to queen for simplicity
      }, { strict: false });

      if (move) {
        // Update board to reflect the move and show new legal moves
        this.chessboard?.set({
          fen: this.chessGame.fen(),
          movable: {
            dests: this.getLegalMoves()
          },
          drawable: {
            shapes: this.getCheckmateHighlight()
          }
        });

        // Update moves field with SAN notation
        this.updateMovesFromGame();
        console.log('Move made:', move.san, this.chessGame.isCheckmate() ? '(Checkmate!)' : '');
      } else {
        // Invalid move, reset board
        this.chessboard?.set({
          fen: this.chessGame.fen()
        });
      }
    } catch (error) {
      console.error('Error making move:', error);
      // Reset board on error
      this.chessboard?.set({
        fen: this.chessGame.fen()
      });
    }
  }

  private updateMovesFromGame() {
    const history = this.chessGame.history();
    this.moveHistory = [...history];
    this.currentMoveIndex = this.moveHistory.length - 1;
    this.manualPGN.moves = history.join(' ');
    this.validateMoves();
  }

  resetBoard() {
    this.chessGame.reset();
    this.moveHistory = [];
    this.currentMoveIndex = -1;
    this.chessboard?.set({
      fen: this.chessGame.fen(),
      movable: {
        dests: this.getLegalMoves()
      },
      drawable: {
        shapes: []
      }
    });
    this.manualPGN.moves = '';
    this.movesValidationError = null;
  }

  undoMove() {
    const move = this.chessGame.undo();
    if (move) {
      this.chessboard?.set({
        fen: this.chessGame.fen(),
        movable: {
          dests: this.getLegalMoves()
        },
        drawable: {
          shapes: this.getCheckmateHighlight()
        }
      });
      this.updateMovesFromGame();
    }
  }

  verifyMoves() {
    this.validateMoves();
    if (!this.movesValidationError) {
      alert('✓ All moves are valid and ready to submit!');
    }
  }

  onPgnPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';

    if (!pastedText.trim()) {
      return;
    }

    try {
      // Clean and parse the pasted PGN
      let movesText = pastedText
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove invisible characters
        .replace(/\d+\.\s*/g, ' ') // Remove move numbers
        .replace(/1-0|0-1|1\/2-1\/2|\*/g, '') // Remove result
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      const moves = movesText.split(' ').filter(m => m.length > 0);

      if (moves.length === 0) {
        alert('No valid moves found in pasted text');
        return;
      }

      // Reset the game and board
      this.chessGame.reset();
      this.moveHistory = [];
      this.currentMoveIndex = -1;

      // Apply each move
      const chess = new Chess();
      const validMoves: string[] = [];

      for (let i = 0; i < moves.length; i++) {
        const move = moves[i].trim();
        if (!move) continue;

        try {
          const result = chess.move(move, { strict: false });
          if (result) {
            validMoves.push(result.san);
          } else {
            alert(`Invalid move "${move}" at position ${i + 1}. Stopped parsing.`);
            break;
          }
        } catch (error) {
          alert(`Error parsing move "${move}" at position ${i + 1}. Stopped parsing.`);
          break;
        }
      }

      if (validMoves.length > 0) {
        // Reset and apply all valid moves to our game
        this.chessGame.reset();
        this.moveHistory = [];

        for (const move of validMoves) {
          this.chessGame.move(move, { strict: false });
          this.moveHistory.push(move);
        }

        // Update the board to final position
        this.currentMoveIndex = this.moveHistory.length - 1;
        this.chessboard?.set({
          fen: this.chessGame.fen(),
          movable: {
            dests: this.getLegalMoves()
          },
          drawable: {
            shapes: this.getCheckmateHighlight()
          }
        });

        // Update moves field
        this.manualPGN.moves = validMoves.join(' ');
        this.validateMoves();

        console.log(`Pasted and plotted ${validMoves.length} moves`);
      }
    } catch (error: any) {
      console.error('Error pasting PGN:', error);
      alert(`Error pasting PGN: ${error.message}`);
    }
  }

  // Move navigation methods
  goToFirstMove() {
    if (this.moveHistory.length === 0) return;

    this.currentMoveIndex = -1;
    this.chessGame.reset();

    this.chessboard?.set({
      fen: this.chessGame.fen(),
      movable: {
        dests: new Map() // Disable moves when navigating
      },
      drawable: {
        shapes: this.getCheckmateHighlight()
      }
    });
  }

  goToPreviousMove() {
    if (this.currentMoveIndex < 0) return;

    this.currentMoveIndex--;
    this.chessGame.reset();

    // Replay moves up to current index
    for (let i = 0; i <= this.currentMoveIndex; i++) {
      this.chessGame.move(this.moveHistory[i], { strict: false });
    }

    this.chessboard?.set({
      fen: this.chessGame.fen(),
      movable: {
        dests: new Map() // Disable moves when navigating
      },
      drawable: {
        shapes: this.getCheckmateHighlight()
      }
    });
  }

  goToNextMove() {
    if (this.currentMoveIndex >= this.moveHistory.length - 1) return;

    this.currentMoveIndex++;
    const move = this.moveHistory[this.currentMoveIndex];
    this.chessGame.move(move, { strict: false });

    // Enable moves if at the last position, otherwise disable
    const isAtLastMove = this.currentMoveIndex === this.moveHistory.length - 1;
    this.chessboard?.set({
      fen: this.chessGame.fen(),
      movable: {
        dests: isAtLastMove ? this.getLegalMoves() : new Map()
      },
      drawable: {
        shapes: this.getCheckmateHighlight()
      }
    });
  }

  goToLastMove() {
    if (this.moveHistory.length === 0) return;

    this.currentMoveIndex = this.moveHistory.length - 1;
    this.chessGame.reset();

    // Replay all moves
    for (const move of this.moveHistory) {
      this.chessGame.move(move, { strict: false });
    }

    // Enable moves when at the last position
    this.chessboard?.set({
      fen: this.chessGame.fen(),
      movable: {
        dests: this.getLegalMoves()
      },
      drawable: {
        shapes: this.getCheckmateHighlight()
      }
    });
  }

  getCurrentMoveDisplay(): string {
    if (this.moveHistory.length === 0) return '0/0';
    const current = this.currentMoveIndex === -1 ? 0 : this.currentMoveIndex + 1;
    return `${current}/${this.moveHistory.length}`;
  }

  // File upload methods
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
      this.files = [...this.files, ...droppedFiles.map(f => ({
        name: f.name,
        size: f.size,
        file: f,
        status: 'pending' as const,
        userColor: null
      }))];
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
        this.files = [...this.files, ...selectedFiles.map(f => ({
          name: f.name,
          size: f.size,
          file: f,
          status: 'pending' as const,
          userColor: null
        }))];
        console.log(`${selectedFiles.length} PGN file(s) added`);
      } else {
        console.error('Please upload PGN files only');
      }
    }
  }

  hasFilesWithoutColor(): boolean {
    return this.files.some(f => f.userColor === null && f.status === 'pending');
  }

  async handleUpload() {
    if (this.files.length === 0) {
      console.error('Please select files to upload');
      return;
    }

    // Authentication is handled by Supabase JWT token (authInterceptor)
    this.uploadStatus = 'uploading';

    try {
      // Upload files one by one
      for (let i = 0; i < this.files.length; i++) {
        const fileItem = this.files[i];
        fileItem.status = 'uploading';

        try {
          const result = await this.chessApi.uploadPgnFile(fileItem.file, fileItem.userColor).toPromise();
          fileItem.status = 'success';
          fileItem.result = result;
          console.log(`Successfully uploaded ${fileItem.name} (color: ${fileItem.userColor}):`, result);
        } catch (error: any) {
          fileItem.status = 'error';
          fileItem.error = error.message || 'Upload failed';
          console.error(`Failed to upload ${fileItem.name}:`, error);
        }
      }

      const successCount = this.files.filter(f => f.status === 'success').length;
      const errorCount = this.files.filter(f => f.status === 'error').length;

      if (errorCount === 0) {
        this.uploadStatus = 'success';
        console.log(`Successfully processed ${successCount} game(s)`);
      } else {
        this.uploadStatus = 'error';
        console.log(`Processed ${successCount} games, ${errorCount} failed`);
      }

      // Reset after 3 seconds
      setTimeout(() => {
        this.files = [];
        this.uploadStatus = 'idle';
      }, 3000);

    } catch (error) {
      this.uploadStatus = 'error';
      console.error('Upload process failed:', error);
    }
  }

  removeFile(index: number) {
    this.files = this.files.filter((_, i) => i !== index);
    console.log('File removed');
  }

  getCompletionPercentage(): number {
    if (this.files.length === 0) return 0;
    const completedFiles = this.files.filter(f => f.status === 'success' || f.status === 'error').length;
    return Math.round((completedFiles / this.files.length) * 100);
  }

  // Manual PGN entry methods
  validateMoves() {
    if (!this.manualPGN.moves.trim()) {
      this.movesValidationError = null;
      return;
    }

    try {
      // Clean and parse moves from input
      let movesText = this.manualPGN.moves
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces and other invisible characters
        .replace(/\d+\.\s*/g, ' ') // Remove move numbers with optional space
        .replace(/1-0|0-1|1\/2-1\/2|\*/g, '') // Remove result
        .replace(/\s+/g, ' ') // Normalize all whitespace to single spaces
        .trim();

      const moves = movesText.split(' ').filter(m => m.length > 0);

      if (moves.length === 0) {
        this.movesValidationError = 'Please enter at least one move';
        return;
      }

      // Use chess.js to validate moves are legal
      const chess = new Chess();

      for (let i = 0; i < moves.length; i++) {
        const move = moves[i].trim();

        // Skip empty moves
        if (!move) continue;

        try {
          const result = chess.move(move, { strict: false }); // non-strict allows various notation formats

          if (!result) {
            this.movesValidationError = `Illegal move "${move}" at position ${i + 1}. Current board position doesn't allow this move.`;
            return;
          }
        } catch (error: any) {
          this.movesValidationError = `Invalid move "${move}" at position ${i + 1}: ${error.message || 'Invalid notation'}`;
          return;
        }
      }

      // All moves are valid
      this.movesValidationError = null;

    } catch (error: any) {
      this.movesValidationError = `Error validating moves: ${error.message || 'Unknown error'}`;
    }
  }

  async handleManualSubmit() {
    this.validateMoves();

    if (this.movesValidationError) {
      return;
    }

    this.manualSubmitStatus = 'uploading';
    this.manualSubmitError = '';

    try {
      const result = await this.chessApi.submitManualPGN(this.manualPGN).toPromise();
      this.manualSubmitStatus = 'success';
      console.log('Manual game submitted successfully:', result);

      // Reset form after 3 seconds
      setTimeout(() => {
        this.manualPGN = {
          tournamentName: '',
          date: new Date().toISOString().split('T')[0],
          opponent: '',
          opponentElo: null,
          playerElo: null,
          result: '1-0',
          variant: 'Rapid',
          termination: 'mate',
          playerColor: 'white',
          moves: ''
        };
        this.manualSubmitStatus = 'idle';
        this.movesValidationError = null;
      }, 3000);
    } catch (error: any) {
      this.manualSubmitStatus = 'error';
      this.manualSubmitError = error.error?.error || error.message || 'Failed to submit game';
      console.error('Failed to submit manual game:', error);
    }
  }
}
