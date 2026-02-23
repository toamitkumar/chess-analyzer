/**
 * Backfill phase_stats table for all existing games.
 *
 * For each game that has analysis rows but no phase_stats entry, compute
 * per-phase accuracy from the analysis table and insert into phase_stats.
 *
 * Phase boundaries (board moves, matching blunder-categorizer.js):
 *   Opening    → board moves 1-10  (ply 1-20)
 *   Middlegame → board moves 11-40 (ply 21-80)
 *   Endgame    → board moves 41+   (ply 81+)
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH ||
  path.join(__dirname, '../data/chess-analysis.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('Cannot open DB:', err.message); process.exit(1); }
  console.log(`Opened DB: ${DB_PATH}`);
});

// Promisify helpers
const all  = (sql, p=[]) => new Promise((res,rej) => db.all(sql,p,(e,r)=>e?rej(e):res(r)));
const run  = (sql, p=[]) => new Promise((res,rej) => db.run(sql,p,function(e){e?rej(e):res(this)}));
const get  = (sql, p=[]) => new Promise((res,rej) => db.get(sql,p,(e,r)=>e?rej(e):res(r)));

function calcAccuracy(moves) {
  if (!moves.length) return 0;
  const totalCpl = moves.reduce((s,m) => s + (m.centipawn_loss || 0), 0);
  const avgCpl   = totalCpl / moves.length;
  return Math.max(0, Math.round(100 - avgCpl / 3));
}

async function main() {
  // Find games that have analysis but no phase_stats
  const games = await all(`
    SELECT g.id, g.user_color
    FROM games g
    WHERE EXISTS (SELECT 1 FROM analysis a WHERE a.game_id = g.id)
      AND NOT EXISTS (SELECT 1 FROM phase_stats ps WHERE ps.game_id = g.id)
  `);

  console.log(`Found ${games.length} games to backfill.`);
  if (!games.length) { db.close(); return; }

  let ok = 0, skipped = 0;

  for (const game of games) {
    const { id: gameId, user_color: userColor } = game;

    if (!userColor) {
      console.warn(`  Game ${gameId}: no user_color, skipping.`);
      skipped++;
      continue;
    }

    // Odd ply = white's move, even ply = black's move
    const isWhite = userColor === 'white';
    const moves   = await all(
      `SELECT move_number, centipawn_loss, is_blunder
       FROM analysis
       WHERE game_id = ?
         AND move_number % 2 = ?
       ORDER BY move_number`,
      [gameId, isWhite ? 1 : 0]
    );

    if (!moves.length) {
      console.warn(`  Game ${gameId}: no player moves in analysis, skipping.`);
      skipped++;
      continue;
    }

    const opening    = moves.filter(m => m.move_number <= 20);
    const middlegame = moves.filter(m => m.move_number > 20 && m.move_number <= 80);
    const endgame    = moves.filter(m => m.move_number > 80);

    await run(
      `INSERT OR REPLACE INTO phase_stats
         (game_id,
          opening_accuracy,    middlegame_accuracy,    endgame_accuracy,
          opening_blunders,    middlegame_blunders,    endgame_blunders,
          opening_moves,       middlegame_moves,       endgame_moves)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        gameId,
        calcAccuracy(opening),    calcAccuracy(middlegame),    calcAccuracy(endgame),
        opening.filter(m=>m.is_blunder).length,
        middlegame.filter(m=>m.is_blunder).length,
        endgame.filter(m=>m.is_blunder).length,
        opening.length, middlegame.length, endgame.length,
      ]
    );

    console.log(`  Game ${gameId} (${userColor}): opening=${calcAccuracy(opening)}%  middlegame=${calcAccuracy(middlegame)}%  endgame=${calcAccuracy(endgame)}%`);
    ok++;
  }

  console.log(`\nDone. Backfilled: ${ok}  Skipped: ${skipped}`);
  db.close();
}

main().catch(err => { console.error(err); db.close(); process.exit(1); });
