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

## CORS (Required)
Because the browser uploads directly to R2 using a presigned URL, you must
enable CORS on your R2 bucket. Example rule:
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:5173"],
    "AllowedMethods": ["PUT", "GET", "HEAD", "OPTIONS"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
If a browser preflight still fails, make sure your CORS rule allows any
`x-amz-*` headers (or keep `AllowedHeaders: ["*"]`). Some browsers send
headers like `x-amz-checksum-crc32` and `x-amz-sdk-checksum-algorithm`.
Apply this rule in the Cloudflare R2 bucket CORS settings (or via `r2` CLI).
