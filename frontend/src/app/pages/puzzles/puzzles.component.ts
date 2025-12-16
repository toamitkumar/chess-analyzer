import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { PuzzleService, PuzzleRecommendation, EnhancedRecommendationsResponse } from '../../services/puzzle.service';

@Component({
  selector: 'app-puzzles',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="puzzles-container">
      <div class="page-header">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Puzzle Practice</h1>
          <p class="mt-2 text-gray-600">Improve your tactical skills with personalized puzzles</p>
        </div>
        <div class="flex gap-3">
          <button
            (click)="navigateToLearningPath()"
            class="secondary-btn">
            📊 Learning Path
          </button>
          <button
            (click)="startPractice()"
            [disabled]="loading"
            class="primary-btn">
            {{ loading ? 'Loading...' : '🎯 Start Practice' }}
          </button>
        </div>
      </div>

      <!-- Stats cards -->
      <div *ngIf="recommendations" class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon bg-blue-100 text-blue-600">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div>
            <p class="stat-label">New Puzzles</p>
            <p class="stat-value">{{ recommendations.newCount || 0 }}</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon bg-orange-100 text-orange-600">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <p class="stat-label">For Review</p>
            <p class="stat-value">{{ recommendations.reviewCount || 0 }}</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon bg-green-100 text-green-600">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          </div>
          <div>
            <p class="stat-label">Avg Mastery</p>
            <p class="stat-value">{{ recommendations.adaptiveDifficulty?.avgMastery || 0 }}%</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon bg-purple-100 text-purple-600">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div>
            <p class="stat-label">Difficulty Range</p>
            <p class="stat-value">{{ getDifficultyRange() }}</p>
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <div *ngIf="loading" class="loading-state">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading recommended puzzles...</p>
      </div>

      <!-- Error state -->
      <div *ngIf="error" class="error-state">
        <svg class="h-12 w-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="mt-4 text-gray-700">{{ error }}</p>
        <button (click)="loadRecommendations()" class="retry-btn">
          Try Again
        </button>
      </div>

      <!-- Puzzles list -->
      <div *ngIf="!loading && !error && recommendations" class="puzzles-section">
        <h2 class="section-title">Recommended Puzzles</h2>
        <div class="puzzles-grid">
          <div *ngFor="let puzzle of recommendations.recommendations; let i = index"
               (click)="startPuzzle(puzzle.id)"
               class="puzzle-card">
            <div class="puzzle-card-header">
              <span class="puzzle-number">#{{ i + 1 }}</span>
              <span class="puzzle-rating">{{ puzzle.rating }}</span>
            </div>
            <div class="puzzle-card-body">
              <div class="puzzle-themes">
                <span *ngFor="let theme of getThemes(puzzle.themes)"
                      class="theme-badge">
                  {{ theme }}
                </span>
              </div>
              <div class="puzzle-stats">
                <span class="stat-item">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                  {{ puzzle.popularity }}%
                </span>
              </div>
            </div>
            <div class="puzzle-card-footer">
              <button class="play-btn">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Practice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .puzzles-container {
      @apply max-w-7xl mx-auto p-4;
    }

    .page-header {
      @apply flex items-start justify-between mb-8;
    }

    .primary-btn {
      @apply px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors;
      @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
    }

    .primary-btn:disabled {
      @apply opacity-50 cursor-not-allowed;
    }

    .secondary-btn {
      @apply px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition-colors;
      @apply focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2;
    }

    .stats-grid {
      @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8;
    }

    .stat-card {
      @apply flex items-center gap-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4;
    }

    .stat-icon {
      @apply flex items-center justify-center w-12 h-12 rounded-lg;
    }

    .stat-label {
      @apply text-sm text-gray-600;
    }

    .stat-value {
      @apply text-2xl font-bold text-gray-900;
    }

    .loading-state, .error-state {
      @apply flex flex-col items-center justify-center py-20 bg-white rounded-lg shadow-sm border border-gray-200;
    }

    .retry-btn {
      @apply mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors;
    }

    .puzzles-section {
      @apply bg-white rounded-lg shadow-sm border border-gray-200 p-6;
    }

    .section-title {
      @apply text-xl font-bold text-gray-900 mb-4;
    }

    .puzzles-grid {
      @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4;
    }

    .puzzle-card {
      @apply bg-gradient-to-br from-white to-gray-50 rounded-lg border border-gray-200 p-4;
      @apply hover:shadow-md hover:border-blue-300 transition-all cursor-pointer;
    }

    .puzzle-card-header {
      @apply flex items-center justify-between mb-3;
    }

    .puzzle-number {
      @apply text-sm font-semibold text-gray-500;
    }

    .puzzle-rating {
      @apply px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded;
    }

    .puzzle-card-body {
      @apply mb-3;
    }

    .puzzle-themes {
      @apply flex flex-wrap gap-1 mb-2;
    }

    .theme-badge {
      @apply px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded;
    }

    .puzzle-stats {
      @apply flex items-center gap-2 text-sm text-gray-600;
    }

    .stat-item {
      @apply flex items-center gap-1;
    }

    .puzzle-card-footer {
      @apply flex justify-end;
    }

    .play-btn {
      @apply flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors;
    }

    @media (max-width: 640px) {
      .page-header {
        @apply flex-col gap-4;
      }

      .stats-grid {
        @apply grid-cols-2;
      }
    }
  `]
})
export class PuzzlesComponent implements OnInit {
  recommendations: EnhancedRecommendationsResponse | null = null;
  loading: boolean = false;
  error: string = '';
  blunderId: number | null = null;

  constructor(
    private puzzleService: PuzzleService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Check if we have a blunder ID in query params
    this.route.queryParams.subscribe(params => {
      if (params['blunder']) {
        this.blunderId = parseInt(params['blunder'], 10);
        this.loadBlunderPuzzles(this.blunderId);
      } else {
        this.loadRecommendations();
      }
    });
  }

  async loadBlunderPuzzles(blunderId: number) {
    this.loading = true;
    this.error = '';

    try {
      const response = await this.puzzleService.getPuzzlesForBlunder(blunderId).toPromise();
      // Convert blunder puzzles response to recommendations format
      this.recommendations = {
        recommendations: response?.puzzles || [],
        adaptiveDifficulty: {
          min: 1400,
          max: 1800,
          adjustment: 0,
          successRate: 0,
          avgMastery: 0
        },
        reviewCount: 0,
        newCount: response?.puzzles?.length || 0
      };
    } catch (err) {
      console.error('Error loading blunder puzzles:', err);
      this.error = 'Failed to load puzzles for this blunder. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async loadRecommendations() {
    this.loading = true;
    this.error = '';

    try {
      const response = await this.puzzleService.getRecommendations(12, undefined, true).toPromise();
      this.recommendations = response as EnhancedRecommendationsResponse;
    } catch (err) {
      console.error('Error loading recommendations:', err);
      this.error = 'Failed to load puzzle recommendations. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  startPuzzle(puzzleId: string) {
    this.router.navigate(['/puzzles', puzzleId]);
  }

  startPractice() {
    if (this.recommendations && this.recommendations.recommendations.length > 0) {
      const firstPuzzle = this.recommendations.recommendations[0];
      this.startPuzzle(firstPuzzle.id);
    }
  }

  navigateToLearningPath() {
    this.router.navigate(['/learning-path']);
  }

  getThemes(themesString: string): string[] {
    return themesString.split(' ').slice(0, 3); // Show first 3 themes
  }

  getDifficultyRange(): string {
    if (!this.recommendations?.adaptiveDifficulty) {
      return 'N/A';
    }
    const { min, max } = this.recommendations.adaptiveDifficulty;
    return `${min}-${max}`;
  }
}
