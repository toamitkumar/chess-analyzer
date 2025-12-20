import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ClerkService } from '../services/clerk.service';

/**
 * Auth Guard
 *
 * Protects routes that require authentication.
 * If user is not authenticated, redirects to sign-in page.
 *
 * Usage in routes:
 * {
 *   path: 'dashboard',
 *   component: DashboardComponent,
 *   canActivate: [authGuard]
 * }
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const clerkService = inject(ClerkService);
  const router = inject(Router);

  // Wait for Clerk to initialize
  let attempts = 0;
  while (!clerkService.isReady() && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (clerkService.isAuthenticated()) {
    return true;
  }

  // Store the attempted URL for redirecting after login
  const returnUrl = state.url;

  // Redirect to sign-in
  router.navigate(['/sign-in'], {
    queryParams: { returnUrl }
  });

  return false;
};

/**
 * Public Guard
 *
 * Redirects authenticated users away from public pages (sign-in, sign-up)
 * to the dashboard or specified page.
 *
 * Usage in routes:
 * {
 *   path: 'sign-in',
 *   component: SignInComponent,
 *   canActivate: [publicGuard]
 * }
 */
export const publicGuard: CanActivateFn = async (route, state) => {
  const clerkService = inject(ClerkService);
  const router = inject(Router);

  // Wait for Clerk to initialize
  let attempts = 0;
  while (!clerkService.isReady() && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (!clerkService.isAuthenticated()) {
    return true;
  }

  // User is already authenticated, redirect to home (dashboard)
  router.navigate(['/']);
  return false;
};
