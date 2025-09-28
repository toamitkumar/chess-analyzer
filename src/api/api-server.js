const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PerformanceCalculator = require('../models/performance-stats');
const TrendCalculator = require('../models/trend-calculator');
const HeatmapCalculator = require('../models/HeatmapCalculator');
const PGNParser = require('../models/PGNParser');
const { ChessAnalyzer } = require('../models/analyzer');
const { getDatabase } = require('../models/database');
const { getFileStorage } = require('../models/file-storage');

const app = express();
const port = 3000;

// Initialize database and file storage
let database = null;
let fileStorage = null;

async function initializeServices() {
  try {
    database = getDatabase();
    await database.initialize();
    
    fileStorage = getFileStorage();
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
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve static files from views directory
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb', type: 'text/plain' }));

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

      // Extract game metadata and calculate trends
      const games = pgnFiles.map(pgn => {
        const metadata = this.trendCalculator.extractGameMetadata(pgn);
        return {
          ...metadata,
          moves: [] // Would need actual move analysis for real data
        };
      });

      const ratingProgression = this.trendCalculator.calculateRatingProgression(games);
      const centipawnTrend = this.trendCalculator.calculateCentipawnLossTrend(games);

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

// API Routes
app.get('/api/performance', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const data = await performanceAPI.getPerformanceData();
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

app.post('/api/upload/pgn', upload.single('pgn'), async (req, res) => {
  try {
    let pgnContent;
    let originalFileName = 'uploaded.pgn';
    
    if (req.file) {
      // File uploaded via FormData
      pgnContent = fs.readFileSync(req.file.path, 'utf8');
      originalFileName = req.file.originalname || 'uploaded.pgn';
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
    } else {
      // Text content uploaded directly
      pgnContent = req.body;
    }
    
    if (!pgnContent || typeof pgnContent !== 'string') {
      return res.status(400).json({ error: 'No PGN content provided' });
    }

    const parser = new PGNParser();
    const validation = parser.validatePGN(pgnContent);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Store PGN file permanently
    let storedFilePath = null;
    if (fileStorage) {
      try {
        storedFilePath = await fileStorage.storePGNFile(pgnContent, originalFileName);
        console.log(`💾 PGN file stored: ${storedFilePath}`);
      } catch (error) {
        console.error('❌ Failed to store PGN file:', error.message);
      }
    }

    const parseResult = parser.parseFile(pgnContent);
    console.log(`📊 Starting analysis for ${parseResult.totalGames} games...`);
    
    // Initialize ChessAnalyzer for analysis
    const analyzer = new ChessAnalyzer();
    const analyzedGames = [];
    const analysisErrors = [];
    const storedGameIds = [];
    
    // Analyze and store each game
    for (let i = 0; i < parseResult.games.length; i++) {
      const game = parseResult.games[i];
      console.log(`🔍 Analyzing game ${i + 1}/${parseResult.games.length}: ${game.white} vs ${game.black}`);
      
      try {
        const analysis = await analyzer.analyzeGame(game.moves);
        
        const analyzedGame = {
          ...game,
          analysis: {
            accuracy: analysis.accuracy,
            blunders: analysis.blunders,
            centipawnLoss: analysis.averageCentipawnLoss,
            moveCount: analysis.totalMoves,
            fullAnalysis: analysis.analysis
          }
        };
        
        analyzedGames.push(analyzedGame);
        
        // Store game in database if available
        if (database) {
          try {
            const gameData = {
              pgnFilePath: storedFilePath || 'memory',
              whitePlayer: game.white || 'Unknown',
              blackPlayer: game.black || 'Unknown',
              result: game.result || '*',
              date: game.date || null,
              event: game.event || null,
              whiteElo: game.whiteElo ? parseInt(game.whiteElo) : null,
              blackElo: game.blackElo ? parseInt(game.blackElo) : null,
              movesCount: game.moves ? game.moves.length : 0
            };
            
            const gameResult = await database.insertGame(gameData);
            const gameId = gameResult.id;
            storedGameIds.push(gameId);
            
            // Store analysis data
            if (analysis.analysis && analysis.analysis.length > 0) {
              await database.insertAnalysis(gameId, analysis.analysis);
            }
            
            console.log(`💾 Game ${i + 1} stored in database with ID: ${gameId}`);
          } catch (dbError) {
            console.error(`❌ Database storage failed for game ${i + 1}:`, dbError.message);
          }
        }
        
        console.log(`✅ Game ${i + 1} analyzed - Accuracy: ${analysis.accuracy}%, Blunders: ${analysis.blunders.length}`);
      } catch (error) {
        console.error(`❌ Analysis failed for game ${i + 1}:`, error.message);
        analysisErrors.push(`Game ${i + 1}: ${error.message}`);
        
        // Still try to store the game without analysis
        if (database) {
          try {
            const gameData = {
              pgnFilePath: storedFilePath || 'memory',
              whitePlayer: game.white || 'Unknown',
              blackPlayer: game.black || 'Unknown',
              result: game.result || '*',
              date: game.date || null,
              event: game.event || null,
              whiteElo: game.whiteElo ? parseInt(game.whiteElo) : null,
              blackElo: game.blackElo ? parseInt(game.blackElo) : null,
              movesCount: game.moves ? game.moves.length : 0
            };
            
            const gameResult = await database.insertGame(gameData);
            storedGameIds.push(gameResult.id);
          } catch (dbError) {
            console.error(`❌ Database storage failed for game ${i + 1}:`, dbError.message);
          }
        }
        
        analyzedGames.push({
          ...game,
          analysis: null
        });
      }
    }
    
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
    }
    
    console.log(`🎯 Analysis complete: ${analyzedGames.filter(g => g.analysis).length}/${parseResult.totalGames} games analyzed`);
    console.log(`💾 Stored ${storedGameIds.length} games in database`);
    
    res.json({
      success: true,
      message: `Successfully imported and analyzed ${parseResult.totalGames} games`,
      gamesCount: parseResult.totalGames,
      totalGames: parseResult.totalGames,
      analyzedGames: analyzedGames.filter(g => g.analysis).length,
      storedGames: storedGameIds.length,
      storedFilePath: storedFilePath,
      games: analyzedGames.slice(0, 5), // Return first 5 games as preview
      errors: [...parseResult.errors, ...analysisErrors]
    });
  } catch (error) {
    console.error('PGN upload error:', error);
    res.status(500).json({ error: 'Failed to process PGN file' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

// Helper functions for cache updates
async function updatePerformanceCacheWithGames(analyzedGames) {
  try {
    const validGames = analyzedGames.filter(g => g.analysis);
    if (validGames.length === 0) return;
    
    const whiteGames = validGames.filter(g => g.result === '1-0' || g.result === '0-1' || g.result === '1/2-1/2');
    const blackGames = validGames.filter(g => g.result === '1-0' || g.result === '0-1' || g.result === '1/2-1/2');
    
    const whiteWins = validGames.filter(g => g.result === '1-0').length;
    const blackWins = validGames.filter(g => g.result === '0-1').length;
    
    const avgAccuracy = validGames.reduce((sum, g) => sum + g.analysis.accuracy, 0) / validGames.length;
    const totalBlunders = validGames.reduce((sum, g) => sum + g.analysis.blunders.length, 0);
    
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
      game.analysis.blunders.forEach(blunder => {
        // Extract square from move notation (simplified)
        const square = extractSquareFromMove(blunder.move);
        if (square) {
          if (!blunderSquares[square]) {
            blunderSquares[square] = { count: 0, severity: 0 };
          }
          blunderSquares[square].count++;
          blunderSquares[square].severity += Math.abs(blunder.evaluation || 100);
        }
      });
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

// Database-integrated API routes
app.get('/api/performance-db', async (req, res) => {
  try {
    console.log('📊 Database performance data requested');
    
    if (!database) {
      throw new Error('Database not initialized');
    }
    
    const performanceData = await database.getPerformanceMetrics();
    res.json(performanceData);
  } catch (error) {
    console.error('Database performance API error:', error);
    
    // Fallback to existing performance API
    const fallbackData = {
      white: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
      black: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
      overall: { avgAccuracy: 0, totalBlunders: 0 }
    };
    
    res.json(fallbackData);
  }
});

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
      WHERE is_blunder = 1 
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

app.get('/api/games', async (req, res) => {
  try {
    console.log('🎮 Games list requested');
    
    if (!database) {
      throw new Error('Database not initialized');
    }
    
    const games = await database.all(`
      SELECT 
        id, white_player, black_player, result, date, event,
        white_elo, black_elo, moves_count, created_at
      FROM games 
      ORDER BY created_at DESC 
      LIMIT 50
    `);
    
    res.json(games);
  } catch (error) {
    console.error('Games API error:', error);
    res.json([]);
  }
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
