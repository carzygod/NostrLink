import React, { useEffect, useMemo, useState } from 'react';
import { UserKeys, ChannelInfo } from '../types';
import { getPool, publishChannelCreate } from '../services/nostrService';
import { Filter, validateEvent, verifyEvent } from 'nostr-tools';
import { Users, Plus, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

interface GroupListProps {
  keys: UserKeys;
  relays: string[];
  onSelectChannel: (channelId: string) => void;
}

const GroupList: React.FC<GroupListProps> = ({ keys, relays, onSelectChannel }) => {
  const [channels, setChannels] = useState<Record<string, ChannelInfo>>({});
  const [loading, setLoading] = useState(true);
  const [channelName, setChannelName] = useState('');
  const [channelAbout, setChannelAbout] = useState('');
  const [joinChannelId, setJoinChannelId] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const { t } = useLanguage();

  const pool = getPool();

  useEffect(() => {
    setLoading(true);
    const filter: Filter = { kinds: [40, 41], limit: 100 };
    const sub = pool.subscribeMany(relays, filter, {
      onevent: (event) => {
        if (!validateEvent(event) || !verifyEvent(event)) return;
        setChannels((prev) => {
          const next = { ...prev };
          let channelId = event.kind === 40 ? event.id : event.tags.find((t) => t[0] === 'e')?.[1];
          if (!channelId) return prev;

          let parsed: any = {};
          try {
            parsed = JSON.parse(event.content || '{}');
          } catch {
            parsed = {};
          }

          const existing = next[channelId] || { id: channelId };
          const updated: ChannelInfo = {
            id: channelId,
            name: parsed.name || existing.name,
            about: parsed.about || existing.about,
            picture: parsed.picture || existing.picture,
            createdAt: event.created_at || existing.createdAt
          };
          next[channelId] = updated;
          return next;
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
  }, [relays]);

  const sortedChannels = useMemo(() => {
    return Object.values(channels).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [channels]);

  const handleCreate = async () => {
    const name = channelName.trim();
    if (!name) return;
    setCreating(true);
    setError('');
    try {
      const channelId = await publishChannelCreate(keys, relays, name, channelAbout.trim() || undefined);
      setChannelName('');
      setChannelAbout('');
      onSelectChannel(channelId);
    } catch (e) {
      setError(t('group.create_failed'));
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = () => {
    const id = joinChannelId.trim();
    if (!id) return;
    if (!/^[a-f0-9]{64}$/i.test(id)) {
      setError(t('group.invalid_channel'));
      return;
    }
    setError('');
    onSelectChannel(id);
    setJoinChannelId('');
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return t('group.unknown_time');
    return formatDistanceToNow(timestamp * 1000, { addSuffix: true }).replace('about ', '');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 w-full relative">
      <div className="flex items-center gap-3 p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700 sticky top-0 z-10">
        <div className="bg-indigo-500/20 text-indigo-400 p-2 rounded-full">
          <Users size={20} />
        </div>
        <div>
          <h2 className="font-semibold text-white">{t('nav.group')}</h2>
          <p className="text-xs text-slate-400">{t('group.subtitle')}</p>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1 pb-20">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 space-y-3">
          <h3 className="text-sm font-medium text-slate-300">{t('group.create')}</h3>
          <input
            type="text"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder={t('group.name_placeholder')}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            value={channelAbout}
            onChange={(e) => setChannelAbout(e.target.value)}
            placeholder={t('group.about_placeholder')}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleCreate}
            disabled={!channelName.trim() || creating}
            className="bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white w-full py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {t('group.create')}
          </button>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 space-y-3">
          <h3 className="text-sm font-medium text-slate-300">{t('group.join')}</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinChannelId}
              onChange={(e) => setJoinChannelId(e.target.value)}
              placeholder={t('group.join_placeholder')}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleJoin}
              disabled={!joinChannelId.trim()}
              className="bg-emerald-600 disabled:bg-slate-700 text-white p-2 rounded-lg transition"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {loading && sortedChannels.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-indigo-500" />
          </div>
        )}

        {!loading && sortedChannels.length === 0 && (
          <div className="text-center text-slate-500 py-10 opacity-70">
            <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p>{t('group.no_channels')}</p>
          </div>
        )}

        <div className="space-y-2">
          {sortedChannels.map((channel) => (
            <div
              key={channel.id}
              onClick={() => onSelectChannel(channel.id)}
              className="flex items-center gap-3 p-3 bg-slate-800/40 hover:bg-slate-800 rounded-xl cursor-pointer border border-transparent hover:border-slate-700 transition active:scale-95"
            >
              <div className="w-12 h-12 rounded-full bg-slate-700 flex-shrink-0 overflow-hidden relative flex items-center justify-center text-slate-400">
                <Users size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="text-sm font-semibold text-slate-200 truncate pr-2">
                    {channel.name || t('group.unnamed')}
                  </h3>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {formatTime(channel.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate opacity-80">
                  {channel.about || channel.id.slice(0, 12)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupList;
