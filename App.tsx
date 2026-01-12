import React, { useState, useEffect } from 'react';
import { UserKeys, ViewState } from './types';
import { DEFAULT_RELAYS, loadKeysFromString } from './services/nostrService';
import KeyManagement from './components/KeyManagement';
import ChatInterface from './components/ChatInterface';
import RelayManager from './components/RelayManager';
import DMList from './components/DMList';
import CommunityFeed from './components/CommunityFeed';
import BottomNav from './components/BottomNav';
import { Globe, MessageSquare, Settings, LogOut, Users } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';

const App: React.FC = () => {
  const [keys, setKeys] = useState<UserKeys | null>(null);
  const [view, setView] = useState<ViewState>(ViewState.LOGIN);
  const [relays, setRelays] = useState<string[]>(DEFAULT_RELAYS);
  const [dmTarget, setDmTarget] = useState<string | undefined>(undefined);
  const { t } = useLanguage();

  // Load keys from localStorage on mount
  useEffect(() => {
    // 1. Try to load correctly saved nsec
    const storedNsec = localStorage.getItem('nostr_nsec');
    if (storedNsec) {
      const loadedKeys = loadKeysFromString(storedNsec);
      if (loadedKeys) {
        setKeys(loadedKeys);
        setView(ViewState.GLOBAL_CHAT);
        // Load relays
        const storedRelays = localStorage.getItem('nostr_relays');
        if (storedRelays) {
          setRelays(JSON.parse(storedRelays));
        }
        return;
      }
    }

    // 2. Migration: Attempt to recover from old JSON object storage if it exists
    const oldKeys = localStorage.getItem('nostr_keys');
    if (oldKeys) {
      try {
        const parsed = JSON.parse(oldKeys);
        if (parsed && parsed.nsec) {
          const recovered = loadKeysFromString(parsed.nsec);
          if (recovered) {
            setKeys(recovered);
            localStorage.setItem('nostr_nsec', recovered.nsec); // Save in new format
            localStorage.removeItem('nostr_keys'); // Cleanup
            setView(ViewState.GLOBAL_CHAT);
             // Load relays
            const storedRelays = localStorage.getItem('nostr_relays');
            if (storedRelays) {
              setRelays(JSON.parse(storedRelays));
            }
            return;
          }
        }
      } catch (e) {
        console.error("Failed to recover old keys", e);
      }
      // If recovery fails, clear old garbage
      localStorage.removeItem('nostr_keys');
    }
    
    // Load relays even if not logged in (though typically we load defaults)
    const storedRelays = localStorage.getItem('nostr_relays');
    if (storedRelays) {
      setRelays(JSON.parse(storedRelays));
    }
  }, []);

  const handleLogin = (newKeys: UserKeys) => {
    setKeys(newKeys);
    // Store only the nsec string to avoid Uint8Array serialization issues
    localStorage.setItem('nostr_nsec', newKeys.nsec);
    setView(ViewState.GLOBAL_CHAT);
  };

  const handleLogout = () => {
    setKeys(null);
    localStorage.removeItem('nostr_nsec');
    localStorage.removeItem('nostr_keys');
    setView(ViewState.LOGIN);
  };

  const updateRelays = (newRelays: string[]) => {
    setRelays(newRelays);
    localStorage.setItem('nostr_relays', JSON.stringify(newRelays));
  };

  const handleSelectContact = (pubkey: string) => {
    setDmTarget(pubkey);
    setView(ViewState.DM_CHAT);
  };

  // Render Logic
  if (!keys) {
    return <KeyManagement onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (view) {
      case ViewState.GLOBAL_CHAT:
        return <ChatInterface keys={keys} relays={relays} mode="global" />;
      case ViewState.COMMUNITY:
        return <CommunityFeed keys={keys} relays={relays} />;
      case ViewState.DM_LIST:
        return <DMList keys={keys} relays={relays} onSelectContact={handleSelectContact} />;
      case ViewState.DM_CHAT:
        return <ChatInterface keys={keys} relays={relays} mode="dm" targetPubkey={dmTarget} />;
      case ViewState.SETTINGS:
        return <RelayManager relays={relays} setRelays={updateRelays} />;
      default:
        return <ChatInterface keys={keys} relays={relays} mode="global" />;
    }
  };

  // Sidebar item for desktop
  const SidebarItem = ({ target, icon: Icon, label }: { target: ViewState; icon: any; label: string }) => {
    const isActive = view === target || (target === ViewState.DM_LIST && view === ViewState.DM_CHAT);
    return (
      <button
        onClick={() => setView(target)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
          isActive 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <Icon size={20} />
        <span className="font-medium">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-900 p-4">
        <div className="mb-8 px-2 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
             <span className="text-white font-bold text-lg">N</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{t('app.name')}</h1>
        </div>
        
        <nav className="flex-1 space-y-2">
          <SidebarItem target={ViewState.GLOBAL_CHAT} icon={Globe} label={t('nav.global')} />
          <SidebarItem target={ViewState.COMMUNITY} icon={Users} label={t('nav.community')} />
          <SidebarItem target={ViewState.DM_LIST} icon={MessageSquare} label={t('nav.dm')} />
          <SidebarItem target={ViewState.SETTINGS} icon={Settings} label={t('nav.settings')} />
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-800">
           <div className="px-4 py-3 bg-slate-800/50 rounded-lg mb-4">
             <p className="text-xs text-slate-400 uppercase font-bold mb-1">Your ID</p>
             <p className="text-xs font-mono text-slate-300 truncate">{keys.npub}</p>
           </div>
           <button 
             onClick={handleLogout}
             className="flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg w-full transition text-sm font-medium"
            >
              <LogOut size={18} />
              {t('nav.logout')}
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative w-full h-full">
        {renderContent()}
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav view={view} setView={setView} />
    </div>
  );
};

export default App;