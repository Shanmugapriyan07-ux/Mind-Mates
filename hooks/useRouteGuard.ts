import { useEffect, useRef } from 'react';
import { InteractionManager, Platform } from 'react-native';
import { useRouter, useSegments }       from 'expo-router';
import { useAuthStore, selPhase, selNavIntent } from '@/stores/authStore';

export function useRouteGuard(): void {
  const phase     = useAuthStore(selPhase);
  const navIntent = useAuthStore(selNavIntent);
  const router    = useRouter();
  const segments  = useSegments();

  const navLock    = useRef(false);       // Prevents double navigation
  const lastKey    = useRef('');          // Deduplication key
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    // ── Lock during transitional phases ───────────────────────────────────────
    // During logging_out/deleting: overlay is showing, DO NOT navigate yet.
    // finalizeSignOut() will unlock by setting phase='unauthenticated'.
    if (phase === 'booting' || phase === 'logging_out' || phase === 'deleting') {
      console.log('[RouteGuard] 🔒 Locked — phase:', phase);
      return;
    }

    // ── Prevent double navigation ─────────────────────────────────────────────
    if (navLock.current) {
      console.log('[RouteGuard] 🔒 Nav lock active — skipping');
      return;
    }

    const seg     = segments[0] as string | undefined;
    const inAuth  = seg === '(auth)';
    const inTabs  = seg === '(tabs)';
    const inSetup = seg === '(profileSetUp)';
    const inSubs  = seg === 'subScreens';

    let target: string | null = null;

    // ── Determine target — navIntent takes ABSOLUTE priority ─────────────────
    if (phase === 'unauthenticated') {
      if (navIntent === 'to_onboarding') {
        // Delete account → onboarding only, NEVER login screen
        target = '/(auth)/onBoarding';
      } else {
        // Logout or session expiry → login screen
        if (!inAuth) target = '/(auth)/Google';
      }
    } else if (phase === 'profile_incomplete') {
      if (!inSetup) target = '/(profileSetUp)/BasicInfo';
    } else if (phase === 'authenticated') {
      if (!inTabs && !inSubs) target = '/(tabs)/home';
    }

    if (!target) return;

    // ── Deduplication ─────────────────────────────────────────────────────────
    const key = `${phase}|${navIntent}|${target}`;
    if (key === lastKey.current) {
      console.log('[RouteGuard] Duplicate skipped:', key);
      return;
    }
    lastKey.current = key;

    console.log('[RouteGuard] 🧭 Navigate:', { phase, navIntent, target, from: seg });

    // ── Lock navigation for 1 second ─────────────────────────────────────────
    navLock.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      navLock.current = false;
    }, 1000);

    // ── Execute navigation ────────────────────────────────────────────────────
    // router.replace() in Expo Router replaces the ENTIRE navigation state.
    // This destroys the old authenticated stack completely.
    // Back button has nothing to go back to after this. ✅
    const navigate = () => router.replace(target as any);

    if (Platform.OS === 'web') {
      navigate();
    } else {
      InteractionManager.runAfterInteractions(navigate);
    }

  }, [phase, navIntent, segments]);
}