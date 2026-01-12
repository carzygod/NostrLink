import { 
  generateSecretKey, 
  getPublicKey, 
  finalizeEvent, 
  nip19, 
  SimplePool, 
  nip04,
  Filter
} from 'nostr-tools';
import { NostrEvent, UserKeys, RelayMetric, UserProfile } from '../types';

// Default Relays - Updated to only include relay.damus.io as requested
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io'
];

// Helper to encode/decode keys
export const generateKeys = (): UserKeys => {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  const nsec = nip19.nsecEncode(sk);
  const npub = nip19.npubEncode(pk);
  return { sk, pk, nsec, npub };
};

export const loadKeysFromString = (nsecInput: string): UserKeys | null => {
  try {
    const { type, data } = nip19.decode(nsecInput);
    if (type === 'nsec') {
      const sk = data as Uint8Array;
      const pk = getPublicKey(sk);
      const nsec = nip19.nsecEncode(sk);
      const npub = nip19.npubEncode(pk);
      return { sk, pk, nsec, npub };
    }
    return null;
  } catch (e) {
    console.error("Invalid nsec", e);
    return null;
  }
};

// Singleton Pool
let pool: SimplePool | null = null;

export const getPool = () => {
  if (!pool) {
    pool = new SimplePool();
  }
  return pool;
};

// Function to check relay health (latency and connection)
export const checkRelayHealth = async (url: string): Promise<RelayMetric> => {
  const start = Date.now();
  return new Promise((resolve) => {
    try {
      const socket = new WebSocket(url);
      let isResolved = false;

      const finish = (status: 'connected' | 'error', errorMsg?: string) => {
        if (isResolved) return;
        isResolved = true;
        // Clean up
        try { socket.close(); } catch {} 
        resolve({
          url,
          latency: status === 'connected' ? Date.now() - start : -1,
          status,
          errorMsg
        });
      };

      socket.onopen = () => finish('connected');
      socket.onerror = () => finish('error', 'Connection failed');
      
      // Timeout after 5 seconds
      setTimeout(() => finish('error', 'Timeout'), 5000);
    } catch (e) {
      resolve({
        url,
        latency: -1,
        status: 'error',
        errorMsg: 'Invalid URL or Network Error'
      });
    }
  });
};

// Polyfill for Promise.any behavior
const waitForAny = (promises: Promise<any>[]) => {
  if (promises.length === 0) return Promise.reject(new Error("No promises provided"));
  return new Promise((resolve, reject) => {
    let rejectedCount = 0;
    let resolved = false;
    const errors: any[] = [];

    promises.forEach(p => {
      p.then(val => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      }).catch((err) => {
        rejectedCount++;
        errors.push(err);
        if (rejectedCount === promises.length && !resolved) {
          const errorMsg = errors.map(e => (e instanceof Error ? e.message : String(e))).join('; ');
          reject(new Error(`All promises rejected. Errors: ${errorMsg}`));
        }
      });
    });
  });
};

export const publishNote = async (
  keys: UserKeys, 
  relays: string[], 
  content: string
): Promise<void> => {
  const _pool = getPool();
  const eventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: content,
  };

  if (!(keys.sk instanceof Uint8Array)) {
     console.error("Secret key is not Uint8Array. Login data might be corrupted.");
     throw new Error("Invalid Secret Key Type");
  }

  const signedEvent = finalizeEvent(eventTemplate, keys.sk);
  
  // Attempt to publish to all relays, succeed if at least one accepts
  try {
    await waitForAny(_pool.publish(relays, signedEvent));
  } catch (e) {
    console.error("Failed to publish to any relay", e);
    throw e; // Re-throw to let UI handle it
  }
};

export const publishEncryptedDM = async (
  keys: UserKeys,
  relays: string[],
  recipientHex: string,
  content: string
): Promise<void> => {
  const _pool = getPool();
  
  if (!(keys.sk instanceof Uint8Array)) {
     throw new Error("Invalid Secret Key Type");
  }

  const ciphertext = await nip04.encrypt(keys.sk, recipientHex, content);

  const eventTemplate = {
    kind: 4,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', recipientHex]],
    content: ciphertext,
  };

  const signedEvent = finalizeEvent(eventTemplate, keys.sk);

  try {
    await waitForAny(_pool.publish(relays, signedEvent));
  } catch (e) {
    console.error("Failed to publish DM", e);
    throw e;
  }
};

export const decryptMessage = async (
  keys: UserKeys,
  pubkey: string, 
  content: string
): Promise<string> => {
  try {
    if (!(keys.sk instanceof Uint8Array)) return "*** Key Error ***";
    return await nip04.decrypt(keys.sk, pubkey, content);
  } catch (e) {
    return "Encrypted Message";
  }
};

export const fetchProfiles = async (
  relays: string[],
  pubkeys: string[]
): Promise<Record<string, UserProfile>> => {
  if (pubkeys.length === 0) return {};
  const _pool = getPool();
  
  const profiles: Record<string, UserProfile> = {};
  
  try {
      console.log(`[NostrService] Fetching profiles for ${pubkeys.length} pubkeys via ${relays.length} relays...`);
      
      const events = await new Promise<any[]>((resolve) => {
        const fetchedEvents: any[] = [];
        const filters: Filter[] = [{
          kinds: [0],
          authors: pubkeys
        }];
        const sub = _pool.subscribeMany(relays, filters, {
          onevent: (event) => {
            fetchedEvents.push(event);
          },
          oneose: () => {
            sub.close();
            resolve(fetchedEvents);
          }
        });
        // Timeout just in case
        setTimeout(() => {
          sub.close();
          resolve(fetchedEvents);
        }, 3000);
      });

      console.log(`[NostrService] Received ${events.length} profile events.`);

      // NIP-01: Kind 0 is Replaceable. We must use the latest one.
      // Sort by created_at ascending so the last processed is the newest.
      events.sort((a, b) => a.created_at - b.created_at);

      events.forEach(event => {
        try {
          const content = JSON.parse(event.content);
          profiles[event.pubkey] = {
            pubkey: event.pubkey,
            name: content.name,
            displayName: content.display_name,
            picture: content.picture,
            about: content.about
          };
        } catch (e) {
          // ignore malformed
        }
      });
  } catch (e) {
      console.warn("Failed to fetch profiles", e);
  }

  return profiles;
};