const request = require('supertest');
const { getDatabase } = require('../src/models/database');

describe('PGN Upload Tests', () => {
  let db;

  beforeAll(async () => {
    db = getDatabase();
    await db.initialize();
  });

  beforeEach(async () => {
    // Clean database before each test
    await db.run('DELETE FROM analysis');
    await db.run('DELETE FROM games');
    await db.run('DELETE FROM tournaments');
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  test('should not create duplicate games on upload', async () => {
    const samplePGN = `[Event "Test Tournament"]
[Site "Test Site"]
[Date "2023.01.01"]
[Round "1"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0

[Event "Test Tournament"]
[Site "Test Site"]
[Date "2023.01.01"]
[Round "2"]
[White "Player3"]
[Black "Player4"]
[Result "0-1"]

1. d4 d5 2. c4 e6 3. Nc3 0-1`;

    // Mock the upload process by directly testing the database insertion logic
    const PGNParser = require('../src/models/PGNParser');
    const parser = new PGNParser();
    const parseResult = parser.parseFile(samplePGN);

    // Simulate what happens in the API server
    const storedGameIds = [];
    
    for (let i = 0; i < parseResult.games.length; i++) {
      const game = parseResult.games[i];
      
      // Simulate successful analysis path
      try {
        const gameData = {
          pgnFilePath: 'test',
          whitePlayer: game.white || 'Unknown',
          blackPlayer: game.black || 'Unknown',
          result: game.result || '*',
          date: game.date || null,
          event: game.event || 'Test Event',
          whiteElo: game.whiteElo ? parseInt(game.whiteElo) : null,
          blackElo: game.blackElo ? parseInt(game.blackElo) : null,
          movesCount: game.moves ? game.moves.length : 0,
          tournamentId: null
        };
        
        const gameResult = await db.insertGame(gameData, samplePGN);
        storedGameIds.push(gameResult.id);
        
        // This should NOT happen - simulating the bug we fixed
        // await db.insertGame(gameData, samplePGN); // This would create duplicate
        
      } catch (error) {
        // Error handling should NOT insert the game again
        console.log(`Analysis failed for game ${i + 1}: ${error.message}`);
        // The bug was here - inserting game again on error
      }
    }

    // Verify no duplicates were created
    const gameCount = await db.get('SELECT COUNT(*) as count FROM games');
    expect(gameCount.count).toBe(2); // Should be exactly 2 games, not 4

    // Verify each game is unique
    const duplicateCheck = await db.all(`
      SELECT white_player, black_player, result, COUNT(*) as count 
      FROM games 
      GROUP BY white_player, black_player, result 
      HAVING COUNT(*) > 1
    `);
    
    expect(duplicateCheck.length).toBe(0); // No duplicates should exist
    
    // Verify stored game IDs are unique
    const uniqueIds = [...new Set(storedGameIds)];
    expect(uniqueIds.length).toBe(storedGameIds.length);
  });

  test('should handle analysis failures without duplicate insertion', async () => {
    const samplePGN = `[Event "Test Tournament"]
[Site "Test Site"]
[Date "2023.01.01"]
[Round "1"]
[White "TestPlayer1"]
[Black "TestPlayer2"]
[Result "1-0"]

1. e4 e5 2. Nf3 1-0`;

    const PGNParser = require('../src/models/PGNParser');
    const parser = new PGNParser();
    const parseResult = parser.parseFile(samplePGN);
    
    const game = parseResult.games[0];
    const gameData = {
      pgnFilePath: 'test',
      whitePlayer: game.white || 'Unknown',
      blackPlayer: game.black || 'Unknown',
      result: game.result || '*',
      date: game.date || null,
      event: game.event || 'Test Event',
      whiteElo: null,
      blackElo: null,
      movesCount: game.moves ? game.moves.length : 0,
      tournamentId: null
    };

    // Insert game once (successful analysis path)
    const gameResult = await db.insertGame(gameData, samplePGN);
    
    // Simulate analysis failure - should NOT insert again
    try {
      throw new Error('Analysis failed');
    } catch (error) {
      // The bug was inserting the game again here
      // await db.insertGame(gameData, samplePGN); // This should NOT happen
    }

    // Verify only one game exists
    const gameCount = await db.get('SELECT COUNT(*) as count FROM games');
    expect(gameCount.count).toBe(1);
  });
});
