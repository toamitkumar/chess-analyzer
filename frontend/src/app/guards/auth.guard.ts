import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard to protect routes that require authentication
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth to initialize with timeout
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max wait

  while (authService.isLoading() && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  // If still loading after timeout, treat as not authenticated
  if (authService.isLoading()) {
    console.warn('Auth initialization timeout in guard');
    router.navigate(['/sign-in'], {
      queryParams: { returnUrl: state.url }
    });
    return false;
  }

  // Check if user is authenticated
  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect to login page with return URL
  router.navigate(['/sign-in'], {
    queryParams: { returnUrl: state.url }
  });

  return false;
};

/**
 * Guest Guard to redirect authenticated users away from auth pages
 */
export const guestGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth to initialize with timeout
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max wait

  while (authService.isLoading() && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  // If still loading after timeout, allow access to login page
  if (authService.isLoading()) {
    console.warn('Auth initialization timeout in guest guard, allowing access');
    return true;
  }

  // If user is authenticated, redirect to dashboard
  if (authService.isAuthenticated()) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
