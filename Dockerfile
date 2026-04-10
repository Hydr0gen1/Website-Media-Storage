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

# Install dumb-init, ffmpeg, and yt-dlp.
# pip install is used because the Alpine base image (musl libc) cannot run
# the glibc-linked yt-dlp standalone binaries, and the musl builds have
# inconsistent filenames across releases.  python3 + pip is the reliable path.
RUN apk add --no-cache dumb-init ffmpeg python3 py3-pip && \
    pip3 install --no-cache-dir --break-system-packages yt-dlp

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
