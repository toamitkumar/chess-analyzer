const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const bz2 = require('unbzip2-stream');
const cliProgress = require('cli-progress');
const { getDatabase } = require('../src/models/database');

/**
 * Import Lichess puzzle INDEX only (not full puzzles)
 * Imports: id, themes, rating, popularity
 * Skips: FEN, moves, game_url (will fetch from API on-demand)
 *
 * Storage: ~10MB for 3M puzzles (vs 2GB for full data)
 */

const DATA_DIR = path.join(__dirname, '../data');
const INPUT_FILE = path.join(DATA_DIR, 'lichess_puzzles.csv.bz2');
const ERROR_LOG = path.join(DATA_DIR, 'import_errors.log');

// Configuration
const BATCH_SIZE = 1000; // Insert 1000 puzzles at a time
const DEFAULT_LIMIT = null; // null = import all, or set number for testing

async function importPuzzleIndex(options = {}) {
  const limit = options.limit || DEFAULT_LIMIT;
  const skipExisting = options.skipExisting || false;

  console.log('📊 Importing Lichess Puzzle Index');
  console.log('   Mode: INDEX ONLY (id, themes, rating, popularity)');
  console.log(`   Batch size: ${BATCH_SIZE} puzzles`);
  if (limit) console.log(`   Limit: ${limit} puzzles (testing mode)`);
  console.log('');

  // Check if file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('❌ Puzzle file not found:', INPUT_FILE);
    console.error('   Please run: npm run download-puzzles');
    process.exit(1);
  }

  // Get database instance
  const db = getDatabase();
  await db.initialize();

  const isPostgres = db.usePostgres;
  console.log(`   Database: ${isPostgres ? 'PostgreSQL (production)' : 'SQLite (local)'}`);
  console.log('');

  // Check existing count
  if (skipExisting) {
    const existing = await db.get('SELECT COUNT(*) as count FROM puzzle_index');
    if (existing && existing.count > 0) {
      console.log(`⚠️  ${existing.count} puzzles already imported`);
      console.log('   Use --force to re-import');
      return;
    }
  }

  // Prepare error log
  if (fs.existsSync(ERROR_LOG)) {
    fs.unlinkSync(ERROR_LOG);
  }

  // Statistics
  let imported = 0;
  let errors = 0;
  let skipped = 0;
  let batch = [];

  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '   Importing |{bar}| {percentage}% | {value}/{total} puzzles | Errors: {errors}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  // Estimate total puzzles (3M+ in database, but we might limit)
  const estimatedTotal = limit || 3200000;
  progressBar.start(estimatedTotal, 0, { errors: 0 });

  try {
    // Create read stream with bzip2 decompression
    // Note: Lichess CSV has NO headers, columns are positional
    const stream = fs.createReadStream(INPUT_FILE)
      .pipe(bz2())
      .pipe(csv({
        headers: ['PuzzleId', 'FEN', 'Moves', 'Rating', 'RatingDeviation', 'Popularity', 'NbPlays', 'Themes', 'GameUrl', 'OpeningTags']
      }));

    // Process each row
    for await (const row of stream) {
      try {
        // Extract only the index fields we need
        const puzzleIndex = {
          id: row.PuzzleId,
          themes: row.Themes, // Space-separated string (e.g., "fork middlegame")
          rating: parseInt(row.Rating) || null,
          popularity: parseInt(row.Popularity) || 0
        };

        // Validate
        if (!puzzleIndex.id || !puzzleIndex.themes) {
          throw new Error('Missing required fields');
        }

        // For PostgreSQL, convert themes to array
        if (isPostgres) {
          puzzleIndex.themesArray = puzzleIndex.themes.split(' ').filter(t => t.length > 0);
        }

        batch.push(puzzleIndex);

        // Insert batch when full
        if (batch.length >= BATCH_SIZE) {
          await insertBatch(db, batch, isPostgres);
          imported += batch.length;
          batch = [];
          progressBar.update(imported, { errors });
        }

        // Stop if limit reached
        if (limit && imported + batch.length >= limit) {
          break;
        }

      } catch (error) {
        errors++;
        logError(row, error);

        // Update progress bar with error count
        progressBar.update(imported, { errors });

        // Stop if too many errors
        if (errors > 100) {
          throw new Error('Too many errors (>100), aborting import');
        }
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      await insertBatch(db, batch, isPostgres);
      imported += batch.length;
      progressBar.update(imported, { errors });
    }

    progressBar.stop();

    // Final statistics
    console.log('');
    console.log('✅ Import completed successfully');
    console.log(`   Imported: ${imported.toLocaleString()} puzzles`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Skipped: ${skipped}`);

    // Estimate storage size
    const storageMB = Math.round((imported * 3) / 1024); // ~3 bytes per puzzle
    console.log(`   Estimated storage: ~${storageMB} MB`);

    // Show index info
    const indexCount = await db.get('SELECT COUNT(*) as count FROM puzzle_index');
    console.log(`   Total in database: ${indexCount.count.toLocaleString()} puzzles`);

    if (errors > 0) {
      console.log('');
      console.log(`⚠️  ${errors} errors logged to: ${ERROR_LOG}`);
    }

  } catch (error) {
    progressBar.stop();
    console.error('');
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Insert batch of puzzles into database
 */
async function insertBatch(db, puzzles, isPostgres) {
  if (isPostgres) {
    // PostgreSQL: Use array type for themes
    const placeholders = puzzles.map((_, i) => {
      const offset = i * 4;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    }).join(',');

    const values = puzzles.flatMap(p => [
      p.id,
      p.themesArray, // PostgreSQL array
      p.rating,
      p.popularity
    ]);

    await db.run(`
      INSERT INTO puzzle_index (id, themes, rating, popularity)
      VALUES ${placeholders}
      ON CONFLICT (id) DO NOTHING
    `, values);

  } else {
    // SQLite: Use TEXT for themes (space-separated)
    const placeholders = puzzles.map(() => '(?, ?, ?, ?)').join(',');
    const values = puzzles.flatMap(p => [
      p.id,
      p.themes, // SQLite TEXT
      p.rating,
      p.popularity
    ]);

    await db.run(`
      INSERT OR IGNORE INTO puzzle_index (id, themes, rating, popularity)
      VALUES ${placeholders}
    `, values);
  }
}

/**
 * Log error to file
 */
function logError(row, error) {
  const logEntry = `${new Date().toISOString()} | ${row.PuzzleId || 'unknown'} | ${error.message}\n`;
  fs.appendFileSync(ERROR_LOG, logEntry);
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--skip-existing') {
      options.skipExisting = true;
    } else if (arg === '--help') {
      console.log(`
Usage: node import-puzzle-index.js [options]

Options:
  --limit N          Import only first N puzzles (for testing)
  --skip-existing    Skip import if puzzles already exist
  --help             Show this help message

Examples:
  node import-puzzle-index.js                    # Import all puzzles
  node import-puzzle-index.js --limit 1000       # Import 1000 puzzles (testing)
  node import-puzzle-index.js --skip-existing    # Skip if already imported
      `);
      process.exit(0);
    }
  }

  return options;
}

// Run if executed directly
if (require.main === module) {
  const options = parseArgs();
  importPuzzleIndex(options).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = importPuzzleIndex;
