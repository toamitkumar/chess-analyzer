import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { PuzzleService, LearningPath } from '../../services/puzzle.service';

@Component({
  selector: 'app-learning-path',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="learning-path-container">
      <div class="page-header">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Learning Path</h1>
          <p class="mt-2 text-gray-600">Track your progress and focus on improving weak areas</p>
        </div>
        <button
          (click)="goToPuzzles()"
          class="primary-btn">
          🎯 Practice Puzzles
        </button>
      </div>

      <!-- Loading state -->
      <div *ngIf="loading" class="loading-state">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading learning path...</p>
      </div>

      <!-- Error state -->
      <div *ngIf="error" class="error-state">
        <svg class="h-12 w-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="mt-4 text-gray-700">{{ error }}</p>
        <button (click)="loadLearningPath()" class="retry-btn">
          Try Again
        </button>
      </div>

      <!-- Learning path content -->
      <div *ngIf="!loading && !error && learningPath" class="content-grid">
        <!-- Daily Goals -->
        <div class="section-card">
          <div class="section-header">
            <div class="flex items-center gap-2">
              <div class="icon-wrapper bg-blue-100 text-blue-600">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
              </div>
              <h2 class="section-title">Today's Goals</h2>
            </div>
          </div>
          <div class="section-body">
            <div class="progress-bar-container">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill"
                     [style.width.%]="learningPath.dailyGoals.progress"></div>
              </div>
              <div class="progress-text">
                {{ learningPath.dailyGoals.puzzlesCompleted }} / {{ learningPath.dailyGoals.puzzlesTarget }} puzzles
              </div>
            </div>
            <div class="goals-stats">
              <div class="goal-stat">
                <span class="goal-label">Completed</span>
                <span class="goal-value">{{ learningPath.dailyGoals.puzzlesCompleted }}</span>
              </div>
              <div class="goal-stat">
                <span class="goal-label">Solved</span>
                <span class="goal-value text-green-600">{{ learningPath.dailyGoals.puzzlesSolved }}</span>
              </div>
              <div class="goal-stat">
                <span class="goal-label">Target</span>
                <span class="goal-value">{{ learningPath.dailyGoals.puzzlesTarget }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Statistics -->
        <div class="section-card">
          <div class="section-header">
            <div class="flex items-center gap-2">
              <div class="icon-wrapper bg-green-100 text-green-600">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <h2 class="section-title">Overall Statistics</h2>
            </div>
          </div>
          <div class="section-body">
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-icon">📊</div>
                <div>
                  <p class="stat-label">Total Puzzles</p>
                  <p class="stat-value">{{ learningPath.statistics.totalPuzzles }}</p>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-icon">✅</div>
                <div>
                  <p class="stat-label">Solved</p>
                  <p class="stat-value">{{ learningPath.statistics.totalSolved }}</p>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-icon">🎯</div>
                <div>
                  <p class="stat-label">Success Rate</p>
                  <p class="stat-value">{{ learningPath.statistics.successRate }}%</p>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-icon">⭐</div>
                <div>
                  <p class="stat-label">Avg Mastery</p>
                  <p class="stat-value">{{ learningPath.statistics.averageMastery }}%</p>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-icon">🔥</div>
                <div>
                  <p class="stat-label">Best Streak</p>
                  <p class="stat-value">{{ learningPath.statistics.bestStreak }}</p>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-icon">🔄</div>
                <div>
                  <p class="stat-label">Total Attempts</p>
                  <p class="stat-value">{{ learningPath.statistics.totalAttempts }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Weak Themes -->
        <div class="section-card full-width">
          <div class="section-header">
            <div class="flex items-center gap-2">
              <div class="icon-wrapper bg-orange-100 text-orange-600">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <h2 class="section-title">Areas to Improve</h2>
            </div>
            <p class="text-sm text-gray-600">Focus on these patterns to strengthen your game</p>
          </div>
          <div class="section-body">
            <div *ngIf="learningPath.weakThemes.length === 0" class="empty-state">
              <p class="text-gray-600">Great! No weak areas identified yet. Keep practicing!</p>
            </div>
            <div *ngIf="learningPath.weakThemes.length > 0" class="themes-list">
              <div *ngFor="let theme of learningPath.weakThemes"
                   class="theme-item">
                <div class="theme-header">
                  <h3 class="theme-name">{{ formatTheme(theme.theme) }}</h3>
                  <span class="theme-badge"
                        [class.badge-red]="theme.mastery < 30"
                        [class.badge-yellow]="theme.mastery >= 30 && theme.mastery < 60"
                        [class.badge-green]="theme.mastery >= 60">
                    {{ theme.mastery }}% mastery
                  </span>
                </div>
                <div class="theme-details">
                  <span class="theme-frequency">{{ theme.frequency }} occurrences in your games</span>
                  <div class="mastery-bar">
                    <div class="mastery-fill"
                         [style.width.%]="theme.mastery"
                         [class.fill-red]="theme.mastery < 30"
                         [class.fill-yellow]="theme.mastery >= 30 && theme.mastery < 60"
                         [class.fill-green]="theme.mastery >= 60"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recommended Puzzles -->
        <div class="section-card full-width">
          <div class="section-header">
            <div class="flex items-center gap-2">
              <div class="icon-wrapper bg-purple-100 text-purple-600">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
                </svg>
              </div>
              <h2 class="section-title">Recommended for You</h2>
            </div>
          </div>
          <div class="section-body">
            <div class="recommendations-list">
              <div *ngFor="let puzzle of learningPath.recommendations.slice(0, 5)"
                   (click)="startPuzzle(puzzle.id)"
                   class="recommendation-item">
                <div class="recommendation-info">
                  <span class="recommendation-rating">{{ puzzle.rating }}</span>
                  <div class="recommendation-themes">
                    <span *ngFor="let theme of getThemes(puzzle.themes)" class="theme-tag">
                      {{ theme }}
                    </span>
                  </div>
                </div>
                <button class="practice-btn">
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Practice
                </button>
              </div>
            </div>
            <button (click)="goToPuzzles()" class="view-all-btn">
              View All Puzzles →
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .learning-path-container {
      @apply max-w-7xl mx-auto p-4;
    }

    .page-header {
      @apply flex items-start justify-between mb-8;
    }

    .primary-btn {
      @apply px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors;
      @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
    }

    .loading-state, .error-state {
      @apply flex flex-col items-center justify-center py-20 bg-white rounded-lg shadow-sm border border-gray-200;
    }

    .retry-btn {
      @apply mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors;
    }

    .content-grid {
      @apply grid grid-cols-1 lg:grid-cols-2 gap-6;
    }

    .section-card {
      @apply bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden;
    }

    .section-card.full-width {
      @apply lg:col-span-2;
    }

    .section-header {
      @apply p-6 border-b border-gray-200;
    }

    .section-title {
      @apply text-lg font-bold text-gray-900;
    }

    .icon-wrapper {
      @apply flex items-center justify-center w-8 h-8 rounded-lg;
    }

    .section-body {
      @apply p-6;
    }

    /* Daily Goals */
    .progress-bar-container {
      @apply mb-4;
    }

    .progress-bar-bg {
      @apply w-full h-3 bg-gray-200 rounded-full overflow-hidden;
    }

    .progress-bar-fill {
      @apply h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500;
    }

    .progress-text {
      @apply text-sm text-gray-600 mt-2 text-center;
    }

    .goals-stats {
      @apply grid grid-cols-3 gap-4;
    }

    .goal-stat {
      @apply flex flex-col items-center p-3 bg-gray-50 rounded-lg;
    }

    .goal-label {
      @apply text-xs text-gray-600 mb-1;
    }

    .goal-value {
      @apply text-xl font-bold text-gray-900;
    }

    /* Statistics */
    .stats-grid {
      @apply grid grid-cols-2 sm:grid-cols-3 gap-4;
    }

    .stat-item {
      @apply flex items-center gap-3 p-3 bg-gray-50 rounded-lg;
    }

    .stat-icon {
      @apply text-2xl;
    }

    .stat-label {
      @apply text-xs text-gray-600;
    }

    .stat-value {
      @apply text-lg font-bold text-gray-900;
    }

    /* Weak Themes */
    .empty-state {
      @apply text-center py-8;
    }

    .themes-list {
      @apply space-y-4;
    }

    .theme-item {
      @apply p-4 bg-gray-50 rounded-lg;
    }

    .theme-header {
      @apply flex items-center justify-between mb-2;
    }

    .theme-name {
      @apply font-semibold text-gray-900;
    }

    .theme-badge {
      @apply px-2 py-1 text-xs font-bold rounded;
    }

    .badge-red {
      @apply bg-red-100 text-red-800;
    }

    .badge-yellow {
      @apply bg-yellow-100 text-yellow-800;
    }

    .badge-green {
      @apply bg-green-100 text-green-800;
    }

    .theme-details {
      @apply space-y-2;
    }

    .theme-frequency {
      @apply text-sm text-gray-600;
    }

    .mastery-bar {
      @apply w-full h-2 bg-gray-200 rounded-full overflow-hidden;
    }

    .mastery-fill {
      @apply h-full transition-all duration-500;
    }

    .fill-red {
      @apply bg-red-500;
    }

    .fill-yellow {
      @apply bg-yellow-500;
    }

    .fill-green {
      @apply bg-green-500;
    }

    /* Recommendations */
    .recommendations-list {
      @apply space-y-3 mb-4;
    }

    .recommendation-item {
      @apply flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer;
    }

    .recommendation-info {
      @apply flex items-center gap-4;
    }

    .recommendation-rating {
      @apply px-3 py-1 bg-blue-600 text-white font-bold text-sm rounded;
    }

    .recommendation-themes {
      @apply flex flex-wrap gap-1;
    }

    .theme-tag {
      @apply px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded;
    }

    .practice-btn {
      @apply flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors;
    }

    .view-all-btn {
      @apply w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors;
    }

    @media (max-width: 1024px) {
      .page-header {
        @apply flex-col gap-4;
      }
    }
  `]
})
export class LearningPathComponent implements OnInit {
  learningPath: LearningPath | null = null;
  loading: boolean = false;
  error: string = '';

  constructor(
    private puzzleService: PuzzleService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadLearningPath();
  }

  async loadLearningPath() {
    this.loading = true;
    this.error = '';

    try {
      this.learningPath = await this.puzzleService.getLearningPath().toPromise() || null;
    } catch (err) {
      console.error('Error loading learning path:', err);
      this.error = 'Failed to load learning path. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  startPuzzle(puzzleId: string) {
    this.router.navigate(['/puzzles', puzzleId]);
  }

  goToPuzzles() {
    this.router.navigate(['/puzzles']);
  }

  formatTheme(theme: string): string {
    return theme.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  getThemes(themesString: string): string[] {
    return themesString.split(' ').slice(0, 2); // Show first 2 themes
  }
}
