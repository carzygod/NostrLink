import React, { useEffect, useRef, useState } from 'react';
import { UserKeys, NostrEvent, ChannelInfo } from '../types';
import { getPool, publishChannelMessage } from '../services/nostrService';
import { uploadToR2 } from '../services/uploadService';
import { buildMessageContent } from '../utils/messagePayload';
import MessageContent from './MessageContent';
import { Filter, nip19, validateEvent, verifyEvent } from 'nostr-tools';
import { ArrowLeft, Send, Users, Loader2, AlertTriangle, Share2, Image, Video, Mic, X, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

interface GroupChatProps {
  keys: UserKeys;
  relays: string[];
  channelId: string;
  onBack: () => void;
}

const GroupChat: React.FC<GroupChatProps> = ({ keys, relays, channelId, onBack }) => {
  const [messages, setMessages] = useState<NostrEvent[]>([]);
  const [inputText, setInputText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [mediaPicker, setMediaPicker] = useState<'image' | 'video' | 'audio' | null>(null);
  const [status, setStatus] = useState<'loading' | 'idle' | 'sending' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageCameraRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoCameraRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const pool = getPool();
  const { t } = useLanguage();
  const joinedStorageKey = 'nostr_joined_channels';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, status]);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      recorder?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const createFilter: Filter = { kinds: [40], ids: [channelId] };
    const metadataFilter: Filter = { kinds: [41], '#e': [channelId] };
    const handleEvent = (event: NostrEvent) => {
      if (!validateEvent(event) || !verifyEvent(event)) return;
      try {
        const content = JSON.parse(event.content || '{}');
        setChannelInfo((prev) => ({
          id: channelId,
          name: content.name || prev?.name,
          about: content.about || prev?.about,
          picture: content.picture || prev?.picture,
          createdAt: event.created_at || prev?.createdAt
        }));
      } catch {
        // ignore
      }
    };
    const subs = [
      pool.subscribeMany(relays, createFilter, { onevent: handleEvent }),
      pool.subscribeMany(relays, metadataFilter, { onevent: handleEvent })
    ];
    return () => subs.forEach((sub) => sub.close());
  }, [relays, channelId]);

  useEffect(() => {
    const stored = localStorage.getItem(joinedStorageKey);
    try {
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed) && !parsed.includes(channelId)) {
        const next = [channelId, ...parsed];
        localStorage.setItem(joinedStorageKey, JSON.stringify(next));
      }
      if (!stored) {
        localStorage.setItem(joinedStorageKey, JSON.stringify([channelId]));
      }
    } catch {
      localStorage.setItem(joinedStorageKey, JSON.stringify([channelId]));
    }
  }, [channelId]);

  useEffect(() => {
    setMessages([]);
    setStatus('loading');
    setErrorMsg('');

    const filter: Filter = { kinds: [42], '#e': [channelId], limit: 100 };
    const sub = pool.subscribeMany(relays, filter, {
      onevent: (event) => {
        if (!validateEvent(event) || !verifyEvent(event)) return;
        setMessages((prev) => {
          if (prev.find((e) => e.id === event.id)) return prev;
          return [...prev, event].sort((a, b) => a.created_at - b.created_at);
        });
        setStatus('idle');
      },
      oneose: () => {
        if (messages.length === 0) setStatus('idle');
      }
    });

    const timeout = setTimeout(() => {
      setStatus(prev => prev === 'loading' ? 'idle' : prev);
    }, 2000);

    return () => {
      sub.close();
      clearTimeout(timeout);
    };
  }, [relays, channelId]);

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed && pendingFiles.length === 0) return;
    const textToSend = trimmed;
    const filesToSend = [...pendingFiles];
    setInputText('');
    setPendingFiles([]);
    setStatus('sending');
    setErrorMsg('');

    let attachments = [];
    if (filesToSend.length > 0) {
      try {
        attachments = await Promise.all(filesToSend.map((file) => uploadToR2(file)));
      } catch (e) {
        console.error("Upload failed", e);
        setStatus('error');
        setErrorMsg(t('chat.upload_failed'));
        setInputText(textToSend);
        setPendingFiles(filesToSend);
        return;
      }
    }

    const contentToSend = attachments.length > 0 ? buildMessageContent(textToSend, attachments) : textToSend;

    try {
      await publishChannelMessage(keys, relays, channelId, contentToSend);
      setStatus('idle');
      scrollToBottom();
    } catch (e) {
      console.error("Group send failed", e);
      setStatus('error');
      setErrorMsg(t('group.send_failed'));
      setInputText(textToSend);
      setPendingFiles(filesToSend);
    }
  };

  const formatPubKey = (hex: string) => {
    try {
      return nip19.npubEncode(hex).slice(0, 8) + '...';
    } catch {
      return hex.slice(0, 6);
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPendingFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getRecordingMimeType = () => {
    const options = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ];
    for (const option of options) {
      if (MediaRecorder.isTypeSupported(option)) return option;
    }
    return '';
  };

  const getRecordingExtension = (mimeType: string) => {
    if (mimeType.includes('ogg')) return 'ogg';
    return 'webm';
  };

  const handleRecordingToggle = async () => {
    if (recording) {
      recorderRef.current?.stop();
      recorderRef.current = null;
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recordingChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: mimeType || 'audio/webm' });
        const ext = getRecordingExtension(blob.type);
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
        setPendingFiles((prev) => [...prev, file]);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setRecording(true);
    } catch (e) {
      console.error("Recording failed", e);
      setStatus('error');
      setErrorMsg(t('chat.record_failed'));
    }
  };

  const members = React.useMemo(() => {
    const recent = [...messages].sort((a, b) => b.created_at - a.created_at).slice(0, 50);
    const seen = new Set<string>();
    const ordered: string[] = [];
    recent.forEach((msg) => {
      if (!seen.has(msg.pubkey)) {
        seen.add(msg.pubkey);
        ordered.push(msg.pubkey);
      }
    });
    if (!seen.has(keys.pk)) {
      ordered.unshift(keys.pk);
    }
    return ordered;
  }, [messages, keys.pk]);

  const handleShare = async () => {
    const url = `${window.location.origin}?channel=${channelId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const displayName = channelInfo?.name || t('group.unnamed');

  return (
    <div className="flex flex-col h-full bg-slate-900 w-full relative min-w-0">
      <div className="flex items-center gap-3 p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700 sticky top-0 z-10 shadow-sm">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition"
          aria-label={t('group.back')}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={() => setShowInfo(true)}
          className="p-2 rounded-full bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition"
          aria-label={t('group.info')}
        >
          <Users size={20} />
        </button>
        <div className="flex-1">
          <h2 className="font-semibold text-white">{displayName}</h2>
          <p className="text-xs text-slate-400">{channelInfo?.about || channelId.slice(0, 12)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4 min-w-0">
        {status === 'loading' && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-indigo-400 space-y-3">
            <Loader2 size={32} className="animate-spin" />
            <p className="text-xs text-slate-500">{t('group.loading')}</p>
          </div>
        )}

        {status === 'idle' && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-2 opacity-60">
            <Users size={48} className="mb-2 opacity-50" />
            <p>{t('group.no_messages')}</p>
            <p className="text-xs">{t('group.be_first')}</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.pubkey === keys.pk;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                isMe
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-slate-700 text-slate-200 rounded-bl-none'
              }`}>
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1.5 opacity-80 border-b border-white/10 pb-1">
                    <div className="w-4 h-4 bg-indigo-400/30 rounded-full flex items-center justify-center">
                      <Users size={10} />
                    </div>
                    <span className="text-[10px] font-mono font-medium text-indigo-200">{formatPubKey(msg.pubkey)}</span>
                  </div>
                )}
                <MessageContent content={msg.content} />
                <div className="flex items-center justify-end gap-1 mt-1">
                  <p className={`text-[10px] ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {format(new Date(msg.created_at * 1000), 'h:mm a')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-slate-800 border-t border-slate-700 mb-16 md:mb-0 relative">
        {status === 'error' && (
          <div className="absolute -top-10 left-0 right-0 px-4 flex justify-center">
            <div className="bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-sm">
              <AlertTriangle size={12} />
              {errorMsg || t('group.send_failed')}
            </div>
          </div>
        )}

        {pendingFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingFiles.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="flex items-center gap-2 bg-slate-900/70 border border-slate-700 rounded-full px-3 py-1 text-xs text-slate-200">
                <span className="max-w-[160px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(idx)}
                  className="text-slate-400 hover:text-white transition"
                  aria-label={t('chat.remove_attachment')}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
          <input
            ref={imageCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
          <input
            ref={videoCameraRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
          <button
            onClick={() => setMediaPicker('image')}
            disabled={status === 'sending'}
            className="p-2 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500 transition"
            title={t('chat.add_image')}
          >
            <Image size={16} />
          </button>
          <button
            onClick={() => setMediaPicker('video')}
            disabled={status === 'sending'}
            className="p-2 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500 transition"
            title={t('chat.add_video')}
          >
            <Video size={16} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={status === 'sending'}
            className="p-2 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500 transition"
            title={t('chat.add_file')}
          >
            <Paperclip size={16} />
          </button>
          <button
            onClick={() => (recording ? handleRecordingToggle() : setMediaPicker('audio'))}
            disabled={status === 'sending'}
            className={`p-2 rounded-full border transition ${
              recording
                ? 'bg-red-500/20 border-red-500 text-red-300 hover:text-white'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500'
            }`}
            title={recording ? t('chat.stop_recording') : t('chat.add_audio')}
          >
            <Mic size={16} />
          </button>
          {recording && <span className="text-xs text-red-300">{t('chat.recording')}</span>}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={status === 'sending'}
            placeholder={t('group.placeholder')}
            className="flex-1 bg-slate-900 border border-slate-600 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={(status === 'sending') || (!inputText.trim() && pendingFiles.length === 0)}
            className="bg-indigo-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20"
          >
            {status === 'sending' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} className={inputText.trim() || pendingFiles.length > 0 ? "translate-x-0.5" : ""} />
            )}
          </button>
        </div>
      </div>

      {mediaPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-xs rounded-2xl border border-slate-700 shadow-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">
              {mediaPicker === 'image'
                ? t('chat.add_image')
                : mediaPicker === 'video'
                  ? t('chat.add_video')
                  : t('chat.add_audio')}
            </h3>
            <button
              onClick={() => {
                setMediaPicker(null);
                if (mediaPicker === 'image') imageInputRef.current?.click();
                if (mediaPicker === 'video') videoInputRef.current?.click();
                if (mediaPicker === 'audio') audioInputRef.current?.click();
              }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100 py-2 rounded-lg transition"
            >
              {mediaPicker === 'audio' ? t('chat.choose_audio') : t('chat.choose_file')}
            </button>
            <button
              onClick={() => {
                setMediaPicker(null);
                if (mediaPicker === 'image') imageCameraRef.current?.click();
                if (mediaPicker === 'video') videoCameraRef.current?.click();
                if (mediaPicker === 'audio') handleRecordingToggle();
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition"
            >
              {mediaPicker === 'image'
                ? t('chat.take_photo')
                : mediaPicker === 'video'
                  ? t('chat.take_video')
                  : t('chat.record_voice')}
            </button>
            <button
              onClick={() => setMediaPicker(null)}
              className="w-full bg-slate-800/70 hover:bg-slate-700 text-slate-300 py-2 rounded-lg transition"
            >
              {t('chat.cancel')}
            </button>
          </div>
        </div>
      )}

      {showInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl p-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
              <h3 className="text-sm font-semibold text-white">{t('group.info')}</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="text-slate-400 hover:text-white"
              >
                {t('group.close')}
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-200">
              <div>
                <p className="text-xs text-slate-500 mb-1">{t('group.name')}</p>
                <p className="text-slate-100">{channelInfo?.name || t('group.unnamed')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">{t('group.about')}</p>
                <p className="text-slate-100">{channelInfo?.about || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">{t('group.channel_id')}</p>
                <p className="text-slate-100 font-mono break-all">{channelId}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2">{t('group.members_recent')} {members.length}</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {members.map((member) => (
                    <p key={member} className="text-xs font-mono text-slate-300">{formatPubKey(member)}</p>
                  ))}
                </div>
              </div>
              <button
                onClick={handleShare}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
              >
                <Share2 size={16} />
                {copied ? t('group.link_copied') : t('group.share')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupChat;
