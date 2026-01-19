import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PuzzleService, LearningPath, Puzzle } from '../../services/puzzle.service';

@Component({
  selector: 'app-learning-path',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="learning-path-container">
      <h1>Learning Path</h1>

      <!-- Daily Goals -->
      <section class="daily-goals card" *ngIf="learningPath?.dailyGoals">
        <h2>📅 Daily Goals</h2>
        <div class="goal-progress">
          <div class="progress-circle">
            <svg viewBox="0 0 36 36">
              <path class="bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              <path class="fill" [attr.stroke-dasharray]="learningPath.dailyGoals.progress + ', 100'"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            </svg>
            <span class="percentage">{{ learningPath.dailyGoals.progress | number:'1.0-0' }}%</span>
          </div>
          <div class="goal-details">
            <p><strong>{{ learningPath.dailyGoals.puzzlesSolved }}</strong> / {{ learningPath.dailyGoals.puzzlesTarget }} puzzles solved</p>
            <p class="sub">{{ learningPath.dailyGoals.puzzlesCompleted }} attempted today</p>
          </div>
        </div>
        <a routerLink="/puzzles" class="btn-primary">Start Training →</a>
      </section>

      <!-- Weakest Themes -->
      <section class="weak-themes card" *ngIf="learningPath?.weakestThemes?.length">
        <h2>🎯 Focus Areas</h2>
        <p class="subtitle">Themes where you need the most practice</p>
        <div class="theme-list">
          <div class="theme-item" *ngFor="let theme of learningPath.weakestThemes">
            <span class="theme-name">{{ formatTheme(theme.theme) }}</span>
            <div class="mastery-bar">
              <div class="mastery-fill" [style.width.%]="theme.mastery"></div>
            </div>
            <span class="mastery-value">{{ theme.mastery }}%</span>
          </div>
        </div>
      </section>

      <!-- Recommended Puzzles -->
      <section class="recommendations card" *ngIf="learningPath?.recommendations?.length">
        <h2>💡 Recommended Puzzles</h2>
        <div class="puzzle-grid">
          <div class="puzzle-card" *ngFor="let puzzle of learningPath.recommendations.slice(0, 6)">
            <div class="puzzle-rating">{{ puzzle.rating }}</div>
            <div class="puzzle-themes">{{ formatThemes(puzzle.themes) }}</div>
            <a [routerLink]="['/puzzles', puzzle.id]" class="btn-small">Practice</a>
          </div>
        </div>
      </section>

      <!-- Statistics -->
      <section class="statistics card" *ngIf="learningPath?.statistics">
        <h2>📊 Your Statistics</h2>
        <div class="stat-grid">
          <div class="stat-item">
            <span class="stat-value">{{ learningPath.statistics.totalPuzzles }}</span>
            <span class="stat-label">Total Attempted</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ learningPath.statistics.totalSolved }}</span>
            <span class="stat-label">Solved</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ learningPath.statistics.successRate }}%</span>
            <span class="stat-label">Success Rate</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ learningPath.statistics.averageMastery }}</span>
            <span class="stat-label">Avg Mastery</span>
          </div>
        </div>
      </section>

      <!-- Review Queue -->
      <section class="review-queue card" *ngIf="reviewPuzzles?.length">
        <h2>🔄 Due for Review</h2>
        <p class="subtitle">{{ reviewPuzzles.length }} puzzles ready for spaced repetition</p>
        <a routerLink="/puzzles" [queryParams]="{mode: 'review'}" class="btn-secondary">
          Start Review Session
        </a>
      </section>

      <!-- Loading -->
      <div class="loading" *ngIf="loading">
        <div class="spinner"></div>
        <p>Loading your learning path...</p>
      </div>
    </div>
  `,
  styles: [`
    .learning-path-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { margin-bottom: 24px; }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .card h2 {
      margin: 0 0 16px;
      font-size: 18px;
    }
    .subtitle {
      color: #666;
      margin: -8px 0 16px;
      font-size: 14px;
    }
    
    /* Daily Goals */
    .goal-progress {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 20px;
    }
    .progress-circle {
      position: relative;
      width: 100px;
      height: 100px;
    }
    .progress-circle svg {
      transform: rotate(-90deg);
    }
    .progress-circle .bg {
      fill: none;
      stroke: #e0e0e0;
      stroke-width: 3;
    }
    .progress-circle .fill {
      fill: none;
      stroke: #4caf50;
      stroke-width: 3;
      stroke-linecap: round;
    }
    .progress-circle .percentage {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 20px;
      font-weight: bold;
    }
    .goal-details p { margin: 4px 0; }
    .goal-details .sub { color: #666; font-size: 14px; }
    
    /* Theme List */
    .theme-list { display: flex; flex-direction: column; gap: 12px; }
    .theme-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .theme-name {
      width: 120px;
      font-weight: 500;
      text-transform: capitalize;
    }
    .mastery-bar {
      flex: 1;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }
    .mastery-fill {
      height: 100%;
      background: linear-gradient(90deg, #e74c3c, #f39c12, #4caf50);
      transition: width 0.3s;
    }
    .mastery-value {
      width: 50px;
      text-align: right;
      font-weight: 500;
    }
    
    /* Puzzle Grid */
    .puzzle-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
    }
    .puzzle-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .puzzle-rating {
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
    }
    .puzzle-themes {
      font-size: 12px;
      color: #666;
      margin: 8px 0;
      height: 32px;
      overflow: hidden;
    }
    
    /* Statistics */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .stat-item { text-align: center; }
    .stat-value {
      display: block;
      font-size: 28px;
      font-weight: bold;
      color: #2c3e50;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
    }
    
    /* Buttons */
    .btn-primary, .btn-secondary, .btn-small {
      display: inline-block;
      padding: 10px 20px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-primary {
      background: #3498db;
      color: white;
    }
    .btn-secondary {
      background: #ecf0f1;
      color: #2c3e50;
    }
    .btn-small {
      padding: 6px 12px;
      font-size: 12px;
      background: #3498db;
      color: white;
    }
    
    /* Loading */
    .loading {
      text-align: center;
      padding: 60px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    
    @media (max-width: 600px) {
      .stat-grid { grid-template-columns: repeat(2, 1fr); }
      .goal-progress { flex-direction: column; text-align: center; }
    }
  `]
})
export class LearningPathComponent implements OnInit {
  learningPath: LearningPath | null = null;
  reviewPuzzles: Puzzle[] = [];
  loading = true;

  constructor(private puzzleService: PuzzleService) {}

  ngOnInit() {
    this.loadLearningPath();
    this.loadReviewPuzzles();
  }

  private loadLearningPath() {
    this.puzzleService.getLearningPath().subscribe({
      next: (path) => {
        this.learningPath = path;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private loadReviewPuzzles() {
    this.puzzleService.getReviewPuzzles().subscribe({
      next: (result) => {
        this.reviewPuzzles = result.puzzles;
      }
    });
  }

  formatTheme(theme: string): string {
    return theme.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
  }

  formatThemes(themes: string): string {
    return themes.split(' ').slice(0, 2).map(t => this.formatTheme(t)).join(', ');
  }
}
