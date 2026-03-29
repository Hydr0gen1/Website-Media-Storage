# Deployment

## Docker Commands

```bash
# Start everything (first run builds images)
export DB_PASSWORD=dev_password
docker compose up --build -d

# View logs
docker compose logs -f app
docker compose logs -f db

# Tear down (keep volumes)
docker compose down

# Tear down (destroy volumes — deletes uploaded files!)
docker compose down -v
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

## Hosting

- Deployed on a home server (UbuntuBeast).
- Auto-deploy: pushing to `main` triggers a pull + rebuild within ~5 minutes.
- Traffic is routed via Caddy (reverse proxy) → Cloudflare Tunnel → `localhost:3001`.
- Uploaded files live on a ZFS volume bind-mounted to `/app/uploads` in the container.

See `.claude/rules/server-constraints.md` for what must NOT be changed in production.
