# Server Deployment Constraints

This app is deployed on a home server (UbuntuBeast) with auto-deploy from GitHub.
When Jude pushes to `main`, the server pulls and rebuilds automatically within 5 minutes.
The following constraints MUST be respected or the production deployment will break.

## Do NOT change these without coordinating with Dad

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

## Safe to change freely

- All React components, CSS, and frontend code
- Adding new API routes and controllers
- Adding new npm dependencies (add to both `package.json` and commit `package-lock.json`)
- Adding new environment variables with sensible defaults (the server won't have them
  set unless Dad adds them, so always provide a fallback)
- Creating new database tables using the existing `CREATE TABLE IF NOT EXISTS` pattern
  in `db.js`

## Requires a migration (ask Dad for help)

**Modifying existing database tables** — adding columns, renaming columns, changing
types, adding constraints to tables that already have data. The `CREATE TABLE IF NOT
EXISTS` pattern only runs when the table doesn't exist yet. If you need to change
an existing table's schema, you need an `ALTER TABLE` statement that runs once. This
is called a "database migration" and it's a normal part of backend development —
ask Dad to help you set one up the first time.

## Package lock file

Always commit `package-lock.json` when you add or update dependencies. The server
uses a Dockerfile that calls `npm install` — without a lock file, dependency versions
can drift between your machine and production, causing subtle bugs.

To generate it after adding a dependency:
```bash
cd backend && npm install && cd ../frontend && npm install
```

Then commit both `package-lock.json` files.
