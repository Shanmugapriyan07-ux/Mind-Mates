import { supabase } from '@/lib/supabase';
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
export async function runCriticalPreloads(): Promise<StartupResult> {
  const start = Date.now();
  const { data: { session } } = await supabase.auth.getSession();
  return {
    session,
    fontsReady: true,
    elapsed: Date.now() - start,
  };
}
export async function hideNativeSplash(): Promise<void> {
  await SplashScreen.hideAsync();
}