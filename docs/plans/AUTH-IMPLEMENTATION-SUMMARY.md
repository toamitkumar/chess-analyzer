# Authentication Implementation - Quick Reference

**Full Documentation**: See [ADR-004-Authentication-Implementation.md](./ADR-004-Authentication-Implementation.md)

---

## TL;DR: Recommendation

**Use Clerk (clerk.com)** for ChessPulse authentication.

**Why:**
- ✅ Fastest implementation (1-2 hours to working auth)
- ✅ Free up to 10,000 users ($25/month after)
- ✅ Drop-in Angular components
- ✅ Best developer experience
- ✅ Built-in user management dashboard

---

## Quick Comparison

| Provider | Cost (10K users) | Setup Time | DX Score | Recommendation |
|----------|-----------------|------------|----------|----------------|
| **Clerk** | **$25/mo** | **1-2 hrs** | ⭐⭐⭐⭐⭐ | **Best Choice** |
| Supabase | $25/mo | 2-3 hrs | ⭐⭐⭐⭐ | Good Alternative |
| Auth0 | $535/mo | 4-6 hrs | ⭐⭐⭐ | Too Expensive |
| Firebase | Free | 3-4 hrs | ⭐⭐⭐ | Vendor Lock-in |
| NextAuth | $15/mo | 8-12 hrs | ⭐⭐ | Too Much Work |

---

## Implementation Checklist

### Week 1-2: Foundation
- [ ] Create Clerk account at https://clerk.com
- [ ] Install: `npm install @clerk/clerk-sdk-node @clerk/clerk-angular`
- [ ] Add environment variables (`.env`):
  ```
  CLERK_SECRET_KEY=sk_test_...
  CLERK_PUBLISHABLE_KEY=pk_test_...
  ```
- [ ] Add auth middleware to Express (see ADR-004, Appendix A)
- [ ] Add HTTP interceptor to Angular (see ADR-004, Appendix A)

### Week 2-3: Database
- [ ] Run migration script (see ADR-004, Appendix B)
- [ ] Test data isolation
- [ ] Verify indexes created

### Week 3-4: Backend
- [ ] Update all API endpoints to use `req.userId`
- [ ] Remove `TARGET_PLAYER` from `app-config.js`
- [ ] Add user validation to queries
- [ ] Test with multiple users

### Week 4-5: Frontend
- [ ] Add sign-in/sign-up pages
- [ ] Add route guards
- [ ] Add user profile menu
- [ ] Test authenticated flows

### Week 5-6: Launch
- [ ] User onboarding flow
- [ ] Import existing games wizard
- [ ] Deploy to production
- [ ] Monitor error rates

---

## Critical Database Changes

**Tables Requiring `user_id` Column:**
1. `games` - User's uploaded games
2. `game_analysis` - Analysis results
3. `blunder_details` - User's blunders
4. `tournaments` - User's tournament data
5. `user_puzzle_progress` - Already has user_id ✅
6. `theme_mastery` - Already has user_id ✅

**Migration SQL:**
```sql
-- See ADR-004 Appendix B for full migration script
ALTER TABLE games ADD COLUMN user_id TEXT DEFAULT 'default_user';
ALTER TABLE games ADD CONSTRAINT fk_games_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

---

## Code Snippets

### Backend: Protect API Routes
```javascript
// src/api/api-server.js
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

app.use('/api/*', ClerkExpressRequireAuth());
app.use('/api/*', (req, res, next) => {
  req.userId = req.auth.userId;
  next();
});
```

### Frontend: Add Sign-In Component
```typescript
// src/app/pages/sign-in/sign-in.component.ts
import { SignInComponent as ClerkSignIn } from '@clerk/clerk-angular';

@Component({
  template: `<clerk-sign-in></clerk-sign-in>`
})
export class SignInPageComponent {}
```

### Frontend: Protect Routes
```typescript
// src/app/app.routes.ts
import { ClerkAuthGuard } from '@clerk/clerk-angular';

export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    canActivate: [ClerkAuthGuard]
  }
];
```

---

## Cost Breakdown

**Year 1 (1,000 users):**
- Clerk: $300/year
- Server: $180/year (Railway)
- **Total: $480/year**

**Year 2 (10,000 users):**
- Clerk: $300/year (still in free tier!)
- Server: $360/year
- **Total: $660/year**

**Break-even**: Clerk is free until 10,000 monthly active users.

---

## Risk Mitigation

**Top 3 Risks:**
1. **Data Loss During Migration**
   - Mitigation: Full backup + test migration on staging first

2. **Breaking Existing User**
   - Mitigation: Create default user account with grandfathered access

3. **Clerk Service Outage**
   - Mitigation: 99.9% SLA + graceful degradation to read-only mode

---

## Timeline

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 1-2 | Setup | Auth working on staging |
| 2-3 | Database | Migration tested |
| 3-4 | Backend | All endpoints protected |
| 4-5 | Frontend | Sign-in flow complete |
| 5-6 | Launch | Production deployment |

**Total Time: 6 weeks**

---

## Success Metrics

**Technical:**
- [ ] 100% of API endpoints require auth
- [ ] Zero cross-user data leaks
- [ ] < 2% auth failure rate

**Business:**
- [ ] 10+ users sign up in first month
- [ ] < 5% sign-up abandonment
- [ ] 40%+ user retention after 30 days

---

## Next Steps

1. **Read Full ADR**: [ADR-004-Authentication-Implementation.md](./ADR-004-Authentication-Implementation.md)
2. **Create Clerk Account**: https://clerk.com
3. **Review Code Examples**: See Appendix A in ADR-004
4. **Plan Migration**: See Appendix B in ADR-004
5. **Create GitHub Issue**: Track implementation progress

---

## Questions?

- **Clerk Documentation**: https://clerk.com/docs
- **Clerk Angular SDK**: https://clerk.com/docs/references/angular/overview
- **Support**: Clerk has excellent Discord community

---

**Last Updated**: 2025-12-19
**Author**: Engineering Team
**Status**: Proposed (Awaiting Approval)
