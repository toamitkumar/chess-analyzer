const openingDetector = require('../../src/models/opening-detector');

describe('Opening Detector', () => {
  describe('Common Openings Detection', () => {
    test('should detect Italian Game', () => {
      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('C50');
      expect(result.name).toBe('Italian Game');
    });

    test('should detect Italian Game Classical', () => {
      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('C53');
      expect(result.name).toBe('Italian Game, Classical');
    });

    test('should detect Ruy Lopez', () => {
      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('C60');
      expect(result.name).toBe('Ruy Lopez');
    });

    test('should detect Ruy Lopez Morphy Defense', () => {
      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('C70');
      expect(result.name).toBe('Ruy Lopez, Morphy Defense');
    });

    test('should detect Sicilian Defense', () => {
      const moves = ['e4', 'c5'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('B20');
      expect(result.name).toBe('Sicilian Defense');
    });

    test('should detect French Defense', () => {
      const moves = ['e4', 'e6'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('C00');
      expect(result.name).toBe('French Defense');
    });

    test('should detect Caro-Kann Defense', () => {
      const moves = ['e4', 'c6'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('B10');
      expect(result.name).toBe('Caro-Kann Defense');
    });

    test('should detect Queen\'s Gambit', () => {
      const moves = ['d4', 'd5', 'c4'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('D06');
      expect(result.name).toBe("Queen's Gambit");
    });

    test('should detect Queen\'s Gambit Declined', () => {
      const moves = ['d4', 'd5', 'c4', 'e6'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('D30');
      expect(result.name).toBe("Queen's Gambit Declined");
    });

    test('should detect Queen\'s Gambit Accepted', () => {
      const moves = ['d4', 'd5', 'c4', 'dxc4'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('D20');
      expect(result.name).toBe("Queen's Gambit Accepted");
    });

    test('should detect English Opening', () => {
      const moves = ['c4'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('A10');
      expect(result.name).toBe('English Opening');
    });

    test('should detect London System', () => {
      const moves = ['d4', 'd5', 'Bf4'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('D02');
      expect(result.name).toBe('London System');
    });

    test('should detect King\'s Indian Defense', () => {
      const moves = ['d4', 'Nf6', 'c4', 'g6'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('E60');
      expect(result.name).toBe("King's Indian Defense");
    });

    test('should detect Nimzo-Indian Defense', () => {
      const moves = ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('E20');
      expect(result.name).toBe('Nimzo-Indian Defense');
    });

    test('should detect Scandinavian Defense', () => {
      const moves = ['e4', 'd5'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('B01');
      expect(result.name).toBe('Scandinavian Defense');
    });

    test('should detect Bird\'s Opening', () => {
      const moves = ['f4'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('A02');
      expect(result.name).toBe("Bird's Opening");
    });

    test('should detect Bird\'s Opening with d5', () => {
      const moves = ['f4', 'd5'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('A03');
      expect(result.name).toBe("Bird's Opening");
    });

    test('should detect Bird\'s Opening From\'s Gambit', () => {
      const moves = ['f4', 'e5'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('A02');
      expect(result.name).toBe("Bird's Opening, From's Gambit");
    });
  });

  describe('PGN String Detection', () => {
    test('should detect opening from PGN string', () => {
      const pgn = `[Event "Test Game"]
[Site "Test"]
[Date "2025.11.17"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6`;

      const result = openingDetector.detect(pgn);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('C70');
      expect(result.name).toBe('Ruy Lopez, Morphy Defense');
    });

    test('should handle PGN with move numbers and variations', () => {
      const pgn = `1. d4 d5 2. c4 e6 3. Nc3 Nf6`;
      const result = openingDetector.detect(pgn);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('D30');
      expect(result.name).toBe("Queen's Gambit Declined");
    });
  });

  describe('Partial Match Detection', () => {
    test('should find best match for longer sequences', () => {
      // Italian Game with additional moves not in database
      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'Nf6', 'Nc3'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('C53'); // Should match Italian Classical
      expect(result.name).toBe('Italian Game, Classical');
    });

    test('should match generic opening when specific variation not found', () => {
      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'd6']; // Not a standard variation
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('C50'); // Should fall back to Italian Game
    });
  });

  describe('Move Sequence String Detection', () => {
    test('should detect from move sequence string', () => {
      const sequence = 'e4 e5 Nf3 Nc6 Bb5';
      const result = openingDetector.detectFromSequence(sequence);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('C60');
      expect(result.name).toBe('Ruy Lopez');
    });

    test('should handle partial sequences', () => {
      const sequence = 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O'; // Extra moves
      const result = openingDetector.detectFromSequence(sequence);

      expect(result).not.toBeNull();
      // Should match Ruy Lopez Morphy Defense or fall back to Ruy Lopez
      expect(['C60', 'C70']).toContain(result.eco);
    });
  });

  describe('Edge Cases', () => {
    test('should return null for empty move array', () => {
      const result = openingDetector.detect([]);
      expect(result).toBeNull();
    });

    test('should return null for completely invalid PGN', () => {
      const result = openingDetector.detect('invalid pgn content');
      expect(result).toBeNull();
    });

    test('should handle malformed PGN with extra whitespace', () => {
      const pgn = `[Event "Test"]
[Site "Test"]
[Date "2025.11.17"]

1. e4 e5 2. Nf3 Nc6 3. Bb5


`;
      const result = openingDetector.detect(pgn);
      expect(result).not.toBeNull();
      expect(result.eco).toBe('C60');
    });

    test('should handle PGN with missing move numbers', () => {
      const pgn = `[Event "Test"]

e4 e5 Nf3 Nc6 Bb5 a6`;
      const result = openingDetector.detect(pgn);
      expect(result).not.toBeNull();
      expect(result.eco).toBe('C70');
    });

    test('should handle uncommon first moves', () => {
      const moves = ['a3', 'e5']; // Uncommon opening
      const result = openingDetector.detect(moves);
      // Should return null as this uncommon opening is not in our database
      expect(result).toBeNull();
    });

    test('should detect generic opening for common starts', () => {
      const moves = ['e4'];
      const result = openingDetector.detect(moves);
      // Should return null as single e4 is not specific enough
      expect(result).toBeNull();
    });

    test('should detect basic King\'s Pawn Game', () => {
      const moves = ['e4', 'e5'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('C20');
      expect(result.name).toBe("King's Pawn Game");
    });

    test('should detect basic Queen\'s Pawn Game', () => {
      const moves = ['d4'];
      const result = openingDetector.detect(moves);

      expect(result).not.toBeNull();
      expect(result.eco).toBe('D00');
      expect(result.name).toBe("Queen's Pawn Game");
    });
  });

  describe('Real Game Scenarios', () => {
    test('should detect opening from actual tournament game', () => {
      // Sample from user's actual game: d4 d5 e3 Bf5...
      const moves = ['d4', 'd5', 'e3', 'Bf5'];
      const result = openingDetector.detect(moves);

      // Should at least detect Queen's Pawn Game
      expect(result).not.toBeNull();
      expect(result.eco).toBe('D00');
      expect(result.name).toBe("Queen's Pawn Game");
    });
  });
});
