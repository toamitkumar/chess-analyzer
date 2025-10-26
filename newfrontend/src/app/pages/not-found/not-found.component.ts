import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-background">
      <div class="text-center">
        <h1 class="text-6xl font-bold text-muted-foreground">404</h1>
        <p class="text-xl text-muted-foreground mt-4">Page not found</p>
        <a routerLink="/" 
           class="mt-6 inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
          Go Home
        </a>
      </div>
    </div>
  `
})
export class NotFoundComponent {}
