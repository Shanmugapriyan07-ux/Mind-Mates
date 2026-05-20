import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import * as Font         from 'expo-font';
import { Asset }         from 'expo-asset';
import { supabase }      from '@/lib/supabase';

// ── Prevent native splash auto-hide ───────────────────────────────
// MUST be called at module level — before any React renders.
// If called inside useEffect, there's a race condition.
try { SplashScreen.preventAutoHideAsync(); } catch {}

// ── Types ─────────────────────────────────────────────────────────
export type StartupPhase =
  | 'booting'
  | 'preloading'
  | 'splash_animating'
  | 'transitioning'
  | 'ready';

export interface StartupResult {
  session:    CachedSession | null;
  fontsReady: boolean;
  elapsed:    number;
}

export interface CachedSession {
  userId:       string;
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number;
  email:        string | null;
}

const SESSION_KEY = 'mm_session_v2';

// ── Timeout wrapper ───────────────────────────────────────────────
// Prevents any single asset from blocking the entire startup
const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>(res => setTimeout(() => res(fallback), ms))]);

// ══════════════════════════════════════════════════════════════════
// PHASE 1: CRITICAL PRELOADS (run during native splash)
// ══════════════════════════════════════════════════════════════════
//
// All of these run IN PARALLEL via Promise.all.
// Total time = slowest single task (not sum of all).
// Typical: fonts ~200ms, session ~5ms (AsyncStorage), images ~100ms
// Effective total: ~200ms
export async function runCriticalPreloads(): Promise<StartupResult> {
  const t0 = Date.now();

  const [fontsReady, session] = await Promise.all([
    // Fonts — UI depends on these, must load before first render
    withTimeout(loadFonts(), 5000, false),

    // Session — determines auth screen vs home screen routing
    withTimeout(loadCachedSession(), 2000, null),

    // Critical images — logo shown during splash must be pre-cached
    withTimeout(preloadCriticalImages(), 4000, undefined),
  ]);

  return { session, fontsReady, elapsed: Date.now() - t0 };
}

// ── Font loader ───────────────────────────────────────────────────
async function loadFonts(): Promise<boolean> {
  try {
    await Font.loadAsync({
      // Add your custom fonts here:
      // 'Inter-Regular':  require('../assets/fonts/Inter-Regular.ttf'),
      // 'Inter-Bold':     require('../assets/fonts/Inter-Bold.ttf'),
      // 'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    });
    return true;
  } catch (e) {
    console.warn('[Startup] Font load failed:', e);
    return false; // non-fatal — system fonts used as fallback
  }
}

// ── Session loader ────────────────────────────────────────────────
// Reads from AsyncStorage — ~5ms, effectively synchronous.
// Used to decide routing BEFORE any network call.
// Background validation happens after app is visible (invisible to user).
async function loadCachedSession(): Promise<CachedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s: CachedSession = JSON.parse(raw);
    if (s.expiresAt && s.expiresAt < Date.now() / 1000 - 300) {
      // Expired by more than 5 minutes — don't trust it
      // Supabase will handle refresh in background
      console.log('[Startup] Session expired, will refresh');
    }
    return s;
  } catch {
    return null;
  }
}

// ── Save session to cache (call from AuthContext) ─────────────────
export async function cacheSession(session: CachedSession): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

export async function clearSessionCache(): Promise<void> {
  try { await AsyncStorage.removeItem(SESSION_KEY); } catch {}
}

// ── Image preloader ───────────────────────────────────────────────
async function preloadCriticalImages(): Promise<void> {
  try {
    const local = [
      require('../assets/images/logo.png'),
      require('../assets/images/icon.png'),
    ];
    await Asset.loadAsync(local);
  } catch (e) {
    console.warn('[Startup] Image preload failed:', e);
  }
}

// ══════════════════════════════════════════════════════════════════
// PHASE 2: DEFERRED PRELOADS (run after app is visible)
// ══════════════════════════════════════════════════════════════════
//
// These are NOT critical for first render. They load while the user
// sees skeleton UI — completely invisible delay.
// Call this from the home screen's first useEffect.
export async function runDeferredPreloads(userId: string): Promise<void> {
  // Fire and forget — don't await at call site
  Promise.allSettled([
    validateAndRefreshSession(),
    preloadUserAvatars(userId),
    preloadInitialFeed(userId),
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected')
        console.warn(`[Startup] Deferred task ${i} failed:`, r.reason?.message);
    });
  });
}

async function validateAndRefreshSession(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await cacheSession({
        userId:       data.session.user.id,
        accessToken:  data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt:    data.session.expires_at ?? 0,
        email:        data.session.user.email ?? null,
      });
    }
  } catch {}
}

async function preloadUserAvatars(userId: string): Promise<void> {
  // Fetch and cache recent contact avatars
  // Implementation depends on your data shape
}

async function preloadInitialFeed(userId: string): Promise<void> {
  // Warm up your chat list / match list query
  // Store result in your Zustand store or React Query cache
}

// ── Hide native splash safely ─────────────────────────────────────
let _hideSplashCalled = false;
export async function hideNativeSplash(): Promise<void> {
  if (_hideSplashCalled) return;
  _hideSplashCalled = true;
  try { await SplashScreen.hideAsync(); } catch {}
}