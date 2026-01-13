import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const envPath = fileURLToPath(new URL('./.env', import.meta.url));
dotenv.config({ path: envPath });

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL,
  R2_PREFIX,
  UPLOAD_SERVER_PORT,
  CORS_ORIGIN
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
  console.warn('[uploadServer] Missing required R2 environment variables.');
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const client = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || ''
  }
});

const normalizeBase = (base) => base.replace(/\/+$/, '');
const publicBase = R2_PUBLIC_BASE_URL ? normalizeBase(R2_PUBLIC_BASE_URL) : '';
const prefix = (R2_PREFIX || 'nostrlink').replace(/^\/+|\/+$/g, '');

app.post('/uploads/presign', async (req, res) => {
  try {
    if (!R2_BUCKET || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !publicBase) {
      return res.status(500).json({ error: 'R2 server is not configured' });
    }
    const { filename, contentType } = req.body || {};
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'filename required' });
    }
    const ext = path.extname(filename).slice(0, 12);
    const random = crypto.randomBytes(8).toString('hex');
    const key = `${prefix}/${Date.now()}-${random}${ext}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType || 'application/octet-stream'
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 5 });
    const publicUrl = `${publicBase}/${key}`;

    return res.json({ uploadUrl, publicUrl, objectKey: key });
  } catch (err) {
    console.error('[uploadServer] presign error', err);
    return res.status(500).json({ error: 'failed to create upload URL' });
  }
});

const port = Number(UPLOAD_SERVER_PORT || 8787);
app.listen(port, () => {
  console.log(`[uploadServer] listening on http://localhost:${port}`);
});
