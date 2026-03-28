# Media Storage

A self-hosted media storage web application for uploading, organizing, and streaming video and audio files.

## Features

- Upload `.mov`, `.mp4`, `.mp3`, `.wav`, `.ogg` files (up to 2 GB each)
- Drag-and-drop or file picker upload with progress tracking
- Inline video and audio playback with range request support
- File browser with video/audio sections, size, and date
- Delete files with confirmation
- Dark mode UI, responsive layout
- PostgreSQL metadata storage, Docker volume for file persistence

## Tech Stack

| Layer    | Technology                     |
|----------|--------------------------------|
| Backend  | Node.js, Express, Multer, pg   |
| Frontend | React 18, Vite, react-player   |
| Database | PostgreSQL 16                  |
| Deploy   | Docker, docker-compose         |

## Quick Start

### Prerequisites

- Docker and Docker Compose

### 1. Clone and configure

```bash
git clone <repo-url>
cd Website-Media-Storage
cp backend/.env.example backend/.env
```

**You must set `DB_PASSWORD`** — the server will refuse to start without it.

```bash
# Option A: export before running compose
export DB_PASSWORD=your_strong_password

# Option B: set it in backend/.env
echo "DB_PASSWORD=your_strong_password" >> backend/.env
```

### 2. Start all services

```bash
docker compose up --build -d
```

The app is available at **http://localhost:3001**.

### 3. Stop

```bash
docker compose down
```

To also remove data volumes:

```bash
docker compose down -v
```

## Hosting to the Internet

### Hosting Options Overview

| Option | Cost | Difficulty | Best for |
|--------|------|------------|----------|
| **Self-hosted** (own Linux machine) | Free after hardware | Medium | Full control, home labs |
| **VPS** (Virtual Private Server) | $5–15/month | Medium | Reliable uptime, static IP included |
| **Cloud Hosting** (AWS, GCP, Azure) | Variable | Higher | Scale-out workloads |

---

### Self-Hosted from Your Linux Machine

**Prerequisites:**
- Static public IP (or a dynamic DNS service like DuckDNS if your ISP assigns changing IPs)
- Domain name (~$10–15/year from Namecheap, Cloudflare, Google Domains)
- Router configured to forward ports 80 and 443 to your machine
- Nginx installed on the host (outside Docker)

**1. Install Nginx**

```bash
sudo apt update && sudo apt install nginx
```

**2. Create an Nginx reverse proxy config**

Create `/etc/nginx/sites-available/media-storage`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**3. Enable the config and reload Nginx**

```bash
sudo ln -s /etc/nginx/sites-available/media-storage /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**4. Get a free SSL certificate (Let's Encrypt)**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot automatically configures Nginx for HTTPS and schedules renewal every 90 days.

**5. Configure DNS**

Log into your domain registrar and create two A records:

```
Type | Name | Value
-----|------|------------------------
A    | @    | your.public.ip.address
A    | www  | your.public.ip.address
```

Find your public IP with: `curl icanhazip.com`

DNS propagation typically takes a few minutes but can take up to 48 hours.

**6. Open firewall ports**

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

**7. Start the app**

```bash
cd Website-Media-Storage
export DB_PASSWORD=your_strong_password
docker compose up -d
```

Your app is now live at `https://yourdomain.com`.

---

### Using a VPS (More Reliable)

If your home internet isn't stable or you want better uptime, a VPS gives you a static IP, no router configuration, and typically 99.9% uptime.

Popular providers at $5–10/month: **DigitalOcean**, **Linode/Akamai**, **Vultr**, **AWS Lightsail**.

```bash
# 1. Create an Ubuntu 24.04 instance on your chosen provider
# 2. SSH into it
# 3. Install Docker:
curl -fsSL https://get.docker.com | sh
# 4. Clone this repo and follow the self-hosted steps 2–7 above
```

No router port-forwarding needed — your VPS has a public IP by default.

---

### Dynamic DNS (home setups with a changing IP)

If your ISP assigns a dynamic IP, use a service like **DuckDNS** to keep your domain pointing at it automatically.

```bash
sudo apt install ddclient
```

Edit `/etc/ddclient/ddclient.conf`:

```
protocol=duckdns
use=web
server=www.duckdns.org
login=your-token
password=your-token
yourdomain.duckdns.org
```

Then point your domain registrar's A record to the DuckDNS hostname via a CNAME, or let ddclient update the IP directly.

---

### Security Best Practices

- **Always use HTTPS** — Let's Encrypt is free and automatic.
- **Enable UFW** — only open ports you actually need.
- **Use SSH keys**, not passwords; disable password login in `/etc/ssh/sshd_config`.
- **Keep the system updated**: `sudo apt update && sudo apt upgrade`
- **Monitor access logs**: `tail -f /var/log/nginx/access.log`
- **Back up the database regularly**:
  ```bash
  docker exec media-storage-db-1 pg_dump -U postgres mediastore > backup.sql
  ```
- **Watch disk space** — uploads can grow large: `df -h`

---

### Monitoring & Maintenance

```bash
# Check container status
docker compose ps

# Stream logs
docker compose logs -f app
docker compose logs -f db

# Restart after a config change
docker compose down && docker compose up -d

# Test SSL auto-renewal
sudo certbot renew --dry-run
```

---

### Troubleshooting

| Issue | Solution |
|-------|---------|
| Domain doesn't resolve | Verify the A record points to your public IP; allow time for propagation |
| HTTPS certificate error | Re-run `sudo certbot --nginx`; confirm the domain matches the cert |
| App unreachable | Check `docker compose ps`; verify firewall with `sudo ufw status` |
| Connection timeout | Confirm router port forwarding (80, 443 → your machine) |
| SSL renewal failed | Run `sudo certbot renew --verbose`; ensure port 443 is publicly reachable |

---

## Configuration

| Variable      | Default      | Description                     |
|---------------|--------------|---------------------------------|
| `PORT`        | `3001`       | Express server port             |
| `DB_HOST`     | `db`         | PostgreSQL host                 |
| `DB_PORT`     | `5432`       | PostgreSQL port                 |
| `DB_NAME`     | `mediastore` | Database name                   |
| `DB_USER`     | `postgres`   | Database user                   |
| `DB_PASSWORD` | **required** | Database password — no default  |

`DB_PASSWORD` has no default and **must** be set via `backend/.env` or as an environment variable. The server will exit on startup if it is missing.

## API Reference

| Method   | Endpoint                  | Description               |
|----------|---------------------------|---------------------------|
| `POST`   | `/api/upload`             | Upload a file (multipart) |
| `GET`    | `/api/files`              | List all files            |
| `DELETE` | `/api/files/:id`          | Delete a file             |
| `GET`    | `/api/files/:id/download` | Stream/download a file    |
| `GET`    | `/health`                 | Health check              |

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DB_HOST=localhost and start a local Postgres instance
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Dev server proxies /api requests to http://localhost:3001
```

## Project Structure

```
├── backend/
│   ├── server.js               # Express app entry point
│   ├── db.js                   # PostgreSQL pool + schema init
│   ├── routes/files.js         # Multer config + route definitions
│   ├── controllers/
│   │   └── fileController.js   # Upload, list, delete, stream handlers
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Root component, state management
│   │   ├── App.css             # Dark mode styles
│   │   └── components/
│   │       ├── UploadZone.jsx  # Drag-and-drop upload with progress
│   │       ├── FileList.jsx    # Browsable file list
│   │       └── MediaPlayer.jsx # Video/audio player
│   ├── vite.config.js
│   └── index.html
├── Dockerfile                  # Multi-stage build
├── docker-compose.yml          # App + PostgreSQL services
└── .dockerignore
```
