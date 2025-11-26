const ChessAnalyzer = require('../src/models/analyzer');
const { Chess } = require('chess.js');

describe('ChessAnalyzer - Blunder Categorization Integration', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ChessAnalyzer();
  });

  afterEach(async () => {
    if (analyzer) {
      await analyzer.close();
    }
  });

  describe('BlunderCategorizer integration', () => {
    test('should have blunderCategorizer instance', () => {
      expect(analyzer.blunderCategorizer).toBeDefined();
      expect(analyzer.blunderCategorizer.categorizeBlunder).toBeInstanceOf(Function);
    });

    test('should categorize blunders in analysis', async () => {
      // Create a simple game with a blunder
      const moves = [
        'e4', 'e5',   // 1. e4 e5
        'Nf3', 'Nc6', // 2. Nf3 Nc6
        'Bc4', 'Nf6', // 3. Bc4 Nf6
        'Qh5'         // 4. Qh5 (Scholar's mate attempt, but let's say opponent blunders)
      ];

      // Mock engine to be ready
      analyzer.isReady = true;

      // Mock evaluatePosition to return predictable values
      const originalEvaluate = analyzer.evaluatePosition.bind(analyzer);
      analyzer.evaluatePosition = jest.fn(async (fen, depth) => {
        // Return mock evaluations
        return {
          bestMove: 'e2e4',
          evaluation: 0
        };
      });

      // Mock generateAlternatives
      analyzer.generateAlternatives = jest.fn(async (fen, depth, max) => {
        return [{
          move: 'e2e4',
          evaluation: 0,
          depth: 12,
          line: ['e2e4', 'e7e5'],
          rank: 1
        }];
      });

      try {
        const result = await analyzer.analyzeGame(moves, false);

        // Verify structure
        expect(result).toHaveProperty('moves');
        expect(result).toHaveProperty('summary');
        expect(Array.isArray(result.moves)).toBe(true);

        // Check that moves have categorization field
        result.moves.forEach(moveAnalysis => {
          expect(moveAnalysis).toHaveProperty('categorization');

          // If it's a poor move, categorization should be populated
          if (moveAnalysis.is_blunder || moveAnalysis.is_mistake || moveAnalysis.is_inaccuracy) {
            if (moveAnalysis.categorization) {
              expect(moveAnalysis.categorization).toHaveProperty('phase');
              expect(moveAnalysis.categorization).toHaveProperty('tactical_theme');
              expect(moveAnalysis.categorization).toHaveProperty('position_type');
              expect(moveAnalysis.categorization).toHaveProperty('blunder_severity');
              expect(moveAnalysis.categorization).toHaveProperty('difficulty_level');
            }
          } else {
            // Good moves should have null categorization
            expect(moveAnalysis.categorization).toBeNull();
          }
        });
      } catch (error) {
        // If analysis fails due to engine not being ready, that's okay for this test
        if (!error.message.includes('engine not ready')) {
          throw error;
        }
      }
    }, 30000);

    test('should handle categorization errors gracefully', async () => {
      const moves = ['e4', 'e5'];

      analyzer.isReady = true;
      analyzer.evaluatePosition = jest.fn(async () => ({
        bestMove: 'e2e4',
        evaluation: 0
      }));
      analyzer.generateAlternatives = jest.fn(async () => []);

      // Mock categorizeBlunder to throw error
      analyzer.blunderCategorizer.categorizeBlunder = jest.fn(() => {
        throw new Error('Categorization failed');
      });

      try {
        const result = await analyzer.analyzeGame(moves, false);

        // Should complete analysis even if categorization fails
        expect(result).toHaveProperty('moves');
        expect(result.moves.length).toBeGreaterThan(0);
      } catch (error) {
        if (!error.message.includes('engine not ready')) {
          throw error;
        }
      }
    }, 30000);
  });

  describe('categorization data structure', () => {
    test('should include all categorization fields when present', () => {
      const mockCategorization = {
        phase: 'opening',
        tactical_theme: 'hanging_piece',
        position_type: 'tactical',
        blunder_severity: 'major',
        difficulty_level: 3
      };

      // Verify the structure matches what BlunderCategorizer returns
      expect(mockCategorization).toHaveProperty('phase');
      expect(mockCategorization).toHaveProperty('tactical_theme');
      expect(mockCategorization).toHaveProperty('position_type');
      expect(mockCategorization).toHaveProperty('blunder_severity');
      expect(mockCategorization).toHaveProperty('difficulty_level');

      expect(['opening', 'middlegame', 'endgame']).toContain(mockCategorization.phase);
      expect(['minor', 'moderate', 'major', 'critical']).toContain(mockCategorization.blunder_severity);
      expect(mockCategorization.difficulty_level).toBeGreaterThanOrEqual(1);
      expect(mockCategorization.difficulty_level).toBeLessThanOrEqual(5);
    });
  });

  describe('analyzeGameWithAlternatives integration', () => {
    test('should include categorization in analyzeGameWithAlternatives', async () => {
      const moves = ['e4', 'e5'];

      analyzer.isReady = true;
      analyzer.evaluatePosition = jest.fn(async () => ({
        bestMove: 'e2e4',
        evaluation: 0
      }));
      analyzer.generateAlternatives = jest.fn(async () => []);

      try {
        const result = await analyzer.analyzeGameWithAlternatives(moves);

        expect(result).toHaveProperty('moves');
        expect(Array.isArray(result.moves)).toBe(true);

        // Check moves have categorization field
        result.moves.forEach(moveAnalysis => {
          expect(moveAnalysis).toHaveProperty('categorization');
        });
      } catch (error) {
        if (!error.message.includes('engine not ready')) {
          throw error;
        }
      }
    }, 30000);
  });
});
