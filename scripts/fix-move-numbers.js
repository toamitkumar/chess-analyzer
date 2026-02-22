#!/usr/bin/env node

/**
 * Fix Move Numbers Migration
 * 
 * Problem: The analyzer was storing ply numbers (half-moves) instead of actual move numbers.
 * For example, move 1 white = ply 1, move 1 black = ply 2, move 2 white = ply 3, etc.
 * 
 * Solution: Convert ply numbers to actual move numbers using: Math.ceil(ply / 2)
 * 
 * This script updates:
 * - analysis table
 * - blunder_details table
 * - alternative_moves table
 * - position_evaluations table
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/chess-analysis.db');

async function fixMoveNumbers() {
  const db = new sqlite3.Database(DB_PATH);
  
  // Promisify db methods
  const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
  
  const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  console.log('🔧 Starting move number fix migration...\n');
  
  try {
    // Get all affected records
    const analysisRecords = await dbAll('SELECT id, move_number FROM analysis');
    const blunderRecords = await dbAll('SELECT id, move_number FROM blunder_details');
    const altMovesRecords = await dbAll('SELECT id, move_number FROM alternative_moves');
    const posEvalRecords = await dbAll('SELECT id, move_number FROM position_evaluations');
    
    console.log(`📊 Found records to update:`);
    console.log(`   - Analysis: ${analysisRecords.length}`);
    console.log(`   - Blunder Details: ${blunderRecords.length}`);
    console.log(`   - Alternative Moves: ${altMovesRecords.length}`);
    console.log(`   - Position Evaluations: ${posEvalRecords.length}\n`);
    
    // Start transaction
    await dbRun('BEGIN TRANSACTION');
    
    // Update analysis table
    console.log('🔄 Updating analysis table...');
    for (const record of analysisRecords) {
      const correctMoveNumber = Math.ceil(record.move_number / 2);
      if (correctMoveNumber !== record.move_number) {
        await dbRun(
          'UPDATE analysis SET move_number = ? WHERE id = ?',
          [correctMoveNumber, record.id]
        );
      }
    }
    console.log(`✅ Updated ${analysisRecords.length} analysis records\n`);
    
    // Update blunder_details table
    console.log('🔄 Updating blunder_details table...');
    for (const record of blunderRecords) {
      const correctMoveNumber = Math.ceil(record.move_number / 2);
      if (correctMoveNumber !== record.move_number) {
        await dbRun(
          'UPDATE blunder_details SET move_number = ? WHERE id = ?',
          [correctMoveNumber, record.id]
        );
      }
    }
    console.log(`✅ Updated ${blunderRecords.length} blunder_details records\n`);
    
    // Update alternative_moves table
    console.log('🔄 Updating alternative_moves table...');
    for (const record of altMovesRecords) {
      const correctMoveNumber = Math.ceil(record.move_number / 2);
      if (correctMoveNumber !== record.move_number) {
        await dbRun(
          'UPDATE alternative_moves SET move_number = ? WHERE id = ?',
          [correctMoveNumber, record.id]
        );
      }
    }
    console.log(`✅ Updated ${altMovesRecords.length} alternative_moves records\n`);
    
    // Update position_evaluations table
    console.log('🔄 Updating position_evaluations table...');
    for (const record of posEvalRecords) {
      const correctMoveNumber = Math.ceil(record.move_number / 2);
      if (correctMoveNumber !== record.move_number) {
        await dbRun(
          'UPDATE position_evaluations SET move_number = ? WHERE id = ?',
          [correctMoveNumber, record.id]
        );
      }
    }
    console.log(`✅ Updated ${posEvalRecords.length} position_evaluations records\n`);
    
    // Commit transaction
    await dbRun('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   All move numbers have been converted from ply numbers to actual move numbers.`);
    console.log(`   Formula used: correctMoveNumber = Math.ceil(plyNumber / 2)`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await dbRun('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

// Run migration
if (require.main === module) {
  fixMoveNumbers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = fixMoveNumbers;
