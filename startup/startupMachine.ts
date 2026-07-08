import * as SplashScreen from 'expo-splash-screen';

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
SplashScreen.preventAutoHideAsync();

export async function runCriticalPreloads(): Promise<StartupResult> {
  const start = Date.now();

  const [session, fontsReady] = await Promise.allSettled([
    fetchSession(),      
    minimumSplashTime(),   
  ]);
  return {
    session: session.status === 'fulfilled' ? session.value : null,
    fontsReady: fontsReady.status === 'fulfilled',
    elapsed: Date.now() - start,
  };
}
export async function hideNativeSplash(): Promise<void> {
  await SplashScreen.hideAsync();
}
async function fetchSession() {
  return null;
}
async function minimumSplashTime(ms = 800): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}