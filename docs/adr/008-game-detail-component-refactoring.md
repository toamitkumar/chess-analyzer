# ADR 008: Game Detail Component Refactoring

## Status
In Progress

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

### Phase 2: Child Components
- [ ] `EvalGraphComponent` - SVG evaluation graph with click handlers
- [ ] `MoveListComponent` - Move list with annotations and alternative lines
- [ ] `PlayerStatsCardComponent` - Player stats display
- [ ] `PhaseAnalysisComponent` - Phase accuracy display
- [ ] `MoveQualityComponent` - Move quality distribution grid
- [ ] `BoardControlsComponent` - Navigation buttons
- [ ] `ShareExportComponent` - Share/export tab content

### Phase 3: Services (Optional)
- [ ] `EvalFormatterService` - Evaluation formatting utilities
- [ ] `StatsCalculatorService` - Statistics calculation logic

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
