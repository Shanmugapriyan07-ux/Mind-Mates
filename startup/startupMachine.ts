// startupMachine.ts
// lib/startupMachine.ts
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';

export type StartupPhase =
  | 'booting'
  | 'preloading'
  | 'splash_animating'
  | 'transitioning'
  | 'done';

export interface StartupResult {
  session: any | null;
  fontsReady: boolean;
  elapsed: number;
}

// ── Call this FIRST in your app entry, before anything renders ──
// Prevents the native splash from auto-hiding
SplashScreen.preventAutoHideAsync();

export async function runCriticalPreloads(): Promise<StartupResult> {
  const start = Date.now();

  const [session, fontsReady] = await Promise.allSettled([
    fetchSession(),         // your auth session fetch          // font loading
    minimumSplashTime(),    // enforce minimum 800ms so splash doesn't flash
  ]);

  return {
    session: session.status === 'fulfilled' ? session.value : null,
    fontsReady: fontsReady.status === 'fulfilled',
    elapsed: Date.now() - start,
  };
}

export async function hideNativeSplash(): Promise<void> {
  // This is the handoff moment — native splash hides, JS splash takes over
  await SplashScreen.hideAsync();
}

// ── Helpers ──────────────────────────────────────────────────────



async function fetchSession() {
  // Replace with your actual auth check (AsyncStorage, SecureStore, etc.)
  return null;
}

// Guarantees splash shows for at least 800ms — prevents ugly flash
async function minimumSplashTime(ms = 800): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}