import { useCallback, useEffect, useRef, useState } from "react";
import {
  hideNativeSplash,
  runCriticalPreloads,
  StartupPhase,
  StartupResult,
} from "./startupMachine";

export interface UseStartupReturn {
  phase: StartupPhase;
  preloadData: StartupResult | null;
  onSplashAnimationComplete: () => void;
  onContentReady: () => void;
}

export function useStartup(): UseStartupReturn {
  const [phase, setPhase]             = useState<StartupPhase>("booting");
  const [preloadData, setPreloadData] = useState<StartupResult | null>(null);

  const hasRun       = useRef(false);
  const contentReady = useRef(false);
  const animDone     = useRef(false);
  const preloadDone  = useRef(false); 

  const maybeTransition = useCallback(() => {
    if (animDone.current && contentReady.current && preloadDone.current) {
      setPhase("done");
    }
  }, []);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      setPhase("preloading");
      try {
        const result = await runCriticalPreloads();
        setPreloadData(result);
        if (__DEV__) console.log(`[Startup] preload took ${result.elapsed}ms`);
      } catch (e) {
        console.warn("[Startup] Preload failed:", e);
        setPreloadData({ session: null, fontsReady: false, elapsed: 0 });
      }

      preloadDone.current = true;
      setPhase("splash_animating");
      maybeTransition();

      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      try {
        await hideNativeSplash();
      } catch (error) {
        console.warn("[Startup] hideNativeSplash failed:", error);
      }
    })();
  }, [maybeTransition]);

  const onSplashAnimationComplete = useCallback(() => {
    animDone.current = true;
    maybeTransition();
  }, [maybeTransition]);

  const onContentReady = useCallback(() => {
    contentReady.current = true;
    maybeTransition();
  }, [maybeTransition]);

  return { phase, preloadData, onSplashAnimationComplete, onContentReady };
}