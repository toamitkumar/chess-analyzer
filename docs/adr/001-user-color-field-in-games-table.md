# ADR 001: Add user_color Field to Games Table

**Status:** Proposed
**Date:** 2025-12-25
**Decision Makers:** Development Team
**Related Issue:** #101

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

## Implementation Plan

### Phase 1: Database Migration
- [ ] Create migration to add `user_color TEXT` column (nullable initially)
- [ ] Run migration on test database
- [ ] Run migration on production database

### Phase 2: Backend Changes
- [ ] Update `database.insertGame()` to accept and store `user_color`
- [ ] Update `PGNUploadService` to accept `user_color` parameter
- [ ] Update upload controllers to pass `user_color` from request
- [ ] Update tournament-analyzer queries to use `user_color` instead of player name matching
- [ ] Update tournament-manager queries to use `user_color`
- [ ] Update game controller queries to use `user_color`
- [ ] Remove chess_username lookup logic (or keep as optional feature)

### Phase 3: Frontend Changes
**Manual Entry:**
- Already has color selection (no changes needed)

**Bulk Upload:**
- Add radio button group: "I played: ○ White ● Black"
- Pass selected color to backend API
- Show validation error if color not selected

### Phase 4: Testing
- [ ] Update all test fixtures to include `user_color`
- [ ] Update controller tests
- [ ] Update model tests
- [ ] Update integration tests
- [ ] Test bulk upload with mixed colors

### Phase 5: Data Backfill (Optional)
For existing games without `user_color`:
- Option A: Run backfill script using chess_username matching
- Option B: Leave as NULL, exclude from stats until user re-uploads
- Option C: Provide UI for user to retroactively set colors

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

- Related GitHub Issue: [#101](https://github.com/toamitkumar/chess-analyzer/issues/101)
- Database Schema: `src/models/database.js`
- Upload Flow: `src/api/controllers/upload.controller.js`
- PGN Service: `src/services/PGNUploadService.js`

## Notes

- This decision was made after attempting chess_username lookup approach
- User feedback indicated preference for explicit color selection over automatic detection
- MVP focuses on simplicity; auto-detection can be added as enhancement later
