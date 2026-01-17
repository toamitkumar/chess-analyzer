# ADR 007: Lichess Game Detail Page Layout Alignment

## Status
In Progress

## Context
The game-detail-v2 page needs to be redesigned to match the Lichess analysis page layout (https://lichess.org/ZgJZ9lXt) for a familiar and intuitive user experience.

## Reference
- Lichess game example: https://lichess.org/ZgJZ9lXt
- Current component: `frontend/src/app/pages/game-detail-v2/game-detail-v2.component.ts`

## Lichess Layout Analysis

### Three-Column Layout
1. **Left Panel (~200px)** - Game Information
   - Time control icon + "20+10 • Rated • Classical"
   - Date ("1 year ago")
   - Players section:
     - White: circle icon + username + rating + result score
     - Black: circle icon + username + rating + result score
   - Result text: "Black resigned • White is victorious"
   - Opening/Tournament link
   - Spectator room / Notes tabs (optional)

2. **Center Panel (flexible)** - Chess Board
   - Top player name bar
   - Eval bar (vertical, LEFT side of board)
   - Chess board with coordinates
   - Bottom player name bar
   - Clock displays (if applicable)

3. **Right Panel (~340px)** - Analysis
   - Engine header: eval + "SF 17.1 • 7MB v2 NNUE" + depth
   - Move list table:
     - Move number | White move + eval | Black move + eval
     - Colored annotations: red (??), orange (?), cyan (?!)
     - Inline annotation rows: "Mistake. e6 was best."
     - Alternative continuation lines in gray
   - Game result at end: "1-0" + "Black resigned • White is victorious"
   - Navigation controls row
   - Player statistics:
     - Per player: Inaccuracies, Mistakes, Blunders, ACPL, Accuracy %

### Color Scheme (Lichess Dark Theme)
- Background: #161512
- Card/Panel: #262421
- Border: #3d3a37
- Text: #bababa
- Text dim: #8a8a8a
- Inaccuracy: #56b4e9 (cyan)
- Mistake: #e69f00 (orange)
- Blunder: #db3434 (red)
- Current move highlight: #3692e7 (blue)
- Accuracy green: #63b553

## Implementation Tasks

### Phase 1: Layout Structure - COMPLETED
- [x] Restructure to 3-column grid layout (Left | Center | Right)
- [x] Add left panel with game info card
- [x] Move eval bar to LEFT side of board
- [x] Update board section with player name bars

### Phase 2: Left Panel - Game Info - COMPLETED
- [x] Time control with badge
- [x] Relative date display
- [x] Player rows with circle icons, names, ratings, scores
- [x] Result text section
- [x] Opening name link

### Phase 3: Move List (Lichess Style)
- [ ] Update move table styling
- [ ] Add NAG symbols (?, ??, ?!) after moves
- [ ] Colored move annotations
- [ ] Inline annotation rows with best move suggestions
- [ ] Game result row at bottom of move list

### Phase 4: Player Statistics Panel
- [ ] Per-player stats block
- [ ] Inaccuracies count (cyan)
- [ ] Mistakes count (orange)
- [ ] Blunders count (red)
- [ ] Average centipawn loss
- [ ] Accuracy percentage (green)

### Phase 5: Styling & Polish
- [ ] Apply Lichess dark theme colors
- [ ] Navigation controls styling
- [ ] Responsive breakpoints (hide left panel on smaller screens)
- [ ] Smooth transitions and hover states

## Acceptance Criteria
- [ ] Layout matches Lichess 3-column structure
- [ ] Eval bar on left side of board
- [ ] Move list shows evaluations and colored annotations
- [ ] Player stats show all metrics (inaccuracies, mistakes, blunders, ACPL, accuracy)
- [ ] Responsive design works on tablet/mobile
- [ ] Keyboard navigation still works (arrow keys, Home, End, F)

## Files to Modify
- `frontend/src/app/pages/game-detail-v2/game-detail-v2.component.ts`

## Notes
- Keep existing functionality (move navigation, board flipping, keyboard shortcuts)
- Maintain API compatibility with existing ChessApiService
- Reference Lichess for exact spacing, colors, and typography
