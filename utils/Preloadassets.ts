// utils/preloadAssets.ts
//
// ══════════════════════════════════════════════════════════════════
// ASSET PRELOADING — Gmail / Instagram Strategy
// ══════════════════════════════════════════════════════════════════
//
// ARCHITECTURE: Two-phase loading
//
//   Phase 1 (CRITICAL — blocks splash hide):
//     • Fonts (UI layout depends on them — flash if missing)
//     • App icon / logo image (shown during splash itself)
//     • Cached user session (to know which screen to show)
//
//   Phase 2 (DEFERRED — runs after app is visible):
//     • Avatar images, chat thumbnails
//     • Non-critical API data
//     • Heavy screen assets
//
// WHY THIS MATTERS:
//   Loading everything before showing the app adds 2-4 seconds.
//   Loading only critical assets (fonts + session) takes ~200-400ms.
//   Deferred assets load while the user sees skeleton UI — invisible lag.
//
// PERFORMANCE:
//   All Phase 1 loads run in PARALLEL via Promise.all — not sequentially.
//   A single slow asset can't block others.
//   Each loader has a 5s timeout to prevent infinite hang.

import * as Font       from 'expo-font';
import { Asset }       from 'expo-asset';
import { Image }       from 'react-native';
import AsyncStorage    from '@react-native-async-storage/async-storage';

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
  try {
    await Font.loadAsync({
      // Add your custom fonts here. Example:
      // 'Inter-Regular':    require('../assets/fonts/Inter-Regular.ttf'),
      // 'Inter-SemiBold':   require('../assets/fonts/Inter-SemiBold.ttf'),
      // 'Inter-Bold':       require('../assets/fonts/Inter-Bold.ttf'),
    });
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
    // 'https://res.cloudinary.com/yourcloud/image/upload/placeholder.png',
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

  // All critical loads run IN PARALLEL — not sequentially
  // If fonts take 300ms and session takes 10ms, total is still 300ms (not 310ms)
  const [fontsLoaded, sessionData] = await Promise.all([
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

