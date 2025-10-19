# Project Structure

```
chessify/
├── index.js                    # Main entry point
├── package.json               # Dependencies and scripts
├── jest.config.js            # Test configuration
├── PROJECT_STRUCTURE.md      # This file
├── README.md                 # Project documentation
│
├── src/                      # Source code
│   ├── api/                  # API layer
│   │   └── api-server.js     # Express server with REST endpoints
│   ├── models/               # Business logic
│   │   ├── analyzer.js       # Chess game analyzer with Stockfish
│   │   └── performance-stats.js # Performance calculation logic
│   └── views/                # Frontend/UI
│       └── dashboard.html    # Performance dashboard UI
│
└── tests/                    # Test files
    ├── unit.test.js          # Core unit tests (working)
    ├── analyzer.test.js      # Analyzer tests (timeout issues)
    ├── performance-stats.test.js # Performance tests (working)
    └── api-server.test.js    # API tests (timeout issues)
```

## Layer Responsibilities

### Models (`src/models/`)
- **analyzer.js**: Core chess analysis using Stockfish engine
- **performance-stats.js**: Statistical calculations for win rates, accuracy, blunders

### API (`src/api/`)
- **api-server.js**: Express REST API with caching and error handling

### Views (`src/views/`)
- **dashboard.html**: Responsive web dashboard for performance visualization

### Tests (`tests/`)
- **unit.test.js**: Fast, reliable unit tests for core logic
- Other test files have timeout issues due to Stockfish async initialization

## Scripts

- `npm start` - Run chess analyzer CLI
- `npm run dashboard` - Start web dashboard server
- `npm test unit.test.js` - Run working unit tests
- `npm run test:coverage` - Generate coverage report
