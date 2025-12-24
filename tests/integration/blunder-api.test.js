const request = require('supertest');
const express = require('express');
const { getDatabase } = require('../../src/models/database');

// Mock database for testing
jest.mock('../../src/models/database');

describe('Blunder API Endpoints', () => {
  let app;
  let mockDatabase;

  beforeEach(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());

    // Mock database
    mockDatabase = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn()
    };

    getDatabase.mockReturnValue(mockDatabase);

    // We'll define endpoints inline for testing instead of importing the whole server
    const database = mockDatabase;

    // GET /api/blunders
    app.get('/api/blunders', async (req, res) => {
      try {
        const { phase, theme, learned, severity, minDifficulty, maxDifficulty } = req.query;

        let query = `
          SELECT bd.*, g.white_player, g.black_player, g.date, g.event
          FROM blunder_details bd
          JOIN games g ON bd.game_id = g.id
          WHERE 1=1
        `;
        const params = [];

        if (phase) {
          query += ' AND bd.phase = ?';
          params.push(phase);
        }
        if (theme) {
          query += ' AND bd.tactical_theme = ?';
          params.push(theme);
        }
        if (learned !== undefined) {
          query += ' AND bd.learned = ?';
          params.push(learned === 'true' ? 1 : 0);
        }
        if (severity) {
          query += ' AND bd.blunder_severity = ?';
          params.push(severity);
        }
        if (minDifficulty) {
          query += ' AND bd.difficulty_level >= ?';
          params.push(parseInt(minDifficulty));
        }
        if (maxDifficulty) {
          query += ' AND bd.difficulty_level <= ?';
          params.push(parseInt(maxDifficulty));
        }

        query += ' ORDER BY bd.created_at DESC';

        const blunders = await database.all(query, params);

        res.json({
          count: blunders.length,
          blunders: blunders
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // GET /api/blunders/by-phase/:phase
    app.get('/api/blunders/by-phase/:phase', async (req, res) => {
      try {
        const { phase } = req.params;

        if (!['opening', 'middlegame', 'endgame'].includes(phase)) {
          return res.status(400).json({ error: 'Invalid phase. Must be opening, middlegame, or endgame' });
        }

        const blunders = await database.all(`
          SELECT bd.*, g.white_player, g.black_player, g.date, g.event
          FROM blunder_details bd
          JOIN games g ON bd.game_id = g.id
          WHERE bd.phase = ?
          ORDER BY bd.centipawn_loss DESC
        `, [phase]);

        const stats = {
          totalBlunders: blunders.length,
          averageCentipawnLoss: blunders.length > 0
            ? Math.round(blunders.reduce((sum, b) => sum + b.centipawn_loss, 0) / blunders.length)
            : 0,
          severityBreakdown: {
            minor: blunders.filter(b => b.blunder_severity === 'minor').length,
            moderate: blunders.filter(b => b.blunder_severity === 'moderate').length,
            major: blunders.filter(b => b.blunder_severity === 'major').length,
            critical: blunders.filter(b => b.blunder_severity === 'critical').length
          },
          learned: blunders.filter(b => b.learned).length,
          unlearned: blunders.filter(b => !b.learned).length
        };

        res.json({
          phase: phase,
          stats: stats,
          blunders: blunders
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // GET /api/blunders/by-theme/:theme
    app.get('/api/blunders/by-theme/:theme', async (req, res) => {
      try {
        const { theme } = req.params;

        const blunders = await database.all(`
          SELECT bd.*, g.white_player, g.black_player, g.date, g.event
          FROM blunder_details bd
          JOIN games g ON bd.game_id = g.id
          WHERE bd.tactical_theme = ?
          ORDER BY bd.centipawn_loss DESC
        `, [theme]);

        const stats = {
          totalBlunders: blunders.length,
          averageCentipawnLoss: blunders.length > 0
            ? Math.round(blunders.reduce((sum, b) => sum + b.centipawn_loss, 0) / blunders.length)
            : 0,
          phaseBreakdown: {
            opening: blunders.filter(b => b.phase === 'opening').length,
            middlegame: blunders.filter(b => b.phase === 'middlegame').length,
            endgame: blunders.filter(b => b.phase === 'endgame').length
          },
          learned: blunders.filter(b => b.learned).length,
          averageDifficulty: blunders.length > 0
            ? (blunders.reduce((sum, b) => sum + b.difficulty_level, 0) / blunders.length).toFixed(1)
            : 0
        };

        res.json({
          theme: theme,
          stats: stats,
          blunders: blunders
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // GET /api/blunders/unlearned
    app.get('/api/blunders/unlearned', async (req, res) => {
      try {
        const { minMastery = 70 } = req.query;

        const blunders = await database.all(`
          SELECT bd.*, g.white_player, g.black_player, g.date, g.event
          FROM blunder_details bd
          JOIN games g ON bd.game_id = g.id
          WHERE bd.learned = 0 OR bd.mastery_score < ?
          ORDER BY bd.difficulty_level DESC, bd.centipawn_loss DESC
        `, [minMastery]);

        const byTheme = {};
        blunders.forEach(blunder => {
          const theme = blunder.tactical_theme || 'unknown';
          if (!byTheme[theme]) {
            byTheme[theme] = [];
          }
          byTheme[theme].push(blunder);
        });

        res.json({
          totalUnlearned: blunders.length,
          byTheme: byTheme,
          blunders: blunders
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // PUT /api/blunders/:id/review
    app.put('/api/blunders/:id/review', async (req, res) => {
      try {
        const blunderId = parseInt(req.params.id);

        const blunder = await database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);
        if (!blunder) {
          return res.status(404).json({ error: 'Blunder not found' });
        }

        const newReviewCount = (blunder.review_count || 0) + 1;
        const currentTimestamp = new Date().toISOString();
        const masteryIncrease = Math.min(15, 100 / (newReviewCount + 1));
        const newMasteryScore = Math.min(100, (blunder.mastery_score || 0) + masteryIncrease);

        await database.run(`
          UPDATE blunder_details
          SET review_count = ?,
              last_reviewed = ?,
              mastery_score = ?,
              updated_at = ?
          WHERE id = ?
        `, [newReviewCount, currentTimestamp, newMasteryScore, currentTimestamp, blunderId]);

        const updated = await database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);

        res.json({
          success: true,
          blunder: updated
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // PUT /api/blunders/:id/learned
    app.put('/api/blunders/:id/learned', async (req, res) => {
      try {
        const blunderId = parseInt(req.params.id);
        const { learned, notes } = req.body;

        const blunder = await database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);
        if (!blunder) {
          return res.status(404).json({ error: 'Blunder not found' });
        }

        const currentTimestamp = new Date().toISOString();
        const learnedValue = learned ? 1 : 0;
        const masteryScore = learned ? 100 : blunder.mastery_score;

        let query = `
          UPDATE blunder_details
          SET learned = ?,
              mastery_score = ?,
              updated_at = ?
        `;
        const params = [learnedValue, masteryScore, currentTimestamp];

        if (notes !== undefined) {
          query += ', notes = ?';
          params.push(notes);
        }

        query += ' WHERE id = ?';
        params.push(blunderId);

        await database.run(query, params);

        const updated = await database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);

        res.json({
          success: true,
          blunder: updated
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/blunders', () => {
    test('should return all blunders', async () => {
      const mockBlunders = [
        { id: 1, phase: 'opening', tactical_theme: 'hanging_piece', centipawn_loss: 150 },
        { id: 2, phase: 'middlegame', tactical_theme: 'missed_fork', centipawn_loss: 200 }
      ];

      mockDatabase.all.mockResolvedValue(mockBlunders);

      const response = await request(app).get('/api/blunders');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(2);
      expect(response.body.blunders).toEqual(mockBlunders);
    });

    test('should filter blunders by phase', async () => {
      const mockBlunders = [
        { id: 1, phase: 'opening', tactical_theme: 'hanging_piece', centipawn_loss: 150 }
      ];

      mockDatabase.all.mockResolvedValue(mockBlunders);

      const response = await request(app).get('/api/blunders?phase=opening');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.phase = ?'),
        expect.arrayContaining(['opening'])
      );
    });

    test('should filter blunders by theme', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await request(app).get('/api/blunders?theme=hanging_piece');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.tactical_theme = ?'),
        expect.arrayContaining(['hanging_piece'])
      );
    });

    test('should filter blunders by learned status', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await request(app).get('/api/blunders?learned=true');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.learned = ?'),
        expect.arrayContaining([1])
      );
    });

    test('should filter blunders by severity', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await request(app).get('/api/blunders?severity=major');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.blunder_severity = ?'),
        expect.arrayContaining(['major'])
      );
    });

    test('should filter by difficulty range', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await request(app).get('/api/blunders?minDifficulty=2&maxDifficulty=4');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('AND bd.difficulty_level >= ?'),
        expect.arrayContaining([2, 4])
      );
    });
  });

  describe('GET /api/blunders/by-phase/:phase', () => {
    test('should return blunders for valid phase', async () => {
      const mockBlunders = [
        { id: 1, phase: 'opening', centipawn_loss: 150, blunder_severity: 'moderate', learned: false },
        { id: 2, phase: 'opening', centipawn_loss: 200, blunder_severity: 'major', learned: true }
      ];

      mockDatabase.all.mockResolvedValue(mockBlunders);

      const response = await request(app).get('/api/blunders/by-phase/opening');

      expect(response.status).toBe(200);
      expect(response.body.phase).toBe('opening');
      expect(response.body.stats.totalBlunders).toBe(2);
      expect(response.body.stats.averageCentipawnLoss).toBe(175);
      expect(response.body.stats.severityBreakdown.moderate).toBe(1);
      expect(response.body.stats.severityBreakdown.major).toBe(1);
      expect(response.body.stats.learned).toBe(1);
      expect(response.body.stats.unlearned).toBe(1);
    });

    test('should reject invalid phase', async () => {
      const response = await request(app).get('/api/blunders/by-phase/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid phase');
    });
  });

  describe('GET /api/blunders/by-theme/:theme', () => {
    test('should return blunders for theme with stats', async () => {
      const mockBlunders = [
        { id: 1, tactical_theme: 'hanging_piece', phase: 'opening', centipawn_loss: 150, difficulty_level: 2, learned: false },
        { id: 2, tactical_theme: 'hanging_piece', phase: 'middlegame', centipawn_loss: 200, difficulty_level: 3, learned: true }
      ];

      mockDatabase.all.mockResolvedValue(mockBlunders);

      const response = await request(app).get('/api/blunders/by-theme/hanging_piece');

      expect(response.status).toBe(200);
      expect(response.body.theme).toBe('hanging_piece');
      expect(response.body.stats.totalBlunders).toBe(2);
      expect(response.body.stats.averageCentipawnLoss).toBe(175);
      expect(response.body.stats.phaseBreakdown.opening).toBe(1);
      expect(response.body.stats.phaseBreakdown.middlegame).toBe(1);
      expect(response.body.stats.learned).toBe(1);
      expect(response.body.stats.averageDifficulty).toBe('2.5');
    });
  });

  describe('GET /api/blunders/unlearned', () => {
    test('should return unlearned blunders grouped by theme', async () => {
      const mockBlunders = [
        { id: 1, tactical_theme: 'hanging_piece', learned: 0 },
        { id: 2, tactical_theme: 'hanging_piece', learned: 0 },
        { id: 3, tactical_theme: 'missed_fork', learned: 0 }
      ];

      mockDatabase.all.mockResolvedValue(mockBlunders);

      const response = await request(app).get('/api/blunders/unlearned');

      expect(response.status).toBe(200);
      expect(response.body.totalUnlearned).toBe(3);
      expect(response.body.byTheme.hanging_piece).toHaveLength(2);
      expect(response.body.byTheme.missed_fork).toHaveLength(1);
    });

    test('should respect minMastery parameter', async () => {
      mockDatabase.all.mockResolvedValue([]);

      await request(app).get('/api/blunders/unlearned?minMastery=80');

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.any(String),
        ["80"] // Query params are strings
      );
    });
  });

  describe('PUT /api/blunders/:id/review', () => {
    test('should increment review count and update mastery', async () => {
      const mockBlunder = {
        id: 1,
        review_count: 2,
        mastery_score: 30
      };

      const updatedBlunder = {
        id: 1,
        review_count: 3,
        mastery_score: 63.33,
        last_reviewed: expect.any(String)
      };

      mockDatabase.get
        .mockResolvedValueOnce(mockBlunder)
        .mockResolvedValueOnce(updatedBlunder);
      mockDatabase.run.mockResolvedValue({});

      const response = await request(app).put('/api/blunders/1/review');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE blunder_details'),
        expect.arrayContaining([3, expect.any(String), expect.any(Number), expect.any(String), 1])
      );
    });

    test('should return 404 for non-existent blunder', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const response = await request(app).put('/api/blunders/999/review');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Blunder not found');
    });
  });

  describe('PUT /api/blunders/:id/learned', () => {
    test('should mark blunder as learned', async () => {
      const mockBlunder = {
        id: 1,
        learned: 0,
        mastery_score: 50
      };

      const updatedBlunder = {
        id: 1,
        learned: 1,
        mastery_score: 100
      };

      mockDatabase.get
        .mockResolvedValueOnce(mockBlunder)
        .mockResolvedValueOnce(updatedBlunder);
      mockDatabase.run.mockResolvedValue({});

      const response = await request(app)
        .put('/api/blunders/1/learned')
        .send({ learned: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE blunder_details'),
        expect.arrayContaining([1, 100, expect.any(String), 1])
      );
    });

    test('should update notes when provided', async () => {
      const mockBlunder = { id: 1, learned: 0, mastery_score: 50 };
      mockDatabase.get
        .mockResolvedValueOnce(mockBlunder)
        .mockResolvedValueOnce({ ...mockBlunder, notes: 'Test notes' });
      mockDatabase.run.mockResolvedValue({});

      const response = await request(app)
        .put('/api/blunders/1/learned')
        .send({ learned: true, notes: 'Test notes' });

      expect(response.status).toBe(200);
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('notes = ?'),
        expect.arrayContaining(['Test notes'])
      );
    });

    test('should return 404 for non-existent blunder', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/blunders/999/learned')
        .send({ learned: true });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Blunder not found');
    });
  });
});
