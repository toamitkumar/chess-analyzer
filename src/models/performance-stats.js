const { Chess } = require('chess.js');

class PerformanceCalculator {
  constructor() {
    this.BLUNDER_THRESHOLD = 100; // centipawns
  }

  calculatePerformanceStats(analysisData) {
    const stats = {
      white: { wins: 0, draws: 0, losses: 0, accuracy: 0, blunders: 0, totalMoves: 0 },
      black: { wins: 0, draws: 0, losses: 0, accuracy: 0, blunders: 0, totalMoves: 0 }
    };

    analysisData.forEach(game => {
      this.processGame(game, stats);
    });

    // Calculate percentages
    stats.white.winRate = this.calculateWinRate(stats.white);
    stats.black.winRate = this.calculateWinRate(stats.black);
    stats.white.accuracy = this.calculateAccuracy(stats.white);
    stats.black.accuracy = this.calculateAccuracy(stats.black);

    return stats;
  }

  processGame(game, stats) {
    const { result, moves, playerColor } = game;
    
    // Update win/loss/draw counts
    this.updateGameResult(result, playerColor, stats);
    
    // Process moves for basic stats (without engine analysis for now)
    moves.forEach((move, index) => {
      const isWhiteMove = index % 2 === 0;
      const color = isWhiteMove ? 'white' : 'black';
      
      // Only count moves for the player's color
      if ((playerColor === 'white' && isWhiteMove) || (playerColor === 'black' && !isWhiteMove)) {
        stats[color].totalMoves++;
        
        // Use basic heuristics for accuracy without engine
        stats[color].accuracy += 85; // Default good accuracy
      }
    });
  }

  updateGameResult(result, playerColor, stats) {
    if (result === '1-0') { // White wins
      if (playerColor === 'white') {
        stats.white.wins++;
      } else {
        stats.black.losses++;
      }
    } else if (result === '0-1') { // Black wins
      if (playerColor === 'black') {
        stats.black.wins++;
      } else {
        stats.white.losses++;
      }
    } else { // Draw
      stats[playerColor].draws++;
    }
  }

  isBlunder(move) {
    if (!move.evaluation || !move.bestMoveEvaluation) return false;
    
    const evaluationDrop = Math.abs(move.evaluation.evaluation - move.bestMoveEvaluation.evaluation);
    return evaluationDrop >= this.BLUNDER_THRESHOLD / 100; // Convert centipawns to pawns
  }

  getMoveAccuracy(move) {
    if (!move.evaluation || !move.bestMoveEvaluation) return 100;
    
    const evaluationDrop = Math.abs(move.evaluation.evaluation - move.bestMoveEvaluation.evaluation);
    return Math.max(0, 100 - (evaluationDrop * 10)); // Simple accuracy calculation
  }

  calculateWinRate(colorStats) {
    const totalGames = colorStats.wins + colorStats.draws + colorStats.losses;
    if (totalGames === 0) return 0;
    
    return Math.round(((colorStats.wins + colorStats.draws * 0.5) / totalGames) * 100);
  }

  calculateAccuracy(colorStats) {
    if (colorStats.totalMoves === 0) return 0;
    return Math.round(colorStats.accuracy / colorStats.totalMoves);
  }

  // Parse PGN games and extract basic info
  parseGameResults(pgnFiles) {
    const games = [];
    
    pgnFiles.forEach(pgnContent => {
      const chess = new Chess();
      
      try {
        chess.loadPgn(pgnContent);
        const header = this.extractPgnHeader(pgnContent);
        
        games.push({
          result: header.Result || '*',
          playerColor: this.determinePlayerColor(header),
          moves: chess.history({ verbose: true }),
          white: header.White,
          black: header.Black
        });
      } catch (error) {
        console.warn('Failed to parse PGN:', error.message);
      }
    });
    
    return games;
  }

  extractPgnHeader(pgnContent) {
    const header = {};
    const headerLines = pgnContent.split('\n').filter(line => line.startsWith('['));
    
    headerLines.forEach(line => {
      const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
      if (match) {
        header[match[1]] = match[2];
      }
    });
    
    return header;
  }

  determinePlayerColor(header) {
    // This would need to be configured based on the player's name
    // For now, assume we're analyzing from White's perspective
    return 'white';
  }
}

module.exports = PerformanceCalculator;
