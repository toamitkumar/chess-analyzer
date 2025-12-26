/**
 * Health Controller
 *
 * Handles health check endpoint for monitoring
 */

class HealthController {
  /**
   * Health check endpoint
   * GET /api/health
   */
  check(req, res) {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new HealthController();
