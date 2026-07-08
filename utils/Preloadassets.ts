import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';
import { Image } from 'react-native';
import { Asset } from 'expo-asset';
export interface PreloadResult {
  sessionData:  StoredSession | null;
  fontsLoaded:  boolean;
  elapsed:      number;
}

export interface StoredSession {
  accessToken:  string;
  refreshToken: string;
  userId:       string;
  expiresAt:    number;
}
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
const loadFonts = async (): Promise<boolean> => {
  const fonts = {
  };
  if (Object.keys(fonts).length === 0) return true;

  try {
    await Font.loadAsync(fonts);
    return true;
  } catch (e) {
    console.warn('[preload] Font load failed:', e);
    return false;
  }
};
const preloadImages = async (): Promise<void> => {
  const criticalImages = [
    require('../assets/images/splash-logo.png'),
    require('../assets/images/splash-logo.png'),
    require('../assets/images/first-image.png'),
    require('../assets/images/second-image.png'),
    require('../assets/images/third-image.png'),
     'https://res.cloudinary.com/yourcloud/image/upload/placeholder.png',
  ];

  try {
    const localAssets = criticalImages.filter(img => typeof img !== 'string');
    const remoteUrls  = criticalImages.filter(img => typeof img === 'string') as string[];
    await Promise.all([
      Asset.loadAsync(localAssets),
      ...remoteUrls.map(url => Image.prefetch(url)),
    ]);
  } catch (e) {
    console.warn('[preload] Image preload failed:', e);
  }
};
const loadCachedSession = async (): Promise<StoredSession | null> => {
  try {
    const raw = await AsyncStorage.getItem('supabase_session_cache');
    if (!raw) return null;
    const session: StoredSession = JSON.parse(raw);
    if (session.expiresAt && session.expiresAt < Date.now() / 1000) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
};
export const preloadCriticalAssets = async (): Promise<PreloadResult> => {
  const start = Date.now();
  const [fontsLoaded, sessionData, _] = await Promise.all([
    withTimeout(loadFonts(),           5000, false),
    withTimeout(loadCachedSession(),   3000, null),
    withTimeout(preloadImages(),       4000, undefined),
  ]);

  return {
    fontsLoaded,
    sessionData,
    elapsed: Date.now() - start,
  };
};
export const preloadDeferredAssets = async (userId: string): Promise<void> => {
  Promise.allSettled([
    preloadUserAvatars(userId),
    prefetchInitialChatData(userId),
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[preload] Deferred task ${i} failed:`, r.reason);
      }
    });
  });
};
const preloadUserAvatars = async (userId: string): Promise<void> => {
  try {
  } catch (e) {
    console.warn('[preload] Avatar preload failed:', e);
  }
};
const prefetchInitialChatData = async (userId: string): Promise<void> => {
  try {
  } catch (e) {
    console.warn('[preload] Chat prefetch failed:', e);
  }
};
