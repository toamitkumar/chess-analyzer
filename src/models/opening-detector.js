const { Chess } = require('chess.js');

/**
 * Detects chess opening based on the first moves
 * Returns { eco: 'C50', name: 'Italian Game' } or null
 */
class OpeningDetector {
  constructor() {
    // Common opening patterns (first 4-6 moves)
    // Format: "moves" => { eco, name }
    this.openings = new Map([
      // Italian Game
      ['e4 e5 Nf3 Nc6 Bc4', { eco: 'C50', name: 'Italian Game' }],
      ['e4 e5 Nf3 Nc6 Bc4 Bc5', { eco: 'C53', name: 'Italian Game, Classical' }],
      ['e4 e5 Nf3 Nc6 Bc4 Nf6', { eco: 'C55', name: 'Italian Game, Two Knights' }],

      // Ruy Lopez
      ['e4 e5 Nf3 Nc6 Bb5', { eco: 'C60', name: 'Ruy Lopez' }],
      ['e4 e5 Nf3 Nc6 Bb5 a6', { eco: 'C70', name: 'Ruy Lopez, Morphy Defense' }],
      ['e4 e5 Nf3 Nc6 Bb5 Nf6', { eco: 'C65', name: 'Ruy Lopez, Berlin Defense' }],

      // Sicilian Defense
      ['e4 c5', { eco: 'B20', name: 'Sicilian Defense' }],
      ['e4 c5 Nf3', { eco: 'B20', name: 'Sicilian Defense' }],
      ['e4 c5 Nf3 d6', { eco: 'B50', name: 'Sicilian Defense' }],
      ['e4 c5 Nf3 Nc6', { eco: 'B30', name: 'Sicilian Defense' }],
      ['e4 c5 Nf3 e6', { eco: 'B40', name: 'Sicilian Defense, French Variation' }],

      // French Defense
      ['e4 e6', { eco: 'C00', name: 'French Defense' }],
      ['e4 e6 d4', { eco: 'C00', name: 'French Defense' }],
      ['e4 e6 d4 d5', { eco: 'C00', name: 'French Defense' }],

      // Caro-Kann Defense
      ['e4 c6', { eco: 'B10', name: 'Caro-Kann Defense' }],
      ['e4 c6 d4', { eco: 'B10', name: 'Caro-Kann Defense' }],
      ['e4 c6 d4 d5', { eco: 'B10', name: 'Caro-Kann Defense' }],

      // Scandinavian Defense
      ['e4 d5', { eco: 'B01', name: 'Scandinavian Defense' }],

      // Alekhine's Defense
      ['e4 Nf6', { eco: 'B02', name: "Alekhine's Defense" }],

      // Pirc Defense
      ['e4 d6', { eco: 'B07', name: 'Pirc Defense' }],
      ['e4 d6 d4 Nf6', { eco: 'B07', name: 'Pirc Defense' }],

      // Queen's Gambit
      ['d4 d5 c4', { eco: 'D06', name: "Queen's Gambit" }],
      ['d4 d5 c4 e6', { eco: 'D30', name: "Queen's Gambit Declined" }],
      ['d4 d5 c4 dxc4', { eco: 'D20', name: "Queen's Gambit Accepted" }],
      ['d4 d5 c4 c6', { eco: 'D10', name: 'Slav Defense' }],

      // King's Indian Defense
      ['d4 Nf6 c4 g6', { eco: 'E60', name: "King's Indian Defense" }],
      ['d4 Nf6 c4 g6 Nc3 Bg7', { eco: 'E60', name: "King's Indian Defense" }],

      // Nimzo-Indian Defense
      ['d4 Nf6 c4 e6 Nc3 Bb4', { eco: 'E20', name: 'Nimzo-Indian Defense' }],

      // English Opening
      ['c4', { eco: 'A10', name: 'English Opening' }],
      ['c4 e5', { eco: 'A10', name: 'English Opening' }],
      ['c4 Nf6', { eco: 'A10', name: 'English Opening' }],
      ['c4 c5', { eco: 'A10', name: 'English Opening, Symmetrical' }],

      // London System
      ['d4 d5 Bf4', { eco: 'D02', name: 'London System' }],
      ['d4 Nf6 Bf4', { eco: 'D02', name: 'London System' }],

      // King's Pawn Game (generic)
      ['e4 e5', { eco: 'C20', name: "King's Pawn Game" }],
      ['e4 e5 Nf3', { eco: 'C40', name: "King's Knight Opening" }],

      // Queen's Pawn Game (generic)
      ['d4', { eco: 'D00', name: "Queen's Pawn Game" }],
      ['d4 d5', { eco: 'D00', name: "Queen's Pawn Game" }],
      ['d4 Nf6', { eco: 'E00', name: "Queen's Pawn Game" }],

      // Scotch Game
      ['e4 e5 Nf3 Nc6 d4', { eco: 'C45', name: 'Scotch Game' }],

      // Four Knights Game
      ['e4 e5 Nf3 Nc6 Nc3 Nf6', { eco: 'C47', name: 'Four Knights Game' }],

      // Petroff Defense
      ['e4 e5 Nf3 Nf6', { eco: 'C42', name: 'Petrov Defense' }],
    ]);
  }

  /**
   * Detect opening from PGN content or move array
   * @param {string|array} input - PGN content or array of moves
   * @returns {object|null} - { eco, name } or null
   */
  detect(input) {
    try {
      let moves = [];

      // Parse moves from PGN if string input
      if (typeof input === 'string') {
        // Clean and extract moves from PGN
        moves = this.extractMovesFromPgn(input);
        if (!moves || moves.length === 0) {
          return null;
        }
      } else {
        moves = input;
      }

      if (!moves || moves.length === 0) {
        return null;
      }

      // Try to match progressively longer sequences (up to 10 moves)
      const maxDepth = Math.min(10, moves.length);
      let bestMatch = null;

      // Start from longest sequence and work backwards for best match
      for (let depth = maxDepth; depth >= 1; depth--) {
        const sequence = moves.slice(0, depth).join(' ');

        if (this.openings.has(sequence)) {
          bestMatch = this.openings.get(sequence);
          break;
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Error detecting opening:', error);
      return null;
    }
  }

  /**
   * Extract moves from PGN string, handling malformed PGN
   * @param {string} pgn - PGN content
   * @returns {array} - Array of SAN moves
   */
  extractMovesFromPgn(pgn) {
    try {
      // First try standard chess.js parsing
      const chess = new Chess();
      chess.loadPgn(pgn);
      return chess.history();
    } catch (error) {
      // If that fails, try manual extraction
      try {
        return this.manualExtractMoves(pgn);
      } catch (manualError) {
        console.error('Both PGN parsing methods failed:', error, manualError);
        return [];
      }
    }
  }

  /**
   * Manually extract moves from PGN when chess.js fails
   * @param {string} pgn - PGN content
   * @returns {array} - Array of SAN moves
   */
  manualExtractMoves(pgn) {
    // Remove headers (lines starting with [)
    const lines = pgn.split('\n');
    const moveLines = lines.filter(line => !line.trim().startsWith('[') && line.trim().length > 0);
    const moveText = moveLines.join(' ');

    // Extract moves using regex
    // Match patterns like "1. e4 e5" or "1.e4 e5" or just "e4 e5"
    const moves = [];

    // Remove move numbers, result indicators, comments, and variations
    let cleaned = moveText
      .replace(/\{[^}]*\}/g, '') // Remove comments
      .replace(/\([^)]*\)/g, '') // Remove variations
      .replace(/\d+\.\.\./g, '') // Remove "1..." notation
      .replace(/\d+\./g, '') // Remove move numbers
      .replace(/1-0|0-1|1\/2-1\/2|\*/g, '') // Remove result
      .trim();

    // Split by whitespace and filter out empty strings
    const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);

    // Validate moves by trying to play them
    const chess = new Chess();
    for (const token of tokens) {
      try {
        const move = chess.move(token);
        if (move) {
          moves.push(move.san);
        } else {
          break; // Stop at first invalid move
        }
      } catch (e) {
        break; // Stop at first error
      }
    }

    return moves;
  }

  /**
   * Detect opening from move sequence string (e.g., "e4 e5 Nf3")
   * @param {string} moveSequence
   * @returns {object|null}
   */
  detectFromSequence(moveSequence) {
    // Try exact match first
    if (this.openings.has(moveSequence)) {
      return this.openings.get(moveSequence);
    }

    // Try progressively shorter sequences
    const moves = moveSequence.trim().split(/\s+/);
    for (let i = moves.length - 1; i >= 1; i--) {
      const partial = moves.slice(0, i).join(' ');
      if (this.openings.has(partial)) {
        return this.openings.get(partial);
      }
    }

    return null;
  }
}

module.exports = new OpeningDetector();
