# Controller Unit Testing Guide

## Database Safety

### CRITICAL: These tests NEVER touch the development database!

All controller tests use **mocked dependencies** via `jest.mock()`. This means:

✅ **NO real database operations occur**
✅ **Development database (`chess_analysis.db`) is NEVER affected**
✅ **Test database (`chess_analysis_test.db`) is NOT used** (mocks replace all database calls)
✅ **Safe to run at any time without data corruption**

## How It Works

### Mock Strategy

```javascript
// Set test environment
process.env.NODE_ENV = 'test';

// Mock all external dependencies
jest.mock('../src/models/database');
jest.mock('../src/models/tournament-manager');
jest.mock('../src/models/tournament-analyzer');
```

When we mock modules with `jest.mock()`, **NO REAL CODE FROM THOSE MODULES RUNS**. Instead:
- All function calls are intercepted
- We control the return values
- No database connections are made
- No files are written
- No external services are called

### Example Test

```javascript
describe('create()', () => {
  it('should create a new tournament', async () => {
    // This does NOT touch the real database!
    // It's just a mock function that returns what we tell it to return
    mockDb.findTournamentByName.mockResolvedValue(null);
    mockDb.insertTournament.mockResolvedValue({ id: 1 });

    await tournamentController.create(mockReq, mockRes);

    // Verify the mocked functions were called correctly
    expect(mockDb.insertTournament).toHaveBeenCalled();
  });
});
```

## Test Files

### Game Controller Tests
**File:** `tests/game.controller.test.js`
**Coverage:** 20 tests covering all 8 controller methods
**Mocked:** database, opening-detector, accuracy-calculator

**Methods Tested:**
- `list()` - Get all games
- `getById()` - Get game by ID
- `getAnalysis()` - Get game analysis
- `getAlternatives()` - Get alternative moves
- `getBlunders()` - Get blunders
- `getAccuracy()` - Calculate accuracy
- `getPerformance()` - Get performance metrics
- `getPhases()` - Get phase analysis

### Tournament Controller Tests
**File:** `tests/tournament.controller.test.js`
**Coverage:** 36 tests covering all 13 controller methods
**Mocked:** database, tournament-manager, tournament-analyzer, file-storage

**Methods Tested:**
- `create()` - Create tournament
- `list()` - List tournaments
- `getById()` - Get tournament by ID
- `getPerformance()` - Get performance
- `getHeatmap()` - Get heatmap
- `getTrends()` - Get trends
- `getSummary()` - Get summary
- `getPlayerPerformance()` - Get player performance
- `compare()` - Compare tournaments
- `getRankings()` - Get rankings
- `getFiles()` - Get files
- `listFolders()` - List folders
- `getGames()` - Get games

## Running Tests

### Run all controller tests:
```bash
npm test
```

### Run specific test file:
```bash
npm test -- game.controller.test.js
npm test -- tournament.controller.test.js
```

### Run tests in watch mode:
```bash
npm run test:watch
```

### Check test coverage:
```bash
npm run test:coverage
```

## What Each Test Verifies

### Happy Path Tests
- Correct database queries are made
- Correct data is returned
- HTTP status codes are correct (200, 201)

### Error Handling Tests
- Database errors are caught and handled
- 404 responses when resources not found
- 500 responses on server errors
- Empty arrays returned instead of crashes

### Edge Cases
- Missing required fields (400 errors)
- Duplicate resources (409 errors)
- Empty result sets
- Null/undefined handling

## Integration vs Unit Tests

### Unit Tests (These Files)
- ✅ Test controller logic in isolation
- ✅ Use mocked dependencies
- ✅ Fast execution (milliseconds)
- ✅ No database required
- ✅ Safe to run anytime

### Integration Tests (Separate Files)
- ⚠️ Test full request/response cycle
- ⚠️ Use real or test database
- ⚠️ Slower execution (seconds)
- ⚠️ Require database setup
- ⚠️ Should use `chess_analysis_test.db`

## Best Practices

### 1. Always Mock External Dependencies
```javascript
jest.mock('../src/models/database');
jest.mock('../src/external-service');
```

### 2. Set Test Environment Early
```javascript
// BEFORE importing modules
process.env.NODE_ENV = 'test';
```

### 3. Reset Mocks Between Tests
```javascript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### 4. Test Both Success and Failure Paths
```javascript
it('should return data on success', async () => { ... });
it('should handle errors gracefully', async () => { ... });
```

### 5. Verify Function Calls
```javascript
expect(mockDb.get).toHaveBeenCalledWith(
  'SELECT * FROM games WHERE id = ?',
  [1]
);
```

## Adding New Tests

When adding a new controller method, follow this template:

```javascript
describe('newMethod()', () => {
  it('should [describe expected behavior]', async () => {
    // Arrange: Set up mocks
    mockDb.someMethod.mockResolvedValue({ data: 'value' });

    // Act: Call the method
    await controller.newMethod(mockReq, mockRes);

    // Assert: Verify results
    expect(mockRes.json).toHaveBeenCalledWith({ data: 'value' });
  });

  it('should handle errors', async () => {
    mockDb.someMethod.mockRejectedValue(new Error('DB error'));

    await controller.newMethod(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
```

## FAQ

**Q: Can these tests corrupt my development database?**
A: No. All database calls are mocked. The real database is never touched.

**Q: Do I need a test database to run these tests?**
A: No. Mocks replace all database operations.

**Q: Why use mocks instead of a real test database?**
A: Mocks make tests faster, more reliable, and eliminate database setup/teardown complexity.

**Q: When should I use a real database in tests?**
A: For integration tests that verify the full stack (routes → controllers → database → response).

**Q: How do I know tests are using mocks?**
A: Look for `jest.mock()` calls at the top of the test file. If present, all imports of those modules are mocked.

## Summary

✅ **Safe:** No database corruption possible
✅ **Fast:** Tests run in <1 second
✅ **Isolated:** Each test is independent
✅ **Reliable:** No external dependencies
✅ **Comprehensive:** 56 tests total covering all controller methods

These tests give us confidence that our refactored controllers work correctly without any risk to the development database!
