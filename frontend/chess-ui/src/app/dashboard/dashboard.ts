import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, MatToolbarModule, MatCardModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  performance: any = {
    white: { games: 0, winRate: 0 },
    black: { games: 0, winRate: 0 },
    overall: { avgAccuracy: 0, totalBlunders: 0 }
  };

  ngOnInit() {
    this.loadPerformanceData();
  }

  loadPerformanceData() {
    // Use mock data for demo
    this.performance = {
      white: { games: 15, winRate: 67 },
      black: { games: 12, winRate: 58 },
      overall: { avgAccuracy: 85, totalBlunders: 23 }
    };
  }
}
