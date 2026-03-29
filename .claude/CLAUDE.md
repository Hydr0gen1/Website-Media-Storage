# Media Storage

A self-hosted media storage and playback app. Users upload audio/video files, organize them into playlists, and stream them from a home server.

## Tech Stack

Node.js · Express · PostgreSQL · React · Vite · Docker

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

| Variable      | Required | Default      | Notes                                    |
|---------------|----------|--------------|------------------------------------------|
| `DB_PASSWORD` | Yes      | —            | Server exits on startup if not set       |
| `DB_HOST`     | No       | `localhost`  | Use `db` inside docker-compose           |
| `DB_PORT`     | No       | `5432`       |                                          |
| `DB_NAME`     | No       | `mediastore` |                                          |
| `DB_USER`     | No       | `postgres`   |                                          |
| `PORT`        | No       | `3001`       |                                          |
| `NODE_ENV`    | No       | —            | Set to `production` to serve React build |

## Further Reading

- **`.claude/rules/conventions.md`** — Coding conventions and the "adding new features" checklist. Loaded every session.
- **`.claude/rules/server-constraints.md`** — Production deployment constraints (port, upload path, DB defaults). Loaded every session — read before touching infrastructure.
- **`.claude/docs/architecture.md`** — Backend structure, PostgreSQL schema, frontend overview, Docker notes.
- **`.claude/docs/api-reference.md`** — REST API endpoint reference.
- **`.claude/docs/deployment.md`** — Docker commands, logs, teardown, and hosting notes.
