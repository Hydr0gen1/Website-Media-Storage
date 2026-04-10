# Media Storage

A self-hosted media storage and streaming app. Upload audio and video files, organize them into playlists, subscribe to YouTube channels for automatic downloads, and stream everything from your own server.

## Features

### Authentication
- **Login gate** — the full app is protected behind a sign-in screen; no content is visible to unauthenticated users
- **Local accounts** — register with a username and password (bcrypt-hashed, minimum 6 characters)
- **OAuth sign-in** — Google, GitHub, and Apple OAuth 2.0; tokens are exchanged via a secure one-time code (never exposed in the URL)
- **30-day sessions** — tokens stored in the database and persisted in `localStorage`

### Media Library
- Upload `.mov`, `.mp4`, `.mp3`, `.wav`, `.ogg` files up to 2 GB each
- Chunked upload with per-file progress bars and drag-and-drop support
- Inline video and audio streaming with Range-request support (fully seekable)
- File browser sorted by date, name, or size (asc/desc toggle)
- Delete files with confirmation dialog

### Playlists
- Create audio or video playlists, add/remove files, drag-to-reorder tracks
- Playlist player with queue view, Prev/Next controls, and auto-advance on track end
- Per-file context menu to add directly to a compatible playlist

### YouTube Integration
- **Subscribe** to YouTube channels — new uploads are automatically downloaded daily at midnight
- **Request tab** — paste any YouTube URL to download a single video on demand (runs in the background)

### Security
- Security headers on every response: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and HSTS in production
- Rate limiting on auth endpoints
- All file and playlist operations are user-scoped — users can only access their own data

---

## Tech Stack

| Layer    | Technology                                        |
|----------|---------------------------------------------------|
| Backend  | Node.js 20, Express, Multer, pg, bcrypt, jsonwebtoken |
| Frontend | React 18, Vite, axios                             |
| Database | PostgreSQL 16                                     |
| Media    | yt-dlp, ffmpeg                                    |
| Deploy   | Docker, docker-compose                            |

---

## Quick Start

### Prerequisites

- Docker and Docker Compose

### 1. Clone and configure

```bash
git clone <repo-url>
cd Website-Media-Storage
```

**`DB_PASSWORD` is required** — the server exits on startup without it.

```bash
# Option A: environment variable
export DB_PASSWORD=your_strong_password

# Option B: .env file
echo "DB_PASSWORD=your_strong_password" > backend/.env
```

### 2. Start all services

```bash
docker compose up --build -d
```

The app is available at **http://localhost:3001**.

### 3. Stop

```bash
docker compose down          # stop containers, keep data
docker compose down -v       # stop containers and delete all data volumes
```

---

## Local Development

```bash
# Backend (requires a local Postgres instance)
cd backend
cp .env.example .env          # set DB_HOST=localhost + DB_PASSWORD
npm install
npm run dev                   # runs on :3001

# Frontend (proxies /api to :3001)
cd frontend
npm install
npm run dev                   # runs on :5173

# Build frontend into backend/public (for production testing)
cd frontend && npm run build
```

---

## Configuration

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DB_PASSWORD` | **Yes** | — | Server exits on startup if missing |
| `DB_HOST` | No | `localhost` | Use `db` inside docker-compose |
| `DB_PORT` | No | `5432` | |
| `DB_NAME` | No | `mediastore` | |
| `DB_USER` | No | `postgres` | |
| `PORT` | No | `3001` | Must match your reverse proxy config |
| `NODE_ENV` | No | — | Set to `production` to serve the React build |
| `OAUTH_CALLBACK_BASE_URL` | No | `http://localhost:3001` | Base URL OAuth providers redirect back to |
| `FRONTEND_URL` | No | `http://localhost:5173` | Dev-only: where to redirect after OAuth |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth app client secret |
| `GITHUB_CLIENT_ID` | No | — | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | No | — | GitHub OAuth app client secret |
| `APPLE_CLIENT_ID` | No | — | Apple Sign In service ID |
| `APPLE_TEAM_ID` | No | — | Apple developer team ID |
| `APPLE_KEY_ID` | No | — | Apple private key ID |
| `APPLE_PRIVATE_KEY` | No | — | Apple ES256 private key (use `\n` for newlines) |

---

## Hosting

### Self-Hosted (Recommended — what this app is designed for)

The production deployment uses **Caddy** as a reverse proxy with a **Cloudflare Tunnel** for HTTPS — no open ports required. If you prefer Nginx or a VPS, the standard approach works too.

#### With Caddy + Cloudflare Tunnel

```
Caddy → localhost:3001
```

Caddy handles HTTPS automatically. Add to your `Caddyfile`:

```
yourdomain.com {
    reverse_proxy localhost:3001
}
```

Set `trust proxy` is already configured in `server.js` so rate limiting and IP detection work correctly behind Caddy.

#### With Nginx + Let's Encrypt

```bash
sudo apt install nginx certbot python3-certbot-nginx

# Create /etc/nginx/sites-available/mediastore
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

sudo ln -s /etc/nginx/sites-available/mediastore /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo certbot --nginx -d yourdomain.com
```

#### Dynamic DNS

If your home IP changes, use **DuckDNS** with `ddclient` to keep your domain pointed at the right address.

---

### Security Checklist

- [ ] HTTPS enabled (Let's Encrypt or Cloudflare)
- [ ] Firewall configured (`ufw` — only allow ports you use)
- [ ] SSH key auth only (disable password login in `/etc/ssh/sshd_config`)
- [ ] System updates scheduled (`sudo apt update && sudo apt upgrade`)
- [ ] Database backups automated (see below)

---

## Data Storage & Backups

### Where Data Lives

| What | Docker volume | Location on host |
|------|---------------|-----------------|
| File metadata | `website-media-storage_pgdata` | `/var/lib/docker/volumes/website-media-storage_pgdata/_data/` |
| Uploaded & downloaded media | `website-media-storage_uploads` | `/var/lib/docker/volumes/website-media-storage_uploads/_data/` |

Data persists across restarts. Only `docker compose down -v` destroys volumes.

### Backup the Database

```bash
# Manual
docker exec website-media-storage-db-1 pg_dump -U postgres -d mediastore | gzip > mediastore_$(date +%Y%m%d).sql.gz

# Automated daily cron (2 AM)
0 2 * * * docker exec website-media-storage-db-1 pg_dump -U postgres -d mediastore | gzip > ~/backups/mediastore_$(date +\%Y\%m\%d).sql.gz
```

### Backup Uploaded Files

```bash
# Simple tar
tar -czf uploads_$(date +%Y%m%d).tar.gz /var/lib/docker/volumes/website-media-storage_uploads/_data/

# Incremental rsync
rsync -avz /var/lib/docker/volumes/website-media-storage_uploads/_data/ /path/to/backup/
```

### Restore

```bash
# Restore database
docker compose up -d db
gunzip < mediastore_backup.sql.gz | docker exec -i website-media-storage-db-1 psql -U postgres -d mediastore
docker compose up -d

# Restore files
docker compose down
docker volume rm website-media-storage_uploads
tar -xzf uploads_backup.tar.gz -C /var/lib/docker/volumes/
docker compose up -d
```

### Monitor Usage

```bash
df -h
du -sh /var/lib/docker/volumes/website-media-storage_*/_data/
docker volume ls
```

---

## API Reference

All endpoints except auth and OAuth require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account `{ username, password }` |
| `POST` | `/api/auth/login` | Sign in, returns `{ user, token }` |
| `GET` | `/api/auth/me` | Return current user |
| `POST` | `/api/auth/logout` | Invalidate session |

### OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/oauth/google` | Redirect to Google sign-in |
| `GET` | `/api/auth/oauth/github` | Redirect to GitHub sign-in |
| `GET` | `/api/auth/oauth/apple` | Redirect to Apple sign-in |
| `POST` | `/api/auth/oauth/exchange` | Exchange one-time code for session token `{ code }` |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/files` | List files — `?sort=date\|name\|size&order=asc\|desc` |
| `POST` | `/api/files/upload` | Upload file (multipart/form-data, field: `file`) |
| `GET` | `/api/files/:id/download` | Stream file (supports `Range` header) |
| `DELETE` | `/api/files/:id` | Delete file |
| `POST` | `/api/chunks/init` | Init chunked upload session |
| `POST` | `/api/chunks/upload` | Upload a chunk |
| `POST` | `/api/chunks/finalize` | Finalize and assemble chunks |

### Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/subscriptions` | List channel subscriptions |
| `POST` | `/api/subscriptions` | Subscribe to channel `{ channelUrl, channelName? }` |
| `DELETE` | `/api/subscriptions/:id` | Remove subscription |
| `POST` | `/api/subscriptions/download-url` | Download video by URL `{ videoUrl }` (background) |

### Playlists

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/playlists` | List playlists with item counts |
| `POST` | `/api/playlists` | Create playlist `{ name, type, description? }` |
| `GET` | `/api/playlists/:id` | Get playlist with ordered items |
| `PUT` | `/api/playlists/:id` | Update name/description |
| `DELETE` | `/api/playlists/:id` | Delete playlist (files kept) |
| `POST` | `/api/playlists/:id/items` | Add file `{ fileId }` |
| `DELETE` | `/api/playlists/:id/items/:fid` | Remove item |
| `PUT` | `/api/playlists/:id/reorder` | Reorder `{ orderedFileIds: [...] }` |

---

## Project Structure

```
├── backend/
│   ├── server.js                     # Express entry point, security headers, route registration
│   ├── db.js                         # PostgreSQL pool + schema init (CREATE TABLE IF NOT EXISTS)
│   ├── scheduler.js                  # Daily midnight yt-dlp subscription downloads
│   ├── middleware/
│   │   └── auth.js                   # optionalAuth / requireAuth middleware
│   ├── routes/
│   │   ├── auth.js                   # Login, register, logout, me
│   │   ├── oauth.js                  # Google / GitHub / Apple OAuth flows + code exchange
│   │   ├── files.js                  # Multer config, file CRUD, streaming
│   │   ├── playlists.js              # Playlist CRUD + item management
│   │   └── subscriptions.js          # YouTube channel subscriptions + URL download
│   ├── controllers/
│   │   ├── authController.js         # Register, login, logout, me
│   │   ├── fileController.js         # Upload, list, delete, stream
│   │   ├── chunkController.js        # Chunked upload (init / upload / finalize)
│   │   └── playlistController.js     # Playlist CRUD + reorder
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Root component — all state, auth gate, session restore
│   │   ├── App.css                   # Design system (CSS variables, orange dark theme)
│   │   └── components/
│   │       ├── LoginPage.jsx         # Full-screen auth gate (shown when not logged in)
│   │       ├── AuthModal.jsx         # In-app login/register modal with OAuth buttons
│   │       ├── ChunkedUploadZone.jsx # Drag-and-drop chunked upload with progress bars
│   │       ├── FileList.jsx          # File browser with sort controls and playlist menu
│   │       ├── MediaPlayer.jsx       # Video/audio player with playlist queue
│   │       ├── PlaylistPanel.jsx     # Sidebar playlist list + create form
│   │       ├── PlaylistView.jsx      # Playlist detail view with reorder and add-files
│   │       ├── SubscriptionsManager.jsx # YouTube channel subscription management
│   │       └── VideoDownloader.jsx   # Single-video YouTube download request form
│   ├── vite.config.js
│   └── index.html
├── Dockerfile                        # Two-stage build: React → backend/public
├── docker-compose.yml                # App + PostgreSQL services + named volumes
├── .dockerignore
└── .claude/                          # Claude Code session docs (not shipped)
    ├── CLAUDE.md
    ├── docs/
    │   ├── architecture.md
    │   ├── api-reference.md
    │   └── deployment.md
    └── rules/
        ├── conventions.md
        └── server-constraints.md
```
