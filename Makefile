.PHONY: setup install install-be install-fe dev dev-be dev-fe build test test-watch test-coverage clean check

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

## Start both backend and frontend dev servers concurrently
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

# ── Build ─────────────────────────────────────────────────────────────────────

## Build frontend for production
build:
	@echo "🏗️   Building frontend..."
	cd frontend && npm run build

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
	rm -rf frontend/dist

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
	@echo "✅  All checks passed"

# ── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "ChessPulse — Development Makefile"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  setup            Install system deps (Stockfish) + npm packages"
	@echo "  install          Install backend and frontend npm packages"
	@echo "  dev              Start backend + frontend dev servers"
	@echo "  dev-be           Start backend API server only (port 3000)"
	@echo "  dev-fe           Start frontend dev server only"
	@echo "  build            Build frontend for production"
	@echo "  test             Run all tests"
	@echo "  test-watch       Run tests in watch mode"
	@echo "  test-coverage    Run tests with coverage report"
	@echo "  clean            Remove test DBs and build artefacts"
	@echo "  check            Verify required tools are installed"
	@echo ""

.DEFAULT_GOAL := help
