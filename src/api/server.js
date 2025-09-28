const express = require('express');
const path = require('path');
const PerformanceCalculator = require('../models/PerformanceCalculator');
const TrendCalculator = require('../models/TrendCalculator');
const HeatmapCalculator = require('../models/HeatmapCalculator');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, '../views')));

const mockGames = [
  {
    id: 1,
    result: 'win',
    color: 'white',
    rating: 1500,
    opponentRating: 1480,
    accuracy: 85,
    blunders: [
      { move: 'Nf3-e5', square: 'e5', severity: 2 },
      { move: 'Qd1-h5', square: 'h5', severity: 1 }
    ],
    date: '2024-01-15',
    centipawnLoss: 25
  },
  {
    id: 2,
    result: 'loss',
    color: 'black',
    rating: 1495,
    opponentRating: 1520,
    accuracy: 78,
    blunders: [
      { move: 'Bc8-g4', square: 'g4', severity: 3 },
      { move: 'Ke8-f7', square: 'f7', severity: 2 }
    ],
    date: '2024-01-20',
    centipawnLoss: 45
  }
];

app.get('/api/performance', (req, res) => {
  const calculator = new PerformanceCalculator();
  const performance = calculator.calculatePerformance(mockGames);
  res.json(performance);
});

app.get('/api/trends', (req, res) => {
  const calculator = new TrendCalculator();
  const trends = calculator.calculateTrends(mockGames);
  res.json(trends);
});

app.get('/api/heatmap', (req, res) => {
  const calculator = new HeatmapCalculator();
  const heatmap = calculator.calculateHeatmap(mockGames);
  const problematicSquares = calculator.getMostProblematicSquares();
  res.json({ heatmap, problematicSquares });
});

app.listen(port, () => {
  console.log(`Chess Analysis API running at http://localhost:${port}`);
});
