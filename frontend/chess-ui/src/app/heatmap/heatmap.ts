import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { TournamentService } from '../services/tournament.service';
import { TournamentSelectorComponent } from '../components/tournament-selector/tournament-selector';

@Component({
  selector: 'app-heatmap',
  imports: [CommonModule, MatToolbarModule, MatCardModule, MatButtonModule, MatIconModule, TournamentSelectorComponent],
  templateUrl: './heatmap.html',
  styleUrl: './heatmap.css'
})
export class Heatmap implements OnInit {
  heatmapData: any[] = [];
  selectedSquare: any = null;
  totalBlunders = 0;
  worstSquare = '-';
  selectedTournamentId: number | null = null;
  loading = true;
  error: string | null = null;

  constructor(
    private http: HttpClient,
    private tournamentService: TournamentService
  ) {}

  ngOnInit() {
    this.loadHeatmapData();
  }

  async loadHeatmapData() {
    try {
      this.loading = true;
      this.error = null;
      
      let response;
      if (this.selectedTournamentId) {
        // Get tournament-specific heatmap
        response = await this.tournamentService.getTournamentHeatmap(this.selectedTournamentId).toPromise();
        console.log(`🔥 Loaded tournament ${this.selectedTournamentId} heatmap data`);
      } else {
        // Get overall heatmap
        response = await this.http.get<any[]>('http://localhost:3000/api/heatmap-db').toPromise();
        console.log('🔥 Loaded overall heatmap data');
      }
      
      if (response && response.length > 0) {
        this.heatmapData = response;
      } else {
        // Fallback to legacy API if no data
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

  onTournamentChange(tournamentId: number | null) {
    this.selectedTournamentId = tournamentId;
    this.loadHeatmapData();
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

  getTournamentContext(): string {
    return this.selectedTournamentId ? 'Tournament Heatmap' : 'Blunder Heatmap';
  }

  onSquareClick(square: any) {
    this.selectedSquare = square;
  }

  generateMockHeatmap() {
    const heatmap = [];
    const hotSpots = ['e5', 'g4', 'f7', 'h5', 'd4', 'c6'];
    
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (rank + 1);
        const isHotSpot = hotSpots.includes(square);
        const count = isHotSpot ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 2);
        
        heatmap.push({
          square,
          file,
          rank,
          count,
          severity: count * (Math.floor(Math.random() * 3) + 1),
          intensity: count > 0 ? Math.min(1, count * 0.3) : 0
        });
      }
    }
    
    return heatmap;
  }
}
