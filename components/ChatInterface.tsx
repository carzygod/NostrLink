import React, { useState, useEffect, useRef } from 'react';
import { UserKeys, ChatMessage, NostrEvent } from '../types';
import { getPool, publishNote, publishEncryptedDM, decryptMessage } from '../services/nostrService';
import { uploadToR2 } from '../services/uploadService';
import { buildMessageContent } from '../utils/messagePayload';
import MessageContent from './MessageContent';
import { Send, User, Lock, Globe, Loader2, AlertTriangle, Image, Video, Mic, X } from 'lucide-react';
import { format } from 'date-fns';
import { nip19, Filter } from 'nostr-tools';
import { useLanguage } from '../contexts/LanguageContext';

interface ChatInterfaceProps {
  keys: UserKeys;
  relays: string[];
  mode: 'global' | 'dm';
  targetPubkey?: string; // Only for DM
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ keys, relays, mode, targetPubkey }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<'loading' | 'idle' | 'sending' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const pool = getPool();
  const { t } = useLanguage();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Only scroll if we are already near bottom or it's initial load
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

  // Subscribe to messages
  useEffect(() => {
    setMessages([]);
    setStatus('loading');
    setErrorMsg('');

    let subFilters: Filter[] = [];
    
    if (mode === 'global') {
        subFilters = [{ kinds: [1], limit: 50 }];
    } else if (mode === 'dm' && targetPubkey) {
        subFilters = [
            { kinds: [4], authors: [targetPubkey], limit: 50 }, // Received (filter by author)
            { kinds: [4], '#p': [targetPubkey], authors: [keys.pk], limit: 50 }  // Sent
        ];
    }

    // Guard clause: Don't subscribe if we don't have valid filters
    if (subFilters.length === 0) {
        setStatus('idle');
        return;
    }

    // Subscribe
    const isDmEventForTarget = (event: NostrEvent, target: string) => {
      if (event.kind !== 4) return false;
      const recipient = event.tags.find((tag) => tag[0] === 'p')?.[1];
      if (event.pubkey === keys.pk) {
        return recipient === target;
      }
      return event.pubkey === target && recipient === keys.pk;
    };

    const handleEvent = async (event: NostrEvent) => {
        if (mode === 'dm' && targetPubkey && !isDmEventForTarget(event, targetPubkey)) {
          return;
        }
        let content = event.content;
        let isEncrypted = event.kind === 4;

        if (isEncrypted) {
          try {
            const otherKey = event.pubkey === keys.pk ? targetPubkey! : event.pubkey;
            if (otherKey) {
                content = await decryptMessage(keys, otherKey, event.content);
            } else {
                content = "*** Unknown Key ***";
            }
          } catch(e) {
            content = "*** Decryption Failed ***";
          }
        }

        const newMessage: ChatMessage = {
          id: event.id,
          senderPubkey: event.pubkey,
          content: content,
          createdAt: event.created_at,
          isMe: event.pubkey === keys.pk,
        };

        setMessages((prev) => {
          if (prev.find(m => m.id === newMessage.id)) return prev;
          const updated = [...prev, newMessage].sort((a, b) => a.createdAt - b.createdAt);
          return updated;
        });
        setStatus('idle');
      };

    const handleEose = () => {
      // End of stored events
      if (messages.length === 0) setStatus('idle');
    };

    const subs = subFilters.map((filter) => 
      pool.subscribeMany(relays, filter, {
        onevent: handleEvent,
        oneose: handleEose
      })
    );

    // Safety timeout to remove loading state if relays are slow/empty
    const timeout = setTimeout(() => {
        setStatus(prev => prev === 'loading' ? 'idle' : prev);
    }, 2000);

    return () => {
      subs.forEach((sub) => sub.close());
      clearTimeout(timeout);
    };
  }, [relays, mode, targetPubkey, keys]);

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
      if (mode === 'global') {
        await publishNote(keys, relays, contentToSend);
      } else if (mode === 'dm' && targetPubkey) {
        await publishEncryptedDM(keys, relays, targetPubkey, contentToSend);
      }
      setStatus('idle');
      scrollToBottom();
    } catch (e: any) {
      console.error("Send failed", e);
      setStatus('error');
      setErrorMsg(t('chat.send_failed'));
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

  return (
    <div className="flex flex-col h-full bg-slate-900 w-full relative min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700 sticky top-0 z-10 shadow-sm">
        <div className={`p-2 rounded-full ${mode === 'global' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
          {mode === 'global' ? <Globe size={20} /> : <Lock size={20} />}
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-white flex items-center gap-2">
            {mode === 'global' ? t('nav.global') : t('nav.dm')}
            {relays.length === 0 && <span className="text-xs text-red-400 bg-red-900/20 px-2 py-0.5 rounded">No Relays</span>}
          </h2>
          {mode === 'dm' && targetPubkey ? (
            <p className="text-xs text-slate-400 font-mono">{formatPubKey(targetPubkey)}</p>
          ) : (
            <p className="text-xs text-slate-400">{relays.length} Relays</p>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4 min-w-0">
        {status === 'loading' && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-indigo-400 space-y-3">
             <Loader2 size={32} className="animate-spin" />
             <p className="text-xs text-slate-500">{t('chat.connecting')}</p>
          </div>
        )}

        {status === 'idle' && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-2 opacity-60">
            {mode === 'global' ? <Globe size={48} className="mb-2 opacity-50" /> : <Lock size={48} className="mb-2 opacity-50" />}
            <p>{t('chat.no_messages')}</p>
            <p className="text-xs">{t('chat.be_first')}</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
              msg.isMe 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-slate-700 text-slate-200 rounded-bl-none'
            }`}>
              {!msg.isMe && mode === 'global' && (
                <div className="flex items-center gap-1.5 mb-1.5 opacity-80 border-b border-white/10 pb-1">
                  <div className="w-4 h-4 bg-indigo-400/30 rounded-full flex items-center justify-center">
                    <User size={10} />
                  </div>
                  <span className="text-[10px] font-mono font-medium text-indigo-200">{formatPubKey(msg.senderPubkey)}</span>
                </div>
              )}
              <MessageContent content={msg.content} />
              <div className="flex items-center justify-end gap-1 mt-1">
                 <p className={`text-[10px] ${msg.isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {format(new Date(msg.createdAt * 1000), 'h:mm a')}
                </p>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-slate-800 border-t border-slate-700 mb-16 md:mb-0 relative">
        {status === 'error' && (
            <div className="absolute -top-10 left-0 right-0 px-4 flex justify-center">
                <div className="bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-sm">
                    <AlertTriangle size={12} />
                    {errorMsg || "Transmission Failed"}
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
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={status === 'sending'}
            className="p-2 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500 transition"
            title={t('chat.add_image')}
          >
            <Image size={16} />
          </button>
          <button
            onClick={() => videoInputRef.current?.click()}
            disabled={status === 'sending'}
            className="p-2 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500 transition"
            title={t('chat.add_video')}
          >
            <Video size={16} />
          </button>
          <button
            onClick={() => audioInputRef.current?.click()}
            disabled={status === 'sending'}
            className="p-2 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500 transition"
            title={t('chat.add_audio')}
          >
            <Mic size={16} />
          </button>
          <button
            onClick={handleRecordingToggle}
            disabled={status === 'sending'}
            className={`p-2 rounded-full border transition ${
              recording
                ? 'bg-red-500/20 border-red-500 text-red-300 hover:text-white'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500'
            }`}
            title={recording ? t('chat.stop_recording') : t('chat.record_voice')}
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
            placeholder={mode === 'global' ? t('chat.placeholder') : t('chat.placeholder_dm')}
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
    </div>
  );
};

export default ChatInterface;
