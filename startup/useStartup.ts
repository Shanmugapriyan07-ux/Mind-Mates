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
  const setPhaseRef = useRef(setPhase);
  useEffect(() => { setPhaseRef.current = setPhase; }, [setPhase]);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      setPhase("preloading");
      try {
        const result = await runCriticalPreloads();
        setPreloadData(result);
      } catch (e) {
        console.error("[Startup] Preload failed:", e);
        setPreloadData({ session: null, fontsReady: false, elapsed: 0 });
      }

      setPhase("splash_animating");
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      try {
        await hideNativeSplash();
      } catch (error) {
        console.warn("[Startup] hideNativeSplash failed:", error);
      }
    })();
  }, []);
  const maybeTransition = useCallback(() => {
    if (animDone.current && contentReady.current) {
      setPhaseRef.current("done");
    }
  }, []);

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