import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-heatmap',
  imports: [CommonModule, MatToolbarModule, MatCardModule, MatButtonModule],
  templateUrl: './heatmap.html',
  styleUrl: './heatmap.css'
})
export class Heatmap implements OnInit {
  heatmapData: any[] = [];
  selectedSquare: any = null;
  totalBlunders = 0;
  worstSquare = '-';
  loading = true;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadHeatmapData();
  }

  async loadHeatmapData() {
    try {
      this.loading = true;
      this.error = null;
      
      // Try database API first, fallback to legacy API
      const response = await this.http.get<any[]>('http://localhost:3000/api/heatmap-db').toPromise();
      
      if (response && response.length > 0) {
        this.heatmapData = response;
        console.log('🔥 Loaded real heatmap data from database:', response.length, 'squares');
      } else {
        // Fallback to legacy API if no data in database
        const fallbackResponse = await this.http.get<any[]>('http://localhost:3000/api/heatmap').toPromise();
        this.heatmapData = fallbackResponse || this.generateEmptyHeatmap();
        console.log('🔥 Using fallback heatmap data');
      }
      
      this.calculateStats();
      
    } catch (error) {
      console.error('❌ Failed to load heatmap data:', error);
      this.error = 'Failed to load heatmap data';
      this.heatmapData = this.generateEmptyHeatmap();
      this.calculateStats();
    } finally {
      this.loading = false;
    }
  }

  calculateStats() {
    this.totalBlunders = this.heatmapData.reduce((sum, square) => sum + square.count, 0);
    const worst = this.heatmapData.reduce((max, square) => 
      square.count > max.count ? square : max, { count: 0, square: '-' });
    this.worstSquare = worst.count > 0 ? `${worst.square} (${worst.count})` : '-';
  }

  generateEmptyHeatmap() {
    const heatmap = [];
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (rank + 1);
        heatmap.push({
          square,
          file,
          rank,
          count: 0,
          severity: 0,
          intensity: 0
        });
      }
    }
    return heatmap;
  }

  refreshData() {
    this.loadHeatmapData();
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
    const baseClass = isLight ? 'light' : 'dark';
    
    if (square.intensity > 0) {
      return `${baseClass} error`;
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
