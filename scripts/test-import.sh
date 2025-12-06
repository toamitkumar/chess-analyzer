#!/bin/bash

# Test Puzzle Import with Small Dataset
# Imports only 1000 puzzles for testing

set -e

echo "🧪 Test Puzzle Import (1000 puzzles)"
echo "====================================="
echo ""

# Check if puzzle file exists
PUZZLE_FILE="data/lichess_puzzles.csv.bz2"
if [ ! -f "$PUZZLE_FILE" ]; then
    echo "❌ Puzzle file not found: $PUZZLE_FILE"
    echo ""
    echo "   Please download first:"
    echo "   npm run download-puzzles"
    exit 1
fi

echo "✅ Puzzle file found"
echo ""

# Determine environment
if [ -n "$DATABASE_URL" ]; then
    echo "📊 Environment: Production (PostgreSQL)"
else
    echo "📊 Environment: Local (SQLite)"
fi

echo "   Importing: 1000 puzzles (test mode)"
echo ""

# Run import with limit
node scripts/import-puzzle-index.js --limit 1000

# Verify
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Test import successful!"
    echo ""
    
    # Show count
    if [ -n "$DATABASE_URL" ]; then
        # PostgreSQL
        echo "Verifying count..."
        node -e "
          const { getDatabase } = require('./src/models/database');
          (async () => {
            const db = getDatabase();
            await db.initialize();
            const result = await db.get('SELECT COUNT(*) as count FROM puzzle_index');
            console.log('Puzzles imported:', result.count);
            process.exit(0);
          })();
        "
    else
        # SQLite
        sqlite3 data/chess-analysis.db "SELECT COUNT(*) as count FROM puzzle_index"
    fi
    
    echo ""
    echo "🎉 Ready to test API!"
    echo ""
    echo "Next steps:"
    echo "  1. Start server: npm start"
    echo "  2. Test puzzle fetch: curl http://localhost:3000/api/puzzles/00001"
    echo "  3. Full import: npm run import-puzzle-index"
else
    echo ""
    echo "❌ Test import failed"
    exit 1
fi
