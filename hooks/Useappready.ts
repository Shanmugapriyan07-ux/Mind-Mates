import { useEffect, useCallback, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { preloadCriticalAssets, PreloadResult } from '@/utils/Preloadassets';
SplashScreen.preventAutoHideAsync().catch(() => {
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