/**
 * Tournament Resolution Service
 *
 * Handles tournament detection and assignment logic.
 * Responsible for:
 * - Auto-detecting tournaments from PGN headers
 * - Validating assigned tournament IDs
 * - Retrieving tournament information
 */

const { getTournamentManager } = require('../models/tournament-manager');

class TournamentResolutionService {
  constructor(tournamentManager = null) {
    this.tournamentManager = tournamentManager || getTournamentManager();
  }

  /**
   * Resolve tournament for a PGN upload
   * @param {string} pgnContent - The PGN content to analyze
   * @param {number|null} assignedTournamentId - Optional tournament ID assigned by user
   * @param {string} userId - User ID for tournament lookup
   * @returns {Promise<Object>} Tournament object and whether it was assigned or auto-detected
   */
  async resolveTournament(pgnContent, assignedTournamentId, userId) {
    let tournament;
    let wasAssigned = false;

    if (assignedTournamentId) {
      // Use assigned tournament
      tournament = await this.tournamentManager.getTournamentById(assignedTournamentId);

      if (!tournament) {
        throw new Error('Assigned tournament not found');
      }

      console.log(`📊 Using assigned tournament: ${tournament.name} (ID: ${tournament.id})`);
      wasAssigned = true;
    } else {
      // Auto-detect tournament from PGN headers
      const tournamentResult = await this.tournamentManager.processPGNForTournament(pgnContent, userId);
      tournament = tournamentResult.tournament;

      console.log(`📊 Auto-detected tournament: ${tournament.name} (ID: ${tournament.id})`);
      wasAssigned = false;
    }

    return {
      tournament,
      wasAssigned
    };
  }

  /**
   * Get tournament by ID
   * @param {number} tournamentId - Tournament ID
   * @returns {Promise<Object|null>} Tournament object or null if not found
   */
  async getTournamentById(tournamentId) {
    return await this.tournamentManager.getTournamentById(tournamentId);
  }

  /**
   * Update game count for a tournament
   * @param {number} tournamentId - Tournament ID
   * @returns {Promise<void>}
   */
  async updateTournamentGameCount(tournamentId) {
    await this.tournamentManager.updateTournamentGameCount(tournamentId);
  }
}

module.exports = TournamentResolutionService;
