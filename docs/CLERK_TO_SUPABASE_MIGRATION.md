# Migration from Clerk to Supabase Auth

## Overview

We've migrated the authentication system from Clerk to Supabase Auth for the following reasons:

1. **Open source and self-hostable** - No vendor lock-in
2. **Better PostgreSQL integration** - Native Row Level Security (RLS)
3. **More flexible** - Multiple auth providers, customizable flows
4. **Cost-effective** - Generous free tier, transparent pricing
5. **Simpler integration** - Single SDK for auth + database

## Changes Made

### 1. Dependencies
- ✅ **Added**: `@supabase/supabase-js` (installed)
- ⚠️ **Deprecated**: `@clerk/clerk-sdk-node` (can be removed later)

### 2. Middleware
- ✅ **Created**: `src/middleware/supabase-auth.js`
- ⚠️ **Deprecated**: `src/middleware/clerk-auth.js` → `clerk-auth.js.deprecated`

### 3. API Server
- ✅ **Updated**: `src/api/api-server.js`
  - Changed import from `clerk-auth` to `supabase-auth`
  - No changes to middleware usage (same function signatures)

### 4. Environment Variables
- ✅ **Updated**: `.env.example`
  - Removed: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`
  - Added: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`

### 5. Documentation
- ✅ **Created**: `docs/SUPABASE_AUTH_SETUP.md` - Complete setup guide
- ✅ **Created**: `docs/CLERK_TO_SUPABASE_MIGRATION.md` - This file

## What Stayed the Same

### Database Schema
The `users` table schema remains **100% compatible**:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Supabase user.id (UUID)
  email TEXT UNIQUE NOT NULL,       -- Supabase user.email
  username TEXT UNIQUE,             -- From user_metadata.username
  chess_username TEXT,              -- From user_metadata.chess_username
  display_name TEXT,                -- From user_metadata.full_name
  avatar_url TEXT,                  -- From user_metadata.avatar_url
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  subscription_tier TEXT DEFAULT 'free',
  preferences TEXT
);
```

### Middleware API
All middleware functions maintain the same signatures:
- `requireAuth(req, res, next)` - Require authentication
- `optionalAuth(req, res, next)` - Optional authentication
- `useDefaultUser(req, res, next)` - Fallback to default user

### Request Object
Both systems attach the same properties to `req`:
- `req.userId` - User ID (string)
- `req.user` - Full user object

### API Routes
No changes needed to controllers or routes - they use `req.userId` which works the same way.

## Migration Checklist

### For Development

- [x] Install Supabase dependency: `npm install @supabase/supabase-js`
- [x] Create Supabase auth middleware
- [x] Update API server imports
- [x] Update `.env.example`
- [ ] Create Supabase project (follow `SUPABASE_AUTH_SETUP.md`)
- [ ] Add Supabase credentials to `.env`
- [ ] Test authentication with Supabase
- [ ] Update frontend to use Supabase SDK
- [ ] Remove Clerk dependency: `npm uninstall @clerk/clerk-sdk-node`

### For Production

- [ ] Set up Supabase production project
- [ ] Configure auth providers (Google, GitHub, etc.)
- [ ] Set up email templates
- [ ] Configure Row Level Security (RLS) policies
- [ ] Update environment variables on hosting platform
- [ ] Migrate existing user data (if any)
- [ ] Test end-to-end auth flow
- [ ] Enable authentication in API server (uncomment middleware)

## Testing Strategy

### 1. Without Supabase (Current Default)
The system continues to work with `default_user`:

```javascript
// In api-server.js (current setup)
app.use('/api/*', (req, res, next) => {
  if (!req.userId) {
    req.userId = 'default_user';
  }
  next();
});
```

### 2. With Supabase Auth (After Setup)
Once Supabase is configured, you can enable authentication:

```javascript
// Option A: Require auth for all routes
app.use('/api/*', requireAuth);

// Option B: Optional auth with fallback
app.use('/api/*', optionalAuth);
app.use('/api/*', useDefaultUser);
```

## Rollback Plan

If you need to rollback to Clerk:

1. Revert `src/api/api-server.js`:
   ```javascript
   const { requireAuth } = require('../middleware/clerk-auth');
   ```

2. Restore Clerk middleware:
   ```bash
   mv src/middleware/clerk-auth.js.deprecated src/middleware/clerk-auth.js
   ```

3. Update `.env` with Clerk credentials

4. Restart server

## Next Steps

1. **Create Supabase project** - Follow `docs/SUPABASE_AUTH_SETUP.md`
2. **Test locally** - Verify auth works with test users
3. **Update frontend** - Integrate Supabase Auth SDK in Angular
4. **Enable authentication** - Uncomment middleware in api-server.js
5. **Deploy** - Update production environment variables

## Resources

- [Supabase Auth Setup Guide](./SUPABASE_AUTH_SETUP.md)
- [Supabase Documentation](https://supabase.com/docs)
- [Migration 016](../src/models/migrations/016_add_user_authentication.js) - Database schema

## Questions?

If you encounter issues during migration, check:

1. **Server logs** - Look for authentication errors
2. **Environment variables** - Ensure Supabase credentials are set
3. **JWT token format** - Verify `Bearer <token>` header
4. **Supabase dashboard** - Check user creation and auth settings

For detailed troubleshooting, see the [Supabase Auth Setup Guide](./SUPABASE_AUTH_SETUP.md#troubleshooting).
