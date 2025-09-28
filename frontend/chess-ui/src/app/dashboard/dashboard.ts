import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, MatToolbarModule, MatCardModule, MatButtonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  performance: any = {
    white: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
    black: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
    overall: { avgAccuracy: 0, totalBlunders: 0 }
  };
  
  loading = true;
  error: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadPerformanceData();
  }

  async loadPerformanceData() {
    try {
      this.loading = true;
      this.error = null;
      
      // Try database API first, fallback to legacy API
      const response = await this.http.get<any>('http://localhost:3000/api/performance-db').toPromise();
      
      if (response && (response.white?.games > 0 || response.black?.games > 0)) {
        this.performance = response;
        console.log('📊 Loaded real performance data from database:', response);
      } else {
        // Fallback to legacy API if no data in database
        const fallbackResponse = await this.http.get<any>('http://localhost:3000/api/performance').toPromise();
        this.performance = fallbackResponse || this.getEmptyPerformance();
        console.log('📊 Using fallback performance data');
      }
      
    } catch (error) {
      console.error('❌ Failed to load performance data:', error);
      this.error = 'Failed to load performance data';
      this.performance = this.getEmptyPerformance();
    } finally {
      this.loading = false;
    }
  }

  getEmptyPerformance() {
    return {
      white: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
      black: { games: 0, winRate: 0, avgAccuracy: 0, blunders: 0 },
      overall: { avgAccuracy: 0, totalBlunders: 0 }
    };
  }

  refreshData() {
    this.loadPerformanceData();
  }
}
