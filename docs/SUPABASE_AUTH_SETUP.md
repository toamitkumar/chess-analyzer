# Supabase Authentication Setup Guide

This guide explains how to set up Supabase Authentication for the Chess Analysis Platform.

## Why Supabase Auth?

- **Free and open-source** - No vendor lock-in
- **Multiple auth providers** - Email/password, OAuth (Google, GitHub, etc.), magic links
- **Built-in user management** - User profiles, email verification, password reset
- **Row Level Security (RLS)** - PostgreSQL-native data isolation
- **Real-time subscriptions** - Optional real-time features
- **Easy migration path** - Can migrate to self-hosted PostgreSQL later

## Prerequisites

- A Supabase account (free tier available)
- Node.js and npm installed

## Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name**: Chess Analysis Platform (or your choice)
   - **Database Password**: Choose a strong password (save it somewhere safe)
   - **Region**: Choose closest to your users
4. Click "Create new project" (takes ~2 minutes to provision)

## Step 2: Get API Keys

1. Once your project is created, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **anon/public key**: Long string starting with `eyJ...`
   - **service_role key**: Even longer string (keep this secret!)

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Step 4: Enable Authentication Providers

### Email/Password (Default - Already Enabled)

1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Email provider is enabled by default
3. Configure settings:
   - Enable email confirmations (recommended)
   - Customize email templates if desired

### Google OAuth (Optional)

1. Go to **Authentication** → **Providers**
2. Click on "Google"
3. Toggle "Enabled"
4. Add Google OAuth credentials:
   - Create OAuth app in [Google Cloud Console](https://console.cloud.google.com)
   - Copy Client ID and Client Secret
   - Add authorized redirect URI: `https://your-project-id.supabase.co/auth/v1/callback`

### GitHub OAuth (Optional)

1. Go to **Authentication** → **Providers**
2. Click on "GitHub"
3. Toggle "Enabled"
4. Add GitHub OAuth credentials:
   - Create OAuth app in [GitHub Settings](https://github.com/settings/developers)
   - Copy Client ID and Client Secret
   - Add authorization callback URL: `https://your-project-id.supabase.co/auth/v1/callback`

## Step 5: Configure Authentication Settings

1. Go to **Authentication** → **Configuration**
2. Recommended settings:
   - **Site URL**: `http://localhost:4200` (for development) or your production URL
   - **Redirect URLs**: Add allowed URLs for OAuth redirects
   - **JWT Expiry**: 3600 seconds (1 hour) - adjust as needed
   - **Disable Signup**: Leave disabled to allow new user registrations

## Step 6: Test Authentication (Optional)

Before integrating with the app, test authentication in Supabase dashboard:

1. Go to **Authentication** → **Users**
2. Click "Add User" → "Create New User"
3. Enter test email and password
4. Click "Create User"
5. You should see the user in the users table

## Step 7: Enable Authentication in API Server

The API server is currently using a temporary "default_user" for development.

### For Development (Current Setup)
Authentication is disabled by default. The middleware in `api-server.js` (line 114-119) uses `default_user`:

```javascript
// Temporary middleware: Set default user when auth is disabled
app.use('/api/*', (req, res, next) => {
  if (!req.userId) {
    req.userId = 'default_user';
  }
  next();
});
```

### To Enable Authentication
Replace the temporary middleware with one of these options:

**Option 1: Require auth for all API routes**
```javascript
// Require authentication for all API endpoints
app.use('/api/*', requireAuth);
```

**Option 2: Optional auth (works with or without token)**
```javascript
// Allow both authenticated and unauthenticated requests
// Uses authenticated user if token present, otherwise null
app.use('/api/*', optionalAuth);

// Fallback to default user if not authenticated (for transition period)
app.use('/api/*', useDefaultUser);
```

## Step 8: Frontend Integration

### Install Supabase Client (Angular)

```bash
cd newfrontend
npm install @supabase/supabase-js
```

### Create Supabase Service

Create `src/app/services/auth.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  // Sign up with email and password
  async signUp(email: string, password: string, metadata?: any) {
    return await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata // Store chess_username, display_name, etc.
      }
    });
  }

  // Sign in with email and password
  async signIn(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({
      email,
      password
    });
  }

  // Sign in with OAuth provider
  async signInWithProvider(provider: 'google' | 'github') {
    return await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  }

  // Sign out
  async signOut() {
    return await this.supabase.auth.signOut();
  }

  // Get current session
  async getSession() {
    return await this.supabase.auth.getSession();
  }

  // Get current user
  async getUser() {
    const { data: { user } } = await this.supabase.auth.getUser();
    return user;
  }

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  // Get access token for API calls
  async getAccessToken(): Promise<string | null> {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session?.access_token || null;
  }
}
```

### Add Environment Variables

Create `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://your-project-id.supabase.co',
  supabaseAnonKey: 'your_anon_key_here',
  apiUrl: 'http://localhost:3000/api'
};
```

### Create HTTP Interceptor for Auth Token

Create `src/app/interceptors/auth.interceptor.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return from(this.authService.getAccessToken()).pipe(
      switchMap(token => {
        if (token) {
          const cloned = req.clone({
            headers: req.headers.set('Authorization', `Bearer ${token}`)
          });
          return next.handle(cloned);
        }
        return next.handle(req);
      })
    );
  }
}
```

## Step 9: Testing

1. Start the backend:
   ```bash
   npm run dashboard
   ```

2. Start the frontend:
   ```bash
   cd newfrontend
   npm run dev
   ```

3. Test authentication flow:
   - Sign up with a new user
   - Verify email (if enabled)
   - Sign in
   - Upload a PGN file (should be associated with authenticated user)
   - Sign out

## Migration from Clerk

### What Changed
- Replaced `@clerk/clerk-sdk-node` with `@supabase/supabase-js`
- Updated `clerk-auth.js` → `supabase-auth.js` middleware
- Changed JWT verification from Clerk to Supabase
- User metadata structure updated (but database schema remains the same)

### What Stayed the Same
- Users table schema (compatible with both Clerk and Supabase)
- Middleware function signatures (`requireAuth`, `optionalAuth`, `useDefaultUser`)
- Database user sync logic
- API routes and controllers

### Migration Steps for Existing Data
If you have existing users from Clerk, you can:

1. Export user data from Clerk
2. Transform to Supabase format
3. Import via Supabase dashboard or API
4. Update `chess_username` mappings in users table

## Troubleshooting

### "Authentication service not configured"
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `.env`
- Verify the values are correct (no extra spaces or quotes)
- Restart the server after updating `.env`

### "Invalid or expired authentication token"
- Check that frontend is sending token in Authorization header
- Verify token format: `Bearer <token>`
- Check JWT expiry settings in Supabase dashboard
- Ensure clock synchronization on client and server

### "User not found" after sign up
- Check email confirmation is not blocking (disable for testing)
- Verify user was created in Supabase dashboard → Authentication → Users
- Check that `syncUserToDatabase` is running (check server logs)

### CORS errors
- Add allowed origins in Supabase dashboard → Settings → API → CORS
- For development, add: `http://localhost:4200`, `http://localhost:3000`

## Next Steps

1. Implement sign-up/sign-in UI components in Angular
2. Add protected routes and auth guards
3. Display user profile and settings
4. Enable Row Level Security (RLS) in Supabase for data isolation
5. Set up email templates for password reset, verification, etc.

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Angular Auth Tutorial](https://supabase.com/docs/guides/auth/auth-angular)
- [JWT Debugging Tool](https://jwt.io)
