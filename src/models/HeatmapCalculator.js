class HeatmapCalculator {
  constructor() {
    this.blunderSquares = {};
  }

  calculateHeatmap(games) {
    this.blunderSquares = {};
    
    games.forEach(game => {
      if (game.blunders) {
        game.blunders.forEach(blunder => {
          const square = blunder.square || this.extractSquareFromMove(blunder.move);
          if (square) {
            if (!this.blunderSquares[square]) {
              this.blunderSquares[square] = { count: 0, severity: 0 };
            }
            this.blunderSquares[square].count++;
            this.blunderSquares[square].severity += blunder.severity || 1;
          }
        });
      }
    });

    return this.generateHeatmapData();
  }

  extractSquareFromMove(move) {
    if (!move) return null;
    const match = move.match(/[a-h][1-8]/g);
    return match ? match[match.length - 1] : null;
  }

  generateHeatmapData() {
    const heatmapData = [];
    
    for (let file = 0; file < 8; file++) {
      for (let rank = 0; rank < 8; rank++) {
        const square = String.fromCharCode(97 + file) + (rank + 1);
        const data = this.blunderSquares[square] || { count: 0, severity: 0 };
        
        heatmapData.push({
          square,
          file,
          rank,
          count: data.count,
          severity: data.severity,
          intensity: this.calculateIntensity(data.count, data.severity)
        });
      }
    }

    return heatmapData;
  }

  calculateIntensity(count, severity) {
    return count > 0 ? Math.min(1, (count * severity) / 10) : 0;
  }

  getMostProblematicSquares(limit = 5) {
    return Object.entries(this.blunderSquares)
      .sort(([,a], [,b]) => (b.count * b.severity) - (a.count * a.severity))
      .slice(0, limit)
      .map(([square, data]) => ({ square, ...data }));
  }
}

module.exports = HeatmapCalculator;
