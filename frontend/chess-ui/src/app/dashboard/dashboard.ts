import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  performance: any = {
    white: { games: 0, winRate: 0 },
    black: { games: 0, winRate: 0 },
    overall: { avgAccuracy: 0, totalBlunders: 0 }
  };

  constructor(private http: HttpClient) {}

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
