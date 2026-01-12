import React, { useState, useEffect, useRef } from 'react';
import { UserKeys, NostrEvent, UserProfile } from '../types';
import { getPool, fetchProfiles, publishNote } from '../services/nostrService';
import { nip19, Filter, validateEvent, verifyEvent } from 'nostr-tools';
import { 
  MessageCircle, 
  Repeat2, 
  Heart, 
  Share2, 
  User, 
  MoreHorizontal, 
  PenSquare, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

interface CommunityFeedProps {
  keys: UserKeys;
  relays: string[];
}

const CommunityFeed: React.FC<CommunityFeedProps> = ({ keys, relays }) => {
  const [events, setEvents] = useState<NostrEvent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const { t } = useLanguage();

  const pool = getPool();
  // Ref to track which profiles we have already requested to avoid loop
  const requestedProfiles = useRef<Set<string>>(new Set());

  // 1. Subscribe to Feed
  useEffect(() => {
    setLoading(true);
    setEvents([]);
    
    console.log("[Community] Subscribing to relays:", relays);

    // Subscribe to Kind 1 (Text Notes)
    const filters: Filter[] = [{ kinds: [1], limit: 25 }];
    const sub = pool.subscribeMany(relays, filters, {
      onevent: (event) => {
        if (!validateEvent(event) || !verifyEvent(event)) {
          return;
        }
        // Log the received event data to console as requested
        console.log("[Relay Event Received]", {
          id: event.id,
          pubkey: event.pubkey,
          kind: event.kind,
          content: event.content.substring(0, 50) + (event.content.length > 50 ? '...' : ''),
          created_at: new Date(event.created_at * 1000).toLocaleString()
        });

        setEvents((prev) => {
          if (prev.find((e) => e.id === event.id)) return prev;
          // Insert new event and sort by created_at descending (newest top)
          const newEvents = [...prev, event].sort((a, b) => b.created_at - a.created_at);
          return newEvents;
        });
      },
      oneose: () => {
        console.log("[Community] EOSE: Initial load complete.");
        setLoading(false);
      }
    });

    // Timeout fallback in case relays are silent
    const timeout = setTimeout(() => {
        setLoading(false);
    }, 3500);

    return () => {
      sub.close();
      clearTimeout(timeout);
    };
  }, [relays]);

  // 2. Fetch Profiles for Authors in Feed
  useEffect(() => {
    const fetchMissingProfiles = async () => {
      const authors = new Set<string>(events.map(e => e.pubkey));
      const missing = Array.from(authors).filter((pubkey: string) => 
        !profiles[pubkey] && !requestedProfiles.current.has(pubkey)
      );

      if (missing.length > 0) {
        // Mark as requested to prevent dupes
        missing.forEach(p => requestedProfiles.current.add(p));
        
        console.log(`[Community] Fetching metadata for ${missing.length} authors...`);
        const newProfiles = await fetchProfiles(relays, missing);
        
        setProfiles(prev => ({ ...prev, ...newProfiles }));
      }
    };

    if (events.length > 0) {
      // Debounce slightly to batch requests
      const timeout = setTimeout(fetchMissingProfiles, 800);
      return () => clearTimeout(timeout);
    }
  }, [events, relays, profiles]);

  const handlePublish = async () => {
    if (!newPostContent.trim()) return;
    setIsPosting(true);
    try {
      console.log("[Community] Publishing note...");
      await publishNote(keys, relays, newPostContent);
      console.log("[Community] Published successfully.");
      setNewPostContent('');
      setShowPostModal(false);
    } catch (e) {
      console.error("[Community] Failed to post:", e);
      alert(t('community.failed'));
    } finally {
      setIsPosting(false);
    }
  };

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
    } catch (e) {
      return 'unknown';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 w-full relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-10">
        <div>
            <h2 className="text-xl font-bold text-white">{t('community.title')}</h2>
            <p className="text-[10px] text-slate-500">{t('community.live')} {relays.length} Relays</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
           {/* Current user avatar placeholder */}
           <div className="w-full h-full flex items-center justify-center text-slate-500">
             <User size={16} />
           </div>
        </div>
      </div>

      {/* Feed List */}
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

        {events.map((event) => {
          const profile = profiles[event.pubkey];
          const displayName = profile?.displayName || profile?.name || formatPubKey(event.pubkey);
          const handle = profile?.name ? `@${profile.name}` : formatPubKey(event.pubkey);
          const avatar = profile?.picture;

          return (
            <div key={event.id} className="p-4 border-b border-slate-800 hover:bg-white/5 transition cursor-pointer">
              <div className="flex gap-3">
                {/* Avatar */}
                <div className="shrink-0">
                  <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden relative border border-slate-700">
                    {avatar ? (
                      <img src={avatar} alt={displayName} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src='')} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <User size={20} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
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

                  {/* Actions Bar */}
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
          );
        })}
        <div className="h-24"></div> {/* Bottom spacer for FAB */}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowPostModal(true)}
        className="absolute bottom-20 md:bottom-8 right-4 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center hover:bg-indigo-500 transition active:scale-95 z-20"
      >
        <PenSquare size={24} />
      </button>

      {/* Post Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl p-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
              <button 
                onClick={() => setShowPostModal(false)}
                className="text-slate-400 hover:text-white"
              >
                {t('community.cancel')}
              </button>
              <button 
                onClick={handlePublish}
                disabled={!newPostContent.trim() || isPosting}
                className="bg-indigo-600 px-4 py-1.5 rounded-full text-white font-bold text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isPosting && <Loader2 size={12} className="animate-spin" />}
                {isPosting ? t('community.posting') : t('community.post')}
              </button>
            </div>
            
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                 Me
              </div>
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder={t('community.whats_happening')}
                className="flex-1 bg-transparent text-lg text-white placeholder-slate-500 focus:outline-none resize-none min-h-[150px]"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityFeed;

