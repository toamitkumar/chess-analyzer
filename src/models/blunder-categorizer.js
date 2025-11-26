const { Chess } = require('chess.js');

/**
 * BlunderCategorizer - Categorizes chess blunders by tactical theme, position type, and severity
 *
 * Analyzes blunders to identify:
 * - Tactical themes (fork, pin, hanging piece, etc.)
 * - Position type (attacking, defensive, positional, tactical, transition)
 * - Blunder severity (minor, moderate, major, critical)
 * - Difficulty level (1-5)
 */
class BlunderCategorizer {
  constructor() {
    // Centipawn loss thresholds for severity
    this.SEVERITY_THRESHOLDS = {
      minor: 150,      // 0-150 CP loss
      moderate: 300,   // 150-300 CP loss
      major: 500,      // 300-500 CP loss
      critical: 501    // 500+ CP loss
    };

    // Move number ranges for game phases
    this.PHASE_RANGES = {
      opening: { start: 1, end: 10 },
      middlegame: { start: 11, end: 40 },
      endgame: { start: 41, end: 999 }
    };
  }

  /**
   * Categorize a blunder with full context
   * @param {Object} blunderData - Blunder data from analysis
   * @param {Chess} chess - Chess.js instance at the position
   * @returns {Object} Categorized blunder data
   */
  categorizeBlunder(blunderData, chess) {
    const {
      fen,
      moveNumber,
      playerMove,
      bestMove,
      evaluationBefore,
      evaluationAfter,
      centipawnLoss
    } = blunderData;

    const phase = this.determinePhase(moveNumber);
    const tacticalTheme = this.identifyTacticalTheme(fen, playerMove, bestMove, chess);
    const positionType = this.classifyPositionType(fen, chess, tacticalTheme);
    const blunderSeverity = this.calculateSeverity(centipawnLoss);
    const difficultyLevel = this.calculateDifficulty(centipawnLoss, tacticalTheme, phase);

    return {
      phase,
      tactical_theme: tacticalTheme,
      position_type: positionType,
      blunder_severity: blunderSeverity,
      difficulty_level: difficultyLevel
    };
  }

  /**
   * Determine game phase based on move number
   */
  determinePhase(moveNumber) {
    if (moveNumber <= this.PHASE_RANGES.opening.end) return 'opening';
    if (moveNumber <= this.PHASE_RANGES.middlegame.end) return 'middlegame';
    return 'endgame';
  }

  /**
   * Identify tactical theme of the blunder
   */
  identifyTacticalTheme(fen, playerMove, bestMove, chess) {
    try {
      // Create a new chess instance to safely test moves
      const testChess = new Chess(fen);

      // Check for hanging piece
      if (this.isHangingPiece(testChess, playerMove)) {
        return 'hanging_piece';
      }

      // Check for missed tactical opportunities
      if (this.isMissedFork(testChess, bestMove)) {
        return 'missed_fork';
      }

      if (this.isMissedPin(testChess, bestMove)) {
        return 'missed_pin';
      }

      if (this.isMissedSkewer(testChess, bestMove)) {
        return 'missed_skewer';
      }

      if (this.isMissedDiscoveredAttack(testChess, bestMove)) {
        return 'missed_discovery';
      }

      // Check for positional errors
      if (this.isKingSafetyIssue(testChess, playerMove)) {
        return 'king_safety';
      }

      if (this.isWeakPawnStructure(testChess, playerMove)) {
        return 'weak_pawn_structure';
      }

      if (this.isBadPiecePlacement(testChess, playerMove)) {
        return 'bad_piece_placement';
      }

      // Check for capture issues
      if (this.isWrongCapture(testChess, playerMove, bestMove)) {
        return 'wrong_capture';
      }

      // Default to generic blunder
      return 'positional_error';
    } catch (error) {
      console.error('Error identifying tactical theme:', error);
      return 'unknown';
    }
  }

  /**
   * Check if player move hangs a piece (leaves it undefended)
   */
  isHangingPiece(chess, playerMove) {
    try {
      const move = chess.move(playerMove);
      if (!move) return false;

      // Check if the moved piece is now attacked and undefended
      const movedPiece = chess.get(move.to);
      if (!movedPiece) {
        chess.undo();
        return false;
      }

      const isAttacked = this.isSquareAttacked(chess, move.to, chess.turn());
      const isDefended = this.isSquareDefended(chess, move.to, move.color);

      chess.undo();
      return isAttacked && !isDefended;
    } catch {
      return false;
    }
  }

  /**
   * Check if best move was a fork (attacking 2+ pieces)
   */
  isMissedFork(chess, bestMove) {
    try {
      const move = chess.move(bestMove);
      if (!move) return false;

      const attackedPieces = this.getAttackedPieces(chess, move.to, move.color);
      chess.undo();

      return attackedPieces.length >= 2;
    } catch {
      return false;
    }
  }

  /**
   * Check if best move was a pin
   */
  isMissedPin(chess, bestMove) {
    try {
      const move = chess.move(bestMove);
      if (!move) return false;

      // Check if the move creates a pin (piece in front of more valuable piece)
      const isPinCreated = this.createsPinPattern(chess, move);
      chess.undo();

      return isPinCreated;
    } catch {
      return false;
    }
  }

  /**
   * Check if best move was a skewer
   */
  isMissedSkewer(chess, bestMove) {
    try {
      const move = chess.move(bestMove);
      if (!move) return false;

      // Skewer is similar to pin but valuable piece is in front
      const isSkewerCreated = this.createsSkewerPattern(chess, move);
      chess.undo();

      return isSkewerCreated;
    } catch {
      return false;
    }
  }

  /**
   * Check if best move was a discovered attack
   */
  isMissedDiscoveredAttack(chess, bestMove) {
    try {
      // Save current attacked squares
      const beforeAttacks = this.getAllAttackedSquares(chess, chess.turn());

      const move = chess.move(bestMove);
      if (!move) return false;

      // Get new attacked squares
      const afterAttacks = this.getAllAttackedSquares(chess, move.color);

      chess.undo();

      // Discovered attack creates new attacks after piece moves
      return afterAttacks.length > beforeAttacks.length + 1; // +1 for the moved piece's new attacks
    } catch {
      return false;
    }
  }

  /**
   * Check if move weakens king safety
   */
  isKingSafetyIssue(chess, playerMove) {
    try {
      const move = chess.move(playerMove);
      if (!move) return false;

      const kingSquare = this.findKing(chess, move.color);
      if (!kingSquare) {
        chess.undo();
        return false;
      }

      // Check if king is now in check or exposed
      const isCheck = chess.inCheck();
      const attackersCount = this.countAttackers(chess, kingSquare, chess.turn());

      chess.undo();

      return isCheck || attackersCount >= 2;
    } catch {
      return false;
    }
  }

  /**
   * Check if move creates weak pawn structure
   */
  isWeakPawnStructure(chess, playerMove) {
    try {
      const move = chess.move(playerMove);
      if (!move) return false;

      // Check for doubled pawns, isolated pawns, backward pawns
      const hasWeakness = this.hasWeakPawnStructure(chess, move.color);

      chess.undo();

      return hasWeakness;
    } catch {
      return false;
    }
  }

  /**
   * Check if piece placement is bad
   */
  isBadPiecePlacement(chess, playerMove) {
    try {
      const move = chess.move(playerMove);
      if (!move) return false;

      // Check if piece is on rim, blocked, or poorly placed
      const isBadPlacement = this.isPoorSquare(chess, move.to, move.piece);

      chess.undo();

      return isBadPlacement;
    } catch {
      return false;
    }
  }

  /**
   * Check if player captured with wrong piece
   */
  isWrongCapture(chess, playerMove, bestMove) {
    try {
      const playerMoveObj = chess.move(playerMove);
      if (!playerMoveObj || !playerMoveObj.captured) {
        if (playerMoveObj) chess.undo();
        return false;
      }
      chess.undo();

      const bestMoveObj = chess.move(bestMove);
      if (!bestMoveObj || !bestMoveObj.captured) {
        if (bestMoveObj) chess.undo();
        return false;
      }
      chess.undo();

      // Both are captures but different pieces or squares
      return playerMoveObj.to === bestMoveObj.to &&
             playerMoveObj.piece !== bestMoveObj.piece;
    } catch {
      return false;
    }
  }

  /**
   * Classify position type
   */
  classifyPositionType(fen, chess, tacticalTheme) {
    // Tactical themes indicate tactical positions
    const tacticalThemes = ['fork', 'pin', 'skewer', 'discovery', 'hanging_piece'];
    if (tacticalThemes.some(theme => tacticalTheme.includes(theme))) {
      return 'tactical';
    }

    // Check material balance for attacking/defensive
    const material = this.getMaterialBalance(chess);
    if (Math.abs(material) > 300) {
      return material > 0 ? 'attacking' : 'defensive';
    }

    // Check king safety issues
    if (tacticalTheme === 'king_safety') {
      return 'defensive';
    }

    // Check pawn structure issues
    if (tacticalTheme.includes('pawn_structure')) {
      return 'positional';
    }

    return 'positional';
  }

  /**
   * Calculate blunder severity based on centipawn loss
   */
  calculateSeverity(centipawnLoss) {
    if (centipawnLoss > 500) return 'critical';
    if (centipawnLoss >= 300) return 'major';
    if (centipawnLoss >= 150) return 'moderate';
    return 'minor';
  }

  /**
   * Calculate difficulty level (1-5)
   */
  calculateDifficulty(centipawnLoss, tacticalTheme, phase) {
    let difficulty = 1;

    // Base difficulty on centipawn loss
    if (centipawnLoss > 500) difficulty += 2;
    else if (centipawnLoss > 300) difficulty += 1;

    // Tactical themes are generally easier to spot
    const easyThemes = ['hanging_piece', 'wrong_capture'];
    if (!easyThemes.some(theme => tacticalTheme.includes(theme))) {
      difficulty += 1;
    }

    // Endgame blunders can be more subtle
    if (phase === 'endgame') {
      difficulty += 1;
    }

    return Math.min(5, Math.max(1, difficulty));
  }

  // === Helper Methods ===

  isSquareAttacked(chess, square, byColor) {
    const board = chess.board();
    const attackers = chess.moves({ square, verbose: true });
    return attackers.some(move => move.color !== byColor);
  }

  isSquareDefended(chess, square, byColor) {
    // Check if any piece of same color can move to this square
    const moves = chess.moves({ verbose: true });
    return moves.some(move => move.to === square && move.color === byColor);
  }

  getAttackedPieces(chess, from, attackerColor) {
    const attacked = [];
    const moves = chess.moves({ square: from, verbose: true });

    moves.forEach(move => {
      if (move.captured) {
        attacked.push({ square: move.to, piece: move.captured });
      }
    });

    return attacked;
  }

  createsPinPattern(chess, move) {
    // Simplified pin detection - checks if piece is between attacker and king/queen
    // Full implementation would require ray-casting
    return false; // Placeholder - complex logic needed
  }

  createsSkewerPattern(chess, move) {
    // Simplified skewer detection
    return false; // Placeholder - complex logic needed
  }

  getAllAttackedSquares(chess, color) {
    const moves = chess.moves({ verbose: true });
    return moves.filter(m => m.color === color).map(m => m.to);
  }

  findKing(chess, color) {
    const board = chess.board();
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece && piece.type === 'k' && piece.color === color) {
          return String.fromCharCode(97 + j) + (8 - i);
        }
      }
    }
    return null;
  }

  countAttackers(chess, square, defendingColor) {
    const attackers = chess.moves({ square, verbose: true });
    return attackers.filter(m => m.color !== defendingColor).length;
  }

  hasWeakPawnStructure(chess, color) {
    // Simplified weak pawn detection
    // Would need full pawn structure analysis
    return false; // Placeholder
  }

  isPoorSquare(chess, square, piece) {
    // Check if piece is on rim (a/h file or 1/8 rank) - generally bad for knights
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1]);

    if (piece === 'n') { // Knight
      return file === 0 || file === 7 || rank === 1 || rank === 8;
    }

    return false;
  }

  getMaterialBalance(chess) {
    const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    let balance = 0;

    const board = chess.board();
    board.forEach(row => {
      row.forEach(square => {
        if (square) {
          const value = pieceValues[square.type] || 0;
          balance += square.color === 'w' ? value : -value;
        }
      });
    });

    return balance;
  }
}

module.exports = BlunderCategorizer;
