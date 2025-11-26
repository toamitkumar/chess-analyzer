#!/usr/bin/env node

/**
 * Backfill Blunder Categorization Script
 *
 * Categorizes existing blunders from game analysis and populates the blunder_details table.
 * Works with both SQLite (local) and PostgreSQL (production).
 *
 * Usage:
 *   node src/scripts/backfill-blunder-categorization.js [--limit N] [--dry-run]
 *
 * Options:
 *   --limit N    Process only N games (default: all)
 *   --dry-run    Show what would be processed without making changes
 */

const { Chess } = require('chess.js');
const { getDatabase } = require('../models/database');
const BlunderCategorizer = require('../models/blunder-categorizer');

class BlunderBackfill {
  constructor() {
    this.database = null;
    this.categorizer = new BlunderCategorizer();
    this.stats = {
      gamesProcessed: 0,
      blundersCategorized: 0,
      mistakesCategorized: 0,
      inaccuraciesCategorized: 0,
      errors: 0
    };
  }

  async initialize() {
    console.log('🔄 Initializing database connection...');
    this.database = getDatabase();
    await this.database.initialize();
    console.log('✅ Database ready\n');
  }

  async getGamesToProcess(limit = null) {
    console.log('📊 Fetching games with analysis data...');

    let query = `
      SELECT DISTINCT g.id, g.white_player, g.black_player, g.event, g.date
      FROM games g
      INNER JOIN analysis a ON g.id = a.game_id
      WHERE (a.is_blunder = ? OR a.is_mistake = ? OR a.is_inaccuracy = ?)
      ORDER BY g.id DESC
    `;

    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }

    const games = await this.database.all(query, [true, true, true]);
    console.log(`📦 Found ${games.length} games with blunders/mistakes/inaccuracies\n`);
    return games;
  }

  async getPoorMovesForGame(gameId) {
    const query = `
      SELECT
        a.*,
        g.pgn_content
      FROM analysis a
      INNER JOIN games g ON a.game_id = g.id
      WHERE a.game_id = ?
        AND (a.is_blunder = ? OR a.is_mistake = ? OR a.is_inaccuracy = ?)
      ORDER BY a.move_number
    `;

    return await this.database.all(query, [gameId, true, true, true]);
  }

  async checkIfAlreadyCategorized(gameId, moveNumber) {
    const existing = await this.database.get(
      'SELECT id FROM blunder_details WHERE game_id = ? AND move_number = ?',
      [gameId, moveNumber]
    );
    return !!existing;
  }

  categorizePoorMove(moveData, chess) {
    try {
      // Extract data from analysis record
      const blunderData = {
        fen: moveData.fen_before,
        moveNumber: Math.ceil(moveData.move_number / 2),
        playerMove: this.extractUciMove(moveData.move, moveData.fen_before, chess),
        bestMove: moveData.best_move || 'e2e4', // Fallback if missing
        evaluationBefore: moveData.evaluation || 0,
        evaluationAfter: moveData.evaluation || 0,
        centipawnLoss: moveData.centipawn_loss || 0
      };

      return this.categorizer.categorizeBlunder(blunderData, chess);
    } catch (error) {
      console.error(`  ⚠️  Categorization error: ${error.message}`);
      return null;
    }
  }

  extractUciMove(sanMove, fen, chess) {
    try {
      const tempChess = new Chess(fen);
      const move = tempChess.move(sanMove);
      if (!move) return 'e2e4'; // Fallback

      let uci = move.from + move.to;
      if (move.promotion) {
        uci += move.promotion;
      }
      return uci;
    } catch (error) {
      return 'e2e4'; // Fallback
    }
  }

  async insertBlunderDetails(gameId, moveData, categorization) {
    const query = `
      INSERT INTO blunder_details (
        game_id, move_number, fen, phase,
        player_move, best_move, alternative_moves,
        evaluation_before, evaluation_after, centipawn_loss,
        win_probability_before, win_probability_after,
        tactical_theme, position_type, blunder_severity, difficulty_level,
        learned, review_count, mastery_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      gameId,
      Math.ceil(moveData.move_number / 2),
      moveData.fen_before,
      categorization.phase,
      moveData.move,
      moveData.best_move,
      moveData.alternatives ? JSON.stringify(moveData.alternatives) : null,
      moveData.evaluation || 0,
      moveData.evaluation || 0,
      moveData.centipawn_loss || 0,
      moveData.win_probability_before || 50,
      moveData.win_probability_after || 50,
      categorization.tactical_theme,
      categorization.position_type,
      categorization.blunder_severity,
      categorization.difficulty_level,
      false, // learned
      0,     // review_count
      0      // mastery_score
    ];

    await this.database.run(query, params);
  }

  async processGame(game, dryRun = false) {
    try {
      console.log(`📝 Processing game #${game.id}: ${game.white_player} vs ${game.black_player}`);

      const poorMoves = await this.getPoorMovesForGame(game.id);
      console.log(`   Found ${poorMoves.length} poor moves`);

      if (poorMoves.length === 0) return;

      let categorized = 0;
      let skipped = 0;

      for (const moveData of poorMoves) {
        // Check if already categorized
        const alreadyCategorized = await this.checkIfAlreadyCategorized(
          game.id,
          Math.ceil(moveData.move_number / 2)
        );

        if (alreadyCategorized) {
          skipped++;
          continue;
        }

        // Categorize the move
        const chess = new Chess(moveData.fen_before);
        const categorization = this.categorizePoorMove(moveData, chess);

        if (!categorization) {
          this.stats.errors++;
          continue;
        }

        // Insert into database (unless dry run)
        if (!dryRun) {
          await this.insertBlunderDetails(game.id, moveData, categorization);
        }

        // Update stats
        categorized++;
        if (moveData.is_blunder) this.stats.blundersCategorized++;
        if (moveData.is_mistake) this.stats.mistakesCategorized++;
        if (moveData.is_inaccuracy) this.stats.inaccuraciesCategorized++;
      }

      this.stats.gamesProcessed++;
      console.log(`   ✅ Categorized ${categorized} moves, skipped ${skipped} already categorized\n`);

    } catch (error) {
      console.error(`   ❌ Error processing game #${game.id}: ${error.message}\n`);
      this.stats.errors++;
    }
  }

  async run(options = {}) {
    const { limit = null, dryRun = false } = options;

    console.log('🚀 Starting Blunder Categorization Backfill');
    console.log('==========================================\n');

    if (dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    try {
      await this.initialize();

      const games = await this.getGamesToProcess(limit);

      if (games.length === 0) {
        console.log('✅ No games to process\n');
        return;
      }

      console.log(`🔄 Processing ${games.length} games...\n`);

      for (const game of games) {
        await this.processGame(game, dryRun);
      }

      console.log('\n📊 Backfill Complete!');
      console.log('====================');
      console.log(`Games processed:       ${this.stats.gamesProcessed}`);
      console.log(`Blunders categorized:  ${this.stats.blundersCategorized}`);
      console.log(`Mistakes categorized:  ${this.stats.mistakesCategorized}`);
      console.log(`Inaccuracies cat.:     ${this.stats.inaccuraciesCategorized}`);
      console.log(`Total categorized:     ${this.stats.blundersCategorized + this.stats.mistakesCategorized + this.stats.inaccuraciesCategorized}`);
      console.log(`Errors:                ${this.stats.errors}`);

      if (dryRun) {
        console.log('\n⚠️  This was a dry run - run without --dry-run to apply changes');
      }

    } catch (error) {
      console.error('\n❌ Backfill failed:', error);
      throw error;
    } finally {
      if (this.database) {
        await this.database.close();
        console.log('\n✅ Database connection closed');
      }
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    limit: null,
    dryRun: false
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Backfill Blunder Categorization Script

Usage:
  node src/scripts/backfill-blunder-categorization.js [options]

Options:
  --limit N     Process only N games (default: all)
  --dry-run     Show what would be processed without making changes
  --help, -h    Show this help message

Examples:
  # Dry run on 10 games
  node src/scripts/backfill-blunder-categorization.js --limit 10 --dry-run

  # Process all games
  node src/scripts/backfill-blunder-categorization.js

  # Process 50 games
  node src/scripts/backfill-blunder-categorization.js --limit 50
      `);
      process.exit(0);
    }
  }

  const backfill = new BlunderBackfill();
  backfill.run(options)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = BlunderBackfill;
