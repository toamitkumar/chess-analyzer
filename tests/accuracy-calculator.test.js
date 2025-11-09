const AccuracyCalculator = require('../src/models/accuracy-calculator');

describe('AccuracyCalculator', () => {
  describe('calculatePlayerAccuracy', () => {
    const mockMoves = [
      { move_number: 1, centipawn_loss: 0 },    // White move
      { move_number: 2, centipawn_loss: 10 },   // Black move
      { move_number: 3, centipawn_loss: 20 },   // White move
      { move_number: 4, centipawn_loss: 30 },   // Black move
      { move_number: 5, centipawn_loss: 40 },   // White move
      { move_number: 6, centipawn_loss: 50 }    // Black move
    ];

    test('calculates accuracy for white player correctly', () => {
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        mockMoves, 'TestPlayer', 'TestPlayer', 'Opponent'
      );
      
      // White moves: 1, 3, 5 with CPL: 0, 20, 40
      // Average CPL: (0 + 20 + 40) / 3 = 20
      // Accuracy: 100 - (20 / 3) = 93.33 -> 93
      expect(accuracy).toBe(93);
    });

    test('calculates accuracy for black player correctly', () => {
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        mockMoves, 'TestPlayer', 'Opponent', 'TestPlayer'
      );
      
      // Black moves: 2, 4, 6 with CPL: 10, 30, 50
      // Average CPL: (10 + 30 + 50) / 3 = 30
      // Accuracy: 100 - (30 / 3) = 90
      expect(accuracy).toBe(90);
    });

    test('returns 0 for very high centipawn loss', () => {
      const highCPLMoves = [
        { move_number: 1, centipawn_loss: 300 },
        { move_number: 3, centipawn_loss: 400 }
      ];
      
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        highCPLMoves, 'TestPlayer', 'TestPlayer', 'Opponent'
      );
      
      // Average CPL: 350, Accuracy: 100 - (350/3) = -16.67 -> 0
      expect(accuracy).toBe(0);
    });

    test('returns 100 for perfect play (0 CPL)', () => {
      const perfectMoves = [
        { move_number: 1, centipawn_loss: 0 },
        { move_number: 3, centipawn_loss: 0 }
      ];
      
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        perfectMoves, 'TestPlayer', 'TestPlayer', 'Opponent'
      );
      
      expect(accuracy).toBe(100);
    });

    test('returns 0 for empty moves array', () => {
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        [], 'TestPlayer', 'TestPlayer', 'Opponent'
      );
      
      expect(accuracy).toBe(0);
    });

    test('handles player not in game', () => {
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        mockMoves, 'NonExistentPlayer', 'Player1', 'Player2'
      );
      
      expect(accuracy).toBe(0);
    });
  });

  describe('calculateOverallAccuracy', () => {
    const mockGames = [
      {
        white_player: 'TestPlayer',
        black_player: 'Opponent1',
        analysis: [
          { move_number: 1, centipawn_loss: 10 },
          { move_number: 2, centipawn_loss: 20 },
          { move_number: 3, centipawn_loss: 30 }
        ]
      },
      {
        white_player: 'Opponent2',
        black_player: 'TestPlayer',
        analysis: [
          { move_number: 1, centipawn_loss: 15 },
          { move_number: 2, centipawn_loss: 25 },
          { move_number: 3, centipawn_loss: 35 }
        ]
      }
    ];

    test('calculates overall accuracy across multiple games', () => {
      const accuracy = AccuracyCalculator.calculateOverallAccuracy(mockGames, 'TestPlayer');
      
      // Game 1: White moves (1,3) CPL: 10,30 -> avg 20 -> accuracy 93
      // Game 2: Black moves (2) CPL: 25 -> accuracy 92
      // Overall: (93 + 92) / 2 = 92.5 -> 93
      expect(accuracy).toBe(93);
    });

    test('returns 0 for empty games array', () => {
      const accuracy = AccuracyCalculator.calculateOverallAccuracy([], 'TestPlayer');
      expect(accuracy).toBe(0);
    });

    test('handles games without analysis', () => {
      const gamesNoAnalysis = [
        { white_player: 'TestPlayer', black_player: 'Opponent', analysis: [] }
      ];
      
      const accuracy = AccuracyCalculator.calculateOverallAccuracy(gamesNoAnalysis, 'TestPlayer');
      expect(accuracy).toBe(0);
    });

    test('filters out games where player is not participating', () => {
      const mixedGames = [
        ...mockGames,
        {
          white_player: 'OtherPlayer1',
          black_player: 'OtherPlayer2',
          analysis: [{ move_number: 1, centipawn_loss: 0 }]
        }
      ];
      
      const accuracy = AccuracyCalculator.calculateOverallAccuracy(mixedGames, 'TestPlayer');
      
      // Should only consider first 2 games, ignore the third
      expect(accuracy).toBe(93);
    });
  });

  describe('edge cases and validation', () => {
    test('handles null/undefined moves', () => {
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        null, 'TestPlayer', 'TestPlayer', 'Opponent'
      );
      expect(accuracy).toBe(0);
    });

    test('handles moves with missing centipawn_loss', () => {
      const movesWithMissing = [
        { move_number: 1, centipawn_loss: 10 },
        { move_number: 3 }, // Missing centipawn_loss
        { move_number: 5, centipawn_loss: 20 }
      ];
      
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        movesWithMissing, 'TestPlayer', 'TestPlayer', 'Opponent'
      );
      
      // Should treat missing CPL as 0: (10 + 0 + 20) / 3 = 10
      // Accuracy: 100 - (10/3) = 96.67 -> 97
      expect(accuracy).toBe(97);
    });

    test('accuracy is capped at 100', () => {
      const negativeCPLMoves = [
        { move_number: 1, centipawn_loss: -10 } // Negative CPL (shouldn't happen but test anyway)
      ];
      
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        negativeCPLMoves, 'TestPlayer', 'TestPlayer', 'Opponent'
      );
      
      expect(accuracy).toBe(100);
    });

    test('accuracy is floored at 0', () => {
      const extremeCPLMoves = [
        { move_number: 1, centipawn_loss: 1000 }
      ];
      
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        extremeCPLMoves, 'TestPlayer', 'TestPlayer', 'Opponent'
      );
      
      expect(accuracy).toBe(0);
    });
  });

  describe('real-world scenarios', () => {
    test('amateur game with mixed performance', () => {
      const amateurMoves = [
        { move_number: 1, centipawn_loss: 5 },   // Good opening
        { move_number: 3, centipawn_loss: 15 },  // Decent
        { move_number: 5, centipawn_loss: 80 },  // Mistake
        { move_number: 7, centipawn_loss: 200 }, // Blunder
        { move_number: 9, centipawn_loss: 10 }   // Recovery
      ];
      
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        amateurMoves, 'Amateur', 'Amateur', 'Opponent'
      );
      
      // Average CPL: (5+15+80+200+10)/5 = 62
      // Accuracy: 100 - (62/3) = 79.33 -> 79
      expect(accuracy).toBe(79);
    });

    test('professional game with low CPL', () => {
      const proMoves = [
        { move_number: 1, centipawn_loss: 2 },
        { move_number: 3, centipawn_loss: 1 },
        { move_number: 5, centipawn_loss: 3 },
        { move_number: 7, centipawn_loss: 0 },
        { move_number: 9, centipawn_loss: 4 }
      ];
      
      const accuracy = AccuracyCalculator.calculatePlayerAccuracy(
        proMoves, 'Pro', 'Pro', 'Opponent'
      );
      
      // Average CPL: (2+1+3+0+4)/5 = 2
      // Accuracy: 100 - (2/3) = 99.33 -> 99
      expect(accuracy).toBe(99);
    });
  });
});
