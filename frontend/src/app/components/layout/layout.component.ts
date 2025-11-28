import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-background">
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
              <a routerLink="/games"
                 routerLinkActive="bg-primary/10 text-primary border-primary/50 shadow-glow-primary"
                 class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30 border border-transparent">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 3v18h18"/>
                  <path d="m19 9-5 5-4-4-3 3"/>
                </svg>
                Games
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
            </div>

            <!-- Mobile Menu Button -->
            <button (click)="toggleMobileMenu()" class="md:hidden p-2 rounded-lg border border-transparent hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 text-muted-foreground hover:text-primary">
              <svg *ngIf="!mobileMenuOpen" class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg *ngIf="mobileMenuOpen" class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Mobile Navigation -->
          <div *ngIf="mobileMenuOpen" class="md:hidden py-4 border-t border-border/50 animate-slide-down">
            <div class="flex flex-col gap-2">
              <a routerLink="/"
                 (click)="closeMobileMenu()"
                 routerLinkActive="bg-secondary text-secondary-foreground"
                 [routerLinkActiveOptions]="{exact: true}"
                 class="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
                Dashboard
              </a>
              <a routerLink="/upload"
                 (click)="closeMobileMenu()"
                 routerLinkActive="bg-secondary text-secondary-foreground"
                 class="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" x2="12" y1="15" y2="3"/>
                </svg>
                Upload
              </a>
              <a routerLink="/games"
                 (click)="closeMobileMenu()"
                 routerLinkActive="bg-secondary text-secondary-foreground"
                 class="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 3v18h18"/>
                  <path d="m19 9-5 5-4-4-3 3"/>
                </svg>
                Games
              </a>
              <a routerLink="/tournaments"
                 (click)="closeMobileMenu()"
                 routerLinkActive="bg-secondary text-secondary-foreground"
                 class="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
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
                 (click)="closeMobileMenu()"
                 routerLinkActive="bg-secondary text-secondary-foreground"
                 class="flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Blunders
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
export class LayoutComponent {
  mobileMenuOpen = false;

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }
}
