import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'upload', loadComponent: () => import('./pages/upload/upload.component').then(m => m.UploadComponent) },
  { path: 'games', loadComponent: () => import('./pages/games/games.component').then(m => m.GamesComponent) },
  { path: 'games/:id', loadComponent: () => import('./pages/game-detail/game-detail.component').then(m => m.GameDetailComponent) },
  { path: 'tournaments', loadComponent: () => import('./pages/tournaments/tournaments.component').then(m => m.TournamentsComponent) },
  { path: 'tournaments/:id', loadComponent: () => import('./pages/tournament-detail/tournament-detail.component').then(m => m.TournamentDetailComponent) },
  { path: '**', loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent) }
];
