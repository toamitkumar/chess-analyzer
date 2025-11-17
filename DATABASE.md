# Database Configuration

## Overview

This project uses SQLite databases with separate databases for development and testing.

## Database Files

- **Development Database**: `data/chess_analysis.db`
  - Used when running the application normally (`npm start`)
  - Contains your actual game data and analysis
  - **NEVER delete this file** unless you want to lose all your data

- **Test Database**: `data/chess_analysis_test.db`
  - Used when running tests (`npm test`)
  - Automatically created and managed by tests
  - Safe to delete anytime with `npm run test:clean`

## Environment Detection

The application automatically uses the correct database based on the `NODE_ENV` environment variable:

- `NODE_ENV=test` → Uses `chess_analysis_test.db`
- `NODE_ENV=production` or undefined → Uses `chess_analysis.db`

Jest automatically sets `NODE_ENV=test` when running tests (configured in `tests/setup.js`).

## Scripts

```bash
# Run tests (uses test database)
npm test

# Clean test database files
npm run test:clean

# Start development server (uses development database)
npm start
```

## Best Practices

1. **Never manually delete the development database** unless you're intentionally resetting your data
2. **Run tests regularly** to ensure database operations work correctly
3. **Clean test databases periodically** with `npm run test:clean` to free up disk space
4. **Backup your development database** before major changes:
   ```bash
   cp data/chess_analysis.db data/chess_analysis.db.backup
   ```

## Migration Between Databases

If you need to copy data from test to development or vice versa:

```bash
# Backup first!
cp data/chess_analysis.db data/chess_analysis.db.backup

# Copy test data to development (be careful!)
cp data/chess_analysis_test.db data/chess_analysis.db
```

## Troubleshooting

### Tests are using development database

Check that `tests/setup.js` exists and contains:
```javascript
process.env.NODE_ENV = 'test';
```

### Database is locked

SQLite databases can only have one writer at a time. Make sure:
- You're not running the app and tests simultaneously
- Close any database browser tools before running tests
- Restart the application/tests if needed
