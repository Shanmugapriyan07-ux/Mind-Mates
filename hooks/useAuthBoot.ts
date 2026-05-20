// hooks/useAuthBoot.ts
// Single auth listener. Called ONCE in _layout.tsx.
// Replaces ALL of: AuthContext listener + premiumAuthService listener + authService listener
//
// WHY MULTIPLE LISTENERS CAUSE FLICKER:
//   AuthContext.onAuthStateChange → updates state A → navigate
//   authService.onAuthStateChange → updates state B → navigate
//   Both fire within 10ms of each other = 2 navigations = flicker
//
// FIX: ONE listener here. Everything else is disabled/removed.

import { useEffect, useRef }    from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase }             from '@/lib/supabase';
import { useAuthStore }         from '@/stores/authStore';
import { restoreSession }       from '@/services/authServices';
import type { AuthUser }        from '@/stores/authStore';

function mapUser(raw: any, isProfileComplete: boolean): AuthUser {
  return {
    id:                 raw.id,
    email:              raw.email ?? null,
    name:               raw.user_metadata?.full_name ?? raw.user_metadata?.name ?? null,
    avatar:             raw.user_metadata?.avatar_url ?? null,
    is_profileComplete: isProfileComplete,
  };
}

export function useAuthBoot(): void {
  const booted   = useRef(false);

  useEffect(() => {
    if (booted.current) return; // Strict mode / double-mount guard
    booted.current = true;

    // ── 1. Restore session on launch ──────────────────────────────────────────
    restoreSession();

    // ── 2. ONE Supabase listener — the ONLY auth state listener in the app ────
    // All other auth listeners must be REMOVED from AuthContext, premiumAuthService, etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const store = useAuthStore.getState();

        console.log('[AuthBoot] Supabase event:', event, {
          phase:     store.phase,
          hasSession: !!session,
        });

        // ── CRITICAL: Ignore events during transitional phases ────────────────
        // During logging_out/deleting: we're handling signOut explicitly.
        // Supabase will fire SIGNED_OUT — we do NOT want it to trigger navigation.
        // Our finalizeSignOut() handles that after cleanup is complete.
        if (store.phase === 'logging_out' || store.phase === 'deleting') {
          console.log('[AuthBoot] Ignoring event during transitional phase');
          return;
        }

        switch (event) {
          case 'SIGNED_OUT':
            // Only handle if we didn't initiate it (e.g., token expired remotely)
            if (store.phase === 'authenticated' || store.phase === 'profile_incomplete') {
              console.log('[AuthBoot] External sign-out detected');
              store.finalizeSignOut();
            }
            break;

          case 'TOKEN_REFRESHED':
            console.log('[AuthBoot] Token refreshed silently ✅');
            // Update token in store
            if (session?.access_token) {
              // No navigation — just update the token
              useAuthStore.setState({ token: session.access_token });
            }
            break;
        }
      }
    );

    // ── 3. App foreground — verify session hasn't expired ────────────────────
    let prevAppState: AppStateStatus = AppState.currentState;

    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && prevAppState !== 'active') {
        const store = useAuthStore.getState();

        if (store.phase === 'authenticated' || store.phase === 'profile_incomplete') {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
              console.log('[AuthBoot] Session expired in background');
              store.finalizeSignOut();
            }
          });
        }
      }
      prevAppState = next;
    });

    return () => {
      subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);
}