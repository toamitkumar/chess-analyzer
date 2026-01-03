const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');
const { spawn } = require('child_process');
const BlunderCategorizer = require('./blunder-categorizer');
const TacticalDetector = require('./tactical-detector');
const WinProbability = require('./win-probability');
const { FEATURE_FLAGS } = require('../config/app-config');

class ChessAnalyzer {
  constructor() {
    this.engine = null;
    this.isReady = false;
    this.blunderCategorizer = new BlunderCategorizer();
    this.analysisQueue = [];
    this.isAnalyzing = false;
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
      (alternatives && alternatives.length > 0 && alternatives[0].moveUci === playedMoveUci)
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

  /**
   * Queue-based wrapper for game analysis
   * Ensures only one game is analyzed at a time (prevents concurrent access issues)
   */
  async analyzeGame(moves, fetchAlternatives = true) {
    return new Promise((resolve, reject) => {
      // Add to queue
      this.analysisQueue.push({ moves, fetchAlternatives, resolve, reject });
      console.log(`📥 [QUEUE] Added analysis to queue. Queue length: ${this.analysisQueue.length}`);

      // Process queue if not already processing
      if (!this.isAnalyzing) {
        this._processQueue();
      }
    });
  }

  /**
   * Process analysis queue one at a time
   */
  async _processQueue() {
    if (this.analysisQueue.length === 0) {
      this.isAnalyzing = false;
      console.log('✅ [QUEUE] Queue empty, analysis complete');
      return;
    }

    this.isAnalyzing = true;
    const { moves, fetchAlternatives, resolve, reject } = this.analysisQueue.shift();
    console.log(`⚙️ [QUEUE] Processing analysis. Remaining in queue: ${this.analysisQueue.length}`);

    try {
      const result = await this._analyzeGameInternal(moves, fetchAlternatives);
      resolve(result);
    } catch (error) {
      reject(error);
    }

    // Process next item in queue
    setImmediate(() => this._processQueue());
  }

  /**
   * Internal analysis method (should not be called directly)
   */
  async _analyzeGameInternal(moves, fetchAlternatives = true) {
    try {
      if (!moves || !Array.isArray(moves) || moves.length === 0) {
        throw new Error('No moves provided for analysis');
      }

      if (!this.isReady) {
        throw new Error('Stockfish engine not ready');
      }

      // CRITICAL: Restart Stockfish engine for truly clean state
      // This ensures 100% deterministic results by eliminating ALL internal caches
      console.log('🔄 [DETERMINISM] Restarting Stockfish engine for clean state...');

      // Close existing engine
      if (this.engine) {
        this.engine.removeAllListeners();
        this.engine.kill();
      }

      // Restart engine with deterministic settings
      this.setupEngine();

      // Wait for engine to be ready
      await new Promise((resolve) => {
        const checkReady = () => {
          if (this.isReady) {
            console.log('✅ [DETERMINISM] Fresh Stockfish engine ready');
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();

        // Timeout after 5 seconds
        setTimeout(() => {
          console.log('⚠️ [DETERMINISM] Timeout waiting for engine, proceeding anyway');
          resolve();
        }, 5000);
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
            // Fallback to just the best move - convert UCI to SAN
            if (beforeEval.bestMove !== move) {
              try {
                const tempChess = new Chess();
                tempChess.load(beforeFen);
                const moveResult = tempChess.move(beforeEval.bestMove);
                const bestMoveSan = moveResult ? moveResult.san : beforeEval.bestMove;
                alternatives = [{ 
                  move: bestMoveSan, 
                  moveUci: beforeEval.bestMove,
                  evaluation: beforeEval.evaluation 
                }];
              } catch (error) {
                alternatives = [{ 
                  move: beforeEval.bestMove, 
                  moveUci: beforeEval.bestMove,
                  evaluation: beforeEval.evaluation 
                }];
              }
            }
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
            const playedMoveAlt = alternatives.find(alt => alt.moveUci === playedMoveUci);

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

          // Calculate win probability before and after from mover's perspective
          // beforeEval is from mover's perspective, afterEval is from opponent's perspective
          const wpBefore = this.centipawnToWinProbability(beforeEval.evaluation);
          const wpAfter = this.centipawnToWinProbability(-afterEval.evaluation); // Negate for mover's view

          // Calculate per-move accuracy and win probabilities based on feature flag
          let moveAccuracy;
          let winProbBefore, winProbAfter; // Declare here so they're available later

          if (FEATURE_FLAGS.USE_WIN_PROBABILITY_ACCURACY) {
            // New algorithm: Win-probability based accuracy (ADR 005)
            winProbBefore = WinProbability.cpToWinProbability(beforeEval.evaluation);
            winProbAfter = WinProbability.cpToWinProbability(-afterEval.evaluation);
            moveAccuracy = WinProbability.calculateMoveAccuracy(winProbBefore, winProbAfter);
          } else {
            // Legacy algorithm: Lichess-style centipawn loss
            winProbBefore = wpBefore;
            winProbAfter = wpAfter;
            moveAccuracy = this.calculateMoveAccuracy(beforeEval.evaluation, afterEval.evaluation, isWhiteMove);
          }

          // Tactical blunder detection (ADR 005 Phase 2)
          let tacticalAnalysis = null;
          let moveClassification = null;
          if (FEATURE_FLAGS.USE_WIN_PROBABILITY_ACCURACY && alternatives.length > 0) {
            // Analyze for tactical blunders and missed opportunities
            const moveData = {
              evaluation: -afterEval.evaluation, // From mover's perspective
              centipawnLoss: centipawnLoss
            };
            tacticalAnalysis = TacticalDetector.analyzeTacticalBlunder(moveData, alternatives);

            // Classify move using tactical detection + win probability
            moveClassification = TacticalDetector.classifyMoveWithTactics(
              moveAccuracy,
              tacticalAnalysis,
              beforeEval.evaluation,
              -afterEval.evaluation,
              centipawnLoss
            );
          }

          // Classify move quality
          let moveQuality, isBlunder, isMistake, isInaccuracy, isBest, isExcellent, isGood;

          if (FEATURE_FLAGS.USE_WIN_PROBABILITY_ACCURACY && moveClassification) {
            // Use tactical + win-probability classification
            switch (moveClassification.classification) {
              case 'blunder':
                moveQuality = 'blunder';
                isBlunder = true;
                isMistake = false;
                isInaccuracy = false;
                isBest = false;
                isExcellent = false;
                isGood = false;
                break;
              case 'mistake':
                moveQuality = 'mistake';
                isBlunder = false;
                isMistake = true;
                isInaccuracy = false;
                isBest = false;
                isExcellent = false;
                isGood = false;
                break;
              case 'inaccuracy':
                moveQuality = 'inaccuracy';
                isBlunder = false;
                isMistake = false;
                isInaccuracy = true;
                isBest = false;
                isExcellent = false;
                isGood = false;
                break;
              case 'missed_opportunity':
                moveQuality = 'good'; // Still a good move, just missed something better
                isBlunder = false;
                isMistake = false;
                isInaccuracy = false;
                isBest = false;
                isExcellent = false;
                isGood = true;
                break;
              default:
                // Good move (no classification)
                if (moveAccuracy >= 95) {
                  moveQuality = 'best';
                  isBest = true;
                } else if (moveAccuracy >= 90) {
                  moveQuality = 'excellent';
                  isExcellent = true;
                } else {
                  moveQuality = 'good';
                  isGood = true;
                }
                isBlunder = false;
                isMistake = false;
                isInaccuracy = false;
                if (!isBest) isBest = false;
                if (!isExcellent) isExcellent = false;
                if (!isGood) isGood = false;
                break;
            }
          } else {
            // Legacy classification: Lichess/Chess.com style
            moveQuality = this.classifyMove(centipawnLoss, move, beforeEval.bestMove, alternatives, playedMoveUci);
            isBlunder = moveQuality === 'blunder';
            isMistake = moveQuality === 'mistake';
            isInaccuracy = moveQuality === 'inaccuracy';
            isBest = moveQuality === 'best';
            isExcellent = moveQuality === 'excellent';
            isGood = moveQuality === 'good';
          }

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
            evaluation: -afterEval.evaluation, // From mover's perspective (negated from opponent's view)
            best_move: beforeEval.bestMove,
            centipawn_loss: centipawnLoss,
            move_accuracy: Math.round(moveAccuracy * 10) / 10, // Per-move accuracy
            move_quality: moveQuality, // best/excellent/good/inaccuracy/mistake/blunder
            win_probability_before: Math.round(winProbBefore * 10) / 10, // As percentage (0-100)
            win_probability_after: Math.round(winProbAfter * 10) / 10, // As percentage (0-100)
            is_best: isBest,
            is_excellent: isExcellent,
            is_good: isGood,
            is_blunder: isBlunder,
            is_mistake: isMistake,
            is_inaccuracy: isInaccuracy,
            fen_before: beforeFen,
            fen_after: afterFen,
            alternatives: alternatives, // Up to 10 alternative moves with lines
            categorization: categorization, // Enhanced blunder/mistake/inaccuracy categorization
            // ADR 005 Phase 2: Tactical analysis data
            tactical_analysis: tacticalAnalysis,
            move_classification: moveClassification
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
          totalMoves: Math.ceil(moves.length / 2), // Board moves, not ply count
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
        totalMoves: Math.ceil(analysis.length / 2), // Board moves, not ply count
        accuracy: Math.round(accuracy),
        blunders: blunders.length,
        averageCentipawnLoss: Math.round(averageCentipawnLoss),
        blunderDetails: blunders
      }
    };

    console.log(`✅ Enhanced analysis complete: ${Math.ceil(analysis.length / 2)} board moves, ${Math.round(accuracy)}% accuracy`);
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

      // Create a chess instance for UCI to SAN conversion
      const tempChess = new Chess();

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
            const mainMoveUci = moves[0];

            // Convert UCI move to SAN notation
            let mainMoveSan = mainMoveUci;
            try {
              tempChess.load(fen);
              const moveResult = tempChess.move(mainMoveUci);
              if (moveResult) {
                mainMoveSan = moveResult.san;
              }
            } catch (error) {
              console.warn(`Failed to convert UCI move ${mainMoveUci} to SAN:`, error.message);
            }

            // Convert the entire line to SAN notation
            const lineSan = [];
            try {
              tempChess.load(fen);
              for (const uciMove of moves.slice(0, 5)) {
                const moveResult = tempChess.move(uciMove);
                if (moveResult) {
                  lineSan.push(moveResult.san);
                } else {
                  break; // Stop if we can't make the move
                }
              }
            } catch (error) {
              console.warn(`Failed to convert line to SAN:`, error.message);
            }

            // Only add if this is the deepest analysis we've seen for this move
            if (mainMoveUci && currentDepth >= lastDepthSeen) {
              lastDepthSeen = currentDepth;
              const existingIndex = alternatives.findIndex(alt => alt.moveUci === mainMoveUci);

              if (existingIndex === -1) {
                alternatives.push({
                  move: mainMoveSan, // Store SAN notation for display
                  moveUci: mainMoveUci, // Keep UCI for internal use
                  evaluation: parseInt(score),
                  depth: currentDepth,
                  line: lineSan.length > 0 ? lineSan : moves.slice(0, 5), // Use SAN line if available, fallback to UCI
                  rank: parseInt(multipv)
                });
              } else if (currentDepth > alternatives[existingIndex].depth) {
                // Update with deeper analysis
                alternatives[existingIndex] = {
                  move: mainMoveSan,
                  moveUci: mainMoveUci,
                  evaluation: parseInt(score),
                  depth: currentDepth,
                  line: lineSan.length > 0 ? lineSan : moves.slice(0, 5),
                  rank: parseInt(multipv)
                };
              }
            }
          } else if (mateMatch && alternatives.length < maxAlternatives) {
            const [, depthStr, multipv, mateIn, pv] = mateMatch;
            const currentDepth = parseInt(depthStr);
            const moves = pv.trim().split(' ');
            const mainMoveUci = moves[0];
            const mateScore = parseInt(mateIn) > 0 ? 10000 - (parseInt(mateIn) * 10) : -10000 + (Math.abs(parseInt(mateIn)) * 10);

            // Convert UCI move to SAN notation
            let mainMoveSan = mainMoveUci;
            try {
              tempChess.load(fen);
              const moveResult = tempChess.move(mainMoveUci);
              if (moveResult) {
                mainMoveSan = moveResult.san;
              }
            } catch (error) {
              console.warn(`Failed to convert UCI move ${mainMoveUci} to SAN:`, error.message);
            }

            // Convert the entire line to SAN notation
            const lineSan = [];
            try {
              tempChess.load(fen);
              for (const uciMove of moves.slice(0, 5)) {
                const moveResult = tempChess.move(uciMove);
                if (moveResult) {
                  lineSan.push(moveResult.san);
                } else {
                  break;
                }
              }
            } catch (error) {
              console.warn(`Failed to convert mate line to SAN:`, error.message);
            }

            if (mainMoveUci && currentDepth >= lastDepthSeen) {
              lastDepthSeen = currentDepth;
              const existingIndex = alternatives.findIndex(alt => alt.moveUci === mainMoveUci);

              if (existingIndex === -1) {
                alternatives.push({
                  move: mainMoveSan,
                  moveUci: mainMoveUci,
                  evaluation: mateScore,
                  depth: currentDepth,
                  line: lineSan.length > 0 ? lineSan : moves.slice(0, 5),
                  rank: parseInt(multipv),
                  mateIn: parseInt(mateIn)
                });
              } else if (currentDepth > alternatives[existingIndex].depth) {
                alternatives[existingIndex] = {
                  move: mainMoveSan,
                  moveUci: mainMoveUci,
                  evaluation: mateScore,
                  depth: currentDepth,
                  line: lineSan.length > 0 ? lineSan : moves.slice(0, 5),
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
