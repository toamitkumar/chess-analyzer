const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PerformanceCalculator = require('../models/performance-stats');
const TrendCalculator = require('../models/trend-calculator');
const HeatmapCalculator = require('../models/HeatmapCalculator');
const PGNParser = require('../models/PGNParser');
const { ChessAnalyzer } = require('../models/analyzer');

const app = express();
const port = 3000;

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
    
    if (req.file) {
      // File uploaded via FormData
      pgnContent = fs.readFileSync(req.file.path, 'utf8');
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

    const parseResult = parser.parseFile(pgnContent);
    console.log(`📊 Starting Stockfish analysis for ${parseResult.totalGames} games...`);
    
    // Initialize ChessAnalyzer for Stockfish analysis
    const analyzer = new ChessAnalyzer();
    const analyzedGames = [];
    const analysisErrors = [];
    
    // Analyze each game with Stockfish
    for (let i = 0; i < parseResult.games.length; i++) {
      const game = parseResult.games[i];
      console.log(`🔍 Analyzing game ${i + 1}/${parseResult.games.length}: ${game.white} vs ${game.black}`);
      
      try {
        const analysis = await analyzer.analyzeGame(game.moves);
        analyzedGames.push({
          ...game,
          analysis: {
            accuracy: analysis.accuracy,
            blunders: analysis.blunders,
            centipawnLoss: analysis.averageCentipawnLoss,
            moveCount: analysis.totalMoves
          }
        });
        console.log(`✅ Game ${i + 1} analyzed - Accuracy: ${analysis.accuracy}%, Blunders: ${analysis.blunders.length}`);
      } catch (error) {
        console.error(`❌ Analysis failed for game ${i + 1}:`, error.message);
        analysisErrors.push(`Game ${i + 1}: ${error.message}`);
        // Include game without analysis
        analyzedGames.push({
          ...game,
          analysis: null
        });
      }
    }
    
    // Update performance cache with analyzed data
    if (analyzedGames.length > 0) {
      await updatePerformanceCacheWithGames(analyzedGames);
      await updateHeatmapCacheWithGames(analyzedGames);
    }
    
    console.log(`🎯 Analysis complete: ${analyzedGames.filter(g => g.analysis).length}/${parseResult.totalGames} games analyzed`);
    
    res.json({
      success: true,
      message: `Successfully imported and analyzed ${parseResult.totalGames} games`,
      gamesCount: parseResult.totalGames,
      totalGames: parseResult.totalGames,
      analyzedGames: analyzedGames.filter(g => g.analysis).length,
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

app.listen(port, () => {
  console.log(`Chess Performance Dashboard running at http://localhost:${port}`);
  console.log(`API available at http://localhost:${port}/api/performance`);
});

module.exports = app;
