# Architecture

## Project Structure

```
.
├── backend/
│   ├── server.js          # Express entry point
│   ├── db.js              # Postgres pool + initDB()
│   ├── scheduler.js       # node-schedule daily subscription job
│   ├── middleware/
│   │   └── auth.js        # optionalAuth, requireAuth
│   ├── controllers/       # Pure async handler functions
│   ├── routes/            # Express routers
│   └── public/            # Built React app (generated)
├── frontend/
│   └── src/
│       ├── App.jsx         # Root component, owns all state
│       ├── App.css         # Single stylesheet, CSS variables
│       └── components/
├── docker-compose.yml
└── Dockerfile             # Two-stage build
```

## Backend (`backend/`)

- **`server.js`** — Express entry point. Loads dotenv, validates `DB_PASSWORD`, mounts routes, serves the React build from `public/` in production.
- **`db.js`** — Single `pg.Pool` instance exported as `{ pool, initDB }`. `initDB()` runs all `CREATE TABLE IF NOT EXISTS` statements on startup — no migration tool needed.
- **`middleware/auth.js`** — `optionalAuth` silently attaches `req.user` from a valid DB session. `requireAuth` rejects 401 if `req.user` is missing. Use `optionalAuth, requireAuth` together on protected routes.
- **`controllers/`** — Pure async handler functions, no Express boilerplate. Errors forwarded via `next(err)` to the global handler in `server.js`.
- **`scheduler.js`** — Loaded by `server.js` at startup. Uses `node-schedule` to run a daily midnight job: fetches all rows from `subscriptions`, runs `yt-dlp` per channel (`--dateafter now-7d`), and registers any new files via `registerDownloadedFile()` from `routes/subscriptions.js`.

## PostgreSQL Schema

Tables (all created in `db.js`):

| Table | Key columns |
|-------|-------------|
| `files` | id, filename (uuid), originalfilename, filetype, mimetype, size, uploaddate, filepath |
| `users` | id, username (unique), password_hash, createdat |
| `sessions` | id, userid (FK), token (unique, 64-char hex), expiresat |
| `playlists` | id, userid (FK), name, type (audio\|video), description, createdat, updatedat |
| `playlistitems` | id, playlistid (FK), fileid (FK), position, createdat |
| `subscriptions` | id, user_id (FK), channel_url, channel_name, created_at — UNIQUE(user_id, channel_url) |

PostgreSQL lowercases all unquoted identifiers. Use `formatFileRecord()` / `formatPlaylist()` / `formatItem()` helpers in controllers to map `f.originalfilename → originalFilename` etc.

## Frontend (`frontend/src/`)

- **`App.jsx`** — Owns all application state: `files`, `currentUser`, `authToken`, `playlists`, `activeFile`, `activePlaylist`, `sidebarTab`, toasts. Passes callbacks down; no context or global store.
- **`App.css`** — Single stylesheet for the whole app. CSS variables defined in `:root` — change colours there, not inline. Orange accent system (`--accent-primary: #ff9500`).
- **`components/PlaylistView.jsx`** — Detail view for a single playlist. Receives `playlist` (full object with `.items[]`), `allFiles`, `apiBase`, `authToken`, `onBack`, `onPlay(playlist, items)`, `onPlaylistUpdated(updatedPlaylist)`. Makes its own axios calls for add/remove/reorder, then calls `onPlaylistUpdated` with the refreshed data.
- **`components/MediaPlayer.jsx`** — Receives `file`, `playlist` (active playlist state), `apiBase`, `onNext`, `onPrev`, `onTrackEnd`, `onSelectTrack`, `onClose`, `formatBytes`, `formatDate`. Uses `onNext`/`onPrev` for playlist prev/next buttons.
- **`components/SubscriptionsManager.jsx`** — Renders in the sidebar when the Downloads tab is active. Receives `apiBase`, `authToken`, `onToast`. Three sections: add channel subscription, list/delete subscriptions, download a single video by URL. Makes its own axios calls to `/api/subscriptions`.
- Auth token stored in `localStorage` key `authToken`. On mount, App calls `GET /api/auth/me` to restore the session.
- Axios is used directly (`import axios from 'axios'`); no wrapper. Auth header is built inline: `{ Authorization: \`Bearer ${authToken}\` }`.

## Docker Notes

- The `Dockerfile` is a two-stage build: stage 1 runs `npm run build` in the `frontend/` directory (output goes to `../backend/public`), stage 2 copies the backend and that built output into the runtime image.
- The runtime image installs `ffmpeg` and the `yt-dlp` standalone binary (downloaded via `wget` from the yt-dlp GitHub releases).
- Uploads are stored in `/app/uploads` inside the container, mounted as the `uploads` named volume. yt-dlp downloads go into `/app/uploads/user_<id>/` subdirectories.
- The `db` service uses a health check (`pg_isready`) and the `app` service has `depends_on: db: condition: service_healthy` — the app won't start until Postgres is ready.
