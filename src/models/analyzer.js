const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');
const { spawn } = require('child_process');

class ChessAnalyzer {
  constructor() {
    this.engine = null;
    this.isReady = false;
    this.setupEngine();
  }

  setupEngine() {
    try {
      this.engine = spawn('stockfish');
      this.isReady = false;
      
      this.engine.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('uciok')) {
          // Engine acknowledged UCI protocol, now check if ready
          this.engine.stdin.write('isready\n');
        }
        if (output.includes('readyok')) {
          this.isReady = true;
          console.log('✅ Real Stockfish engine ready');
        }
      });
      
      this.engine.stderr.on('data', (data) => {
        console.error('Stockfish error:', data.toString());
      });
      
      // Start UCI protocol
      this.engine.stdin.write('uci\n');
      
    } catch (error) {
      console.error('❌ Failed to initialize Stockfish:', error);
      this.isReady = false;
    }
  }

  async analyzeGame(moves) {
    try {
      if (!moves || !Array.isArray(moves) || moves.length === 0) {
        throw new Error('No moves provided for analysis');
      }

      if (!this.isReady) {
        throw new Error('Stockfish engine not ready');
      }

      console.log(`🔍 Analyzing game with ${moves.length} moves using real Stockfish...`);
      
      const chess = new Chess();
      const analysis = [];
      let totalCentipawnLoss = 0;
      const blunders = [];
      
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        
        try {
          // Small delay between moves for better analysis quality
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Get position before move
          const beforeFen = chess.fen();
          
          // Get best move evaluation before the actual move
          const beforeEval = await this.evaluatePosition(beforeFen, 12);
          
          // Make the move
          try {
            chess.move(move);
          } catch (error) {
            console.warn(`Invalid move ${move} at position ${i + 1}, skipping`);
            continue;
          }
          
          // Get evaluation after the move
          const afterFen = chess.fen();
          const afterEval = await this.evaluatePosition(afterFen, 12);
          
          // Calculate centipawn loss (cap at reasonable maximum)
          const rawCentipawnLoss = this.calculateCentipawnLoss(beforeEval.evaluation, afterEval.evaluation, i % 2 === 0);
          const centipawnLoss = Math.min(rawCentipawnLoss, 500); // Cap at 500cp (5 pawns)
          totalCentipawnLoss += centipawnLoss;
          
          // Determine if it's a blunder (200cp+ loss to match Chess.com standards)
          const isBlunder = centipawnLoss > 200;
          if (isBlunder) {
            blunders.push({
              moveNumber: Math.ceil((i + 1) / 2),
              move: move,
              centipawnLoss: centipawnLoss
            });
          }
          
          const moveAnalysis = {
            move_number: i + 1,
            move: move,
            evaluation: afterEval.evaluation,
            best_move: beforeEval.bestMove,
            centipawn_loss: centipawnLoss,
            is_blunder: isBlunder,
            alternatives: beforeEval.bestMove !== move ? [beforeEval.bestMove] : []
          };
          
          analysis.push(moveAnalysis);
          
          // Progress indicator
          if ((i + 1) % 10 === 0) {
            console.log(`📊 Analyzed ${i + 1}/${moves.length} moves`);
          }
        } catch (moveError) {
          console.error(`Error analyzing move ${i + 1} (${move}):`, moveError.message);
          // Continue with next move
        }
      }
      
      // Calculate accuracy
      const averageCentipawnLoss = totalCentipawnLoss / moves.length;
      const accuracy = Math.max(0, Math.min(100, 100 - (averageCentipawnLoss / 25)));
      
      return {
        moves: analysis,
        summary: {
          totalMoves: moves.length,
          accuracy: Math.round(accuracy),
          blunders: blunders.length,
          averageCentipawnLoss: Math.round(averageCentipawnLoss),
          blunderDetails: blunders
        }
      };
    } catch (error) {
      console.error('Analyzer error:', error.message);
      throw error;
    }
  }

  async evaluatePosition(fen, depth = 12) {
    return new Promise((resolve) => {
      if (!this.engine || !this.isReady) {
        resolve({
          bestMove: 'e4',
          evaluation: 0
        });
        return;
      }

      let bestMove = '';
      let evaluation = 0;
      let resolved = false;
      
      const dataHandler = (data) => {
        const output = data.toString();
        const lines = output.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('bestmove') && !resolved) {
            bestMove = line.split(' ')[1] || 'e4';
            this.engine.stdout.removeListener('data', dataHandler);
            resolved = true;
            resolve({ bestMove, evaluation });
            return;
          } else if (line.includes('score cp')) {
            const match = line.match(/score cp (-?\d+)/);
            if (match) {
              evaluation = parseInt(match[1]);
            }
          } else if (line.includes('score mate')) {
            const match = line.match(/score mate (-?\d+)/);
            if (match) {
              const mateIn = parseInt(match[1]);
              evaluation = mateIn > 0 ? 10000 : -10000;
            }
          }
        }
      };

      this.engine.stdout.on('data', dataHandler);
      this.engine.stdin.write(`position fen ${fen}\n`);
      this.engine.stdin.write(`go depth ${depth}\n`);
      
      // Timeout after 10 seconds for complex positions
      setTimeout(() => {
        if (!resolved) {
          this.engine.stdout.removeListener('data', dataHandler);
          resolved = true;
          resolve({ bestMove: bestMove || 'e4', evaluation });
        }
      }, 10000);
    });
  }

  calculateCentipawnLoss(beforeEval, afterEval, isWhiteMove) {
    // Convert evaluations to white's perspective
    const before = isWhiteMove ? beforeEval : -beforeEval;
    const after = isWhiteMove ? afterEval : -afterEval;
    
    // Centipawn loss is the difference (should be positive for loss)
    const loss = Math.max(0, before - after);
    return Math.round(loss);
  }

  async analyzePGN(pgnContent) {
    try {
      const chess = new Chess();
      chess.loadPgn(pgnContent);
      
      const moves = chess.history();
      if (moves.length === 0) {
        throw new Error('No moves found in PGN');
      }
      
      return await this.analyzeGame(moves);
    } catch (error) {
      console.error('PGN analysis error:', error);
      throw error;
    }
  }

  async close() {
    if (this.engine) {
      this.engine.stdin.write('quit\n');
      this.engine.kill();
      this.engine = null;
      this.isReady = false;
      console.log('✅ Stockfish engine closed');
    }
  }

  // Enhanced analysis with alternative moves
  async analyzeGameWithAlternatives(moves, gameId = null) {
    if (!this.isReady) {
      throw new Error('Stockfish engine not ready');
    }

    console.log(`🔍 Enhanced analysis with alternatives: ${moves.length} moves...`);
    
    const chess = new Chess();
    const analysis = [];
    let totalCentipawnLoss = 0;
    const blunders = [];
    
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      
      try {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const beforeFen = chess.fen();
        const beforeEval = await this.evaluatePosition(beforeFen, 15);
        
        // Generate alternatives for significant positions
        let alternatives = [];
        if (i % 3 === 0 || i < 10) { // Every 3rd move or first 10 moves
          alternatives = await this.generateAlternatives(beforeFen, 12);
        }
        
        const moveResult = chess.move(move);
        if (!moveResult) {
          console.warn(`⚠️ Invalid move: ${move} at position ${i + 1}`);
          continue;
        }
        
        const afterFen = chess.fen();
        const afterEval = await this.evaluatePosition(afterFen, 15);
        
        const isWhiteMove = i % 2 === 0;
        const centipawnLoss = this.calculateCentipawnLoss(beforeEval.evaluation, afterEval.evaluation, isWhiteMove);
        const cappedCentipawnLoss = Math.min(centipawnLoss, 500);
        const isBlunder = cappedCentipawnLoss > 200;
        
        if (isBlunder) {
          blunders.push({
            moveNumber: i + 1,
            move: moveResult.san,
            centipawnLoss: cappedCentipawnLoss,
            bestMove: beforeEval.bestMove,
            alternatives: alternatives
          });
        }
        
        totalCentipawnLoss += cappedCentipawnLoss;
        
        analysis.push({
          moveNumber: i + 1,
          move: moveResult.san,
          centipawnLoss: cappedCentipawnLoss,
          isBlunder: isBlunder,
          bestMove: beforeEval.bestMove,
          evaluation: afterEval.evaluation,
          alternatives: alternatives
        });
        
      } catch (error) {
        console.error(`❌ Error analyzing move ${i + 1}:`, error.message);
        analysis.push({
          moveNumber: i + 1,
          move: move,
          centipawnLoss: 0,
          isBlunder: false,
          bestMove: 'unknown',
          evaluation: 0,
          alternatives: []
        });
      }
    }
    
    const averageCentipawnLoss = analysis.length > 0 ? totalCentipawnLoss / analysis.length : 0;
    const accuracy = Math.max(0, Math.min(100, 100 - (averageCentipawnLoss / 25)));
    
    const result = {
      moves: analysis,
      summary: {
        totalMoves: analysis.length,
        accuracy: Math.round(accuracy),
        blunders: blunders.length,
        averageCentipawnLoss: Math.round(averageCentipawnLoss),
        blunderDetails: blunders
      }
    };
    
    console.log(`✅ Enhanced analysis complete: ${analysis.length} moves, ${Math.round(accuracy)}% accuracy`);
    return result;
  }

  async generateAlternatives(fen, depth = 12) {
    return new Promise((resolve) => {
      if (!this.engine || !this.isReady) {
        resolve([]);
        return;
      }

      const alternatives = [];
      let resolved = false;

      const dataHandler = (data) => {
        const output = data.toString();
        
        // Look for multipv lines
        const pvMatch = output.match(/info.*depth (\d+).*multipv (\d+).*score cp (-?\d+).*pv (.+)/);
        if (pvMatch && alternatives.length < 3) {
          const [, , multipv, score, pv] = pvMatch;
          const moves = pv.trim().split(' ');
          const mainMove = moves[0];
          
          if (mainMove && !alternatives.find(alt => alt.move === mainMove)) {
            alternatives.push({
              move: mainMove,
              evaluation: parseInt(score),
              depth: parseInt(pvMatch[1]),
              line: moves.slice(0, 3)
            });
          }
        }

        if (output.includes('bestmove') && !resolved) {
          resolved = true;
          this.engine.stdout.removeListener('data', dataHandler);
          resolve(alternatives.slice(0, 3));
        }
      };

      this.engine.stdout.on('data', dataHandler);
      
      this.engine.stdin.write('setoption name MultiPV value 3\n');
      this.engine.stdin.write(`position fen ${fen}\n`);
      this.engine.stdin.write(`go depth ${depth}\n`);
      
      setTimeout(() => {
        if (!resolved) {
          this.engine.stdout.removeListener('data', dataHandler);
          resolved = true;
          resolve(alternatives);
        }
      }, 5000);
    });
  }
}

module.exports = ChessAnalyzer;
