# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# Vite outputs to ../backend/public (relative to frontend dir) = /app/backend/public
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
# node:20-slim (Debian) is used instead of Alpine so that apt packages and
# pip installs are more reliable.  Switching base images busts all layer
# cache and guarantees a clean install of ffmpeg and yt-dlp.
FROM node:20-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init ffmpeg python3 python3-venv && \
    rm -rf /var/lib/apt/lists/* && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir yt-dlp && \
    ln -sf /opt/venv/bin/yt-dlp /usr/local/bin/yt-dlp

WORKDIR /app

# Install backend dependencies (layer cache)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend from stage 1 into backend's public directory
COPY --from=frontend-build /app/backend/public ./public

# Create uploads directory and set ownership
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
