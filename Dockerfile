# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# Vite outputs to ../backend/public (relative to frontend dir) = /app/backend/public
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Install dumb-init and ffmpeg; download the musl-compatible yt-dlp standalone binary
# (the plain 'yt-dlp' release is a Python script and won't run on Alpine without Python)
RUN apk add --no-cache dumb-init ffmpeg wget && \
    ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64)  YTDLP_BIN="yt-dlp_linux_musl" ;; \
      aarch64) YTDLP_BIN="yt-dlp_linux_aarch64_musl" ;; \
      *)        YTDLP_BIN="yt-dlp_linux_musl" ;; \
    esac && \
    ( wget -qO /usr/local/bin/yt-dlp \
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/${YTDLP_BIN}" \
      && chmod +x /usr/local/bin/yt-dlp \
    ) || echo "Warning: yt-dlp download failed — download/subscribe features will be unavailable"

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
