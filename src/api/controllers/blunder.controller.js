/**
 * Blunder Controller
 *
 * Handles all blunder-related business logic including:
 * - Blunder listing with filters
 * - Blunders by phase and theme
 * - Unlearned blunders tracking
 * - Review and learning status updates
 * - Dashboard statistics
 * - Timeline analysis
 */

const { getDatabase } = require('../../models/database');

class BlunderController {
  /**
   * List all blunders with optional filters
   * GET /api/blunders
   */
  async list(req, res) {
    try {
      const { phase, theme, learned, severity, minDifficulty, maxDifficulty } = req.query;

      console.log('📝 [BLUNDER CONTROLLER] Blunders list requested');

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      let query = `
        SELECT bd.*, g.white_player, g.black_player, g.date, g.event, g.user_color
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE g.user_id = ? AND bd.player_color = g.user_color
      `;
      const params = [req.userId];

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
      console.error('[BLUNDER CONTROLLER] List error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get blunders by game phase
   * GET /api/blunders/by-phase/:phase
   */
  async getByPhase(req, res) {
    try {
      const { phase } = req.params;

      console.log(`📝 [BLUNDER CONTROLLER] Blunders by phase requested: ${phase}`);

      if (!['opening', 'middlegame', 'endgame'].includes(phase)) {
        return res.status(400).json({ error: 'Invalid phase. Must be opening, middlegame, or endgame' });
      }

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      const blunders = await database.all(`
        SELECT bd.*, g.white_player, g.black_player, g.date, g.event, g.user_color
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE g.user_id = ? AND bd.player_color = g.user_color AND bd.phase = ?
        ORDER BY bd.centipawn_loss DESC
      `, [req.userId, phase]);

      // Calculate statistics for this phase
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
      console.error('[BLUNDER CONTROLLER] Get by phase error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get blunders by tactical theme
   * GET /api/blunders/by-theme/:theme
   */
  async getByTheme(req, res) {
    try {
      const { theme } = req.params;

      console.log(`📝 [BLUNDER CONTROLLER] Blunders by theme requested: ${theme}`);

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      const blunders = await database.all(`
        SELECT bd.*, g.white_player, g.black_player, g.date, g.event, g.user_color
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE g.user_id = ? AND bd.player_color = g.user_color AND bd.tactical_theme = ?
        ORDER BY bd.centipawn_loss DESC
      `, [req.userId, theme]);

      // Calculate statistics for this theme
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
      console.error('[BLUNDER CONTROLLER] Get by theme error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get unlearned blunders
   * GET /api/blunders/unlearned
   */
  async getUnlearned(req, res) {
    try {
      const { minMastery = 70 } = req.query;

      console.log('📝 [BLUNDER CONTROLLER] Unlearned blunders requested');

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      const blunders = await database.all(`
        SELECT bd.*, g.white_player, g.black_player, g.date, g.event, g.user_color
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE g.user_id = ? AND bd.player_color = g.user_color AND (bd.learned = 0 OR bd.mastery_score < ?)
        ORDER BY bd.difficulty_level DESC, bd.centipawn_loss DESC
      `, [req.userId, minMastery]);

      // Group by tactical theme for learning prioritization
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
      console.error('[BLUNDER CONTROLLER] Get unlearned error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Mark blunder as reviewed
   * PUT /api/blunders/:id/review
   */
  async markReviewed(req, res) {
    try {
      const blunderId = parseInt(req.params.id);

      console.log(`📝 [BLUNDER CONTROLLER] Mark blunder ${blunderId} as reviewed`);

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      // Check if blunder exists and belongs to the authenticated user
      const blunder = await database.get(`
        SELECT bd.* FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.id = ? AND g.user_id = ?
      `, [blunderId, req.userId]);

      if (!blunder) {
        return res.status(404).json({ error: 'Blunder not found' });
      }

      // Increment review count and update last_reviewed
      const newReviewCount = (blunder.review_count || 0) + 1;
      const currentTimestamp = new Date().toISOString();

      // Calculate mastery score based on review count
      // Formula: mastery increases with reviews, caps at 100
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

      const updated = await database.get(`
        SELECT bd.* FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.id = ?
      `, [blunderId]);

      res.json({
        success: true,
        blunder: updated
      });
    } catch (error) {
      console.error('[BLUNDER CONTROLLER] Mark reviewed error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Mark blunder as learned/unlearned
   * PUT /api/blunders/:id/learned
   */
  async markLearned(req, res) {
    try {
      const blunderId = parseInt(req.params.id);
      const { learned, notes } = req.body;

      console.log(`📝 [BLUNDER CONTROLLER] Mark blunder ${blunderId} as ${learned ? 'learned' : 'unlearned'}`);

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      // Check if blunder exists and belongs to the authenticated user
      const blunder = await database.get(`
        SELECT bd.* FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.id = ? AND g.user_id = ?
      `, [blunderId, req.userId]);

      if (!blunder) {
        return res.status(404).json({ error: 'Blunder not found' });
      }

      const currentTimestamp = new Date().toISOString();
      const learnedValue = learned ? 1 : 0;

      // If marking as learned, set mastery to 100
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

      const updated = await database.get(`
        SELECT bd.* FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.id = ?
      `, [blunderId]);

      res.json({
        success: true,
        blunder: updated
      });
    } catch (error) {
      console.error('[BLUNDER CONTROLLER] Mark learned error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get dashboard statistics
   * GET /api/blunders/dashboard
   */
  async getDashboard(req, res) {
    try {
      console.log('📝 [BLUNDER CONTROLLER] Dashboard requested');

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      // Get all blunders with game info (only actual blunders by the authenticated user, not mistakes or inaccuracies)
      const allBlunders = await database.all(`
        SELECT bd.*, g.white_player, g.black_player, g.date, g.event, g.user_color
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE g.user_id = ? AND bd.player_color = g.user_color AND bd.is_blunder = TRUE
        ORDER BY bd.created_at DESC
      `, [req.userId]);

      // Calculate overview statistics
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

      // Phase breakdown
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
          themeMap[theme] = { count: 0, totalLoss: 0, blunders: [] };
        }
        themeMap[theme].count++;
        themeMap[theme].totalLoss += b.centipawn_loss;
        themeMap[theme].blunders.push(b);
      });

      const byTheme = Object.entries(themeMap)
        .map(([theme, data]) => ({
          theme,
          count: data.count,
          percentage: totalBlunders > 0 ? ((data.count / totalBlunders) * 100).toFixed(1) : 0,
          avgLoss: Math.round(data.totalLoss / data.count)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 themes

      // Aggregate by severity
      const bySeverity = {
        critical: allBlunders.filter(b => b.blunder_severity === 'critical').length,
        major: allBlunders.filter(b => b.blunder_severity === 'major').length,
        moderate: allBlunders.filter(b => b.blunder_severity === 'moderate').length,
        minor: allBlunders.filter(b => b.blunder_severity === 'minor').length
      };

      // Top patterns (theme + phase combinations)
      const patternMap = {};
      allBlunders.forEach(b => {
        const key = `${b.tactical_theme || 'unknown'}_${b.phase}`;
        const description = `${b.tactical_theme || 'Unknown'} in ${b.phase}`;
        if (!patternMap[key]) {
          patternMap[key] = {
            description,
            phase: b.phase,
            theme: b.tactical_theme || 'unknown',
            occurrences: 0,
            totalLoss: 0,
            learned: 0,
            blunders: []
          };
        }
        patternMap[key].occurrences++;
        patternMap[key].totalLoss += b.centipawn_loss;
        if (b.learned) patternMap[key].learned++;
        patternMap[key].blunders.push(b);
      });

      const topPatterns = Object.values(patternMap)
        .map(p => ({
          description: p.description,
          occurrences: p.occurrences,
          avgLoss: Math.round(p.totalLoss / p.occurrences),
          phase: p.phase,
          theme: p.theme,
          learned: p.learned === p.occurrences,
          learnedCount: p.learned,
          lastOccurrence: p.blunders[p.blunders.length - 1].created_at
        }))
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 10);

      // Learning progress
      const learnedBlunders = allBlunders.filter(b => b.learned).length;
      const unlearnedBlunders = totalBlunders - learnedBlunders;
      const masteredThemes = [...new Set(
        allBlunders.filter(b => b.learned && b.mastery_score >= 80).map(b => b.tactical_theme)
      )].filter(t => t);

      // Study recommendations
      const unlearnedThemes = Object.entries(themeMap)
        .filter(([theme, data]) => {
          const learned = data.blunders.filter(b => b.learned).length;
          return learned / data.count < 0.5; // Less than 50% learned
        })
        .map(([theme, data]) => ({
          theme,
          priority: data.count,
          reason: `${data.count} occurrences, ${data.blunders.filter(b => b.learned).length} learned`
        }))
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3);

      // Recent blunders (last 20)
      // Determine opponent based on user_color from games table
      const recentBlundersWithColor = await Promise.all(
        allBlunders.slice(0, 20).map(async b => {
          const game = await database.get('SELECT user_color FROM games WHERE id = ?', [b.game_id]);
          const opponent = game?.user_color === 'white' ? b.black_player : b.white_player;
          return {
            id: b.id,
            gameId: b.game_id,
            moveNumber: b.move_number,
            phase: b.phase,
            theme: b.tactical_theme,
            playerMove: b.player_move,
            bestMove: b.best_move,
            centipawnLoss: b.centipawn_loss,
            date: b.date,
            opponent,
            event: b.event,
            learned: b.learned
          };
        })
      );

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
        bySeverity,
        topPatterns,
        learningProgress: {
          learnedCount: learnedBlunders,
          unlearnedCount: unlearnedBlunders,
          totalCount: totalBlunders,
          percentage: totalBlunders > 0 ? ((learnedBlunders / totalBlunders) * 100).toFixed(1) : 0,
          masteredThemes,
          recommendations: unlearnedThemes
        },
        recentBlunders: recentBlundersWithColor
      });
    } catch (error) {
      console.error('[BLUNDER CONTROLLER] Dashboard error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get blunder timeline
   * GET /api/blunders/timeline
   */
  async getTimeline(req, res) {
    try {
      console.log('📝 [BLUNDER CONTROLLER] Timeline requested');

      const database = getDatabase();
      if (!database) {
        throw new Error('Database not initialized');
      }

      const { startDate, endDate } = req.query;

      let query = `
        SELECT
          DATE(bd.created_at) as date,
          COUNT(*) as count,
          AVG(bd.centipawn_loss) as avgLoss
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE g.user_id = ? AND bd.player_color = g.user_color AND bd.is_blunder = TRUE
      `;
      const params = [req.userId];

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
      console.error('[BLUNDER CONTROLLER] Timeline error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new BlunderController();
