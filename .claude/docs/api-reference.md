# API Reference

Base path: `/api`

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | No | Create account `{ username, password }` |
| `POST` | `/api/auth/login` | No | Login, returns `{ token }` |
| `GET` | `/api/auth/me` | Yes | Returns current user |
| `POST` | `/api/auth/logout` | Yes | Invalidates session token |

## Files

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/files` | Yes | List all files |
| `POST` | `/api/files/upload` | Yes | Upload a file (multipart/form-data) |
| `GET` | `/api/files/:id` | Yes | Get file metadata |
| `GET` | `/api/files/:id/download` | Yes | Stream file (supports Range header) |
| `DELETE` | `/api/files/:id` | Yes | Delete file |

## Playlists

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/playlists` | Yes | List all playlists |
| `POST` | `/api/playlists` | Yes | Create playlist `{ name, type, description }` |
| `GET` | `/api/playlists/:id` | Yes | Get playlist with items |
| `PUT` | `/api/playlists/:id` | Yes | Update playlist metadata |
| `DELETE` | `/api/playlists/:id` | Yes | Delete playlist |
| `POST` | `/api/playlists/:id/items` | Yes | Add file to playlist `{ fileId }` |
| `DELETE` | `/api/playlists/:id/items/:itemId` | Yes | Remove item from playlist |
| `PUT` | `/api/playlists/:id/reorder` | Yes | Reorder items `{ orderedFileIds }` |
