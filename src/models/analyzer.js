const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');
const Stockfish = require('stockfish');

class ChessAnalyzer {
  constructor() {
    this.engine = Stockfish();
    this.isReady = false;
    this.setupEngine();
  }

  setupEngine() {
    this.engine.postMessage('uci');
    
    this.engine.onmessage = (line) => {
      if (line === 'uciok') {
        this.isReady = true;
        console.log('Stockfish engine ready');
      }
    };
  }

  async analyzePGN(pgnContent, depth = 15) {
    const chess = new Chess();
    
    try {
      chess.loadPgn(pgnContent);
    } catch (error) {
      throw new Error(`Invalid PGN: ${error.message}`);
    }

    const moves = chess.history({ verbose: true });
    const analysis = [];
    
    // Reset to starting position
    chess.reset();
    
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const evaluation = await this.evaluatePosition(chess.fen(), depth);
      
      analysis.push({
        moveNumber: Math.ceil((i + 1) / 2),
        move: move.san,
        fen: chess.fen(),
        evaluation: evaluation
      });
      
      chess.move(move);
    }
    
    return analysis;
  }

  evaluatePosition(fen, depth) {
    return new Promise((resolve) => {
      let bestMove = null;
      let evaluation = null;
      
      const messageHandler = (line) => {
        if (line.startsWith('bestmove')) {
          bestMove = line.split(' ')[1];
        }
        
        if (line.startsWith('info') && line.includes('score')) {
          const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
          if (scoreMatch) {
            if (scoreMatch[1] === 'cp') {
              evaluation = parseInt(scoreMatch[2]) / 100; // Convert centipawns to pawns
            } else {
              evaluation = scoreMatch[2].startsWith('-') ? -1000 : 1000; // Mate
            }
          }
        }
        
        if (bestMove && evaluation !== null) {
          this.engine.onmessage = () => {}; // Clear handler
          resolve({ bestMove, evaluation });
        }
      };
      
      this.engine.onmessage = messageHandler;
      this.engine.postMessage(`position fen ${fen}`);
      this.engine.postMessage(`go depth ${depth}`);
    });
  }

  async analyzeFile(filePath, depth = 15) {
    const pgnContent = fs.readFileSync(filePath, 'utf8');
    console.log(`Analyzing ${path.basename(filePath)}...`);
    
    const analysis = await this.analyzePGN(pgnContent, depth);
    
    const outputPath = filePath.replace('.pgn', '_analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
    
    console.log(`Analysis saved to ${outputPath}`);
    return analysis;
  }
}

// CLI usage
async function main(args = process.argv.slice(2)) {
  if (args.length === 0) {
    console.log('Usage: node analyzer.js <pgn-file> [depth]');
    console.log('Example: node analyzer.js game.pgn 15');
    process.exit(1);
  }
  
  const filePath = args[0];
  const depth = parseInt(args[1]) || 15;
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  const analyzer = new ChessAnalyzer();
  
  // Wait for engine to be ready
  while (!analyzer.isReady) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  try {
    await analyzer.analyzeFile(filePath, depth);
  } catch (error) {
    console.error('Analysis failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ChessAnalyzer, main };
