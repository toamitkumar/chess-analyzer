class PGNParser {
  constructor() {
    this.games = [];
  }

  parseFile(pgnContent) {
    this.games = [];
    const gameStrings = this.splitGames(pgnContent);
    
    gameStrings.forEach((gameString, index) => {
      try {
        const game = this.parseGame(gameString, index);
        if (game) {
          this.games.push(game);
        }
      } catch (error) {
        console.warn(`Error parsing game ${index + 1}:`, error.message);
      }
    });

    return {
      games: this.games,
      totalGames: this.games.length,
      errors: []
    };
  }

  splitGames(pgnContent) {
    return pgnContent
      .split(/\n\s*\n(?=\[)/)
      .filter(game => game.trim().length > 0);
  }

  parseGame(gameString, index = 0) {
    const lines = gameString.trim().split('\n');
    const headers = this.extractHeaders(lines);
    const moves = this.extractMoves(lines);

    if (!headers.White || !headers.Black) {
      throw new Error('Missing required headers (White/Black)');
    }

    return {
      id: `game_${index + 1}`,
      white: headers.White,
      black: headers.Black,
      result: headers.Result || '*',
      date: headers.Date || '????.??.??',
      event: headers.Event || 'Unknown',
      site: headers.Site || 'Unknown',
      round: headers.Round || '?',
      whiteElo: parseInt(headers.WhiteElo) || null,
      blackElo: parseInt(headers.BlackElo) || null,
      eco: headers.ECO || null,
      moves: moves,
      moveCount: moves.length,
      imported: new Date().toISOString()
    };
  }

  extractHeaders(lines) {
    const headers = {};
    
    lines.forEach(line => {
      const headerMatch = line.match(/^\[(\w+)\s+"([^"]+)"\]$/);
      if (headerMatch) {
        headers[headerMatch[1]] = headerMatch[2];
      }
    });

    return headers;
  }

  extractMoves(lines) {
    const moveLines = lines.filter(line => 
      !line.startsWith('[') && line.trim().length > 0
    );
    
    const moveText = moveLines.join(' ').trim();
    if (!moveText) return [];

    // Remove comments and variations
    const cleanMoves = moveText
      .replace(/\{[^}]*\}/g, '') // Remove comments
      .replace(/\([^)]*\)/g, '') // Remove variations
      .replace(/\d+\.\.\./g, '') // Remove move numbers for black
      .replace(/\d+\./g, '') // Remove move numbers
      .replace(/[!?+#=]+/g, '') // Remove annotations
      .trim();

    return cleanMoves
      .split(/\s+/)
      .filter(move => move && !['1-0', '0-1', '1/2-1/2', '*'].includes(move));
  }

  validatePGN(pgnContent) {
    if (!pgnContent || typeof pgnContent !== 'string') {
      return { valid: false, error: 'Invalid PGN content' };
    }

    if (!pgnContent.includes('[White ') || !pgnContent.includes('[Black ')) {
      return { valid: false, error: 'Missing required headers' };
    }

    return { valid: true };
  }

  getGameCount() {
    return this.games.length;
  }
}

module.exports = PGNParser;
