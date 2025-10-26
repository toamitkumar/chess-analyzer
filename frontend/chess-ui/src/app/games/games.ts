import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LayoutComponent } from '../components/layout/layout.component';

interface Game {
  id: string;
  white: string;
  black: string;
  result: string;
  date: string;
  opening: string;
  accuracy: {
    white: number;
    black: number;
  };
  blunders: number;
  playerColor: 'white' | 'black';
  tournament?: string;
}

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, LayoutComponent],
  template: `
    <app-layout>
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-foreground">Game Analysis</h1>
            <p class="text-muted-foreground">Review and analyze your chess games</p>
          </div>
          <div class="relative">
            <select 
              [(ngModel)]="filter"
              class="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none">
              <option value="all">All Games</option>
              <option value="wins">Wins Only</option>
              <option value="losses">Losses Only</option>
              <option value="draws">Draws Only</option>
            </select>
            <svg class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
        </div>

        <div class="grid gap-4">
          <div *ngFor="let game of games" 
               class="rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-lg cursor-pointer"
               [routerLink]="['/games', game.id]">
            <div class="p-6">
              <div class="flex items-start justify-between">
                <div class="flex-1 space-y-3">
                  <div class="flex items-center gap-3">
                    <span [class]="'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' + getResultBadgeClass(game.result, game.playerColor)">
                      {{ getResultText(game.result, game.playerColor) }}
                    </span>
                    <span *ngIf="game.tournament" class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 gap-1">
                      <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                        <path d="M4 22h16"/>
                        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                      </svg>
                      {{ game.tournament }}
                    </span>
                    <span class="text-sm text-muted-foreground">{{ game.date }}</span>
                  </div>
                  
                  <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <svg class="h-4 w-4 text-foreground" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M2 20h20l-2-6-4 2-4-4-4 4-4-2z"/>
                          <path d="M6 4l2 4 4-2 4 2 2-4"/>
                        </svg>
                      </div>
                      <div>
                        <p class="text-sm font-medium text-foreground">{{ game.white }}</p>
                        <div class="flex items-center gap-1 text-xs text-muted-foreground">
                          <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <circle cx="12" cy="12" r="6"/>
                            <circle cx="12" cy="12" r="2"/>
                          </svg>
                          {{ game.accuracy.white }}% accuracy
                        </div>
                      </div>
                    </div>
                    
                    <span class="text-muted-foreground">vs</span>
                    
                    <div class="flex items-center gap-2">
                      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                        <svg class="h-4 w-4 text-secondary-foreground" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M2 20h20l-2-6-4 2-4-4-4 4-4-2z"/>
                          <path d="M6 4l2 4 4-2 4 2 2-4"/>
                        </svg>
                      </div>
                      <div>
                        <p class="text-sm font-medium text-foreground">{{ game.black }}</p>
                        <div class="flex items-center gap-1 text-xs text-muted-foreground">
                          <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <circle cx="12" cy="12" r="6"/>
                            <circle cx="12" cy="12" r="2"/>
                          </svg>
                          {{ game.accuracy.black }}% accuracy
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-4 text-sm">
                    <span class="text-muted-foreground">
                      Opening: <span class="text-foreground">{{ game.opening }}</span>
                    </span>
                    <div *ngIf="game.blunders > 0" class="flex items-center gap-1 text-yellow-600">
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                        <path d="M12 9v4"/>
                        <path d="m12 17 .01 0"/>
                      </svg>
                      <span>{{ game.blunders }} blunder{{ game.blunders > 1 ? 's' : '' }}</span>
                    </div>
                  </div>
                </div>

                <button class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10">
                  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </app-layout>
  `
})
export class Games {
  filter = 'all';

  games: Game[] = [
    {
      id: '1',
      white: 'You',
      black: 'Opponent A',
      result: '1-0',
      date: '2024-01-15',
      opening: 'Sicilian Defense, Najdorf',
      accuracy: { white: 89, black: 76 },
      blunders: 2,
      playerColor: 'white'
    },
    {
      id: '2',
      white: 'Opponent B',
      black: 'You',
      result: '0-1',
      date: '2024-01-14',
      opening: "Queen's Gambit Declined",
      accuracy: { white: 72, black: 91 },
      blunders: 1,
      playerColor: 'black',
      tournament: 'Club Championship 2024'
    },
    {
      id: '3',
      white: 'You',
      black: 'Opponent C',
      result: '1/2-1/2',
      date: '2024-01-13',
      opening: 'Ruy Lopez, Berlin Defense',
      accuracy: { white: 85, black: 87 },
      blunders: 0,
      playerColor: 'white'
    },
    {
      id: '4',
      white: 'Opponent D',
      black: 'You',
      result: '1-0',
      date: '2024-01-12',
      opening: "King's Indian Defense",
      accuracy: { white: 88, black: 68 },
      blunders: 4,
      playerColor: 'black',
      tournament: 'Club Championship 2024'
    }
  ];

  getResultBadgeClass(result: string, playerColor: 'white' | 'black'): string {
    const isWin = (result === '1-0' && playerColor === 'white') || 
                  (result === '0-1' && playerColor === 'black');
    const isDraw = result === '1/2-1/2';
    
    if (isWin) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (isDraw) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  }

  getResultText(result: string, playerColor: 'white' | 'black'): string {
    const isWin = (result === '1-0' && playerColor === 'white') || 
                  (result === '0-1' && playerColor === 'black');
    const isDraw = result === '1/2-1/2';
    
    if (isWin) return 'Win';
    if (isDraw) return 'Draw';
    return 'Loss';
  }
}
