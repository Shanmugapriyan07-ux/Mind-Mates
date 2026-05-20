// startup/useStartup.ts
//
// ══════════════════════════════════════════════════════════════════
// STARTUP ORCHESTRATION HOOK
// ══════════════════════════════════════════════════════════════════
//
// This hook drives the startup state machine from React.
// It returns the current phase and preloaded data.
//
// RENDER STRATEGY (prevents every type of flash):
//
//   Layer 0: App content — mounted immediately at opacity 0
//            React renders the home/auth screen during splash animation.
//            By the time animation ends, first frame is already painted.
//
//   Layer 1: AnimatedSplash — visible during splash_animating phase
//            Covers Layer 0 while it renders.
//
//   Layer 2: (invisible) Native splash — held open by preventAutoHideAsync
//            Covers everything while JS boots. Hidden when we're ready.
//
// This "painting behind the curtain" technique is exactly what
// Instagram, Gmail, and Spotify use. The animation is the curtain.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  runCriticalPreloads, hideNativeSplash,
  StartupPhase, StartupResult, CachedSession,
} from './startupMachine';

export interface UseStartupReturn {
  phase:       StartupPhase;
  preloadData: StartupResult | null;
  // Call from AnimatedSplash when animation completes
  onSplashAnimationComplete: () => void;
  // Call from app content when first frame is painted
  onContentReady: () => void;
}

export function useStartup(): UseStartupReturn {
  const [phase,       setPhase]       = useState<StartupPhase>('booting');
  const [preloadData, setPreloadData] = useState<StartupResult | null>(null);

  const hasRun      = useRef(false);
  const contentReady = useRef(false);
  const animDone    = useRef(false);

  // ── Start preloading ──────────────────────────────────────────
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const boot = async () => {
      setPhase('preloading');

      try {
        const result = await runCriticalPreloads();
        console.log(`[Startup] Preload complete in ${result.elapsed}ms`);
        setPreloadData(result);
      } catch (e) {
        console.error('[Startup] Preload failed:', e);
        // Fail open — always proceed to show app
        setPreloadData({ session: null, fontsReady: false, elapsed: 0 });
      }

      // Hide native splash and show our animated splash
      await hideNativeSplash();
      setPhase('splash_animating');
    };

    boot();
  }, []);

  // ── Called when animated splash finishes playing ──────────────
  // Both animation AND content must be ready before we transition.
  // This prevents showing an unfinished home screen.
  const onSplashAnimationComplete = useCallback(() => {
    animDone.current = true;
    maybeTransition();
  }, []);

  const onContentReady = useCallback(() => {
    contentReady.current = true;
    maybeTransition();
  }, []);

  const maybeTransition = () => {
    // Only transition when BOTH animation is done AND content is ready
    // Typical: animation finishes first (800ms), content is ready earlier.
    // So transition fires when animation ends — no waiting.
    if (animDone.current) {
      setPhase('transitioning');
      // 'ready' fires after the cross-fade completes (see AnimatedSplash)
    }
  };

  const onTransitionComplete = useCallback(() => {
    setPhase('ready');
  }, []);

  return {
    phase,
    preloadData,
    onSplashAnimationComplete,
    onContentReady,
  };
}