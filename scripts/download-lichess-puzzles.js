const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cliProgress = require('cli-progress');

/**
 * Download Lichess puzzle database
 * URL: https://database.lichess.org/lichess_db_puzzle.csv.bz2
 * Size: ~1.5GB compressed
 * Format: CSV (bzip2 compressed)
 */

const LICHESS_PUZZLE_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.bz2';
const DATA_DIR = path.join(__dirname, '../data');
const OUTPUT_FILE = path.join(DATA_DIR, 'lichess_puzzles.csv.bz2');

async function downloadPuzzles() {
  console.log('📥 Downloading Lichess puzzle database...');
  console.log(`   Source: ${LICHESS_PUZZLE_URL}`);
  console.log(`   Destination: ${OUTPUT_FILE}`);
  console.log('');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Check if file already exists
  if (fs.existsSync(OUTPUT_FILE)) {
    const stats = fs.statSync(OUTPUT_FILE);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`⚠️  File already exists (${sizeMB} MB)`);
    console.log(`   ${OUTPUT_FILE}`);

    // Ask if user wants to re-download
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      readline.question('   Re-download? (y/N): ', resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('✅ Using existing file');
      return;
    }

    console.log('   Deleting existing file...');
    fs.unlinkSync(OUTPUT_FILE);
  }

  try {
    // Start download with progress bar
    const response = await axios({
      url: LICHESS_PUZZLE_URL,
      method: 'GET',
      responseType: 'stream',
      timeout: 300000, // 5 minutes timeout
      onDownloadProgress: null // Will set up below
    });

    const totalBytes = parseInt(response.headers['content-length'], 10);
    const totalMB = (totalBytes / 1024 / 1024).toFixed(2);

    console.log(`   File size: ${totalMB} MB`);
    console.log('');

    // Create progress bar
    const progressBar = new cliProgress.SingleBar({
      format: '   Downloading |{bar}| {percentage}% | {value}/{total} MB | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });

    progressBar.start(parseInt(totalMB), 0);

    // Track downloaded bytes
    let downloadedBytes = 0;

    // Pipe response to file
    const writer = fs.createWriteStream(OUTPUT_FILE);

    response.data.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
      progressBar.update(parseFloat(downloadedMB));
    });

    response.data.pipe(writer);

    // Wait for download to complete
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.on('error', reject);
    });

    progressBar.stop();

    // Verify file size
    const stats = fs.statSync(OUTPUT_FILE);
    const actualMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log('');
    console.log(`✅ Download complete: ${actualMB} MB`);
    console.log(`   Saved to: ${OUTPUT_FILE}`);

    // Calculate checksum for verification (optional)
    console.log('');
    console.log('💡 Next step: Run the import script');
    console.log('   npm run import-puzzle-index');

  } catch (error) {
    console.error('');
    console.error('❌ Download failed:', error.message);

    if (error.code === 'ECONNABORTED') {
      console.error('   Connection timeout. Please try again.');
    } else if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
    }

    // Clean up partial download
    if (fs.existsSync(OUTPUT_FILE)) {
      fs.unlinkSync(OUTPUT_FILE);
      console.error('   Partial file deleted');
    }

    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  downloadPuzzles().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = downloadPuzzles;
