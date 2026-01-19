import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  // Public routes (auth pages)
  {
    path: 'sign-in',
    loadComponent: () => import('./pages/sign-in/sign-in.component').then(m => m.SignInComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'sign-up',
    loadComponent: () => import('./pages/sign-up/sign-up.component').then(m => m.SignUpComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'auth/login',
    redirectTo: 'sign-in',
    pathMatch: 'full'
  },

  // Protected routes (require authentication)
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
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
    loadComponent: () => import('./pages/game-detail-v2/game-detail-v2.component').then(m => m.GameDetailV2Component),
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
  {
    path: 'insights',
    loadComponent: () => import('./pages/insights/insights.component').then(m => m.InsightsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'puzzles',
    loadComponent: () => import('./pages/puzzles/puzzles.component').then(m => m.PuzzlesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'puzzles/:id',
    loadComponent: () => import('./pages/puzzles/puzzles.component').then(m => m.PuzzlesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'learning-path',
    loadComponent: () => import('./pages/learning-path/learning-path.component').then(m => m.LearningPathComponent),
    canActivate: [authGuard]
  },

  // 404 page
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
