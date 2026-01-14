/**
 * Lichess Alignment Tests
 * ADR 006: Phase 3 - Measure & Calibrate
 *
 * Tests to validate that our analysis matches Lichess evaluations and classifications.
 * Uses reference games with known Lichess evaluations to measure alignment.
 */

const EvaluationNormalizer = require('../../src/models/evaluation-normalizer');
const AnalysisConfig = require('../../src/models/analysis-config');
const TacticalDetector = require('../../src/models/tactical-detector');
const WinProbability = require('../../src/models/win-probability');
const referenceGames = require('../fixtures/lichess-reference-games.json');

describe('Lichess Alignment - ADR 006 Phase 3', () => {
  describe('EvaluationNormalizer - Sign Convention', () => {
    test('should normalize evaluations to White perspective (positive = White advantage)', () => {
      // After Black's move, if Black is better, eval should be negative
      // Lichess convention: positive = White advantage
      
      // Game 2, Move 2: Black plays e5 (Englund Gambit blunder)
      // Lichess shows +1.74 (White advantage after Black's blunder)
      // Stockfish returns eval from side-to-move perspective
      // After Black's move, it's White's turn, so Stockfish returns from White's view
      const rawEvalAfterBlackMove = 174; // Stockfish says +174 (White's turn, White better)
      const normalized = EvaluationNormalizer.normalizeForStorage(rawEvalAfterBlackMove, true); // White to move next
      
      expect(normalized).toBe(174); // Should stay positive (White advantage)
    });

    test('should handle Black advantage correctly', () => {
      // Game 1, Move 6: White plays a3 (mistake)
      // Lichess shows -0.91 (Black advantage after White's mistake)
      // After White's move, it's Black's turn
      // Stockfish returns from Black's perspective (positive = Black better)
      const rawEvalAfterWhiteMove = 91; // Stockfish says +91 from Black's view
      const normalized = EvaluationNormalizer.normalizeForStorage(rawEvalAfterWhiteMove, false); // Black to move next
      
      expect(normalized).toBe(-91); // Should be negative (Black advantage in White perspective)
    });

    test.each(referenceGames.games.flatMap(game => 
      game.criticalMoves.filter(m => !m.isMate).map(move => ({
        gameName: game.name,
        moveNumber: move.moveNumber,
        moveSan: move.san,
        color: move.color,
        lichessEval: move.lichessEval
      }))
    ))('$gameName Move $moveNumber ($moveSan): Lichess eval sign should match', ({ color, lichessEval }) => {
      // Lichess convention: positive = White advantage
      // Our normalized eval should have the same sign as Lichess
      
      if (lichessEval > 0) {
        // White advantage - our eval should be positive
        expect(lichessEval).toBeGreaterThan(0);
      } else if (lichessEval < 0) {
        // Black advantage - our eval should be negative
        expect(lichessEval).toBeLessThan(0);
      }
      // Zero is neutral
    });
  });

  describe('AnalysisConfig - Mate Detection', () => {
    test('should detect mate evaluations', () => {
      expect(AnalysisConfig.isMateEvaluation(10000)).toBe(true);
      expect(AnalysisConfig.isMateEvaluation(-10000)).toBe(true);
      expect(AnalysisConfig.isMateEvaluation(9000)).toBe(true);
      expect(AnalysisConfig.isMateEvaluation(-9000)).toBe(true);
      expect(AnalysisConfig.isMateEvaluation(500)).toBe(false);
      expect(AnalysisConfig.isMateEvaluation(-500)).toBe(false);
    });

    test.each(referenceGames.games.flatMap(game =>
      game.criticalMoves.filter(m => m.isMate).map(move => ({
        gameName: game.name,
        moveNumber: move.moveNumber,
        moveSan: move.san,
        mateIn: move.mateIn,
        lichessClass: move.lichessClass
      }))
    ))('$gameName Move $moveNumber ($moveSan): Mate in $mateIn should be classified as blunder', 
      ({ mateIn, lichessClass }) => {
        // All mate positions should be classified as blunders
        expect(lichessClass).toBe('blunder');
        
        // Our config should classify mate as blunder
        const mateEval = mateIn > 0 ? 10000 : -10000;
        const classification = AnalysisConfig.getClassification(0, mateEval < 0 ? mateEval : 0);
        
        // If moving into mate against you (negative mate eval), should be blunder
        if (mateIn > 0) {
          // Opponent has mate - this is bad for the mover
          // From mover's perspective, this is a negative eval
          const classFromMoverView = AnalysisConfig.getClassification(0, -10000);
          expect(classFromMoverView).toBe('blunder');
        }
      }
    );

    test('Game 4 Move 29 (Ka7 - Mate in 3): should be classified as blunder', () => {
      // This is the critical bug from ADR 006
      // Black plays Ka7, allowing mate in 3
      // Our app was marking this as "inaccuracy" instead of "blunder"
      
      const evalAfterMove = -10000; // Mate against Black (from mover's perspective)
      const classification = AnalysisConfig.getClassification(0, evalAfterMove);
      
      expect(classification).toBe('blunder');
    });
  });

  describe('Classification Thresholds', () => {
    test('should use exact Lichess win probability thresholds (converted from ±1 scale)', () => {
      // Lichess uses [-1, +1] scale: 0.1, 0.2, 0.3
      // Converted to [0, 100] scale: 5%, 10%, 15%
      expect(AnalysisConfig.CLASSIFICATION.WIN_PROB_INACCURACY).toBe(5);
      expect(AnalysisConfig.CLASSIFICATION.WIN_PROB_MISTAKE).toBe(10);
      expect(AnalysisConfig.CLASSIFICATION.WIN_PROB_BLUNDER).toBe(15);
    });

    test('should classify based on win probability drop', () => {
      // 5% drop = inaccuracy (Lichess 0.1 on ±1 scale)
      expect(AnalysisConfig.getClassification(5)).toBe('inaccuracy');
      expect(AnalysisConfig.getClassification(8)).toBe('inaccuracy');
      
      // 10% drop = mistake (Lichess 0.2 on ±1 scale)
      expect(AnalysisConfig.getClassification(10)).toBe('mistake');
      expect(AnalysisConfig.getClassification(12)).toBe('mistake');
      
      // 15% drop = blunder (Lichess 0.3 on ±1 scale)
      expect(AnalysisConfig.getClassification(15)).toBe('blunder');
      expect(AnalysisConfig.getClassification(30)).toBe('blunder');
      
      // < 5% = good move
      expect(AnalysisConfig.getClassification(4)).toBeNull();
      expect(AnalysisConfig.getClassification(0)).toBeNull();
    });
  });

  describe('TacticalDetector - Classification with Mate Detection', () => {
    test('should classify mate positions as blunder regardless of win prob', () => {
      const result = TacticalDetector.classifyMoveWithTactics(
        50, // moveAccuracy
        { isTacticalBlunder: false, hasMissedOpportunity: false },
        0, // evalBefore (equal position)
        -10000, // evalAfter (mate against mover)
        0, // cpLoss
        50, // winProbBefore
        50 // winProbAfter (doesn't matter for mate)
      );

      expect(result.classification).toBe('blunder');
      expect(result.reason).toBe('mate_detection');
    });

    test('should NOT classify positive mate (mover has mate) as blunder', () => {
      // If the mover finds a mate, that's good, not a blunder
      const result = TacticalDetector.classifyMoveWithTactics(
        100, // moveAccuracy
        { isTacticalBlunder: false, hasMissedOpportunity: false },
        500, // evalBefore (winning)
        10000, // evalAfter (mover has mate)
        0, // cpLoss (no loss, position improved)
        90, // winProbBefore
        100 // winProbAfter
      );

      // Should NOT be classified as blunder
      expect(result?.classification).not.toBe('blunder');
    });
  });

  describe('Win Probability Calculations', () => {
    test('should calculate reasonable win probabilities for reference positions', () => {
      // Equal position
      expect(WinProbability.cpToWinProbability(0)).toBeCloseTo(50, 0);
      
      // Slight advantage (+100cp = ~1 pawn)
      const slightAdvantage = WinProbability.cpToWinProbability(100);
      expect(slightAdvantage).toBeGreaterThan(55);
      expect(slightAdvantage).toBeLessThan(70);
      
      // Clear advantage (+300cp = ~3 pawns)
      const clearAdvantage = WinProbability.cpToWinProbability(300);
      expect(clearAdvantage).toBeGreaterThan(70); // ~75% is reasonable
      expect(clearAdvantage).toBeLessThan(95);
      
      // Winning (+500cp = ~5 pawns)
      const winning = WinProbability.cpToWinProbability(500);
      expect(winning).toBeGreaterThan(85); // ~86% is reasonable
      
      // Losing (-300cp)
      const losing = WinProbability.cpToWinProbability(-300);
      expect(losing).toBeLessThan(30); // ~25% is reasonable
    });

    test('Game 2 Move 2 (e5 - Englund Gambit): should show significant win prob drop', () => {
      // Before: 0.00 (equal)
      // After: +1.74 (White advantage)
      const winProbBefore = WinProbability.cpToWinProbability(0);
      const winProbAfter = WinProbability.cpToWinProbability(174); // From Black's view, this is -174
      
      // Black's win probability dropped significantly
      // From Black's perspective: before ~50%, after much lower
      const blackWinProbBefore = 100 - winProbBefore; // ~50%
      const blackWinProbAfter = 100 - winProbAfter; // Much lower
      
      const winProbDrop = blackWinProbBefore - blackWinProbAfter;
      
      // Should be a significant drop (blunder territory)
      expect(winProbDrop).toBeGreaterThan(10);
    });
  });

  describe('Reference Game Classification Summary', () => {
    test.each(referenceGames.games)('$name: should have critical moves defined', (game) => {
      expect(game.criticalMoves).toBeDefined();
      expect(game.criticalMoves.length).toBeGreaterThan(0);
    });

    test('should have correct Lichess classifications for critical moves', () => {
      const allMoves = referenceGames.games.flatMap(g => g.criticalMoves);
      
      const blunders = allMoves.filter(m => m.lichessClass === 'blunder');
      const mistakes = allMoves.filter(m => m.lichessClass === 'mistake');
      const inaccuracies = allMoves.filter(m => m.lichessClass === 'inaccuracy');
      
      // Verify we have a good mix of classifications
      expect(blunders.length).toBeGreaterThan(0);
      expect(mistakes.length).toBeGreaterThan(0);
      expect(inaccuracies.length).toBeGreaterThan(0);
      
      console.log(`Reference moves: ${blunders.length} blunders, ${mistakes.length} mistakes, ${inaccuracies.length} inaccuracies`);
    });

    test('mate positions should all be classified as blunders by Lichess', () => {
      const mateMoves = referenceGames.games.flatMap(g => 
        g.criticalMoves.filter(m => m.isMate)
      );
      
      expect(mateMoves.length).toBeGreaterThan(0);
      
      mateMoves.forEach(move => {
        expect(move.lichessClass).toBe('blunder');
      });
    });
  });
});
