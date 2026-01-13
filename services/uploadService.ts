import { MessageAttachment, inferAttachmentKind } from '../utils/messagePayload';

const getApiBase = () => {
  const base = import.meta.env.VITE_UPLOAD_API_BASE as string | undefined;
  if (!base) return '';
  return base.replace(/\/+$/, '');
};

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

export const uploadToR2 = async (file: File): Promise<MessageAttachment> => {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/uploads/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/octet-stream'
    })
  });

  if (!response.ok) {
    throw new Error('Failed to get upload URL');
  }

  const data = await response.json() as PresignResponse;
  if (!data.uploadUrl || !data.publicUrl) {
    throw new Error('Invalid upload response');
  }

  const uploadRes = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });

  if (!uploadRes.ok) {
    throw new Error('Upload failed');
  }

  return {
    url: data.publicUrl,
    mime: file.type || 'application/octet-stream',
    kind: inferAttachmentKind(file.type || ''),
    name: file.name,
    size: file.size
  };
};
