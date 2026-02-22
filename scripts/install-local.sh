#!/bin/bash
# scripts/install-local.sh
# Install and ad-hoc sign ChessPulse for local testing (no Apple Developer ID needed).
# Usage: ./scripts/install-local.sh

set -e

DMG="dist-electron/ChessPulse-1.0.0-arm64.dmg"
APP_SRC="dist-electron/mac-arm64/ChessPulse.app"
APP_DEST="/Applications/ChessPulse.app"

if [ ! -d "$APP_SRC" ]; then
  echo "❌  Build not found. Run: make electron-build-dir"
  exit 1
fi

echo "📦  Installing ChessPulse to /Applications..."
rm -rf "$APP_DEST"
cp -r "$APP_SRC" "$APP_DEST"

echo "🔏  Ad-hoc signing (removes Gatekeeper quarantine)..."
xattr -cr "$APP_DEST"
find "$APP_DEST/Contents/Frameworks" -name "*.framework" -o -name "*.dylib" 2>/dev/null \
  | while read f; do codesign --force --sign - "$f" 2>/dev/null; done
find "$APP_DEST/Contents" -name "*.app" 2>/dev/null | sort -r \
  | while read a; do codesign --force --sign - "$a" 2>/dev/null; done
codesign --force --sign - "$APP_DEST"

echo "🚀  Launching ChessPulse..."
open "$APP_DEST"
