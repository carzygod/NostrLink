import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '../types';

type Translations = Record<string, string>;
type Dictionary = Record<Language, Translations>;

const dictionary: Dictionary = {
  'en': {
    'app.name': 'NostrLink',
    'app.desc': 'Secure, decentralized messaging.',
    'login.title': 'Login',
    'login.generate': 'Generate New Key',
    'login.or': 'Or',
    'login.placeholder': 'nsec1...',
    'login.error.format': 'Invalid key format. Must start with nsec.',
    'login.error.invalid': 'Invalid Private Key',
    'login.success': 'New Key Generated!',
    'login.warning': 'Save this key safely! If you lose it, your account is gone forever.',
    'nav.global': 'Global Chat',
    'nav.community': 'Community',
    'nav.dm': 'Direct Messages',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.relays': 'Relay Settings',
    'settings.add_relay': 'Add New Relay',
    'settings.connected': 'Connected Relays',
    'settings.health': 'Relay Health',
    'settings.health_desc': 'Lower latency (ms) means faster message delivery. We recommend keeping at least 2 green relays.',
    'chat.placeholder': 'Broadcast to the world...',
    'chat.placeholder_dm': 'Send encrypted message...',
    'chat.connecting': 'Connecting to relays...',
    'chat.no_messages': 'No messages found.',
    'chat.be_first': 'Be the first to say hello!',
    'chat.send_failed': 'Failed to send. Check relay connection.',
    'dm.search': 'Start new chat (npub...)',
    'dm.no_convos': 'No conversations found.',
    'dm.start_prompt': 'Start a chat with a public key above.',
    'community.title': 'Community',
    'community.live': 'Live from',
    'community.listening': 'Listening for events...',
    'community.no_posts': 'No posts found on connected relays.',
    'community.post': 'Post',
    'community.posting': 'Posting...',
    'community.cancel': 'Cancel',
    'community.whats_happening': "What's happening?",
    'community.failed': 'Failed to post message.',
  },
  'zh-CN': {
    'app.name': 'NostrLink',
    'app.desc': '安全、去中心化的消息传递。',
    'login.title': '登录',
    'login.generate': '生成新密钥',
    'login.or': '或',
    'login.placeholder': 'nsec1...',
    'login.error.format': '密钥格式无效。必须以 nsec 开头。',
    'login.error.invalid': '无效的私钥',
    'login.success': '新密钥已生成！',
    'login.warning': '请安全保存此密钥！如果丢失，您的帐户将永久丢失。',
    'nav.global': '全球聊天',
    'nav.community': '社区',
    'nav.dm': '私信',
    'nav.settings': '设置',
    'nav.logout': '退出登录',
    'settings.title': '设置',
    'settings.language': '语言',
    'settings.relays': '中继器设置',
    'settings.add_relay': '添加新中继器',
    'settings.connected': '已连接的中继器',
    'settings.health': '中继器健康状况',
    'settings.health_desc': '延迟（ms）越低，消息传递越快。建议至少保留 2 个绿色状态的中继器。',
    'chat.placeholder': '向世界广播...',
    'chat.placeholder_dm': '发送加密消息...',
    'chat.connecting': '正在连接中继器...',
    'chat.no_messages': '未找到消息。',
    'chat.be_first': '成为第一个打招呼的人！',
    'chat.send_failed': '发送失败。请检查中继器连接。',
    'dm.search': '开始新聊天 (npub...)',
    'dm.no_convos': '未找到对话。',
    'dm.start_prompt': '使用上方的公钥开始聊天。',
    'community.title': '社区',
    'community.live': '实时来自',
    'community.listening': '正在监听事件...',
    'community.no_posts': '在已连接的中继器上未找到帖子。',
    'community.post': '发布',
    'community.posting': '正在发布...',
    'community.cancel': '取消',
    'community.whats_happening': '发生了什么？',
    'community.failed': '发布消息失败。',
  },
  'zh-TW': {
    'app.name': 'NostrLink',
    'app.desc': '安全、去中心化的訊息傳遞。',
    'login.title': '登入',
    'login.generate': '產生新金鑰',
    'login.or': '或',
    'login.placeholder': 'nsec1...',
    'login.error.format': '金鑰格式無效。必須以 nsec 開頭。',
    'login.error.invalid': '無效的私鑰',
    'login.success': '新金鑰已產生！',
    'login.warning': '請安全保存此金鑰！如果丟失，您的帳戶將永久丟失。',
    'nav.global': '全球聊天',
    'nav.community': '社群',
    'nav.dm': '私訊',
    'nav.settings': '設定',
    'nav.logout': '登出',
    'settings.title': '設定',
    'settings.language': '語言',
    'settings.relays': '中繼器設定',
    'settings.add_relay': '新增中繼器',
    'settings.connected': '已連線的中繼器',
    'settings.health': '中繼器健康狀況',
    'settings.health_desc': '延遲（ms）越低，訊息傳遞越快。建議至少保留 2 個綠色狀態的中繼器。',
    'chat.placeholder': '向世界廣播...',
    'chat.placeholder_dm': '發送加密訊息...',
    'chat.connecting': '正在連線中繼器...',
    'chat.no_messages': '未找到訊息。',
    'chat.be_first': '成為第一個打招呼的人！',
    'chat.send_failed': '發送失敗。請檢查中繼器連線。',
    'dm.search': '開始新聊天 (npub...)',
    'dm.no_convos': '未找到對話。',
    'dm.start_prompt': '使用上方的公鑰開始聊天。',
    'community.title': '社群',
    'community.live': '即時來自',
    'community.listening': '正在監聽事件...',
    'community.no_posts': '在已連線的中繼器上未找到貼文。',
    'community.post': '發佈',
    'community.posting': '正在發佈...',
    'community.cancel': '取消',
    'community.whats_happening': '發生了什麼？',
    'community.failed': '發佈訊息失敗。',
  },
  'ru': {
    'app.name': 'NostrLink',
    'app.desc': 'Безопасный децентрализованный мессенджер.',
    'login.title': 'Вход',
    'login.generate': 'Создать новый ключ',
    'login.or': 'Или',
    'login.placeholder': 'nsec1...',
    'login.error.format': 'Неверный формат. Должен начинаться с nsec.',
    'login.error.invalid': 'Неверный приватный ключ',
    'login.success': 'Новый ключ создан!',
    'login.warning': 'Сохраните этот ключ! Если вы его потеряете, доступ к аккаунту будет невозможен.',
    'nav.global': 'Глобальный чат',
    'nav.community': 'Сообщество',
    'nav.dm': 'Личные сообщения',
    'nav.settings': 'Настройки',
    'nav.logout': 'Выйти',
    'settings.title': 'Настройки',
    'settings.language': 'Язык',
    'settings.relays': 'Настройки реле',
    'settings.add_relay': 'Добавить реле',
    'settings.connected': 'Подключенные реле',
    'settings.health': 'Здоровье реле',
    'settings.health_desc': 'Меньшая задержка (мс) означает более быструю доставку. Рекомендуется минимум 2 зеленых реле.',
    'chat.placeholder': 'Трансляция всему миру...',
    'chat.placeholder_dm': 'Отправить зашифрованное сообщение...',
    'chat.connecting': 'Подключение к реле...',
    'chat.no_messages': 'Сообщений не найдено.',
    'chat.be_first': 'Поздоровайтесь первым!',
    'chat.send_failed': 'Ошибка отправки. Проверьте подключение.',
    'dm.search': 'Новый чат (npub...)',
    'dm.no_convos': 'Диалоги не найдены.',
    'dm.start_prompt': 'Начните чат, используя публичный ключ выше.',
    'community.title': 'Сообщество',
    'community.live': 'Прямой эфир с',
    'community.listening': 'Ожидание событий...',
    'community.no_posts': 'Посты не найдены.',
    'community.post': 'Опубликовать',
    'community.posting': 'Публикация...',
    'community.cancel': 'Отмена',
    'community.whats_happening': 'Что происходит?',
    'community.failed': 'Не удалось опубликовать сообщение.',
  }
};

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('nostr_lang') as Language;
    if (saved && dictionary[saved]) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('nostr_lang', lang);
  };

  const t = (key: string): string => {
    return dictionary[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};