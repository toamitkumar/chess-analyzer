/**
 * Puzzle Progress Tracker
 * 
 * Tracks user progress on puzzles including:
 * - Attempts and solutions
 * - Timing and efficiency
 * - Mastery scores
 * - Streaks and statistics
 */

class PuzzleProgressTracker {
  constructor(database, userId = 'default_user') {
    this.db = database;
    this.userId = userId;
  }

  /**
   * Record a puzzle attempt
   * @param {string} puzzleId - Puzzle ID
   * @param {Object} attemptData - Attempt details
   * @returns {Promise<Object>} Updated progress
   */
  async recordAttempt(puzzleId, attemptData) {
    const {
      solved = false,
      timeSpent = 0,
      movesCount = 0,
      hintsUsed = 0
    } = attemptData;

    try {
      // Get existing progress
      let progress = await this.getProgress(puzzleId);

      const isFirstAttempt = !progress;
      
      if (!progress) {
        // Create new progress record
        progress = await this.createProgress(puzzleId);
      }

      // Update progress
      const newAttempts = progress.attempts + 1;
      const wasSolved = progress.solved || false;
      const newSolved = solved || wasSolved;
      const newTotalTime = (progress.total_time_ms || 0) + (timeSpent * 1000); // Convert to ms
      const newAvgTime = newTotalTime / newAttempts;

      // Calculate success rate
      const successRate = newSolved ? 100 : 0;

      // Update streak
      let newStreak = progress.streak || 0;
      if (solved) {
        newStreak++;
      } else {
        newStreak = 0;
      }

      // Update database
      const isPostgres = this.db.usePostgres;
      const now = isPostgres ? 'NOW()' : "datetime('now')";
      const solvedAt = solved && !wasSolved ? now : (progress.solved_at ? `'${progress.solved_at}'` : 'NULL');

      await this.db.run(`
        UPDATE user_puzzle_progress
        SET 
          attempts = ?,
          solved = ?,
          first_attempt_correct = ?,
          total_time_ms = ?,
          streak = ?,
          last_attempted_at = ${now},
          solved_at = ${solvedAt},
          updated_at = ${now}
        WHERE puzzle_id = ? AND user_id = ?
      `, [
        newAttempts,
        newSolved ? 1 : 0,
        isFirstAttempt && solved ? 1 : (progress.first_attempt_correct || 0),
        newTotalTime,
        newStreak,
        puzzleId,
        this.userId
      ]);

      // Return updated progress
      return await this.getProgress(puzzleId);

    } catch (error) {
      console.error(`[ProgressTracker] Error recording attempt for ${puzzleId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get progress for a puzzle
   * @param {string} puzzleId - Puzzle ID
   * @returns {Promise<Object|null>} Progress data
   */
  async getProgress(puzzleId) {
    try {
      const progress = await this.db.get(
        'SELECT * FROM user_puzzle_progress WHERE puzzle_id = ? AND user_id = ?',
        [puzzleId, this.userId]
      );
      return progress || null;
    } catch (error) {
      console.error(`[ProgressTracker] Error getting progress for ${puzzleId}:`, error.message);
      return null;
    }
  }

  /**
   * Create initial progress record
   * @param {string} puzzleId - Puzzle ID
   * @returns {Promise<Object>} Created progress
   */
  async createProgress(puzzleId) {
    try {
      const isPostgres = this.db.usePostgres;
      const now = isPostgres ? 'NOW()' : "datetime('now')";

      await this.db.run(`
        INSERT INTO user_puzzle_progress (
          puzzle_id, user_id, attempts, solved, first_attempt_correct, 
          total_time_ms, streak, created_at, updated_at
        ) VALUES (?, ?, 0, 0, 0, 0, 0, ${now}, ${now})
      `, [puzzleId, this.userId]);

      return await this.getProgress(puzzleId);
    } catch (error) {
      console.error(`[ProgressTracker] Error creating progress for ${puzzleId}:`, error.message);
      throw error;
    }
  }

  /**
   * Calculate mastery score based on progress
   * @param {Object} progress - Progress record
   * @returns {number} Mastery score (0-100)
   */
  calculateMasteryScore(progress) {
    if (!progress || progress.attempts === 0) return 0;

    // Success component (60% weight)
    const successScore = progress.solved ? 100 : 0;
    const successComponent = successScore * 0.6;

    // Efficiency component (25% weight) - based on time
    const avgTimeSeconds = (progress.total_time_ms / progress.attempts) / 1000;
    const timeEfficiency = Math.max(0, 100 - (avgTimeSeconds / 60) * 100); // Normalize to 60 seconds
    const efficiencyComponent = timeEfficiency * 0.25;

    // First attempt component (15% weight)
    const firstAttemptScore = progress.first_attempt_correct ? 100 : 0;
    const firstAttemptComponent = firstAttemptScore * 0.15;

    // Total mastery score
    const mastery = successComponent + efficiencyComponent + firstAttemptComponent;

    return Math.round(Math.min(100, Math.max(0, mastery)));
  }

  /**
   * Get mastery status
   * @param {number} masteryScore - Mastery score (0-100)
   * @returns {string} Status: learning, improving, mastered
   */
  getMasteryStatus(masteryScore) {
    if (masteryScore >= 80) return 'mastered';
    if (masteryScore >= 50) return 'improving';
    return 'learning';
  }

  /**
   * Get all progress for user
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} List of progress records with mastery scores
   */
  async getAllProgress(options = {}) {
    const {
      limit = 100,
      orderBy = 'last_attempted_at',
      order = 'DESC',
      minMastery = 0
    } = options;

    try {
      const progress = await this.db.all(`
        SELECT * FROM user_puzzle_progress
        WHERE user_id = ? AND attempts > 0
        ORDER BY ${orderBy} ${order}
        LIMIT ?
      `, [this.userId, limit]);

      // Calculate mastery scores and filter
      const progressWithMastery = progress.map(p => ({
        ...p,
        mastery_score: this.calculateMasteryScore(p),
        mastery_status: this.getMasteryStatus(this.calculateMasteryScore(p))
      })).filter(p => p.mastery_score >= minMastery);

      return progressWithMastery;
    } catch (error) {
      console.error('[ProgressTracker] Error getting all progress:', error.message);
      return [];
    }
  }

  /**
   * Get statistics summary
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    try {
      const stats = await this.db.get(`
        SELECT 
          COUNT(*) as total_puzzles,
          SUM(attempts) as total_attempts,
          SUM(CASE WHEN solved = 1 THEN 1 ELSE 0 END) as total_solved,
          MAX(streak) as best_streak
        FROM user_puzzle_progress
        WHERE user_id = ?
      `, [this.userId]);

      // Calculate average mastery from all puzzles
      const allProgress = await this.db.all(`
        SELECT * FROM user_puzzle_progress WHERE user_id = ? AND attempts > 0
      `, [this.userId]);

      let avgMastery = 0;
      if (allProgress.length > 0) {
        const totalMastery = allProgress.reduce((sum, p) => sum + this.calculateMasteryScore(p), 0);
        avgMastery = totalMastery / allProgress.length;
      }

      return {
        totalPuzzles: stats.total_puzzles || 0,
        totalAttempts: stats.total_attempts || 0,
        totalSolved: stats.total_solved || 0,
        averageMastery: Math.round(avgMastery),
        bestStreak: stats.best_streak || 0,
        successRate: stats.total_puzzles > 0 
          ? Math.round((stats.total_solved / stats.total_puzzles) * 100)
          : 0
      };
    } catch (error) {
      console.error('[ProgressTracker] Error getting statistics:', error.message);
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
}

module.exports = PuzzleProgressTracker;
