import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-background pb-20 md:pb-0">
      <nav class="sticky top-0 z-50 border-b border-border bg-card shadow-xl">
        <div class="container mx-auto px-4">
          <div class="flex h-16 items-center justify-between">
            <div class="flex items-center gap-3 group">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-glow-primary group-hover:scale-110 transition-transform duration-300">
                <span class="text-xl font-bold text-primary-foreground">♔</span>
              </div>
              <span class="text-xl font-bold text-gradient">ChessPulse</span>
            </div>

            <!-- Desktop Navigation -->
            <div class="hidden md:flex gap-1">
              <a routerLink="/"
                 routerLinkActive="bg-primary/10 text-primary border-primary/50 shadow-glow-primary"
                 [routerLinkActiveOptions]="{exact: true}"
                 class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30 border border-transparent">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
                Dashboard
              </a>
              <a routerLink="/upload"
                 routerLinkActive="bg-primary/10 text-primary border-primary/50 shadow-glow-primary"
                 class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30 border border-transparent">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" x2="12" y1="15" y2="3"/>
                </svg>
                Upload
              </a>
              <a routerLink="/tournaments"
                 routerLinkActive="bg-primary/10 text-primary border-primary/50 shadow-glow-primary"
                 class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30 border border-transparent">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/>
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
                Tournaments
              </a>
              <a routerLink="/blunders"
                 routerLinkActive="bg-warning/10 text-warning border-warning/50 shadow-glow-accent"
                 class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 text-muted-foreground hover:bg-warning/5 hover:text-warning hover:border-warning/30 border border-transparent">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Blunders
              </a>
              <a routerLink="/puzzles"
                 routerLinkActive="bg-accent/10 text-accent border-accent/50 shadow-glow-accent"
                 class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 text-muted-foreground hover:bg-accent/5 hover:text-accent hover:border-accent/30 border border-transparent">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
                </svg>
                Puzzles
              </a>
            </div>

          </div>
        </div>
      </nav>

      <!-- Mobile Bottom Navigation -->
      <nav class="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t-2 border-border/30 bg-card/95 backdrop-blur-lg shadow-2xl">
        <div class="grid grid-cols-6 h-16">
          <a routerLink="/"
             routerLinkActive="text-primary bg-primary/10"
             [routerLinkActiveOptions]="{exact: true}"
             class="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all duration-300 active:scale-95">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
            <span class="text-xs font-medium">Home</span>
          </a>
          
          <a routerLink="/games"
             routerLinkActive="text-primary bg-primary/10"
             class="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all duration-300 active:scale-95">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3v18h18"/>
              <path d="m19 9-5 5-4-4-3 3"/>
            </svg>
            <span class="text-xs font-medium">Games</span>
          </a>
          
          <a routerLink="/upload"
             routerLinkActive="text-primary bg-primary/10"
             class="flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all duration-300 active:scale-95 relative -mt-6">
            <div class="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-glow-primary border-4 border-card">
              <svg class="h-7 w-7 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17,8 12,3 7,8"/>
                <line x1="12" x2="12" y1="3" y2="15"/>
              </svg>
            </div>
            <span class="text-xs font-medium mt-1">Upload</span>
          </a>
          
          <a routerLink="/tournaments"
             routerLinkActive="text-primary bg-primary/10"
             class="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all duration-300 active:scale-95">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/>
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
            <span class="text-xs font-medium">Events</span>
          </a>
          
          <a routerLink="/blunders"
             routerLinkActive="text-warning bg-warning/10"
             class="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-warning transition-all duration-300 active:scale-95">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span class="text-xs font-medium">Errors</span>
          </a>

          <a routerLink="/puzzles"
             routerLinkActive="text-accent bg-accent/10"
             class="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-accent transition-all duration-300 active:scale-95">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
            </svg>
            <span class="text-xs font-medium">Puzzles</span>
          </a>
        </div>
      </nav>

      <main class="container mx-auto px-4 py-8">
        <ng-content></ng-content>
      </main>
    </div>
  `
})
export class LayoutComponent {}
