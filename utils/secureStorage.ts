import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
const KEYS = {
  TOKEN:   'mm_token_v2',
  REFRESH: 'mm_refresh_v2',
  USER:    'mm_user_v2',
} as const;
async function save(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') { sessionStorage.setItem(key, value); return; }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (e) { console.warn('[SecureStorage] save failed:', e); }
}
async function load(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return sessionStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch { return null; }
}
async function remove(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') { sessionStorage.removeItem(key); return; }
    await SecureStore.deleteItemAsync(key);
  } catch {}
}
export const secureStorage = {
  saveToken:         (t: string)  => save(KEYS.TOKEN, t),
  loadToken:         ()           => load(KEYS.TOKEN),
  removeToken:       ()           => remove(KEYS.TOKEN),
  saveRefreshToken:  (t: string)  => save(KEYS.REFRESH, t),
  loadRefreshToken:  ()           => load(KEYS.REFRESH),
  saveUser: async (u: object)     => { try { await save(KEYS.USER, JSON.stringify(u)); } catch {} },
  loadUser: async <T>(): Promise<T | null> => {
    try { const r = await load(KEYS.USER); return r ? JSON.parse(r) : null; } catch { return null; }
  },
  clearAll: () => Promise.all([remove(KEYS.TOKEN), remove(KEYS.REFRESH), remove(KEYS.USER)]),
};