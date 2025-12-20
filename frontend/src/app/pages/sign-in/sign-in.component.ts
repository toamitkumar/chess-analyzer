import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ClerkService } from '../../services/clerk.service';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4 bg-background">
      <div class="w-full max-w-md">
        <div class="border border-border/50 shadow-xl rounded-lg bg-card">
          <!-- Header -->
          <div class="space-y-1 text-center p-6 pb-4">
            <div class="flex justify-center mb-4">
              <div class="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <span class="text-2xl font-bold text-white">♔</span>
              </div>
            </div>
            <h2 class="text-2xl font-bold">Welcome back</h2>
            <p class="text-sm text-muted-foreground">
              Sign in to analyze your chess games
            </p>
          </div>

          <!-- Clerk Sign In Container -->
          <div class="px-6 pb-6">
            <div id="clerk-sign-in"></div>

            <!-- Loading State -->
            @if (isLoading()) {
              <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p class="mt-2 text-sm text-muted-foreground">Loading...</p>
              </div>
            }
          </div>

          <!-- Sign Up Link -->
          <div class="border-t border-border/50 p-6 pt-4">
            <p class="text-sm text-muted-foreground text-center">
              Don't have an account?
              <a routerLink="/sign-up" class="text-primary hover:underline font-medium">
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class SignInComponent implements OnInit {
  private clerkService = inject(ClerkService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isLoading = signal(true);

  constructor() {
    // Watch for auth state changes using Angular effect
    effect(() => {
      if (this.clerkService.isAuthenticated()) {
        this.redirectAfterSignIn();
      }
    });
  }

  ngOnInit(): void {
    // Check if user is already authenticated
    if (this.clerkService.isAuthenticated()) {
      this.redirectAfterSignIn();
      return;
    }

    // Wait for Clerk to initialize
    this.initializeClerkSignIn();
  }

  private async initializeClerkSignIn(): Promise<void> {
    try {
      // Wait for Clerk to be ready
      if (!this.clerkService.isReady()) {
        setTimeout(() => this.initializeClerkSignIn(), 100);
        return;
      }

      // Use Clerk's built-in modal sign-in with custom appearance
      this.clerkService.openSignIn({
        appearance: {
          variables: {
            colorPrimary: '#ea580c', // orange-600
            colorBackground: '#ffffff',
            colorText: '#0f172a', // slate-900
            colorTextSecondary: '#64748b', // slate-500
            colorInputBackground: '#ffffff',
            colorInputText: '#0f172a',
            borderRadius: '0.75rem',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          },
          elements: {
            formButtonPrimary:
              'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white normal-case',
            card: 'shadow-none border-0',
            headerTitle: 'text-2xl font-bold',
            headerSubtitle: 'text-sm text-slate-500',
            socialButtonsBlockButton:
              'border border-slate-200 hover:bg-slate-50 text-slate-700 normal-case',
            formFieldInput:
              'border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500',
            footerActionLink: 'text-orange-600 hover:text-orange-700 font-medium'
          }
        }
      });
      this.isLoading.set(false);
    } catch (error) {
      console.error('Failed to initialize Clerk sign-in:', error);
      this.isLoading.set(false);
    }
  }

  private getReturnUrl(): string {
    return this.route.snapshot.queryParams['returnUrl'] || '/';
  }

  private redirectAfterSignIn(): void {
    const returnUrl = this.getReturnUrl();
    this.router.navigate([returnUrl]);
  }
}
