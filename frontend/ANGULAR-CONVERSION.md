# Angular Conversion

This branch contains the Angular version of the PlayScore Studio React application.

## Key Changes Made

### 1. Project Structure
- Created Angular standalone components architecture
- Converted React components to Angular components
- Implemented Angular routing instead of React Router

### 2. Components Converted

#### Pages:
- `Dashboard` → `DashboardComponent`
- `Games` → `GamesComponent` 
- `Upload` → `UploadComponent`
- `Tournaments` → `TournamentsComponent`
- `GameDetail` → `GameDetailComponent`
- `TournamentDetail` → `TournamentDetailComponent`
- `NotFound` → `NotFoundComponent`

#### Shared Components:
- `Layout` → `LayoutComponent`
- `StatCard` → `StatCardComponent`

### 3. Key Differences from React Version

#### State Management:
- React: `useState` hooks
- Angular: Component properties and methods

#### Routing:
- React: `react-router-dom` with `<Routes>` and `<Route>`
- Angular: `@angular/router` with lazy-loaded components

#### Templates:
- React: JSX with embedded JavaScript
- Angular: HTML templates with Angular directives (`*ngFor`, `*ngIf`, etc.)

#### Styling:
- Maintained the same Tailwind CSS classes
- Used Angular's `[class]` binding for dynamic classes

### 4. Files Structure

```
src/
├── app/
│   ├── components/
│   │   ├── layout/
│   │   └── stat-card/
│   ├── pages/
│   │   ├── dashboard/
│   │   ├── games/
│   │   ├── upload/
│   │   ├── tournaments/
│   │   ├── game-detail/
│   │   ├── tournament-detail/
│   │   └── not-found/
│   ├── app.component.ts
│   └── app.routes.ts
├── main-angular.ts
└── index-angular.html
```

### 5. To Run the Angular Version

1. Install Angular CLI: `npm install -g @angular/cli`
2. Install dependencies: `npm install` (using package-angular.json)
3. Run: `ng serve` (after updating angular.json to point to correct files)

### 6. Missing Features

The following React features need additional Angular implementation:
- Charts (Recharts → Angular charts library)
- Form handling (React Hook Form → Angular Reactive Forms)
- State management (React Query → Angular HTTP Client + RxJS)
- UI components (shadcn/ui → Angular Material or custom components)

### 7. Next Steps

1. Install Angular dependencies
2. Set up proper build configuration
3. Implement missing UI components
4. Add form handling and validation
5. Integrate charts library
6. Add HTTP services for data fetching
