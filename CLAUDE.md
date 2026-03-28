# CLAUDE.md — Media Storage

Dev notes for Claude Code working in this repository.

## Commands

```bash
# Start everything (first run builds images)
export DB_PASSWORD=dev_password
docker compose up --build -d

# Backend dev server (needs a local Postgres running)
cd backend && npm install && npm run dev

# Frontend dev server (proxies /api to localhost:3001)
cd frontend && npm install && npm run dev

# Build frontend into backend/public (for production image)
cd frontend && npm run build

# View logs
docker compose logs -f app
docker compose logs -f db

# Tear down (keep volumes)
docker compose down

# Tear down (destroy volumes)
docker compose down -v
```

## Architecture

### Backend (`backend/`)

- **`server.js`** — Express entry point. Loads dotenv, validates `DB_PASSWORD`, mounts routes, serves the React build from `public/` in production.
- **`db.js`** — Single `pg.Pool` instance exported as `{ pool, initDB }`. `initDB()` runs all `CREATE TABLE IF NOT EXISTS` statements on startup — no migration tool needed.
- **`middleware/auth.js`** — `optionalAuth` silently attaches `req.user` from a valid DB session. `requireAuth` rejects 401 if `req.user` is missing. Use `optionalAuth, requireAuth` together on protected routes.
- **`controllers/`** — Pure async handler functions, no Express boilerplate. Errors forwarded via `next(err)` to the global handler in `server.js`.

### PostgreSQL schema

Tables (all created in `db.js`):

| Table | Key columns |
|-------|-------------|
| `files` | id, filename (uuid), originalfilename, filetype, mimetype, size, uploaddate, filepath |
| `users` | id, username (unique), password_hash, createdat |
| `sessions` | id, userid (FK), token (unique, 64-char hex), expiresat |
| `playlists` | id, userid (FK), name, type (audio\|video), description, createdat, updatedat |
| `playlistitems` | id, playlistid (FK), fileid (FK), position, createdat |

PostgreSQL lowercases all unquoted identifiers. Use `formatFileRecord()` / `formatPlaylist()` / `formatItem()` helpers in controllers to map `f.originalfilename → originalFilename` etc.

### Frontend (`frontend/src/`)

- **`App.jsx`** — Owns all application state: `files`, `currentUser`, `authToken`, `playlists`, `activeFile`, `activePlaylist`, `sidebarTab`, toasts. Passes callbacks down; no context or global store.
- **`App.css`** — Single stylesheet for the whole app. CSS variables defined in `:root` — change colours there, not inline. Orange accent system (`--accent-primary: #ff9500`).
- Auth token stored in `localStorage` key `authToken`. On mount, App calls `GET /api/auth/me` to restore the session.
- Axios is used directly (`import axios from 'axios'`); no wrapper. Auth header is built inline: `{ Authorization: \`Bearer ${authToken}\` }`.

## Key Conventions

- **Column casing** — All DB queries return lowercase column names. Each controller has a `format*` function that remaps to camelCase before sending JSON. Do not spread raw DB rows into responses.
- **File type detection** — Extension whitelist checked in both Multer `fileFilter` (routes) and `getFileType()` (controller). Both must agree.
- **Playlist positions** — Zero-indexed integers. When adding an item, `SELECT COUNT(*)` to get the next position. When reordering, `PUT /api/playlists/:id/reorder` with `{ orderedFileIds }` reassigns 0, 1, 2 … in a transaction.
- **Streaming** — `GET /api/files/:id/download` handles `Range` headers for seekable playback. Always sets `Accept-Ranges: bytes`.
- **No JWT** — Auth uses random 64-char hex tokens stored in the `sessions` table. Token validity is checked on every request by querying `sessions JOIN users WHERE token = $1 AND expiresat > NOW()`.
- **Error handling** — Controllers call `next(err)` for unexpected errors. 4xx errors return `res.status(N).json({ error: 'message' })` directly. The global handler in `server.js` catches everything else.

## Environment Variables

| Variable      | Required | Default     | Notes                                    |
|---------------|----------|-------------|------------------------------------------|
| `DB_PASSWORD` | Yes      | —           | Server exits on startup if not set       |
| `DB_HOST`     | No       | `localhost` | Use `db` inside docker-compose           |
| `DB_PORT`     | No       | `5432`      |                                          |
| `DB_NAME`     | No       | `mediastore`|                                          |
| `DB_USER`     | No       | `postgres`  |                                          |
| `PORT`        | No       | `3001`      |                                          |
| `NODE_ENV`    | No       | —           | Set to `production` to serve React build |

## Adding New Features

1. Add any new tables to the `initDB()` block in `db.js` using `CREATE TABLE IF NOT EXISTS`.
2. Create a controller in `backend/controllers/`, a route file in `backend/routes/`, and register it in `server.js` with `app.use('/api/...', router)`.
3. Protect endpoints with `router.use(optionalAuth, requireAuth)` or per-route.
4. Add frontend components in `frontend/src/components/`. Wire state in `App.jsx`.
5. Add new CSS classes to `App.css` using the existing token variables — no hardcoded colours.

## Docker Notes

- The `Dockerfile` is a two-stage build: stage 1 runs `npm run build` in the `frontend/` directory (output goes to `../backend/public`), stage 2 copies the backend and that built output into the runtime image.
- Uploads are stored in `/app/uploads` inside the container, mounted as the `uploads` named volume.
- The `db` service uses a health check (`pg_isready`) and the `app` service has `depends_on: db: condition: service_healthy` — the app won't start until Postgres is ready.
