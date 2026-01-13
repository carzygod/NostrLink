export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface UserKeys {
  sk: Uint8Array; // Secret Key
  pk: string; // Public Key (Hex)
  nsec: string; // Bech32 Secret
  npub: string; // Bech32 Public
}

export interface ChatMessage {
  id: string;
  senderPubkey: string;
  content: string;
  createdAt: number;
  isMe: boolean;
}

export enum ViewState {
  LOGIN = 'LOGIN',
  GLOBAL_CHAT = 'GLOBAL_CHAT',
  COMMUNITY = 'COMMUNITY',
  COMMUNITY_PROFILE = 'COMMUNITY_PROFILE',
  GROUP_LIST = 'GROUP_LIST',
  GROUP_CHAT = 'GROUP_CHAT',
  DM_LIST = 'DM_LIST',
  DM_CHAT = 'DM_CHAT',
  SETTINGS = 'SETTINGS'
}

export interface RelayStatus {
  url: string;
  status: 'connected' | 'disconnected' | 'connecting';
}

export interface RelayMetric {
  url: string;
  latency: number; // ms, -1 if error
  status: 'connected' | 'error' | 'checking';
  errorMsg?: string;
}

export interface UserProfile {
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  about?: string;
}

export interface ChannelInfo {
  id: string;
  name?: string;
  about?: string;
  picture?: string;
  createdAt?: number;
}

export interface DMConversation {
  pubkey: string;
  lastMessageTime: number;
  lastMessageContent: string;
  profile?: UserProfile;
}

export type Language = 'en' | 'zh-CN' | 'zh-TW' | 'ru';
