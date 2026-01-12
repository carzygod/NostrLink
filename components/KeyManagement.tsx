import React, { useState } from 'react';
import { generateKeys, loadKeysFromString } from '../services/nostrService';
import { UserKeys } from '../types';
import { Key, LogIn, RefreshCw, Copy, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface KeyManagementProps {
  onLogin: (keys: UserKeys) => void;
}

const KeyManagement: React.FC<KeyManagementProps> = ({ onLogin }) => {
  const [nsecInput, setNsecInput] = useState('');
  const [generated, setGenerated] = useState<UserKeys | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();

  const handleLogin = () => {
    if (!nsecInput.startsWith('nsec')) {
      setError(t('login.error.format'));
      return;
    }
    const keys = loadKeysFromString(nsecInput);
    if (keys) {
      onLogin(keys);
    } else {
      setError(t('login.error.invalid'));
    }
  };

  const handleGenerate = () => {
    const keys = generateKeys();
    setGenerated(keys);
    setNsecInput(keys.nsec);
    setError('');
  };

  const copyToClipboard = () => {
    if (generated) {
      navigator.clipboard.writeText(generated.nsec);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-900 text-slate-100">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="bg-indigo-600 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Key size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t('app.name')}</h1>
          <p className="text-slate-400">{t('app.desc')}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700 shadow-xl space-y-6">
          {generated && (
            <div className="bg-emerald-900/30 border border-emerald-700/50 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-400">{t('login.success')}</span>
                <button onClick={copyToClipboard} className="text-emerald-400 hover:text-emerald-300 transition">
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <p className="text-xs text-slate-300 break-all font-mono bg-black/20 p-2 rounded">
                {generated.nsec}
              </p>
              <p className="text-xs text-red-300 font-medium">
                {t('login.warning')}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">{t('login.placeholder').replace('1...', ' Key')}</label>
            <input
              type="password"
              value={nsecInput}
              onChange={(e) => setNsecInput(e.target.value)}
              placeholder={t('login.placeholder')}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <LogIn size={20} />
            {t('login.title')}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-slate-800 px-2 text-slate-500">{t('login.or')}</span>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            <RefreshCw size={20} />
            {t('login.generate')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyManagement;