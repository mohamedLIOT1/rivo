import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory instant cache
let memoryConversations = null;
let memoryFriends = null;
const memoryMessages = new Map(); // userId -> message[]

const STORAGE_KEYS = {
  CONVERSATIONS: '@rivo_chat_cache_convs_v1',
  FRIENDS: '@rivo_chat_cache_friends_v1',
  MESSAGES_PREFIX: '@rivo_chat_cache_msgs_v1_',
};

// Debounce timer map for message persistence to avoid UI freeze
const writeDebounceTimers = new Map();

/**
 * Pre-hydrate cache from AsyncStorage into memory
 */
export async function initChatCache() {
  try {
    const [storedConvs, storedFriends] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS).catch(() => null),
      AsyncStorage.getItem(STORAGE_KEYS.FRIENDS).catch(() => null),
    ]);

    if (storedConvs && !memoryConversations) {
      memoryConversations = JSON.parse(storedConvs);
    }
    if (storedFriends && !memoryFriends) {
      memoryFriends = JSON.parse(storedFriends);
    }
  } catch {}
}

// Auto-run cache init in background
initChatCache();

/**
 * Synchronous read of in-memory conversations (0ms latency)
 */
export function getCachedConversations() {
  return memoryConversations || [];
}

/**
 * Async read with AsyncStorage fallback
 */
export async function loadCachedConversationsAsync() {
  if (memoryConversations && memoryConversations.length > 0) {
    return memoryConversations;
  }
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (stored) {
      const parsed = JSON.parse(stored);
      memoryConversations = parsed;
      return parsed;
    }
  } catch {}
  return [];
}

/**
 * Persist conversations to memory and AsyncStorage
 */
export function setCachedConversations(convs) {
  if (!Array.isArray(convs)) return;
  memoryConversations = convs;

  // Debounced write
  if (writeDebounceTimers.has('conversations')) {
    clearTimeout(writeDebounceTimers.get('conversations'));
  }
  const timer = setTimeout(() => {
    AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(convs.slice(0, 50))).catch(() => {});
    writeDebounceTimers.delete('conversations');
  }, 1500);
  writeDebounceTimers.set('conversations', timer);
}

/**
 * Synchronous read of in-memory friends
 */
export function getCachedFriends() {
  return memoryFriends || [];
}

/**
 * Async read with AsyncStorage fallback for friends
 */
export async function loadCachedFriendsAsync() {
  if (memoryFriends && memoryFriends.length > 0) {
    return memoryFriends;
  }
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.FRIENDS);
    if (stored) {
      const parsed = JSON.parse(stored);
      memoryFriends = parsed;
      return parsed;
    }
  } catch {}
  return [];
}

/**
 * Persist friends to memory and AsyncStorage
 */
export function setCachedFriends(friends) {
  if (!Array.isArray(friends)) return;
  memoryFriends = friends;

  if (writeDebounceTimers.has('friends')) {
    clearTimeout(writeDebounceTimers.get('friends'));
  }
  const timer = setTimeout(() => {
    AsyncStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify(friends.slice(0, 100))).catch(() => {});
    writeDebounceTimers.delete('friends');
  }, 1500);
  writeDebounceTimers.set('friends', timer);
}

/**
 * Synchronous read of in-memory messages for target user (0ms latency)
 */
export function getCachedMessages(userId) {
  if (!userId) return [];
  const key = String(userId);
  return memoryMessages.get(key) || [];
}

/**
 * Async read messages with AsyncStorage fallback
 */
export async function loadCachedMessagesAsync(userId) {
  if (!userId) return [];
  const key = String(userId);
  if (memoryMessages.has(key)) {
    return memoryMessages.get(key);
  }
  try {
    const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${key}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      memoryMessages.set(key, parsed);
      return parsed;
    }
  } catch {}
  return [];
}

/**
 * Persist messages for a user thread
 */
export function setCachedMessages(userId, messages) {
  if (!userId || !Array.isArray(messages)) return;
  const key = String(userId);
  // Keep last 100 messages for quick instant hydration
  const sliced = messages.slice(-100);
  memoryMessages.set(key, sliced);

  const timerKey = `messages_${key}`;
  if (writeDebounceTimers.has(timerKey)) {
    clearTimeout(writeDebounceTimers.get(timerKey));
  }
  const timer = setTimeout(() => {
    AsyncStorage.setItem(`${STORAGE_KEYS.MESSAGES_PREFIX}${key}`, JSON.stringify(sliced)).catch(() => {});
    writeDebounceTimers.delete(timerKey);
  }, 1500);
  writeDebounceTimers.set(timerKey, timer);
}

/**
 * Append or replace temporary message in cache
 */
export function appendCachedMessage(userId, msg) {
  if (!userId || !msg) return;
  const key = String(userId);
  const current = memoryMessages.get(key) || [];
  
  const exists = current.some((m) => String(m._id || m.id) === String(msg._id || msg.id));
  if (exists) return;

  const tempIdx = current.findIndex(
    (m) =>
      m._id &&
      String(m._id).startsWith('temp-') &&
      String(m.sender) === String(msg.sender) &&
      String(m.recipient) === String(msg.recipient) &&
      (m.text === msg.text || (m.jamInvite?.roomCode && m.jamInvite.roomCode === msg.jamInvite?.roomCode))
  );

  let updated;
  if (tempIdx !== -1) {
    updated = [...current];
    updated[tempIdx] = msg;
  } else {
    updated = [...current, msg];
  }

  setCachedMessages(key, updated);
}
