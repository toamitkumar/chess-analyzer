# Multi-stage Dockerfile for ChessPulse
# Stage 1: Build frontend (Angular)
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend .
RUN npm run build

# Stage 2: Backend + Frontend served together
FROM node:20-alpine
WORKDIR /app

# Install system dependencies for Stockfish and general use
RUN apk add --no-cache \
    stockfish \
    curl \
    dumb-init \
    sqlite

# Copy backend package files
COPY package*.json ./
RUN npm ci --only=production

# Copy backend source code
COPY src ./src
COPY data ./data

# Copy frontend build output (to be served by Express)
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create necessary directories
RUN mkdir -p data logs

# Expose ports
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals correctly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the backend API server (which also serves frontend as static files)
CMD ["npm", "start"]
