import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { 
  Home, 
  GamepadIcon, 
  Upload, 
  Trophy,
  LucideAngularModule
} from 'lucide-angular';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <div class="min-h-screen bg-background">
      <nav class="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50 shadow-lg shadow-black/5">
        <div class="container mx-auto px-4">
          <div class="flex h-16 items-center justify-between">
            <div class="flex items-center gap-3 group cursor-pointer">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-glow transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 animate-float">
                <span class="text-xl font-bold text-primary-foreground">♔</span>
              </div>
              <span class="text-xl font-bold text-gradient">ChessMind</span>
            </div>
            
            <div class="flex gap-1">
              <ng-container *ngFor="let item of navItems">
                <a 
                  [routerLink]="item.path"
                  routerLinkActive="bg-primary/10 text-primary border border-primary/20 shadow-md"
                  [routerLinkActiveOptions]="{exact: item.path === '/'}"
                  class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:-translate-y-0.5"
                >
                  <lucide-angular [img]="item.icon" class="h-4 w-4"></lucide-angular>
                  {{ item.label }}
                </a>
              </ng-container>
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
  navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/games', label: 'Games', icon: GamepadIcon },
    { path: '/upload', label: 'Upload', icon: Upload },
    { path: '/tournaments', label: 'Tournaments', icon: Trophy }
  ];

  constructor(private router: Router) {}
}
