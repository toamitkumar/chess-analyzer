const express = require('express');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const PerformanceCalculator = require('../models/performance-stats');
const TrendCalculator = require('../models/trend-calculator');
const HeatmapCalculator = require('../models/HeatmapCalculator');
const PGNParser = require('../services/PGNParser');
const ChessAnalyzer = require('../models/analyzer');
const { getDatabase } = require('../models/database');
const { getFileStorage } = require('../models/file-storage');
const { getTournamentManager } = require('../models/tournament-manager');
const AccuracyCalculator = require('../models/accuracy-calculator');
const { getTournamentAnalyzer } = require('../models/tournament-analyzer');
const { TARGET_PLAYER, API_CONFIG } = require('../config/app-config');
const { checkAccessCode } = require('../middleware/access-code');
const { requireAuth } = require('../middleware/clerk-auth');

// Import route configuration function
const configureRoutes = require('./routes');

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

// Multer configuration for file uploads (stored in memory)
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB file size limit
  }
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

// Authentication middleware
// TEMPORARILY DISABLED FOR TESTING - RE-ENABLE AFTER ROUTE VERIFICATION
// Require authentication for all API endpoints
// app.use('/api/*', requireAuth);

// Configure and mount all API routes
// Pass upload middleware to the route configuration
const apiRoutes = configureRoutes({
  uploadLimiter: uploadLimiter,
  checkAccessCode: checkAccessCode,
  multerUpload: multerUpload
});
app.use('/api', apiRoutes);

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
    
    const performanceData = await database.getPerformanceMetrics(tournamentId, req.userId);
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
// END OF COMMENTED OUT TOURNAMENT ROUTES */

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
    const blunder = await database.get(`
      SELECT bd.* FROM blunder_details bd
      JOIN games g ON bd.game_id = g.id
      WHERE bd.id = ? AND g.user_id = ?
    `, [blunderId, req.userId]) // UPDATED;
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
