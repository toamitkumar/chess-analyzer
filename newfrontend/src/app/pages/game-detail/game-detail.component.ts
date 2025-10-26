import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LayoutComponent } from '../../components/layout/layout.component';

interface Move {
  move: number;
  white: string;
  black: string;
  whiteEval: number;
  blackEval: number;
  whiteQuality: string;
  blackQuality: string;
}

@Component({
  selector: 'app-game-detail',
  standalone: true,
  imports: [CommonModule, LayoutComponent],
  template: `
    <app-layout>
      <div class="space-y-6">
        <div class="flex items-center gap-4">
          <button
            (click)="goBack()"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3">
            <svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back to Games
          </button>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
              Win
            </span>
            <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 gap-1">
              <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
              </svg>
              Club Championship 2024
            </span>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2 space-y-6">
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div class="flex flex-col space-y-1.5 p-6">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-2xl font-semibold leading-none tracking-tight">You vs Opponent A</h3>
                    <p class="text-sm text-muted-foreground">Sicilian Defense, Najdorf • 2024-01-15</p>
                  </div>
                  <div class="text-right">
                    <div class="text-2xl font-bold text-foreground">1-0</div>
                    <div class="text-xs text-muted-foreground">White wins</div>
                  </div>
                </div>
              </div>
              <div class="p-6 pt-0">
                <div class="space-y-4">
                  <!-- Chess board placeholder -->
                  <div class="aspect-square w-full rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center border border-border">
                    <div class="text-center space-y-2">
                      <div class="text-6xl">♔</div>
                      <p class="text-sm text-muted-foreground">Interactive chess board</p>
                      <p class="text-xs text-muted-foreground">Move {{ currentMove + 1 }} of {{ moves.length }}</p>
                    </div>
                  </div>

                  <!-- Move controls -->
                  <div class="flex items-center justify-center gap-2">
                    <button
                      (click)="setCurrentMove(0)"
                      [disabled]="currentMove === 0"
                      class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10">
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="19,20 9,12 19,4"/>
                        <line x1="5" x2="5" y1="19" y2="5"/>
                      </svg>
                    </button>
                    <button
                      (click)="previousMove()"
                      [disabled]="currentMove === 0"
                      class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10">
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m15 18-6-6 6-6"/>
                      </svg>
                    </button>
                    <span class="mx-4 text-sm font-medium">
                      {{ currentMove + 1 }} / {{ moves.length }}
                    </span>
                    <button
                      (click)="nextMove()"
                      [disabled]="currentMove === moves.length - 1"
                      class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10">
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </button>
                    <button
                      (click)="setCurrentMove(moves.length - 1)"
                      [disabled]="currentMove === moves.length - 1"
                      class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10">
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="5,4 15,12 5,20"/>
                        <line x1="19" x2="19" y1="5" y2="19"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div class="flex flex-col space-y-1.5 p-6">
                <h3 class="text-2xl font-semibold leading-none tracking-tight">Move List</h3>
              </div>
              <div class="p-6 pt-0">
                <div class="space-y-2">
                  <div *ngFor="let move of moves; let idx = index"
                       [class]="'grid grid-cols-[60px_1fr_1fr] gap-4 rounded-lg border p-3 cursor-pointer transition-colors ' + 
                         (currentMove === idx ? 'border-blue-500 bg-blue-50' : 'border-border hover:bg-muted/50')"
                       (click)="setCurrentMove(idx)">
                    <div class="font-medium text-muted-foreground">
                      {{ move.move }}.
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-medium">{{ move.white }}</span>
                      <ng-container [ngSwitch]="move.whiteQuality">
                        <svg *ngSwitchCase="'blunder'" class="h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                          <path d="M12 9v4"/>
                          <path d="m12 17 .01 0"/>
                        </svg>
                        <svg *ngSwitchCase="'inaccuracy'" class="h-4 w-4 text-yellow-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="m12 8v4"/>
                          <path d="m12 16 .01 0"/>
                        </svg>
                        <svg *ngSwitchCase="'excellent'" class="h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22,4 12,14.01 9,11.01"/>
                        </svg>
                        <svg *ngSwitchCase="'good'" class="h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22,4 12,14.01 9,11.01"/>
                        </svg>
                      </ng-container>
                      <span [class]="'text-xs ' + getQualityColor(move.whiteQuality)">
                        {{ move.whiteEval > 0 ? '+' : '' }}{{ move.whiteEval.toFixed(1) }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-medium">{{ move.black }}</span>
                      <ng-container [ngSwitch]="move.blackQuality">
                        <svg *ngSwitchCase="'blunder'" class="h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                          <path d="M12 9v4"/>
                          <path d="m12 17 .01 0"/>
                        </svg>
                        <svg *ngSwitchCase="'inaccuracy'" class="h-4 w-4 text-yellow-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="m12 8v4"/>
                          <path d="m12 16 .01 0"/>
                        </svg>
                        <svg *ngSwitchCase="'excellent'" class="h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22,4 12,14.01 9,11.01"/>
                        </svg>
                        <svg *ngSwitchCase="'good'" class="h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22,4 12,14.01 9,11.01"/>
                        </svg>
                      </ng-container>
                      <span [class]="'text-xs ' + getQualityColor(move.blackQuality)">
                        {{ move.blackEval > 0 ? '+' : '' }}{{ move.blackEval.toFixed(1) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div class="flex flex-col space-y-1.5 p-6">
                <h3 class="text-2xl font-semibold leading-none tracking-tight">Game Statistics</h3>
              </div>
              <div class="p-6 pt-0 space-y-4">
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">Your Accuracy</span>
                    <span class="font-semibold text-green-600">89%</span>
                  </div>
                  <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div class="h-full bg-green-500" style="width: 89%"></div>
                  </div>
                </div>
                
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">Opponent Accuracy</span>
                    <span class="font-semibold">76%</span>
                  </div>
                  <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div class="h-full bg-blue-500" style="width: 76%"></div>
                  </div>
                </div>

                <div class="pt-4 space-y-3 border-t border-border">
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">Blunders</span>
                    <span class="font-semibold">2</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">Inaccuracies</span>
                    <span class="font-semibold">1</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">Game Length</span>
                    <span class="font-semibold">{{ moves.length }} moves</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `
})
export class GameDetailComponent {
  gameId: string | null = null;
  currentMove = 0;

  moves: Move[] = [
    { move: 1, white: "e4", black: "c5", whiteEval: 0.3, blackEval: 0.2, whiteQuality: "book", blackQuality: "book" },
    { move: 2, white: "Nf3", black: "d6", whiteEval: 0.3, blackEval: 0.3, whiteQuality: "book", blackQuality: "book" },
    { move: 3, white: "d4", black: "cxd4", whiteEval: 0.4, blackEval: 0.4, whiteQuality: "book", blackQuality: "book" },
    { move: 4, white: "Nxd4", black: "Nf6", whiteEval: 0.5, blackEval: 0.5, whiteQuality: "excellent", blackQuality: "excellent" },
    { move: 5, white: "Nc3", black: "a6", whiteEval: 0.6, blackEval: 0.5, whiteQuality: "good", blackQuality: "good" },
    { move: 6, white: "Be3", black: "e5", whiteEval: 0.7, blackEval: -0.2, whiteQuality: "good", blackQuality: "inaccuracy" },
    { move: 7, white: "Nb3", black: "Be6", whiteEval: 1.2, blackEval: -1.5, whiteQuality: "excellent", blackQuality: "blunder" },
  ];

  constructor(private route: ActivatedRoute, private router: Router) {
    this.gameId = this.route.snapshot.paramMap.get('id');
  }

  goBack() {
    this.router.navigate(['/games']);
  }

  setCurrentMove(move: number) {
    this.currentMove = move;
  }

  previousMove() {
    this.currentMove = Math.max(0, this.currentMove - 1);
  }

  nextMove() {
    this.currentMove = Math.min(this.moves.length - 1, this.currentMove + 1);
  }

  getQualityColor(quality: string): string {
    switch (quality) {
      case 'blunder':
        return 'text-red-600';
      case 'inaccuracy':
        return 'text-yellow-600';
      case 'excellent':
      case 'good':
        return 'text-green-600';
      default:
        return 'text-muted-foreground';
    }
  }
}
