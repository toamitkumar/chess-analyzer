/**
 * Lichess API Client
 *
 * Fetches puzzle details from Lichess.org API with:
 * - Rate limiting (1 request/second)
 * - Retry logic on 429 errors
 * - Error handling with fallback URLs
 * - No authentication required (public API)
 */

class LichessAPIClient {
  constructor() {
    this.baseUrl = 'https://lichess.org/api';
    this.lastRequest = 0;
    this.minInterval = 1000; // 1 request per second (conservative)
  }

  /**
   * Fetch puzzle details by ID
   * @param {string} puzzleId - Lichess puzzle ID
   * @returns {Promise<Object>} Puzzle data or error object
   */
  async fetchPuzzle(puzzleId) {
    // Throttle requests
    await this.throttle();

    try {
      const url = `${this.baseUrl}/puzzle/${puzzleId}`;
      const response = await fetch(url);

      // Handle rate limiting
      if (response.status === 429) {
        console.warn(`[Lichess API] Rate limited, waiting 60 seconds...`);
        await this.sleep(60000); // Wait 1 minute
        return this.fetchPuzzle(puzzleId); // Retry
      }

      // Handle errors
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse response
      const puzzle = await response.json();
      return puzzle;

    } catch (error) {
      console.error(`[Lichess API] Failed to fetch puzzle ${puzzleId}:`, error.message);

      // Return fallback object with Lichess link
      return {
        id: puzzleId,
        lichessUrl: `https://lichess.org/training/${puzzleId}`,
        error: true,
        errorMessage: error.message
      };
    }
  }

  /**
   * Throttle requests to respect rate limits
   * Ensures minimum interval between requests
   */
  async throttle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.minInterval) {
      const delay = this.minInterval - timeSinceLastRequest;
      await this.sleep(delay);
    }

    this.lastRequest = Date.now();
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = LichessAPIClient;
