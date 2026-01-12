import React, { useState, useEffect } from 'react';
import { UserKeys, NostrEvent, UserProfile } from '../types';
import { getPool, fetchProfiles } from '../services/nostrService';
import { nip19, Filter, validateEvent, verifyEvent } from 'nostr-tools';
import { ArrowLeft, MessageCircle, Repeat2, Heart, Share2, User, MoreHorizontal, Loader2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

interface CommunityProfileProps {
  keys: UserKeys;
  relays: string[];
  onBack: () => void;
}

const CommunityProfile: React.FC<CommunityProfileProps> = ({ keys, relays, onBack }) => {
  const [events, setEvents] = useState<NostrEvent[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const pool = getPool();

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      const profiles = await fetchProfiles(relays, [keys.pk]);
      if (isMounted) {
        setProfile(profiles[keys.pk] || null);
      }
    };
    loadProfile();
    return () => { isMounted = false; };
  }, [relays, keys.pk]);

  useEffect(() => {
    setLoading(true);
    setEvents([]);

    const filter: Filter = { kinds: [1], authors: [keys.pk], limit: 50 };
    const sub = pool.subscribeMany(relays, filter, {
      onevent: (event) => {
        if (!validateEvent(event) || !verifyEvent(event)) return;
        setEvents((prev) => {
          if (prev.find((e) => e.id === event.id)) return prev;
          return [...prev, event].sort((a, b) => b.created_at - a.created_at);
        });
      },
      oneose: () => {
        setLoading(false);
      }
    });

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3500);

    return () => {
      sub.close();
      clearTimeout(timeout);
    };
  }, [relays, keys.pk]);

  const formatPubKey = (hex: string) => {
    try {
      return nip19.npubEncode(hex).slice(0, 10);
    } catch {
      return hex.slice(0, 8);
    }
  };

  const getRelativeTime = (timestamp: number) => {
    try {
      return formatDistanceToNow(timestamp * 1000, { addSuffix: false }).replace('about ', '') + ' ago';
    } catch {
      return 'unknown';
    }
  };

  const displayName = profile?.displayName || profile?.name || t('community.me');
  const handle = profile?.name ? `@${profile.name}` : formatPubKey(keys.pk);
  const avatar = profile?.picture;

  return (
    <div className="flex flex-col h-full bg-slate-950 w-full relative">
      <div className="flex items-center justify-between p-4 bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-white transition"
            aria-label={t('community.back')}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">{t('community.profile')}</h2>
            <p className="text-[10px] text-slate-500">{t('community.my_posts')}</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
          {avatar ? (
            <img src={avatar} alt={displayName} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = '')} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
              <User size={16} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="animate-spin text-indigo-500" />
            <p className="text-xs text-slate-500">{t('community.listening')}</p>
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-2">
            <AlertCircle size={32} />
            <p>{t('community.no_posts')}</p>
          </div>
        )}

        {events.map((event) => (
          <div key={event.id} className="p-4 border-b border-slate-800 hover:bg-white/5 transition cursor-pointer">
            <div className="flex gap-3">
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden relative border border-slate-700">
                  {avatar ? (
                    <img src={avatar} alt={displayName} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = '')} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <User size={20} />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-slate-100 truncate text-sm md:text-base">{displayName}</span>
                    <span className="text-slate-500 text-xs truncate max-w-[80px] md:max-w-none">{handle}</span>
                    <span className="text-slate-600 text-[10px]">-</span>
                    <span className="text-slate-500 text-xs whitespace-nowrap">
                      {getRelativeTime(event.created_at)}
                    </span>
                  </div>
                  <button className="text-slate-500 hover:text-indigo-400">
                    <MoreHorizontal size={16} />
                  </button>
                </div>

                <div className="mt-1.5 text-slate-200 text-[15px] leading-relaxed whitespace-pre-wrap break-words font-light">
                  {event.content}
                </div>

                <div className="flex items-center justify-between mt-3 text-slate-500 max-w-md pr-4">
                  <button className="group flex items-center gap-1 hover:text-indigo-400 transition">
                    <div className="p-1.5 rounded-full group-hover:bg-indigo-500/10">
                      <MessageCircle size={16} />
                    </div>
                    <span className="text-xs font-medium">0</span>
                  </button>
                  <button className="group flex items-center gap-1 hover:text-green-400 transition">
                    <div className="p-1.5 rounded-full group-hover:bg-green-500/10">
                      <Repeat2 size={16} />
                    </div>
                    <span className="text-xs font-medium">0</span>
                  </button>
                  <button className="group flex items-center gap-1 hover:text-pink-500 transition">
                    <div className="p-1.5 rounded-full group-hover:bg-pink-500/10">
                      <Heart size={16} />
                    </div>
                    <span className="text-xs font-medium">0</span>
                  </button>
                  <button className="group flex items-center gap-1 hover:text-indigo-400 transition">
                    <div className="p-1.5 rounded-full group-hover:bg-indigo-500/10">
                      <Share2 size={16} />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="h-24"></div>
      </div>
    </div>
  );
};

export default CommunityProfile;
