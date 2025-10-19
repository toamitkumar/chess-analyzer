class TrendCalculator {
  constructor() {
    this.CENTIPAWN_THRESHOLD = 50; // Threshold for significant moves
  }

  calculateRatingProgression(games) {
    const ratingData = games
      .filter(game => game.playerRating && game.date)
      .map(game => ({
        date: this.parseDate(game.date),
        rating: parseInt(game.playerRating),
        result: game.result,
        opponent: game.opponentRating ? parseInt(game.opponentRating) : null
      }))
      .sort((a, b) => a.date - b.date);

    return ratingData;
  }

  calculateCentipawnLossTrend(games) {
    const trendData = games
      .filter(game => game.moves && game.date)
      .map(game => ({
        date: this.parseDate(game.date),
        avgCentipawnLoss: this.calculateGameCentipawnLoss(game.moves),
        moveCount: game.moves.length
      }))
      .sort((a, b) => a.date - b.date);

    return trendData;
  }

  calculateGameCentipawnLoss(moves) {
    if (!moves || moves.length === 0) return 0;

    let totalLoss = 0;
    let moveCount = 0;

    moves.forEach(move => {
      if (move.evaluation && move.bestMoveEvaluation) {
        const loss = Math.abs(move.evaluation.evaluation - move.bestMoveEvaluation.evaluation) * 100;
        if (loss > this.CENTIPAWN_THRESHOLD) {
          totalLoss += loss;
          moveCount++;
        }
      }
    });

    return moveCount > 0 ? Math.round(totalLoss / moveCount) : 0;
  }

  parseDate(dateString) {
    // Handle PGN date format: "2023.01.15" or "2023.01.??"
    if (!dateString || dateString.includes('?')) {
      return new Date();
    }
    
    const parts = dateString.split('.');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    
    return new Date(dateString);
  }

  filterByDateRange(data, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return data.filter(item => item.date >= start && item.date <= end);
  }

  generateMovingAverage(data, windowSize = 5) {
    if (data.length < windowSize) return data;

    return data.map((item, index) => {
      if (index < windowSize - 1) return item;

      const window = data.slice(index - windowSize + 1, index + 1);
      const avgValue = window.reduce((sum, d) => {
        return sum + (d.rating || d.avgCentipawnLoss || 0);
      }, 0) / windowSize;

      return {
        ...item,
        movingAverage: Math.round(avgValue)
      };
    });
  }

  extractGameMetadata(pgnContent) {
    const header = this.extractPgnHeader(pgnContent);
    
    return {
      date: header.Date,
      playerRating: header.WhiteElo || header.BlackElo,
      opponentRating: header.BlackElo || header.WhiteElo,
      result: header.Result,
      event: header.Event,
      timeControl: header.TimeControl
    };
  }

  extractPgnHeader(pgnContent) {
    const header = {};
    const headerLines = pgnContent.split('\n').filter(line => line.startsWith('['));
    
    headerLines.forEach(line => {
      const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
      if (match) {
        header[match[1]] = match[2];
      }
    });
    
    return header;
  }

  generateTrendSummary(ratingData, centipawnData) {
    const summary = {
      ratingChange: 0,
      averageCentipawnLoss: 0,
      improvementTrend: 'stable',
      totalGames: ratingData.length
    };

    if (ratingData.length > 1) {
      const firstRating = ratingData[0].rating;
      const lastRating = ratingData[ratingData.length - 1].rating;
      summary.ratingChange = lastRating - firstRating;
    }

    if (centipawnData.length > 0) {
      summary.averageCentipawnLoss = Math.round(
        centipawnData.reduce((sum, d) => sum + d.avgCentipawnLoss, 0) / centipawnData.length
      );
    }

    // Determine trend
    if (summary.ratingChange > 50) {
      summary.improvementTrend = 'improving';
    } else if (summary.ratingChange < -50) {
      summary.improvementTrend = 'declining';
    }

    return summary;
  }
}

module.exports = TrendCalculator;
