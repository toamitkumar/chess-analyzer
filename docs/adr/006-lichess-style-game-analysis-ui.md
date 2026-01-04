# ADR 006: Lichess-Style Game Analysis UI

**Status:** Proposed
**Date:** 2025-01-04
**Decision Makers:** Development Team
**Related Issue:** TBD

## Context

The current game details page displays analysis data but lacks the intuitive, industry-standard visual language that chess players expect. Lichess and Chess.com have established UX patterns that players are familiar with, making analysis results immediately understandable.

### Current State

**Current UI Issues:**
1. Move quality indicators are text-based, not symbolic
2. Annotations require expanding a separate section
3. No visual indicators on the chess board itself
4. Best move suggestions not immediately visible
5. Move list doesn't show inline analysis

### Reference Design (Lichess)

Based on Lichess game analysis interface:

**Board Features:**
- Move quality symbols (?!, ??, ?) displayed directly on moved pieces
- Arrows showing better moves (e.g., purple arrow from current to best square)
- Clean coordinate display (a-h, 1-8)

**Move List Features:**
- Inline annotations with colored backgrounds
- "Inaccuracy. Ne8 was best." shown immediately after the move
- Best continuation line displayed below annotations
- Compact format with multiple moves per line

**Evaluation Display:**
- Simple centipawn format (+1.0, -0.5, 0.0)
- Engine info (SF 17.1, Depth 23)
- Green checkmark for analyzed positions

## Decision

**Adopt Lichess-style move quality symbols and inline annotations** for the game analysis UI.

### 1. Move Quality Symbols

Standard chess annotation symbols used universally:

| Symbol | Quality | Color | Background | Description |
|--------|---------|-------|------------|-------------|
| `!!` | Best | Green | `#4caf50` | Engine's top choice |
| `!` | Excellent | Light Green | `#8bc34a` | Strong move, among the best |
| `+` | Good | Blue | `#2196f3` | Solid move, minor inaccuracy |
| `?!` | Inaccuracy | Yellow | `#ffeb3b` | Suboptimal but not losing |
| `?` | Mistake | Orange | `#ff9800` | Clear error, loses advantage |
| `??` | Blunder | Red | `#f44336` | Serious error, loses material/game |

### 2. Board Annotations

```typescript
interface BoardAnnotation {
  square: string;           // e.g., "e4"
  symbol: string;           // "!!", "!", "?!", "?", "??"
  color: string;            // Symbol color
  backgroundColor: string;  // Circle/badge background
}

interface BestMoveArrow {
  from: string;             // e.g., "c4"
  to: string;               // e.g., "d5"
  color: string;            // Arrow color (purple for best move)
  opacity: number;          // 0.7 for suggestions
}
```

**Implementation with Chessground:**
```typescript
// Draw move quality symbol on piece
chessground.setShapes([
  { orig: 'e4', customSvg: createQualityBadge('?!', '#ffeb3b') },
  { orig: 'c4', dest: 'd5', brush: 'purple' }  // Best move arrow
]);
```

### 3. Inline Move Annotations

**Move List Format:**
```
14. Ωe4?!  Inaccuracy. Ne8 was best.
    (14... Ωe8 15. Ωxe5 Ωxe5 16. f4)
```

**Component Structure:**
```typescript
interface InlineMoveAnnotation {
  moveNumber: number;
  move: string;
  symbol: string;              // "?!", "?", "??"
  quality: MoveQuality;
  annotation: {
    label: string;             // "Inaccuracy", "Mistake", "Blunder"
    bestMove: string;          // "Ne8 was best"
    continuation: string[];    // ["Ne8", "Ωxe5", "Ωxe5", "f4"]
  } | null;
}
```

**CSS Styling:**
```css
.move-inaccuracy {
  background-color: rgba(255, 235, 59, 0.3);  /* Yellow */
}
.move-mistake {
  background-color: rgba(255, 152, 0, 0.3);   /* Orange */
}
.move-blunder {
  background-color: rgba(244, 67, 54, 0.3);   /* Red */
}
.move-excellent {
  background-color: rgba(139, 195, 74, 0.2);  /* Light green */
}
.move-brilliant {
  background-color: rgba(0, 188, 212, 0.2);   /* Cyan */
}
```

### 4. Evaluation Bar Redesign

**Current:** Vertical win probability bar (0-100%)
**New:** Compact centipawn display with engine info

```typescript
interface EvaluationDisplay {
  evaluation: number;          // Centipawns or mate
  isMate: boolean;
  mateIn: number | null;
  engineName: string;          // "SF 17.1"
  depth: number;               // 23
  isAnalyzed: boolean;         // Green checkmark
}
```

**Display Format:**
- `+1.0` (White advantage)
- `-2.5` (Black advantage)
- `0.0` (Equal)
- `+M3` (Mate in 3 for White)
- `-M1` (Mate in 1 for Black)

### 5. Layout Changes

**Current Layout:**
```
┌─────────────────────────────────────────────┐
│  Header                                      │
├─────────────────────┬───────────────────────┤
│                     │  Move List (separate)  │
│    Chess Board      │  - Click to expand     │
│                     │    annotations         │
├─────────────────────┴───────────────────────┤
│  Statistics Card  │  Phase Analysis Card    │
└─────────────────────────────────────────────┘
```

**New Layout (Lichess-style):**
```
┌─────────────────────────────────────────────┐
│  ✓ +1.0  SF 17.1 · Depth 23          ⚙️    │
├─────────────────────┬───────────────────────┤
│                     │ 14. Ωe4?! Inaccuracy. │
│    Chess Board      │    Ne8 was best.      │
│    [?! on piece]    │    (14... Ωe8 15...)  │
│    [→ best move]    │ 15. f4  Ωf6           │
│                     │ 16. Ωxe4 dxe4 17...   │
├─────────────────────┼───────────────────────┤
│  ◄  ⏮  ⏯  ⏭  ►   │ [Scrollable list]     │
└─────────────────────┴───────────────────────┘
```

### 6. Mobile Responsiveness

**Mobile Layout:**
```
┌─────────────────────┐
│ ✓ +1.0  Depth 23   │
├─────────────────────┤
│                     │
│    Chess Board      │
│    [annotations]    │
│                     │
├─────────────────────┤
│  ◄  ⏮  ⏯  ⏭  ►   │
├─────────────────────┤
│ Move List (inline   │
│ annotations)        │
└─────────────────────┘
```

## Implementation Plan

### Phase 1: Move Quality Symbols (Week 1)
1. Create SVG badge components for ?!, ?, ??, !, !!
2. Update move-list component with inline annotations
3. Add colored backgrounds for move quality
4. Display "X was best" inline with moves

### Phase 2: Board Annotations (Week 2)
1. Integrate quality badges with Chessground
2. Add best-move arrow rendering
3. Show/hide annotations based on current move
4. Animate transitions between moves

### Phase 3: Evaluation Bar Redesign (Week 3)
1. Replace win-probability bar with centipawn display
2. Add engine info display (depth, engine name)
3. Add analyzed checkmark indicator
4. Format mate scores correctly

### Phase 4: Layout & Polish (Week 4)
1. Restructure game-detail page layout
2. Implement responsive design
3. Add keyboard navigation indicators
4. Performance optimization

## Component Changes

### Files to Modify

| File | Changes |
|------|---------|
| `move-list.component.ts` | Add inline annotations, quality symbols |
| `chess-board.component.ts` | Add piece badges, best-move arrows |
| `game-detail.component.ts` | New layout, evaluation display |
| `win-probability.component.ts` | Replace with eval-bar component |
| **New:** `eval-bar.component.ts` | Centipawn display with engine info |
| **New:** `move-quality-badge.component.ts` | SVG badge for !!, !, +, ?!, ?, ?? |

### New Interfaces

```typescript
// src/app/interfaces/analysis.ts

export type MoveQuality = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export type MoveQualitySymbol = '!!' | '!' | '+' | '?!' | '?' | '??';

export interface MoveQualityConfig {
  symbol: MoveQualitySymbol;
  label: string;
  color: string;
  backgroundColor: string;
  textColor: string;
}

export const MOVE_QUALITY_CONFIG: Record<string, MoveQualityConfig> = {
  best: { symbol: '!!', label: 'Best', color: '#4caf50', backgroundColor: 'rgba(76, 175, 80, 0.2)', textColor: '#1b5e20' },
  excellent: { symbol: '!', label: 'Excellent', color: '#8bc34a', backgroundColor: 'rgba(139, 195, 74, 0.2)', textColor: '#33691e' },
  good: { symbol: '+', label: 'Good', color: '#2196f3', backgroundColor: 'rgba(33, 150, 243, 0.1)', textColor: '#0d47a1' },
  inaccuracy: { symbol: '?!', label: 'Inaccuracy', color: '#ffeb3b', backgroundColor: 'rgba(255, 235, 59, 0.3)', textColor: '#f57f17' },
  mistake: { symbol: '?', label: 'Mistake', color: '#ff9800', backgroundColor: 'rgba(255, 152, 0, 0.3)', textColor: '#e65100' },
  blunder: { symbol: '??', label: 'Blunder', color: '#f44336', backgroundColor: 'rgba(244, 67, 54, 0.3)', textColor: '#b71c1c' }
};
```

## Consequences

### Positive

1. **Familiar UX:** Players immediately understand analysis using standard symbols
2. **Faster Learning:** Inline annotations show mistakes without extra clicks
3. **Visual Clarity:** Board annotations highlight critical moves
4. **Industry Standard:** Matches Lichess/Chess.com expectations
5. **Reduced Cognitive Load:** No need to expand/collapse sections

### Negative

1. **Development Effort:** Significant frontend changes required
2. **Chessground Customization:** May need custom SVG rendering
3. **Testing Complexity:** Visual testing needed for annotations
4. **Breaking Change:** Users familiar with current UI need to adapt

### Mitigation

- Gradual rollout with feature flag
- Tooltip explanations for symbols
- Optional "detailed view" toggle for verbose analysis

## Visual Reference

### Inaccuracy (?!)
- Yellow background in move list
- ?! symbol on the moved piece
- "Inaccuracy. X was best." inline text

### Mistake (?)
- Orange background in move list
- ? symbol on the moved piece
- Purple arrow showing better move
- "Mistake. X was best." inline text

### Blunder (??)
- Red background in move list
- ?? symbol on the moved piece
- "Blunder. X was best." inline text

## Success Metrics

1. **User Engagement:** Increased time on game analysis page
2. **Feature Discovery:** More users viewing best-move suggestions
3. **User Feedback:** Positive response to familiar interface
4. **Performance:** No degradation in page load time

## Alternatives Considered

### Alternative 1: Keep Current Design
**Pros:** No development effort
**Cons:** Non-standard, requires more clicks, unfamiliar to users
**Verdict:** Rejected - poor UX compared to industry standard

### Alternative 2: Chess.com Style
**Pros:** Also familiar to users
**Cons:** More complex animations, proprietary design elements
**Verdict:** Rejected - Lichess is open-source and simpler to implement

### Alternative 3: Hybrid Approach
**Pros:** Best of both worlds
**Cons:** Inconsistent UX, confusing
**Verdict:** Rejected - consistency is more important

## References

1. **Lichess Analysis Board:** https://lichess.org/analysis
2. **Lichess Game Review:** (See attached screenshots)
3. **Standard Chess Annotation Symbols:** https://en.wikipedia.org/wiki/Chess_annotation_symbols
4. **Chessground Documentation:** https://github.com/lichess-org/chessground

## Approval

- [ ] Technical Review: _______________ Date: ___________
- [ ] UX Review: _______________ Date: ___________
- [ ] Final Approval: _______________ Date: ___________

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-01-04 | 1.0 | Initial proposal | Development Team |
