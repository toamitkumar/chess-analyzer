const fs = require('fs');
const { Chess } = require('chess.js');

// Mock all external dependencies
jest.mock('stockfish', () => () => ({
  postMessage: jest.fn(),
  onmessage: null
}));
jest.mock('fs');
jest.mock('chess.js');

describe('ChessAnalyzer', () => {
  let ChessAnalyzer;

  beforeAll(() => {
    // Import after mocks are set up
    ChessAnalyzer = require('../src/models/analyzer').ChessAnalyzer;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Chess
    const mockChess = {
      loadPgn: jest.fn(),
      history: jest.fn(() => []),
      reset: jest.fn(),
      move: jest.fn(),
      fen: jest.fn(() => 'start-fen')
    };
    Chess.mockImplementation(() => mockChess);
    
    // Mock fs
    fs.readFileSync.mockReturnValue('1. e4 e5');
    fs.writeFileSync.mockImplementation();
  });

  test('constructor initializes correctly', () => {
    const analyzer = new ChessAnalyzer();
    expect(analyzer.isReady).toBe(false);
  });

  test('analyzePGN throws error for invalid PGN', async () => {
    const analyzer = new ChessAnalyzer();
    const mockChess = new Chess();
    mockChess.loadPgn.mockImplementation(() => {
      throw new Error('Invalid');
    });
    
    await expect(analyzer.analyzePGN('invalid')).rejects.toThrow('Invalid PGN');
  });

  test('analyzeFile reads and processes file', async () => {
    const analyzer = new ChessAnalyzer();
    analyzer.analyzePGN = jest.fn().mockResolvedValue([{ move: 'e4' }]);
    
    const result = await analyzer.analyzeFile('test.pgn');
    
    expect(fs.readFileSync).toHaveBeenCalledWith('test.pgn', 'utf8');
    expect(result).toEqual([{ move: 'e4' }]);
  });
});

describe('main function', () => {
  let main;
  let originalExit;

  beforeAll(() => {
    main = require('../src/models/analyzer').main;
  });

  beforeEach(() => {
    originalExit = process.exit;
    process.exit = jest.fn();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    fs.existsSync = jest.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
    jest.restoreAllMocks();
  });

  test('shows usage when no args', async () => {
    await main([]);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test('shows error for missing file', async () => {
    fs.existsSync.mockReturnValue(false);
    await main(['missing.pgn']);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
