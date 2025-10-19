import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { Heatmap } from './heatmap/heatmap';
import { Import } from './import/import';
import { GamesPageComponent } from './games/games-page.component';
import { GameAnalysisComponent } from './game-analysis/game-analysis.component';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'heatmap', component: Heatmap },
  { path: 'import', component: Import },
  { path: 'games', component: GamesPageComponent },
  { 
    path: 'tournaments/:tournamentId/games', 
    component: GamesPageComponent,
    data: { prerender: false }
  },
  { 
    path: 'games/:gameId/analysis', 
    component: GameAnalysisComponent,
    data: { prerender: false }
  },
  { 
    path: 'tournaments/:tournamentId/games/:gameId/analysis', 
    component: GameAnalysisComponent,
    data: { prerender: false }
  }
];
