import React, { useState, useEffect } from 'react';
import { UserKeys, DMConversation, UserProfile, NostrEvent } from '../types';
import { getPool, decryptMessage, fetchProfiles } from '../services/nostrService';
import { parseMessagePayload } from '../utils/messagePayload';
import { nip19, Filter, ProfilePointer } from 'nostr-tools';
import { MessageSquare, ArrowRight, UserPlus, Search, Loader2, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

interface DMListProps {
  keys: UserKeys;
  relays: string[];
  onSelectContact: (pubkey: string) => void;
}

const DMList: React.FC<DMListProps> = ({ keys, relays, onSelectContact }) => {
  const [inputKey, setInputKey] = useState('');
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [loading, setLoading] = useState(true);
  
  const pool = getPool();
  const { t } = useLanguage();

  useEffect(() => {
    let isMounted = true;

    const fetchConversations = async () => {
      setLoading(true);
      const dmMap = new Map<string, any>(); // pubkey -> event

      // We need to fetch sent and received messages
      // Filter limits are tricky. We ask for recent 100 of each.
      const receivedFilter: Filter = { kinds: [4], '#p': [keys.pk], limit: 100 }; // Received
      const sentFilter: Filter = { kinds: [4], authors: [keys.pk], limit: 100 }; // Sent

      // Temporary storage for raw events before processing
      const rawEvents: any[] = [];

      let eoseCount = 0;
      let isResolved = false;

      const finalize = async () => {
        if (!isMounted || isResolved) return;
        isResolved = true;

        // Process raw events to find unique conversations
        for (const event of rawEvents) {
          const isMe = event.pubkey === keys.pk;
          const otherPubkey = isMe 
            ? event.tags.find((t: string[]) => t[0] === 'p')?.[1] 
            : event.pubkey;

          if (!otherPubkey) continue;

          const existing = dmMap.get(otherPubkey);
          if (!existing || event.created_at > existing.created_at) {
            dmMap.set(otherPubkey, event);
          }
        }

        // Convert map to array and fetch profiles
        const uniquePubkeys = Array.from(dmMap.keys());
        const profiles = await fetchProfiles(relays, uniquePubkeys);

        const convos: DMConversation[] = [];

        for (const pubkey of uniquePubkeys) {
          const event = dmMap.get(pubkey);
          let content = "Encrypted Message";
          
          try {
            // Decrypt preview
            const decryptKey = event.pubkey === keys.pk ? pubkey : event.pubkey;
            content = await decryptMessage(keys, decryptKey, event.content);
          } catch (e) {
             // ignore
          }

          const parsed = parseMessagePayload(content);
          let preview = parsed.text || content;
          if (!parsed.text && parsed.attachments.length > 0) {
            const kind = parsed.attachments[0].kind;
            preview =
              kind === 'image'
                ? t('chat.preview_image')
                : kind === 'video'
                  ? t('chat.preview_video')
                  : kind === 'audio'
                    ? t('chat.preview_audio')
                    : t('chat.preview_file');
            if (parsed.attachments.length > 1) {
              preview = `${preview} +${parsed.attachments.length - 1}`;
            }
          }

          convos.push({
            pubkey,
            lastMessageTime: event.created_at,
            lastMessageContent: preview,
            profile: profiles[pubkey]
          });
        }

        // Sort by latest message
        convos.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        
        if (isMounted) {
          setConversations(convos);
          setLoading(false);
        }
      };

      const handleEvent = (event: NostrEvent) => {
        rawEvents.push(event);
      };

      const handleEose = async () => {
        if (!isMounted) return;
        eoseCount += 1;
        if (eoseCount >= 2) {
          await finalize();
          subs.forEach((sub) => sub.close());
        }
      };

      const subs = [
        pool.subscribeMany(relays, receivedFilter, { onevent: handleEvent, oneose: handleEose }),
        pool.subscribeMany(relays, sentFilter, { onevent: handleEvent, oneose: handleEose })
      ];
      
      // Fallback timeout in case oneose never fires (rare but possible with some relays)
      setTimeout(() => {
        if(isMounted && loading) {
           subs.forEach((sub) => sub.close());
           finalize().catch(() => {});
        }
      }, 5000);
    };

    fetchConversations();
    return () => { isMounted = false; };
  }, [relays, keys]);

  const handleStartChat = () => {
    try {
      let pubkeyHex = inputKey.trim();
      if (!pubkeyHex) return;

      if (pubkeyHex.startsWith('npub')) {
        const decoded = nip19.decode(pubkeyHex);
        if (decoded.type === 'npub') {
          pubkeyHex = decoded.data as string;
        } else if (decoded.type === 'nprofile') {
          // data is ProfilePointer
          pubkeyHex = (decoded.data as ProfilePointer).pubkey;
        }
      }
      onSelectContact(pubkeyHex);
      setInputKey('');
    } catch (e) {
      console.error(e);
      alert("Invalid Public Key (npub or hex)");
    }
  };

  const formatPubKey = (hex: string) => {
    try {
      return nip19.npubEncode(hex).slice(0, 10) + '...';
    } catch {
      return hex.slice(0, 8);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 w-full relative min-w-0">
       {/* Header */}
       <div className="flex items-center gap-3 p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700 sticky top-0 z-10">
        <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-full">
          <MessageSquare size={20} />
        </div>
        <div>
          <h2 className="font-semibold text-white">{t('nav.dm')}</h2>
          <p className="text-xs text-slate-400">Secure, Private, End-to-End Encrypted</p>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1 pb-20 min-w-0">
        {/* Search / New Chat */}
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 flex gap-2">
            <input
              type="text"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder={t('dm.search')}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <button 
              onClick={handleStartChat}
              disabled={!inputKey}
              className="bg-emerald-600 disabled:bg-slate-700 text-white p-2 rounded-lg transition"
            >
              <ArrowRight size={18} />
            </button>
        </div>

        {loading && conversations.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-emerald-500" />
          </div>
        )}

        {!loading && conversations.length === 0 && (
           <div className="text-center text-slate-500 py-10 opacity-70">
             <UserPlus size={48} className="mx-auto mb-3 opacity-50" />
             <p>{t('dm.no_convos')}</p>
             <p className="text-xs">{t('dm.start_prompt')}</p>
           </div>
        )}

        {/* Conversation List */}
        <div className="space-y-2">
          {conversations.map((convo) => {
            const name = convo.profile?.displayName || convo.profile?.name || formatPubKey(convo.pubkey);
            const avatar = convo.profile?.picture;

            return (
              <div 
                key={convo.pubkey} 
                onClick={() => onSelectContact(convo.pubkey)}
                className="flex items-center gap-3 p-3 bg-slate-800/40 hover:bg-slate-800 rounded-xl cursor-pointer border border-transparent hover:border-slate-700 transition active:scale-95"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-slate-700 flex-shrink-0 overflow-hidden relative">
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src='')} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <User size={20} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="text-sm font-semibold text-slate-200 truncate pr-2">{name}</h3>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {formatDistanceToNow(convo.lastMessageTime * 1000, { addSuffix: true }).replace('about ', '')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate opacity-80">
                    {convo.lastMessageContent}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DMList;
