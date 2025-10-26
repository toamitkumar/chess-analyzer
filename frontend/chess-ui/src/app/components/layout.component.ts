import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-background">
      <nav class="border-b bg-card">
        <div class="container mx-auto px-4">
          <div class="flex h-16 items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span class="text-xl text-primary-foreground">♔</span>
              </div>
              <span class="text-xl text-foreground">ChessMind</span>
            </div>
            
            <div class="flex gap-4">
              <a routerLink="/" routerLinkActive="bg-secondary text-secondary-foreground" 
                 class="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                🏠 Dashboard
              </a>
              <a routerLink="/upload" routerLinkActive="bg-secondary text-secondary-foreground"
                 class="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                📤 Upload
              </a>
              <a routerLink="/games" routerLinkActive="bg-secondary text-secondary-foreground"
                 class="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                📊 Games
              </a>
              <a routerLink="/tournaments" routerLinkActive="bg-secondary text-secondary-foreground"
                 class="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                🏆 Tournaments
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
