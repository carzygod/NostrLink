# Upload Server (Cloudflare R2)

This folder contains a lightweight upload server that generates presigned URLs
for Cloudflare R2. The browser uploads directly to R2 via the signed URL.

## Structure
- `uploadServer.mjs`: Express server that exposes `/uploads/presign`
- `.env.example`: Server-only environment variables

## Setup
1. Copy `server/.env.example` to `server/.env`.
2. Fill in your R2 credentials and public base URL.

## Start
From the project root:
```bash
npm run upload-server
```

The server listens on `UPLOAD_SERVER_PORT` (default `8787`).

## Usage
- Endpoint: `POST /uploads/presign`
- Request body:
```json
{
  "filename": "example.png",
  "contentType": "image/png"
}
```
- Response:
```json
{
  "uploadUrl": "https://...",
  "publicUrl": "https://...",
  "objectKey": "nostrlink/..."
}
```

## Frontend
Set `VITE_UPLOAD_API_BASE` in the root `.env` to point at this server, e.g.:
```
VITE_UPLOAD_API_BASE=http://localhost:8787
```
