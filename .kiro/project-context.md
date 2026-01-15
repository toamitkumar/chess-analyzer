# ChessPulse - Multi-User Chess Analysis Platform

## Project Overview
ChessPulse (formerly Chessify) is a comprehensive chess analysis platform built with Node.js backend and Angular frontend. The platform provides detailed game analysis using the Stockfish engine with multi-user authentication via Supabase.

## Key Architecture Components

### Backend (Node.js)
- **Express API Server**: REST endpoints for game analysis and data
- **Stockfish Integration**: Chess engine for move evaluation and analysis
- **Database**: SQLite/PostgreSQL with Supabase cloud storage
- **Authentication**: Supabase-based user management
- **File Storage**: PGN file upload and processing

### Frontend (Angular 17)
- **Game Detail Components**: 
  - `game-detail.component.ts` - Original comprehensive analysis view
  - `game-detail-v2.component.ts` - Lichess-style PGN viewer implementation
- **Chess Visualization**: Chessground integration for board display
- **Responsive Design**: Tailwind CSS with mobile-first approach

## Recent Major Updates

### 1. Multi-User Authentication Migration
- **Status**: COMPLETED
- **Changes**: Removed hardcoded `TARGET_PLAYER` references
- **Implementation**: Full Supabase authentication integration
- **Documentation**: Updated README.md and configuration files

### 2. Game Detail V2 Component Promotion
- **Status**: COMPLETED - Now primary component
- **Changes**: 
  - Renamed `game-detail-v2` to `game-detail` (primary)
  - Moved original to `game-detail-legacy` (backup)
  - Updated routing to use new component
  - Removed duplicate v2 route
- **Implementation**: Lichess-style PGN viewer is now the default game analysis view

### 3. Alternative Moves Integration
- **Pattern**: Following pgn-viewer option #6 approach
- **Display**: Inline `<variation>` elements within move list
- **Scope**: Shows alternatives for mistakes, inaccuracies, and blunders only
- **Interaction**: All alternatives clickable with position preview

## Key File Locations

### Frontend Components
- `/frontend/src/app/pages/game-detail/` - **PRIMARY** Lichess-style game analysis component
- `/frontend/src/app/pages/game-detail-legacy/` - Original comprehensive analysis component (backup)
- `/frontend/src/app/services/chess-api.service.ts` - API service layer

### Backend API
- `/src/api/api-server.js` - Main Express server
- `/src/models/analyzer.js` - Stockfish chess analysis engine
- `/src/models/database.js` - Database operations
- `/src/config/app-config.js` - Application configuration

### Configuration
- `/.env.example` - Environment variables template
- `/package.json` - Dependencies and scripts
- `/frontend/package.json` - Angular dependencies

## Development Status

### Completed Features
✅ Multi-user authentication with Supabase
✅ PGN file analysis with Stockfish
✅ Game statistics and accuracy calculations
✅ Move quality classification (best, excellent, good, inaccuracy, mistake, blunder)
✅ Alternative moves analysis
✅ Lichess-style game viewer (V2 component)
✅ Responsive design for mobile/desktop
✅ Phase analysis (opening, middlegame, endgame)
✅ Tournament management
✅ Puzzle integration

### Technical Debt Cleanup Needed
- Remove remaining `TARGET_PLAYER` references in test files
- Clean up backup files (`.bak`, `.backup`)
- Update legacy documentation references

## API Endpoints

### Game Analysis
- `GET /api/games/:id/analysis` - Get game with move analysis
- `GET /api/games/:id/alternatives/:moveNumber` - Get alternative moves
- `GET /api/games/:id/accuracy` - Get accuracy statistics
- `GET /api/games/:id/phases` - Get phase analysis

### User Management
- Authentication handled via Supabase client-side
- User-specific data isolation in all endpoints

## Development Commands

```bash
# Backend
npm start                 # Start API server
npm run analyze          # Run chess analyzer CLI
npm test                 # Run test suite

# Frontend
cd frontend
npm start                # Start Angular dev server
npm run build            # Build for production
```

## External Dependencies

### Chess Analysis
- **Stockfish**: Chess engine for position evaluation
- **chess.js**: Chess game logic and validation
- **@lichess-org/chessground**: Board visualization

### UI Framework
- **Angular 17**: Frontend framework
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide Angular**: Icon library

### Database & Auth
- **Supabase**: Authentication and cloud database
- **SQLite3**: Local development database
- **PostgreSQL**: Production database

## Future Enhancements
- Real-time multiplayer analysis
- Advanced opening repertoire management
- Enhanced puzzle recommendation engine
- Mobile app development
- Performance optimizations for large game databases

---
*Last Updated: January 4, 2026*
*Context saved for future development sessions*
