const { Chess } = require('chess.js');
const { spawn } = require('child_process');

// Simple manual analysis of key moves from the PGN
const moves = [
  'd4', 'd5', 'Nc3', 'c5', 'dxc5', 'Nf6', 'Bf4', 'Nc6', 'Nb5', 'e5',
  'Bg3', 'Qa5+', 'Nc3', 'd4', 'b4', 'Qxb4', 'a3', 'Qxc3+', 'Qd2', 'Qxa1+',
  'Qd1', 'Qxa3', 'e3', 'Bxc5', 'exd4', 'Bb4+', 'Ke2', 'Nxd4+', 'Qxd4', 'exd4',
  'Nf3', 'O-O', 'Nxd4', 'Re8+', 'Ne6', 'Rxe6+', 'Be5', 'Rxe5+', 'Kd1', 'Re1#'
];

class SimpleAnalyzer {
  constructor() {
    this.engine = null;
  }

  async initialize() {
    return new Promise((resolve) => {
      this.engine = spawn('stockfish');
      this.engine.stdin.write('uci\n');
      this.engine.stdin.write('isready\n');
      
      this.engine.stdout.on('data', (data) => {
        if (data.toString().includes('readyok')) {
          console.log('✅ Stockfish ready');
          resolve();
        }
      });
    });
  }

  async evaluatePosition(fen, depth = 12) {
    return new Promise((resolve) => {
      let evaluation = 0;
      let resolved = false;

      const dataHandler = (data) => {
        const output = data.toString();
        
        if (output.includes('info depth') && output.includes('score')) {
          const lines = output.split('\n');
          for (const line of lines) {
            if (line.includes(`depth ${depth}`) && line.includes('score cp')) {
              const match = line.match(/score cp (-?\d+)/);
              if (match) {
                evaluation = parseInt(match[1]);
                if (!resolved) {
                  this.engine.stdout.removeListener('data', dataHandler);
                  resolved = true;
                  resolve(evaluation);
                }
                return;
              }
            }
          }
        }
      };

      this.engine.stdout.on('data', dataHandler);
      this.engine.stdin.write(`position fen ${fen}\n`);
      this.engine.stdin.write(`go depth ${depth}\n`);
      
      setTimeout(() => {
        if (!resolved) {
          this.engine.stdout.removeListener('data', dataHandler);
          resolved = true;
          resolve(evaluation);
        }
      }, 5000);
    });
  }

  calculateCPL(beforeEval, afterEval, isWhiteMove) {
    const before = isWhiteMove ? beforeEval : -beforeEval;
    const after = isWhiteMove ? afterEval : -afterEval;
    return Math.max(0, before - after);
  }

  async analyzeGame() {
    const chess = new Chess();
    console.log('🔍 Analyzing AdvaitKumar1213 (Black) moves...\n');
    
    let blackCPL = 0;
    let blackMoves = 0;
    
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const isWhiteMove = i % 2 === 0;
      
      // Get position before move
      const beforeFen = chess.fen();
      const beforeEval = await this.evaluatePosition(beforeFen);
      
      try {
        chess.move(move);
        const afterFen = chess.fen();
        const afterEval = await this.evaluatePosition(afterFen);
        
        const cpl = this.calculateCPL(beforeEval, afterEval, isWhiteMove);
        const cappedCPL = Math.min(cpl, 500);
        
        if (!isWhiteMove) { // Black moves (AdvaitKumar1213)
          blackCPL += cappedCPL;
          blackMoves++;
          console.log(`Move ${Math.ceil((i+1)/2)}... ${move}: CPL = ${cappedCPL} (${beforeEval} → ${afterEval})`);
        } else {
          console.log(`Move ${Math.ceil((i+1)/2)}. ${move}: CPL = ${cappedCPL} (${beforeEval} → ${afterEval}) [White]`);
        }
        
      } catch (error) {
        console.log(`❌ Invalid move: ${move}`);
        break;
      }
    }
    
    const avgBlackCPL = blackMoves > 0 ? blackCPL / blackMoves : 0;
    
    console.log('\n📊 Results:');
    console.log(`AdvaitKumar1213 (Black) moves analyzed: ${blackMoves}`);
    console.log(`Total CPL for Black: ${blackCPL}`);
    console.log(`Average CPL for AdvaitKumar1213: ${avgBlackCPL.toFixed(2)}`);
    
    return avgBlackCPL;
  }

  destroy() {
    if (this.engine) {
      this.engine.kill();
    }
  }
}

async function main() {
  const analyzer = new SimpleAnalyzer();
  
  try {
    await analyzer.initialize();
    await analyzer.analyzeGame();
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    analyzer.destroy();
  }
}

main();
