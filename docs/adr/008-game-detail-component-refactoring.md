# ADR 008: Game Detail Component Refactoring

## Status
Complete

## Context
The `GameDetailV2Component` has grown to ~1294 lines, combining template (~200 lines), styles (~300 lines), and TypeScript logic (~800 lines) in a single file. This makes the component difficult to maintain, test, and extend.

## Decision
Refactor the component using Angular best practices:

### Phase 1: File Separation ✅ COMPLETE
- [x] Extract template to `game-detail-v2.component.html` (220 lines)
- [x] Extract styles to `game-detail-v2.component.scss` (481 lines)
- [x] Extract interfaces to `game-detail.models.ts` (64 lines)
- [x] Refactor main component (471 lines, down from ~800)

**Result:** 1 file → 4 files, improved organization and IDE support

### Phase 2: Child Components ✅ COMPLETE
- [x] `EvalGraphComponent` - SVG evaluation graph with click handlers (74 lines)
- [x] `BoardControlsComponent` - Navigation buttons (57 lines)
- [x] `ShareExportComponent` - Share/export tab content (67 lines)
- [x] `PlayerStatsCardComponent` - Player stats display (42 lines)
- [x] `PhaseAnalysisComponent` - Phase accuracy display (36 lines)
- [x] `MoveQualityComponent` - Move quality distribution grid (51 lines)
- [x] Barrel export `index.ts` (6 lines)

**Result:** 6 reusable child components extracted (333 lines total)
- Main component reduced: 471 → 444 lines
- Template reduced: 220 → 133 lines
- Total project lines: 1455 (organized across 11 files)

### Phase 3: Services (Deferred)
- [ ] `EvalFormatterService` - Evaluation formatting utilities
- [ ] `StatsCalculatorService` - Statistics calculation logic

*Note: Phase 3 deferred as current refactoring provides sufficient maintainability improvement.*

## Consequences

### Positive
- Improved maintainability and readability
- Better separation of concerns
- Easier unit testing of individual components
- Reusable components for other views
- Better IDE support with separate files

### Negative
- More files to manage
- Slightly more complex component communication via @Input/@Output
- Initial refactoring effort

## Implementation Notes
- Use `@Input()` for data flow down, `@Output()` for events up
- Keep chessboard logic in parent component (complex state management)
- Child components should be presentational where possible
