import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ClerkService } from '../services/clerk.service';
import { from, switchMap } from 'rxjs';

/**
 * Auth Interceptor
 *
 * Automatically adds the Clerk authentication token to all outgoing HTTP requests.
 * This interceptor:
 * 1. Checks if the user is authenticated
 * 2. Gets the current session token from Clerk
 * 3. Adds Authorization header with Bearer token
 * 4. Forwards the request
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const clerkService = inject(ClerkService);

  // Skip auth for non-API requests or if not authenticated
  if (!req.url.includes('/api/') || !clerkService.isAuthenticated()) {
    return next(req);
  }

  // Get token and add to request
  return from(clerkService.getToken()).pipe(
    switchMap((token) => {
      if (!token) {
        // No token available, proceed without auth
        return next(req);
      }

      // Clone request and add Authorization header
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });

      return next(authReq);
    })
  );
};
