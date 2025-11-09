const { spawn } = require('child_process');
const { Chess } = require('chess.js');

class StockfishAnalyzer {
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
          console.log('✅ Stockfish initialized');
          resolve();
        }
      });
    });
  }

  async evaluatePosition(fen, depth = 12) {
    return new Promise((resolve) => {
      let bestMove = '';
      let evaluation = 0;
      let resolved = false;

      const dataHandler = (data) => {
        const output = data.toString();
        
        // Parse best move
        if (output.includes('bestmove')) {
          const match = output.match(/bestmove (\w+)/);
          if (match) bestMove = match[1];
        }
        
        // Parse evaluation
        if (output.includes('info depth') && output.includes('score')) {
          const lines = output.split('\n');
          for (const line of lines) {
            if (line.includes(`depth ${depth}`) && line.includes('score')) {
              if (line.includes('score cp')) {
                const match = line.match(/score cp (-?\d+)/);
                if (match) evaluation = parseInt(match[1]);
              } else if (line.includes('score mate')) {
                const match = line.match(/score mate (-?\d+)/);
                if (match) {
                  const mateIn = parseInt(match[1]);
                  evaluation = mateIn > 0 ? 10000 - mateIn * 100 : -10000 - mateIn * 100;
                }
              }
              
              if (!resolved) {
                this.engine.stdout.removeListener('data', dataHandler);
                resolved = true;
                resolve({ bestMove, evaluation });
              }
              return;
            }
          }
        }
      };

      this.engine.stdout.on('data', dataHandler);
      this.engine.stdin.write(`position fen ${fen}\n`);
      this.engine.stdin.write(`go depth ${depth}\n`);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!resolved) {
          this.engine.stdout.removeListener('data', dataHandler);
          resolved = true;
          resolve({ bestMove: bestMove || 'e4', evaluation });
        }
      }, 10000);
    });
  }

  calculateCentipawnLoss(beforeEval, afterEval, isWhiteMove) {
    // Convert evaluations to white's perspective (same as your analyzer)
    const before = isWhiteMove ? beforeEval : -beforeEval;
    const after = isWhiteMove ? afterEval : -afterEval;
    
    // Centipawn loss is the difference (should be positive for loss)
    const loss = Math.max(0, before - after);
    return Math.round(loss);
  }

  async analyzePGN(pgnContent) {
    const chess = new Chess();
    const moves = pgnContent.match(/\d+\.\s*([a-zA-Z0-9+#=\-]+)\s*([a-zA-Z0-9+#=\-]+)?/g);
    
    if (!moves) {
      console.log('❌ No moves found in PGN');
      return;
    }

    console.log('🔍 Analyzing game with Stockfish...\n');
    
    const analysis = [];
    let totalCPL = 0;
    let moveCount = 0;

    for (let i = 0; i < moves.length; i++) {
      const moveMatch = moves[i].match(/\d+\.\s*([a-zA-Z0-9+#=\-]+)\s*([a-zA-Z0-9+#=\-]+)?/);
      if (!moveMatch) continue;

      const whiteMove = moveMatch[1];
      const blackMove = moveMatch[2];

      // Analyze white move
      if (whiteMove) {
        const beforeFen = chess.fen();
        const beforeEval = await this.evaluatePosition(beforeFen, 12);
        
        try {
          chess.move(whiteMove);
          const afterFen = chess.fen();
          const afterEval = await this.evaluatePosition(afterFen, 12);
          
          const cpl = this.calculateCentipawnLoss(beforeEval.evaluation, afterEval.evaluation, true);
          const cappedCPL = Math.min(cpl, 500);
          
          analysis.push({
            moveNumber: i + 1,
            player: 'White',
            move: whiteMove,
            beforeEval: beforeEval.evaluation,
            afterEval: afterEval.evaluation,
            cpl: cappedCPL,
            isBlunder: cappedCPL > 150
          });
          
          totalCPL += cappedCPL;
          moveCount++;
          
          console.log(`${i + 1}. ${whiteMove} - CPL: ${cappedCPL} (${beforeEval.evaluation} → ${afterEval.evaluation})`);
        } catch (error) {
          console.log(`❌ Invalid white move: ${whiteMove}`);
          break;
        }
      }

      // Analyze black move
      if (blackMove) {
        const beforeFen = chess.fen();
        const beforeEval = await this.evaluatePosition(beforeFen, 12);
        
        try {
          chess.move(blackMove);
          const afterFen = chess.fen();
          const afterEval = await this.evaluatePosition(afterFen, 12);
          
          const cpl = this.calculateCentipawnLoss(beforeEval.evaluation, afterEval.evaluation, false);
          const cappedCPL = Math.min(cpl, 500);
          
          analysis.push({
            moveNumber: i + 1,
            player: 'Black',
            move: blackMove,
            beforeEval: beforeEval.evaluation,
            afterEval: afterEval.evaluation,
            cpl: cappedCPL,
            isBlunder: cappedCPL > 150
          });
          
          // Only count AdvaitKumar1213's moves (Black in this game)
          totalCPL += cappedCPL;
          moveCount++;
          
          console.log(`${i + 1}... ${blackMove} - CPL: ${cappedCPL} (${beforeEval.evaluation} → ${afterEval.evaluation})`);
        } catch (error) {
          console.log(`❌ Invalid black move: ${blackMove}`);
          break;
        }
      }
    }

    const avgCPL = moveCount > 0 ? totalCPL / moveCount : 0;
    const blackMoves = analysis.filter(a => a.player === 'Black');
    const blackCPL = blackMoves.length > 0 ? blackMoves.reduce((sum, m) => sum + m.cpl, 0) / blackMoves.length : 0;
    
    console.log('\n📊 Analysis Summary:');
    console.log(`Total moves analyzed: ${moveCount}`);
    console.log(`Average CPL (all moves): ${avgCPL.toFixed(2)}`);
    console.log(`AdvaitKumar1213 (Black) average CPL: ${blackCPL.toFixed(2)}`);
    console.log(`Black moves with blunders: ${blackMoves.filter(m => m.isBlunder).length}`);
    
    return { analysis, avgCPL: blackCPL, totalMoves: blackMoves.length };
  }

  destroy() {
    if (this.engine) {
      this.engine.kill();
    }
  }
}

// Run the analysis
async function main() {
  const analyzer = new StockfishAnalyzer();
  
  try {
    await analyzer.initialize();
    
    const pgnContent = `[Event "National-Open-U13-2025"]
[Date "2025.09.04"]
[White "Vihaan, Shetty"]
[Black "AdvaitKumar1213"]
[Result "0-1"]
[WhiteElo "0"]
[BlackElo "1471"]
[Variant "Standard"]
[TimeControl "90+30"]
[ECO "C25"]
[Termination "Normal"]

1. d4 d5 2. Nc3 c5 3. dxc5 Nf6 4. Bf4 Nc6 5. Nb5 e5 6. Bg3 Qa5+ 7. Nc3 d4 8. b4 Qxb4 9. a3 Qxc3+ 10. Qd2 Qxa1+ 11. Qd1 Qxa3 12. e3 Bxc5 13. exd4 Bb4+ 14. Ke2 Nxd4+ 15. Qxd4 exd4 16. Nf3 O-O 17. Nxd4 Re8+ 18. Ne6 Rxe6+ 19. Be5 Rxe5+ 20. Kd1 Re1#`;

    await analyzer.analyzePGN(pgnContent);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    analyzer.destroy();
  }
}

main();
