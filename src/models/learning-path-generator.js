/**
 * Learning Path Generator
 * 
 * Generates personalized learning paths based on:
 * - Blunder frequency and severity
 * - Theme mastery levels
 * - Recent performance
 * - Daily goals
 * - Spaced repetition algorithm
 * - Adaptive difficulty progression
 */

class LearningPathGenerator {
  constructor(database, userId = 'default_user') {
    this.db = database;
    this.userId = userId;
    
    // Spaced repetition intervals (in days)
    this.spacedRepetitionIntervals = {
      learning: 1,      // Review after 1 day
      improving: 3,     // Review after 3 days
      mastered: 7       // Review after 7 days
    };
    
    // Difficulty progression thresholds
    this.difficultyThresholds = {
      beginner: { min: 0, max: 1400 },
      intermediate: { min: 1400, max: 1800 },
      advanced: { min: 1800, max: 2200 },
      expert: { min: 2200, max: 3000 }
    };
  }

  /**
   * Generate recommended puzzles for user
   * Prioritizes themes where user has most blunders and lowest mastery
   * 
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Recommended puzzles
   */
  async generateRecommendations(options = {}) {
    const {
      limit = 10,
      playerRating = 1500
    } = options;

    try {
      // Step 1: Get blunder themes with frequency
      const blunderThemes = await this.getBlunderThemeFrequency();

      if (blunderThemes.length === 0) {
        // No blunders yet, return popular puzzles
        return await this.getPopularPuzzles(limit, playerRating);
      }

      // Step 2: Get mastery scores for each theme
      const themeMastery = await this.getThemeMastery();

      // Step 3: Calculate priority scores
      const priorities = blunderThemes.map(theme => ({
        theme: theme.tactical_theme,
        frequency: theme.count,
        mastery: themeMastery[theme.tactical_theme] || 0,
        priority: this.calculatePriority(theme.count, themeMastery[theme.tactical_theme] || 0)
      }));

      // Sort by priority (highest first)
      priorities.sort((a, b) => b.priority - a.priority);

      // Step 4: Get puzzles for top priority themes
      const recommendations = [];
      
      for (const item of priorities) {
        if (recommendations.length >= limit) break;

        const puzzles = await this.getPuzzlesForTheme(
          item.theme,
          playerRating,
          limit - recommendations.length
        );

        recommendations.push(...puzzles);
      }

      return recommendations.slice(0, limit);

    } catch (error) {
      console.error('[LearningPath] Error generating recommendations:', error.message);
      return [];
    }
  }

  /**
   * Get blunder theme frequency
   * @returns {Promise<Array>} Themes with counts
   */
  async getBlunderThemeFrequency() {
    try {
      const themes = await this.db.all(`
        SELECT tactical_theme, COUNT(*) as count
        FROM blunder_details
        WHERE tactical_theme IS NOT NULL
        AND is_blunder = 1
        GROUP BY tactical_theme
        ORDER BY count DESC
      `);

      return themes;
    } catch (error) {
      console.error('[LearningPath] Error getting blunder themes:', error.message);
      return [];
    }
  }

  /**
   * Get mastery scores by theme
   * @returns {Promise<Object>} Theme -> mastery score mapping
   */
  async getThemeMastery() {
    try {
      // Get all progress with puzzle themes
      const progress = await this.db.all(`
        SELECT 
          upp.*,
          pi.themes
        FROM user_puzzle_progress upp
        JOIN puzzle_index pi ON upp.puzzle_id = pi.id
        WHERE upp.user_id = ? AND upp.attempts > 0
      `, [this.userId]);

      // Calculate mastery per theme
      const PuzzleProgressTracker = require('./puzzle-progress-tracker');
      const tracker = new PuzzleProgressTracker(this.db, this.userId);

      const themeScores = {};
      const themeCounts = {};

      for (const p of progress) {
        const masteryScore = tracker.calculateMasteryScore(p);
        const themes = p.themes.split(' ');
        
        for (const theme of themes) {
          if (!themeScores[theme]) {
            themeScores[theme] = 0;
            themeCounts[theme] = 0;
          }
          themeScores[theme] += masteryScore;
          themeCounts[theme]++;
        }
      }

      // Calculate averages
      const masteryMap = {};
      for (const theme in themeScores) {
        masteryMap[theme] = themeScores[theme] / themeCounts[theme];
      }

      return masteryMap;
    } catch (error) {
      console.error('[LearningPath] Error getting theme mastery:', error.message);
      return {};
    }
  }

  /**
   * Calculate priority score for a theme
   * Higher frequency + lower mastery = higher priority
   * 
   * @param {number} frequency - Number of blunders with this theme
   * @param {number} mastery - Mastery score (0-100)
   * @returns {number} Priority score
   */
  calculatePriority(frequency, mastery) {
    // Frequency component (0-100)
    const frequencyScore = Math.min(100, frequency * 10);

    // Mastery gap component (0-100)
    // Lower mastery = higher priority
    const masteryGap = 100 - mastery;

    // Combined priority (weighted average)
    // Frequency: 60%, Mastery gap: 40%
    const priority = (frequencyScore * 0.6) + (masteryGap * 0.4);

    return Math.round(priority);
  }

  /**
   * Get puzzles for a specific theme
   * @param {string} theme - Theme name
   * @param {number} playerRating - Player rating
   * @param {number} limit - Max puzzles
   * @returns {Promise<Array>} Puzzles
   */
  async getPuzzlesForTheme(theme, playerRating, limit) {
    try {
      const ratingMin = playerRating - 200;
      const ratingMax = playerRating + 200;

      const puzzles = await this.db.all(`
        SELECT id, themes, rating, popularity
        FROM puzzle_index
        WHERE themes LIKE ?
        AND rating BETWEEN ? AND ?
        ORDER BY popularity DESC
        LIMIT ?
      `, [`%${theme}%`, ratingMin, ratingMax, limit]);

      return puzzles;
    } catch (error) {
      console.error(`[LearningPath] Error getting puzzles for theme ${theme}:`, error.message);
      return [];
    }
  }

  /**
   * Get popular puzzles (fallback when no blunders)
   * @param {number} limit - Max puzzles
   * @param {number} playerRating - Player rating
   * @returns {Promise<Array>} Popular puzzles
   */
  async getPopularPuzzles(limit, playerRating) {
    try {
      const ratingMin = playerRating - 200;
      const ratingMax = playerRating + 200;

      const puzzles = await this.db.all(`
        SELECT id, themes, rating, popularity
        FROM puzzle_index
        WHERE rating BETWEEN ? AND ?
        ORDER BY popularity DESC
        LIMIT ?
      `, [ratingMin, ratingMax, limit]);

      return puzzles;
    } catch (error) {
      console.error('[LearningPath] Error getting popular puzzles:', error.message);
      return [];
    }
  }

  /**
   * Generate daily goals
   * @returns {Promise<Object>} Daily goals
   */
  async generateDailyGoals() {
    try {
      // Get today's progress
      const isPostgres = this.db.usePostgres;
      const todayStart = isPostgres 
        ? "date_trunc('day', NOW())"
        : "date('now', 'start of day')";

      const todayStats = await this.db.get(`
        SELECT 
          COUNT(*) as puzzles_attempted,
          SUM(CASE WHEN solved = 1 THEN 1 ELSE 0 END) as puzzles_solved
        FROM user_puzzle_progress
        WHERE user_id = ? AND last_attempted_at >= ${todayStart}
      `, [this.userId]);

      // Daily goals
      const goals = {
        puzzlesTarget: 10,
        puzzlesCompleted: todayStats.puzzles_attempted || 0,
        puzzlesSolved: todayStats.puzzles_solved || 0,
        progress: Math.min(100, ((todayStats.puzzles_attempted || 0) / 10) * 100)
      };

      return goals;
    } catch (error) {
      console.error('[LearningPath] Error generating daily goals:', error.message);
      return {
        puzzlesTarget: 10,
        puzzlesCompleted: 0,
        puzzlesSolved: 0,
        progress: 0
      };
    }
  }

  /**
   * Get learning path summary
   * @returns {Promise<Object>} Learning path data
   */
  async getLearningPath() {
    try {
      const recommendations = await this.generateRecommendations({ limit: 10 });
      const dailyGoals = await this.generateDailyGoals();
      const statistics = await this.getStatistics();
      const weakThemes = await this.getWeakestThemes(5);

      return {
        recommendations,
        dailyGoals,
        statistics,
        weakThemes
      };
    } catch (error) {
      console.error('[LearningPath] Error getting learning path:', error.message);
      throw error;
    }
  }

  /**
   * Get weakest themes (lowest mastery)
   * @param {number} limit - Max themes
   * @returns {Promise<Array>} Weak themes
   */
  async getWeakestThemes(limit) {
    try {
      const blunderThemes = await this.getBlunderThemeFrequency();
      const themeMastery = await this.getThemeMastery();

      const themes = blunderThemes.map(theme => ({
        theme: theme.tactical_theme,
        frequency: theme.count,
        mastery: themeMastery[theme.tactical_theme] || 0
      }));

      // Sort by mastery (lowest first)
      themes.sort((a, b) => a.mastery - b.mastery);

      return themes.slice(0, limit);
    } catch (error) {
      console.error('[LearningPath] Error getting weakest themes:', error.message);
      return [];
    }
  }

  /**
   * Get statistics summary
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    try {
      const PuzzleProgressTracker = require('./puzzle-progress-tracker');
      const tracker = new PuzzleProgressTracker(this.db);
      return await tracker.getStatistics();
    } catch (error) {
      console.error('[LearningPath] Error getting statistics:', error.message);
      return {
        totalPuzzles: 0,
        totalAttempts: 0,
        totalSolved: 0,
        averageMastery: 0,
        bestStreak: 0,
        successRate: 0
      };
    }
  }

  /**
   * Get puzzles due for review (spaced repetition)
   * @returns {Promise<Array>} Puzzles due for review
   */
  async getPuzzlesDueForReview() {
    try {
      const isPostgres = this.db.usePostgres;
      
      // Calculate review dates based on solved status and streak
      // Solved puzzles: review after 7 days, unsolved: review after 1 day
      const query = isPostgres ? `
        SELECT 
          upp.*,
          pi.themes,
          pi.rating,
          CASE 
            WHEN upp.solved = true AND upp.streak >= 3 THEN upp.last_attempted_at + INTERVAL '7 days'
            WHEN upp.solved = true THEN upp.last_attempted_at + INTERVAL '3 days'
            ELSE upp.last_attempted_at + INTERVAL '1 day'
          END as next_review
        FROM user_puzzle_progress upp
        JOIN puzzle_index pi ON upp.puzzle_id = pi.id
        WHERE upp.user_id = $1 AND upp.attempts > 0 AND CASE 
          WHEN upp.solved = true AND upp.streak >= 3 THEN upp.last_attempted_at + INTERVAL '7 days' <= NOW()
          WHEN upp.solved = true THEN upp.last_attempted_at + INTERVAL '3 days' <= NOW()
          ELSE upp.last_attempted_at + INTERVAL '1 day' <= NOW()
        END
        ORDER BY next_review ASC
        LIMIT 20
      ` : `
        SELECT 
          upp.*,
          pi.themes,
          pi.rating,
          CASE 
            WHEN upp.solved = 1 AND upp.streak >= 3 THEN datetime(upp.last_attempted_at, '+7 days')
            WHEN upp.solved = 1 THEN datetime(upp.last_attempted_at, '+3 days')
            ELSE datetime(upp.last_attempted_at, '+1 day')
          END as next_review
        FROM user_puzzle_progress upp
        JOIN puzzle_index pi ON upp.puzzle_id = pi.id
        WHERE upp.user_id = ? AND upp.attempts > 0 AND CASE 
          WHEN upp.solved = 1 AND upp.streak >= 3 THEN datetime(upp.last_attempted_at, '+7 days') <= datetime('now')
          WHEN upp.solved = 1 THEN datetime(upp.last_attempted_at, '+3 days') <= datetime('now')
          ELSE datetime(upp.last_attempted_at, '+1 day') <= datetime('now')
        END
        ORDER BY next_review ASC
        LIMIT 20
      `;

      const puzzles = await this.db.all(query, [this.userId]);
      return puzzles;
    } catch (error) {
      console.error('[LearningPath] Error getting puzzles due for review:', error.message);
      return [];
    }
  }

  /**
   * Get adaptive difficulty recommendations
   * Adjusts puzzle difficulty based on recent performance
   * 
   * @param {number} playerRating - Base player rating
   * @returns {Promise<Object>} Adjusted rating range
   */
  async getAdaptiveDifficulty(playerRating) {
    try {
      // Get recent performance (last 10 puzzles)
      const recentPerformance = await this.db.all(`
        SELECT *
        FROM user_puzzle_progress
        WHERE user_id = ?
        ORDER BY last_attempted_at DESC
        LIMIT 10
      `, [this.userId]);

      if (recentPerformance.length === 0) {
        // No history, use base rating
        return {
          min: playerRating - 200,
          max: playerRating + 200,
          adjustment: 0
        };
      }

      // Calculate mastery scores
      const PuzzleProgressTracker = require('./puzzle-progress-tracker');
      const tracker = new PuzzleProgressTracker(this.db, this.userId);

      const masteryScores = recentPerformance.map(p => tracker.calculateMasteryScore(p));
      const avgMastery = masteryScores.reduce((sum, m) => sum + m, 0) / masteryScores.length;

      // Calculate success rate
      const solvedCount = recentPerformance.filter(p => p.solved).length;
      const successRate = (solvedCount / recentPerformance.length) * 100;

      // Adjust difficulty based on performance
      let adjustment = 0;
      
      if (successRate >= 80 && avgMastery >= 70) {
        // Performing well, increase difficulty
        adjustment = 100;
      } else if (successRate >= 60 && avgMastery >= 50) {
        // Moderate performance, slight increase
        adjustment = 50;
      } else if (successRate < 40 || avgMastery < 30) {
        // Struggling, decrease difficulty
        adjustment = -100;
      } else if (successRate < 50 || avgMastery < 40) {
        // Below average, slight decrease
        adjustment = -50;
      }

      return {
        min: playerRating - 200 + adjustment,
        max: playerRating + 200 + adjustment,
        adjustment,
        successRate: Math.round(successRate),
        avgMastery: Math.round(avgMastery)
      };
    } catch (error) {
      console.error('[LearningPath] Error calculating adaptive difficulty:', error.message);
      return {
        min: playerRating - 200,
        max: playerRating + 200,
        adjustment: 0
      };
    }
  }

  /**
   * Get performance trends over time
   * @param {number} days - Number of days to analyze
   * @returns {Promise<Object>} Performance trends
   */
  async getPerformanceTrends(days = 30) {
    try {
      const isPostgres = this.db.usePostgres;
      const dateFilter = isPostgres 
        ? `last_attempted_at >= NOW() - INTERVAL '${days} days'`
        : `last_attempted_at >= datetime('now', '-${days} days')`;

      const dateGroup = isPostgres
        ? "date_trunc('day', last_attempted_at)"
        : "date(last_attempted_at)";

      const trends = await this.db.all(`
        SELECT 
          ${dateGroup} as date,
          COUNT(*) as puzzles_attempted,
          SUM(CASE WHEN solved = 1 THEN 1 ELSE 0 END) as puzzles_solved,
          AVG(total_time_ms) as avg_time_ms
        FROM user_puzzle_progress
        WHERE user_id = ? AND ${dateFilter}
        GROUP BY ${dateGroup}
        ORDER BY date ASC
      `, [this.userId]);

      // Calculate mastery for each day
      const PuzzleProgressTracker = require('./puzzle-progress-tracker');
      const tracker = new PuzzleProgressTracker(this.db, this.userId);

      for (const trend of trends) {
        // Get all puzzles for this day
        const dayPuzzles = await this.db.all(`
          SELECT * FROM user_puzzle_progress
          WHERE user_id = ? AND ${dateGroup} = ?
        `, [this.userId, trend.date]);

        if (dayPuzzles.length > 0) {
          const totalMastery = dayPuzzles.reduce((sum, p) => sum + tracker.calculateMasteryScore(p), 0);
          trend.avg_mastery = totalMastery / dayPuzzles.length;
        } else {
          trend.avg_mastery = 0;
        }
      }

      // Calculate improvement rate
      let improvementRate = 0;
      if (trends.length >= 2) {
        const firstWeek = trends.slice(0, Math.min(7, trends.length));
        const lastWeek = trends.slice(-Math.min(7, trends.length));
        
        const firstAvg = firstWeek.reduce((sum, t) => sum + (t.avg_mastery || 0), 0) / firstWeek.length;
        const lastAvg = lastWeek.reduce((sum, t) => sum + (t.avg_mastery || 0), 0) / lastWeek.length;
        
        improvementRate = lastAvg - firstAvg;
      }

      return {
        trends,
        improvementRate: Math.round(improvementRate),
        daysAnalyzed: days,
        totalDaysActive: trends.length
      };
    } catch (error) {
      console.error('[LearningPath] Error getting performance trends:', error.message);
      return {
        trends: [],
        improvementRate: 0,
        daysAnalyzed: days,
        totalDaysActive: 0
      };
    }
  }

  /**
   * Get theme mastery levels with progression
   * @returns {Promise<Array>} Themes with mastery levels
   */
  async getThemeMasteryLevels() {
    try {
      const blunderThemes = await this.getBlunderThemeFrequency();
      const themeMastery = await this.getThemeMastery();

      const themes = blunderThemes.map(theme => {
        const mastery = themeMastery[theme.tactical_theme] || 0;
        let level = 'beginner';
        
        if (mastery >= 80) level = 'expert';
        else if (mastery >= 60) level = 'advanced';
        else if (mastery >= 40) level = 'intermediate';

        return {
          theme: theme.tactical_theme,
          frequency: theme.count,
          mastery: Math.round(mastery),
          level,
          nextLevel: this.getNextLevel(level),
          pointsToNext: this.getPointsToNextLevel(mastery, level)
        };
      });

      return themes;
    } catch (error) {
      console.error('[LearningPath] Error getting theme mastery levels:', error.message);
      return [];
    }
  }

  /**
   * Get next mastery level
   * @param {string} currentLevel - Current level
   * @returns {string} Next level
   */
  getNextLevel(currentLevel) {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const currentIndex = levels.indexOf(currentLevel);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : 'expert';
  }

  /**
   * Get points needed to reach next level
   * @param {number} currentMastery - Current mastery score
   * @param {string} level - Current level
   * @returns {number} Points to next level
   */
  getPointsToNextLevel(currentMastery, level) {
    const thresholds = {
      beginner: 40,
      intermediate: 60,
      advanced: 80,
      expert: 100
    };

    const nextThreshold = thresholds[this.getNextLevel(level)];
    return Math.max(0, nextThreshold - currentMastery);
  }

  /**
   * Generate enhanced recommendations with spaced repetition and adaptive difficulty
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Enhanced recommendations
   */
  async generateEnhancedRecommendations(options = {}) {
    const {
      limit = 10,
      playerRating = 1500,
      includeReviews = true
    } = options;

    try {
      const recommendations = [];

      // 1. Add puzzles due for review (spaced repetition)
      if (includeReviews) {
        const reviewPuzzles = await this.getPuzzlesDueForReview();
        recommendations.push(...reviewPuzzles.slice(0, Math.floor(limit * 0.3))); // 30% reviews
      }

      // 2. Get adaptive difficulty range
      const adaptiveDifficulty = await this.getAdaptiveDifficulty(playerRating);

      // 3. Add new puzzles based on weak themes
      const remainingSlots = limit - recommendations.length;
      if (remainingSlots > 0) {
        const newPuzzles = await this.generateRecommendations({
          limit: remainingSlots,
          playerRating: (adaptiveDifficulty.min + adaptiveDifficulty.max) / 2
        });
        recommendations.push(...newPuzzles);
      }

      return {
        recommendations: recommendations.slice(0, limit),
        adaptiveDifficulty,
        reviewCount: recommendations.filter(p => p.attempts > 0).length,
        newCount: recommendations.filter(p => !p.attempts || p.attempts === 0).length
      };
    } catch (error) {
      console.error('[LearningPath] Error generating enhanced recommendations:', error.message);
      return {
        recommendations: [],
        adaptiveDifficulty: { min: playerRating - 200, max: playerRating + 200, adjustment: 0 },
        reviewCount: 0,
        newCount: 0
      };
    }
  }
}

module.exports = LearningPathGenerator;
