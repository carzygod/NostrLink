import React, { useState, useEffect } from 'react';
import { Trash2, Plus, RefreshCw, Activity, AlertCircle, Languages, Copy, Check } from 'lucide-react';
import { utils } from 'nostr-tools';
import { checkRelayHealth } from '../services/nostrService';
import { RelayMetric, Language, UserKeys } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface RelayManagerProps {
  relays: string[];
  setRelays: (relays: string[]) => void;
  keys: UserKeys;
}

const RelayManager: React.FC<RelayManagerProps> = ({ relays, setRelays, keys }) => {
  const [newRelay, setNewRelay] = useState('');
  const [metrics, setMetrics] = useState<Record<string, RelayMetric>>({});
  const [checking, setChecking] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedPrivateKey, setCopiedPrivateKey] = useState(false);
  const [relayError, setRelayError] = useState('');
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    checkAllRelays();
  }, [relays]);

  const checkAllRelays = async () => {
    setChecking(true);
    const results: Record<string, RelayMetric> = {};

    // Check all relays concurrently
    const promises = relays.map(async (url) => {
      // Set initial state to checking
      setMetrics(prev => ({ ...prev, [url]: { url, latency: 0, status: 'checking' } }));
      const metric = await checkRelayHealth(url);
      results[url] = metric;
      // Update individually as they finish for better UX
      setMetrics(prev => ({ ...prev, [url]: metric }));
    });

    await Promise.all(promises);
    setChecking(false);
  };

  const addRelay = () => {
    const trimmed = newRelay.trim();
    if (!trimmed) return;
    try {
      const normalized = utils.normalizeURL(trimmed);
      if (!relays.includes(normalized)) {
        setRelays([...relays, normalized]);
      }
      setNewRelay('');
      setRelayError('');
    } catch (e) {
      setRelayError(t('settings.relay_invalid'));
    }
  };

  const removeRelay = (url: string) => {
    setRelays(relays.filter(r => r !== url));
    const newMetrics = { ...metrics };
    delete newMetrics[url];
    setMetrics(newMetrics);
  };

  const handleCopy = (text: string, setCopied: (value: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const languages: { code: Language; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'zh-CN', label: '\u7B80\u4F53\u4E2D\u6587' },
    { code: 'zh-TW', label: '\u7E41\u9AD4\u4E2D\u6587' },
    { code: 'ru', label: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">{t('settings.title')}</h2>
      </div>

      {/* Account Settings */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">{t('settings.address')}</h3>
            <button
              onClick={() => handleCopy(keys.npub, setCopiedAddress)}
              className="text-slate-400 hover:text-slate-200 transition"
              aria-label={t('settings.copy')}
            >
              {copiedAddress ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-xs font-mono text-slate-200 break-all bg-slate-900/60 border border-slate-700 rounded-lg p-2">
            {keys.npub}
          </p>
        </div>

        <div className="border-t border-slate-700/60"></div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">{t('settings.private_key')}</h3>
            <button
              onClick={() => handleCopy(keys.nsec, setCopiedPrivateKey)}
              className="text-slate-400 hover:text-slate-200 transition"
              aria-label={t('settings.copy')}
            >
              {copiedPrivateKey ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-xs font-mono text-slate-200 break-all bg-slate-900/60 border border-slate-700 rounded-lg p-2">
            ***
          </p>
          <p className="text-xs text-amber-400 mt-2">{t('settings.private_key_warning')}</p>
        </div>
      </div>

      {/* Language Settings */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-3 text-slate-400">
          <Languages size={18} />
          <h3 className="text-sm font-medium">{t('settings.language')}</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`p-2 rounded-lg text-sm font-medium transition ${
                language === lang.code
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800 my-4"></div>

      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-white">{t('settings.relays')}</h3>
        <button
          onClick={checkAllRelays}
          disabled={checking}
          className={`p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition ${checking ? 'animate-spin opacity-50' : ''}`}
        >
          <RefreshCw size={20} className="text-indigo-400" />
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-400 mb-3">{t('settings.add_relay')}</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newRelay}
            onChange={(e) => {
              setNewRelay(e.target.value);
              if (relayError) setRelayError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addRelay();
            }}
            placeholder="wss://..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={addRelay}
            disabled={!newRelay.trim()}
            className="bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white p-2 rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus size={20} />
          </button>
        </div>
        {relayError && <p className="text-xs text-red-400 mt-2">{relayError}</p>}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400 px-1 flex justify-between">
          <span>{t('settings.connected')} ({relays.length})</span>
          <span className="text-xs font-normal opacity-50">Latency</span>
        </h3>
        {relays.map((relay) => {
          const metric = metrics[relay];
          const isError = metric?.status === 'error';
          const isChecking = metric?.status === 'checking';
          const latency = metric?.latency;

          return (
            <div key={relay} className="group flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                {/* Status Dot */}
                <div className={`w-2.5 h-2.5 rounded-full shadow-sm transition-colors duration-500 ${
                  isChecking ? 'bg-yellow-500 animate-pulse' :
                  isError ? 'bg-red-500 shadow-red-500/50' :
                  'bg-emerald-500 shadow-emerald-500/50'
                }`}></div>

                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-slate-200 truncate font-mono">{relay}</span>
                  {isError && <span className="text-[10px] text-red-400">{metric.errorMsg || 'Connection failed'}</span>}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Latency Display */}
                <div className="flex items-center gap-1.5 w-16 justify-end">
                  {!isError && !isChecking && latency !== undefined && latency > -1 && (
                    <>
                      <Activity size={12} className={latency < 200 ? 'text-emerald-500' : latency < 500 ? 'text-yellow-500' : 'text-red-400'} />
                      <span className={`text-xs font-mono ${latency < 200 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {latency}ms
                      </span>
                    </>
                  )}
                  {isChecking && <span className="text-xs text-slate-500">...</span>}
                </div>

                <button
                  onClick={() => removeRelay(relay)}
                  className="text-slate-600 hover:text-red-400 transition p-1.5 hover:bg-red-900/10 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl flex items-start gap-3">
        <AlertCircle className="text-indigo-400 shrink-0 mt-0.5" size={18} />
        <div className="space-y-1">
          <p className="text-xs text-indigo-300 font-medium">{t('settings.health')}</p>
          <p className="text-xs text-indigo-300/80 leading-relaxed">
            {t('settings.health_desc')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RelayManager;
