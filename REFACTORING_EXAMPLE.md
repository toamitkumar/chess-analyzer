# API Server Refactoring Example

## Current Structure (2792 lines in one file)

```javascript
// api-server.js - BEFORE (showing just the pattern)
const express = require('express');
const app = express();

// ... 100+ lines of imports and initialization ...

// Tournament routes (inline handlers - 600+ lines)
app.post('/api/tournaments', async (req, res) => {
  try {
    // 50 lines of business logic here
  } catch (error) {
    // error handling
  }
});

app.get('/api/tournaments', async (req, res) => {
  try {
    // 20 lines of business logic
  } catch (error) {
    // error handling
  }
});

// ... 11 more tournament routes inline ...

// Game routes (inline handlers - 400+ lines)
app.get('/api/games', async (req, res) => {
  // 100+ lines of logic
});

// ... 10 more game routes inline ...

// Blunder routes (inline handlers - 300+ lines)
// Puzzle routes (inline handlers - 200+ lines)
// Learning path routes (inline handlers - 400+ lines)
// Performance routes (inline handlers - 300+ lines)
// etc...

// Total: 2792 lines in one file!
```

---

## New Structure (Organized and Maintainable)

### api-server.js (Main Server - ~150 lines)
```javascript
const express = require('express');
const cors = require('cors');
const { getDatabase } = require('../models/database');
const { requireAuth } = require('../middleware/clerk-auth');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Initialize services
let database;

async function initialize() {
  try {
    database = getDatabase();
    await database.initialize();
    console.log('✅ All services initialized');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    process.exit(1);
  }
}

// Authentication middleware for all API routes
app.use('/api/*', requireAuth);

// Mount all API routes
app.use('/api', apiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
});

module.exports = app;
```

### routes/index.js (Route Aggregator - ~40 lines)
```javascript
const express = require('express');
const router = express.Router();

// Import all domain routes
const tournamentRoutes = require('./tournament.routes');
const gameRoutes = require('./game.routes');
const blunderRoutes = require('./blunder.routes');
const puzzleRoutes = require('./puzzle.routes');
const learningPathRoutes = require('./learningPath.routes');
const performanceRoutes = require('./performance.routes');

// Mount routes by domain
router.use('/tournaments', tournamentRoutes);
router.use('/games', gameRoutes);
router.use('/blunders', blunderRoutes);
router.use('/puzzles', puzzleRoutes);
router.use('/learning-path', learningPathRoutes);
router.use('/performance', performanceRoutes);

module.exports = router;
```

### routes/tournament.routes.js (~30 lines)
```javascript
const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournament.controller');

router.post('/', tournamentController.create);
router.get('/', tournamentController.list);
router.get('/compare', tournamentController.compare);
router.get('/rankings', tournamentController.getRankings);
router.get('/:id', tournamentController.getById);
router.get('/:id/performance', tournamentController.getPerformance);
router.get('/:id/heatmap', tournamentController.getHeatmap);
router.get('/:id/trends', tournamentController.getTrends);
router.get('/:id/summary', tournamentController.getSummary);
router.get('/:id/player-performance', tournamentController.getPlayerPerformance);
router.get('/:id/files', tournamentController.getFiles);
router.get('/:id/games', tournamentController.getGames);

module.exports = router;
```

### controllers/tournament.controller.js (~550 lines)
```javascript
const { getDatabase } = require('../../models/database');
const { getTournamentManager } = require('../../models/tournament-manager');
const { getTournamentAnalyzer } = require('../../models/tournament-analyzer');

class TournamentController {
  async create(req, res) {
    try {
      // Clean, focused business logic
      const tournamentManager = getTournamentManager();
      const { name, eventType, location, startDate, endDate } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Tournament name is required' });
      }

      // ... rest of creation logic ...
      res.status(201).json(tournament);
    } catch (error) {
      console.error('Tournament creation error:', error);
      res.status(500).json({ error: 'Failed to create tournament' });
    }
  }

  async list(req, res) {
    // List logic
  }

  async getById(req, res) {
    // Get by ID logic
  }

  // ... 10 more well-organized methods ...
}

module.exports = new TournamentController();
```

---

## Benefits of Refactored Structure

### 1. **Maintainability**
- **Before**: Find tournament creation logic in a 2792-line file
- **After**: Open `controllers/tournament.controller.js` and find `create()` method

### 2. **Testability**
```javascript
// Easy to test individual controller methods
const tournamentController = require('./controllers/tournament.controller');

describe('TournamentController', () => {
  test('create should validate required fields', async () => {
    const req = { body: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await tournamentController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Tournament name is required'
    });
  });
});
```

### 3. **Organization**
```
src/api/
├── server.js (150 lines) - Main server setup
├── controllers/
│   ├── tournament.controller.js (550 lines) - Tournament business logic
│   ├── game.controller.js (400 lines) - Game business logic
│   ├── blunder.controller.js (300 lines) - Blunder business logic
│   └── ... 5 more controllers
└── routes/
    ├── index.js (40 lines) - Route aggregator
    ├── tournament.routes.js (30 lines) - Tournament routes
    ├── game.routes.js (25 lines) - Game routes
    └── ... 5 more route files
```

### 4. **Reusability**
Controllers can be reused across different entry points (HTTP, CLI, WebSocket, etc.)

### 5. **Team Collaboration**
Multiple developers can work on different controllers without merge conflicts

---

## Migration Strategy

### Phase 1: Tournament Domain (DONE ✅)
- Created `tournament.controller.js`
- Created `tournament.routes.js`
- Created `routes/index.js`
- Ready to integrate into `api-server.js`

### Phase 2: Game Domain (NEXT)
- Extract game routes
- Create `game.controller.js`
- Create `game.routes.js`
- Add to `routes/index.js`

### Phase 3: Remaining Domains
- Blunders
- Puzzles
- Learning Path
- Performance
- Trends
- Upload

### Phase 4: Final Cleanup
- Remove old route definitions from `api-server.js`
- Add comprehensive tests for all controllers
- Update documentation

---

## Testing the Refactored Code

```bash
# No changes to frontend - all endpoints remain the same!
# POST /api/tournaments -> Still works
# GET /api/tournaments/:id -> Still works
# etc...

# To integrate, just update api-server.js to use the new routes:
# app.use('/api', require('./routes'));
```

---

## File Size Comparison

| File | Before | After |
|------|--------|-------|
| api-server.js | 2792 lines | ~150 lines |
| tournament logic | (in api-server.js) | 550 lines (controller) + 30 lines (routes) |
| game logic | (in api-server.js) | ~400 lines (controller) + 25 lines (routes) |
| Total complexity | **One 2792-line file** | **12 focused files, avg ~200 lines each** |

**Result**: Same functionality, 18x more organized! 🎉
