const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');
const { spawn } = require('child_process');
const BlunderCategorizer = require('./blunder-categorizer');
const TacticalDetector = require('./tactical-detector');
const WinProbability = require('./win-probability');
const EvaluationNormalizer = require('./evaluation-normalizer');
const AnalysisConfig = require('./analysis-config');

class ChessAnalyzer {
  constructor() {
    this.engine = null;
    this.isReady = false;
    this.blunderCategorizer = new BlunderCategorizer();
    this.analysisQueue = [];
    this.isAnalyzing = false;
    this.activeProcesses = new Set(); // Track all active Stockfish processes
    this.timeouts = new Set(); // Track all active timeouts
    this.setupEngine();
  }

  /**
   * Get evaluation options based on config
   * Uses nodes-based analysis if USE_NODES is true (Lichess-compatible)
   */
  getEvalOptions(quality = 'STANDARD') {
    if (AnalysisConfig.USE_NODES) {
      return { nodes: AnalysisConfig.NODES[quality] || AnalysisConfig.NODES.STANDARD };
    }
    return { depth: AnalysisConfig.DEPTH[quality] || AnalysisConfig.DEPTH.STANDARD };
  }

  // Convert win probability to centipawn equivalent
  winProbabilityToCentipawn(wp) {
    if (wp <= 0) return -10000;
    if (wp >= 1) return 10000;
    return Math.round(-250 * Math.log((1 - wp) / wp));
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
      
      // Track this process
      this.activeProcesses.add(this.engine);

      // Set up event handlers BEFORE sending any commands
      this.engine.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('uciok')) {
          // Engine acknowledged UCI protocol
          // Set Threads to 1 for deterministic analysis results
          console.log('🔧 [DETERMINISM] Setting Threads=1 for deterministic analysis');
          this.engine.stdin.write('setoption name Threads value 1\n');
          // Set Hash size from config for better evaluation quality
          console.log(`🔧 [CONFIG] Setting Hash=${AnalysisConfig.ENGINE.HASH_MB}MB`);
          this.engine.stdin.write(`setoption name Hash value ${AnalysisConfig.ENGINE.HASH_MB}\n`);
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
        // Remove from active processes when closed
        this.activeProcesses.delete(this.engine);
        if (code !== 0 && code !== null) {
          console.error(`❌ Stockfish process exited with code ${code}`);
        }
        this.isReady = false;
      });

      // Small delay to ensure event handlers are registered, then start UCI protocol
      const timeout = setTimeout(() => {
        if (this.engine && this.engine.stdin) {
          this.engine.stdin.write('uci\n');
        }
      }, 100);
      
      this.timeouts.add(timeout);

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
        this.activeProcesses.delete(this.engine);
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
        const timeout = setTimeout(() => {
          console.log('⚠️ [DETERMINISM] Timeout waiting for engine, proceeding anyway');
          resolve();
        }, 5000);
        
        this.timeouts.add(timeout);
      });

      console.log(`🔍 Analyzing game with ${moves.length} moves using real Stockfish...`);
      if (fetchAlternatives) {
        console.log(`🔄 Fetching up to 10 alternative moves for each position`);
      }

      const chess = new Chess();
      const analysis = [];
      let totalCentipawnLoss = 0;
      const blunders = [];

      // Get evaluation options based on config
      const evalOptions = this.getEvalOptions('STANDARD');

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
          const beforeEval = await this.evaluatePosition(beforeFen, evalOptions);

          // Fetch up to 10 alternative moves for each position
          let alternatives = [];
          if (fetchAlternatives) {
            console.log(`🔄 Fetching alternatives for move ${i + 1}...`);
            alternatives = await this.generateAlternatives(beforeFen, evalOptions, 10);
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
          const afterEval = await this.evaluatePosition(afterFen, evalOptions);

          // Calculate centipawn loss using direct evaluation comparison (most accurate)
          const isWhiteMove = i % 2 === 0;
          let centipawnLoss = 0;
          
          // Use direct evaluation comparison as primary method
          const rawCentipawnLoss = this.calculateCentipawnLoss(beforeEval.evaluation, afterEval.evaluation, isWhiteMove);
          centipawnLoss = rawCentipawnLoss;
          
          // Alternative method: compare with best alternative (for validation/debugging)
          if (alternatives.length > 0) {
            const bestMoveEval = alternatives[0].evaluation;
            const playedMoveAlt = alternatives.find(alt => alt.moveUci === playedMoveUci);
            
            let alternativesCpLoss = 0;
            if (playedMoveAlt) {
              // Player played one of the top moves - calculate loss from best
              alternativesCpLoss = Math.max(0, bestMoveEval - playedMoveAlt.evaluation);
            } else {
              // Player played a move not in top alternatives
              // Use the actual evaluation after the move (from mover's perspective)
              const actualEval = -afterEval.evaluation; // Convert to mover's perspective
              alternativesCpLoss = Math.max(0, bestMoveEval - actualEval);
            }
            
            // Use the larger of the two methods (more conservative)
            // This catches cases where alternatives might miss the full tactical consequence
            centipawnLoss = Math.max(centipawnLoss, alternativesCpLoss);
          }

          centipawnLoss = Math.min(centipawnLoss, 500); // Cap at 500cp (5 pawns)
          totalCentipawnLoss += centipawnLoss;

          // ADR 006 Phase 1: Normalize evaluations to White's perspective (Lichess convention)
          // Stockfish returns eval from side-to-move's perspective
          // Before move: mover's turn, so beforeEval is from mover's perspective
          // After move: opponent's turn, so afterEval is from opponent's perspective
          const evalBeforeWhite = EvaluationNormalizer.toWhitePerspective(beforeEval.evaluation, isWhiteMove);
          const evalAfterWhite = EvaluationNormalizer.toWhitePerspective(afterEval.evaluation, !isWhiteMove);

          // Calculate per-move accuracy and win probabilities using win-probability algorithm (ADR 005)
          // Win probability should be calculated from the mover's perspective for accuracy
          const evalBeforeMover = EvaluationNormalizer.toMoverPerspective(evalBeforeWhite, isWhiteMove);
          const evalAfterMover = EvaluationNormalizer.toMoverPerspective(evalAfterWhite, isWhiteMove);
          const winProbBefore = WinProbability.cpToWinProbability(evalBeforeMover);
          const winProbAfter = WinProbability.cpToWinProbability(evalAfterMover);
          const moveAccuracy = WinProbability.calculateMoveAccuracy(winProbBefore, winProbAfter);

          // Tactical blunder detection (ADR 005 Phase 2)
          let tacticalAnalysis = null;
          let moveClassification = null;
          if (alternatives.length > 0) {
            // Analyze for tactical blunders and missed opportunities
            // Use mover's perspective for tactical analysis
            const moveData = {
              evaluation: evalAfterMover, // From mover's perspective
              centipawnLoss: centipawnLoss
            };
            tacticalAnalysis = TacticalDetector.analyzeTacticalBlunder(moveData, alternatives);

            // Classify move using tactical detection + win probability
            // Use mover's perspective evaluations for classification
            moveClassification = TacticalDetector.classifyMoveWithTactics(
              moveAccuracy,
              tacticalAnalysis,
              evalBeforeMover,
              evalAfterMover,
              centipawnLoss,
              winProbBefore, // Pass pre-calculated win probability
              winProbAfter   // Pass pre-calculated win probability
            );
          }

          // Classify move quality using tactical detection + win probability
          let moveQuality, isBlunder, isMistake, isInaccuracy, isBest, isExcellent, isGood;

          if (moveClassification) {
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
            // Good move - classify by accuracy
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
                evaluationBefore: evalBeforeMover, // From mover's perspective
                evaluationAfter: evalAfterMover, // From mover's perspective
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
              winProbabilityLoss: Math.round(winProbBefore - winProbAfter),
              categorization: categorization // Add categorization details
            });
          }

          // Convert best_move from UCI to SAN format (ADR 006 Phase 5)
          let bestMoveSan = beforeEval.bestMove;
          try {
            const tempChess = new Chess(beforeFen);
            const moveResult = tempChess.move(beforeEval.bestMove);
            if (moveResult) {
              bestMoveSan = moveResult.san;
            }
          } catch (e) {
            // Keep UCI format if conversion fails
          }

          const moveAnalysis = {
            move_number: i + 1,
            move: move,
            evaluation: evalAfterWhite, // ADR 006: White's perspective (Lichess convention)
            best_move: bestMoveSan, // ADR 006 Phase 5: SAN format
            centipawn_loss: centipawnLoss,
            move_accuracy: Math.round(moveAccuracy * 10) / 10, // Per-move accuracy
            move_quality: moveQuality, // best/excellent/good/inaccuracy/mistake/blunder
            win_probability_before: Math.round(winProbBefore * 10) / 10, // Already percentage (0-100), just round to 1 decimal
            win_probability_after: Math.round(winProbAfter * 10) / 10, // Already percentage (0-100), just round to 1 decimal
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

  async evaluatePosition(fen, depthOrOptions = 12) {
    // Support both legacy depth parameter and new options object
    const options = typeof depthOrOptions === 'object' 
      ? depthOrOptions 
      : { depth: depthOrOptions };
    
    return this._evaluateWithFreshEngine(fen, options);
  }

  async _evaluateWithFreshEngine(fen, options = {}) {
    const { depth = 12, nodes = null } = options;
    
    return new Promise((resolve, reject) => {
      // Spawn fresh Stockfish instance
      const { spawn } = require('child_process');
      const engine = spawn('stockfish');
      
      // Track this process
      this.activeProcesses.add(engine);
      
      let bestMove = '';
      let evaluation = 0;
      let resolved = false;
      let engineReady = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          engine.kill();
          this.activeProcesses.delete(engine);
          resolved = true;
          resolve({ bestMove: bestMove || 'e4', evaluation });
        }
      }, 10000);
      
      this.timeouts.add(timeout);
      
      const dataHandler = (data) => {
        const output = data.toString();
        const lines = output.split('\n');
        
        for (const line of lines) {
          if (line.includes('uciok')) {
            // Engine acknowledged UCI protocol
            engine.stdin.write('setoption name Threads value 1\n');
            engine.stdin.write(`setoption name Hash value ${AnalysisConfig.ENGINE.HASH_MB}\n`);
            engine.stdin.write('isready\n');
          }
          
          if (line.includes('readyok') && !engineReady) {
            engineReady = true;
            // Engine is ready, start analysis
            engine.stdin.write(`position fen ${fen}\n`);
            // Use nodes-based analysis if specified (Lichess-compatible), otherwise depth
            if (nodes) {
              engine.stdin.write(`go nodes ${nodes}\n`);
            } else {
              engine.stdin.write(`go depth ${depth}\n`);
            }
          }
          
          if (line.startsWith('bestmove') && !resolved) {
            bestMove = line.split(' ')[1] || 'e4';
            clearTimeout(timeout);
            this.timeouts.delete(timeout);
            engine.kill();
            this.activeProcesses.delete(engine);
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

      engine.stdout.on('data', dataHandler);
      
      engine.stderr.on('data', (data) => {
        console.error('Fresh Stockfish error:', data.toString());
      });

      engine.on('error', (err) => {
        if (!resolved) {
          clearTimeout(timeout);
          this.timeouts.delete(timeout);
          this.activeProcesses.delete(engine);
          resolved = true;
          reject(err);
        }
      });

      engine.on('close', (code) => {
        this.activeProcesses.delete(engine);
        if (!resolved) {
          clearTimeout(timeout);
          this.timeouts.delete(timeout);
          resolved = true;
          resolve({ bestMove: bestMove || 'e4', evaluation });
        }
      });

      // Start UCI protocol
      engine.stdin.write('uci\n');
    });
  }

  calculateCentipawnLoss(beforeEval, afterEval, isWhiteMove) {
    // ADR 006 Phase 1: Use EvaluationNormalizer for consistent perspective handling
    //
    // Stockfish evaluates from the perspective of the side to move:
    // - beforeEval: from the moving player's perspective (before they move)
    // - afterEval: from the opponent's perspective (after the move, opponent to move)
    //
    // We need to normalize both to White's perspective first, then calculate loss
    // from the mover's perspective.

    // Convert to White's perspective
    // Before: it's the mover's turn, so if White moves, eval is from White's perspective
    const beforeWhitePerspective = EvaluationNormalizer.toWhitePerspective(beforeEval, isWhiteMove);
    // After: it's the opponent's turn, so if White moved, it's now Black's turn
    const afterWhitePerspective = EvaluationNormalizer.toWhitePerspective(afterEval, !isWhiteMove);

    // Calculate centipawn loss from mover's perspective
    return EvaluationNormalizer.calculateCentipawnLoss(beforeWhitePerspective, afterWhitePerspective, isWhiteMove);
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
    // Clear all timeouts first
    for (const timeout of this.timeouts) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();

    // Close main engine
    if (this.engine) {
      this.engine.stdin.write('quit\n');
      this.engine.kill();
      this.activeProcesses.delete(this.engine);
      this.engine = null;
      this.isReady = false;
    }

    // Close all active fresh processes
    for (const process of this.activeProcesses) {
      try {
        if (process && process.kill) {
          process.kill();
        }
      } catch (error) {
        // Ignore errors when killing processes
      }
    }
    this.activeProcesses.clear();

    // Wait a bit for processes to close
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('✅ Stockfish engine closed');
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
        const evalOptions = this.getEvalOptions('STANDARD');
        const beforeEval = await this.evaluatePosition(beforeFen, evalOptions);
        
        // Generate alternatives for significant positions
        let alternatives = [];
        if (i % 3 === 0 || i < 10) { // Every 3rd move or first 10 moves
          alternatives = await this.generateAlternatives(beforeFen, evalOptions);
        }
        
        const moveResult = chess.move(move);
        if (!moveResult) {
          console.warn(`⚠️ Invalid move: ${move} at position ${i + 1}`);
          continue;
        }
        
        const afterFen = chess.fen();
        const afterEval = await this.evaluatePosition(afterFen, evalOptions);
        
        const isWhiteMove = i % 2 === 0;
        const centipawnLoss = this.calculateCentipawnLoss(beforeEval.evaluation, afterEval.evaluation, isWhiteMove);
        const cappedCentipawnLoss = Math.min(centipawnLoss, 500);
        const isBlunder = cappedCentipawnLoss > 200;

        // ADR 006: Normalize evaluations to White's perspective
        const evalBeforeWhite = EvaluationNormalizer.toWhitePerspective(beforeEval.evaluation, isWhiteMove);
        const evalAfterWhite = EvaluationNormalizer.toWhitePerspective(afterEval.evaluation, !isWhiteMove);
        const evalBeforeMover = EvaluationNormalizer.toMoverPerspective(evalBeforeWhite, isWhiteMove);
        const evalAfterMover = EvaluationNormalizer.toMoverPerspective(evalAfterWhite, isWhiteMove);

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
              evaluationBefore: evalBeforeMover,
              evaluationAfter: evalAfterMover,
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
          evaluation: evalAfterWhite, // ADR 006: White's perspective
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

  async generateAlternatives(fen, depthOrOptions = 12, maxAlternatives = 15) {
    // Support both legacy depth parameter and new options object
    const options = typeof depthOrOptions === 'object' 
      ? depthOrOptions 
      : { depth: depthOrOptions };
    
    return this._generateAlternativesWithFreshEngine(fen, options, maxAlternatives);
  }

  async _generateAlternativesWithFreshEngine(fen, options, maxAlternatives) {
    const { depth = 12, nodes = null } = options;
    
    return new Promise((resolve, reject) => {
      // Spawn fresh Stockfish instance
      const { spawn } = require('child_process');
      const engine = spawn('stockfish');
      
      // Track this process
      this.activeProcesses.add(engine);
      
      const alternatives = [];
      let resolved = false;
      let lastDepthSeen = 0;
      let engineReady = false;

      // Create a chess instance for UCI to SAN conversion
      const { Chess } = require('chess.js');
      const tempChess = new Chess();

      const timeout = setTimeout(() => {
        if (!resolved) {
          engine.kill();
          this.activeProcesses.delete(engine);
          resolved = true;
          alternatives.sort((a, b) => (a.rank || 999) - (b.rank || 999));
          resolve(alternatives.slice(0, maxAlternatives));
        }
      }, 15000);

      this.timeouts.add(timeout);

      const dataHandler = (data) => {
        const output = data.toString();
        const lines = output.split('\n');

        for (const line of lines) {
          if (line.includes('uciok')) {
            // Engine acknowledged UCI protocol
            engine.stdin.write('setoption name Threads value 1\n');
            engine.stdin.write(`setoption name Hash value ${AnalysisConfig.ENGINE.HASH_MB}\n`);
            engine.stdin.write(`setoption name MultiPV value ${maxAlternatives}\n`);
            engine.stdin.write('isready\n');
          }
          
          if (line.includes('readyok') && !engineReady) {
            engineReady = true;
            // Engine is ready, start analysis
            engine.stdin.write(`position fen ${fen}\n`);
            // Use nodes-based analysis if specified (Lichess-compatible), otherwise depth
            if (nodes) {
              engine.stdin.write(`go nodes ${nodes}\n`);
            } else {
              engine.stdin.write(`go depth ${depth}\n`);
            }
          }

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

          if (line.startsWith('bestmove') && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.timeouts.delete(timeout);
            engine.kill();
            this.activeProcesses.delete(engine);
            // Sort by rank and return up to maxAlternatives
            alternatives.sort((a, b) => (a.rank || 999) - (b.rank || 999));
            resolve(alternatives.slice(0, maxAlternatives));
          }
        }
      };

      engine.stdout.on('data', dataHandler);
      
      engine.stderr.on('data', (data) => {
        console.error('Fresh Stockfish error:', data.toString());
      });

      engine.on('error', (err) => {
        if (!resolved) {
          clearTimeout(timeout);
          this.timeouts.delete(timeout);
          this.activeProcesses.delete(engine);
          resolved = true;
          reject(err);
        }
      });

      engine.on('close', (code) => {
        this.activeProcesses.delete(engine);
        if (!resolved) {
          clearTimeout(timeout);
          this.timeouts.delete(timeout);
          resolved = true;
          alternatives.sort((a, b) => (a.rank || 999) - (b.rank || 999));
          resolve(alternatives.slice(0, maxAlternatives));
        }
      });

      // Start UCI protocol
      engine.stdin.write('uci\n');
    });
  }
}

module.exports = ChessAnalyzer;
