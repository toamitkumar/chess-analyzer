import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * HTTP Interceptor that automatically adds Supabase JWT token to API requests
 *
 * Usage: Add to providers in app.config.ts:
 * provideHttpClient(withInterceptors([authInterceptor]))
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Get the access token
  return from(authService.getAccessToken()).pipe(
    switchMap(token => {
      // Clone the request and add the Authorization header if token exists
      if (token) {
        const cloned = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${token}`)
        });
        return next(cloned);
      }

      // If no token, proceed with original request
      return next(req);
    })
  );
};
