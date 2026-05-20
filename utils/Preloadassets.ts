import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { Image } from 'react-native';

// ── Type definitions ──────────────────────────────────────────────
export interface PreloadResult {
  sessionData:  StoredSession | null;
  fontsLoaded:  boolean;
  elapsed:      number;
}

export interface StoredSession {
  accessToken:  string;
  refreshToken: string;
  userId:       string;
  expiresAt:    number;
}

// ── Timeout wrapper — prevents any asset from hanging forever ─────
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);

// ── Font loader ───────────────────────────────────────────────────
// Loads custom fonts in parallel. Falls back silently on failure
// (system fonts are used instead — ugly but not a crash).
const loadFonts = async (): Promise<boolean> => {
  const fonts = {
    // 'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
  };
  if (Object.keys(fonts).length === 0) return true;

  try {
    await Font.loadAsync(fonts);
    return true;
  } catch (e) {
    console.warn('[preload] Font load failed:', e);
    return false;
  }
};

// ── Static image preloader ────────────────────────────────────────
// expo-asset downloads and caches images in the native layer.
// After this, Image components render from cache — zero network delay.
const preloadImages = async (): Promise<void> => {
  const criticalImages = [
    // Local assets (require) — most important, shown during splash
    require('../assets/images/splash-logo.png'),
    require('../assets/images/splash-logo.png'),
    // Remote images (strings) — user profile placeholder, etc.
     'https://res.cloudinary.com/yourcloud/image/upload/placeholder.png',
  ];

  try {
    // expo-asset handles local requires
    const localAssets = criticalImages.filter(img => typeof img !== 'string');
    const remoteUrls  = criticalImages.filter(img => typeof img === 'string') as string[];

    await Promise.all([
      Asset.loadAsync(localAssets),
      ...remoteUrls.map(url => Image.prefetch(url)),
    ]);
  } catch (e) {
    console.warn('[preload] Image preload failed:', e);
    // Non-fatal — app still works with network images
  }
};

// ── Session loader ────────────────────────────────────────────────
// Read cached session from AsyncStorage. This is SYNCHRONOUS-feeling
// because AsyncStorage returns in ~5ms on device (it's SQLite, not network).
// We use this to decide: show Login screen or Home screen immediately,
// with zero network round-trip.
const loadCachedSession = async (): Promise<StoredSession | null> => {
  try {
    const raw = await AsyncStorage.getItem('supabase_session_cache');
    if (!raw) return null;

    const session: StoredSession = JSON.parse(raw);

    // Check if cached session is expired
    // If expired, return null — auth context will handle refresh
    if (session.expiresAt && session.expiresAt < Date.now() / 1000) {
      console.log('[preload] Cached session expired, will refresh');
      return null;
    }

    return session;
  } catch {
    return null;
  }
};

// ══════════════════════════════════════════════════════════════════
// PHASE 1: Critical preload (runs during splash, blocks hide)
// ══════════════════════════════════════════════════════════════════
export const preloadCriticalAssets = async (): Promise<PreloadResult> => {
  const start = Date.now();

  // Ensure all three promises are destructured correctly
  // preloadImages is critical for a smooth splash transition
  const [fontsLoaded, sessionData, _] = await Promise.all([
    withTimeout(loadFonts(),           5000, false),
    withTimeout(loadCachedSession(),   3000, null),
    withTimeout(preloadImages(),       4000, undefined),
  ]);

  return {
    fontsLoaded,
    sessionData,
    elapsed: Date.now() - start,
  };
};

// ══════════════════════════════════════════════════════════════════
// PHASE 2: Deferred preload (runs AFTER app is visible)
// ══════════════════════════════════════════════════════════════════
// Call this from your home screen useEffect AFTER the app has mounted.
// The user sees skeleton UI while this runs — completely invisible.
export const preloadDeferredAssets = async (userId: string): Promise<void> => {
  // Run in background — don't await at call site
  Promise.allSettled([
    preloadUserAvatars(userId),
    prefetchInitialChatData(userId),
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[preload] Deferred task ${i} failed:`, r.reason);
      }
    });
  });
};

// Preload recent contact avatars so they appear instantly in chat list
const preloadUserAvatars = async (userId: string): Promise<void> => {
  try {
    // Example: fetch recent contacts and prefetch their avatars
    // const contacts = await supabase.from('connections')...
    // await Promise.all(contacts.map(c => Image.prefetch(c.avatar_url)));
    console.log('[preload] Avatar preload complete for', userId);
  } catch (e) {
    console.warn('[preload] Avatar preload failed:', e);
  }
};

// Warm up initial API data into cache
const prefetchInitialChatData = async (userId: string): Promise<void> => {
  try {
    // Supabase query results can be stored in your Zustand/Redux store here
    // const { data } = await supabase.from('chats')...
    console.log('[preload] Chat data prefetch complete for', userId);
  } catch (e) {
    console.warn('[preload] Chat prefetch failed:', e);
  }
};
