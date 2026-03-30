# Conventions

## Key Conventions

- **Column casing** — All DB queries return lowercase column names. Each controller has a `format*` function that remaps to camelCase before sending JSON. Do not spread raw DB rows into responses.
- **File type detection** — Extension whitelist checked in both Multer `fileFilter` (routes) and `getFileType()` (controller). Both must agree.
- **Playlist positions** — Zero-indexed integers. When adding an item, `SELECT COUNT(*)` to get the next position. When reordering, `PUT /api/playlists/:id/reorder` with `{ orderedFileIds }` reassigns 0, 1, 2 … in a transaction.
- **Streaming** — `GET /api/files/:id/download` handles `Range` headers for seekable playback. Always sets `Accept-Ranges: bytes`.
- **No JWT** — Auth uses random 64-char hex tokens stored in the `sessions` table. Token validity is checked on every request by querying `sessions JOIN users WHERE token = $1 AND expiresat > NOW()`.
- **Error handling** — Controllers call `next(err)` for unexpected errors. 4xx errors return `res.status(N).json({ error: 'message' })` directly. The global handler in `server.js` catches everything else.

## Linting

ESLint is configured in `frontend/.eslintrc.cjs` with `eslint:recommended`, `plugin:react/recommended`, `plugin:react/jsx-runtime`, and `plugin:react-hooks/recommended`. `react/prop-types` is disabled.

Run from `frontend/`:
```bash
npm run lint        # check
npm run lint:fix    # auto-fix
```

The lint scripts pass `--ext .js,.jsx` so ESLint scans JSX files. Without that flag, ESLint silently skips them.

## Adding New Features

1. Add any new tables to the `initDB()` block in `db.js` using `CREATE TABLE IF NOT EXISTS`.
2. Create a controller in `backend/controllers/`, a route file in `backend/routes/`, and register it in `server.js` with `app.use('/api/...', router)`.
3. Protect endpoints with `router.use(optionalAuth, requireAuth)` or per-route.
4. Add frontend components in `frontend/src/components/`. Wire state in `App.jsx`.
5. Add new CSS classes to `App.css` using the existing token variables — no hardcoded colours.
