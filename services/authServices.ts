// services/authService.ts
// All auth actions live here. No navigation logic inside.
// Every action updates authStore → useRouteGuard handles navigation.
//
// DELETED: premiumAuthService.ts, AuthContext auth methods, duplicate listeners
// REPLACED BY: this single file

import { GoogleSignin }   from '@react-native-google-signin/google-signin';
import { supabase }       from '@/lib/supabase';
import { secureStorage }  from '@/utils/secureStorage';
import { useAuthStore }   from '@/stores/authStore';
import { isGoogleReady }  from '@/config/googleAuth';
import type { AuthUser }  from '@/stores/authStore';
import { InteractionManager } from 'react-native';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function mapUser(raw: any, isProfileComplete: boolean): AuthUser {
  return {
    id:                 raw.id,
    email:              raw.email ?? null,
    name:               raw.user_metadata?.full_name ?? raw.user_metadata?.name ?? null,
    avatar:             raw.user_metadata?.avatar_url ?? null,
    is_profileComplete: isProfileComplete,
  };
}

export async function checkProfileComplete(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('users')
      .select('is_profile_complete')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.is_profile_complete === true;
  } catch { return false; }
}

// ══════════════════════════════════════════════════════════════════════════════
// SESSION RESTORE — called on app launch
// ══════════════════════════════════════════════════════════════════════════════

export async function restoreSession(): Promise<void> {
  const store = useAuthStore.getState();
  console.log('[AuthService] 🔄 Restoring session...');

  try {
    // Try Supabase AsyncStorage session (instant, no network)
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      console.log('[AuthService] Session found:', session.user.email);
      const isComplete = await checkProfileComplete(session.user.id);
      const user       = mapUser(session.user, isComplete);
      await secureStorage.saveToken(session.access_token);
      store.setSession(user, session.access_token);
      return;
    }

    // Try silent Google sign-in (no UI)
    if (isGoogleReady()) {
      try {
        const currentUser = await GoogleSignin.getCurrentUser();
        if (currentUser) {
          await GoogleSignin.signInSilently();
          const tokens = await GoogleSignin.getTokens();
          if (tokens?.idToken) {
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: 'google', token: tokens.idToken,
            });
            if (!error && data?.session) {
              const isComplete = await checkProfileComplete(data.user.id);
              const user       = mapUser(data.user, isComplete);
              await secureStorage.saveToken(data.session.access_token);
              store.setSession(user, data.session.access_token);
              console.log('[AuthService] ✅ Silent sign-in success');
              return;
            }
          }
        }
      } catch (e: any) {
        console.warn('[AuthService] Silent sign-in failed:', e?.code);
      }
    }

    store.setPhase('unauthenticated');
    console.log('[AuthService] No session → unauthenticated');

  } catch (e: any) {
    console.warn('[AuthService] Restore failed:', e?.message);
    store.setPhase('unauthenticated');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GOOGLE SIGN-IN
// ══════════════════════════════════════════════════════════════════════════════

export async function signInWithGoogle(): Promise<void> {
  const store = useAuthStore.getState();
  if (store.isSigningIn) return;

  store.setSigningIn(true);
  store.setError(null);

  try {
    // Defer native interaction until current transitions/animations are complete.
    // This ensures the Android Activity is attached and focused.
    await new Promise<void>(resolve => {
      InteractionManager.runAfterInteractions(() => resolve());
    });

    if (!isGoogleReady()) {
      store.setError('Google Sign-In unavailable. Use a dev client build.');
      store.setSigningIn(false);
      return;
    }

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    try { await GoogleSignin.signOut(); } catch {}

    // Show native account picker
    const signInResult = await GoogleSignin.signIn();

    // SDK v11+ — use getTokens() for reliable idToken
    const tokens  = await GoogleSignin.getTokens();
    const idToken = tokens?.idToken ?? (signInResult as any)?.data?.idToken;

    if (!idToken) {
      store.setError('Could not get authentication token. Please try again.');
      store.setSigningIn(false);
      return;
    }

    const { data, error: supabaseErr } = await supabase.auth.signInWithIdToken({
      provider:     'google',
      token:        idToken,
      access_token: tokens?.accessToken || undefined,
    });

    if (supabaseErr || !data?.session) {
      store.setError('Authentication failed. Please try again.');
      store.setSigningIn(false);
      return;
    }

    await Promise.all([
      secureStorage.saveToken(data.session.access_token),
      data.session.refresh_token
        ? secureStorage.saveRefreshToken(data.session.refresh_token)
        : Promise.resolve(),
    ]);

    const isComplete = await checkProfileComplete(data.user.id);
    const user       = mapUser(data.user, isComplete);
    await secureStorage.saveUser(user);

    // Single store update → useRouteGuard navigates once, correctly
    store.setSession(user, data.session.access_token);

    console.log('[AuthService] ✅ Sign-in:', user.email, '| complete:', isComplete);

  } catch (err: any) {
    const code = err?.code ?? '';
    const cancelled = ['SIGN_IN_CANCELLED', 'SIGN_IN_REQUIRED'].includes(code)
      || err?.message === 'SIGN_IN_CANCELLED';

    store.setSigningIn(false);
    if (!cancelled) store.setError('Sign-in failed. Please try again.');
    console.log('[AuthService] Sign-in error:', code, err?.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGOUT — intent-first, zero flicker, back-nav safe
// ══════════════════════════════════════════════════════════════════════════════

export async function logout(): Promise<void> {
  const store = useAuthStore.getState();
  console.log('[AuthService] 🚪 Logout:', store.user?.email);

  // Step 1: Set intent SYNCHRONOUSLY — _layout reads this on next render
  // This means: even if Supabase SIGNED_OUT fires before we call finalizeSignOut,
  // useAuthBoot ignores it (phase='logging_out'), and we navigate correctly
  store.beginLogout();

  try {
    await Promise.allSettled([
      isGoogleReady() ? GoogleSignin.signOut() : Promise.resolve(),
      supabase.auth.signOut(),
      secureStorage.clearAll(),
    ]);
    console.log('[AuthService] ✅ Logout complete');
  } catch (e: any) {
    console.warn('[AuthService] Logout partial error:', e?.message);
  } finally {
    // Step 2: Finalize — phase='unauthenticated', navIntent='to_login' still set
    // useRouteGuard reads navIntent → navigates to Login (not Onboarding)
    // router.replace() destroys entire stack → back button has nothing to go to
    store.finalizeSignOut();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DELETE ACCOUNT — intent-first, routes to onboarding only
// ══════════════════════════════════════════════════════════════════════════════

export async function deleteAccount(): Promise<void> {
  const store = useAuthStore.getState();
  const user  = store.user;

  if (!user?.id) {
    console.error('[AuthService] Delete: no user');
    return;
  }

  console.log('[AuthService] 🗑️ Delete:', user.email);

  // Step 1: Set intent to onboarding BEFORE anything
  // This guarantees: no matter when SIGNED_OUT fires, we go to onboarding
  store.beginDelete();

  try {
    const { data: { session } } = await supabase.auth.getSession();

    // Backend delete
    const { error: fnErr } = await supabase.functions.invoke('mindmates', {
      body:    { action: 'delete_account', userId: user.id },
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    });

    if (fnErr) console.warn('[AuthService] Backend delete error:', fnErr.message);

    // Local cleanup
    await Promise.allSettled([
      isGoogleReady() ? GoogleSignin.signOut() : Promise.resolve(),
      supabase.auth.signOut(),
      secureStorage.clearAll(),
    ]);

    console.log('[AuthService] ✅ Delete complete');
  } catch (e: any) {
    console.error('[AuthService] Delete error (proceeding anyway):', e?.message);
  } finally {
    // Step 2: Finalize — navIntent='to_onboarding' still set
    // useRouteGuard → router.replace('/(auth)/onBoarding')
    // Entire stack replaced — login screen never shown, back button is dead
    store.finalizeSignOut();
  }
}

// ── Mark profile complete ─────────────────────────────────────────────────────

export function completeProfile(): void {
  useAuthStore.getState().markProfileComplete();
}