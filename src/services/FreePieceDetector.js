/**
 * FreePieceDetector
 *
 * Detects when opponents leave pieces hanging (free pieces).
 * Tracks whether the player captured these free pieces or missed them.
 *
 * Reference: ADR 009 Phase 5.3 - Free Pieces (Opponent Blunders)
 */

const { Chess } = require('chess.js');

class FreePieceDetector {
  constructor() {
    // Piece values for material calculation
    this.pieceValues = {
      'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9
    };

    // Minimum value of free piece to track (pawns and above)
    this.MIN_FREE_PIECE_VALUE = 1;
  }

  /**
   * Detect free pieces (undefended enemy pieces) in a position
   * @param {string} fen - Position to analyze
   * @param {string} playedMove - Move that was actually played (SAN notation)
   * @param {Array} alternatives - Alternative moves from engine analysis
   * @param {string} playerColor - 'white' or 'black'
   * @returns {Object|null} Free piece opportunity or null
   */
  detectFreePiece(fen, playedMove, alternatives, playerColor) {
    if (!fen) return null;

    try {
      const chess = new Chess(fen);
      const colorToMove = chess.turn() === 'w' ? 'white' : 'black';

      // Only analyze if it's the player's move
      if (colorToMove !== playerColor) return null;

      // Find all free (hanging/undefended) enemy pieces
      const freePieces = this._findFreePieces(chess, playerColor);

      if (freePieces.length === 0) return null;

      // Find the most valuable free piece
      const mostValuable = freePieces.sort((a, b) => b.value - a.value)[0];

      // Check if the played move captures this free piece
      const wasCaptured = this._moveCaptures(playedMove, mostValuable.square, chess);

      // Find the best capture move from alternatives
      const bestCaptureMove = this._findBestCaptureMove(freePieces, alternatives, chess);

      return {
        opponentPiece: mostValuable.piece.toUpperCase(),
        pieceValue: mostValuable.value,
        pieceSquare: mostValuable.square,
        wasCaptured: wasCaptured,
        captureMove: bestCaptureMove || this._getCaptureMoveFor(chess, mostValuable.square),
        playedMove: playedMove,
        allFreePieces: freePieces.map(p => ({
          piece: p.piece.toUpperCase(),
          square: p.square,
          value: p.value
        }))
      };
    } catch (error) {
      console.warn(`FreePieceDetector error: ${error.message}`);
      return null;
    }
  }

  /**
   * Find all free (undefended or insufficiently defended) enemy pieces
   * @private
   */
  _findFreePieces(chess, playerColor) {
    const freePieces = [];
    const board = chess.board();
    const enemyColor = playerColor === 'white' ? 'b' : 'w';

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];

        if (piece && piece.color === enemyColor && piece.type !== 'k') {
          const square = String.fromCharCode(97 + file) + (8 - rank);

          // Check if this piece is undefended or can be captured for free
          const isFree = this._isPieceFree(chess, square, piece, playerColor);

          if (isFree) {
            freePieces.push({
              piece: piece.type,
              square: square,
              value: this.pieceValues[piece.type] || 0
            });
          }
        }
      }
    }

    return freePieces;
  }

  /**
   * Check if a piece is free (hanging or can be captured without losing material)
   * @private
   */
  _isPieceFree(chess, square, piece, playerColor) {
    // Get all moves that can capture this piece
    const capturingMoves = this._getCapturingMoves(chess, square);

    if (capturingMoves.length === 0) return false;

    // For each capturing move, check if it's a good capture
    for (const captureMove of capturingMoves) {
      const capturer = this._getPieceAt(chess, captureMove.from);
      if (!capturer) continue;

      // If the capturer is worth less than or equal to the target, it's free
      const capturerValue = this.pieceValues[capturer.type] || 0;
      const targetValue = this.pieceValues[piece.type] || 0;

      if (capturerValue <= targetValue) {
        // Check if the capturer would be recaptured
        const isRecaptured = this._wouldBeRecaptured(chess, captureMove, capturer, playerColor);

        // If not recaptured, or recapture is worth it, piece is free
        if (!isRecaptured || targetValue > capturerValue) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get all moves that capture a piece on a specific square
   * @private
   */
  _getCapturingMoves(chess, targetSquare) {
    const moves = chess.moves({ verbose: true });
    return moves.filter(m => m.to === targetSquare && m.captured);
  }

  /**
   * Get piece at a specific square
   * @private
   */
  _getPieceAt(chess, square) {
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    const board = chess.board();
    return board[rank] && board[rank][file];
  }

  /**
   * Check if a capturer would be recaptured after taking
   * @private
   */
  _wouldBeRecaptured(chess, captureMove, capturer, playerColor) {
    try {
      // Make a copy and make the capture
      const tempChess = new Chess(chess.fen());
      tempChess.move(captureMove);

      // Check if there are any recaptures on the target square
      const recaptures = tempChess.moves({ verbose: true })
        .filter(m => m.to === captureMove.to && m.captured);

      return recaptures.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a move captures a specific square
   * @private
   */
  _moveCaptures(moveSan, targetSquare, chess) {
    try {
      const tempChess = new Chess(chess.fen());
      const moveResult = tempChess.move(moveSan);

      if (!moveResult) return false;

      return moveResult.to === targetSquare && !!moveResult.captured;
    } catch (error) {
      return false;
    }
  }

  /**
   * Find the best capture move from alternatives for a free piece
   * @private
   */
  _findBestCaptureMove(freePieces, alternatives, chess) {
    if (!alternatives || alternatives.length === 0) return null;

    const freeSquares = new Set(freePieces.map(p => p.square));

    for (const alt of alternatives) {
      try {
        const moveSan = alt.move || alt.moveUci;
        const tempChess = new Chess(chess.fen());

        // Try SAN format first, then UCI
        let moveResult = null;
        try {
          moveResult = tempChess.move(moveSan);
        } catch (e) {
          if (moveSan && moveSan.length >= 4) {
            try {
              moveResult = tempChess.move({
                from: moveSan.substring(0, 2),
                to: moveSan.substring(2, 4),
                promotion: moveSan.length > 4 ? moveSan[4] : undefined
              });
            } catch (e2) {
              continue;
            }
          }
        }

        if (moveResult && freeSquares.has(moveResult.to)) {
          return moveSan;
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  /**
   * Get a capture move for a specific square
   * @private
   */
  _getCaptureMoveFor(chess, targetSquare) {
    const moves = chess.moves({ verbose: true })
      .filter(m => m.to === targetSquare && m.captured);

    if (moves.length > 0) {
      // Return the capture with the least valuable attacker
      moves.sort((a, b) => {
        const valueA = this.pieceValues[a.piece] || 0;
        const valueB = this.pieceValues[b.piece] || 0;
        return valueA - valueB;
      });
      return moves[0].san;
    }

    return null;
  }

  /**
   * Analyze a position after opponent's move to detect if they blundered a piece
   * @param {string} fenAfterOpponentMove - Position after opponent moved
   * @param {string} opponentMove - The move opponent just played (SAN notation)
   * @param {Array} alternatives - Engine's alternatives for this position
   * @param {string} playerColor - 'white' or 'black'
   * @returns {Object|null} Opponent blunder info or null
   */
  detectOpponentBlunder(fenAfterOpponentMove, opponentMove, alternatives, playerColor) {
    // This method looks at the position AFTER the opponent moved
    // to see if they left something hanging
    return this.detectFreePiece(fenAfterOpponentMove, null, alternatives, playerColor);
  }
}

module.exports = FreePieceDetector;
