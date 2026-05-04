import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_PREFIX = 'parent' + 'ai_';
const CURRENT_PREFIX = 'talkwise_';

const migratedKeys = new Set<string>();

export const STORAGE_KEYS = {
  history: `${CURRENT_PREFIX}history`,
  speechLanguage: `${CURRENT_PREFIX}speech_language`,
  languageChosen: `${CURRENT_PREFIX}lang_user_chosen`,
  micId: `${CURRENT_PREFIX}mic_id`,
  autoMonitor: `${CURRENT_PREFIX}auto_monitor`,
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

function legacyKeyFor(key: StorageKey): string {
  return `${LEGACY_PREFIX}${key.slice(CURRENT_PREFIX.length)}`;
}

export async function migrateStorageKey(key: StorageKey): Promise<void> {
  if (migratedKeys.has(key)) return;

  const existing = await AsyncStorage.getItem(key);
  const legacyKey = legacyKeyFor(key);
  const legacyValue = await AsyncStorage.getItem(legacyKey);

  if (existing === null && legacyValue !== null) {
    await AsyncStorage.setItem(key, legacyValue);
  }

  if (legacyValue !== null) {
    await AsyncStorage.removeItem(legacyKey);
  }

  migratedKeys.add(key);
}

export async function getStorageItem(key: StorageKey): Promise<string | null> {
  await migrateStorageKey(key);
  return AsyncStorage.getItem(key);
}

export async function setStorageItem(key: StorageKey, value: string): Promise<void> {
  await migrateStorageKey(key);
  await AsyncStorage.setItem(key, value);
}
