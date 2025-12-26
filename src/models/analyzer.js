const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');
const { spawn } = require('child_process');
const BlunderCategorizer = require('./blunder-categorizer');

class ChessAnalyzer {
  constructor() {
    this.engine = null;
    this.isReady = false;
    this.blunderCategorizer = new BlunderCategorizer();
    this.setupEngine();
  }

  // Lichess-style win probability calculation
  // Converts centipawn evaluation to win probability (0-1)
  centipawnToWinProbability(cp) {
    // Lichess uses a sigmoid function based on empirical data
    // This approximates real game outcomes
    return 1 / (1 + Math.exp(-0.004 * cp));
  }

  // Convert win probability to centipawn equivalent
  winProbabilityToCentipawn(wp) {
    if (wp <= 0) return -10000;
    if (wp >= 1) return 10000;
    return Math.round(-250 * Math.log((1 - wp) / wp));
  }

  // Lichess-style accuracy calculation based on win probability loss
  // Returns accuracy score from 0-100
  calculateMoveAccuracy(beforeEval, afterEval, isWhiteMove) {
    // Stockfish evaluates from side to move's perspective
    // beforeEval: from mover's perspective
    // afterEval: from opponent's perspective (after move)
    const beforeCp = beforeEval;
    const afterCp = -afterEval; // Negate to get mover's perspective

    const beforeWp = this.centipawnToWinProbability(beforeCp);
    const afterWp = this.centipawnToWinProbability(afterCp);

    // Win probability should stay the same or improve after a good move
    const wpLoss = Math.max(0, beforeWp - afterWp);

    // Convert to accuracy score (Lichess formula approximation)
    // Perfect move = 100%, losing all winning chances = 0%
    const accuracy = Math.max(0, Math.min(100, 100 * (1 - wpLoss)));

    return accuracy;
  }

  // Classify move quality based on Lichess/Chess.com standards
  classifyMove(centipawnLoss, playedMoveSan, bestMoveUci, alternatives, playedMoveUci = null) {
    // Check if player played the actual best move (engine's top choice)
    const playedBestMove = playedMoveUci && (
      playedMoveUci === bestMoveUci ||
      (alternatives && alternatives.length > 0 && alternatives[0].move === playedMoveUci)
    );

    // Lichess/Chess.com style thresholds (based on centipawn loss)
    // Best: Played the engine's #1 move OR negligible loss (0-2 cp)
    if (playedBestMove || centipawnLoss <= 2) {
      return 'best';
    } else if (centipawnLoss <= 10) {
      return 'excellent';
    } else if (centipawnLoss <= 25) {
      return 'good';
    } else if (centipawnLoss <= 50) {
      return 'inaccuracy';
    } else if (centipawnLoss <= 100) {
      return 'mistake';
    } else {
      return 'blunder'; // >100cp loss
    }
  }

  // Calculate overall game accuracy using Lichess formula
  // Based on average centipawn loss with exponential decay
  calculateGameAccuracy(averageCentipawnLoss) {
    // Lichess uses a formula based on win probability changes
    // Reference: https://lichess.org/page/accuracy
    //
    // Approximate mapping (based on Lichess data):
    // ACPL 0-5:   95-100% accuracy
    // ACPL 5-10:  90-95% accuracy
    // ACPL 10-20: 80-90% accuracy
    // ACPL 20-35: 70-80% accuracy
    // ACPL 35-50: 60-70% accuracy
    // ACPL 50+:   <60% accuracy

    if (averageCentipawnLoss <= 0) return 100;

    // Balanced formula that matches Lichess accuracy scale
    // Uses combination of linear and polynomial scaling
    const accuracy = 100 - (averageCentipawnLoss * 0.8) - Math.pow(averageCentipawnLoss / 15, 2);

    return Math.max(0, Math.min(100, Math.round(accuracy * 10) / 10));
  }

  setupEngine() {
    try {
      this.engine = spawn('stockfish');
      this.isReady = false;

      // Set up event handlers BEFORE sending any commands
      this.engine.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('uciok')) {
          // Engine acknowledged UCI protocol
          // Set Threads to 1 for deterministic analysis results
          console.log('🔧 [DETERMINISM] Setting Threads=1 for deterministic analysis');
          this.engine.stdin.write('setoption name Threads value 1\n');
          // Set Hash to a fixed size for consistency
          console.log('🔧 [DETERMINISM] Setting Hash=128MB for consistency');
          this.engine.stdin.write('setoption name Hash value 128\n');
          // Now check if ready
          this.engine.stdin.write('isready\n');
        }
        if (output.includes('readyok')) {
          this.isReady = true;
          console.log('✅ Real Stockfish engine ready (deterministic mode: Threads=1)');
        }
      });

      this.engine.stderr.on('data', (data) => {
        console.error('Stockfish error:', data.toString());
      });

      this.engine.on('error', (err) => {
        console.error('❌ Stockfish process error:', err);
        this.isReady = false;
      });

      this.engine.on('close', (code) => {
        if (code !== 0) {
          console.error(`❌ Stockfish process exited with code ${code}`);
        }
        this.isReady = false;
      });

      // Small delay to ensure event handlers are registered, then start UCI protocol
      setTimeout(() => {
        if (this.engine && this.engine.stdin) {
          this.engine.stdin.write('uci\n');
        }
      }, 100);

    } catch (error) {
      console.error('❌ Failed to initialize Stockfish:', error);
      this.isReady = false;
    }
  }

  async analyzeGame(moves, fetchAlternatives = true) {
    try {
      if (!moves || !Array.isArray(moves) || moves.length === 0) {
        throw new Error('No moves provided for analysis');
      }

      if (!this.isReady) {
        throw new Error('Stockfish engine not ready');
      }

      // Reset engine state before each game for deterministic results
      // This clears the hash table and ensures consistent evaluations
      console.log('🔄 [DETERMINISM] Sending ucinewgame to reset engine state...');
      this.engine.stdin.write('ucinewgame\n');
      this.engine.stdin.write('isready\n');
      console.log('🔄 [DETERMINISM] Waiting for readyok response...');

      // Wait for engine to be ready after reset
      await new Promise((resolve) => {
        const readyHandler = (data) => {
          const output = data.toString();
          if (output.includes('readyok')) {
            console.log('✅ [DETERMINISM] Engine ready after ucinewgame reset');
            this.engine.stdout.removeListener('data', readyHandler);
            resolve();
          }
        };
        this.engine.stdout.on('data', readyHandler);

        // Timeout after 2 seconds
        setTimeout(() => {
          console.log('⚠️ [DETERMINISM] Timeout waiting for readyok, proceeding anyway');
          this.engine.stdout.removeListener('data', readyHandler);
          resolve();
        }, 2000);
      });

      console.log(`🔍 Analyzing game with ${moves.length} moves using real Stockfish...`);
      if (fetchAlternatives) {
        console.log(`🔄 Fetching up to 10 alternative moves for each position`);
      }

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

          // Fetch up to 10 alternative moves for each position
          let alternatives = [];
          if (fetchAlternatives) {
            console.log(`🔄 Fetching alternatives for move ${i + 1}...`);
            alternatives = await this.generateAlternatives(beforeFen, 12, 10);
            console.log(`✅ Found ${alternatives.length} alternatives for move ${i + 1}`);
          } else {
            // Fallback to just the best move
            alternatives = beforeEval.bestMove !== move ? [{ move: beforeEval.bestMove, evaluation: beforeEval.evaluation }] : [];
          }

          // Make the move and get UCI notation
          let moveResult;
          let playedMoveUci = '';
          try {
            moveResult = chess.move(move);
            // Convert SAN move to UCI (e.g., "e4" -> "e2e4")
            playedMoveUci = moveResult.from + moveResult.to;
            if (moveResult.promotion) {
              playedMoveUci += moveResult.promotion;
            }
          } catch (error) {
            console.warn(`Invalid move ${move} at position ${i + 1}, skipping`);
            continue;
          }

          // Get evaluation after the move
          const afterFen = chess.fen();
          const afterEval = await this.evaluatePosition(afterFen, 12);

          // Calculate centipawn loss by comparing to best move in alternatives
          const isWhiteMove = i % 2 === 0;
          let centipawnLoss = 0;

          if (alternatives.length > 0) {
            // Find the played move in alternatives list
            const bestMoveEval = alternatives[0].evaluation;
            const playedMoveAlt = alternatives.find(alt => alt.move === playedMoveUci);

            if (playedMoveAlt) {
              // Player played one of the top moves - calculate loss from best
              centipawnLoss = Math.max(0, bestMoveEval - playedMoveAlt.evaluation);
            } else {
              // Player played a move not in top alternatives
              // Compare best alternative evaluation to actual result
              // afterEval is from OPPONENT's perspective (after we moved, it's their turn)
              // bestMoveEval is from MOVER's perspective (from alternatives before the move)
              // We need to negate afterEval to get mover's perspective
              const actualEval = -afterEval.evaluation; // Convert to mover's perspective
              centipawnLoss = Math.max(0, bestMoveEval - actualEval);
            }
          } else {
            // Fallback to old calculation if no alternatives
            const rawCentipawnLoss = this.calculateCentipawnLoss(beforeEval.evaluation, afterEval.evaluation, isWhiteMove);
            centipawnLoss = rawCentipawnLoss;
          }

          centipawnLoss = Math.min(centipawnLoss, 500); // Cap at 500cp (5 pawns)
          totalCentipawnLoss += centipawnLoss;

          // Calculate per-move accuracy (Lichess style)
          const moveAccuracy = this.calculateMoveAccuracy(beforeEval.evaluation, afterEval.evaluation, isWhiteMove);

          // Calculate win probability before and after from mover's perspective
          // beforeEval is from mover's perspective, afterEval is from opponent's perspective
          const wpBefore = this.centipawnToWinProbability(beforeEval.evaluation);
          const wpAfter = this.centipawnToWinProbability(-afterEval.evaluation); // Negate for mover's view

          // Classify move quality (Lichess/Chess.com style)
          const moveQuality = this.classifyMove(centipawnLoss, move, beforeEval.bestMove, alternatives, playedMoveUci);

          // Determine move quality flags (for backward compatibility)
          const isBlunder = moveQuality === 'blunder';
          const isMistake = moveQuality === 'mistake';
          const isInaccuracy = moveQuality === 'inaccuracy';
          const isBest = moveQuality === 'best';
          const isExcellent = moveQuality === 'excellent';
          const isGood = moveQuality === 'good';

          // Categorize blunders, mistakes, and inaccuracies with enhanced details
          let categorization = null;
          if (isBlunder || isMistake || isInaccuracy) {
            try {
              const tempChess = new Chess(beforeFen);
              categorization = this.blunderCategorizer.categorizeBlunder({
                fen: beforeFen,
                moveNumber: Math.ceil((i + 1) / 2),
                playerMove: playedMoveUci,
                bestMove: beforeEval.bestMove,
                evaluationBefore: beforeEval.evaluation,
                evaluationAfter: -afterEval.evaluation, // From mover's perspective
                centipawnLoss: centipawnLoss
              }, tempChess);
            } catch (error) {
              console.warn(`Failed to categorize move ${i + 1}:`, error.message);
            }
          }

          if (isBlunder) {
            blunders.push({
              moveNumber: Math.ceil((i + 1) / 2),
              move: move,
              centipawnLoss: centipawnLoss,
              winProbabilityLoss: Math.round((wpBefore - wpAfter) * 100),
              categorization: categorization // Add categorization details
            });
          }

          const moveAnalysis = {
            move_number: i + 1,
            move: move,
            evaluation: afterEval.evaluation,
            best_move: beforeEval.bestMove,
            centipawn_loss: centipawnLoss,
            move_accuracy: Math.round(moveAccuracy * 10) / 10, // Per-move accuracy
            move_quality: moveQuality, // best/excellent/good/inaccuracy/mistake/blunder
            win_probability_before: Math.round(wpBefore * 1000) / 10, // As percentage
            win_probability_after: Math.round(wpAfter * 1000) / 10,
            is_best: isBest,
            is_excellent: isExcellent,
            is_good: isGood,
            is_blunder: isBlunder,
            is_mistake: isMistake,
            is_inaccuracy: isInaccuracy,
            fen_before: beforeFen,
            fen_after: afterFen,
            alternatives: alternatives, // Up to 10 alternative moves with lines
            categorization: categorization // Enhanced blunder/mistake/inaccuracy categorization
          };

          analysis.push(moveAnalysis);

          // Progress indicator with more details
          if ((i + 1) % 10 === 0) {
            const currentAccuracy = this.calculateGameAccuracy(totalCentipawnLoss / (i + 1));
            console.log(`📊 Analyzed ${i + 1}/${moves.length} moves (Accuracy: ${Math.round(currentAccuracy)}%)`);
          }
        } catch (moveError) {
          console.error(`Error analyzing move ${i + 1} (${move}):`, moveError.message);
          // Continue with next move
        }
      }

      // Calculate overall game accuracy using Lichess formula
      const averageCentipawnLoss = totalCentipawnLoss / moves.length;
      const accuracy = this.calculateGameAccuracy(averageCentipawnLoss);

      // Count move quality distribution
      const moveQualityCounts = {
        best: analysis.filter(m => m.is_best).length,
        excellent: analysis.filter(m => m.is_excellent).length,
        good: analysis.filter(m => m.is_good).length,
        inaccuracies: analysis.filter(m => m.is_inaccuracy).length,
        mistakes: analysis.filter(m => m.is_mistake).length,
        blunders: analysis.filter(m => m.is_blunder).length
      };

      return {
        moves: analysis,
        summary: {
          totalMoves: moves.length,
          accuracy: Math.round(accuracy * 10) / 10, // One decimal place
          averageCentipawnLoss: Math.round(averageCentipawnLoss * 10) / 10,
          moveQuality: moveQualityCounts,
          blunders: blunders.length,
          mistakes: moveQualityCounts.mistakes,
          inaccuracies: moveQualityCounts.inaccuracies,
          bestMoves: moveQualityCounts.best,
          excellentMoves: moveQualityCounts.excellent,
          goodMoves: moveQualityCounts.good,
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
    // Stockfish evaluates from the perspective of the side to move
    // Before: evaluation is from the moving player's perspective
    // After: evaluation is from the opponent's perspective (since they move next)

    // Convert both to the moving player's perspective
    const beforeFromMoverView = beforeEval; // Already from mover's perspective
    const afterFromMoverView = -afterEval; // Negate because it's opponent's turn

    // Centipawn loss is how much the position worsened for the mover
    // A good move should have afterFromMoverView >= beforeFromMoverView (improvement or same)
    // A bad move has afterFromMoverView < beforeFromMoverView (loss)
    const loss = Math.max(0, beforeFromMoverView - afterFromMoverView);
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

        // Categorize blunders with enhanced details
        let categorization = null;
        if (isBlunder) {
          try {
            const tempChess = new Chess(beforeFen);
            const playedMoveUci = moveResult.from + moveResult.to + (moveResult.promotion || '');
            categorization = this.blunderCategorizer.categorizeBlunder({
              fen: beforeFen,
              moveNumber: Math.ceil((i + 1) / 2),
              playerMove: playedMoveUci,
              bestMove: beforeEval.bestMove,
              evaluationBefore: beforeEval.evaluation,
              evaluationAfter: -afterEval.evaluation,
              centipawnLoss: cappedCentipawnLoss
            }, tempChess);
          } catch (error) {
            console.warn(`Failed to categorize blunder at move ${i + 1}:`, error.message);
          }

          blunders.push({
            moveNumber: i + 1,
            move: moveResult.san,
            centipawnLoss: cappedCentipawnLoss,
            bestMove: beforeEval.bestMove,
            alternatives: alternatives,
            categorization: categorization
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
          alternatives: alternatives,
          categorization: categorization
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

  async generateAlternatives(fen, depth = 12, maxAlternatives = 15) {
    return new Promise((resolve) => {
      if (!this.engine || !this.isReady) {
        resolve([]);
        return;
      }

      const alternatives = [];
      let resolved = false;
      let lastDepthSeen = 0;

      const dataHandler = (data) => {
        const output = data.toString();
        const lines = output.split('\n');

        for (const line of lines) {
          // Look for multipv lines with score cp or score mate
          const cpMatch = line.match(/info.*depth (\d+).*multipv (\d+).*score cp (-?\d+).*pv (.+)/);
          const mateMatch = line.match(/info.*depth (\d+).*multipv (\d+).*score mate (-?\d+).*pv (.+)/);

          if (cpMatch && alternatives.length < maxAlternatives) {
            const [, depthStr, multipv, score, pv] = cpMatch;
            const currentDepth = parseInt(depthStr);
            const moves = pv.trim().split(' ');
            const mainMove = moves[0];

            // Only add if this is the deepest analysis we've seen for this move
            if (mainMove && currentDepth >= lastDepthSeen) {
              lastDepthSeen = currentDepth;
              const existingIndex = alternatives.findIndex(alt => alt.move === mainMove);

              if (existingIndex === -1) {
                alternatives.push({
                  move: mainMove,
                  evaluation: parseInt(score),
                  depth: currentDepth,
                  line: moves.slice(0, 5), // Store first 5 moves of the line
                  rank: parseInt(multipv)
                });
              } else if (currentDepth > alternatives[existingIndex].depth) {
                // Update with deeper analysis
                alternatives[existingIndex] = {
                  move: mainMove,
                  evaluation: parseInt(score),
                  depth: currentDepth,
                  line: moves.slice(0, 5),
                  rank: parseInt(multipv)
                };
              }
            }
          } else if (mateMatch && alternatives.length < maxAlternatives) {
            const [, depthStr, multipv, mateIn, pv] = mateMatch;
            const currentDepth = parseInt(depthStr);
            const moves = pv.trim().split(' ');
            const mainMove = moves[0];
            const mateScore = parseInt(mateIn) > 0 ? 10000 - (parseInt(mateIn) * 10) : -10000 + (Math.abs(parseInt(mateIn)) * 10);

            if (mainMove && currentDepth >= lastDepthSeen) {
              lastDepthSeen = currentDepth;
              const existingIndex = alternatives.findIndex(alt => alt.move === mainMove);

              if (existingIndex === -1) {
                alternatives.push({
                  move: mainMove,
                  evaluation: mateScore,
                  depth: currentDepth,
                  line: moves.slice(0, 5),
                  rank: parseInt(multipv),
                  mateIn: parseInt(mateIn)
                });
              } else if (currentDepth > alternatives[existingIndex].depth) {
                alternatives[existingIndex] = {
                  move: mainMove,
                  evaluation: mateScore,
                  depth: currentDepth,
                  line: moves.slice(0, 5),
                  rank: parseInt(multipv),
                  mateIn: parseInt(mateIn)
                };
              }
            }
          }
        }

        if (output.includes('bestmove') && !resolved) {
          resolved = true;
          this.engine.stdout.removeListener('data', dataHandler);
          // Sort by rank and return up to maxAlternatives
          alternatives.sort((a, b) => (a.rank || 999) - (b.rank || 999));
          resolve(alternatives.slice(0, maxAlternatives));
        }
      };

      this.engine.stdout.on('data', dataHandler);

      // Set MultiPV to get up to 15 alternative lines
      this.engine.stdin.write(`setoption name MultiPV value ${maxAlternatives}\n`);
      this.engine.stdin.write(`position fen ${fen}\n`);
      this.engine.stdin.write(`go depth ${depth}\n`);

      // Timeout after 15 seconds for complex positions with many alternatives
      setTimeout(() => {
        if (!resolved) {
          this.engine.stdout.removeListener('data', dataHandler);
          resolved = true;
          alternatives.sort((a, b) => (a.rank || 999) - (b.rank || 999));
          resolve(alternatives.slice(0, maxAlternatives));
        }
      }, 15000);
    });
  }
}

module.exports = ChessAnalyzer;
