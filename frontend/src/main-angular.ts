import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { accessCodeInterceptor } from './app/interceptors/access-code.interceptor';
import { authInterceptor } from './app/interceptors/auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        authInterceptor,        // Auth interceptor runs first
        accessCodeInterceptor   // Then access code interceptor
      ])
    )
  ]
}).catch(err => console.error(err));
