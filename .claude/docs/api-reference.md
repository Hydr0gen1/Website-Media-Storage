# API Reference

Base path: `/api`

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | No | Create account `{ username, password }` |
| `POST` | `/api/auth/login` | No | Login, returns `{ token }` |
| `GET` | `/api/auth/me` | Yes | Returns current user |
| `POST` | `/api/auth/logout` | Yes | Invalidates session token |

## OAuth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/oauth/google` | No | Redirects to Google OAuth consent screen |
| `GET` | `/api/auth/oauth/google/callback` | No | Google OAuth callback (handled by server) |
| `GET` | `/api/auth/oauth/github` | No | Redirects to GitHub OAuth consent screen |
| `GET` | `/api/auth/oauth/github/callback` | No | GitHub OAuth callback (handled by server) |
| `GET` | `/api/auth/oauth/apple` | No | Redirects to Apple Sign In |
| `POST` | `/api/auth/oauth/apple/callback` | No | Apple OAuth callback (form_post) |
| `POST` | `/api/auth/oauth/exchange` | No | Exchange one-time auth code for session token `{ code }` → `{ token, user }` |

## Files

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/files` | Yes | List all files |
| `POST` | `/api/files/upload` | Yes | Upload a file (multipart/form-data) |
| `GET` | `/api/files/:id` | Yes | Get file metadata |
| `GET` | `/api/files/:id/download` | Yes | Stream file (supports Range header) |
| `DELETE` | `/api/files/:id` | Yes | Delete file |

## Subscriptions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/subscriptions` | Yes | List user's channel subscriptions |
| `POST` | `/api/subscriptions` | Yes | Add subscription `{ channelUrl, channelName? }` |
| `DELETE` | `/api/subscriptions/:id` | Yes | Remove subscription (own only) |
| `POST` | `/api/subscriptions/download-url` | Yes | Download video by URL `{ videoUrl }` — returns immediately, runs in background |

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
