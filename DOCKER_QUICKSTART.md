# ChessPulse Docker Quick Start

## 1. Prerequisites

- Docker and Docker Compose installed (get them from [docker.com](https://www.docker.com/get-started))
- Clone the repository and navigate to the project root

## 2. Setup Environment Variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker` and add your values:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Build & Start (One Command)

```bash
docker-compose up --build
```

This will:
1. Build the Docker image (frontend + backend + dependencies)
2. Start the container
3. Initialize the database
4. Start the API server on port 3000
5. Serve the Angular frontend

**The app will be available at:** http://localhost:3000

## 4. Access the Application

- **Web UI**: http://localhost:3000
- **API Health Check**: http://localhost:3000/api/health
- **Logs**: `docker-compose logs -f`

## 5. Common Operations

### Stop the application
```bash
docker-compose down
```

### Restart after stopping
```bash
docker-compose up
```

### View logs in real-time
```bash
docker-compose logs -f chess-analyzer
```

### Access the container shell
```bash
docker-compose exec chess-analyzer sh
```

### Rebuild after code changes
```bash
docker-compose up --build
```

### Clean up everything (volumes + containers)
```bash
docker-compose down -v
```

## 6. Uploading PGN Files

Once the application is running:

1. Navigate to http://localhost:3000
2. Sign in with your Supabase credentials
3. Go to **Upload** page
4. Upload PGN files or enter games manually
5. The backend will analyze games using Stockfish engine

## 7. File Storage

Game data and databases are persisted in Docker volumes:

- **Database**: `chess_db` volume (SQLite)
- **PGN Games**: `chess_pgns` volume
- **Logs**: `chess_logs` volume

To view where volumes are stored:
```bash
docker volume inspect chess-analyzer_chess_db
```

## 8. Troubleshooting

### "Cannot connect to port 3000"
Check if the container is running:
```bash
docker ps
```

View the logs for errors:
```bash
docker-compose logs chess-analyzer
```

### "Supabase connection failed"
Verify your credentials in `.env.docker` and restart:
```bash
docker-compose restart
```

### "Stockfish not found"
The Dockerfile includes Stockfish (Alpine Linux image). If it fails, ensure the image built successfully:
```bash
docker-compose build --no-cache
```

### Database locked or corrupted
Remove the volume and start fresh:
```bash
docker-compose down -v
docker-compose up --build
```

## 9. Performance Tips

- **CPU**: Stockfish analysis is compute-intensive. Run on a machine with at least 2+ CPU cores.
- **Memory**: Allocate at least 2GB RAM to Docker.
- **Storage**: SQLite will grow with each analyzed game (~100KB per game).

Configure Docker resources in Docker Desktop settings or via `docker-compose`:
```yaml
services:
  chess-analyzer:
    cpus: "2"
    mem_limit: "2g"
```

## 10. Production Deployment

For production deployments (AWS, GCP, Heroku, etc.):

1. Build the image with a tag:
   ```bash
   docker build -t chess-analyzer:1.0 .
   ```

2. Push to your registry (Docker Hub, ECR, GCR, etc.):
   ```bash
   docker push your-registry/chess-analyzer:1.0
   ```

3. Run with environment variables:
   ```bash
   docker run -d \
     -p 3000:3000 \
     -e SUPABASE_URL=${SUPABASE_URL} \
     -e SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY} \
     -v chess_db:/app/data \
     your-registry/chess-analyzer:1.0
   ```

See [DOCKER.md](DOCKER.md) for more advanced setup options.
