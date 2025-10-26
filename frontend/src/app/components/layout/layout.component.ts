import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-background">
      <!-- Navigation -->
      <nav class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="flex h-16 items-center justify-between">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <h1 class="text-xl font-bold text-foreground">Chessify</h1>
              </div>
              <div class="hidden md:block">
                <div class="ml-10 flex items-baseline space-x-4">
                  <a routerLink="/dashboard" 
                     routerLinkActive="bg-primary text-primary-foreground"
                     class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                    Dashboard
                  </a>
                  <a routerLink="/games"
                     routerLinkActive="bg-primary text-primary-foreground" 
                     class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                    Games
                  </a>
                  <a routerLink="/tournaments"
                     routerLinkActive="bg-primary text-primary-foreground"
                     class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                    Tournaments
                  </a>
                  <a routerLink="/upload"
                     routerLinkActive="bg-primary text-primary-foreground"
                     class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                    Upload
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <!-- Main content -->
      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ng-content></ng-content>
      </main>
    </div>
  `
})
export class LayoutComponent {}
