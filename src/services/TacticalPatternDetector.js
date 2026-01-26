/**
 * TacticalPatternDetector
 *
 * Detects tactical patterns (forks, pins, skewers, discovered attacks) in chess positions.
 * Used to identify found vs missed tactical opportunities.
 *
 * Reference: ADR 009 Phase 5.1 - Found vs Missed Tactical Opportunities
 */

const { Chess } = require('chess.js');

class TacticalPatternDetector {
  constructor() {
    // Piece values for determining if a tactic is valuable
    this.pieceValues = {
      'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 100
    };

    // Minimum evaluation gain to consider a tactic significant (centipawns)
    this.MIN_TACTIC_GAIN = 100;
  }

  /**
   * Detect tactical opportunities in a position
   * @param {string} fen - Position before the move
   * @param {string} bestMove - Engine's best move (SAN notation)
   * @param {string} playedMove - Move that was played (SAN notation)
   * @param {number} evalGain - Evaluation gain from playing best move vs played move
   * @param {string} playerColor - 'white' or 'black'
   * @returns {Object|null} Detected tactical opportunity or null
   */
  detectOpportunity(fen, bestMove, playedMove, evalGain, playerColor) {
    if (!fen || !bestMove) return null;

    // Only look for significant tactical opportunities
    if (evalGain < this.MIN_TACTIC_GAIN) return null;

    try {
      const chess = new Chess(fen);
      const colorToMove = chess.turn() === 'w' ? 'white' : 'black';

      // Only analyze if it's the player's move
      if (colorToMove !== playerColor) return null;

      // Try to make the best move to analyze what it achieves
      // Handle both SAN (e.g., "Nf3") and UCI (e.g., "g1f3") formats
      let moveResult = null;
      try {
        moveResult = chess.move(bestMove);
      } catch (e) {
        // If SAN fails, try UCI format
        if (bestMove.length >= 4) {
          try {
            moveResult = chess.move({
              from: bestMove.substring(0, 2),
              to: bestMove.substring(2, 4),
              promotion: bestMove.length > 4 ? bestMove[4] : undefined
            });
          } catch (e2) {
            // Move is invalid in both formats
            return null;
          }
        }
      }
      if (!moveResult) return null;

      // Detect what type of tactic the best move creates
      const tactics = [];

      // Check for fork
      const fork = this._detectFork(fen, bestMove, moveResult);
      if (fork) tactics.push(fork);

      // Check for pin
      const pin = this._detectPin(fen, bestMove, moveResult);
      if (pin) tactics.push(pin);

      // Check for skewer
      const skewer = this._detectSkewer(fen, bestMove, moveResult);
      if (skewer) tactics.push(skewer);

      // Check for discovered attack
      const discovered = this._detectDiscoveredAttack(fen, bestMove, moveResult);
      if (discovered) tactics.push(discovered);

      // Return the most valuable tactic found
      if (tactics.length > 0) {
        // Sort by value (most valuable first)
        tactics.sort((a, b) => (b.value || 0) - (a.value || 0));
        const bestTactic = tactics[0];

        return {
          tacticType: bestTactic.type,
          attackingPiece: moveResult.piece.toUpperCase(),
          targetPieces: bestTactic.targets || [],
          bestMove: bestMove,
          wasFound: bestMove === playedMove,
          evalGain: evalGain,
          description: bestTactic.description
        };
      }

      // If significant eval gain but no specific pattern detected,
      // it might be a tactical sequence
      if (evalGain >= 200) {
        return {
          tacticType: 'tactical_sequence',
          attackingPiece: moveResult.piece.toUpperCase(),
          targetPieces: [],
          bestMove: bestMove,
          wasFound: bestMove === playedMove,
          evalGain: evalGain,
          description: `Tactical sequence gaining ${evalGain} centipawns`
        };
      }

      return null;
    } catch (error) {
      console.warn(`TacticalPatternDetector error: ${error.message}`);
      return null;
    }
  }

  /**
   * Detect if a move creates a fork (attacking multiple pieces)
   * @private
   */
  _detectFork(fen, bestMove, moveResult) {
    try {
      const chess = new Chess(fen);
      chess.move(bestMove);

      // Get all pieces the moved piece is now attacking
      const movedPiece = moveResult.piece;
      const toSquare = moveResult.to;
      const attackedPieces = [];

      // Check all squares for enemy pieces being attacked
      const board = chess.board();
      const enemyColor = chess.turn(); // After move, it's enemy's turn

      for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
          const square = board[rank][file];
          if (square && square.color === enemyColor) {
            const targetSquare = String.fromCharCode(97 + file) + (8 - rank);

            // Check if the moved piece attacks this square
            if (this._pieceAttacks(chess, toSquare, targetSquare, movedPiece)) {
              attackedPieces.push({
                piece: square.type.toUpperCase(),
                square: targetSquare,
                value: this.pieceValues[square.type]
              });
            }
          }
        }
      }

      // A fork requires attacking at least 2 valuable pieces
      const valuableTargets = attackedPieces.filter(p => p.value >= 3);
      if (valuableTargets.length >= 2) {
        const totalValue = valuableTargets.reduce((sum, p) => sum + p.value, 0);
        return {
          type: 'fork',
          targets: valuableTargets.map(p => p.piece),
          value: totalValue,
          description: `${moveResult.piece.toUpperCase()} forks ${valuableTargets.map(p => p.piece).join(' and ')}`
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect if a move creates or exploits a pin
   * @private
   */
  _detectPin(fen, bestMove, moveResult) {
    try {
      const chess = new Chess(fen);
      chess.move(bestMove);

      const toSquare = moveResult.to;
      const movedPiece = moveResult.piece;

      // Only bishops, rooks, and queens can create pins
      if (!['b', 'r', 'q'].includes(movedPiece)) return null;

      // Check for pins created by the move
      const pins = this._findPinsFromSquare(chess, toSquare, movedPiece);

      if (pins.length > 0) {
        const mostValuable = pins.sort((a, b) => b.value - a.value)[0];
        return {
          type: 'pin',
          targets: [mostValuable.pinnedPiece, mostValuable.behindPiece],
          value: mostValuable.value,
          description: `${movedPiece.toUpperCase()} pins ${mostValuable.pinnedPiece} against ${mostValuable.behindPiece}`
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect if a move creates a skewer
   * @private
   */
  _detectSkewer(fen, bestMove, moveResult) {
    try {
      const chess = new Chess(fen);
      chess.move(bestMove);

      const toSquare = moveResult.to;
      const movedPiece = moveResult.piece;

      // Only bishops, rooks, and queens can create skewers
      if (!['b', 'r', 'q'].includes(movedPiece)) return null;

      // Check for skewers (more valuable piece in front, less valuable behind)
      const skewers = this._findSkewersFromSquare(chess, toSquare, movedPiece);

      if (skewers.length > 0) {
        const mostValuable = skewers.sort((a, b) => b.value - a.value)[0];
        return {
          type: 'skewer',
          targets: [mostValuable.frontPiece, mostValuable.behindPiece],
          value: mostValuable.value,
          description: `${movedPiece.toUpperCase()} skewers ${mostValuable.frontPiece} with ${mostValuable.behindPiece} behind`
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect if a move creates a discovered attack
   * @private
   */
  _detectDiscoveredAttack(fen, bestMove, moveResult) {
    try {
      const chessBefore = new Chess(fen);
      const chessAfter = new Chess(fen);
      chessAfter.move(bestMove);

      const fromSquare = moveResult.from;
      const playerColor = chessBefore.turn() === 'w' ? 'white' : 'black';

      // Check if moving the piece reveals an attack from a piece behind it
      const board = chessBefore.board();

      // Find pieces that were behind the moved piece
      const behindPieces = this._findPiecesBehind(chessBefore, fromSquare, playerColor);

      for (const behindPiece of behindPieces) {
        // Check if this piece now attacks enemy pieces that it didn't before
        const newAttacks = this._getNewAttacks(chessBefore, chessAfter, behindPiece.square);

        if (newAttacks.length > 0) {
          const valuableAttack = newAttacks.filter(a => a.value >= 3);
          if (valuableAttack.length > 0) {
            const target = valuableAttack[0];
            return {
              type: 'discovered_attack',
              targets: [target.piece],
              value: target.value,
              attackingPiece: behindPiece.piece.toUpperCase(),
              description: `Discovered attack on ${target.piece} by ${behindPiece.piece.toUpperCase()}`
            };
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a piece on fromSquare attacks toSquare
   * @private
   */
  _pieceAttacks(chess, fromSquare, toSquare, pieceType) {
    // Simple check using chess.js move generation
    try {
      const tempChess = new Chess(chess.fen());
      // Load position before making any moves
      const moves = tempChess.moves({ square: fromSquare, verbose: true });
      return moves.some(m => m.to === toSquare);
    } catch (error) {
      return false;
    }
  }

  /**
   * Find pins created from a square
   * @private
   */
  _findPinsFromSquare(chess, square, pieceType) {
    const pins = [];
    const directions = this._getDirections(pieceType);
    const board = chess.board();
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    const attackerColor = chess.turn() === 'w' ? 'b' : 'w'; // Attacker is the opposite of current turn

    for (const [df, dr] of directions) {
      let f = file + df;
      let r = rank + dr;
      let firstPiece = null;
      let secondPiece = null;

      while (f >= 0 && f < 8 && r >= 0 && r < 8) {
        const pieceOnSquare = board[r][f];

        if (pieceOnSquare) {
          if (!firstPiece) {
            firstPiece = {
              piece: pieceOnSquare.type.toUpperCase(),
              color: pieceOnSquare.color,
              square: String.fromCharCode(97 + f) + (8 - r),
              value: this.pieceValues[pieceOnSquare.type]
            };
          } else {
            secondPiece = {
              piece: pieceOnSquare.type.toUpperCase(),
              color: pieceOnSquare.color,
              square: String.fromCharCode(97 + f) + (8 - r),
              value: this.pieceValues[pieceOnSquare.type]
            };
            break;
          }
        }

        f += df;
        r += dr;
      }

      // A pin: enemy piece in front, more valuable enemy piece behind
      if (firstPiece && secondPiece &&
        firstPiece.color !== attackerColor && secondPiece.color !== attackerColor &&
        secondPiece.value > firstPiece.value) {
        pins.push({
          pinnedPiece: firstPiece.piece,
          behindPiece: secondPiece.piece,
          value: firstPiece.value
        });
      }
    }

    return pins;
  }

  /**
   * Find skewers created from a square
   * @private
   */
  _findSkewersFromSquare(chess, square, pieceType) {
    const skewers = [];
    const directions = this._getDirections(pieceType);
    const board = chess.board();
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    const attackerColor = chess.turn() === 'w' ? 'b' : 'w';

    for (const [df, dr] of directions) {
      let f = file + df;
      let r = rank + dr;
      let firstPiece = null;
      let secondPiece = null;

      while (f >= 0 && f < 8 && r >= 0 && r < 8) {
        const pieceOnSquare = board[r][f];

        if (pieceOnSquare) {
          if (!firstPiece) {
            firstPiece = {
              piece: pieceOnSquare.type.toUpperCase(),
              color: pieceOnSquare.color,
              square: String.fromCharCode(97 + f) + (8 - r),
              value: this.pieceValues[pieceOnSquare.type]
            };
          } else {
            secondPiece = {
              piece: pieceOnSquare.type.toUpperCase(),
              color: pieceOnSquare.color,
              square: String.fromCharCode(97 + f) + (8 - r),
              value: this.pieceValues[pieceOnSquare.type]
            };
            break;
          }
        }

        f += df;
        r += dr;
      }

      // A skewer: more valuable enemy piece in front, less valuable behind
      if (firstPiece && secondPiece &&
        firstPiece.color !== attackerColor && secondPiece.color !== attackerColor &&
        firstPiece.value > secondPiece.value) {
        skewers.push({
          frontPiece: firstPiece.piece,
          behindPiece: secondPiece.piece,
          value: secondPiece.value // We gain the piece behind
        });
      }
    }

    return skewers;
  }

  /**
   * Get movement directions for a sliding piece
   * @private
   */
  _getDirections(pieceType) {
    switch (pieceType) {
      case 'b':
        return [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      case 'r':
        return [[1, 0], [-1, 0], [0, 1], [0, -1]];
      case 'q':
        return [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
      default:
        return [];
    }
  }

  /**
   * Find pieces behind a square (for discovered attacks)
   * @private
   */
  _findPiecesBehind(chess, square, playerColor) {
    const pieces = [];
    const board = chess.board();
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    const color = playerColor === 'white' ? 'w' : 'b';

    // Check all 8 directions
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

    for (const [df, dr] of directions) {
      let f = file + df;
      let r = rank + dr;

      while (f >= 0 && f < 8 && r >= 0 && r < 8) {
        const pieceOnSquare = board[r][f];

        if (pieceOnSquare) {
          if (pieceOnSquare.color === color && ['b', 'r', 'q'].includes(pieceOnSquare.type)) {
            pieces.push({
              piece: pieceOnSquare.type,
              square: String.fromCharCode(97 + f) + (8 - r),
              direction: [df, dr]
            });
          }
          break; // Stop at first piece in this direction
        }

        f += df;
        r += dr;
      }
    }

    return pieces;
  }

  /**
   * Get new attacks after a move
   * @private
   */
  _getNewAttacks(chessBefore, chessAfter, attackerSquare) {
    const newAttacks = [];

    try {
      // Get attacks before
      const movesBefore = new Set(
        chessBefore.moves({ square: attackerSquare, verbose: true })
          .filter(m => m.captured)
          .map(m => m.to)
      );

      // Get attacks after
      const movesAfter = chessAfter.moves({ square: attackerSquare, verbose: true })
        .filter(m => m.captured);

      for (const move of movesAfter) {
        if (!movesBefore.has(move.to)) {
          newAttacks.push({
            piece: move.captured.toUpperCase(),
            square: move.to,
            value: this.pieceValues[move.captured]
          });
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return newAttacks;
  }
}

module.exports = TacticalPatternDetector;
