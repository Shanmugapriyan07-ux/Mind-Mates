// hooks/useAppReady.ts
//
// ══════════════════════════════════════════════════════════════════
// APP READY ORCHESTRATION HOOK
// ══════════════════════════════════════════════════════════════════
//
// This is the single source of truth for app startup sequencing.
// It coordinates three things in order:
//
//   1. preventAutoHideAsync() — called at module level (before React mounts)
//      to hold the native splash screen open.
//
//   2. preloadCriticalAssets() — runs in parallel while splash is visible.
//      Fonts, images, cached session — all loaded simultaneously.
//
//   3. hideAsync() — called only when BOTH preload is done AND the
//      animated splash has signaled it's ready to dismiss.
//      This prevents the "white flash" between native splash and JS UI.
//
// ANTI-FLICKER STRATEGY:
//   The native splash screen stays up until we call hideAsync().
//   Our AnimatedSplash component mounts simultaneously (invisible behind native splash).
//   When native splash hides, our AnimatedSplash is already rendered and plays.
//   When our animation finishes, it calls onReady() → app content fades in.
//   Result: native splash → animated splash → app content, zero gap between any step.
//
// STATE MACHINE:
//   'loading'   → preloading assets, native splash visible
//   'animating' → assets ready, AnimatedSplash playing
//   'ready'     → animation done, show app content

import { useEffect, useCallback, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { preloadCriticalAssets, PreloadResult } from '@/utils/Preloadassets';

// ── Prevent native splash from auto-hiding ────────────────────────
// MUST be called at module level (outside any component), before React
// renders anything. This is the EAS/Expo-recommended approach.
// If called inside useEffect, there's a race condition — the native
// splash may already be hiding before the effect runs.
SplashScreen.preventAutoHideAsync().catch(() => {
  // If this fails (e.g. splash already hidden by OS), it's non-fatal
  console.warn('[SplashScreen] preventAutoHideAsync failed — already hidden?');
});

// ── Hook return type ──────────────────────────────────────────────
export type AppReadyPhase = 'loading' | 'animating' | 'ready';

export interface UseAppReadyReturn {
  phase:       AppReadyPhase;
  preloadData: PreloadResult | null;
  onAnimationComplete: () => void;  // call from AnimatedSplash when done
}

// ── Hook ──────────────────────────────────────────────────────────
export function useAppReady(): UseAppReadyReturn {
  const [phase,       setPhase]       = useState<AppReadyPhase>('loading');
  const [preloadData, setPreloadData] = useState<PreloadResult | null>(null);

  // Ref guards prevent double-execution in React Strict Mode
  const hasStarted  = useRef(false);
  const splashHidden = useRef(false);

  // ── Step 1: Run preload ───────────────────────────────────────
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const run = async () => {
      try {
        const result = await preloadCriticalAssets();
        console.log(`[AppReady] Preload complete in ${result.elapsed}ms`);
        setPreloadData(result);

        // Transition: loading → animating
        // At this point, assets are ready. We hide the NATIVE splash
        // and let our JS AnimatedSplash take over seamlessly.
        await hideSplashSafely();
        setPhase('animating');
      } catch (e) {
        console.error('[AppReady] Critical preload failed:', e);
        // Even on failure, we must show the app (fail-open)
        await hideSplashSafely();
        setPhase('ready');
      }
    };

    run();
  }, []);

  // ── Step 2: Animation complete callback ───────────────────────
  // AnimatedSplash calls this when its scale/fade animation finishes.
  // We then transition to 'ready' — the app content fades in.
  const onAnimationComplete = useCallback(() => {
    setPhase('ready');
  }, []);

  return { phase, preloadData, onAnimationComplete };
}

// ── Safe splash hide — idempotent ─────────────────────────────────
// expo-splash-screen throws if you call hideAsync() twice.
// This wrapper makes it safe to call multiple times.
let splashHidePromise: Promise<void> | null = null;

const hideSplashSafely = (): Promise<void> => {
  if (splashHidePromise) return splashHidePromise;
  splashHidePromise = SplashScreen.hideAsync().catch((e: any) => {
    console.warn('[SplashScreen] hideAsync failed:', e);
  });
  return splashHidePromise;
};