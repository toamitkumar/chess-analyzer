const request = require('supertest');
const express = require('express');
const path = require('path');
const { Database } = require('../../src/models/database');

describe('Blunder Dashboard API Endpoints', () => {
  let app;
  let database;
  const TARGET_PLAYER = 'TestPlayer';
  const TEST_DB_PATH = path.join(__dirname, '../data/chess_analysis_test.db');

  beforeAll(async () => {
    // Initialize test database
    database = new Database(TEST_DB_PATH);
    await database.initialize();

    // Create Express app with dashboard endpoints
    app = express();
    app.use(express.json());

    // GET /api/blunders/dashboard - Dashboard statistics endpoint
    app.get('/api/blunders/dashboard', async (req, res) => {
      try {
        const allBlunders = await database.all(`
          SELECT bd.*, g.white_player, g.black_player, g.date, g.event
          FROM blunder_details bd
          JOIN games g ON bd.game_id = g.id
          WHERE bd.is_blunder = TRUE
            AND ((g.white_player = ? AND bd.player_color = 'white')
              OR (g.black_player = ? AND bd.player_color = 'black'))
          ORDER BY bd.created_at DESC
        `, [TARGET_PLAYER, TARGET_PLAYER]);

        const totalBlunders = allBlunders.length;
        const avgCentipawnLoss = totalBlunders > 0
          ? Math.round(allBlunders.reduce((sum, b) => sum + b.centipawn_loss, 0) / totalBlunders)
          : 0;

        const mostCostly = allBlunders.length > 0
          ? allBlunders.reduce((max, b) => b.centipawn_loss > max.centipawn_loss ? b : max)
          : null;

        // Calculate trend (last 30 days vs previous 30 days)
        const now = new Date();
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const recentBlunders = allBlunders.filter(b => new Date(b.created_at) >= last30Days);
        const previousBlunders = allBlunders.filter(b => {
          const date = new Date(b.created_at);
          return date >= last60Days && date < last30Days;
        });

        const trend = {
          lastMonth: recentBlunders.length,
          previousMonth: previousBlunders.length,
          change: previousBlunders.length > 0
            ? ((recentBlunders.length - previousBlunders.length) / previousBlunders.length * 100).toFixed(1)
            : 0,
          improving: recentBlunders.length < previousBlunders.length
        };

        // Aggregate by phase
        const byPhase = {
          opening: allBlunders.filter(b => b.phase === 'opening'),
          middlegame: allBlunders.filter(b => b.phase === 'middlegame'),
          endgame: allBlunders.filter(b => b.phase === 'endgame')
        };

        const phaseStats = {
          opening: {
            count: byPhase.opening.length,
            percentage: totalBlunders > 0 ? ((byPhase.opening.length / totalBlunders) * 100).toFixed(1) : 0,
            avgLoss: byPhase.opening.length > 0
              ? Math.round(byPhase.opening.reduce((sum, b) => sum + b.centipawn_loss, 0) / byPhase.opening.length)
              : 0
          },
          middlegame: {
            count: byPhase.middlegame.length,
            percentage: totalBlunders > 0 ? ((byPhase.middlegame.length / totalBlunders) * 100).toFixed(1) : 0,
            avgLoss: byPhase.middlegame.length > 0
              ? Math.round(byPhase.middlegame.reduce((sum, b) => sum + b.centipawn_loss, 0) / byPhase.middlegame.length)
              : 0
          },
          endgame: {
            count: byPhase.endgame.length,
            percentage: totalBlunders > 0 ? ((byPhase.endgame.length / totalBlunders) * 100).toFixed(1) : 0,
            avgLoss: byPhase.endgame.length > 0
              ? Math.round(byPhase.endgame.reduce((sum, b) => sum + b.centipawn_loss, 0) / byPhase.endgame.length)
              : 0
          }
        };

        // Aggregate by tactical theme
        const themeMap = {};
        allBlunders.forEach(b => {
          const theme = b.tactical_theme || 'unknown';
          if (!themeMap[theme]) {
            themeMap[theme] = { count: 0, totalLoss: 0 };
          }
          themeMap[theme].count++;
          themeMap[theme].totalLoss += b.centipawn_loss;
        });

        const byTheme = Object.entries(themeMap)
          .map(([theme, data]) => ({
            theme,
            count: data.count,
            percentage: totalBlunders > 0 ? ((data.count / totalBlunders) * 100).toFixed(1) : 0,
            avgLoss: Math.round(data.totalLoss / data.count)
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const learnedBlunders = allBlunders.filter(b => b.learned).length;
        const unlearnedBlunders = totalBlunders - learnedBlunders;

        res.json({
          overview: {
            totalBlunders,
            avgCentipawnLoss,
            mostCostlyBlunder: mostCostly ? {
              gameId: mostCostly.game_id,
              moveNumber: mostCostly.move_number,
              loss: mostCostly.centipawn_loss
            } : null,
            trend
          },
          byPhase: phaseStats,
          byTheme,
          learningProgress: {
            learnedCount: learnedBlunders,
            unlearnedCount: unlearnedBlunders,
            totalCount: totalBlunders,
            percentage: totalBlunders > 0 ? ((learnedBlunders / totalBlunders) * 100).toFixed(1) : 0
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // GET /api/blunders/timeline - Timeline endpoint
    app.get('/api/blunders/timeline', async (req, res) => {
      try {
        const { startDate, endDate } = req.query;

        let query = `
          SELECT
            DATE(bd.created_at) as date,
            COUNT(*) as count,
            AVG(bd.centipawn_loss) as avgLoss
          FROM blunder_details bd
          JOIN games g ON bd.game_id = g.id
          WHERE bd.is_blunder = TRUE
            AND ((g.white_player = ? AND bd.player_color = 'white')
              OR (g.black_player = ? AND bd.player_color = 'black'))
        `;
        const params = [TARGET_PLAYER, TARGET_PLAYER];

        if (startDate) {
          query += ' AND DATE(bd.created_at) >= ?';
          params.push(startDate);
        }

        if (endDate) {
          query += ' AND DATE(bd.created_at) <= ?';
          params.push(endDate);
        }

        query += ' GROUP BY DATE(bd.created_at) ORDER BY date DESC';

        const timeline = await database.all(query, params);

        const formattedData = timeline.map(row => ({
          date: row.date,
          count: row.count,
          avgLoss: Math.round(row.avgLoss)
        }));

        res.json({
          data: formattedData,
          totalDays: formattedData.length
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  });

  beforeEach(async () => {
    // Clear test data before each test (child tables first due to foreign keys)
    await database.run('PRAGMA foreign_keys = OFF');
    await database.run('DELETE FROM blunder_details');
    await database.run('DELETE FROM games');
    await database.run('PRAGMA foreign_keys = ON');
  });

  afterAll(async () => {
    // Clean up and close database
    try {
      await database.run('PRAGMA foreign_keys = OFF');
      await database.run('DELETE FROM blunder_details');
      await database.run('DELETE FROM games');
      await database.run('PRAGMA foreign_keys = ON');
      await database.close();
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  });

  describe('GET /api/blunders/dashboard', () => {
    it('should return empty dashboard when no blunders exist', async () => {
      const response = await request(app)
        .get('/api/blunders/dashboard')
        .expect(200);

      expect(response.body.overview.totalBlunders).toBe(0);
      expect(response.body.overview.avgCentipawnLoss).toBe(0);
      expect(response.body.overview.mostCostlyBlunder).toBeNull();
      expect(response.body.byPhase.opening.count).toBe(0);
      expect(response.body.byPhase.middlegame.count).toBe(0);
      expect(response.body.byPhase.endgame.count).toBe(0);
      expect(response.body.byTheme).toEqual([]);
      expect(response.body.learningProgress.totalCount).toBe(0);
    });

    it('should return correct statistics with blunders', async () => {
      // Insert test game
      await database.run(`
        INSERT INTO games (id, white_player, black_player, result, date, event, pgn_file_path)
        VALUES (1, 'TestPlayer', 'Opponent', '0-1', '2024-01-15', 'Test Tournament', 'test.pgn')
      `);

      // Insert test blunders
      await database.run(`
        INSERT INTO blunder_details
        (game_id, move_number, fen, phase, player_move, best_move, evaluation_before, evaluation_after,
         centipawn_loss, tactical_theme, is_blunder, player_color, created_at)
        VALUES
        (1, 10, 'fen1', 'opening', 'Nf3', 'Nc3', 0.5, -2.5, 300, 'hanging_piece', TRUE, 'white', '2024-01-15'),
        (1, 25, 'fen2', 'middlegame', 'Qh4', 'Qd2', 1.0, -2.0, 400, 'fork', TRUE, 'white', '2024-01-15'),
        (1, 45, 'fen3', 'endgame', 'Kf1', 'Kg1', 0.0, -3.5, 350, 'pin', TRUE, 'white', '2024-01-15')
      `);

      const response = await request(app)
        .get('/api/blunders/dashboard')
        .expect(200);

      expect(response.body.overview.totalBlunders).toBe(3);
      expect(response.body.overview.avgCentipawnLoss).toBe(350); // (300 + 400 + 350) / 3
      expect(response.body.overview.mostCostlyBlunder.loss).toBe(400);
      expect(response.body.overview.mostCostlyBlunder.moveNumber).toBe(25);

      // Check phase distribution
      expect(response.body.byPhase.opening.count).toBe(1);
      expect(response.body.byPhase.middlegame.count).toBe(1);
      expect(response.body.byPhase.endgame.count).toBe(1);
      expect(response.body.byPhase.opening.avgLoss).toBe(300);
      expect(response.body.byPhase.middlegame.avgLoss).toBe(400);

      // Check theme distribution
      expect(response.body.byTheme.length).toBe(3);
      expect(response.body.byTheme.find(t => t.theme === 'fork').count).toBe(1);
    });

    it('should only count target player blunders, not opponent blunders', async () => {
      // Insert test game where TestPlayer is white
      await database.run(`
        INSERT INTO games (id, white_player, black_player, result, date, event, pgn_file_path)
        VALUES (1, 'TestPlayer', 'Opponent', '0-1', '2024-01-15', 'Test Tournament', 'test.pgn')
      `);

      // Insert blunders from both players
      await database.run(`
        INSERT INTO blunder_details
        (game_id, move_number, fen, phase, player_move, best_move, evaluation_before, evaluation_after,
         centipawn_loss, tactical_theme, is_blunder, player_color, created_at)
        VALUES
        (1, 10, 'fen1', 'opening', 'Nf3', 'Nc3', 0.5, -2.5, 300, 'hanging_piece', TRUE, 'white', '2024-01-15'),
        (1, 11, 'fen2', 'opening', 'e5', 'e6', -0.5, 2.0, 350, 'fork', TRUE, 'black', '2024-01-15'),
        (1, 12, 'fen3', 'opening', 'Qh4', 'Qd2', 0.5, -2.5, 400, 'pin', TRUE, 'white', '2024-01-15')
      `);

      const response = await request(app)
        .get('/api/blunders/dashboard')
        .expect(200);

      // Should only count TestPlayer's blunders (white), not opponent's (black)
      expect(response.body.overview.totalBlunders).toBe(2);
      expect(response.body.byTheme.find(t => t.theme === 'fork')).toBeUndefined();
    });

    it('should exclude mistakes and inaccuracies, only count blunders', async () => {
      await database.run(`
        INSERT INTO games (id, white_player, black_player, result, date, event, pgn_file_path)
        VALUES (1, 'TestPlayer', 'Opponent', '0-1', '2024-01-15', 'Test Tournament', 'test.pgn')
      `);

      // Insert mixed quality moves
      await database.run(`
        INSERT INTO blunder_details
        (game_id, move_number, fen, phase, player_move, best_move, evaluation_before, evaluation_after,
         centipawn_loss, tactical_theme, is_blunder, is_mistake, is_inaccuracy, player_color, created_at)
        VALUES
        (1, 10, 'fen1', 'opening', 'Nf3', 'Nc3', 0.5, -2.5, 300, 'hanging_piece', TRUE, FALSE, FALSE, 'white', '2024-01-15'),
        (1, 11, 'fen2', 'opening', 'e4', 'e5', 0.5, -0.5, 150, 'positional', FALSE, TRUE, FALSE, 'white', '2024-01-15'),
        (1, 12, 'fen3', 'opening', 'd4', 'd3', 0.0, -0.3, 75, 'timing', FALSE, FALSE, TRUE, 'white', '2024-01-15')
      `);

      const response = await request(app)
        .get('/api/blunders/dashboard')
        .expect(200);

      // Should only count blunders (is_blunder = TRUE)
      expect(response.body.overview.totalBlunders).toBe(1);
      expect(response.body.overview.avgCentipawnLoss).toBe(300);
    });

    it('should calculate learning progress correctly', async () => {
      await database.run(`
        INSERT INTO games (id, white_player, black_player, result, date, event, pgn_file_path)
        VALUES (1, 'TestPlayer', 'Opponent', '0-1', '2024-01-15', 'Test Tournament', 'test.pgn')
      `);

      // Insert blunders with mixed learned status
      await database.run(`
        INSERT INTO blunder_details
        (game_id, move_number, fen, phase, player_move, best_move, evaluation_before, evaluation_after,
         centipawn_loss, tactical_theme, is_blunder, player_color, learned, created_at)
        VALUES
        (1, 10, 'fen1', 'opening', 'Nf3', 'Nc3', 0.5, -2.5, 300, 'hanging_piece', TRUE, 'white', TRUE, '2024-01-15'),
        (1, 20, 'fen2', 'middlegame', 'Qh4', 'Qd2', 1.0, -2.0, 400, 'fork', TRUE, 'white', FALSE, '2024-01-15'),
        (1, 30, 'fen3', 'endgame', 'Kf1', 'Kg1', 0.0, -3.5, 350, 'pin', TRUE, 'white', TRUE, '2024-01-15')
      `);

      const response = await request(app)
        .get('/api/blunders/dashboard')
        .expect(200);

      expect(response.body.learningProgress.totalCount).toBe(3);
      expect(response.body.learningProgress.learnedCount).toBe(2);
      expect(response.body.learningProgress.unlearnedCount).toBe(1);
      expect(parseFloat(response.body.learningProgress.percentage)).toBeCloseTo(66.7, 1);
    });

    it('should calculate phase percentages correctly', async () => {
      await database.run(`
        INSERT INTO games (id, white_player, black_player, result, date, event, pgn_file_path)
        VALUES (1, 'TestPlayer', 'Opponent', '0-1', '2024-01-15', 'Test Tournament', 'test.pgn')
      `);

      // 2 opening, 1 middlegame, 1 endgame = 4 total
      await database.run(`
        INSERT INTO blunder_details
        (game_id, move_number, fen, phase, player_move, best_move, evaluation_before, evaluation_after,
         centipawn_loss, tactical_theme, is_blunder, player_color, created_at)
        VALUES
        (1, 5, 'fen1', 'opening', 'e4', 'e3', 0.5, -2.5, 300, 'hanging_piece', TRUE, 'white', '2024-01-15'),
        (1, 10, 'fen2', 'opening', 'Nf3', 'Nc3', 0.5, -2.5, 300, 'fork', TRUE, 'white', '2024-01-15'),
        (1, 25, 'fen3', 'middlegame', 'Qh4', 'Qd2', 1.0, -2.0, 400, 'pin', TRUE, 'white', '2024-01-15'),
        (1, 45, 'fen4', 'endgame', 'Kf1', 'Kg1', 0.0, -3.5, 350, 'skewer', TRUE, 'white', '2024-01-15')
      `);

      const response = await request(app)
        .get('/api/blunders/dashboard')
        .expect(200);

      expect(parseFloat(response.body.byPhase.opening.percentage)).toBeCloseTo(50.0, 1); // 2/4
      expect(parseFloat(response.body.byPhase.middlegame.percentage)).toBeCloseTo(25.0, 1); // 1/4
      expect(parseFloat(response.body.byPhase.endgame.percentage)).toBeCloseTo(25.0, 1); // 1/4
    });
  });

  describe('GET /api/blunders/timeline', () => {
    it('should return empty timeline when no blunders exist', async () => {
      const response = await request(app)
        .get('/api/blunders/timeline')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.totalDays).toBe(0);
    });

    it('should group blunders by date', async () => {
      await database.run(`
        INSERT INTO games (id, white_player, black_player, result, date, event, pgn_file_path)
        VALUES (1, 'TestPlayer', 'Opponent', '0-1', '2024-01-15', 'Test Tournament', 'test.pgn')
      `);

      await database.run(`
        INSERT INTO blunder_details
        (game_id, move_number, fen, phase, player_move, best_move, evaluation_before, evaluation_after,
         centipawn_loss, tactical_theme, is_blunder, player_color, created_at)
        VALUES
        (1, 10, 'fen1', 'opening', 'Nf3', 'Nc3', 0.5, -2.5, 300, 'hanging_piece', TRUE, 'white', '2024-01-15'),
        (1, 20, 'fen2', 'middlegame', 'Qh4', 'Qd2', 1.0, -2.0, 400, 'fork', TRUE, 'white', '2024-01-15')
      `);

      const response = await request(app)
        .get('/api/blunders/timeline')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].count).toBe(2);
      expect(response.body.data[0].avgLoss).toBe(350); // (300 + 400) / 2
    });

    it('should filter by date range when provided', async () => {
      await database.run(`
        INSERT INTO games (id, white_player, black_player, result, date, event, pgn_file_path)
        VALUES (1, 'TestPlayer', 'Opponent', '0-1', '2024-01-15', 'Test Tournament', 'test.pgn')
      `);

      await database.run(`
        INSERT INTO blunder_details
        (game_id, move_number, fen, phase, player_move, best_move, evaluation_before, evaluation_after,
         centipawn_loss, tactical_theme, is_blunder, player_color, created_at)
        VALUES
        (1, 10, 'fen1', 'opening', 'Nf3', 'Nc3', 0.5, -2.5, 300, 'hanging_piece', TRUE, 'white', '2024-01-10'),
        (1, 20, 'fen2', 'middlegame', 'Qh4', 'Qd2', 1.0, -2.0, 400, 'fork', TRUE, 'white', '2024-01-20')
      `);

      const response = await request(app)
        .get('/api/blunders/timeline')
        .query({ startDate: '2024-01-15', endDate: '2024-01-25' })
        .expect(200);

      // Should only include blunder from 2024-01-20
      expect(response.body.data.find(d => d.date.includes('2024-01-20'))).toBeDefined();
      expect(response.body.data.find(d => d.date.includes('2024-01-10'))).toBeUndefined();
    });
  });
});
