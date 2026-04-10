# Media Storage

A self-hosted media storage and playback app. Users sign in, upload audio/video files, organize them into playlists, subscribe to YouTube channels for automatic downloads, and stream everything from a home server.

The full app is protected behind a login gate — unauthenticated users see only the `LoginPage` component.

## Tech Stack

Node.js 20 · Express · PostgreSQL · React 18 · Vite · Docker · yt-dlp · ffmpeg

## Quick Start

```bash
# Start everything (first run builds images)
export DB_PASSWORD=dev_password
docker compose up --build -d

# Backend dev server (needs local Postgres)
cd backend && npm install && npm run dev

# Frontend dev server (proxies /api to localhost:3001)
cd frontend && npm install && npm run dev

# Build frontend into backend/public
cd frontend && npm run build
```

## Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DB_PASSWORD` | **Yes** | — | Server exits on startup if not set |
| `DB_HOST` | No | `localhost` | Use `db` inside docker-compose |
| `DB_PORT` | No | `5432` | |
| `DB_NAME` | No | `mediastore` | |
| `DB_USER` | No | `postgres` | |
| `PORT` | No | `3001` | Must match Caddy/proxy config |
| `NODE_ENV` | No | — | Set to `production` to serve React build |
| `OAUTH_CALLBACK_BASE_URL` | No | `http://localhost:3001` | Base URL for OAuth provider callbacks |
| `FRONTEND_URL` | No | `http://localhost:5173` | Dev-only redirect target after OAuth |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | No | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | No | — | GitHub OAuth client secret |
| `APPLE_CLIENT_ID` | No | — | Apple Sign In service ID |
| `APPLE_TEAM_ID` | No | — | Apple developer team ID |
| `APPLE_KEY_ID` | No | — | Apple private key ID |
| `APPLE_PRIVATE_KEY` | No | — | Apple ES256 private key (use `\n` for newlines) |

## Key Files

| File | Purpose |
|------|---------|
| `backend/server.js` | Express entry point — trust proxy, security headers, route mounts |
| `backend/db.js` | Postgres pool + all `CREATE TABLE IF NOT EXISTS` schema |
| `backend/scheduler.js` | Daily midnight yt-dlp subscription job |
| `backend/routes/oauth.js` | Google/GitHub/Apple OAuth flows + one-time code exchange |
| `backend/routes/subscriptions.js` | YouTube channel subs + single-URL download |
| `frontend/src/App.jsx` | Root component — auth gate, session restore, all state |
| `frontend/src/App.css` | Single stylesheet — CSS variables, orange dark theme |
| `frontend/src/components/LoginPage.jsx` | Full-screen login shown to unauthenticated users |
| `frontend/src/components/VideoDownloader.jsx` | YouTube URL download request form (Request tab) |

## Navigation Tabs

| Tab | Component | Purpose |
|-----|-----------|---------|
| Files | `ChunkedUploadZone` + `FileList` | Upload and browse files |
| Playlists | `PlaylistPanel` | Manage playlists |
| Request | `VideoDownloader` | Download a single YouTube video by URL |
| Subscriptions | `SubscriptionsManager` | Manage channel subscriptions (auto-downloaded daily) |

## Further Reading

- **`.claude/rules/conventions.md`** — Coding conventions and the "adding new features" checklist. Loaded every session.
- **`.claude/rules/server-constraints.md`** — Production deployment constraints (port, upload path, DB defaults). Loaded every session — read before touching infrastructure.
- **`.claude/docs/architecture.md`** — Backend structure, PostgreSQL schema, frontend overview, Docker notes.
- **`.claude/docs/api-reference.md`** — REST API endpoint reference.
- **`.claude/docs/deployment.md`** — Docker commands, logs, teardown, and hosting notes.
