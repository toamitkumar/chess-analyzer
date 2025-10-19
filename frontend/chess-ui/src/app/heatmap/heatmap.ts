import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { TournamentService } from '../services/tournament.service';
import { TournamentSelectorComponent } from '../components/tournament-selector/tournament-selector';
import { NavigationComponent } from '../components/navigation/navigation.component';
import { StatCardComponent } from '../components/stat-card/stat-card.component';

@Component({
  selector: 'app-heatmap',
  imports: [
    CommonModule, 
    RouterModule,
    MatToolbarModule, 
    MatCardModule, 
    MatButtonModule, 
    MatIconModule, 
    MatProgressSpinnerModule,
    NavigationComponent, 
    StatCardComponent
  ],
  templateUrl: './heatmap.html',
  styleUrl: './heatmap.css'
})
export class Heatmap implements OnInit {
  heatmapData: any[][] = [];
  selectedSquare: any = null;
  totalBlunders = 0;
  selectedColor = 'both';
  selectedErrorType = 'all';
  totalErrors = 0;
  mostErrorSquare = 'e4';
  mostErrorCount = 0;
  averageErrorsPerGame = 0;
  loading = false;
  error = '';

  constructor(
    private http: HttpClient,
    private tournamentService: TournamentService
  ) {}

  ngOnInit() {
    this.loadHeatmapData();
  }

  loadHeatmapData() {
    this.loading = true;
    // Initialize empty 8x8 board
    this.heatmapData = Array(8).fill(null).map(() => 
      Array(8).fill(null).map(() => ({ errorCount: 0 }))
    );
    this.loading = false;
  }

  setColor(color: string) {
    this.selectedColor = color;
    this.loadHeatmapData();
  }

  setErrorType(type: string) {
    this.selectedErrorType = type;
    this.loadHeatmapData();
  }

  getSquareClass(row: number, col: number): string {
    return (row + col) % 2 === 0 ? 'light' : 'dark';
  }

  getSquareColor(errorCount: number): string {
    if (errorCount === 0) return 'transparent';
    if (errorCount <= 2) return 'rgba(251, 191, 36, 0.3)';
    if (errorCount <= 5) return 'rgba(251, 191, 36, 0.6)';
    return 'rgba(220, 38, 38, 0.8)';
  }

  getSquareLabel(row: number, col: number): string {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    return files[col] + ranks[row];
  }

  getSquareTooltip(row: number, col: number, errorCount: number): string {
    const square = this.getSquareLabel(row, col);
    return `${square}: ${errorCount} errors`;
  }
}
