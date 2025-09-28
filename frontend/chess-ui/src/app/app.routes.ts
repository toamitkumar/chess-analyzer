import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { Heatmap } from './heatmap/heatmap';
import { Import } from './import/import';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'heatmap', component: Heatmap },
  { path: 'import', component: Import }
];
