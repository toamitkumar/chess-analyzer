// Main entry point for the chess analyzer application
const { ChessAnalyzer } = require('./src/models/analyzer');
const PerformanceCalculator = require('./src/models/performance-stats');

module.exports = {
  ChessAnalyzer,
  PerformanceCalculator
};
