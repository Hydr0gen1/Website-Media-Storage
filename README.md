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

Edit `backend/.env` and set a strong `DB_PASSWORD`.

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

## Configuration

| Variable      | Default      | Description                     |
|---------------|--------------|---------------------------------|
| `PORT`        | `3001`       | Express server port             |
| `DB_HOST`     | `db`         | PostgreSQL host                 |
| `DB_PORT`     | `5432`       | PostgreSQL port                 |
| `DB_NAME`     | `mediastore` | Database name                   |
| `DB_USER`     | `postgres`   | Database user                   |
| `DB_PASSWORD` | `changeme`   | Database password (**change!**) |

Set `DB_PASSWORD` via `backend/.env` or as an environment variable before running `docker compose up`.

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
