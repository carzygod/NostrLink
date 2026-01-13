import React from 'react';
import { parseMessagePayload, MessageAttachment } from '../utils/messagePayload';

const getAttachmentLabel = (attachment: MessageAttachment) => {
  if (attachment.name) return attachment.name;
  const urlName = attachment.url.split('/').pop();
  return urlName || attachment.kind;
};

const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const { text, attachments } = parseMessagePayload(content);

  return (
    <div className="space-y-2">
      {text && (
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{text}</p>
      )}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment, idx) => {
            if (attachment.kind === 'image') {
              return (
                <img
                  key={`${attachment.url}-${idx}`}
                  src={attachment.url}
                  alt={getAttachmentLabel(attachment)}
                  className="max-w-full rounded-lg border border-white/10"
                  loading="lazy"
                />
              );
            }
            if (attachment.kind === 'video') {
              return (
                <video
                  key={`${attachment.url}-${idx}`}
                  src={attachment.url}
                  className="max-w-full rounded-lg border border-white/10"
                  controls
                />
              );
            }
            if (attachment.kind === 'audio') {
              return (
                <audio
                  key={`${attachment.url}-${idx}`}
                  src={attachment.url}
                  className="w-full"
                  controls
                />
              );
            }
            return (
              <a
                key={`${attachment.url}-${idx}`}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-200 underline break-all"
              >
                {getAttachmentLabel(attachment)}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MessageContent;
