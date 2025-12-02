import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AccessCodeService } from '../services/access-code.service';

export const accessCodeInterceptor: HttpInterceptorFn = (req, next) => {
  const accessCodeService = inject(AccessCodeService);
  const code = accessCodeService.getCode();

  // Add access code to all API requests
  if (code && req.url.includes('/api/')) {
    req = req.clone({
      setHeaders: {
        'X-Access-Code': code
      }
    });
  }

  return next(req);
};
