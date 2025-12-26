# ADR 001: Add user_color Field to Games Table

**Status:** Implemented
**Date:** 2025-12-25
**Updated:** 2025-12-26
**Decision Makers:** Development Team
**Related Issue:** #101, #99

## Context

The chess analysis platform allows users to upload PGN files for analysis. Each game has two players (white and black), and we need to determine which player/color the current user played to calculate accurate statistics like win/loss rates, accuracy by color, and performance trends.

### Current State

**Database Schema:**
```sql
games table:
  - user_id: TEXT        -- SaaS authentication ID (e.g., 'clerk_user_abc')
  - white_player: TEXT   -- Chess player name from PGN (e.g., 'AdvaitKumar1213')
  - black_player: TEXT   -- Opponent name from PGN (e.g., 'Opponent123')
  - ... other fields
```

**Current Problem:**
When analyzing games, we need to determine which color the user played. Current approaches:

1. **Chess Username Lookup (Current Implementation):**
   - User configures `chess_username` in their profile
   - At query time, look up user's `chess_username` from users table
   - Compare `chess_username` against `white_player` and `black_player`
   - Whichever matches indicates the user's color

   **Issues:**
   - Requires database lookup on every query
   - Assumes player name in PGN exactly matches configured chess_username
   - Fails if user has multiple chess usernames (chess.com vs lichess)
   - Fails if PGN uses different name format (e.g., "Kumar, Advait" vs "AdvaitKumar1213")

2. **TARGET_PLAYER Configuration (Legacy):**
   - Hardcoded player name in config
   - Not suitable for multi-user platform

### User Interaction Flow

**PGN File Structure:**
```pgn
[Event "Tournament Name"]
[White "Tanpure, Arnav Mahesh"]
[Black "AdvaitKumar1213"]
[Result "1/2-1/2"]
...
```

The PGN explicitly captures which player played which color.

## Decision

**Add a `user_color` column to the games table** to store which color the authenticated user played in each game.

```sql
ALTER TABLE games ADD COLUMN user_color TEXT CHECK(user_color IN ('white', 'black'));
```

### How user_color is Determined

**For Manual Entry:**
- User interface already asks user to specify which color they played
- Store this directly in `user_color` field

**For Bulk PGN Upload:**
- **MVP Approach (Simple):** User selects color for the entire batch
  ```
  Upload UI:
  [Choose Files...] (10 files selected)
  In these games, I played: ○ White  ● Black
  [Upload]
  ```
  - All games in batch get the same `user_color` value
  - Simple, fast for typical use cases (users usually upload games from one side)

- **Future Enhancement (Smart):** Auto-detect with preview
  ```
  1. User optionally configures chess_username in profile
  2. System auto-detects color by matching chess_username against PGN players
  3. Shows preview table for user confirmation
  4. User can override incorrect detections
  5. Upload with confirmed colors
  ```

## Consequences

### Positive

1. **Performance:** No database lookups needed during analysis queries
2. **Accuracy:** User explicitly confirms which color they played
3. **Flexibility:** Works regardless of how player names are formatted in PGN
4. **Simplicity:** Direct storage, no string matching logic
5. **Auditability:** Clear record of user's color in each game
6. **Handles Edge Cases:** Works even if user changes chess_username later

### Negative

1. **Schema Change:** Requires database migration
2. **Manual Work:** For bulk uploads without auto-detection, user must select color
3. **Data Entry Error:** User could theoretically select wrong color
4. **Backfill Required:** Existing games need `user_color` populated (can be nullable initially)

### Neutral

1. **Frontend Changes:** Upload UI needs to include color selection
2. **Backward Compatibility:** Nullable column allows gradual migration

## Follow-Up Decision: Frontend Refactoring (2025-12-26)

### Context

After implementing the `user_color` field in the database (migration 017, commit 8d0bc28), the frontend components still used the legacy approach of comparing player names against `chess_username` to determine:
- Which side the user played (white/black)
- Whether a game result was a win or loss from the user's perspective
- Who the opponent was

This created unnecessary coupling between:
- Frontend logic and authentication metadata (`chess_username`)
- Frontend and player name string matching
- User profile configuration requirements (forcing users to set `chess_username`)

### Decision: Use user_color Directly in Frontend

**Eliminate player name comparison entirely** and use the `user_color` field from the database in frontend components.

### Implementation

**Files Updated (Commit e493747):**

1. **games.component.ts:**
   ```typescript
   // BEFORE: String comparison with targetPlayer
   playerColor: (game.white_player === this.targetPlayer ? 'white' : 'black')

   // AFTER: Direct field access
   playerColor: game.user_color
   ```
   - Removed `targetPlayer` getter
   - Simplified game processing logic

2. **game-detail.component.ts:**
   ```typescript
   // BEFORE: Name matching to determine win/loss
   if (this.gameData.result === '1-0') {
     return this.gameData.white_player === this.apiService.targetPlayer ? 'Win' : 'Loss';
   }

   // AFTER: Color + result logic
   const userWon = (this.gameData.user_color === 'white' && this.gameData.result === '1-0') ||
                   (this.gameData.user_color === 'black' && this.gameData.result === '0-1');
   if (userWon) return 'Win';
   ```
   - `getResultBadgeClass()`: Use user_color to show green (win) or red (loss) badge
   - `getResultText()`: Return "Win"/"Loss"/"Draw" from user's perspective

3. **tournament-detail.component.ts:**
   ```typescript
   // BEFORE: Name matching to find opponent
   const isPlayerWhite = game.white_player === targetPlayer;
   const opponent = isPlayerWhite ? game.black_player : game.white_player;

   // AFTER: Color-based opponent detection
   const opponent = game.user_color === 'white' ? game.black_player : game.white_player;
   ```

4. **chess-api.service.ts:**
   - Completely removed `targetPlayer` getter
   - Removed `AuthService` dependency (no longer needed)
   - Service is now simpler with fewer dependencies

### Benefits of Frontend Refactoring

**User Experience:**
1. **No chess_username required** - Users can sign up and use the app immediately
2. **No configuration burden** - One less field to fill in profile
3. **More reliable** - No risk of typos or case sensitivity issues in username

**Code Quality:**
1. **Simpler logic** - Direct field access vs. string matching
2. **Fewer dependencies** - No coupling to authentication metadata
3. **Better separation of concerns** - Player names only used for display, not logic
4. **More maintainable** - Clearer intent, easier to understand

**Robustness:**
1. **Immune to name format changes** - PGN files can have different name formats
2. **Handles multiple platforms** - Works regardless of chess.com vs lichess usernames
3. **Survives profile changes** - User can change username without breaking historical data
4. **Single source of truth** - `user_color` set once at upload time

### Why This Decision Was Important

**Preventing Future Technical Debt:**

If we had kept the player name comparison approach:
1. **Support burden:** Users would report issues when names don't match (typos, different formats)
2. **Migration pain:** Later migration to user_color would require updating many components
3. **Feature limitations:** Features requiring color-based filtering would need duplicate logic
4. **Testing complexity:** Every component would need to mock chess_username

**Alignment with Database Design:**

The `user_color` field exists in the database specifically to avoid player name matching. Not using it in the frontend would contradict the architectural decision documented in this ADR.

### Alternative Considered: Keep chess_username Comparison

**Rejected because:**
- Requires users to configure chess_username (poor onboarding UX)
- Error-prone (string matching fragility)
- Redundant (user_color already provides this information)
- Couples frontend to authentication metadata
- Contradicts the purpose of adding user_color field

### Lessons Learned

1. **Complete the abstraction:** When adding a database field to abstract away logic, ensure all layers of the application use it
2. **Frontend-backend alignment:** Backend architectural decisions (user_color field) should be reflected in frontend implementation
3. **User-facing fields vs. system fields:** chess_username is optional user-facing metadata; user_color is required system data for correct operation

## Implementation Plan

### Phase 1: Database Migration ✅ COMPLETED
- [x] Create migration to add `user_color TEXT` column (nullable initially) - Migration 017
- [x] Run migration on test database
- [x] Run migration on production database

### Phase 2: Backend Changes ✅ COMPLETED
- [x] Update `database.insertGame()` to accept and store `user_color` - Commit 8d0bc28
- [x] Update `PGNUploadService` to accept `user_color` parameter
- [x] Update upload controllers to pass `user_color` from request
- [x] Update tournament-analyzer queries to use `user_color` instead of player name matching
- [x] Update tournament-manager queries to use `user_color`
- [x] Update game controller queries to use `user_color`
- [x] Remove chess_username lookup logic (or keep as optional feature)

### Phase 3: Frontend Changes ✅ COMPLETED
**Manual Entry:**
- [x] Already has color selection (no changes needed)

**Bulk Upload:**
- [x] Add radio button group: "I played: ○ White ● Black"
- [x] Pass selected color to backend API
- [x] Show validation error if color not selected

**Component Refactoring (Commit e493747):**
- [x] Update games.component.ts to use user_color
- [x] Update game-detail.component.ts to use user_color
- [x] Update tournament-detail.component.ts to use user_color
- [x] Remove targetPlayer from chess-api.service.ts

### Phase 4: Testing ✅ COMPLETED
- [x] Update all test fixtures to include `user_color`
- [x] Update controller tests
- [x] Update model tests
- [x] Update integration tests
- [x] Test bulk upload with mixed colors

### Phase 5: Data Backfill (Optional) - NOT NEEDED
For existing games without `user_color`:
- ✅ **Chosen Option:** Leave as NULL initially, user_color required for all new uploads
- Games uploaded after migration 017 automatically include user_color
- No backfill needed as this is a new feature for multi-user support

## Alternatives Considered

### Alternative 1: Keep Chess Username Lookup
**Pros:**
- No user interaction required
- Automatic color detection

**Cons:**
- Performance overhead on every query
- Fragile (depends on exact name matching)
- Doesn't handle multiple usernames or name format variations

**Decision:** Rejected due to fragility and performance concerns

### Alternative 2: Separate user_games Junction Table
**Schema:**
```sql
user_games:
  - user_id
  - game_id
  - color
  - role (player/observer)
```

**Pros:**
- More flexible (supports multiple users per game)
- Normalized design

**Cons:**
- Over-engineered for current use case
- Adds query complexity (JOIN required)
- Current use case: one user per game

**Decision:** Rejected as over-engineered for MVP

### Alternative 3: Store in User Profile
Store mapping of games to colors in user's profile JSON field

**Cons:**
- Denormalized
- Harder to query
- Doesn't scale

**Decision:** Rejected

## References

### GitHub Issues
- Related Issue: [#101](https://github.com/toamitkumar/chess-analyzer/issues/101) - User color separation
- Related Issue: [#99](https://github.com/toamitkumar/chess-analyzer/issues/99) - Complete user_id separation

### Code References
- Database Schema: `src/models/database.js`
- Migration: `src/models/migrations/017_add_user_color.js`
- Upload Flow: `src/api/controllers/upload.controller.js`
- PGN Service: `src/services/PGNUploadService.js`
- Frontend Components:
  - `frontend/src/app/pages/games/games.component.ts`
  - `frontend/src/app/pages/game-detail/game-detail.component.ts`
  - `frontend/src/app/pages/tournament-detail/tournament-detail.component.ts`
  - `frontend/src/app/services/chess-api.service.ts`

### Git Commits
- **8d0bc28** - feat: Complete user_id separation and implement Stockfish singleton pattern (#99)
  - Added migration 017 for user_color field
  - Updated backend to use user_color in queries
  - Updated accuracy calculator to use user_color

- **e493747** - refactor: Replace player name comparison with user_color field
  - Removed all player name comparisons from frontend
  - Updated components to use user_color directly
  - Eliminated chess_username requirement
  - Removed targetPlayer from chess-api.service.ts

## Notes

- This decision was made after attempting chess_username lookup approach
- User feedback indicated preference for explicit color selection over automatic detection
- MVP focuses on simplicity; auto-detection can be added as enhancement later
- **Critical lesson:** Frontend refactoring (commit e493747) was essential to prevent technical debt and align with database design
- The `user_color` field is now the single source of truth for determining which side the user played
