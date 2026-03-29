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

## Server Deployment Constraints

This app is deployed on a home server (UbuntuBeast) with auto-deploy from GitHub.
When Jude pushes to `main`, the server pulls and rebuilds automatically within 5 minutes.
The following constraints MUST be respected or the production deployment will break.

### Do NOT change these without coordinating with Dad

**Express port (3001):** The server's reverse proxy (Caddy) and Cloudflare Tunnel
both route traffic to `localhost:3001`. Changing `PORT` in `server.js` or the
Dockerfile `EXPOSE` breaks both access paths. If you need a different port, the
server infrastructure must be updated to match.

**Upload directory (`/app/uploads`):** The server bind-mounts a ZFS storage volume
to `/app/uploads` inside the container. Changing the Multer destination directory
or the Dockerfile `mkdir` path means uploaded files won't persist. The data is safe
on disk — the app just won't find it.

**Database connection defaults:** The server sets `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER`, and `DB_PASSWORD` via environment variables. The defaults in `db.js`
(`localhost`, `5432`, `mediastore`, `postgres`) are only used in local development.
Don't remove the `process.env.*` references or hardcode production values.

**`DB_PASSWORD` startup check:** The `if (!process.env.DB_PASSWORD)` guard in
`server.js` is a safety feature — don't remove it.

### Safe to change freely

- All React components, CSS, and frontend code
- Adding new API routes and controllers
- Adding new npm dependencies (add to both `package.json` and commit `package-lock.json`)
- Adding new environment variables with sensible defaults (the server won't have them
  set unless Dad adds them, so always provide a fallback)
- Creating new database tables using the existing `CREATE TABLE IF NOT EXISTS` pattern
  in `db.js`

### Requires a migration (ask Dad for help)

**Modifying existing database tables** — adding columns, renaming columns, changing
types, adding constraints to tables that already have data. The `CREATE TABLE IF NOT
EXISTS` pattern only runs when the table doesn't exist yet. If you need to change
an existing table's schema, you need an `ALTER TABLE` statement that runs once. This
is called a "database migration" and it's a normal part of backend development —
ask Dad to help you set one up the first time.

### Package lock file

Always commit `package-lock.json` when you add or update dependencies. The server
uses a Dockerfile that calls `npm install` — without a lock file, dependency versions
can drift between your machine and production, causing subtle bugs.

To generate it after adding a dependency:
```bash
cd backend && npm install && cd ../frontend && npm install
```

Then commit both `package-lock.json` files.
