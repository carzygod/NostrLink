import React, { useEffect, useRef, useState } from 'react';
import { UserKeys, NostrEvent, ChannelInfo } from '../types';
import { getPool, publishChannelMessage } from '../services/nostrService';
import { Filter, nip19, validateEvent, verifyEvent } from 'nostr-tools';
import { ArrowLeft, Send, Users, Loader2, AlertTriangle } from 'lucide-react';
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
  const [status, setStatus] = useState<'loading' | 'idle' | 'sending' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pool = getPool();
  const { t } = useLanguage();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, status]);

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
    if (!inputText.trim()) return;
    const textToSend = inputText;
    setInputText('');
    setStatus('sending');
    setErrorMsg('');
    try {
      await publishChannelMessage(keys, relays, channelId, textToSend);
      setStatus('idle');
      scrollToBottom();
    } catch (e) {
      console.error("Group send failed", e);
      setStatus('error');
      setErrorMsg(t('group.send_failed'));
      setInputText(textToSend);
    }
  };

  const formatPubKey = (hex: string) => {
    try {
      return nip19.npubEncode(hex).slice(0, 8) + '...';
    } catch {
      return hex.slice(0, 6);
    }
  };

  const displayName = channelInfo?.name || t('group.unnamed');

  return (
    <div className="flex flex-col h-full bg-slate-900 w-full relative">
      <div className="flex items-center gap-3 p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700 sticky top-0 z-10 shadow-sm">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition"
          aria-label={t('group.back')}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="p-2 rounded-full bg-indigo-500/20 text-indigo-400">
          <Users size={20} />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-white">{displayName}</h2>
          <p className="text-xs text-slate-400">{channelInfo?.about || channelId.slice(0, 12)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4">
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
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
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
            disabled={!inputText.trim() || status === 'sending'}
            className="bg-indigo-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20"
          >
            {status === 'sending' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} className={inputText.trim() ? "translate-x-0.5" : ""} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupChat;
