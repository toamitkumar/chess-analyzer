/**
 * Puzzle Link Queue
 *
 * Manages background puzzle linking to avoid blocking game analysis
 * Uses batch processing and rate limiting for bulk uploads
 */

const BlunderPuzzleLinker = require('./blunder-puzzle-linker');

class PuzzleLinkQueue {
  constructor(database) {
    this.db = database;
    this.queue = [];
    this.processing = false;
    this.batchSize = 20; // Process 20 blunders at a time
    this.batchDelay = 100; // Wait 100ms between batches
    this.enabled = true; // Can be disabled during bulk uploads
  }

  /**
   * Add blunder to queue for linking
   * @param {number} blunderId - Blunder ID to link
   */
  enqueue(blunderId) {
    if (!this.enabled) {
      console.log(`[PuzzleLinkQueue] Auto-linking disabled, skipping blunder ${blunderId}`);
      return;
    }

    // Add to queue if not already present
    if (!this.queue.includes(blunderId)) {
      this.queue.push(blunderId);
      console.log(`[PuzzleLinkQueue] Queued blunder ${blunderId} (queue size: ${this.queue.length})`);
    }

    // Start processing if not already running
    if (!this.processing) {
      // Use setTimeout to defer processing until after current operation
      setTimeout(() => this.processQueue(), 0);
    }
  }

  /**
   * Process queue in batches
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    console.log(`[PuzzleLinkQueue] Starting batch processing (${this.queue.length} blunders in queue)`);

    const linker = new BlunderPuzzleLinker(this.db);
    let processed = 0;
    let linked = 0;

    try {
      while (this.queue.length > 0) {
        // Get next batch
        const batch = this.queue.splice(0, this.batchSize);

        console.log(`[PuzzleLinkQueue] Processing batch of ${batch.length} blunders...`);

        // Process batch
        for (const blunderId of batch) {
          try {
            const count = await linker.linkBlunderToPuzzles(blunderId);
            processed++;
            linked += count;
          } catch (error) {
            console.error(`[PuzzleLinkQueue] Error linking blunder ${blunderId}:`, error.message);
          }
        }

        // Small delay between batches to avoid CPU hogging
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.batchDelay));
        }
      }

      console.log(`[PuzzleLinkQueue] ✅ Completed: ${processed} blunders processed, ${linked} puzzles linked`);
    } catch (error) {
      console.error('[PuzzleLinkQueue] Error processing queue:', error.message);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Disable auto-linking (for bulk uploads)
   */
  disable() {
    this.enabled = false;
    console.log('[PuzzleLinkQueue] Auto-linking disabled (bulk upload mode)');
  }

  /**
   * Enable auto-linking and process queued items
   */
  enable() {
    this.enabled = true;
    console.log('[PuzzleLinkQueue] Auto-linking enabled');

    if (this.queue.length > 0) {
      console.log(`[PuzzleLinkQueue] Processing ${this.queue.length} queued blunders...`);
      setTimeout(() => this.processQueue(), 0);
    }
  }

  /**
   * Flush queue immediately (blocking)
   * Use sparingly, mainly for testing
   */
  async flush() {
    if (this.queue.length === 0) {
      return { processed: 0, linked: 0 };
    }

    const originalEnabled = this.enabled;
    this.enabled = true;

    await this.processQueue();

    this.enabled = originalEnabled;

    return {
      processed: this.queue.length,
      remaining: this.queue.length
    };
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      processing: this.processing,
      queueSize: this.queue.length
    };
  }
}

// Singleton instance
let queueInstance = null;

/**
 * Get or create queue instance
 * @param {Object} database - Database instance
 * @returns {PuzzleLinkQueue}
 */
function getPuzzleLinkQueue(database) {
  if (!queueInstance && database) {
    queueInstance = new PuzzleLinkQueue(database);
  }
  return queueInstance;
}

module.exports = {
  PuzzleLinkQueue,
  getPuzzleLinkQueue
};
