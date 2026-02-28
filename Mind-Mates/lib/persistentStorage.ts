// lib/persistentStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────
// SESSION KEYS — wiped on every logout
// ─────────────────────────────────────────────
const SESSION_KEYS = [
  'userToken',
  'sessionId',
  'isLoggedIn',
  'loginProvider',
  'activeUserId', // who is currently logged in
];

// ─────────────────────────────────────────────
// USER DATA KEYS — kept forever per user
// ─────────────────────────────────────────────
export const userKey = (userId: string) => ({
  profile:       `profile_${userId}`,
  theme:         `theme_${userId}`,
  settings:      `settings_${userId}`,
  photos:        `photos_${userId}`,
  notifications: `notifications_${userId}`,
  drafts:        `drafts_${userId}`,
  onboarding:    `onboarding_${userId}`,
});

// Clear ONLY session — keep user data
export const clearSession = async () => {
  await AsyncStorage.multiRemove(SESSION_KEYS);
};

// Save which user is active (for auto-login)
export const saveActiveUser = async (userId: string) => {
  await AsyncStorage.setItem('activeUserId', userId);
};

// Get last active user ID
export const getActiveUserId = async (): Promise<string | null> => {
  return AsyncStorage.getItem('activeUserId');
};

// Nuclear option — wipe EVERYTHING for a user (account delete only)
export const deleteAllUserData = async (userId: string) => {
  const keys = Object.values(userKey(userId));
  await AsyncStorage.multiRemove([...keys, ...SESSION_KEYS]);
};