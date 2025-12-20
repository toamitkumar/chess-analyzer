import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Public routes (auth pages)
  {
    path: 'sign-in',
    loadComponent: () => import('./pages/sign-in/sign-in.component').then(m => m.SignInComponent),
    canActivate: [publicGuard]
  },
  {
    path: 'sign-up',
    loadComponent: () => import('./pages/sign-up/sign-up.component').then(m => m.SignUpComponent),
    canActivate: [publicGuard]
  },

  // Protected routes (require authentication)
  {
    path: '',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'upload',
    loadComponent: () => import('./pages/upload/upload.component').then(m => m.UploadComponent),
    canActivate: [authGuard]
  },
  {
    path: 'games',
    loadComponent: () => import('./pages/games/games.component').then(m => m.GamesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'games/:id',
    loadComponent: () => import('./pages/game-detail/game-detail.component').then(m => m.GameDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'tournaments',
    loadComponent: () => import('./pages/tournaments/tournaments.component').then(m => m.TournamentsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'tournaments/:id',
    loadComponent: () => import('./pages/tournament-detail/tournament-detail.component').then(m => m.TournamentDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'blunders',
    loadComponent: () => import('./pages/blunders/blunders.component').then(m => m.BlundersComponent),
    canActivate: [authGuard]
  },

  // 404 page
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
