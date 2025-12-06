#!/bin/bash

# Import Puzzle Data to Railway Production
# This script imports puzzle data to Railway PostgreSQL from your local machine

set -e  # Exit on error

echo "🚀 Puzzle Import to Railway Production"
echo "======================================"
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found"
    echo "   Install: npm i -g @railway/cli"
    echo "   Or: brew install railway"
    exit 1
fi

# Check if puzzle file exists
PUZZLE_FILE="data/lichess_puzzles.csv.bz2"
if [ ! -f "$PUZZLE_FILE" ]; then
    echo "❌ Puzzle file not found: $PUZZLE_FILE"
    echo ""
    echo "   Please download first:"
    echo "   npm run download-puzzles"
    exit 1
fi

# Get file size
FILE_SIZE=$(du -h "$PUZZLE_FILE" | cut -f1)
echo "✅ Puzzle file found: $FILE_SIZE"
echo ""

# Check if linked to Railway project
if ! railway status &> /dev/null; then
    echo "❌ Not linked to Railway project"
    echo ""
    echo "   Please link first:"
    echo "   railway link"
    exit 1
fi

echo "✅ Railway project linked"
echo ""

# Get DATABASE_URL from Railway
echo "📡 Getting Railway database connection..."
DATABASE_URL=$(railway variables get DATABASE_URL 2>/dev/null || echo "")

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Could not get DATABASE_URL from Railway"
    echo "   Make sure PostgreSQL is provisioned"
    exit 1
fi

echo "✅ Database connection retrieved"
echo ""

# Ask for confirmation
echo "⚠️  This will import ~3 million puzzles to production"
echo "   Estimated time: 5-10 minutes"
echo "   Storage used: ~10MB"
echo ""
read -p "   Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Import cancelled"
    exit 0
fi

echo ""
echo "🔄 Starting import..."
echo ""

# Export DATABASE_URL and NODE_ENV
export DATABASE_URL="$DATABASE_URL"
export NODE_ENV=production

# Run import
node scripts/import-puzzle-index.js

# Check result
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Import completed successfully!"
    echo ""
    echo "📊 Verifying data..."
    
    # Verify count
    railway run node -e "
      const { getDatabase } = require('./src/models/database');
      (async () => {
        const db = getDatabase();
        await db.initialize();
        const result = await db.get('SELECT COUNT(*) as count FROM puzzle_index');
        console.log('   Puzzles in database:', result.count.toLocaleString());
        process.exit(0);
      })();
    "
    
    echo ""
    echo "🎉 Production import complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Test API: railway run curl http://localhost:3000/api/puzzles/00001"
    echo "  2. Deploy: git push railway main"
    echo "  3. Monitor: railway logs"
else
    echo ""
    echo "❌ Import failed"
    echo "   Check error logs above"
    exit 1
fi
