.PHONY: setup install install-be install-fe dev dev-be dev-fe build \
        prepare-stockfish electron-dev electron-build electron-build-dir dmg \
        test test-watch test-coverage clean check help

# ── Setup ─────────────────────────────────────────────────────────────────────

## Install all system dependencies and npm packages
setup: check-brew install-stockfish install

## Check that Homebrew is available (macOS only)
check-brew:
	@if ! command -v brew >/dev/null 2>&1; then \
		echo "❌  Homebrew not found. Install from https://brew.sh or install Stockfish manually."; \
		exit 1; \
	fi

## Install Stockfish engine via Homebrew (macOS)
install-stockfish:
	@if command -v stockfish >/dev/null 2>&1; then \
		echo "✅  Stockfish already installed: $$(stockfish --version 2>/dev/null | head -1)"; \
	else \
		echo "🔧  Installing Stockfish..."; \
		brew install stockfish; \
		echo "✅  Stockfish installed: $$(stockfish --version 2>/dev/null | head -1)"; \
	fi

# ── Dependencies ──────────────────────────────────────────────────────────────

## Install backend and frontend npm packages
install: install-be install-fe

install-be:
	@echo "📦  Installing backend dependencies..."
	npm install

install-fe:
	@echo "📦  Installing frontend dependencies..."
	cd frontend && npm install

# ── Development ───────────────────────────────────────────────────────────────

## Start both backend and frontend dev servers concurrently (browser)
dev:
	@echo "🚀  Starting backend and frontend..."
	@trap 'kill 0' SIGINT; \
	$(MAKE) dev-be & \
	$(MAKE) dev-fe & \
	wait

## Start backend API server only (port 3000)
dev-be:
	@echo "🔧  Starting backend on http://localhost:3000 ..."
	npm run dashboard

## Start frontend dev server only (port 4200)
dev-fe:
	@echo "🎨  Starting frontend on http://localhost:4200 ..."
	cd frontend && npm run start

## Start the Electron desktop app (dev mode — hot backend, no DMG needed)
electron-dev:
	@echo "🖥️   Launching ChessPulse desktop app (dev)..."
	npm run electron:dev

# ── Build ─────────────────────────────────────────────────────────────────────

## Download Stockfish binaries for bundling into DMG (arm64 + x64 → universal)
prepare-stockfish:
	@echo "♟️   Preparing Stockfish binaries..."
	node scripts/prepare-stockfish.js

## Build Angular frontend for production
build:
	@echo "🏗️   Building frontend..."
	cd frontend && npm run build

## Build Electron app as unpacked .app (fast, no DMG — good for testing)
electron-build-dir: build
	@echo "📦  Building Electron .app (unpacked)..."
	npm run electron:build:dir
	@echo "✅  App built at dist-electron/"

## Build signed DMG installer for macOS distribution (bundles Stockfish, FE, BE, SQLite)
dmg: prepare-stockfish build
	@echo "💿  Building ChessPulse DMG..."
	npm run electron:build
	@echo "✅  DMG ready at dist-electron/"

## Build DMG and publish to GitHub Releases (requires GH_TOKEN env var)
release: prepare-stockfish build
	@echo "🚀  Building and publishing release to GitHub..."
	@test -n "$$GH_TOKEN" || (echo "❌  GH_TOKEN not set"; exit 1)
	npm run release
	@echo "✅  Release published to GitHub"

# ── Testing ───────────────────────────────────────────────────────────────────

## Run all tests
test:
	npm test

## Run tests in watch mode
test-watch:
	npm run test:watch

## Run tests with coverage report
test-coverage:
	npm run test:coverage

# ── Utilities ─────────────────────────────────────────────────────────────────

## Remove test databases and build artefacts
clean:
	npm run test:clean
	rm -rf frontend/dist dist-electron

## Verify all required tools are installed
check:
	@echo "🔍  Checking required tools..."
	@node --version | grep -qE "v(20|2[1-9]|[3-9][0-9])" \
		&& echo "✅  Node.js: $$(node --version)" \
		|| (echo "❌  Node.js 20+ required (found: $$(node --version))"; exit 1)
	@npm --version >/dev/null 2>&1 \
		&& echo "✅  npm: $$(npm --version)" \
		|| (echo "❌  npm not found"; exit 1)
	@command -v stockfish >/dev/null 2>&1 \
		&& echo "✅  Stockfish: $$(stockfish --version 2>/dev/null | head -1)" \
		|| (echo "❌  Stockfish not found — run: make install-stockfish"; exit 1)
	@node -e "require('./node_modules/electron/package.json')" 2>/dev/null \
		&& echo "✅  Electron: $$(node -e "console.log(require('./node_modules/electron/package.json').version)")" \
		|| (echo "❌  Electron not found — run: make install"; exit 1)
	@echo "✅  All checks passed"

# ── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "ChessPulse — Development Makefile"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  setup              Install system deps (Stockfish) + npm packages"
	@echo "  install            Install backend and frontend npm packages"
	@echo ""
	@echo "  dev                Start backend + Angular dev servers (browser)"
	@echo "  dev-be             Start backend API server only (port 3000)"
	@echo "  dev-fe             Start Angular dev server only (port 4200)"
	@echo "  electron-dev       Launch desktop app via Electron (dev mode)"
	@echo ""
	@echo "  prepare-stockfish  Download Stockfish binaries for DMG bundling"
	@echo "  build              Build Angular frontend for production"
	@echo "  electron-build-dir Build unpacked .app (fast, no DMG)"
	@echo "  dmg                Build self-contained DMG (Stockfish+FE+BE+SQLite)"
	@echo "  release            Build DMG and publish to GitHub Releases (needs GH_TOKEN)"
	@echo ""
	@echo "  test               Run all tests"
	@echo "  test-watch         Run tests in watch mode"
	@echo "  test-coverage      Run tests with coverage report"
	@echo ""
	@echo "  clean              Remove test DBs and build artefacts"
	@echo "  check              Verify required tools are installed"
	@echo ""

.DEFAULT_GOAL := help
