import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <nav class="navbar">
      <div class="container">
        <div class="nav-content">
          <!-- Logo -->
          <div class="nav-brand">
            <div class="logo">
              <mat-icon class="logo-icon">sports_esports</mat-icon>
              <span class="logo-text">Chessify</span>
            </div>
          </div>

          <!-- Navigation Links -->
          <div class="nav-links">
            <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">
              <mat-icon>dashboard</mat-icon>
              <span>Dashboard</span>
            </a>
            <a routerLink="/games" routerLinkActive="active" class="nav-link">
              <mat-icon>sports_esports</mat-icon>
              <span>Games</span>
            </a>
            <a routerLink="/import" routerLinkActive="active" class="nav-link">
              <mat-icon>upload</mat-icon>
              <span>Import</span>
            </a>
            <a routerLink="/heatmap" routerLinkActive="active" class="nav-link">
              <mat-icon>grid_on</mat-icon>
              <span>Heatmap</span>
            </a>
          </div>

          <!-- Mobile menu button -->
          <button class="mobile-menu-btn" (click)="toggleMobileMenu()">
            <mat-icon>{{ mobileMenuOpen ? 'close' : 'menu' }}</mat-icon>
          </button>
        </div>

        <!-- Mobile menu -->
        <div class="mobile-menu" [class.open]="mobileMenuOpen">
          <a routerLink="/dashboard" routerLinkActive="active" class="mobile-nav-link" (click)="closeMobileMenu()">
            <mat-icon>dashboard</mat-icon>
            <span>Dashboard</span>
          </a>
          <a routerLink="/games" routerLinkActive="active" class="mobile-nav-link" (click)="closeMobileMenu()">
            <mat-icon>sports_esports</mat-icon>
            <span>Games</span>
          </a>
          <a routerLink="/import" routerLinkActive="active" class="mobile-nav-link" (click)="closeMobileMenu()">
            <mat-icon>upload</mat-icon>
            <span>Import</span>
          </a>
          <a routerLink="/heatmap" routerLinkActive="active" class="mobile-nav-link" (click)="closeMobileMenu()">
            <mat-icon>grid_on</mat-icon>
            <span>Heatmap</span>
          </a>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      background: white;
      border-bottom: 1px solid var(--gray-200);
      position: sticky;
      top: 0;
      z-index: 50;
      box-shadow: var(--shadow-sm);
    }

    .nav-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 4rem;
    }

    .nav-brand {
      display: flex;
      align-items: center;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      text-decoration: none;
      color: var(--gray-900);
    }

    .logo-icon {
      color: var(--primary-600);
      font-size: 2rem !important;
      width: 2rem !important;
      height: 2rem !important;
    }

    .logo-text {
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--gray-900);
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      text-decoration: none;
      color: var(--gray-600);
      font-weight: 500;
      font-size: var(--text-sm);
      transition: all 0.2s ease;
    }

    .nav-link:hover {
      background: var(--gray-100);
      color: var(--gray-900);
    }

    .nav-link.active {
      background: var(--primary-50);
      color: var(--primary-700);
    }

    .nav-link mat-icon {
      font-size: 1.25rem !important;
      width: 1.25rem !important;
      height: 1.25rem !important;
    }

    .mobile-menu-btn {
      display: none;
      align-items: center;
      justify-content: center;
      padding: var(--space-2);
      border: none;
      background: none;
      color: var(--gray-600);
      cursor: pointer;
      border-radius: var(--radius-md);
    }

    .mobile-menu-btn:hover {
      background: var(--gray-100);
    }

    .mobile-menu {
      display: none;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-4) 0;
      border-top: 1px solid var(--gray-200);
      background: white;
    }

    .mobile-menu.open {
      display: flex;
    }

    .mobile-nav-link {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      text-decoration: none;
      color: var(--gray-600);
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .mobile-nav-link:hover {
      background: var(--gray-50);
      color: var(--gray-900);
    }

    .mobile-nav-link.active {
      background: var(--primary-50);
      color: var(--primary-700);
    }

    @media (max-width: 768px) {
      .nav-links {
        display: none;
      }

      .mobile-menu-btn {
        display: flex;
      }
    }
  `]
})
export class NavigationComponent {
  mobileMenuOpen = false;

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }
}
