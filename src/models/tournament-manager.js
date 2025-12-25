const { getDatabase } = require('./database');

class TournamentManager {
  constructor() {
    this.db = null;
  }

  async initialize() {
    if (!this.db) {
      this.db = getDatabase();
      // Ensure database is initialized
      if (!this.db.db) {
        await this.db.initialize();
      }
    }
  }

  // Extract tournament information from PGN headers
  detectTournament(pgnHeaders) {
    const event = pgnHeaders.Event || pgnHeaders.event || 'Unknown Tournament';
    const site = pgnHeaders.Site || pgnHeaders.site || null;
    const date = pgnHeaders.Date || pgnHeaders.date || null;
    
    return {
      name: event.trim(),
      location: site ? site.trim() : null,
      date: this.parseDate(date),
      eventType: this.classifyEventType(event)
    };
  }

  // Classify tournament types based on event name
  classifyEventType(eventName) {
    if (!eventName) return 'standard';
    
    const name = eventName.toLowerCase();
    if (name.includes('blitz')) return 'blitz';
    if (name.includes('rapid')) return 'rapid';
    if (name.includes('classical')) return 'classical';
    if (name.includes('bullet')) return 'bullet';
    if (name.includes('correspondence')) return 'correspondence';
    if (name.includes('arena')) return 'arena';
    if (name.includes('swiss')) return 'swiss';
    return 'standard';
  }

  // Parse date from PGN format
  parseDate(dateString) {
    if (!dateString || dateString === '???.??.??') return null;
    
    try {
      // PGN date format: YYYY.MM.DD
      const parts = dateString.split('.');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (error) {
      console.warn('Failed to parse date:', dateString);
    }
    
    return null;
  }

  // Find or create tournament in database
  async findOrCreateTournament(tournamentInfo, userId = 'default_user') {
    if (!this.db) {
      await this.initialize();
    }

    try {
      // Try to find existing tournament by name
      let tournament = await this.db.findTournamentByName(tournamentInfo.name, userId);

      if (!tournament) {
        // Create new tournament
        const result = await this.db.insertTournament({
          name: tournamentInfo.name,
          eventType: tournamentInfo.eventType,
          location: tournamentInfo.location,
          startDate: tournamentInfo.date,
          endDate: null, // Will be updated as we see more games
          userId: userId
        });
        
        tournament = {
          id: result.id,
          name: tournamentInfo.name,
          event_type: tournamentInfo.eventType,
          location: tournamentInfo.location,
          start_date: tournamentInfo.date,
          end_date: null,
          total_games: 0
        };
        
        console.log(`🏆 Created tournament: ${tournamentInfo.name} (${tournamentInfo.eventType})`);
      } else {
        // Update tournament metadata if we have better information
        await this.updateTournamentMetadata(tournament.id, tournamentInfo);
      }
      
      return tournament;
    } catch (error) {
      console.error('❌ Failed to find/create tournament:', error.message);
      throw error;
    }
  }

  // Update tournament metadata with new information
  async updateTournamentMetadata(tournamentId, newInfo) {
    try {
      const updates = [];
      const params = [];
      
      // Update location if we have it and tournament doesn't
      if (newInfo.location) {
        const tournament = await this.db.get('SELECT location FROM tournaments WHERE id = ?', [tournamentId]);
        if (!tournament.location) {
          updates.push('location = ?');
          params.push(newInfo.location);
        }
      }
      
      // Update start date if we have an earlier date
      if (newInfo.date) {
        const tournament = await this.db.get('SELECT start_date FROM tournaments WHERE id = ?', [tournamentId]);
        if (!tournament.start_date || newInfo.date < tournament.start_date) {
          updates.push('start_date = ?');
          params.push(newInfo.date);
        }
      }
      
      if (updates.length > 0) {
        params.push(tournamentId);
        await this.db.run(
          `UPDATE tournaments SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }
    } catch (error) {
      console.warn('Failed to update tournament metadata:', error.message);
    }
  }

  // Process PGN content and extract tournament info
  async processPGNForTournament(pgnContent, userId = 'default_user') {
    try {
      // Extract headers from PGN
      const headers = this.extractPGNHeaders(pgnContent);

      // Detect tournament information
      const tournamentInfo = this.detectTournament(headers);

      // Find or create tournament
      const tournament = await this.findOrCreateTournament(tournamentInfo, userId);

      return {
        tournament,
        headers,
        tournamentInfo
      };
    } catch (error) {
      console.error('❌ Failed to process PGN for tournament:', error.message);
      throw error;
    }
  }

  // Extract headers from PGN content
  extractPGNHeaders(pgnContent) {
    const headers = {};
    const lines = pgnContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const match = trimmed.match(/\[(\w+)\s+"([^"]*)"\]/);
        if (match) {
          headers[match[1]] = match[2];
        }
      }
    }
    
    return headers;
  }

  // Get all tournaments
  async getAllTournaments() {
    if (!this.db) {
      await this.initialize();
    }
    
    return await this.db.getAllTournaments();
  }

  // Get tournament by ID
  async getTournamentById(tournamentId) {
    if (!this.db) {
      await this.initialize();
    }
    
    return await this.db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
  }

  // Update tournament game count
  async updateTournamentGameCount(tournamentId) {
    if (!this.db) {
      await this.initialize();
    }
    
    const count = await this.db.get(
      'SELECT COUNT(*) as count FROM games WHERE tournament_id = ?',
      [tournamentId]
    );
    
    await this.db.run(
      'UPDATE tournaments SET total_games = ? WHERE id = ?',
      [count.count, tournamentId]
    );
  }

  // Get tournament statistics
  async getTournamentStats(tournamentId, userId) {
    if (!this.db) {
      await this.initialize();
    }
    
    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as white_wins,
        SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as black_wins,
        SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
        AVG(white_elo) as avg_white_elo,
        AVG(black_elo) as avg_black_elo
      FROM games 
      WHERE tournament_id = ?
      AND user_id = ?
    `, [tournamentId, userId]);
    
    return stats;
  }

  // Merge duplicate tournaments
  async mergeTournaments(keepTournamentId, removeTournamentId) {
    if (!this.db) {
      await this.initialize();
    }
    
    try {
      // Move all games from removed tournament to kept tournament
      await this.db.run(
        'UPDATE games SET tournament_id = ? WHERE tournament_id = ?',
        [keepTournamentId, removeTournamentId]
      );
      
      // Delete the removed tournament
      await this.db.run('DELETE FROM tournaments WHERE id = ?', [removeTournamentId]);
      
      // Update game count for kept tournament
      await this.updateTournamentGameCount(keepTournamentId);
      
      console.log(`🔄 Merged tournament ${removeTournamentId} into ${keepTournamentId}`);
    } catch (error) {
      console.error('❌ Failed to merge tournaments:', error.message);
      throw error;
    }
  }
}

// Singleton instance
let tournamentManagerInstance = null;

function getTournamentManager() {
  if (!tournamentManagerInstance) {
    tournamentManagerInstance = new TournamentManager();
  }
  return tournamentManagerInstance;
}

module.exports = { TournamentManager, getTournamentManager };
