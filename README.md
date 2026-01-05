# ChessPulse - Multi-User Chess Analysis Platform

A comprehensive Node.js application that analyzes chess games in PGN format using the Stockfish engine. Features user authentication, multi-user support, and provides detailed performance dashboards with trend visualization.

## Installation

```bash
npm install
```

## Usage

### Analyze PGN Files

Analyze a single PGN file:
```bash
node src/models/analyzer.js game.pgn
```

Analyze with custom depth (default is 15):
```bash
node src/models/analyzer.js game.pgn 20
```

### Performance Dashboard

Start the dashboard server:
```bash
npm run dashboard
```

Then open http://localhost:3000 in your browser to view the performance dashboard.

## Features

### User Authentication & Multi-User Support
- Supabase authentication integration
- User-specific game analysis and progress tracking
- Secure user sessions and data isolation

### Core Analysis
- Parses PGN files using chess.js
- Evaluates each position with Stockfish
- Outputs detailed analysis in JSON format
- Configurable analysis depth

### Performance Dashboard
- Performance statistics with White/Black split
- Win rate, accuracy, and blunder tracking
- **NEW**: Rating progression over time
- **NEW**: Average centipawn loss trends
- Interactive line charts with hover tooltips
- Responsive design for mobile and desktop

### API Endpoints
- `GET /api/performance` - Get performance statistics
- `GET /api/trends` - Get rating and centipawn loss trends
- `GET /api/health` - Health check

## Dashboard Features

### Performance Overview
- Win rates split by White/Black pieces
- Accuracy percentages based on engine analysis
- Blunder counts (moves with >100 centipawn loss)

### Trend Visualization
- **Rating Progression Chart**: Interactive line chart showing rating changes over time
- **Centipawn Loss Trend**: Track improvement in move accuracy
- Hover tooltips showing game details
- Time-based filtering capabilities

## Output

The analyzer creates a JSON file with move-by-move analysis including:
- Move number and notation
- Position FEN
- Stockfish evaluation
- Best move suggestion

Example output: `game_analysis.json`

## Testing

Run unit tests:
```bash
npm test unit.test.js
npm test trend-calculator.test.js
```

## Project Structure

See `PROJECT_STRUCTURE.md` for detailed code organization.
