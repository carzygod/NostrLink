export type MessageAttachmentKind = 'image' | 'video' | 'audio' | 'file';

export interface MessageAttachment {
  url: string;
  mime: string;
  kind: MessageAttachmentKind;
  name?: string;
  size?: number;
}

export interface MessagePayload {
  text?: string;
  attachments?: MessageAttachment[];
}

const sanitizeAttachment = (item: any): MessageAttachment | null => {
  if (!item || typeof item.url !== 'string') return null;
  const mime = typeof item.mime === 'string' ? item.mime : 'application/octet-stream';
  const kind =
    item.kind === 'image' || item.kind === 'video' || item.kind === 'audio'
      ? item.kind
      : 'file';
  const name = typeof item.name === 'string' ? item.name : undefined;
  const size = typeof item.size === 'number' ? item.size : undefined;
  return { url: item.url, mime, kind, name, size };
};

export const parseMessagePayload = (content: string): { text: string; attachments: MessageAttachment[]; isPayload: boolean } => {
  try {
    const parsed = JSON.parse(content);
    const hasText = typeof parsed?.text === 'string';
    const hasAttachments = Array.isArray(parsed?.attachments);
    if (!hasText && !hasAttachments) {
      return { text: content, attachments: [], isPayload: false };
    }
    const attachments = hasAttachments
      ? parsed.attachments.map(sanitizeAttachment).filter(Boolean) as MessageAttachment[]
      : [];
    return {
      text: hasText ? parsed.text : '',
      attachments,
      isPayload: true
    };
  } catch {
    return { text: content, attachments: [], isPayload: false };
  }
};

export const buildMessageContent = (text: string, attachments: MessageAttachment[]): string => {
  if (!attachments || attachments.length === 0) return text;
  const payload: MessagePayload = { text, attachments };
  return JSON.stringify(payload);
};

export const inferAttachmentKind = (mime: string): MessageAttachmentKind => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
};
