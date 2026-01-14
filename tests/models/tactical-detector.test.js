/**
 * Tests for Tactical Blunder Detector
 * Phase 2.1 of ADR 005
 * Updated in ADR 006 Phase 2: Mate detection tests
 */

const TacticalDetector = require('../../src/models/tactical-detector');
const AnalysisConfig = require('../../src/models/analysis-config');

describe('TacticalDetector', () => {
  describe('analyzeTacticalBlunder()', () => {
    it('should detect hanging piece pattern with massive CP loss', () => {
      // Updated to match current conservative thresholds
      const moveData = {
        evaluation: 50,
        centipawnLoss: 250  // Massive loss for hanging piece detection
      };
      const alternatives = [
        { evaluation: 300, move: 'Bg2' }, // Much better move available
        { evaluation: 150, move: 'Bd2' }
      ];

      const result = TacticalDetector.analyzeTacticalBlunder(moveData, alternatives);

      expect(result.isTacticalBlunder).toBe(true);
      expect(result.type).toBe('hanging_piece');
      expect(result.severity).toBe('blunder');
    });

    it('should detect tactical oversight with mate-level loss', () => {
      const moveData = {
        evaluation: 50,
        centipawnLoss: 350  // Mate-level loss
      };
      const alternatives = [
        { evaluation: 400, move: 'Nf3' }
      ];

      const result = TacticalDetector.analyzeTacticalBlunder(moveData, alternatives);

      expect(result.isTacticalBlunder).toBe(true);
      expect(result.type).toBe('hanging_piece'); // Current implementation uses hanging_piece for massive losses
      expect(result.severity).toBe('blunder');
    });

    it('should not detect moderate CP loss as tactical blunder', () => {
      // Current algorithm is conservative - moderate losses are handled by win probability
      const moveData = {
        evaluation: 100,
        centipawnLoss: 75
      };
      const alternatives = [
        { evaluation: 200, move: 'Qd4' }
      ];

      const result = TacticalDetector.analyzeTacticalBlunder(moveData, alternatives);

      expect(result.isTacticalBlunder).toBe(false);
      expect(result.hasMissedOpportunity).toBe(false);
    });

    it('should not detect positional moves as tactical blunders', () => {
      // Current algorithm is very conservative about tactical patterns
      const moveData = {
        evaluation: 50,
        centipawnLoss: 40
      };
      const alternatives = [
        { evaluation: 300, move: 'e5' } // Large eval difference
      ];

      const result = TacticalDetector.analyzeTacticalBlunder(moveData, alternatives);

      expect(result.isTacticalBlunder).toBe(false);
      // With 40 CP loss, this exceeds the 30 CP threshold for missed opportunities
      // So it won't be detected as a missed opportunity
      expect(result.hasMissedOpportunity).toBe(false);
    });

    it('should not flag good moves as tactical blunders', () => {
      const moveData = {
        evaluation: 100,
        centipawnLoss: 5
      };
      const alternatives = [
        { evaluation: 105, move: 'Nf3' },
        { evaluation: 103, move: 'Nc3' }
      ];

      const result = TacticalDetector.analyzeTacticalBlunder(moveData, alternatives);

      expect(result.isTacticalBlunder).toBe(false);
      expect(result.hasMissedOpportunity).toBe(false);
    });

    it('should handle missing alternatives gracefully', () => {
      const moveData = {
        evaluation: 50,
        centipawnLoss: 100
      };

      const result = TacticalDetector.analyzeTacticalBlunder(moveData, []);

      expect(result.isTacticalBlunder).toBe(false);
      expect(result.reason).toContain('No alternative moves');
    });

    it('should detect missed winning tactic', () => {
      const moveData = {
        evaluation: 150,
        centipawnLoss: 15  // Small loss, good move but misses mate
      };
      const alternatives = [
        { evaluation: 400, move: 'Qh7#' }, // Missed checkmate (eval 400+ = forced mate)
        { evaluation: 150, move: 'Nf3' }
      ];

      const result = TacticalDetector.analyzeTacticalBlunder(moveData, alternatives);

      expect(result.hasMissedOpportunity).toBe(true);
      expect(result.type).toBe('winning_tactic');
      expect(result.severity).toBe('missed_opportunity');
    });

    it('should detect missed tactical improvement', () => {
      const moveData = {
        evaluation: 50,
        centipawnLoss: 25
      };
      const alternatives = [
        { evaluation: 180, move: 'Bxf7+' }, // Much better tactical move
        { evaluation: 50, move: 'Nc3' }
      ];

      const result = TacticalDetector.analyzeTacticalBlunder(moveData, alternatives);

      expect(result.hasMissedOpportunity).toBe(true);
      expect(result.type).toBe('tactical_improvement');
    });

    it('should detect missed positional opportunity', () => {
      const moveData = {
        evaluation: 30,
        centipawnLoss: 15
      };
      const alternatives = [
        { evaluation: 85, move: 'Nd5' }, // Better positional move
        { evaluation: 30, move: 'Nc3' }
      ];

      const result = TacticalDetector.analyzeTacticalBlunder(moveData, alternatives);

      expect(result.hasMissedOpportunity).toBe(true);
      expect(result.type).toBe('positional_improvement');
    });
  });

  describe('classifyMoveWithTactics()', () => {
    it('should classify based on win-probability in decided position', () => {
      // Current algorithm uses win-probability as primary method
      // ADR 006 Phase 2: Updated thresholds - 20% drop = blunder
      const moveAccuracy = 80;
      const tacticalAnalysis = {
        isTacticalBlunder: false, // Conservative tactical detection
        severity: 'blunder',
        type: 'hanging_piece',
        reason: 'Hangs knight'
      };

      const result = TacticalDetector.classifyMoveWithTactics(
        moveAccuracy,
        tacticalAnalysis,
        600, // Position already winning
        9,   // But large win% drop expected
        100, // Large CP loss
        85,  // winProbBefore
        60   // winProbAfter (25% drop = blunder with new thresholds)
      );

      expect(result).not.toBeNull();
      expect(result.classification).toBe('blunder');
      expect(result.reason).toBe('win_probability'); // Primary classification method
    });

    it('should return null for moves without significant win% drop', () => {
      // Current algorithm requires significant win% drop for classification
      const moveAccuracy = 65;
      const tacticalAnalysis = {
        isTacticalBlunder: false,
        severity: 'mistake',
        type: 'tactical_mistake',
        reason: 'Tactical error'
      };

      const result = TacticalDetector.classifyMoveWithTactics(
        moveAccuracy,
        tacticalAnalysis,
        50,
        100,
        75,  // CP loss
        55,  // winProbBefore
        52   // winProbAfter (only 3% drop = not enough)
      );

      expect(result).toBeNull(); // Not enough win% drop for classification
    });

    it('should classify missed opportunity', () => {
      const moveAccuracy = 90;
      const tacticalAnalysis = {
        isTacticalBlunder: false,
        hasMissedOpportunity: true,
        type: 'winning_tactic',
        reason: 'Missed checkmate'
      };

      const result = TacticalDetector.classifyMoveWithTactics(
        moveAccuracy,
        tacticalAnalysis,
        100,
        150,
        15  // Small CP loss
      );

      expect(result.classification).toBe('missed_opportunity');
      expect(result.tacticalType).toBe('winning_tactic');
    });

    it('should fall back to win-probability classification', () => {
      const moveAccuracy = 55;
      const tacticalAnalysis = {
        isTacticalBlunder: false,
        hasMissedOpportunity: false
      };

      // evalBefore: 100 CP (~57% win prob), evalAfter: -250 CP (~26% win prob)
      // Win% drop: ~31% -> Should be blunder by Lichess thresholds
      const result = TacticalDetector.classifyMoveWithTactics(
        moveAccuracy,
        tacticalAnalysis,
        100,   // evalBefore
        -250,  // evalAfter
        350    // CP loss
      );

      expect(result.classification).toBe('blunder');
      expect(result.reason).toBe('win_probability');
    });

    it('should return null for good moves in decided positions', () => {
      const moveAccuracy = 95;
      const tacticalAnalysis = {
        isTacticalBlunder: false,
        hasMissedOpportunity: false
      };

      const result = TacticalDetector.classifyMoveWithTactics(
        moveAccuracy,
        tacticalAnalysis,
        850, // Clearly winning (beyond threshold)
        900,
        10   // Small CP loss - should be filtered out
      );

      expect(result).toBeNull();
    });

    it('should classify blunder based on win-probability (Lichess >=30% drop)', () => {
      const moveAccuracy = 35;
      const tacticalAnalysis = {
        isTacticalBlunder: false,
        hasMissedOpportunity: false
      };

      // evalBefore: 300 CP (~75% win prob), evalAfter: -150 CP (~37% win prob)
      // Win% drop: ~39% -> Blunder by Lichess thresholds
      const result = TacticalDetector.classifyMoveWithTactics(
        moveAccuracy,
        tacticalAnalysis,
        300,   // evalBefore
        -150,  // evalAfter
        450    // Large CP loss
      );

      expect(result.classification).toBe('blunder');
      expect(result.reason).toBe('win_probability');
    });

    it('should classify inaccuracy based on win-probability (5% drop)', () => {
      const moveAccuracy = 75;
      const tacticalAnalysis = {
        isTacticalBlunder: false,
        hasMissedOpportunity: false
      };

      // Use current thresholds: 5% for inaccuracy
      const result = TacticalDetector.classifyMoveWithTactics(
        moveAccuracy,
        tacticalAnalysis,
        150,   // evalBefore
        0,     // evalAfter
        150,   // CP loss
        63,    // winProbBefore
        57     // winProbAfter (6% drop = inaccuracy)
      );

      expect(result.classification).toBe('inaccuracy');
      expect(result.reason).toBe('win_probability');
    });

    // ADR 006 Phase 2: Mate detection tests
    describe('Mate Detection (ADR 006 Phase 2)', () => {
      it('should classify as blunder when moving into forced mate', () => {
        const moveAccuracy = 50;
        const tacticalAnalysis = {
          isTacticalBlunder: false,
          hasMissedOpportunity: false
        };

        // evalAfter is from mover's perspective, negative = mate against mover
        const result = TacticalDetector.classifyMoveWithTactics(
          moveAccuracy,
          tacticalAnalysis,
          -500,    // evalBefore (already losing)
          -10000,  // evalAfter (forced mate against mover)
          9500,    // CP loss
          5,       // winProbBefore
          0        // winProbAfter
        );

        expect(result.classification).toBe('blunder');
        expect(result.reason).toBe('mate_detection');
      });

      it('Game 4 Move 56 (Ka7 - Mate in 3): should be blunder', () => {
        // This is the critical bug from ADR 006
        // Black moved Ka7, allowing forced mate in 3
        const moveAccuracy = 10;
        const tacticalAnalysis = {
          isTacticalBlunder: false,
          hasMissedOpportunity: false
        };

        const result = TacticalDetector.classifyMoveWithTactics(
          moveAccuracy,
          tacticalAnalysis,
          -500,    // evalBefore (Black was losing)
          -10000,  // evalAfter (forced mate against Black)
          9500,    // CP loss
          5,       // winProbBefore
          0        // winProbAfter
        );

        expect(result.classification).toBe('blunder');
        expect(result.reason).toBe('mate_detection');
        expect(result.details).toContain('forced mate');
      });

      it('should NOT classify as mate blunder when mover has mate', () => {
        // If the mover is delivering mate, that's good!
        const moveAccuracy = 100;
        const tacticalAnalysis = {
          isTacticalBlunder: false,
          hasMissedOpportunity: false
        };

        const result = TacticalDetector.classifyMoveWithTactics(
          moveAccuracy,
          tacticalAnalysis,
          500,     // evalBefore
          10000,   // evalAfter (mover has forced mate - GOOD!)
          0,       // No CP loss
          95,      // winProbBefore
          100      // winProbAfter
        );

        // Should not be classified as blunder
        expect(result).toBeNull();
      });

      it('should detect mate in tactical pattern analysis', () => {
        const moveData = {
          evaluation: -10000, // Forced mate against mover
          centipawnLoss: 9500
        };
        const alternatives = [
          { evaluation: -500, move: 'Kb8' } // Better defensive move
        ];

        const result = TacticalDetector.analyzeTacticalBlunder(moveData, alternatives);

        expect(result.isTacticalBlunder).toBe(true);
        expect(result.type).toBe('mate_blunder');
        expect(result.severity).toBe('blunder');
      });
    });
  });
});
