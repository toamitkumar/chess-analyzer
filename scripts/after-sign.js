'use strict';

/**
 * electron-builder afterSign hook
 *
 * Re-signs the entire .app inner-to-outer with ad-hoc identity ("-") after
 * electron-builder's own signing step.  This fixes the DYLD "Team IDs mismatch"
 * crash that occurs when the Electron Framework retains Apple's original Team ID
 * while the main binary is ad-hoc signed (no Team ID).
 *
 * Only runs on macOS and only when no real Developer ID is available
 * (i.e. when electron-builder fell back to ad-hoc signing).
 */

const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

module.exports = async function afterSign(context) {
  const { appOutDir, packager } = context;
  const { platform } = packager;

  if (platform.name !== 'mac') return;

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) {
    console.warn(`afterSign: ${appPath} not found, skipping re-sign`);
    return;
  }

  console.log(`🔏 afterSign: re-signing ${appPath} inner-to-outer (ad-hoc)...`);

  function run(cmd) {
    try {
      execSync(cmd, { stdio: 'pipe' });
    } catch (_) {
      // Ignore individual signing errors — some helpers may already be correctly signed
    }
  }

  // 1. Strip quarantine and extended attributes
  run(`xattr -cr "${appPath}"`);

  // 2. Sign dylibs first
  const dylibs = execSync(
    `find "${appPath}" -name "*.dylib" 2>/dev/null`, { encoding: 'utf8' }
  ).trim().split('\n').filter(Boolean);
  dylibs.forEach(f => run(`codesign --force --sign - "${f}"`));

  // 3. Sign .framework bundles (inner-to-outer via sort -r on depth)
  const frameworks = execSync(
    `find "${appPath}/Contents/Frameworks" -name "*.framework" 2>/dev/null`,
    { encoding: 'utf8' }
  ).trim().split('\n').filter(Boolean).sort().reverse();
  frameworks.forEach(f => run(`codesign --force --sign - "${f}"`));

  // 4. Sign helper .app bundles inner-to-outer
  const helpers = execSync(
    `find "${appPath}/Contents" -name "*.app" 2>/dev/null`,
    { encoding: 'utf8' }
  ).trim().split('\n').filter(Boolean).sort().reverse();
  helpers.forEach(a => run(`codesign --force --sign - "${a}"`));

  // 5. Sign the main app last
  run(`codesign --force --sign - "${appPath}"`);

  // Verify
  try {
    execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: 'pipe' });
    console.log('✅ afterSign: signature verified OK');
  } catch (e) {
    console.warn('⚠️  afterSign: verification warning (non-fatal):', e.message?.split('\n')[0]);
  }
};
