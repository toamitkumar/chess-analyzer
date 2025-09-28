import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-heatmap',
  imports: [CommonModule],
  templateUrl: './heatmap.html',
  styleUrl: './heatmap.css'
})
export class Heatmap implements OnInit {
  heatmapData: any[] = [];
  selectedSquare: any = null;
  totalBlunders = 0;
  worstSquare = '-';

  ngOnInit() {
    this.loadHeatmapData();
  }

  loadHeatmapData() {
    // Mock heatmap data
    this.heatmapData = this.generateMockHeatmap();
    this.totalBlunders = this.heatmapData.reduce((sum, square) => sum + square.count, 0);
    const worst = this.heatmapData.reduce((max, square) => 
      square.count > max.count ? square : max, { count: 0, square: '-' });
    this.worstSquare = worst.count > 0 ? `${worst.square} (${worst.count})` : '-';
  }

  generateMockHeatmap() {
    const data = [];
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (rank + 1);
        const count = ['e5', 'g4', 'f7', 'h5'].includes(square) ? 
          Math.floor(Math.random() * 3) + 1 : 0;
        data.push({
          square,
          file,
          rank,
          count,
          severity: count * (Math.floor(Math.random() * 3) + 1),
          intensity: count > 0 ? Math.min(1, count * 0.3) : 0
        });
      }
    }
    return data;
  }

  getSquareClass(square: any, index: number) {
    const isLight = (square.file + square.rank) % 2 === 0;
    const baseClass = isLight ? 'bg-amber-100' : 'bg-amber-800 text-white';
    
    if (square.intensity > 0) {
      const opacity = Math.min(0.8, square.intensity);
      return `${baseClass} bg-red-500 text-white opacity-${Math.floor(opacity * 100)}`;
    }
    
    return baseClass;
  }

  showSquareDetails(square: any) {
    if (square.count > 0) {
      this.selectedSquare = square;
    }
  }

  getAverageSeverity(square: any) {
    return square.count > 0 ? (square.severity / square.count).toFixed(1) : '0';
  }
}
