import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'tournaments/:tournamentId/games',
    renderMode: RenderMode.Client
  },
  {
    path: 'games/:gameId/analysis',
    renderMode: RenderMode.Client
  },
  {
    path: 'tournaments/:tournamentId/games/:gameId/analysis',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
