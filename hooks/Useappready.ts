import { useEffect, useCallback, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { preloadCriticalAssets, PreloadResult } from '@/utils/Preloadassets';
SplashScreen.preventAutoHideAsync().catch(() => {
  console.warn('[SplashScreen] preventAutoHideAsync failed — already hidden?');
});
export type AppReadyPhase = 'loading' | 'animating' | 'ready';
export interface UseAppReadyReturn {
  phase:       AppReadyPhase;
  preloadData: PreloadResult | null;
  onAnimationComplete: () => void; 
}
export function useAppReady(): UseAppReadyReturn {
  const [phase,       setPhase]       = useState<AppReadyPhase>('loading');
  const [preloadData, setPreloadData] = useState<PreloadResult | null>(null);
  const hasStarted  = useRef(false);
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    const run = async () => {
      try {
        const result = await preloadCriticalAssets();
        setPreloadData(result);
        await hideSplashSafely();
        setPhase('animating');
      } catch (e) {
        await hideSplashSafely();
        setPhase('ready');
      }
    };

    run();
  }, []);
  const onAnimationComplete = useCallback(() => {
    setPhase('ready');
  }, []);
  return { phase, preloadData, onAnimationComplete };
}
let splashHidePromise: Promise<void> | null = null;
const hideSplashSafely = (): Promise<void> => {
  if (splashHidePromise) return splashHidePromise;
  splashHidePromise = SplashScreen.hideAsync().catch((e: any) => {
    console.warn('[SplashScreen] hideAsync failed:', e);
  });
  return splashHidePromise;
};