#!/usr/bin/env node
/**
 * scripts/prepare-stockfish.js
 *
 * Downloads the Stockfish 18 binary for macOS and places it in electron/bin/.
 * Run this before building the Electron DMG:
 *
 *   make prepare-stockfish
 *   make dmg
 *
 * For arm64 (Apple Silicon) and x86-64 (Intel) — creates a universal binary
 * via `lipo` if both are available, otherwise uses whichever is present.
 */

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { createGunzip } = require('zlib');

const STOCKFISH_VERSION = 'sf_18';
const BIN_DIR = path.join(__dirname, '../electron/bin');
const RELEASES_BASE = `https://github.com/official-stockfish/Stockfish/releases/download/${STOCKFISH_VERSION}`;

const TARGETS = [
  {
    name: 'arm64',
    tarUrl: `${RELEASES_BASE}/stockfish-macos-m1-apple-silicon.tar`,
    binaryInTar: 'stockfish/stockfish-macos-m1-apple-silicon',
    outFile: path.join(BIN_DIR, 'stockfish-arm64'),
  },
  {
    name: 'x86-64',
    tarUrl: `${RELEASES_BASE}/stockfish-macos-x86-64-avx2.tar`,
    binaryInTar: 'stockfish/stockfish-macos-x86-64-avx2',
    outFile: path.join(BIN_DIR, 'stockfish-x64'),
  },
];

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;

    const request = (targetUrl) => {
      protocol.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          request(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`));
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        res.on('data', (chunk) => {
          received += chunk.length;
          if (total) {
            const pct = Math.round((received / total) * 100);
            process.stdout.write(`\r  ${pct}% (${(received / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB)`);
          }
        });
        res.pipe(file);
        file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve(); });
      }).on('error', reject);
    };

    request(url);
    file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
  });
}

function extractFromTar(tarPath, memberPath, outPath) {
  // Use system tar — available on all macOS versions
  const result = spawnSync('tar', ['-xf', tarPath, '-O', memberPath], { maxBuffer: 200 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`tar exited ${result.status}: ${result.stderr.toString()}`);
  fs.writeFileSync(outPath, result.stdout);
  fs.chmodSync(outPath, 0o755);
}

async function prepareTarget(target) {
  if (fs.existsSync(target.outFile)) {
    console.log(`  ✅  ${target.name} binary already present, skipping download.`);
    return;
  }

  const tmpTar = path.join(BIN_DIR, `_tmp_${target.name}.tar`);
  console.log(`  ⬇️   Downloading Stockfish ${STOCKFISH_VERSION} (${target.name})...`);
  console.log(`       ${target.tarUrl}`);

  try {
    await download(target.tarUrl, tmpTar);
    console.log(`  📦  Extracting ${target.binaryInTar}...`);
    extractFromTar(tmpTar, target.binaryInTar, target.outFile);
    console.log(`  ✅  ${target.name} binary ready: ${target.outFile}`);
  } finally {
    if (fs.existsSync(tmpTar)) fs.unlinkSync(tmpTar);
  }
}

function makeUniversal() {
  const arm64 = path.join(BIN_DIR, 'stockfish-arm64');
  const x64 = path.join(BIN_DIR, 'stockfish-x64');
  const universal = path.join(BIN_DIR, 'stockfish');

  if (fs.existsSync(arm64) && fs.existsSync(x64)) {
    console.log('\n  🔗  Creating universal binary via lipo...');
    const result = spawnSync('lipo', ['-create', '-output', universal, arm64, x64]);
    if (result.error || result.status !== 0) {
      console.warn('  ⚠️   lipo failed, copying arm64 as fallback.');
      fs.copyFileSync(arm64, universal);
    } else {
      console.log('  ✅  Universal binary created.');
    }
  } else if (fs.existsSync(arm64)) {
    console.log('\n  ℹ️   Only arm64 available — copying as stockfish.');
    fs.copyFileSync(arm64, universal);
  } else if (fs.existsSync(x64)) {
    console.log('\n  ℹ️   Only x64 available — copying as stockfish.');
    fs.copyFileSync(x64, universal);
  }

  if (fs.existsSync(universal)) {
    fs.chmodSync(universal, 0o755);
    const info = spawnSync('file', [universal]);
    console.log(`  ${info.stdout.toString().trim()}`);
  }
}

async function main() {
  console.log('\n🎯  Preparing Stockfish binaries for Electron DMG...\n');
  fs.mkdirSync(BIN_DIR, { recursive: true });

  for (const target of TARGETS) {
    console.log(`\n── ${target.name} ──────────────────────────────────────`);
    try {
      await prepareTarget(target);
    } catch (err) {
      console.warn(`  ⚠️   Failed to prepare ${target.name}: ${err.message}`);
    }
  }

  makeUniversal();
  console.log('\n✅  Stockfish preparation complete.\n');
}

main().catch((err) => { console.error('❌', err.message); process.exit(1); });
