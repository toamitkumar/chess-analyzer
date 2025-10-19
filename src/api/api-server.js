const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PerformanceCalculator = require('../models/performance-stats');
const TrendCalculator = require('../models/trend-calculator');
const HeatmapCalculator = require('../models/HeatmapCalculator');
const PGNParser = require('../models/PGNParser');
const ChessAnalyzer = require('../models/analyzer');
const { getDatabase } = require('../models/database');
const { getFileStorage } = require('../models/file-storage');
const { getTournamentManager } = require('../models/tournament-manager');
const { getTournamentAnalyzer } = require('../models/tournament-analyzer');

const app = express();
const port = 3000;

// Target player for performance metrics
const TARGET_PLAYER = 'AdvaitKumar1213';

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
      const trendGames = games.map(game => ({
        date: new Date(game.date || game.created_at),
        whiteElo: game.white_elo,
        blackElo: game.black_elo,
        result: game.result,
        avgCentipawnLoss: game.avgCentipawnLoss || 0,
        moveCount: game.moveCount || 0
      }));

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
              }
            }
            
            console.log(`💾 Game ${i + 1} stored in database with ID: ${gameId}, Tournament: ${tournament.name}`);
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

// Enhanced performance API with tournament filtering
app.get('/api/performance', async (req, res) => {
  try {
    const tournamentId = req.query.tournament ? parseInt(req.query.tournament) : null;
    console.log(`📊 Performance data requested${tournamentId ? ` for tournament ${tournamentId}` : ' (overall)'}`);
    
    if (tournamentId && tournamentAnalyzer) {
      // Get tournament-filtered performance
      const performanceData = await tournamentAnalyzer.getFilteredPerformance(tournamentId);
      res.json(performanceData);
    } else {
      // Get overall performance (existing logic)
      const performanceData = await database.getPerformanceMetrics();
      res.json(performanceData);
    }
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
        white_elo, black_elo, moves_count, created_at
      FROM games 
      WHERE tournament_id = ?
      ORDER BY created_at DESC
    `, [tournamentId]);
    
    res.json(games);
  } catch (error) {
    console.error('Tournament games API error:', error);
    res.json([]);
  }
});

// Database-integrated API routes
app.get('/api/performance-db', async (req, res) => {
  try {
    console.log('📊 Database performance data requested');
    
    if (!database) {
      throw new Error('Database not initialized');
    }
    
    const tournamentId = req.query.tournament ? parseInt(req.query.tournament) : null;
    console.log('📊 Tournament filter:', tournamentId);
    
    const performanceData = await database.getPerformanceMetrics(tournamentId);
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
    
    const data = games.map((game, index) => ({
      gameNumber: index + 1,
      rating: game.white_player === TARGET_PLAYER ? (game.white_elo || 1500) : (game.black_elo || 1500)
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
    
    const blunders = await database.all(`
      SELECT a.*, alt.alternative_move, alt.evaluation as alt_evaluation
      FROM analysis a
      LEFT JOIN alternative_moves alt ON a.game_id = alt.game_id AND a.move_number = alt.move_number
      WHERE a.game_id = ? AND a.is_blunder = 1
      ORDER BY a.move_number
    `, [gameId]);
    
    res.json(blunders);
  } catch (error) {
    console.error('Blunders API error:', error);
    res.status(500).json({ error: error.message });
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
