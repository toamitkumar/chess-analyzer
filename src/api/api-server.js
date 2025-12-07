const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const PerformanceCalculator = require('../models/performance-stats');
const TrendCalculator = require('../models/trend-calculator');
const HeatmapCalculator = require('../models/HeatmapCalculator');
const PGNParser = require('../models/PGNParser');
const ChessAnalyzer = require('../models/analyzer');
const { getDatabase } = require('../models/database');
const { getFileStorage } = require('../models/file-storage');
const { getTournamentManager } = require('../models/tournament-manager');
const AccuracyCalculator = require('../models/accuracy-calculator');
const { getTournamentAnalyzer } = require('../models/tournament-analyzer');
const { TARGET_PLAYER, API_CONFIG } = require('../config/app-config');
const { checkAccessCode } = require('../middleware/access-code');

const app = express();
const port = API_CONFIG.port;

// Rate limiter for upload endpoint
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per 15 minutes per IP
  message: 'Too many uploads from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Initialize database, file storage, tournament manager, and analyzer
let database = null;
let fileStorage = null;
let tournamentManager = null;
let tournamentAnalyzer = null;

async function initializeServices() {
  try {
    database = getDatabase();
    await database.initialize();
    
    fileStorage = getFileStorage();
    
    tournamentManager = getTournamentManager();
    await tournamentManager.initialize();
    
    tournamentAnalyzer = getTournamentAnalyzer();
    await tournamentAnalyzer.initialize();
    
    console.log('✅ All services initialized');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    process.exit(1);
  }
}

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Access-Code');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve Angular static files
app.use(express.static(path.join(__dirname, '../../frontend/dist/chess-analyzer')));
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb', type: 'text/plain' }));

// Note: Access code protection applied only to upload endpoint (see upload route below)

// Performance data cache
let performanceCache = null;
let performanceCacheTimestamp = null;
let trendsCache = null;
let trendsCacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class PerformanceAPI {
  constructor() {
    this.calculator = new PerformanceCalculator();
    this.trendCalculator = new TrendCalculator();
  }

  async getPerformanceData() {
    // Check cache first
    if (performanceCache && performanceCacheTimestamp && 
        (Date.now() - performanceCacheTimestamp) < CACHE_DURATION) {
      return performanceCache;
    }

    try {
      // Get sample PGN files from Game-PGNs directory
      const pgnDir = path.join(__dirname, '../Game-PGNs');
      
      if (!fs.existsSync(pgnDir)) {
        // Return mock data if no PGN files available
        return this.getMockData();
      }

      const pgnFiles = fs.readdirSync(pgnDir)
        .filter(file => file.endsWith('.pgn'))
        .slice(0, 5) // Limit to 5 files for performance
        .map(file => fs.readFileSync(path.join(pgnDir, file), 'utf8'));

      if (pgnFiles.length === 0) {
        return this.getMockData();
      }

      // Parse games and calculate stats
      const games = this.calculator.parseGameResults(pgnFiles);
      const stats = this.calculator.calculatePerformanceStats(games);

      // Cache the result
      performanceCache = {
        white: {
          winRate: stats.white.winRate,
          accuracy: stats.white.accuracy,
          blunders: stats.white.blunders
        },
        black: {
          winRate: stats.black.winRate,
          accuracy: stats.black.accuracy,
          blunders: stats.black.blunders
        },
        lastUpdated: new Date().toISOString()
      };
      
      performanceCacheTimestamp = Date.now();
      return performanceCache;

    } catch (error) {
      console.error('Error calculating performance data:', error);
      return this.getMockData();
    }
  }

  getMockData() {
    return {
      white: { winRate: 65, accuracy: 87, blunders: 12 },
      black: { winRate: 58, accuracy: 84, blunders: 18 },
      lastUpdated: new Date().toISOString()
    };
  }

  async getTrendsData() {
    // Check cache first
    if (trendsCache && trendsCacheTimestamp && 
        (Date.now() - trendsCacheTimestamp) < CACHE_DURATION) {
      return trendsCache;
    }

    try {
      // Get sample PGN files from Game-PGNs directory
      const pgnDir = path.join(__dirname, '../../Game-PGNs');
      
      if (!fs.existsSync(pgnDir)) {
        return this.getMockTrendsData();
      }

      const pgnFiles = fs.readdirSync(pgnDir)
        .filter(file => file.endsWith('.pgn'))
        .slice(0, 10) // Limit to 10 files for performance
        .map(file => fs.readFileSync(path.join(pgnDir, file), 'utf8'));

      if (pgnFiles.length === 0) {
        return this.getMockTrendsData();
      }

      // Get games from database instead of files
      const database = getDatabase();
      await database.initialize();
      
      const games = await database.all(`
        SELECT g.*, 
               AVG(a.centipawn_loss) as avgCentipawnLoss,
               COUNT(a.id) as moveCount
        FROM games g 
        LEFT JOIN analysis a ON g.id = a.game_id 
        GROUP BY g.id 
        ORDER BY g.date ASC
      `);

      if (games.length === 0) {
        return this.getMockTrendsData();
      }

      // Convert database games to trend calculator format
      const trendGames = games.map(game => {
        // Determine which rating belongs to the target player
        const isWhite = game.white_player?.toLowerCase() === TARGET_PLAYER.toLowerCase();
        const isBlack = game.black_player?.toLowerCase() === TARGET_PLAYER.toLowerCase();
        
        let playerRating = null;
        let opponentRating = null;
        
        if (isWhite) {
          playerRating = game.white_elo;
          opponentRating = game.black_elo;
        } else if (isBlack) {
          playerRating = game.black_elo;
          opponentRating = game.white_elo;
        }
        
        return {
          date: new Date(game.date || game.created_at),
          playerRating: playerRating,
          opponentRating: opponentRating,
          whiteElo: game.white_elo,
          blackElo: game.black_elo,
          result: game.result,
          avgCentipawnLoss: game.avgCentipawnLoss || 0,
          moveCount: game.moveCount || 0,
          moves: [] // Placeholder for centipawn calculation
        };
      });

      const ratingProgression = this.trendCalculator.calculateRatingProgression(trendGames);
      const centipawnTrend = this.trendCalculator.calculateCentipawnLossTrend(trendGames);

      // Cache the result
      trendsCache = {
        ratingProgression: ratingProgression,
        centipawnTrend: centipawnTrend,
        summary: this.trendCalculator.generateTrendSummary(ratingProgression, centipawnTrend),
        lastUpdated: new Date().toISOString()
      };
      
      trendsCacheTimestamp = Date.now();
      return trendsCache;

    } catch (error) {
      console.error('Error calculating trends data:', error);
      return this.getMockTrendsData();
    }
  }

  getMockTrendsData() {
    const mockRatingProgression = [
      { date: new Date('2023-01-01'), rating: 1500, result: '1-0' },
      { date: new Date('2023-01-15'), rating: 1520, result: '0-1' },
      { date: new Date('2023-02-01'), rating: 1510, result: '1/2-1/2' },
      { date: new Date('2023-02-15'), rating: 1540, result: '1-0' },
      { date: new Date('2023-03-01'), rating: 1565, result: '1-0' }
    ];

    const mockCentipawnTrend = [
      { date: new Date('2023-01-01'), avgCentipawnLoss: 85, moveCount: 42 },
      { date: new Date('2023-01-15'), avgCentipawnLoss: 78, moveCount: 38 },
      { date: new Date('2023-02-01'), avgCentipawnLoss: 72, moveCount: 45 },
      { date: new Date('2023-02-15'), avgCentipawnLoss: 68, moveCount: 41 },
      { date: new Date('2023-03-01'), avgCentipawnLoss: 65, moveCount: 39 }
    ];

    return {
      ratingProgression: mockRatingProgression,
      centipawnTrend: mockCentipawnTrend,
      summary: {
        ratingChange: 65,
        averageCentipawnLoss: 74,
        improvementTrend: 'improving',
        totalGames: 5
      },
      lastUpdated: new Date().toISOString()
    };
  }
}

const performanceAPI = new PerformanceAPI();

// API Routes (performance route moved below to use database)

app.get('/api/trends', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const data = await performanceAPI.getTrendsData();
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: data,
      responseTime: responseTime
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/heatmap', async (req, res) => {
  try {
    const calculator = new HeatmapCalculator();
    const mockGames = [
      {
        blunders: [
          { move: 'Nf3-e5', square: 'e5', severity: 2 },
          { move: 'Qd1-h5', square: 'h5', severity: 1 }
        ]
      },
      {
        blunders: [
          { move: 'Bc8-g4', square: 'g4', severity: 3 },
          { move: 'Ke8-f7', square: 'f7', severity: 2 },
          { move: 'Nf3-e5', square: 'e5', severity: 1 }
        ]
      }
    ];
    
    const heatmap = calculator.calculateHeatmap(mockGames);
    const problematicSquares = calculator.getMostProblematicSquares();
    res.json({ heatmap, problematicSquares });
  } catch (error) {
    console.error('Heatmap API error:', error);
    res.status(500).json({ error: 'Failed to generate heatmap data' });
  }
});

// Upload endpoints (both /api/upload and /api/upload/pgn for compatibility)
const uploadHandler = async (req, res) => {
  try {
    let pgnContent;
    let originalFileName = 'uploaded.pgn';
    let assignedTournamentId = null;
    
    if (req.file) {
      // File uploaded via FormData
      pgnContent = fs.readFileSync(req.file.path, 'utf8');
      originalFileName = req.file.originalname || 'uploaded.pgn';
      assignedTournamentId = req.body.tournamentId ? parseInt(req.body.tournamentId) : null;
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
    } else {
      // Text content uploaded directly
      pgnContent = req.body;
    }
    
    if (!pgnContent || typeof pgnContent !== 'string') {
      return res.status(400).json({ error: 'No PGN content provided' });
    }

    // Check for duplicate content
    const contentHash = require('crypto').createHash('sha256').update(pgnContent).digest('hex');
    const existingGame = await database.findGameByContentHash(contentHash);
    
    if (existingGame) {
      return res.json({
        success: true,
        message: 'PGN content already exists in database',
        duplicate: true,
        existingGameId: existingGame.id
      });
    }

    const parser = new PGNParser();
    const validation = parser.validatePGN(pgnContent);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    let tournament;
    
    if (assignedTournamentId) {
      // Use assigned tournament
      tournament = await tournamentManager.getTournamentById(assignedTournamentId);
      if (!tournament) {
        return res.status(400).json({ error: 'Assigned tournament not found' });
      }
      console.log(`📊 Using assigned tournament: ${tournament.name} (ID: ${tournament.id})`);
    } else {
      // Auto-detect tournament from PGN headers
      const tournamentResult = await tournamentManager.processPGNForTournament(pgnContent);
      tournament = tournamentResult.tournament;
      console.log(`📊 Auto-detected tournament: ${tournament.name} (ID: ${tournament.id})`);
    }

    const parseResult = parser.parseFile(pgnContent);
    console.log(`📊 Starting analysis for ${parseResult.totalGames} games in tournament: ${tournament.name}`);
    
    // Initialize ChessAnalyzer for analysis
    const analyzer = new ChessAnalyzer();
    
    // Wait for Stockfish engine to be ready (only if not already ready)
    if (!analyzer.isReady) {
      console.log('⏳ Waiting for Stockfish engine to initialize...');
      await new Promise(resolve => {
        const checkReady = () => {
          if (analyzer.isReady) {
            console.log('✅ Stockfish engine ready for analysis');
            resolve();
          } else {
            setTimeout(checkReady, 200);
          }
        };
        setTimeout(() => {
          console.log('⚠️ Stockfish engine timeout after 30 seconds, proceeding anyway');
          resolve();
        }, 30000);
        checkReady();
      });
    } else {
      console.log('✅ Stockfish engine already ready');
    }
    const analyzedGames = [];
    const analysisErrors = [];
    const storedGameIds = [];
    
    // Analyze and store each game
    for (let i = 0; i < parseResult.games.length; i++) {
      const game = parseResult.games[i];
      console.log(`🔍 Analyzing game ${i + 1}/${parseResult.games.length}: ${game.white} vs ${game.black}`);
      
      try {
        // Debug logging
        console.log(`📝 Game moves:`, game.moves);
        console.log(`📊 Moves type: ${typeof game.moves}, Array: ${Array.isArray(game.moves)}, Length: ${game.moves?.length}`);
        
        // Check if moves exist and are valid
        if (!game.moves || !Array.isArray(game.moves) || game.moves.length === 0) {
          throw new Error('No valid moves found in game');
        }
        
        const analysis = await analyzer.analyzeGame(game.moves);
        
        const analyzedGame = {
          ...game,
          analysis: {
            accuracy: analysis.summary.accuracy,
            blunders: analysis.summary.blunders,
            centipawnLoss: analysis.summary.averageCentipawnLoss,
            moveCount: analysis.summary.totalMoves,
            fullAnalysis: analysis.moves
          }
        };
        
        analyzedGames.push(analyzedGame);
        
        // Store game in database with tournament linkage
        if (database) {
          try {
            let storedFilePath = 'database';
            
            // Store PGN in tournament folder if tournament assigned
            if (assignedTournamentId && fileStorage) {
              try {
                const fileResult = await fileStorage.storePGNInTournament(
                  pgnContent, 
                  originalFileName, 
                  tournament.name
                );
                storedFilePath = fileResult.relativePath;
                console.log(`📁 Stored in tournament folder: ${fileResult.tournamentFolder}/${fileResult.fileName}`);
              } catch (fileError) {
                console.warn('⚠️ Failed to store in tournament folder, using database only:', fileError.message);
              }
            }
            
            const gameData = {
              pgnFilePath: storedFilePath,
              whitePlayer: game.white || 'Unknown',
              blackPlayer: game.black || 'Unknown',
              result: game.result || '*',
              date: game.date || null,
              event: assignedTournamentId ? tournament.name : (game.event || tournament.name),
              whiteElo: game.whiteElo ? parseInt(game.whiteElo) : null,
              blackElo: game.blackElo ? parseInt(game.blackElo) : null,
              movesCount: game.moves ? game.moves.length : 0,
              tournamentId: tournament.id
            };
            
            const gameResult = await database.insertGame(gameData, pgnContent);
            const gameId = gameResult.id;
            storedGameIds.push(gameId);
            
            // Store analysis data
            if (analysis.moves && analysis.moves.length > 0) {
              for (const moveAnalysis of analysis.moves) {
                await database.insertAnalysis(gameId, moveAnalysis);

                // Store up to 15 alternative moves for each position
                if (moveAnalysis.alternatives && moveAnalysis.alternatives.length > 0) {
                  await database.storeAlternativeMoves(gameId, moveAnalysis.move_number, moveAnalysis.alternatives);
                  console.log(`📝 Stored ${moveAnalysis.alternatives.length} alternatives for move ${moveAnalysis.move_number}`);
                }

                // Store position evaluation with FEN
                if (moveAnalysis.fen_before) {
                  await database.storePositionEvaluation(
                    gameId,
                    moveAnalysis.move_number,
                    moveAnalysis.fen_before,
                    moveAnalysis.evaluation,
                    moveAnalysis.best_move,
                    12, // depth
                    null // mateIn
                  );
                }
              }
            }

            console.log(`💾 Game ${i + 1} stored in database with ID: ${gameId}, Tournament: ${tournament.name}`);
            console.log(`📊 Stored alternatives for ${analysis.moves.length} positions`);
          } catch (dbError) {
            console.error(`❌ Database storage failed for game ${i + 1}:`, dbError.message);
          }
        }
        
        console.log(`✅ Game ${i + 1} analyzed - Accuracy: ${analysis.summary.accuracy}%, Blunders: ${analysis.summary.blunders}`);
      } catch (error) {
        console.error(`❌ Analysis failed for game ${i + 1}:`, error.message);
        analysisErrors.push(`Game ${i + 1}: ${error.message}`);
        
        analyzedGames.push({
          ...game,
          analysis: null
        });
      }
    }
    
    // Update tournament game count
    if (tournament && storedGameIds.length > 0) {
      await tournamentManager.updateTournamentGameCount(tournament.id);
    }
    
    // Close the analyzer
    await analyzer.close();
    
    // Update performance metrics in database
    if (database && storedGameIds.length > 0) {
      try {
        await database.updatePerformanceMetrics();
        console.log(`📊 Performance metrics updated`);
      } catch (error) {
        console.error('❌ Failed to update performance metrics:', error.message);
      }
    }
    
    // Update legacy cache for backward compatibility
    if (analyzedGames.length > 0) {
      await updatePerformanceCacheWithGames(analyzedGames);
      await updateHeatmapCacheWithGames(analyzedGames);
      
      // Clear trends cache to force refresh on next request
      trendsCache = null;
      trendsCacheTimestamp = null;
      console.log('🔄 Trends cache cleared - Rating Progress will refresh on next load');
    }
    
    console.log(`🎯 Analysis complete: ${analyzedGames.filter(g => g.analysis).length}/${parseResult.totalGames} games analyzed`);
    console.log(`💾 Stored ${storedGameIds.length} games in database`);
    console.log(`🏆 Tournament: ${tournament.name} (${tournament.event_type})`);
    
    res.json({
      success: true,
      message: `Successfully imported and analyzed ${parseResult.totalGames} games`,
      gamesCount: parseResult.totalGames,
      totalGames: parseResult.totalGames,
      analyzedGames: analyzedGames.filter(g => g.analysis).length,
      storedGames: storedGameIds.length,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        eventType: tournament.event_type,
        location: tournament.location,
        assigned: !!assignedTournamentId
      },
      games: analyzedGames.slice(0, 5), // Return first 5 games as preview
      errors: [...parseResult.errors, ...analysisErrors]
    });
  } catch (error) {
    console.error('PGN upload error:', error);
    res.status(500).json({ error: 'Failed to process PGN file' });
  }
};

// Manual PGN entry endpoint
app.post('/api/manual-pgn', async (req, res) => {
  try {
    const { tournamentName, date, opponent, opponentElo, playerElo, result, variant, termination, playerColor, moves } = req.body;

    // Validate required fields
    if (!tournamentName || !opponent || !moves || !result || !playerColor || !variant || !termination) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Determine white and black players based on player color
    const whitePlayer = playerColor === 'white' ? TARGET_PLAYER : opponent;
    const blackPlayer = playerColor === 'black' ? TARGET_PLAYER : opponent;
    const whiteElo = playerColor === 'white' ? playerElo : opponentElo;
    const blackElo = playerColor === 'black' ? playerElo : opponentElo;

    // Format the date for PGN (YYYY.MM.DD)
    const formattedDate = date ? date.replace(/-/g, '.') : new Date().toISOString().split('T')[0].replace(/-/g, '.');

    // Construct PGN content with proper headers
    let pgnContent = `[Event "${tournamentName}"]\n`;
    pgnContent += `[Site "Tournament"]\n`;
    pgnContent += `[Date "${formattedDate}"]\n`;
    pgnContent += `[Round "?"]\n`;
    pgnContent += `[White "${whitePlayer}"]\n`;
    pgnContent += `[Black "${blackPlayer}"]\n`;
    pgnContent += `[Result "${result}"]\n`;

    if (whiteElo) {
      pgnContent += `[WhiteElo "${whiteElo}"]\n`;
    }
    if (blackElo) {
      pgnContent += `[BlackElo "${blackElo}"]\n`;
    }

    // Add TimeControl and Termination headers
    pgnContent += `[TimeControl "${variant}"]\n`;
    pgnContent += `[Termination "${termination}"]\n`;

    pgnContent += `\n${moves.trim()}\n`;

    // Add result at the end if not already present
    if (!moves.trim().endsWith(result)) {
      pgnContent += ` ${result}\n`;
    }

    console.log(`📝 Manual PGN entry: ${whitePlayer} vs ${blackPlayer} at ${tournamentName} (${variant}, ${termination})`);

    // Process using the existing upload handler logic
    // Create a modified request object to simulate file upload
    const modifiedReq = {
      ...req,
      body: pgnContent,
      file: null
    };

    // Call uploadHandler with the constructed PGN
    await uploadHandler(modifiedReq, res);
  } catch (error) {
    console.error('Manual PGN entry error:', error);
    res.status(500).json({ error: 'Failed to process manual PGN entry' });
  }
});

// Bind both routes to the same handler with access code protection and rate limiting
app.post('/api/upload', uploadLimiter, checkAccessCode, upload.single('pgn'), uploadHandler);
app.post('/api/upload/pgn', uploadLimiter, checkAccessCode, upload.single('pgn'), uploadHandler);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper functions for cache updates
async function updatePerformanceCacheWithGames(analyzedGames) {
  try {
    const validGames = analyzedGames.filter(g => g.analysis && typeof g.analysis.accuracy === 'number');
    if (validGames.length === 0) return;
    
    const whiteGames = validGames.filter(g => g.result === '1-0' || g.result === '0-1' || g.result === '1/2-1/2');
    const blackGames = validGames.filter(g => g.result === '1-0' || g.result === '0-1' || g.result === '1/2-1/2');
    
    const whiteWins = validGames.filter(g => g.result === '1-0').length;
    const blackWins = validGames.filter(g => g.result === '0-1').length;
    
    const avgAccuracy = validGames.reduce((sum, g) => sum + g.analysis.accuracy, 0) / validGames.length;
    const totalBlunders = validGames.reduce((sum, g) => {
      const blunders = g.analysis.blunders;
      return sum + (Array.isArray(blunders) ? blunders.length : (typeof blunders === 'number' ? blunders : 0));
    }, 0);
    
    // Update performance cache
    performanceCache = {
      white: {
        games: whiteGames.length,
        winRate: whiteGames.length > 0 ? Math.round((whiteWins / whiteGames.length) * 100) : 0,
        avgAccuracy: Math.round(avgAccuracy),
        blunders: Math.round(totalBlunders / 2) // Approximate white blunders
      },
      black: {
        games: blackGames.length,
        winRate: blackGames.length > 0 ? Math.round((blackWins / blackGames.length) * 100) : 0,
        avgAccuracy: Math.round(avgAccuracy),
        blunders: Math.round(totalBlunders / 2) // Approximate black blunders
      },
      overall: {
        avgAccuracy: Math.round(avgAccuracy),
        totalBlunders: totalBlunders
      }
    };
    performanceCacheTimestamp = Date.now();
    
    console.log(`📊 Performance cache updated with ${validGames.length} analyzed games`);
  } catch (error) {
    console.error('Error updating performance cache:', error);
  }
}

async function updateHeatmapCacheWithGames(analyzedGames) {
  try {
    const validGames = analyzedGames.filter(g => g.analysis && g.analysis.blunders);
    if (validGames.length === 0) return;
    
    // Extract blunder squares from all games
    const blunderSquares = {};
    
    validGames.forEach(game => {
      // Use fullAnalysis to get individual move data with blunders
      if (game.analysis.fullAnalysis && Array.isArray(game.analysis.fullAnalysis)) {
        game.analysis.fullAnalysis.forEach(moveAnalysis => {
          if (moveAnalysis.is_blunder) {
            // Extract square from move notation (simplified)
            const square = extractSquareFromMove(moveAnalysis.move);
            if (square) {
              if (!blunderSquares[square]) {
                blunderSquares[square] = { count: 0, severity: 0 };
              }
              blunderSquares[square].count++;
              blunderSquares[square].severity += Math.abs(moveAnalysis.centipawn_loss || 100);
            }
          }
        });
      }
    });
    
    // Generate heatmap data with real blunder information
    const heatmapData = [];
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (rank + 1);
        const blunderData = blunderSquares[square] || { count: 0, severity: 0 };
        
        heatmapData.push({
          square,
          file,
          rank,
          count: blunderData.count,
          severity: blunderData.severity,
          intensity: blunderData.count > 0 ? Math.min(1, blunderData.count * 0.2) : 0
        });
      }
    }
    
    // Cache the heatmap data (you might want to merge with existing cache)
    // For now, we'll store it in a global variable
    global.analyzedHeatmapData = heatmapData;
    
    console.log(`🔥 Heatmap cache updated with blunders from ${validGames.length} games`);
  } catch (error) {
    console.error('Error updating heatmap cache:', error);
  }
}

function extractSquareFromMove(move) {
  // Simple extraction - look for square notation like e4, Nf3, etc.
  const match = move.match(/[a-h][1-8]/);
  return match ? match[0] : null;
}

app.post('/api/tournaments', async (req, res) => {
  try {
    console.log('🏆 Creating new tournament');
    
    if (!tournamentManager) {
      throw new Error('Tournament manager not initialized');
    }
    
    const { name, eventType, location, startDate, endDate } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Tournament name is required' });
    }
    
    // Check if tournament already exists
    const existing = await database.findTournamentByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Tournament with this name already exists' });
    }
    
    // Create tournament
    const tournamentData = {
      name: name.trim(),
      eventType: eventType || 'standard',
      location: location || null,
      startDate: startDate || null,
      endDate: endDate || null
    };
    
    const result = await database.insertTournament(tournamentData);
    
    const tournament = {
      id: result.id,
      name: tournamentData.name,
      event_type: tournamentData.eventType,
      location: tournamentData.location,
      start_date: tournamentData.startDate,
      end_date: tournamentData.endDate,
      total_games: 0,
      created_at: new Date().toISOString()
    };
    
    console.log(`✅ Created tournament: ${tournament.name} (ID: ${tournament.id})`);
    res.status(201).json(tournament);
    
  } catch (error) {
    console.error('Tournament creation error:', error);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// Tournament API endpoints
app.get('/api/tournaments', async (req, res) => {
  try {
    console.log('🏆 Tournaments list requested');
    
    if (!tournamentManager) {
      throw new Error('Tournament manager not initialized');
    }
    
    const tournaments = await tournamentManager.getAllTournaments();
    res.json(tournaments);
  } catch (error) {
    console.error('Tournaments API error:', error);
    res.json([]);
  }
});

app.get('/api/tournaments/:id/performance', async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    console.log(`📊 Tournament ${tournamentId} performance requested`);
    
    if (!tournamentAnalyzer) {
      throw new Error('Tournament analyzer not initialized');
    }
    
    const performance = await tournamentAnalyzer.getTournamentPerformance(tournamentId);
    res.json(performance);
  } catch (error) {
    console.error('Tournament performance API error:', error);
    res.status(500).json({ error: 'Failed to get tournament performance' });
  }
});

app.get('/api/tournaments/:id/heatmap', async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    console.log(`🔥 Tournament ${tournamentId} heatmap requested`);
    
    if (!tournamentAnalyzer) {
      throw new Error('Tournament analyzer not initialized');
    }
    
    const heatmap = await tournamentAnalyzer.getTournamentHeatmap(tournamentId);
    res.json(heatmap);
  } catch (error) {
    console.error('Tournament heatmap API error:', error);
    res.json([]);
  }
});

app.get('/api/tournaments/:id/trends', async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    console.log(`📈 Tournament ${tournamentId} trends requested`);
    
    if (!tournamentAnalyzer) {
      throw new Error('Tournament analyzer not initialized');
    }
    
    const trends = await tournamentAnalyzer.getTournamentTrends(tournamentId);
    res.json(trends);
  } catch (error) {
    console.error('Tournament trends API error:', error);
    res.json([]);
  }
});

app.get('/api/tournaments/:id/summary', async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    console.log(`📋 Tournament ${tournamentId} summary requested`);
    
    if (!tournamentAnalyzer) {
      throw new Error('Tournament analyzer not initialized');
    }
    
    const summary = await tournamentAnalyzer.getTournamentSummary(tournamentId);
    res.json(summary);
  } catch (error) {
    console.error('Tournament summary API error:', error);
    res.status(500).json({ error: 'Failed to get tournament summary' });
  }
});

// Player-specific tournament performance API
app.get('/api/tournaments/:id/player-performance', async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    console.log(`👤 Player performance for tournament ${tournamentId} requested`);
    
    if (!database) {
      throw new Error('Database not initialized');
    }
    
    // Get games for this tournament involving the target player
    const games = await database.all(`
      SELECT id, white_player, black_player, result, white_elo, black_elo
      FROM games 
      WHERE tournament_id = ? AND (white_player = ? OR black_player = ?)
      ORDER BY created_at ASC
    `, [tournamentId, TARGET_PLAYER, TARGET_PLAYER]);
    
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalBlunders = 0;
    let totalCentipawnLoss = 0;
    let totalMoves = 0;
    
    for (const game of games) {
      const isPlayerWhite = game.white_player === TARGET_PLAYER;
      const isPlayerBlack = game.black_player === TARGET_PLAYER;
      
      // Calculate win/loss/draw
      if (game.result === '1/2-1/2') {
        draws++;
      } else if (
        (isPlayerWhite && game.result === '1-0') ||
        (isPlayerBlack && game.result === '0-1')
      ) {
        wins++;
      } else {
        losses++;
      }
      
      // Get analysis data for this game (for centipawn loss and move count)
      const analysis = await database.all(`
        SELECT centipawn_loss, move_number
        FROM analysis
        WHERE game_id = ?
        ORDER BY move_number
      `, [game.id]);

      // Filter moves for the target player (odd move numbers for white, even for black)
      const playerMoves = analysis.filter(move =>
        (isPlayerWhite && move.move_number % 2 === 1) ||
        (isPlayerBlack && move.move_number % 2 === 0)
      );

      // Count blunders from blunder_details table (only target player's blunders)
      const blunderCount = await database.get(`
        SELECT COUNT(*) as count
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.game_id = ?
          AND bd.is_blunder = ?
          AND ((g.white_player = ? AND bd.player_color = 'white')
            OR (g.black_player = ? AND bd.player_color = 'black'))
      `, [game.id, true, TARGET_PLAYER, TARGET_PLAYER]);

      totalBlunders += parseInt(blunderCount?.count) || 0;
      totalCentipawnLoss += playerMoves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0);
      totalMoves += playerMoves.length;
    }
    
    const totalGames = games.length;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
    const avgAccuracy = totalMoves > 0 ? Math.max(0, Math.min(100, Math.round(100 - (totalCentipawnLoss / totalMoves / 2)))) : 0;
    
    res.json({
      totalGames,
      wins,
      losses,
      draws,
      winRate,
      avgAccuracy,
      totalBlunders,
      avgCentipawnLoss: totalMoves > 0 ? Math.round(totalCentipawnLoss / totalMoves) : 0
    });
    
  } catch (error) {
    console.error('Player tournament performance API error:', error);
    res.status(500).json({ error: 'Failed to get player tournament performance' });
  }
});

app.get('/api/tournaments/compare', async (req, res) => {
  try {
    const tournamentIds = req.query.ids ? req.query.ids.split(',').map(id => parseInt(id)) : [];
    console.log(`🔄 Tournament comparison requested for: ${tournamentIds.join(', ')}`);
    
    if (!tournamentAnalyzer || tournamentIds.length === 0) {
      return res.json([]);
    }
    
    const comparison = await tournamentAnalyzer.compareTournaments(tournamentIds);
    res.json(comparison);
  } catch (error) {
    console.error('Tournament comparison API error:', error);
    res.json([]);
  }
});

app.get('/api/tournaments/rankings', async (req, res) => {
  try {
    console.log('🏆 Tournament rankings requested');
    
    if (!tournamentAnalyzer) {
      throw new Error('Tournament analyzer not initialized');
    }
    
    const rankings = await tournamentAnalyzer.rankTournaments();
    res.json(rankings);
  } catch (error) {
    console.error('Tournament rankings API error:', error);
    res.json([]);
  }
});

// Overall player performance API
app.get('/api/player-performance', async (req, res) => {
  try {
    console.log(`👤 Overall player performance requested for ${TARGET_PLAYER}`);
    
    if (!database) {
      throw new Error('Database not initialized');
    }
    
    // Get all games for the target player
    const games = await database.all(`
      SELECT id, white_player, black_player, result, white_elo, black_elo
      FROM games 
      WHERE white_player = ? OR black_player = ?
      ORDER BY created_at ASC
    `, [TARGET_PLAYER, TARGET_PLAYER]);
    
    let totalWins = 0, totalLosses = 0, totalDraws = 0;
    let whiteWins = 0, whiteLosses = 0, whiteDraws = 0, whiteGames = 0;
    let blackWins = 0, blackLosses = 0, blackDraws = 0, blackGames = 0;
    let totalBlunders = 0, totalCentipawnLoss = 0, totalMoves = 0;
    
    for (const game of games) {
      const isPlayerWhite = game.white_player === TARGET_PLAYER;
      const isPlayerBlack = game.black_player === TARGET_PLAYER;
      
      // Count games by color
      if (isPlayerWhite) whiteGames++;
      if (isPlayerBlack) blackGames++;
      
      // Calculate results
      if (game.result === '1/2-1/2') {
        totalDraws++;
        if (isPlayerWhite) whiteDraws++;
        if (isPlayerBlack) blackDraws++;
      } else if (
        (isPlayerWhite && game.result === '1-0') ||
        (isPlayerBlack && game.result === '0-1')
      ) {
        totalWins++;
        if (isPlayerWhite) whiteWins++;
        if (isPlayerBlack) blackWins++;
      } else {
        totalLosses++;
        if (isPlayerWhite) whiteLosses++;
        if (isPlayerBlack) blackLosses++;
      }
      
      // Get analysis data for this game (for centipawn loss and move count)
      const analysis = await database.all(`
        SELECT centipawn_loss, move_number
        FROM analysis
        WHERE game_id = ?
        ORDER BY move_number
      `, [game.id]);

      // Filter moves for the target player
      const playerMoves = analysis.filter(move =>
        (isPlayerWhite && move.move_number % 2 === 1) ||
        (isPlayerBlack && move.move_number % 2 === 0)
      );

      // Count blunders from blunder_details table (only target player's blunders)
      const blunderCount = await database.get(`
        SELECT COUNT(*) as count
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.game_id = ?
          AND bd.is_blunder = ?
          AND ((g.white_player = ? AND bd.player_color = 'white')
            OR (g.black_player = ? AND bd.player_color = 'black'))
      `, [game.id, true, TARGET_PLAYER, TARGET_PLAYER]);

      totalBlunders += parseInt(blunderCount?.count) || 0;
      totalCentipawnLoss += playerMoves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0);
      totalMoves += playerMoves.length;
    }
    
    const totalGames = games.length;
    const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
    const whiteWinRate = whiteGames > 0 ? Math.round((whiteWins / whiteGames) * 100) : 0;
    const blackWinRate = blackGames > 0 ? Math.round((blackWins / blackGames) * 100) : 0;
    
    // Calculate accuracy using centralized calculator
    const gamesWithAnalysis = [];
    for (const game of games) {
      const analysis = await database.all(`
        SELECT centipawn_loss, move_number
        FROM analysis 
        WHERE game_id = ?
        ORDER BY move_number
      `, [game.id]);
      
      if (analysis.length > 0) {
        gamesWithAnalysis.push({
          ...game,
          analysis
        });
      }
    }
    
    const avgAccuracy = AccuracyCalculator.calculateOverallAccuracy(gamesWithAnalysis, TARGET_PLAYER);
    
    res.json({
      overall: {
        overallWinRate,
        avgAccuracy,
        totalGames,
        totalBlunders
      },
      white: {
        games: whiteGames,
        wins: whiteWins,
        losses: whiteLosses,
        draws: whiteDraws,
        winRate: whiteWinRate,
        avgAccuracy,
        blunders: Math.round(totalBlunders * (whiteGames / totalGames))
      },
      black: {
        games: blackGames,
        wins: blackWins,
        losses: blackLosses,
        draws: blackDraws,
        winRate: blackWinRate,
        avgAccuracy,
        blunders: Math.round(totalBlunders * (blackGames / totalGames))
      }
    });
    
  } catch (error) {
    console.error('Player performance API error:', error);
    res.status(500).json({ error: 'Failed to get player performance' });
  }
});

// Enhanced performance API with tournament filtering (merged with performance-db)
app.get('/api/performance', async (req, res) => {
  try {
    const tournamentId = req.query.tournament ? parseInt(req.query.tournament) : null;
    console.log(`📊 Performance data requested${tournamentId ? ` for tournament ${tournamentId}` : ' (overall)'}`);
    
    if (!database) {
      throw new Error('Database not initialized');
    }
    
    const performanceData = await database.getPerformanceMetrics(tournamentId);
    res.json(performanceData);
  } catch (error) {
    console.error('Performance API error:', error);
    
    // Fallback data
    const fallbackData = {
      white: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
      black: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
      overall: { avgAccuracy: 0, totalBlunders: 0 }
    };
    
    res.json(fallbackData);
  }
});

app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    console.log(`🏆 Tournament ${tournamentId} details requested`);
    
    if (!tournamentManager) {
      throw new Error('Tournament manager not initialized');
    }
    
    const tournament = await tournamentManager.getTournamentById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const stats = await tournamentManager.getTournamentStats(tournamentId);
    
    res.json({
      ...tournament,
      stats
    });
  } catch (error) {
    console.error('Tournament details API error:', error);
    res.status(500).json({ error: 'Failed to get tournament details' });
  }
});

app.get('/api/tournaments/:id/files', async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    console.log(`📁 Tournament ${tournamentId} files requested`);
    
    if (!tournamentManager || !fileStorage) {
      throw new Error('Services not initialized');
    }
    
    const tournament = await tournamentManager.getTournamentById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const files = fileStorage.listTournamentFiles(tournament.name);
    res.json(files);
  } catch (error) {
    console.error('Tournament files API error:', error);
    res.json([]);
  }
});

app.get('/api/tournament-folders', async (req, res) => {
  try {
    console.log('📁 Tournament folders list requested');
    
    if (!fileStorage) {
      throw new Error('File storage not initialized');
    }
    
    const folders = fileStorage.listTournamentFolders();
    res.json(folders);
  } catch (error) {
    console.error('Tournament folders API error:', error);
    res.json([]);
  }
});

app.get('/api/tournaments/:id/games', async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    console.log(`🎮 Games for tournament ${tournamentId} requested`);
    
    if (!database) {
      throw new Error('Database not initialized');
    }

    const games = await database.all(`
      SELECT 
        id, white_player, black_player, result, date, 
        white_elo, black_elo, moves_count, created_at, pgn_content
      FROM games 
      WHERE tournament_id = ?
      ORDER BY created_at DESC
    `, [tournamentId]);
    
    // Add opening extraction and accuracy calculation to each game
    const gamesWithAnalysis = await Promise.all(games.map(async (game) => {
      let opening = null;
      if (game.pgn_content) {
        // Try to get ECO from PGN headers first
        const ecoMatch = game.pgn_content.match(/\[ECO "([^"]+)"\]/);
        if (ecoMatch) {
          const ecoCode = ecoMatch[1];
          opening = await getOpeningName(ecoCode);
        } else {
          // Fallback: Detect opening from moves
          const openingDetector = require('../models/opening-detector');
          const detected = openingDetector.detect(game.pgn_content);
          if (detected) {
            opening = detected.name;
          }
        }
      }
      
      // Get analysis data for accuracy calculation
      const analysis = await database.all(`
        SELECT move_number, centipawn_loss
        FROM analysis
        WHERE game_id = ?
        ORDER BY move_number
      `, [game.id]);

      // Calculate player-specific accuracy and blunders using centralized calculator
      let playerAccuracy = 0;
      let playerBlunders = 0;

      if (analysis.length > 0) {
        const gameWithAnalysis = {
          ...game,
          analysis
        };

        // Calculate accuracy for AdvaitKumar1213 using centralized calculator
        playerAccuracy = AccuracyCalculator.calculatePlayerAccuracy(
          analysis,
          TARGET_PLAYER,
          game.white_player,
          game.black_player
        );
      }

      // Count blunders from blunder_details table (only target player's blunders)
      const blunderCount = await database.get(`
        SELECT COUNT(*) as count
        FROM blunder_details bd
        JOIN games g ON bd.game_id = g.id
        WHERE bd.game_id = ?
          AND bd.is_blunder = ?
          AND ((g.white_player = ? AND bd.player_color = 'white')
            OR (g.black_player = ? AND bd.player_color = 'black'))
      `, [game.id, true, TARGET_PLAYER, TARGET_PLAYER]);

      playerBlunders = parseInt(blunderCount?.count) || 0;
      
      return {
        ...game,
        opening: opening || 'Unknown Opening',
        accuracy: playerAccuracy,
        blunders: playerBlunders,
        playerColor: game.white_player === TARGET_PLAYER ? 'white' : 'black'
      };
    }));
    
    res.json(gamesWithAnalysis);
  } catch (error) {
    console.error('Tournament games API error:', error);
    res.json([]);
  }
});

// Database-integrated API routes (merged into /api/performance above)

app.get('/api/heatmap-db', async (req, res) => {
  try {
    console.log('🔥 Database heatmap data requested');
    
    if (!database) {
      throw new Error('Database not initialized');
    }
    
    // Get blunder data from database
    const blunderData = await database.all(`
      SELECT 
        SUBSTR(move, -2) as square,
        COUNT(*) as count,
        AVG(centipawn_loss) as avg_loss
      FROM analysis 
      WHERE is_blunder = TRUE 
        AND SUBSTR(move, -2) GLOB '[a-h][1-8]'
      GROUP BY square
    `);
    
    // Generate full heatmap with database data
    const heatmapData = [];
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (rank + 1);
        const blunder = blunderData.find(b => b.square === square);
        
        heatmapData.push({
          square,
          file,
          rank,
          count: blunder ? blunder.count : 0,
          severity: blunder ? Math.round(blunder.avg_loss) : 0,
          intensity: blunder ? Math.min(1, blunder.count * 0.3) : 0
        });
      }
    }
    
    res.json(heatmapData);
  } catch (error) {
    console.error('Database heatmap API error:', error);
    
    // Fallback to empty heatmap
    const emptyHeatmap = [];
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (rank + 1);
        emptyHeatmap.push({
          square, file, rank,
          count: 0, severity: 0, intensity: 0
        });
      }
    }
    
    res.json(emptyHeatmap);
  }
});

// Database-based function for ECO to opening name mapping
async function getOpeningName(ecoCode) {
  try {
    const result = await database.get('SELECT opening_name FROM chess_openings WHERE eco_code = ?', [ecoCode]);
    return result ? result.opening_name : `${ecoCode} Opening`;
  } catch (error) {
    console.error('Error fetching opening name:', error);
    return `${ecoCode} Opening`;
  }
}

app.get('/api/games', async (req, res) => {
  try {
    console.log('🎮 Games list requested');
    
    if (!database) {
      throw new Error('Database not initialized');
    }

    const games = await database.all(`
      SELECT 
        id, white_player, black_player, result, date, event,
        white_elo, black_elo, moves_count, created_at, pgn_content
      FROM games 
      ORDER BY created_at DESC 
      LIMIT 50
    `);
    
    // Add opening extraction to each game
    const gamesWithOpenings = await Promise.all(games.map(async (game) => {
      let opening = null;
      if (game.pgn_content) {
        // Try to get ECO from PGN headers first
        const ecoMatch = game.pgn_content.match(/\[ECO "([^"]+)"\]/);
        if (ecoMatch) {
          const ecoCode = ecoMatch[1];
          opening = await getOpeningName(ecoCode);
        } else {
          // Fallback: Detect opening from moves
          const openingDetector = require('../models/opening-detector');
          const detected = openingDetector.detect(game.pgn_content);
          if (detected) {
            opening = detected.name;
          }
        }
      }

      return {
        ...game,
        opening: opening || 'Unknown Opening'
      };
    }));
    
    res.json(gamesWithOpenings);
  } catch (error) {
    console.error('Games API error:', error);
    res.json([]);
  }
});

// Trends API endpoints
app.get('/api/trends/rating', async (req, res) => {
  try {
    const tournamentId = req.query.tournament ? parseInt(req.query.tournament) : null;
    const tournamentFilter = tournamentId ? 'AND g.tournament_id = ?' : '';
    const params = tournamentId ? [TARGET_PLAYER, TARGET_PLAYER, tournamentId] : [TARGET_PLAYER, TARGET_PLAYER];
    
    const games = await database.all(`
      SELECT g.id, g.date, g.white_elo, g.black_elo, g.white_player, g.black_player
      FROM games g
      WHERE (g.white_player = ? OR g.black_player = ?) ${tournamentFilter}
      ORDER BY g.date ASC
    `, params);
    
    // Filter games with actual ratings and track rating progression
    const ratedGames = games.filter(game => {
      const playerRating = game.white_player === TARGET_PLAYER ? game.white_elo : game.black_elo;
      return playerRating && playerRating > 0;
    });
    
    const data = ratedGames.map((game, index) => ({
      gameNumber: index + 1,
      rating: game.white_player === TARGET_PLAYER ? game.white_elo : game.black_elo,
      date: game.date
    }));
    
    res.json({ data });
  } catch (error) {
    console.error('Rating trends API error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/trends/centipawn-loss', async (req, res) => {
  try {
    const tournamentId = req.query.tournament ? parseInt(req.query.tournament) : null;
    const tournamentFilter = tournamentId ? 'AND g.tournament_id = ?' : '';
    const params = tournamentId ? [TARGET_PLAYER, TARGET_PLAYER, tournamentId] : [TARGET_PLAYER, TARGET_PLAYER];
    
    const games = await database.all(`
      SELECT g.id, AVG(a.centipawn_loss) as avg_centipawn_loss
      FROM games g
      JOIN analysis a ON g.id = a.game_id
      WHERE (g.white_player = ? OR g.black_player = ?) ${tournamentFilter}
      GROUP BY g.id
      ORDER BY g.date ASC
    `, params);
    
    const data = games.map((game, index) => ({
      gameNumber: index + 1,
      avgCentipawnLoss: Math.round(game.avg_centipawn_loss || 0)
    }));
    
    res.json({ data });
  } catch (error) {
    console.error('Centipawn trends API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Game Analysis API Endpoints
app.get('/api/games/:id', async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await database.get('SELECT * FROM games WHERE id = ?', [gameId]);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Extract opening from PGN content
    let opening = null;
    if (game.pgn_content) {
      // Try to get ECO from PGN headers first
      const ecoMatch = game.pgn_content.match(/\[ECO "([^"]+)"\]/);
      if (ecoMatch) {
        const ecoCode = ecoMatch[1];
        opening = await getOpeningName(ecoCode);
      } else {
        // Fallback: Detect opening from moves
        const openingDetector = require('../models/opening-detector');
        const detected = openingDetector.detect(game.pgn_content);
        if (detected) {
          opening = detected.name;
        }
      }
    }
    
    res.json({
      ...game,
      opening: opening
    });
  } catch (error) {
    console.error('Game details API error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/games/:id/analysis', async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const gameAnalysis = await database.getGameAnalysis(gameId);
    
    if (!gameAnalysis) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(gameAnalysis);
  } catch (error) {
    console.error('Game analysis API error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/games/:id/alternatives/:moveNumber', async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const moveNumber = parseInt(req.params.moveNumber);
    
    const alternatives = await database.getAlternativeMoves(gameId, moveNumber);
    const position = await database.getPositionEvaluation(gameId, moveNumber);
    
    res.json({
      position: position || { moveNumber },
      alternatives: alternatives.map(alt => ({
        move: alt.alternative_move,
        evaluation: alt.evaluation,
        line: alt.line_moves ? alt.line_moves.split(' ') : [],
        evaluationDiff: position ? alt.evaluation - position.evaluation : 0
      }))
    });
  } catch (error) {
    console.error('Alternatives API error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/games/:id/blunders', async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);

    // Query blunder_details table (single source of truth for blunders)
    const blunders = await database.all(`
      SELECT bd.*
      FROM blunder_details bd
      WHERE bd.game_id = ? AND bd.is_blunder = ?
      ORDER BY bd.move_number
    `, [gameId, true]);

    res.json(blunders);
  } catch (error) {
    console.error('Blunders API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Game Accuracy API Endpoint
app.get('/api/games/:id/accuracy', async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    
    const game = await database.get('SELECT * FROM games WHERE id = ?', [gameId]);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Get analysis data for accuracy calculation using centralized calculator
    const analysis = await database.all(`
      SELECT move_number, centipawn_loss
      FROM analysis 
      WHERE game_id = ?
      ORDER BY move_number
    `, [gameId]);
    
    const gameWithAnalysis = {
      ...game,
      analysis
    };
    
    const whiteAccuracy = AccuracyCalculator.calculatePlayerAccuracy(analysis, game.white_player, game.white_player, game.black_player);
    const blackAccuracy = AccuracyCalculator.calculatePlayerAccuracy(analysis, game.black_player, game.white_player, game.black_player);
    
    const isPlayerWhite = game.white_player === TARGET_PLAYER;
    
    res.json({
      playerAccuracy: isPlayerWhite ? whiteAccuracy : blackAccuracy,
      opponentAccuracy: isPlayerWhite ? blackAccuracy : whiteAccuracy,
      whiteAccuracy,
      blackAccuracy
    });
  } catch (error) {
    console.error('Accuracy API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Game Performance API - comprehensive game metrics using AccuracyCalculator
app.get('/api/games/:id/performance', async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    
    const game = await database.get('SELECT * FROM games WHERE id = ?', [gameId]);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Extract opening from PGN content (same logic as other endpoints)
    let opening = 'Unknown';
    if (game.pgn_content) {
      // Try to get ECO from PGN headers first
      const ecoMatch = game.pgn_content.match(/\[ECO "([^"]+)"\]/);
      if (ecoMatch) {
        const ecoCode = ecoMatch[1];
        opening = await getOpeningName(ecoCode);
      } else {
        // Fallback: Detect opening from moves
        const openingDetector = require('../models/opening-detector');
        const detected = openingDetector.detect(game.pgn_content);
        if (detected) {
          opening = detected.name;
        }
      }
    }
    
    // Get analysis data
    const analysis = await database.all(`
      SELECT move_number, centipawn_loss
      FROM analysis
      WHERE game_id = ?
      ORDER BY move_number
    `, [gameId]);

    // Calculate player-specific metrics using AccuracyCalculator
    const isPlayerWhite = game.white_player === TARGET_PLAYER;

    // Filter player moves
    const playerMoves = analysis.filter(move =>
      (isPlayerWhite && move.move_number % 2 === 1) ||
      (!isPlayerWhite && move.move_number % 2 === 0)
    );

    // Calculate accuracy using AccuracyCalculator
    const playerAccuracy = AccuracyCalculator.calculatePlayerAccuracy(
      analysis,
      TARGET_PLAYER,
      game.white_player,
      game.black_player
    );

    // Count blunders from blunder_details table (only target player's blunders)
    const blunderCount = await database.get(`
      SELECT COUNT(*) as count
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.game_id = ?
        AND bd.is_blunder = ?
        AND ((g.white_player = ? AND bd.player_color = 'white')
          OR (g.black_player = ? AND bd.player_color = 'black'))
    `, [gameId, true, TARGET_PLAYER, TARGET_PLAYER]);

    const playerBlunders = parseInt(blunderCount?.count) || 0;
    
    res.json({
      gameId: gameId,
      playerColor: isPlayerWhite ? 'white' : 'black',
      accuracy: Math.round(playerAccuracy),
      blunders: playerBlunders,
      moves: playerMoves.length,
      totalMoves: analysis.length,
      opening: opening
    });
  } catch (error) {
    console.error('Game performance API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Game Phase Analysis API Endpoint
app.get('/api/games/:id/phases', async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    
    const game = await database.get('SELECT * FROM games WHERE id = ?', [gameId]);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const analysis = await database.all(`
      SELECT * FROM analysis WHERE game_id = ? ORDER BY move_number
    `, [gameId]);
    
    if (analysis.length === 0) {
      return res.json({
        opening: { accuracy: 0, description: 'No analysis available' },
        middlegame: { accuracy: 0, description: 'No analysis available' },
        endgame: { accuracy: 0, description: 'No analysis available' }
      });
    }
    
    // Divide game into phases
    const totalMoves = analysis.length;
    const openingEnd = Math.min(20, Math.floor(totalMoves * 0.3));
    const middlegameEnd = Math.floor(totalMoves * 0.7);
    
    const openingMoves = analysis.slice(0, openingEnd);
    const middlegameMoves = analysis.slice(openingEnd, middlegameEnd);
    const endgameMoves = analysis.slice(middlegameEnd);
    
    const isPlayerWhite = game.white_player === TARGET_PLAYER;
    
    const getPlayerMoves = (moves) => moves.filter(move => 
      (isPlayerWhite && move.move_number % 2 === 1) ||
      (!isPlayerWhite && move.move_number % 2 === 0)
    );
    
    const playerOpeningMoves = getPlayerMoves(openingMoves);
    const playerMiddlegameMoves = getPlayerMoves(middlegameMoves);
    const playerEndgameMoves = getPlayerMoves(endgameMoves);
    
    // Use AccuracyCalculator for consistent accuracy calculation
    const calculatePhaseAccuracy = (moves) => {
      if (moves.length === 0) return 0;
      const avgCPL = moves.reduce((sum, move) => sum + move.centipawn_loss, 0) / moves.length;
      return Math.max(0, Math.min(100, 100 - (avgCPL / 3))); // Same formula as AccuracyCalculator
    };
    
    const openingAccuracy = calculatePhaseAccuracy(playerOpeningMoves);
    const middlegameAccuracy = calculatePhaseAccuracy(playerMiddlegameMoves);
    const endgameAccuracy = calculatePhaseAccuracy(playerEndgameMoves);
    
    const getPhaseDescription = (accuracy, blunders) => {
      if (accuracy >= 90) return `Excellent play, very precise moves`;
      if (accuracy >= 80) return `Good performance with minor inaccuracies`;
      if (blunders > 0) return `${blunders} major mistake${blunders > 1 ? 's' : ''} in this phase`;
      return `Room for improvement in this phase`;
    };
    
    // Count blunders by phase from blunder_details table (only target player's blunders)
    const openingBlunderCount = await database.get(`
      SELECT COUNT(*) as count
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.game_id = ?
        AND bd.phase = 'opening'
        AND bd.is_blunder = ?
        AND ((g.white_player = ? AND bd.player_color = 'white')
          OR (g.black_player = ? AND bd.player_color = 'black'))
    `, [gameId, true, TARGET_PLAYER, TARGET_PLAYER]);

    const middlegameBlunderCount = await database.get(`
      SELECT COUNT(*) as count
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.game_id = ?
        AND bd.phase = 'middlegame'
        AND bd.is_blunder = ?
        AND ((g.white_player = ? AND bd.player_color = 'white')
          OR (g.black_player = ? AND bd.player_color = 'black'))
    `, [gameId, true, TARGET_PLAYER, TARGET_PLAYER]);

    const endgameBlunderCount = await database.get(`
      SELECT COUNT(*) as count
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.game_id = ?
        AND bd.phase = 'endgame'
        AND bd.is_blunder = ?
        AND ((g.white_player = ? AND bd.player_color = 'white')
          OR (g.black_player = ? AND bd.player_color = 'black'))
    `, [gameId, true, TARGET_PLAYER, TARGET_PLAYER]);

    const openingBlunders = parseInt(openingBlunderCount?.count) || 0;
    const middlegameBlunders = parseInt(middlegameBlunderCount?.count) || 0;
    const endgameBlunders = parseInt(endgameBlunderCount?.count) || 0;
    
    res.json({
      opening: {
        accuracy: Math.round(openingAccuracy),
        description: getPhaseDescription(openingAccuracy, openingBlunders)
      },
      middlegame: {
        accuracy: Math.round(middlegameAccuracy),
        description: getPhaseDescription(middlegameAccuracy, middlegameBlunders)
      },
      endgame: {
        accuracy: Math.round(endgameAccuracy),
        description: getPhaseDescription(endgameAccuracy, endgameBlunders)
      }
    });
  } catch (error) {
    console.error('Phase analysis API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== Enhanced Blunder Tracking API Endpoints (Issue #76) ==========

// GET /api/blunders - Get all blunder details with optional filtering
app.get('/api/blunders', async (req, res) => {
  try {
    const { phase, theme, learned, severity, minDifficulty, maxDifficulty } = req.query;

    let query = `
      SELECT bd.*, g.white_player, g.black_player, g.date, g.event
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE 1=1
    `;
    const params = [];

    if (phase) {
      query += ' AND bd.phase = ?';
      params.push(phase);
    }

    if (theme) {
      query += ' AND bd.tactical_theme = ?';
      params.push(theme);
    }

    if (learned !== undefined) {
      query += ' AND bd.learned = ?';
      params.push(learned === 'true' ? 1 : 0);
    }

    if (severity) {
      query += ' AND bd.blunder_severity = ?';
      params.push(severity);
    }

    if (minDifficulty) {
      query += ' AND bd.difficulty_level >= ?';
      params.push(parseInt(minDifficulty));
    }

    if (maxDifficulty) {
      query += ' AND bd.difficulty_level <= ?';
      params.push(parseInt(maxDifficulty));
    }

    query += ' ORDER BY bd.created_at DESC';

    const blunders = await database.all(query, params);

    res.json({
      count: blunders.length,
      blunders: blunders
    });
  } catch (error) {
    console.error('Blunders API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blunders/by-phase/:phase - Get blunders by game phase
app.get('/api/blunders/by-phase/:phase', async (req, res) => {
  try {
    const { phase } = req.params;

    if (!['opening', 'middlegame', 'endgame'].includes(phase)) {
      return res.status(400).json({ error: 'Invalid phase. Must be opening, middlegame, or endgame' });
    }

    const blunders = await database.all(`
      SELECT bd.*, g.white_player, g.black_player, g.date, g.event
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.phase = ?
      ORDER BY bd.centipawn_loss DESC
    `, [phase]);

    // Calculate statistics for this phase
    const stats = {
      totalBlunders: blunders.length,
      averageCentipawnLoss: blunders.length > 0
        ? Math.round(blunders.reduce((sum, b) => sum + b.centipawn_loss, 0) / blunders.length)
        : 0,
      severityBreakdown: {
        minor: blunders.filter(b => b.blunder_severity === 'minor').length,
        moderate: blunders.filter(b => b.blunder_severity === 'moderate').length,
        major: blunders.filter(b => b.blunder_severity === 'major').length,
        critical: blunders.filter(b => b.blunder_severity === 'critical').length
      },
      learned: blunders.filter(b => b.learned).length,
      unlearned: blunders.filter(b => !b.learned).length
    };

    res.json({
      phase: phase,
      stats: stats,
      blunders: blunders
    });
  } catch (error) {
    console.error('Blunders by phase API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blunders/by-theme/:theme - Get blunders by tactical theme
app.get('/api/blunders/by-theme/:theme', async (req, res) => {
  try {
    const { theme } = req.params;

    const blunders = await database.all(`
      SELECT bd.*, g.white_player, g.black_player, g.date, g.event
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.tactical_theme = ?
      ORDER BY bd.centipawn_loss DESC
    `, [theme]);

    // Calculate statistics for this theme
    const stats = {
      totalBlunders: blunders.length,
      averageCentipawnLoss: blunders.length > 0
        ? Math.round(blunders.reduce((sum, b) => sum + b.centipawn_loss, 0) / blunders.length)
        : 0,
      phaseBreakdown: {
        opening: blunders.filter(b => b.phase === 'opening').length,
        middlegame: blunders.filter(b => b.phase === 'middlegame').length,
        endgame: blunders.filter(b => b.phase === 'endgame').length
      },
      learned: blunders.filter(b => b.learned).length,
      averageDifficulty: blunders.length > 0
        ? (blunders.reduce((sum, b) => sum + b.difficulty_level, 0) / blunders.length).toFixed(1)
        : 0
    };

    res.json({
      theme: theme,
      stats: stats,
      blunders: blunders
    });
  } catch (error) {
    console.error('Blunders by theme API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blunders/unlearned - Get blunders not yet mastered
app.get('/api/blunders/unlearned', async (req, res) => {
  try {
    const { minMastery = 70 } = req.query;

    const blunders = await database.all(`
      SELECT bd.*, g.white_player, g.black_player, g.date, g.event
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.learned = 0 OR bd.mastery_score < ?
      ORDER BY bd.difficulty_level DESC, bd.centipawn_loss DESC
    `, [minMastery]);

    // Group by tactical theme for learning prioritization
    const byTheme = {};
    blunders.forEach(blunder => {
      const theme = blunder.tactical_theme || 'unknown';
      if (!byTheme[theme]) {
        byTheme[theme] = [];
      }
      byTheme[theme].push(blunder);
    });

    res.json({
      totalUnlearned: blunders.length,
      byTheme: byTheme,
      blunders: blunders
    });
  } catch (error) {
    console.error('Unlearned blunders API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/blunders/:id/review - Mark blunder as reviewed
app.put('/api/blunders/:id/review', async (req, res) => {
  try {
    const blunderId = parseInt(req.params.id);

    // Check if blunder exists
    const blunder = await database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);
    if (!blunder) {
      return res.status(404).json({ error: 'Blunder not found' });
    }

    // Increment review count and update last_reviewed
    const newReviewCount = (blunder.review_count || 0) + 1;
    const currentTimestamp = new Date().toISOString();

    // Calculate mastery score based on review count
    // Formula: mastery increases with reviews, caps at 100
    const masteryIncrease = Math.min(15, 100 / (newReviewCount + 1));
    const newMasteryScore = Math.min(100, (blunder.mastery_score || 0) + masteryIncrease);

    await database.run(`
      UPDATE blunder_details
      SET review_count = ?,
          last_reviewed = ?,
          mastery_score = ?,
          updated_at = ?
      WHERE id = ?
    `, [newReviewCount, currentTimestamp, newMasteryScore, currentTimestamp, blunderId]);

    const updated = await database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);

    res.json({
      success: true,
      blunder: updated
    });
  } catch (error) {
    console.error('Review blunder API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/blunders/:id/learned - Mark blunder as learned
app.put('/api/blunders/:id/learned', async (req, res) => {
  try {
    const blunderId = parseInt(req.params.id);
    const { learned, notes } = req.body;

    // Check if blunder exists
    const blunder = await database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);
    if (!blunder) {
      return res.status(404).json({ error: 'Blunder not found' });
    }

    const currentTimestamp = new Date().toISOString();
    const learnedValue = learned ? 1 : 0;

    // If marking as learned, set mastery to 100
    const masteryScore = learned ? 100 : blunder.mastery_score;

    let query = `
      UPDATE blunder_details
      SET learned = ?,
          mastery_score = ?,
          updated_at = ?
    `;
    const params = [learnedValue, masteryScore, currentTimestamp];

    if (notes !== undefined) {
      query += ', notes = ?';
      params.push(notes);
    }

    query += ' WHERE id = ?';
    params.push(blunderId);

    await database.run(query, params);

    const updated = await database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);

    res.json({
      success: true,
      blunder: updated
    });
  } catch (error) {
    console.error('Mark learned API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blunders/dashboard - Get aggregated dashboard statistics
app.get('/api/blunders/dashboard', async (req, res) => {
  try {
    // Get all blunders with game info (only actual blunders by the target player, not mistakes or inaccuracies)
    const allBlunders = await database.all(`
      SELECT bd.*, g.white_player, g.black_player, g.date, g.event
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.is_blunder = TRUE
        AND ((g.white_player = ? AND bd.player_color = 'white')
          OR (g.black_player = ? AND bd.player_color = 'black'))
      ORDER BY bd.created_at DESC
    `, [TARGET_PLAYER, TARGET_PLAYER]);

    // Calculate overview statistics
    const totalBlunders = allBlunders.length;
    const avgCentipawnLoss = totalBlunders > 0
      ? Math.round(allBlunders.reduce((sum, b) => sum + b.centipawn_loss, 0) / totalBlunders)
      : 0;

    const mostCostly = allBlunders.length > 0
      ? allBlunders.reduce((max, b) => b.centipawn_loss > max.centipawn_loss ? b : max)
      : null;

    // Calculate trend (last 30 days vs previous 30 days)
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentBlunders = allBlunders.filter(b => new Date(b.created_at) >= last30Days);
    const previousBlunders = allBlunders.filter(b => {
      const date = new Date(b.created_at);
      return date >= last60Days && date < last30Days;
    });

    const trend = {
      lastMonth: recentBlunders.length,
      previousMonth: previousBlunders.length,
      change: previousBlunders.length > 0
        ? ((recentBlunders.length - previousBlunders.length) / previousBlunders.length * 100).toFixed(1)
        : 0,
      improving: recentBlunders.length < previousBlunders.length
    };

    // Aggregate by phase
    const byPhase = {
      opening: allBlunders.filter(b => b.phase === 'opening'),
      middlegame: allBlunders.filter(b => b.phase === 'middlegame'),
      endgame: allBlunders.filter(b => b.phase === 'endgame')
    };

    const phaseStats = {
      opening: {
        count: byPhase.opening.length,
        percentage: totalBlunders > 0 ? ((byPhase.opening.length / totalBlunders) * 100).toFixed(1) : 0,
        avgLoss: byPhase.opening.length > 0
          ? Math.round(byPhase.opening.reduce((sum, b) => sum + b.centipawn_loss, 0) / byPhase.opening.length)
          : 0
      },
      middlegame: {
        count: byPhase.middlegame.length,
        percentage: totalBlunders > 0 ? ((byPhase.middlegame.length / totalBlunders) * 100).toFixed(1) : 0,
        avgLoss: byPhase.middlegame.length > 0
          ? Math.round(byPhase.middlegame.reduce((sum, b) => sum + b.centipawn_loss, 0) / byPhase.middlegame.length)
          : 0
      },
      endgame: {
        count: byPhase.endgame.length,
        percentage: totalBlunders > 0 ? ((byPhase.endgame.length / totalBlunders) * 100).toFixed(1) : 0,
        avgLoss: byPhase.endgame.length > 0
          ? Math.round(byPhase.endgame.reduce((sum, b) => sum + b.centipawn_loss, 0) / byPhase.endgame.length)
          : 0
      }
    };

    // Aggregate by tactical theme
    const themeMap = {};
    allBlunders.forEach(b => {
      const theme = b.tactical_theme || 'unknown';
      if (!themeMap[theme]) {
        themeMap[theme] = { count: 0, totalLoss: 0, blunders: [] };
      }
      themeMap[theme].count++;
      themeMap[theme].totalLoss += b.centipawn_loss;
      themeMap[theme].blunders.push(b);
    });

    const byTheme = Object.entries(themeMap)
      .map(([theme, data]) => ({
        theme,
        count: data.count,
        percentage: totalBlunders > 0 ? ((data.count / totalBlunders) * 100).toFixed(1) : 0,
        avgLoss: Math.round(data.totalLoss / data.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 themes

    // Aggregate by severity
    const bySeverity = {
      critical: allBlunders.filter(b => b.blunder_severity === 'critical').length,
      major: allBlunders.filter(b => b.blunder_severity === 'major').length,
      moderate: allBlunders.filter(b => b.blunder_severity === 'moderate').length,
      minor: allBlunders.filter(b => b.blunder_severity === 'minor').length
    };

    // Top patterns (theme + phase combinations)
    const patternMap = {};
    allBlunders.forEach(b => {
      const key = `${b.tactical_theme || 'unknown'}_${b.phase}`;
      const description = `${b.tactical_theme || 'Unknown'} in ${b.phase}`;
      if (!patternMap[key]) {
        patternMap[key] = {
          description,
          phase: b.phase,
          theme: b.tactical_theme || 'unknown',
          occurrences: 0,
          totalLoss: 0,
          learned: 0,
          blunders: []
        };
      }
      patternMap[key].occurrences++;
      patternMap[key].totalLoss += b.centipawn_loss;
      if (b.learned) patternMap[key].learned++;
      patternMap[key].blunders.push(b);
    });

    const topPatterns = Object.values(patternMap)
      .map(p => ({
        description: p.description,
        occurrences: p.occurrences,
        avgLoss: Math.round(p.totalLoss / p.occurrences),
        phase: p.phase,
        theme: p.theme,
        learned: p.learned === p.occurrences,
        learnedCount: p.learned,
        lastOccurrence: p.blunders[p.blunders.length - 1].created_at
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);

    // Learning progress
    const learnedBlunders = allBlunders.filter(b => b.learned).length;
    const unlearnedBlunders = totalBlunders - learnedBlunders;
    const masteredThemes = [...new Set(
      allBlunders.filter(b => b.learned && b.mastery_score >= 80).map(b => b.tactical_theme)
    )].filter(t => t);

    // Study recommendations
    const unlearnedThemes = Object.entries(themeMap)
      .filter(([theme, data]) => {
        const learned = data.blunders.filter(b => b.learned).length;
        return learned / data.count < 0.5; // Less than 50% learned
      })
      .map(([theme, data]) => ({
        theme,
        priority: data.count,
        reason: `${data.count} occurrences, ${data.blunders.filter(b => b.learned).length} learned`
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);

    // Recent blunders (last 20)
    const recentBlundersList = allBlunders.slice(0, 20).map(b => ({
      id: b.id,
      gameId: b.game_id,
      moveNumber: b.move_number,
      phase: b.phase,
      theme: b.tactical_theme,
      playerMove: b.player_move,
      bestMove: b.best_move,
      centipawnLoss: b.centipawn_loss,
      date: b.date,
      opponent: b.white_player === TARGET_PLAYER ? b.black_player : b.white_player,
      event: b.event,
      learned: b.learned
    }));

    res.json({
      overview: {
        totalBlunders,
        avgCentipawnLoss,
        mostCostlyBlunder: mostCostly ? {
          gameId: mostCostly.game_id,
          moveNumber: mostCostly.move_number,
          loss: mostCostly.centipawn_loss
        } : null,
        trend
      },
      byPhase: phaseStats,
      byTheme,
      bySeverity,
      topPatterns,
      learningProgress: {
        learnedCount: learnedBlunders,
        unlearnedCount: unlearnedBlunders,
        totalCount: totalBlunders,
        percentage: totalBlunders > 0 ? ((learnedBlunders / totalBlunders) * 100).toFixed(1) : 0,
        masteredThemes,
        recommendations: unlearnedThemes
      },
      recentBlunders: recentBlundersList
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blunders/timeline - Get blunders by date for heatmap
app.get('/api/blunders/timeline', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT
        DATE(bd.created_at) as date,
        COUNT(*) as count,
        AVG(bd.centipawn_loss) as avgLoss
      FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.is_blunder = TRUE
        AND ((g.white_player = ? AND bd.player_color = 'white')
          OR (g.black_player = ? AND bd.player_color = 'black'))
    `;
    const params = [TARGET_PLAYER, TARGET_PLAYER];

    if (startDate) {
      query += ' AND DATE(bd.created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(bd.created_at) <= ?';
      params.push(endDate);
    }

    query += ' GROUP BY DATE(bd.created_at) ORDER BY date DESC';

    const timeline = await database.all(query, params);

    const formattedData = timeline.map(row => ({
      date: row.date,
      count: row.count,
      avgLoss: Math.round(row.avgLoss)
    }));

    res.json({
      data: formattedData,
      totalDays: formattedData.length
    });
  } catch (error) {
    console.error('Timeline API error:', error);
    res.status(500).json({ error: error.message });
  }
});

//===========================================
// Puzzle API Endpoints (Phase 2: Issue #78)
//===========================================

// GET /api/puzzles/blunder/:blunderId - Get recommended puzzles for a blunder
app.get('/api/puzzles/blunder/:blunderId', async (req, res) => {
  try {
    const blunderId = parseInt(req.params.blunderId);

    // Get blunder from database
    const blunder = await database.get(`
      SELECT id, fen, tactical_theme, position_type
      FROM blunder_details
      WHERE id = ?
    `, [blunderId]);

    if (!blunder) {
      return res.status(404).json({ error: 'Blunder not found' });
    }

    // Parse themes from tactical_theme and position_type
    const themes = [];
    if (blunder.tactical_theme) {
      themes.push(...blunder.tactical_theme.split(',').map(t => t.trim()));
    }
    if (blunder.position_type) {
      themes.push(blunder.position_type);
    }

    // Find matching puzzles
    const PuzzleMatcher = require('../models/puzzle-matcher');
    const puzzleMatcher = new PuzzleMatcher(database);
    const matches = await puzzleMatcher.findMatchingPuzzles({
      fen_before: blunder.fen,
      themes
    });

    res.json({
      blunderId,
      puzzles: matches
    });
  } catch (error) {
    console.error('[API] Error finding puzzles for blunder:', error);
    res.status(500).json({ error: 'Failed to find matching puzzles' });
  }
});

// GET /api/puzzles/:puzzleId - Get full puzzle details (with caching)
app.get('/api/puzzles/:puzzleId', async (req, res) => {
  try {
    const puzzleId = req.params.puzzleId;

    // Check cache first
    const PuzzleCacheManager = require('../models/puzzle-cache-manager');
    const puzzleCache = new PuzzleCacheManager(database);
    let puzzle = await puzzleCache.get(puzzleId);

    if (!puzzle) {
      // Cache miss - fetch from Lichess API
      const LichessAPIClient = require('../models/lichess-api-client');
      const lichessClient = new LichessAPIClient();
      puzzle = await lichessClient.fetchPuzzle(puzzleId);

      if (puzzle.error) {
        return res.status(404).json({
          error: 'Puzzle not found',
          lichessUrl: puzzle.lichessUrl
        });
      }

      // Cache the puzzle
      await puzzleCache.set(puzzle);
    }

    res.json(puzzle);
  } catch (error) {
    console.error('[API] Error fetching puzzle:', error);
    res.status(500).json({ error: 'Failed to fetch puzzle' });
  }
});

// POST /api/puzzles/link - Link a blunder to recommended puzzles
app.post('/api/puzzles/link', async (req, res) => {
  try {
    const { blunderId, puzzleIds } = req.body;

    if (!blunderId || !Array.isArray(puzzleIds)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // Get blunder and find matching puzzles
    const blunder = await database.get('SELECT * FROM blunder_details WHERE id = ?', [blunderId]);
    if (!blunder) {
      return res.status(404).json({ error: 'Blunder not found' });
    }

    // Parse themes from tactical_theme and position_type
    const themes = [];
    if (blunder.tactical_theme) {
      themes.push(...blunder.tactical_theme.split(',').map(t => t.trim()));
    }
    if (blunder.position_type) {
      themes.push(blunder.position_type);
    }

    // Find matching puzzles
    const PuzzleMatcher = require('../models/puzzle-matcher');
    const puzzleMatcher = new PuzzleMatcher(database);
    const matches = await puzzleMatcher.findMatchingPuzzles({
      fen_before: blunder.fen,
      themes
    });

    // Save links
    const links = [];
    for (const match of matches.slice(0, puzzleIds.length || 5)) {
      await database.run(`
        INSERT INTO blunder_puzzle_links (blunder_id, puzzle_id, match_score)
        VALUES (?, ?, ?)
        ON CONFLICT (blunder_id, puzzle_id) DO UPDATE SET match_score = excluded.match_score
      `, [blunderId, match.id, match.score]);

      links.push({ puzzleId: match.id, score: match.score });
    }

    res.json({ blunderId, links });
  } catch (error) {
    console.error('[API] Error linking puzzles:', error);
    res.status(500).json({ error: 'Failed to link puzzles' });
  }
});

//===========================================
// Learning Path API Endpoints (Phase 3: Issue #78)
//===========================================

// GET /api/learning-path - Get personalized learning path
app.get('/api/learning-path', async (req, res) => {
  try {
    const LearningPathGenerator = require('../models/learning-path-generator');
    const pathGenerator = new LearningPathGenerator(database);
    const learningPath = await pathGenerator.getLearningPath();
    res.json(learningPath);
  } catch (error) {
    console.error('[API] Error getting learning path:', error);
    res.status(500).json({ error: 'Failed to generate learning path' });
  }
});

// GET /api/learning-path/recommendations - Get puzzle recommendations
app.get('/api/learning-path/recommendations', async (req, res) => {
  try {
    const { limit = 10, rating = 1500, enhanced = false } = req.query;
    const LearningPathGenerator = require('../models/learning-path-generator');
    const pathGenerator = new LearningPathGenerator(database);
    
    if (enhanced === 'true') {
      // Enhanced recommendations with spaced repetition and adaptive difficulty
      const recommendations = await pathGenerator.generateEnhancedRecommendations({
        limit: parseInt(limit),
        playerRating: parseInt(rating)
      });
      res.json(recommendations);
    } else {
      // Basic recommendations
      const recommendations = await pathGenerator.generateRecommendations({
        limit: parseInt(limit),
        playerRating: parseInt(rating)
      });
      res.json({ recommendations });
    }
  } catch (error) {
    console.error('[API] Error getting recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// GET /api/learning-path/daily-goals - Get daily goals
app.get('/api/learning-path/daily-goals', async (req, res) => {
  try {
    const LearningPathGenerator = require('../models/learning-path-generator');
    const pathGenerator = new LearningPathGenerator(database);
    const dailyGoals = await pathGenerator.generateDailyGoals();
    res.json(dailyGoals);
  } catch (error) {
    console.error('[API] Error getting daily goals:', error);
    res.status(500).json({ error: 'Failed to get daily goals' });
  }
});

// GET /api/learning-path/review - Get puzzles due for review (spaced repetition)
app.get('/api/learning-path/review', async (req, res) => {
  try {
    const LearningPathGenerator = require('../models/learning-path-generator');
    const pathGenerator = new LearningPathGenerator(database);
    const reviewPuzzles = await pathGenerator.getPuzzlesDueForReview();
    res.json({ puzzles: reviewPuzzles, count: reviewPuzzles.length });
  } catch (error) {
    console.error('[API] Error getting review puzzles:', error);
    res.status(500).json({ error: 'Failed to get review puzzles' });
  }
});

// GET /api/learning-path/adaptive-difficulty - Get adaptive difficulty recommendations
app.get('/api/learning-path/adaptive-difficulty', async (req, res) => {
  try {
    const { rating = 1500 } = req.query;
    const LearningPathGenerator = require('../models/learning-path-generator');
    const pathGenerator = new LearningPathGenerator(database);
    const adaptiveDifficulty = await pathGenerator.getAdaptiveDifficulty(parseInt(rating));
    res.json(adaptiveDifficulty);
  } catch (error) {
    console.error('[API] Error getting adaptive difficulty:', error);
    res.status(500).json({ error: 'Failed to get adaptive difficulty' });
  }
});

// GET /api/learning-path/trends - Get performance trends
app.get('/api/learning-path/trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const LearningPathGenerator = require('../models/learning-path-generator');
    const pathGenerator = new LearningPathGenerator(database);
    const trends = await pathGenerator.getPerformanceTrends(parseInt(days));
    res.json(trends);
  } catch (error) {
    console.error('[API] Error getting performance trends:', error);
    res.status(500).json({ error: 'Failed to get performance trends' });
  }
});

// GET /api/learning-path/theme-mastery - Get theme mastery levels
app.get('/api/learning-path/theme-mastery', async (req, res) => {
  try {
    const LearningPathGenerator = require('../models/learning-path-generator');
    const pathGenerator = new LearningPathGenerator(database);
    const themeMastery = await pathGenerator.getThemeMasteryLevels();
    res.json({ themes: themeMastery });
  } catch (error) {
    console.error('[API] Error getting theme mastery:', error);
    res.status(500).json({ error: 'Failed to get theme mastery' });
  }
});

// POST /api/puzzle-progress - Record puzzle attempt
app.post('/api/puzzle-progress', async (req, res) => {
  try {
    const { puzzleId, solved, timeSpent, movesCount, hintsUsed } = req.body;
    
    if (!puzzleId) {
      return res.status(400).json({ error: 'Puzzle ID is required' });
    }

    const PuzzleProgressTracker = require('../models/puzzle-progress-tracker');
    const progressTracker = new PuzzleProgressTracker(database);
    
    const progress = await progressTracker.recordAttempt(puzzleId, {
      solved: Boolean(solved),
      timeSpent: parseInt(timeSpent) || 0,
      movesCount: parseInt(movesCount) || 0,
      hintsUsed: parseInt(hintsUsed) || 0
    });

    res.json({ success: true, progress });
  } catch (error) {
    console.error('[API] Error recording puzzle progress:', error);
    res.status(500).json({ error: 'Failed to record progress' });
  }
});

// GET /api/puzzle-progress/:puzzleId - Get progress for specific puzzle
app.get('/api/puzzle-progress/:puzzleId', async (req, res) => {
  try {
    const { puzzleId } = req.params;
    const PuzzleProgressTracker = require('../models/puzzle-progress-tracker');
    const progressTracker = new PuzzleProgressTracker(database);
    
    const progress = await progressTracker.getProgress(puzzleId);
    
    if (!progress) {
      return res.status(404).json({ error: 'Progress not found' });
    }

    res.json(progress);
  } catch (error) {
    console.error('[API] Error getting puzzle progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// GET /api/puzzle-progress - Get all progress
app.get('/api/puzzle-progress', async (req, res) => {
  try {
    const { limit = 100, orderBy = 'last_attempted', order = 'DESC', minMastery = 0 } = req.query;
    const PuzzleProgressTracker = require('../models/puzzle-progress-tracker');
    const progressTracker = new PuzzleProgressTracker(database);
    
    const progress = await progressTracker.getAllProgress({
      limit: parseInt(limit),
      orderBy,
      order,
      minMastery: parseInt(minMastery)
    });

    res.json({ progress });
  } catch (error) {
    console.error('[API] Error getting all progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// GET /api/puzzle-statistics - Get puzzle statistics
app.get('/api/puzzle-statistics', async (req, res) => {
  try {
    const PuzzleProgressTracker = require('../models/puzzle-progress-tracker');
    const progressTracker = new PuzzleProgressTracker(database);
    const statistics = await progressTracker.getStatistics();
    res.json(statistics);
  } catch (error) {
    console.error('[API] Error getting puzzle statistics:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Serve Angular app for all non-API routes (MUST BE LAST)
app.get('*', (req, res) => {
  // Only serve Angular for non-API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../../frontend/dist/chess-analyzer/index-angular.html'));
});

// Initialize services and start server
async function startServer() {
  try {
    await initializeServices();
    
    const server = app.listen(port, () => {
      console.log(`🚀 Chess Performance Dashboard running at http://localhost:${port}`);
      console.log(`📊 API available at http://localhost:${port}/api/performance`);
      console.log(`💾 Database API at http://localhost:${port}/api/performance-db`);
      console.log(`🔥 Heatmap API at http://localhost:${port}/api/heatmap-db`);
      console.log(`🧩 Learning Path API at http://localhost:${port}/api/learning-path`);
      console.log(`📈 Puzzle Progress API at http://localhost:${port}/api/puzzle-progress`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use. Please stop the existing server or use a different port.`);
      } else {
        console.error('❌ Server error:', err.message);
      }
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...');
      server.close(async () => {
        if (database) {
          await database.close();
        }
        console.log('✅ Server shut down gracefully');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;
