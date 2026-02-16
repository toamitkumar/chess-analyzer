# Docker Setup Guide for ChessPulse

## Quick Start (Production)

Build and run the entire application (backend API + frontend) in Docker:

```bash
# Build the Docker image
docker-compose build

# Start the application
docker-compose up -d

# View logs
docker-compose logs -f chess-analyzer

# Stop the application
docker-compose down
```

The application will be available at **http://localhost:3000**

## What's Included

- **Backend**: Node.js/Express API server (port 3000)
- **Frontend**: Angular static files served by Express
- **Database**: SQLite (persisted in Docker volume `chess_db`)
- **Game Storage**: PGN files mounted in Docker volume `chess_pgns`
- **Chess Engine**: Stockfish (bundled in Alpine image)

## Environment Variables

Create a `.env.docker` file or pass variables to `docker-compose up`:

```bash
# Required (Supabase authentication)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional (PostgreSQL for production)
DATABASE_URL=postgresql://user:password@host:port/dbname

# NODE environment
NODE_ENV=production
PORT=3000
```

Pass to docker-compose:
```bash
docker-compose up -d --env-file .env.docker
```

## Volumes

| Volume | Purpose | Path in Container |
|--------|---------|-------------------|
| `chess_db` | SQLite database | `/app/data` |
| `chess_pgns` | Game PGN files | `/app/Game-PGNs` |
| `chess_logs` | Application logs | `/app/logs` |

To use local directories instead:

```yaml
services:
  chess-analyzer:
    volumes:
      - ./data:/app/data
      - ./Game-PGNs:/app/Game-PGNs
      - ./logs:/app/logs
```

## Development Mode (Hot Reload)

For development with hot reload, use a separate development docker-compose file:

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'
services:
  backend:
    build:
      context: .
      target: backend
    working_dir: /app
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    command: "npm start"
    environment:
      NODE_ENV: development

  frontend:
    working_dir: /app/frontend
    volumes:
      - ./frontend:/app/frontend
      - /app/frontend/node_modules
    ports:
      - "4200:4200"
    command: "npm start"
    environment:
      NODE_ENV: development
```

Run with: `docker-compose -f docker-compose.dev.yml up`

## Troubleshooting

### Container exits immediately
```bash
docker-compose logs chess-analyzer
```
Check for Node.js or dependency errors.

### Cannot connect to port 3000
Ensure no other service is using port 3000:
```bash
lsof -i :3000  # or netstat -tlnp on Linux
```

### Database not persisting
Verify the volume:
```bash
docker volume ls
docker volume inspect chess-analyzer_chess_db
```

### Performance issues
- Stockfish analysis is CPU-intensive. Run on a machine with sufficient compute.
- Consider increasing Docker memory/CPU limits if needed.

## Building for Production

```bash
# With custom tag
docker build -t chess-analyzer:1.0 .

# Push to registry
docker tag chess-analyzer:1.0 your-registry/chess-analyzer:1.0
docker push your-registry/chess-analyzer:1.0

# Run with custom registry
docker run -d -p 3000:3000 your-registry/chess-analyzer:1.0
```

## Health Check

The container includes a health check that verifies the API is responsive:

```bash
docker ps  # Shows container health status

docker-compose ps  # Also shows health status for compose services
```

## Additional Commands

```bash
# View real-time logs
docker-compose logs -f

# Access container shell
docker-compose exec chess-analyzer sh

# Rebuild without cache
docker-compose build --no-cache

# Clean up stopped containers and volumes
docker-compose down -v
```
