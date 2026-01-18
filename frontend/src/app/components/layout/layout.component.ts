import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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
            <div class="hidden md:flex gap-1 items-center">
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
              <a routerLink="/insights"
                 routerLinkActive="bg-accent/10 text-accent border-accent/50 shadow-glow-accent"
                 class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 text-muted-foreground hover:bg-accent/5 hover:text-accent hover:border-accent/30 border border-transparent">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
                  <path d="M22 12A10 10 0 0 0 12 2v10z"/>
                </svg>
                Insights
              </a>

              <!-- User Menu -->
              @if (authService.isAuthenticated()) {
                <div class="relative ml-3">
                  <button
                    (click)="toggleUserMenu()"
                    class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 hover:bg-primary/5 border border-transparent hover:border-primary/30">
                    <div class="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm border-2 border-primary/20">
                      {{ getUserInitials() }}
                    </div>
                    <span class="text-muted-foreground">{{ getUserDisplayName() }}</span>
                    <svg class="h-4 w-4 text-muted-foreground" [class.rotate-180]="showUserMenu()" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>

                  <!-- Dropdown Menu -->
                  @if (showUserMenu()) {
                    <div class="absolute right-0 mt-2 w-48 rounded-lg bg-card border border-border shadow-lg py-1">
                      <div class="px-4 py-2 border-b border-border">
                        <p class="text-sm font-medium text-foreground">{{ getUserDisplayName() }}</p>
                        <p class="text-xs text-muted-foreground">{{ authService.user()?.email }}</p>
                      </div>
                      <button
                        (click)="handleSignOut()"
                        class="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors">
                        Sign Out
                      </button>
                    </div>
                  }
                </div>
              } @else {
                <a routerLink="/sign-in"
                   class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 bg-primary text-primary-foreground hover:bg-primary/90">
                  Sign In
                </a>
              }
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
            <span class="text-xs font-medium">Dashboard</span>
          </a>

          <a routerLink="/upload"
             routerLinkActive="text-primary bg-primary/10"
             class="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all duration-300 active:scale-95">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            <span class="text-xs font-medium">Upload</span>
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
            <span class="text-xs font-medium">Tournaments</span>
          </a>

          <a routerLink="/blunders"
             routerLinkActive="text-warning bg-warning/10"
             class="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-warning transition-all duration-300 active:scale-95">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span class="text-xs font-medium">Blunders</span>
          </a>

          <a routerLink="/insights"
             routerLinkActive="text-accent bg-accent/10"
             class="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-accent transition-all duration-300 active:scale-95">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
              <path d="M22 12A10 10 0 0 0 12 2v10z"/>
            </svg>
            <span class="text-xs font-medium">Insights</span>
          </a>

          <!-- User Menu / Sign In -->
          @if (authService.isAuthenticated()) {
            <button
              (click)="toggleUserMenu()"
              class="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all duration-300 active:scale-95">
              <div class="h-6 w-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-xs border-2 border-primary/20">
                {{ getUserInitials() }}
              </div>
              <span class="text-xs font-medium">Profile</span>
            </button>
          } @else {
            <a routerLink="/sign-in"
               class="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all duration-300 active:scale-95">
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              <span class="text-xs font-medium">Sign In</span>
            </a>
          }
        </div>

        <!-- Mobile User Menu Dropdown -->
        @if (authService.isAuthenticated() && showUserMenu()) {
          <div class="absolute bottom-20 right-4 w-56 rounded-lg bg-card border border-border shadow-lg py-1 z-50">
            <div class="px-4 py-2 border-b border-border">
              <p class="text-sm font-medium text-foreground">{{ getUserDisplayName() }}</p>
              <p class="text-xs text-muted-foreground">{{ authService.user()?.email }}</p>
            </div>
            <button
              (click)="handleSignOut()"
              class="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors">
              Sign Out
            </button>
          </div>
        }
      </nav>

      <main class="container mx-auto px-4 py-8">
        <ng-content></ng-content>
      </main>
    </div>
  `
})
export class LayoutComponent {
  authService = inject(AuthService);
  router = inject(Router);
  showUserMenu = signal(false);

  toggleUserMenu(): void {
    this.showUserMenu.update(show => !show);
  }

  getUserDisplayName(): string {
    const user = this.authService.user();
    if (!user) return '';

    // displayName is already set from full_name in AuthService
    return user.displayName || user.email?.split('@')[0] || 'User';
  }

  getUserInitials(): string {
    const user = this.authService.user();
    if (!user) return '?';

    // Try to get initials from displayName
    if (user.displayName) {
      const names = user.displayName.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return names[0][0].toUpperCase();
    }

    // Fallback to first letter of email
    return user.email?.[0].toUpperCase() || '?';
  }

  async handleSignOut(): Promise<void> {
    try {
      await this.authService.signOut();
      this.showUserMenu.set(false);
      this.router.navigate(['/sign-in']);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }
}
