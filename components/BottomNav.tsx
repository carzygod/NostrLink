import React from 'react';
import { ViewState } from '../types';
import { Globe, MessageSquare, Settings, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface BottomNavProps {
  view: ViewState;
  setView: (v: ViewState) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ view, setView }) => {
  const { t } = useLanguage();
  
  const NavItem = ({ target, icon: Icon, label }: { target: ViewState; icon: any; label: string }) => {
    const isActive = view === target || (target === ViewState.DM_LIST && view === ViewState.DM_CHAT);
    return (
      <button
        onClick={() => setView(target)}
        className={`flex flex-col items-center justify-center w-full py-1 space-y-1 ${
          isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
        } transition-colors`}
      >
        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
        <span className="text-[10px] font-medium">{label}</span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around z-50 md:hidden">
      <NavItem target={ViewState.GLOBAL_CHAT} icon={Globe} label={t('nav.global')} />
      <NavItem target={ViewState.COMMUNITY} icon={Users} label={t('nav.community')} />
      <NavItem target={ViewState.DM_LIST} icon={MessageSquare} label={t('nav.dm')} />
      <NavItem target={ViewState.SETTINGS} icon={Settings} label={t('nav.settings')} />
    </div>
  );
};

export default BottomNav;