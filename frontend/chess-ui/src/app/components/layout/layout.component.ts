import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-background">
      <nav class="border-b border-border bg-card">
        <div class="container mx-auto px-4">
          <div class="flex h-16 items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span class="text-xl font-bold text-primary-foreground">♔</span>
              </div>
              <span class="text-xl font-bold text-foreground">Chessify</span>
            </div>
            
            <div class="flex gap-1">
              <a routerLink="/dashboard" 
                 routerLinkActive="bg-secondary text-secondary-foreground"
                 [routerLinkActiveOptions]="{exact: true}"
                 class="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
                Dashboard
              </a>
              <a routerLink="/upload" 
                 routerLinkActive="bg-secondary text-secondary-foreground"
                 class="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" x2="12" y1="15" y2="3"/>
                </svg>
                Upload
              </a>
              <a routerLink="/games" 
                 routerLinkActive="bg-secondary text-secondary-foreground"
                 class="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 3v18h18"/>
                  <path d="m19 9-5 5-4-4-3 3"/>
                </svg>
                Games
              </a>
              <a routerLink="/tournaments" 
                 routerLinkActive="bg-secondary text-secondary-foreground"
                 class="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
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
            </div>
          </div>
        </div>
      </nav>
      
      <main class="container mx-auto px-4 py-8">
        <ng-content></ng-content>
      </main>
    </div>
  `
})
export class LayoutComponent {}
