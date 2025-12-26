/**
 * Test Stockfish determinism
 * Run the same position twice and verify identical results
 */

const { spawn } = require('child_process');

async function testStockfish() {
  const results = [];

  for (let run = 1; run <= 2; run++) {
    console.log(`\n=== Run ${run} ===`);

    const engine = spawn('stockfish');
    let output = '';

    const result = await new Promise((resolve) => {
      engine.stdout.on('data', (data) => {
        output += data.toString();

        if (output.includes('uciok')) {
          console.log('Setting deterministic options...');
          engine.stdin.write('setoption name Threads value 1\n');
          engine.stdin.write('setoption name Hash value 128\n');
          engine.stdin.write('isready\n');
        }

        if (output.includes('readyok') && !output.includes('position')) {
          console.log('Engine ready, starting analysis...');
          engine.stdin.write('ucinewgame\n');
          engine.stdin.write('setoption name Clear Hash\n');
          engine.stdin.write('isready\n');
        }

        if (output.split('readyok').length > 1 && !output.includes('position')) {
          console.log('Analyzing position...');
          // Starting position after 1.e4
          engine.stdin.write('position startpos moves e2e4\n');
          engine.stdin.write('go depth 12\n');
        }

        if (output.includes('bestmove')) {
          // Extract the final evaluation
          const lines = output.split('\n');
          let finalEval = null;
          let depth = null;

          for (const line of lines) {
            if (line.includes('depth 12') && line.includes('score cp')) {
              const match = line.match(/score cp (-?\d+)/);
              if (match) {
                finalEval = parseInt(match[1]);
                depth = 12;
              }
            }
          }

          engine.kill();
          resolve({ finalEval, depth });
        }
      });

      engine.stdin.write('uci\n');

      setTimeout(() => {
        engine.kill();
        resolve({ finalEval: null, depth: null, error: 'Timeout' });
      }, 10000);
    });

    console.log(`Result: evaluation=${result.finalEval}, depth=${result.depth}`);
    results.push(result);
  }

  console.log('\n=== COMPARISON ===');
  console.log(`Run 1: ${results[0].finalEval}`);
  console.log(`Run 2: ${results[1].finalEval}`);

  if (results[0].finalEval === results[1].finalEval) {
    console.log('✅ DETERMINISTIC: Results are identical');
  } else {
    console.log(`❌ NON-DETERMINISTIC: Difference of ${Math.abs(results[0].finalEval - results[1].finalEval)} centipawns`);
  }
}

testStockfish().catch(console.error);
