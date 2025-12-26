# ADR-004: Authentication Implementation Strategy

**Status**: Proposed
**Date**: 2025-12-19
**Decision Makers**: Engineering Team
**Related**: Migration from single-user to multi-user system

---

## Context

ChessPulse currently operates as a single-user application hardcoded for player `AdvaitKumar1213`. All game analysis, puzzle progress, and performance metrics are tied to this hardcoded user. To scale the application and support multiple users, we need to implement authentication and user management.

### Current State Analysis

**Hardcoded User References:**
- `src/config/app-config.js`: `TARGET_PLAYER = 'AdvaitKumar1213'`
- Database tables use `user_id DEFAULT 'default_user'`
- No session management or user context
- No access control or data isolation

**Database Impact:**
```
Tables with user_id columns:
- user_puzzle_progress (9 occurrences)
- theme_mastery
- Future: games, analysis, tournaments (need migration)
```

**API Endpoints Affected:**
- `/api/performance` - Currently returns data for hardcoded player
- `/api/blunders` - No user filtering
- `/api/puzzles/*` - Uses default_user
- `/api/learning-path` - User-specific progress
- All game upload/analysis endpoints

---

## Decision

**Recommended Solution: Clerk (clerk.com)**

We will implement authentication using Clerk, a modern authentication SaaS platform, due to its superior developer experience, comprehensive features, and competitive pricing for our use case.

---

## SaaS Authentication Providers Comparison

### 1. **Clerk** ⭐ RECOMMENDED

**Pricing:**
- Free: Up to 10,000 monthly active users (MAU)
- Pro: $25/month for up to 10,000 MAU, then $0.02/MAU
- Best for startups and growing apps

**Pros:**
- ✅ **Best DX**: Drop-in React components (`<SignIn>`, `<UserButton>`)
- ✅ **Built for Modern Stacks**: First-class React/Angular/Next.js support
- ✅ **Comprehensive UI**: Pre-built, customizable auth UI components
- ✅ **User Management Dashboard**: Admin panel included
- ✅ **Multi-tenancy Ready**: Organization/team support built-in
- ✅ **Webhooks**: Real-time user events for data sync
- ✅ **Session Management**: Built-in token handling, refresh
- ✅ **Analytics**: User engagement metrics included
- ✅ **Magic Links**: Passwordless auth out of the box
- ✅ **Social Logins**: Google, GitHub, Discord, etc.
- ✅ **Excellent Docs**: Best-in-class documentation

**Cons:**
- ⚠️ Newer platform (less enterprise adoption)
- ⚠️ Vendor lock-in (migration harder than standards-based solutions)

**Integration Complexity**: ⭐⭐⭐⭐⭐ (Easiest)

---

### 2. **Auth0 (Okta)**

**Pricing:**
- Free: Up to 7,500 MAU
- Essentials: $35/month + $0.05/MAU (above 500)
- Most expensive at scale

**Pros:**
- ✅ Enterprise-grade security
- ✅ Extensive customization
- ✅ Mature platform (10+ years)
- ✅ SAML, LDAP support
- ✅ Detailed audit logs

**Cons:**
- ⚠️ **Complex Setup**: Steeper learning curve
- ⚠️ **Expensive**: Higher per-user costs
- ⚠️ **Heavy**: More overhead for simple use cases
- ⚠️ **UI Customization**: Requires more effort

**Integration Complexity**: ⭐⭐⭐ (Moderate)

---

### 3. **Supabase Auth**

**Pricing:**
- Free: Unlimited users (with limits on API calls)
- Pro: $25/month (100,000 MAU included)
- Best value at scale

**Pros:**
- ✅ **Open Source**: Can self-host
- ✅ **Integrated**: Comes with database (PostgreSQL)
- ✅ **Best Value**: Lowest cost at scale
- ✅ **Row-Level Security**: Built-in data isolation
- ✅ **Real-time**: WebSocket support included
- ✅ **Storage**: File storage included

**Cons:**
- ⚠️ **Less Polished UI**: Components not as refined
- ⚠️ **Self-Management**: More setup if self-hosting
- ⚠️ **Fewer Social Providers**: Compared to Clerk/Auth0

**Integration Complexity**: ⭐⭐⭐⭐ (Easy)

---

### 4. **Firebase Authentication**

**Pricing:**
- Free: Unlimited users
- Pay-as-you-go: Based on usage (very affordable)
- No monthly fees

**Pros:**
- ✅ **Google Ecosystem**: Integrates with other Firebase services
- ✅ **Free Tier**: Generous free usage
- ✅ **Mobile SDKs**: Best mobile support
- ✅ **Reliable**: Google infrastructure

**Cons:**
- ⚠️ **Vendor Lock-in**: Tightly coupled to Firebase
- ⚠️ **Less Modern**: Older API design
- ⚠️ **Limited Customization**: UI components basic
- ⚠️ **NoSQL Only**: Firestore, not PostgreSQL

**Integration Complexity**: ⭐⭐⭐ (Moderate)

---

### 5. **NextAuth.js (Self-Hosted)**

**Pricing:**
- Free: Open source
- Cost: Server hosting only

**Pros:**
- ✅ **No Vendor Lock-in**: Full control
- ✅ **Flexible**: Highly customizable
- ✅ **Free**: No per-user costs
- ✅ **Database Agnostic**: Works with PostgreSQL

**Cons:**
- ⚠️ **Self-Managed**: You maintain security updates
- ⚠️ **More Code**: Manual implementation required
- ⚠️ **No Admin UI**: Build your own
- ⚠️ **Session Management**: Manual setup

**Integration Complexity**: ⭐⭐ (Complex)

---

## Comparison Matrix

| Feature | Clerk | Auth0 | Supabase | Firebase | NextAuth |
|---------|-------|-------|----------|----------|----------|
| **Setup Time** | 1-2 hours | 4-6 hours | 2-3 hours | 3-4 hours | 8-12 hours |
| **UI Components** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| **Documentation** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Cost (10K users)** | $25/mo | $535/mo | $25/mo | Free | Hosting only |
| **Migration Effort** | Low | Medium | Low | Medium | High |
| **Vendor Lock-in** | High | Medium | Low | High | None |
| **Enterprise Support** | Available | Excellent | Limited | Google | Community |

---

## Deep Impact Analysis

### Phase 1: Database Schema Changes

**New Tables:**
```sql
-- Users table (managed by Clerk, mirrored locally)
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Clerk user ID
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  chess_username TEXT,              -- Chess.com/Lichess username
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  subscription_tier TEXT DEFAULT 'free',
  preferences JSONB                 -- User settings
);

-- User sessions (optional, if needed)
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Modified Tables:**
```sql
-- Add user_id foreign key to existing tables
ALTER TABLE games ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE analysis ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE blunder_details ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE tournaments ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- user_puzzle_progress already has user_id, just need to add FK constraint
ALTER TABLE user_puzzle_progress ADD CONSTRAINT fk_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_games_user_id ON games(user_id);
CREATE INDEX idx_analysis_user_id ON analysis(user_id);
CREATE INDEX idx_blunders_user_id ON blunder_details(user_id);
CREATE INDEX idx_tournaments_user_id ON tournaments(user_id);
```

**Data Migration:**
```sql
-- Migrate existing data to a default user
INSERT INTO users (id, email, username, display_name)
VALUES ('default_user', 'advait@example.com', 'AdvaitKumar1213', 'Advait Kumar');

UPDATE games SET user_id = 'default_user' WHERE user_id IS NULL;
UPDATE analysis SET user_id = 'default_user' WHERE user_id IS NULL;
UPDATE blunder_details SET user_id = 'default_user' WHERE user_id IS NULL;
UPDATE tournaments SET user_id = 'default_user' WHERE user_id IS NULL;
```

---

### Phase 2: Backend API Changes

**Affected Files:**

1. **`src/api/api-server.js`** (25+ endpoints)
   - Add authentication middleware
   - Extract `user_id` from Clerk session
   - Add to all database queries

2. **`src/models/database.js`**
   - Remove hardcoded `TARGET_PLAYER`
   - Accept `user_id` parameter in all methods
   - Add user validation

3. **`src/models/performance-stats.js`**
   - Filter by `user_id` in all queries
   - User-specific caching

4. **`src/models/puzzle-progress-tracker.js`**
   - Already uses `user_id`, just validate

5. **`src/models/learning-path-generator.js`**
   - Filter recommendations by `user_id`

**Authentication Middleware Example (Clerk):**
```javascript
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Protect all API routes
app.use('/api/*', ClerkExpressRequireAuth());

// Extract user_id from authenticated session
app.use('/api/*', (req, res, next) => {
  req.userId = req.auth.userId; // Clerk provides this
  next();
});

// Updated endpoint example
app.get('/api/performance', async (req, res) => {
  const userId = req.userId; // From auth middleware
  const stats = await performanceStats.getStats(userId);
  res.json(stats);
});
```

**API Endpoint Changes:**
```javascript
// Before (hardcoded user)
GET /api/blunders → Returns all blunders for AdvaitKumar1213

// After (authenticated user)
GET /api/blunders
Headers: { Authorization: Bearer <clerk-token> }
→ Returns blunders for authenticated user only
```

---

### Phase 3: Frontend Changes

**Angular Integration (Clerk):**

1. **Install Clerk SDK:**
```bash
npm install @clerk/clerk-angular
```

2. **App Configuration:**
```typescript
// src/app/app.config.ts
import { provideClerk } from '@clerk/clerk-angular';

export const appConfig = {
  providers: [
    provideClerk({
      publishableKey: environment.clerkPublishableKey
    })
  ]
};
```

3. **Protected Routes:**
```typescript
// src/app/app.routes.ts
import { ClerkAuthGuard } from '@clerk/clerk-angular';

export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    canActivate: [ClerkAuthGuard]  // Protect route
  },
  { path: 'sign-in', component: SignInComponent },
  { path: 'sign-up', component: SignUpComponent }
];
```

4. **Layout Component Updates:**
```typescript
// src/app/components/layout/layout.component.ts
import { ClerkService } from '@clerk/clerk-angular';

export class LayoutComponent {
  user$ = this.clerk.user$;

  constructor(private clerk: ClerkService) {}

  signOut() {
    this.clerk.signOut();
  }
}
```

```html
<!-- Add user menu -->
<div *ngIf="user$ | async as user" class="flex items-center gap-3">
  <img [src]="user.imageUrl" class="w-8 h-8 rounded-full">
  <span>{{ user.firstName }}</span>
  <button (click)="signOut()">Sign Out</button>
</div>
```

5. **HTTP Interceptor for Auth Token:**
```typescript
// src/app/services/auth.interceptor.ts
import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { ClerkService } from '@clerk/clerk-angular';
import { switchMap } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const clerk = inject(ClerkService);

  return clerk.session$.pipe(
    switchMap(session => {
      const token = session?.getToken();
      const authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
      return next(authReq);
    })
  );
};
```

---

### Phase 4: File Upload & PGN Processing

**Challenge**: Users need to associate uploaded PGNs with their account.

**Solution:**
```javascript
// src/api/api-server.js
app.post('/api/upload', upload.single('pgn'), async (req, res) => {
  const userId = req.userId; // From auth middleware
  const file = req.file;

  // Parse PGN
  const games = await PGNParser.parse(file.path);

  // Associate with user
  for (const game of games) {
    await db.insertGame({
      ...game,
      user_id: userId  // Link to authenticated user
    });
  }

  res.json({ success: true, gamesImported: games.length });
});
```

**Auto-Detect Player:**
```javascript
// Infer which player in the PGN is the current user
function detectUserPlayer(game, userProfile) {
  if (game.white === userProfile.chess_username) return 'white';
  if (game.black === userProfile.chess_username) return 'black';

  // Prompt user to select
  return null;
}
```

---

### Phase 5: Data Isolation & Security

**Row-Level Security (PostgreSQL):**
```sql
-- Enable RLS on all user tables
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE blunder_details ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY user_games_policy ON games
  FOR SELECT USING (user_id = current_setting('app.user_id'));

CREATE POLICY user_analysis_policy ON analysis
  FOR SELECT USING (user_id = current_setting('app.user_id'));
```

**Application-Level Filtering:**
```javascript
// Every query must filter by user_id
async getGames(userId) {
  return await db.all(
    'SELECT * FROM games WHERE user_id = ?',
    [userId]
  );
}

// Prevent accidental leaks
async getGameById(gameId, userId) {
  const game = await db.get(
    'SELECT * FROM games WHERE id = ? AND user_id = ?',
    [gameId, userId]
  );

  if (!game) {
    throw new Error('Game not found or unauthorized');
  }

  return game;
}
```

---

## Implementation Roadmap

### **Phase 1: Foundation (Week 1-2)**
- [ ] Set up Clerk account and project
- [ ] Install Clerk SDK (backend + frontend)
- [ ] Create users table migration
- [ ] Add auth middleware to Express
- [ ] Add HTTP interceptor to Angular

### **Phase 2: Database Migration (Week 2-3)**
- [ ] Add user_id columns to all tables
- [ ] Create migration for existing data
- [ ] Add foreign key constraints
- [ ] Add indexes for performance
- [ ] Test data isolation

### **Phase 3: Backend Refactoring (Week 3-4)**
- [ ] Update all API endpoints to accept user_id
- [ ] Remove TARGET_PLAYER hardcoding
- [ ] Add user validation to all queries
- [ ] Update tests with authentication
- [ ] Deploy to staging

### **Phase 4: Frontend Integration (Week 4-5)**
- [ ] Add sign-in/sign-up pages
- [ ] Add protected route guards
- [ ] Add user profile dropdown
- [ ] Update all API calls to include auth
- [ ] Test authenticated flows

### **Phase 5: User Onboarding (Week 5-6)**
- [ ] Chess username setup flow
- [ ] Import existing games wizard
- [ ] User preferences page
- [ ] Email notifications setup
- [ ] Deploy to production

---

## Cost Analysis (Yearly)

### Scenario: 1,000 active users

| Provider | Monthly Cost | Annual Cost | Notes |
|----------|-------------|-------------|-------|
| **Clerk** | $25 | **$300** | Best value for < 10K users |
| Auth0 | $285 | $3,420 | Expensive at scale |
| Supabase | $25 | $300 | Same as Clerk |
| Firebase | $0 | $0 | Free tier sufficient |
| NextAuth | $15 | $180 | VPS hosting only |

### Scenario: 10,000 active users

| Provider | Monthly Cost | Annual Cost |
|----------|-------------|-------------|
| **Clerk** | $25 | **$300** (still in free tier) |
| Auth0 | $510 | $6,120 |
| Supabase | $25 | $300 |
| Firebase | $50 | $600 |
| NextAuth | $30 | $360 |

**Winner: Clerk (Best ROI for 0-10K users)**

---

## Migration Risks & Mitigation

### Risk 1: Existing Data Loss
**Mitigation:**
- Full database backup before migration
- Test migration on staging database first
- Rollback plan documented
- Data verification scripts

### Risk 2: Breaking Changes for Current User
**Mitigation:**
- Create default user account for existing data
- Grandfather existing user with email access
- Provide import script for historical data

### Risk 3: API Downtime During Migration
**Mitigation:**
- Blue-green deployment
- Feature flags for auth (gradual rollout)
- Backward compatibility layer
- Monitoring and alerting

### Risk 4: Third-Party Service Outage
**Mitigation:**
- Clerk has 99.9% uptime SLA
- Implement graceful degradation
- Cache authentication tokens
- Fallback to read-only mode

---

## Success Metrics

**Implementation Success:**
- [ ] 100% of endpoints require authentication
- [ ] Zero cross-user data leaks (security audit)
- [ ] < 2% auth failure rate
- [ ] Sign-up flow < 30 seconds

**Business Success:**
- [ ] 10+ users sign up in first month
- [ ] < 5% sign-up abandonment rate
- [ ] User retention > 40% after 30 days
- [ ] NPS score > 50

---

## Recommendation

**Choose Clerk for ChessPulse** because:

1. **Fastest Time-to-Market**: 1-2 hours to working auth
2. **Best Developer Experience**: Drop-in components, excellent docs
3. **Cost-Effective**: Free up to 10K users (perfect for early stage)
4. **Modern Stack**: Built for React/Angular/Next.js
5. **Feature-Rich**: User management, webhooks, analytics included
6. **Scalable**: Easy to scale to 100K+ users later

**Alternative Recommendation**: If you prioritize open-source and database integration, choose **Supabase**.

---

## References

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Angular SDK](https://clerk.com/docs/references/angular/overview)
- [Auth0 vs Clerk Comparison](https://clerk.com/blog/auth0-alternative)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

## Appendix A: Code Examples

### Clerk Backend Setup (Express)

```javascript
// src/api/api-server.js
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { clerkClient } = require('@clerk/clerk-sdk-node');

// Initialize Clerk
const clerk = clerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Auth middleware
app.use('/api/*', ClerkExpressRequireAuth());

// Extract user
app.use('/api/*', async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const user = await clerk.users.getUser(userId);

    // Sync user to local database
    await db.upsertUser({
      id: user.id,
      email: user.emailAddresses[0].emailAddress,
      username: user.username,
      display_name: `${user.firstName} ${user.lastName}`,
      avatar_url: user.imageUrl
    });

    req.userId = userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});
```

### Clerk Frontend Setup (Angular)

```typescript
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideClerk } from '@clerk/clerk-angular';
import { authInterceptor } from './services/auth.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideClerk({
      publishableKey: 'pk_test_...',
      appearance: {
        elements: {
          rootBox: 'mx-auto',
          card: 'bg-white shadow-lg rounded-lg'
        }
      }
    })
  ]
};
```

```typescript
// src/app/pages/sign-in/sign-in.component.ts
import { Component } from '@angular/core';
import { SignInComponent as ClerkSignIn } from '@clerk/clerk-angular';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [ClerkSignIn],
  template: `
    <div class="flex min-h-screen items-center justify-center">
      <clerk-sign-in
        [routing]="'path'"
        [path]="'/sign-in'">
      </clerk-sign-in>
    </div>
  `
})
export class SignInPageComponent {}
```

---

## Appendix B: Migration Script

```sql
-- Migration 017: Add User Authentication Support
-- Run this migration to add user_id columns and constraints

BEGIN TRANSACTION;

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  chess_username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  subscription_tier TEXT DEFAULT 'free',
  preferences TEXT
);

-- 2. Create default user for existing data
INSERT INTO users (id, email, username, display_name)
VALUES ('default_user', 'advait@chesspulse.com', 'AdvaitKumar1213', 'Advait Kumar')
ON CONFLICT (id) DO NOTHING;

-- 3. Add user_id columns to existing tables
ALTER TABLE games ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default_user';
ALTER TABLE analysis ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default_user';
ALTER TABLE blunder_details ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default_user';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default_user';

-- 4. Update existing rows
UPDATE games SET user_id = 'default_user' WHERE user_id IS NULL;
UPDATE analysis SET user_id = 'default_user' WHERE user_id IS NULL;
UPDATE blunder_details SET user_id = 'default_user' WHERE user_id IS NULL;
UPDATE tournaments SET user_id = 'default_user' WHERE user_id IS NULL;

-- 5. Add foreign key constraints
ALTER TABLE games ADD CONSTRAINT fk_games_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE analysis ADD CONSTRAINT fk_analysis_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE blunder_details ADD CONSTRAINT fk_blunder_details_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE tournaments ADD CONSTRAINT fk_tournaments_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_user_id ON analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_blunders_user_id ON blunder_details(user_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_user_id ON tournaments(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

COMMIT;
```

---

**End of ADR-004**
