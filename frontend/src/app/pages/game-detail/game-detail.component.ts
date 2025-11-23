import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { LayoutComponent } from '../../components/layout/layout.component';
import { ChessBoardComponent } from '../../components/chess-board/chess-board.component';
import { MoveListComponent, EnhancedMove, MoveAnnotation } from '../../components/move-list/move-list.component';
import { MultiVariationAnalysisComponent, Variation } from '../../components/multi-variation-analysis/multi-variation-analysis.component';
import { AlternativesMovesPanelComponent, AlternativeMove } from '../../components/alternative-moves-panel/alternative-moves-panel.component';
import { ChessApiService } from '../../services/chess-api.service';

interface MoveAnalysis {
  move_number: number;
  move: string;
  evaluation: number;
  centipawn_loss: number;
  is_blunder: boolean;
  is_mistake: boolean;
  is_inaccuracy: boolean;
  is_best?: boolean;
  is_excellent?: boolean;
  is_good?: boolean;
  move_quality?: string;
  move_accuracy?: number;
  win_probability_before?: number;
  win_probability_after?: number;
  fen_after: string;
}

interface GameData {
  id: number;
  white_player: string;
  black_player: string;
  result: string;
  date: string;
  event?: string;
  opening?: string;
  pgn_content?: string;
}

interface GameAnalysisResponse {
  game: GameData;
  analysis: MoveAnalysis[];
}

@Component({
  selector: 'app-game-detail',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    LayoutComponent,
    ChessBoardComponent,
    MoveListComponent,
    MultiVariationAnalysisComponent,
    AlternativesMovesPanelComponent
  ],
  template: `
    <app-layout>
      <div class="space-y-6">
        <!-- Loading State -->
        <div *ngIf="loading" class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p class="mt-4 text-gray-600">Loading game analysis...</p>
          </div>
        </div>

        <!-- Error State -->
        <div *ngIf="error && !loading" class="flex items-center justify-center min-h-screen">
          <div class="text-center max-w-md">
            <div class="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Error Loading Game</h2>
            <p class="text-gray-600 mb-4">{{ error }}</p>
            <button
              (click)="goBack()"
              class="inline-flex items-center justify-center rounded-md bg-blue-500 text-white px-4 py-2 hover:bg-blue-600">
              Back to Games
            </button>
          </div>
        </div>

        <!-- Game Content -->
        <div *ngIf="!loading && !error && gameData">
          <!-- Header -->
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button
              (click)="goBack()"
              class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3">
              <svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              <span class="hidden sm:inline">Back to Games</span>
              <span class="sm:hidden">Back</span>
            </button>
            <div class="flex flex-wrap items-center gap-2">
              <span [class]="'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' + getResultBadgeClass()">
                {{ getResultText() }}
              </span>
              <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 gap-1" *ngIf="gameData.event">
                <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/>
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
                {{ gameData.event }}
              </span>
            </div>
          </div>

          <!-- Move List Template (reused for mobile and desktop) -->
          <ng-template #moveListTemplate>
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm h-[calc(100vh-12rem)]">
              <div class="flex flex-col space-y-1.5 p-4 sm:p-6 pb-3">
                <h3 class="text-xl sm:text-2xl font-semibold leading-none tracking-tight">Moves</h3>
              </div>
              <div class="h-[calc(100vh-17rem)]">
                <app-move-list
                  [moves]="enhancedMoves"
                  [currentMoveIndex]="currentMove"
                  (moveSelected)="onMoveSelected($event)"
                  (alternativeSelected)="onAlternativeSelected($event)">
                </app-move-list>
              </div>
            </div>
          </ng-template>

          <!-- Analysis Overview Info -->
          <div class="rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 mb-6 overflow-hidden">
            <div class="flex items-start justify-between p-4 cursor-pointer" (click)="toggleOverview()">
              <div class="flex gap-3 flex-1">
                <div class="flex-shrink-0">
                  <svg class="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div class="flex-1">
                  <h4 class="text-base font-semibold text-blue-900">About Engine Analysis</h4>
                </div>
              </div>
              <svg
                class="h-5 w-5 text-blue-600 transition-transform duration-200 flex-shrink-0 ml-2"
                [class.rotate-180]="overviewExpanded"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </div>
            <div *ngIf="overviewExpanded" class="px-4 pb-4 pt-0">
              <p class="text-sm text-blue-800 ml-9">
                This game has been analyzed by the Stockfish chess engine, the world's strongest chess program. Each move is evaluated and classified (best, excellent, good, inaccuracy, mistake, or blunder). When you click on a mistake or blunder, you'll see alternative moves the engine recommends with explanations. Use keyboard arrows to navigate moves, or click moves in the move list.
              </p>
            </div>
          </div>

          <div class="flex flex-col lg:flex-row gap-6 max-w-[1800px] mx-auto">
            <!-- Left column: Board with vertical probability indicator -->
            <div class="flex-1 space-y-6 min-w-0">
              <!-- Board Card -->
              <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div class="flex flex-col space-y-1.5 p-6">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-2xl font-semibold leading-none tracking-tight">
                        {{ gameData.white_player }} vs {{ gameData.black_player }}
                      </h3>
                      <p class="text-sm text-muted-foreground">
                        {{ gameData.opening || 'Unknown Opening' }} • {{ formatDate(gameData.date) }}
                      </p>
                    </div>
                    <div class="text-right">
                      <div class="text-2xl font-bold text-foreground">{{ gameData.result }}</div>
                      <div class="text-xs text-muted-foreground">{{ getResultDescription() }}</div>
                    </div>
                  </div>
                </div>
                <div class="p-6 pt-0">
                  <div class="space-y-4">
                    <!-- Chess Board -->
                    <div class="w-full">
                      <app-chess-board
                        [moves]="moves"
                        [currentMoveIndex]="currentMove"
                        [whitePlayer]="gameData.white_player"
                        [blackPlayer]="gameData.black_player"
                        (moveChanged)="onMoveChanged($event)">
                      </app-chess-board>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Engine Analysis Info -->
              <div *ngIf="selectedMoveAlternatives.length > 0" class="rounded-lg border bg-blue-50 border-blue-200 mb-4 overflow-hidden">
                <div class="flex items-start justify-between p-4 cursor-pointer" (click)="toggleEngineAnalysis()">
                  <div class="flex gap-3 flex-1">
                    <div class="flex-shrink-0">
                      <svg class="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <div class="flex-1">
                      <h4 class="text-sm font-semibold text-blue-900">Engine Analysis</h4>
                    </div>
                  </div>
                  <svg
                    class="h-5 w-5 text-blue-600 transition-transform duration-200 flex-shrink-0 ml-2"
                    [class.rotate-180]="engineAnalysisExpanded"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div *ngIf="engineAnalysisExpanded" class="px-4 pb-4 pt-0">
                  <p class="text-sm text-blue-800 ml-8">
                    Stockfish engine has analyzed this position to depth {{ selectedMoveDepth }}. The alternatives below show stronger moves you could have played, with their evaluations in centipawns (100cp = 1 pawn advantage). Click any move to see its continuation.
                  </p>
                </div>
              </div>

              <!-- Alternative Moves Panel -->
              <div *ngIf="selectedMoveAlternatives.length > 0" class="rounded-lg border bg-card shadow-sm overflow-hidden">
                <div class="flex items-center justify-between p-4 border-b cursor-pointer hover:bg-gray-50" (click)="toggleAlternativesPanel()">
                  <h3 class="text-lg font-semibold">Alternative Moves</h3>
                  <svg
                    class="h-5 w-5 text-gray-600 transition-transform duration-200"
                    [class.rotate-180]="alternativesPanelExpanded"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div *ngIf="alternativesPanelExpanded">
                  <app-alternative-moves-panel
                    [alternatives]="selectedMoveAlternatives"
                    [currentMoveNumber]="currentMove + 1"
                    [loading]="loadingAlternatives"
                    [analysisDepth]="selectedMoveDepth"
                    [showAnalyzeDeeper]="false"
                    (alternativeSelected)="onAlternativePanelSelected($event)"
                    (alternativePreview)="onAlternativePanelPreview($event)"
                    (deeperAnalysisRequested)="onDeeperAnalysis()">
                  </app-alternative-moves-panel>
                </div>
              </div>

              <!-- Move List on Mobile (appears right after board) -->
              <div class="lg:hidden">
                <ng-container *ngTemplateOutlet="moveListTemplate"></ng-container>
              </div>

              <!-- Multi-Variation Analysis -->
              <div *ngIf="currentMoveVariations.length > 0">
                <!-- Multi-Variation Info -->
                <div class="rounded-lg border bg-purple-50 border-purple-200 mb-4 overflow-hidden">
                  <div class="flex items-start justify-between p-4 cursor-pointer" (click)="toggleMultiVariation()">
                    <div class="flex gap-3 flex-1">
                      <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                        </svg>
                      </div>
                      <div class="flex-1">
                        <h4 class="text-sm font-semibold text-purple-900">Critical Position - Multiple Lines</h4>
                      </div>
                    </div>
                    <svg
                      class="h-5 w-5 text-purple-600 transition-transform duration-200 flex-shrink-0 ml-2"
                      [class.rotate-180]="multiVariationExpanded"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor">
                      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div *ngIf="multiVariationExpanded" class="px-4 pb-4 pt-0">
                    <p class="text-sm text-purple-800 ml-8">
                      This was a critical moment where you made a {{ getCurrentMoveQuality() }}. The engine has calculated multiple possible continuations ranked by strength. The best line (top variation) shows what you should have played. Positive evaluations favor White, negative favor Black.
                    </p>
                  </div>
                </div>

                <app-multi-variation-analysis
                  [variations]="currentMoveVariations"
                  [currentPosition]="getCurrentPosition()"
                  (variationSelected)="onVariationSelected($event)"
                  (movePreview)="onMovePreview($event)">
                </app-multi-variation-analysis>
              </div>

              <!-- Statistics and Phase Analysis -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
                  <div class="flex flex-col space-y-1.5 p-6">
                    <h3 class="text-2xl font-semibold leading-none tracking-tight">Game Statistics</h3>
                  </div>
                  <div class="p-6 pt-0 space-y-4">
                    <div class="space-y-2" *ngIf="accuracyData">
                      <div class="flex justify-between text-sm">
                        <span class="text-muted-foreground">Your Accuracy</span>
                        <span class="font-semibold text-green-600">{{ accuracyData.playerAccuracy }}%</span>
                      </div>
                      <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div class="h-full bg-green-500" [style.width.%]="accuracyData.playerAccuracy"></div>
                      </div>
                    </div>

                    <div class="space-y-2" *ngIf="accuracyData">
                      <div class="flex justify-between text-sm">
                        <span class="text-muted-foreground">Opponent Accuracy</span>
                        <span class="font-semibold">{{ accuracyData.opponentAccuracy }}%</span>
                      </div>
                      <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div class="h-full bg-blue-500" [style.width.%]="accuracyData.opponentAccuracy"></div>
                      </div>
                    </div>

                    <div class="pt-4 space-y-3 border-t border-border">
                      <div class="flex justify-between text-sm">
                        <span class="text-muted-foreground">Avg Centipawn Loss</span>
                        <span class="font-semibold">{{ getAvgCentipawnLoss() }} cp</span>
                      </div>

                      <!-- Move Quality Distribution -->
                      <div class="pt-2 space-y-2">
                        <div class="text-xs font-medium text-muted-foreground mb-2">Move Quality</div>
                        <div class="flex justify-between text-sm">
                          <span class="flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-green-500"></span>
                            Best Moves
                          </span>
                          <span class="font-semibold text-green-600">{{ getBestMoveCount() }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                          <span class="flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-green-400"></span>
                            Excellent
                          </span>
                          <span class="font-semibold text-green-500">{{ getExcellentMoveCount() }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                          <span class="flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                            Good
                          </span>
                          <span class="font-semibold text-blue-600">{{ getGoodMoveCount() }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                          <span class="flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
                            Inaccuracies
                          </span>
                          <span class="font-semibold text-yellow-600">{{ getInaccuracyCount() }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                          <span class="flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-orange-500"></span>
                            Mistakes
                          </span>
                          <span class="font-semibold text-orange-600">{{ getMistakeCount() }}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                          <span class="flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-red-500"></span>
                            Blunders
                          </span>
                          <span class="font-semibold text-red-600">{{ getBlunderCount() }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
                  <div class="flex flex-col space-y-1.5 p-6">
                    <h3 class="text-2xl font-semibold leading-none tracking-tight">Phase Analysis</h3>
                  </div>
                  <div class="p-6 pt-0">
                    <div class="space-y-4" *ngIf="phasesData; else loadingPhases">
                      <!-- Opening Phase -->
                      <div class="p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer"
                           [class.bg-blue-50]="selectedPhase === 'opening'"
                           (click)="selectPhase('opening')">
                        <div class="flex justify-between items-center mb-2">
                          <span class="font-semibold text-sm">Opening</span>
                          <span class="font-semibold text-sm text-green-600">{{ phasesData.opening?.accuracy || 0 }}%</span>
                        </div>
                        <p class="text-xs text-gray-600">{{ phasesData.opening?.description || 'No data' }}</p>
                      </div>

                      <!-- Middlegame Phase -->
                      <div class="p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer"
                           [class.bg-blue-50]="selectedPhase === 'middlegame'"
                           (click)="selectPhase('middlegame')">
                        <div class="flex justify-between items-center mb-2">
                          <span class="font-semibold text-sm">Middlegame</span>
                          <span class="font-semibold text-sm">{{ phasesData.middlegame?.accuracy || 0 }}%</span>
                        </div>
                        <p class="text-xs text-gray-600">{{ phasesData.middlegame?.description || 'No data' }}</p>
                      </div>

                      <!-- Endgame Phase -->
                      <div class="p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer"
                           [class.bg-blue-50]="selectedPhase === 'endgame'"
                           (click)="selectPhase('endgame')">
                        <div class="flex justify-between items-center mb-2">
                          <span class="font-semibold text-sm">Endgame</span>
                          <span class="font-semibold text-sm text-green-600">{{ phasesData.endgame?.accuracy || 0 }}%</span>
                        </div>
                        <p class="text-xs text-gray-600">{{ phasesData.endgame?.description || 'No data' }}</p>
                      </div>
                    </div>
                    <ng-template #loadingPhases>
                      <p class="text-sm text-gray-500">Loading phase analysis...</p>
                    </ng-template>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right column: Move List on Desktop -->
            <div class="hidden lg:block w-[380px]">
              <ng-container *ngTemplateOutlet="moveListTemplate"></ng-container>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `
})
export class GameDetailComponent implements OnInit {
  gameId: number | null = null;
  currentMove = 0;
  selectedPhase: 'opening' | 'middlegame' | 'endgame' = 'opening';

  // API data
  gameData: GameData | null = null;
  moves: MoveAnalysis[] = [];
  enhancedMoves: EnhancedMove[] = [];
  accuracyData: any = null;
  phasesData: any = null;
  currentMoveVariations: Variation[] = [];

  // Alternative moves panel data
  selectedMoveAlternatives: AlternativeMove[] = [];
  loadingAlternatives = false;
  selectedMoveDepth = 12;
  previewFen: string | null = null;

  // UI state
  loading = true;
  error: string | null = null;

  // Collapsible sections state
  overviewExpanded = false;  // Collapsed by default
  engineAnalysisExpanded = false;  // Collapsed by default
  multiVariationExpanded = false;  // Collapsed by default
  alternativesPanelExpanded = true;  // Expanded by default

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ChessApiService
  ) {
    const id = this.route.snapshot.paramMap.get('id');
    this.gameId = id ? parseInt(id, 10) : null;
  }

  ngOnInit() {
    if (this.gameId) {
      this.loadGameData();
    } else {
      this.error = 'Invalid game ID';
      this.loading = false;
    }
  }

  async loadGameData() {
    if (!this.gameId) return;

    try {
      this.loading = true;
      this.error = null;

      // Fetch game analysis data
      const analysisResponse: GameAnalysisResponse = await this.apiService.getGameAnalysis(this.gameId).toPromise();

      if (!analysisResponse || !analysisResponse.game) {
        throw new Error('Game not found');
      }

      this.gameData = analysisResponse.game;
      this.moves = analysisResponse.analysis || [];
      this.enhancedMoves = this.convertToEnhancedMoves();

      // Fetch alternatives for mistakes/blunders and update annotations
      this.loadAlternativesForMistakes();

      // Fetch accuracy data
      this.apiService.getGameAccuracy(this.gameId).subscribe({
        next: (data) => {
          this.accuracyData = data;
        },
        error: (err) => console.error('Error loading accuracy data:', err)
      });

      // Fetch phases data
      this.apiService.getGamePhases(this.gameId).subscribe({
        next: (data) => {
          this.phasesData = data;
        },
        error: (err) => console.error('Error loading phases data:', err)
      });

      this.updateCurrentMoveVariations();
      this.loadAlternativesForCurrentMove();
      this.loading = false;

    } catch (err: any) {
      console.error('Error loading game data:', err);
      this.error = err.message || 'Failed to load game data';
      this.loading = false;
    }
  }

  convertToEnhancedMoves(): EnhancedMove[] {
    return this.moves.map((move, index) => {
      const quality = this.getMoveQuality(move);
      const annotation = this.generateAnnotation(move, index);

      return {
        moveNumber: move.move_number,
        move: move.move,
        evaluation: move.evaluation / 100, // Convert to pawns
        centipawnLoss: move.centipawn_loss,
        moveQuality: quality,
        moveAccuracy: move.move_accuracy,
        winProbabilityBefore: move.win_probability_before,
        winProbabilityAfter: move.win_probability_after,
        annotation: annotation,
        showVariants: false
      };
    });
  }

  generateAnnotation(move: MoveAnalysis, index: number): MoveAnnotation | undefined {
    if (!move.is_blunder && !move.is_mistake && !move.is_inaccuracy) {
      return undefined;
    }

    const prevEval = index > 0 ? this.moves[index - 1].evaluation / 100 : 0;
    const currentEval = move.evaluation / 100;
    const evalChange = `(${prevEval > 0 ? '+' : ''}${prevEval.toFixed(1)} → ${currentEval > 0 ? '+' : ''}${currentEval.toFixed(1)})`;

    let label = 'Inaccuracy';
    if (move.is_blunder) label = 'Blunder';
    else if (move.is_mistake) label = 'Mistake';

    const betterMove = 'Better move was available';

    return {
      evalChange,
      label,
      betterMove,
      alternatives: [] // Will be populated from API
    };
  }

  async loadAlternativesForMistakes() {
    if (!this.gameId) return;

    for (let i = 0; i < this.moves.length; i++) {
      const move = this.moves[i];
      if (move.is_blunder || move.is_mistake || move.is_inaccuracy) {
        try {
          const alternatives = await this.apiService.getGameAlternatives(this.gameId, move.move_number).toPromise();

          if (alternatives && alternatives.alternatives && alternatives.alternatives.length > 0) {
            const bestMove = alternatives.alternatives[0];
            const altMoves = alternatives.alternatives.slice(0, 3).map((alt: any) => alt.move);

            // Update the annotation with real data
            if (this.enhancedMoves[i] && this.enhancedMoves[i].annotation) {
              this.enhancedMoves[i].annotation!.betterMove = `${bestMove.move} was best`;
              this.enhancedMoves[i].annotation!.alternatives = altMoves;
            }
          }
        } catch (error) {
          console.error(`Error loading alternatives for move ${move.move_number}:`, error);
        }
      }
    }
  }

  getMoveQuality(move: MoveAnalysis): 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder' {
    // Use the move_quality from API if available (new Lichess-style analysis)
    if (move.move_quality) {
      const quality = move.move_quality as any;
      if (['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'].includes(quality)) {
        return quality;
      }
    }

    // Fallback to boolean flags
    if (move.is_best) return 'best';
    if (move.is_excellent) return 'excellent';
    if (move.is_good) return 'good';
    if (move.is_blunder) return 'blunder';
    if (move.is_mistake) return 'mistake';
    if (move.is_inaccuracy) return 'inaccuracy';

    // Fallback to centipawn loss calculation
    if (move.centipawn_loss <= 5) return 'best';
    if (move.centipawn_loss <= 10) return 'excellent';
    if (move.centipawn_loss <= 25) return 'good';
    if (move.centipawn_loss <= 50) return 'inaccuracy';
    if (move.centipawn_loss <= 100) return 'mistake';
    if (move.centipawn_loss > 100) return 'blunder';

    return 'book';
  }

  getCurrentEvaluation(): number {
    if (this.currentMove >= 0 && this.currentMove < this.moves.length) {
      return this.moves[this.currentMove].evaluation;
    }
    return 0;
  }

  getCurrentPosition(): string {
    if (this.currentMove >= 0 && this.currentMove < this.moves.length) {
      return this.moves[this.currentMove].fen_after;
    }
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }

  updateCurrentMoveVariations() {
    // Load variations from API when needed
    if (this.currentMove >= 0 && this.currentMove < this.moves.length && this.gameId) {
      const currentMoveData = this.moves[this.currentMove];

      if (currentMoveData.is_blunder || currentMoveData.is_mistake) {
        // Fetch alternatives from API
        this.apiService.getGameAlternatives(this.gameId, currentMoveData.move_number).subscribe({
          next: (data) => {
            if (data.alternatives && data.alternatives.length > 0) {
              this.currentMoveVariations = data.alternatives.map((alt: any, index: number) => ({
                id: `${currentMoveData.move_number}-${index}`,
                moves: alt.line || [alt.move],
                evaluation: alt.evaluation / 100,
                depth: 20, // Default depth
                rank: index + 1,
                isCritical: index === 0,
                description: index === 0 ? 'Best continuation' : `Alternative line #${index + 1}`
              }));
            }
          },
          error: (err) => {
            console.error('Error loading alternatives:', err);
            this.currentMoveVariations = [];
          }
        });
      } else {
        this.currentMoveVariations = [];
      }
    }
  }

  onMoveChanged(moveIndex: number) {
    this.currentMove = moveIndex;
    this.previewFen = null;
    this.updateCurrentMoveVariations();
    this.loadAlternativesForCurrentMove();
  }

  onMoveSelected(moveIndex: number) {
    this.currentMove = moveIndex;
    this.previewFen = null;
    this.updateCurrentMoveVariations();
    this.loadAlternativesForCurrentMove();
  }

  onAlternativeSelected(event: {alternative: string, moveIndex: number}) {
    console.log('Alternative selected:', event.alternative, 'at move', event.moveIndex);
    // TODO: Implement alternative move preview on board
  }

  onVariationSelected(variation: Variation) {
    console.log('Selected variation:', variation);
    // TODO: Implement variation analysis
  }

  onMovePreview(event: {move: string, index: number}) {
    console.log('Preview move:', event.move, 'at index', event.index);
    // TODO: Implement move preview
  }

  loadAlternativesForCurrentMove() {
    if (!this.gameId || this.currentMove < 0 || this.currentMove >= this.moves.length) {
      this.selectedMoveAlternatives = [];
      return;
    }

    const currentMoveData = this.moves[this.currentMove];
    this.loadingAlternatives = true;

    this.apiService.getGameAlternatives(this.gameId, currentMoveData.move_number).subscribe({
      next: (data) => {
        if (data.alternatives && data.alternatives.length > 0) {
          this.selectedMoveAlternatives = data.alternatives.map((alt: any) => ({
            move: alt.move,
            evaluation: alt.evaluation,
            depth: alt.depth || this.selectedMoveDepth,
            line: alt.line || [alt.move],
            rank: alt.rank
          }));
          this.selectedMoveDepth = data.alternatives[0]?.depth || 12;
        } else {
          this.selectedMoveAlternatives = [];
        }
        this.loadingAlternatives = false;
      },
      error: (err) => {
        console.error('Error loading alternatives for current move:', err);
        this.selectedMoveAlternatives = [];
        this.loadingAlternatives = false;
      }
    });
  }

  onAlternativePanelSelected(alternative: AlternativeMove) {
    console.log('Selected alternative from panel:', alternative);
    // Clear preview and show selected alternative info
    this.previewFen = null;
  }

  onAlternativePanelPreview(alternative: AlternativeMove | null) {
    if (alternative && alternative.line && alternative.line.length > 0) {
      // For now, we'll just log the preview.
      // To show on board, we'd need to calculate the resulting FEN after applying the move
      console.log('Preview alternative:', alternative.move, 'line:', alternative.line);
      // TODO: Calculate and set previewFen based on the alternative move
    } else {
      this.previewFen = null;
    }
  }

  onDeeperAnalysis() {
    console.log('Deeper analysis requested');
    // TODO: Implement deeper analysis request to backend
  }

  selectPhase(phase: 'opening' | 'middlegame' | 'endgame') {
    this.selectedPhase = phase;
  }

  goBack() {
    this.router.navigate(['/games']);
  }

  getResultBadgeClass(): string {
    if (!this.gameData) return 'bg-gray-100 text-gray-800';

    if (this.gameData.result === '1-0') {
      return this.gameData.white_player === this.apiService.targetPlayer ?
        'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    } else if (this.gameData.result === '0-1') {
      return this.gameData.black_player === this.apiService.targetPlayer ?
        'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    }
    return 'bg-yellow-100 text-yellow-800';
  }

  getResultText(): string {
    if (!this.gameData) return '';

    if (this.gameData.result === '1-0') {
      return this.gameData.white_player === this.apiService.targetPlayer ? 'Win' : 'Loss';
    } else if (this.gameData.result === '0-1') {
      return this.gameData.black_player === this.apiService.targetPlayer ? 'Win' : 'Loss';
    }
    return 'Draw';
  }

  getResultDescription(): string {
    if (!this.gameData) return '';
    if (this.gameData.result === '1-0') return 'White wins';
    if (this.gameData.result === '0-1') return 'Black wins';
    return 'Draw';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getAvgCentipawnLoss(): number {
    if (this.moves.length === 0) return 0;
    const total = this.moves.reduce((sum, move) => sum + move.centipawn_loss, 0);
    return Math.round(total / this.moves.length);
  }

  getBlunderCount(): number {
    return this.enhancedMoves.filter(m => m.moveQuality === 'blunder').length;
  }

  getMistakeCount(): number {
    return this.enhancedMoves.filter(m => m.moveQuality === 'mistake').length;
  }

  getInaccuracyCount(): number {
    return this.enhancedMoves.filter(m => m.moveQuality === 'inaccuracy').length;
  }

  getBestMoveCount(): number {
    return this.enhancedMoves.filter(m => m.moveQuality === 'best').length;
  }

  getExcellentMoveCount(): number {
    return this.enhancedMoves.filter(m => m.moveQuality === 'excellent').length;
  }

  getGoodMoveCount(): number {
    return this.enhancedMoves.filter(m => m.moveQuality === 'good').length;
  }

  getCurrentMoveQuality(): string {
    if (this.currentMove >= 0 && this.currentMove < this.moves.length) {
      const move = this.moves[this.currentMove];
      if (move.is_blunder) return 'blunder';
      if (move.is_mistake) return 'mistake';
      if (move.is_inaccuracy) return 'inaccuracy';
    }
    return 'suboptimal move';
  }

  toggleOverview() {
    this.overviewExpanded = !this.overviewExpanded;
  }

  toggleEngineAnalysis() {
    this.engineAnalysisExpanded = !this.engineAnalysisExpanded;
  }

  toggleMultiVariation() {
    this.multiVariationExpanded = !this.multiVariationExpanded;
  }

  toggleAlternativesPanel() {
    this.alternativesPanelExpanded = !this.alternativesPanelExpanded;
  }
}
