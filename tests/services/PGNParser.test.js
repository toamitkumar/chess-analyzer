const PGNParser = require('../../src/services/PGNParser');

describe('PGNParser', () => {
  let parser;
  let samplePGN;

  beforeEach(() => {
    parser = new PGNParser();
    samplePGN = `[Event "Rated Blitz game"]
[Site "lichess.org"]
[Date "2024.01.15"]
[Round "?"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]
[WhiteElo "1500"]
[BlackElo "1480"]
[ECO "B20"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 1-0

[Event "Casual game"]
[Site "chess.com"]
[Date "2024.01.16"]
[White "Player3"]
[Black "Player4"]
[Result "0-1"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 0-1`;
  });

  describe('parseFile', () => {
    test('should parse multiple games from PGN content', () => {
      const result = parser.parseFile(samplePGN);
      
      expect(result.totalGames).toBe(2);
      expect(result.games).toHaveLength(2);
      expect(result.games[0].white).toBe('Player1');
      expect(result.games[1].white).toBe('Player3');
    });

    test('should handle empty PGN content', () => {
      const result = parser.parseFile('');
      expect(result.totalGames).toBe(0);
      expect(result.games).toHaveLength(0);
    });

    test('should handle single game', () => {
      const singleGame = samplePGN.split('\n\n')[0] + '\n\n' + samplePGN.split('\n\n')[1];
      const result = parser.parseFile(singleGame);
      expect(result.totalGames).toBe(1);
    });
  });

  describe('parseGame', () => {
    test('should extract game headers correctly', () => {
      const gameString = samplePGN.split('\n\n').slice(0, 2).join('\n\n');
      const game = parser.parseGame(gameString);
      
      expect(game.white).toBe('Player1');
      expect(game.black).toBe('Player2');
      expect(game.result).toBe('1-0');
      expect(game.date).toBe('2024.01.15');
      expect(game.whiteElo).toBe(1500);
      expect(game.blackElo).toBe(1480);
      expect(game.eco).toBe('B20');
    });

    test('should extract moves correctly', () => {
      const gameString = samplePGN.split('\n\n').slice(0, 2).join('\n\n');
      const game = parser.parseGame(gameString);
      
      expect(game.moves).toContain('e4');
      expect(game.moves).toContain('c5');
      expect(game.moves).toContain('Nf3');
      expect(game.moveCount).toBeGreaterThan(0);
    });

    test('should handle missing optional headers', () => {
      const minimalPGN = `[White "Player1"]
[Black "Player2"]

1. e4 e5 1-0`;
      
      const game = parser.parseGame(minimalPGN);
      expect(game.white).toBe('Player1');
      expect(game.black).toBe('Player2');
      expect(game.whiteElo).toBeNull();
      expect(game.event).toBe('Unknown');
    });

    test('should throw error for missing required headers', () => {
      const invalidPGN = `[Event "Test"]
1. e4 e5`;
      
      expect(() => parser.parseGame(invalidPGN)).toThrow('Missing required headers');
    });
  });

  describe('extractHeaders', () => {
    test('should extract all headers from lines', () => {
      const lines = [
        '[Event "Test Event"]',
        '[White "Player1"]',
        '[Black "Player2"]',
        '[Result "1-0"]'
      ];
      
      const headers = parser.extractHeaders(lines);
      expect(headers.Event).toBe('Test Event');
      expect(headers.White).toBe('Player1');
      expect(headers.Black).toBe('Player2');
      expect(headers.Result).toBe('1-0');
    });

    test('should ignore non-header lines', () => {
      const lines = [
        '[White "Player1"]',
        '1. e4 e5',
        '[Black "Player2"]'
      ];
      
      const headers = parser.extractHeaders(lines);
      expect(headers.White).toBe('Player1');
      expect(headers.Black).toBe('Player2');
      expect(Object.keys(headers)).toHaveLength(2);
    });
  });

  describe('extractMoves', () => {
    test('should extract moves and remove annotations', () => {
      const lines = [
        '[White "Player1"]',
        '[Black "Player2"]',
        '',
        '1. e4 c5 2. Nf3 d6 3. d4! cxd4?? 4. Nxd4+ Nf6 1-0'
      ];
      
      const moves = parser.extractMoves(lines);
      expect(moves).toContain('e4');
      expect(moves).toContain('c5');
      expect(moves).toContain('Nf3');
      expect(moves).not.toContain('1-0');
      expect(moves).not.toContain('1.');
    });

    test('should handle empty move section', () => {
      const lines = ['[White "Player1"]', '[Black "Player2"]'];
      const moves = parser.extractMoves(lines);
      expect(moves).toHaveLength(0);
    });
  });

  describe('validatePGN', () => {
    test('should validate correct PGN format', () => {
      const validation = parser.validatePGN(samplePGN);
      expect(validation.valid).toBe(true);
    });

    test('should reject invalid PGN content', () => {
      const validation = parser.validatePGN('invalid content');
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('Missing required headers');
    });

    test('should reject null or undefined content', () => {
      expect(parser.validatePGN(null).valid).toBe(false);
      expect(parser.validatePGN(undefined).valid).toBe(false);
    });
  });

  describe('getGameCount', () => {
    test('should return correct game count after parsing', () => {
      parser.parseFile(samplePGN);
      expect(parser.getGameCount()).toBe(2);
    });

    test('should return 0 for empty parser', () => {
      expect(parser.getGameCount()).toBe(0);
    });
  });
});
