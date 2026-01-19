// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const HeatmapCalculator = require('../models/HeatmapCalculator');
const { getDatabase } = require('../models/database');
const { getFileStorage } = require('../models/file-storage');
const { getTournamentManager } = require('../models/tournament-manager');
const { getTournamentAnalyzer } = require('../models/tournament-analyzer');
const { API_CONFIG } = require('../config/app-config');
const { checkAccessCode } = require('../middleware/access-code');
const { requireAuth } = require('../middleware/supabase-auth');

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

// Initialize database, file storage, tournament manager, analyzer, and shared Stockfish instance
let database = null;
let fileStorage = null;
let tournamentManager = null;
let tournamentAnalyzer = null;
let sharedAnalyzer = null;

async function initializeServices() {
  try {
    database = getDatabase();
    await database.initialize();

    fileStorage = getFileStorage();

    tournamentManager = getTournamentManager();
    await tournamentManager.initialize();

    tournamentAnalyzer = getTournamentAnalyzer();
    await tournamentAnalyzer.initialize();

    // Initialize shared Stockfish analyzer (SINGLETON)
    console.log('🔧 Initializing shared Stockfish engine...');
    const ChessAnalyzer = require('../models/analyzer');
    sharedAnalyzer = new ChessAnalyzer();

    // Wait for Stockfish to be ready
    await new Promise((resolve) => {
      const checkReady = () => {
        if (sharedAnalyzer.isReady) {
          console.log('✅ Shared Stockfish engine ready');
          resolve();
        } else {
          setTimeout(checkReady, 200);
        }
      };

      // Timeout after 60 seconds (some machines need more time)
      setTimeout(() => {
        console.log('⚠️ Stockfish initialization timeout after 60s, server will continue but analysis may fail');
        resolve();
      }, 60000);

      checkReady();
    });

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
// Require authentication for all API endpoints except health check
app.use('/api/health', (req, res, next) => next()); // Skip auth for health check
app.use('/api/*', requireAuth);

// NOTE: API routes are configured AFTER services initialize in startServer()
// This ensures sharedAnalyzer is ready before routes are created

// Performance data cache
let performanceCache = null;
let performanceCacheTimestamp = null;


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

// Trends API endpoints
app.get('/api/trends/rating', async (req, res) => {
  try {
    const tournamentId = req.query.tournament ? parseInt(req.query.tournament) : null;
    const userId = req.userId;

    const games = await database.all(`
      SELECT g.id, g.date, g.white_elo, g.black_elo, g.user_color
      FROM games g
      WHERE g.user_id = ? ${tournamentId ? 'AND g.tournament_id = ?' : ''}
      ORDER BY g.date ASC
    `, tournamentId ? [userId, tournamentId] : [userId]);

    // Filter games with actual ratings and track rating progression
    const ratedGames = games.filter(game => {
      const playerRating = game.user_color === 'white' ? game.white_elo : game.black_elo;
      return playerRating && playerRating > 0;
    });

    const data = ratedGames.map((game, index) => ({
      gameNumber: index + 1,
      rating: game.user_color === 'white' ? game.white_elo : game.black_elo,
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
    const userId = req.userId;

    const games = await database.all(`
      SELECT g.id, AVG(a.centipawn_loss) as avg_centipawn_loss
      FROM games g
      JOIN analysis a ON g.id = a.game_id
      WHERE g.user_id = ? ${tournamentId ? 'AND g.tournament_id = ?' : ''}
      GROUP BY g.id
      ORDER BY g.date ASC
    `, tournamentId ? [userId, tournamentId] : [userId]);

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
    const pathGenerator = new LearningPathGenerator(database, req.userId);
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
    const { linkPuzzlesToBlunders } = require('../models/puzzle-blunder-linker');
    const pathGenerator = new LearningPathGenerator(database, req.userId);
    
    let recommendations;
    if (enhanced === 'true') {
      recommendations = await pathGenerator.generateEnhancedRecommendations({
        limit: parseInt(limit),
        playerRating: parseInt(rating)
      });
    } else {
      recommendations = await pathGenerator.generateRecommendations({
        limit: parseInt(limit),
        playerRating: parseInt(rating)
      });
    }

    // Auto-link recommended puzzles to blunders with matching themes
    await linkPuzzlesToBlunders(database, recommendations, req.userId);

    res.json(enhanced === 'true' ? recommendations : { recommendations });
  } catch (error) {
    console.error('[API] Error getting recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// GET /api/learning-path/daily-goals - Get daily goals
app.get('/api/learning-path/daily-goals', async (req, res) => {
  try {
    const LearningPathGenerator = require('../models/learning-path-generator');
    const pathGenerator = new LearningPathGenerator(database, req.userId);
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
    const pathGenerator = new LearningPathGenerator(database, req.userId);
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
    const pathGenerator = new LearningPathGenerator(database, req.userId);
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
    const pathGenerator = new LearningPathGenerator(database, req.userId);
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
    const pathGenerator = new LearningPathGenerator(database, req.userId);
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
    const progressTracker = new PuzzleProgressTracker(database, req.userId);
    
    const progress = await progressTracker.recordAttempt(puzzleId, {
      solved: Boolean(solved),
      timeSpent: parseInt(timeSpent) || 0,
      movesCount: parseInt(movesCount) || 0,
      hintsUsed: parseInt(hintsUsed) || 0
    });

    // If solved, update linked blunders' learned status
    if (solved) {
      const { markLinkedBlundersLearned } = require('../models/puzzle-blunder-linker');
      await markLinkedBlundersLearned(database, puzzleId);
    }

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
    const progressTracker = new PuzzleProgressTracker(database, req.userId);
    
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
    const progressTracker = new PuzzleProgressTracker(database, req.userId);
    
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
    const progressTracker = new PuzzleProgressTracker(database, req.userId);
    const statistics = await progressTracker.getStatistics();
    res.json(statistics);
  } catch (error) {
    console.error('[API] Error getting puzzle statistics:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// NOTE: Catch-all route moved inside startServer() to ensure it's registered AFTER API routes

// Initialize services and start server
async function startServer() {
  try {
    await initializeServices();

    // Configure and mount API routes AFTER services are initialized
    // This ensures sharedAnalyzer is ready when routes are created
    console.log('🔧 Configuring API routes with shared analyzer...');
    const apiRoutes = configureRoutes({
      uploadLimiter: uploadLimiter,
      checkAccessCode: checkAccessCode,
      multerUpload: multerUpload,
      sharedAnalyzer: () => sharedAnalyzer  // Now sharedAnalyzer is initialized!
    });
    app.use('/api', apiRoutes);
    console.log('✅ API routes configured');

    // Serve Angular app for all non-API routes (MUST BE LAST)
    app.get('*', (req, res) => {
      // Only serve Angular for non-API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      res.sendFile(path.join(__dirname, '../../frontend/dist/chess-analyzer/index-angular.html'));
    });
    console.log('✅ Catch-all route configured');

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
        if (sharedAnalyzer) {
          console.log('🔒 Closing shared Stockfish engine...');
          await sharedAnalyzer.close();
        }
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
