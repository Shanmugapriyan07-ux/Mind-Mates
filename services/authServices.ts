import { isGoogleReady } from '@/config/googleAuth';
import { supabase } from '@/lib/supabase';
import type { AuthUser } from '@/stores/authStore';
import { useAuthStore } from '@/stores/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { notificationService } from './notificationService';

// Keys this module owns in AsyncStorage. Used for targeted removal on
// logout so we never wipe unrelated app data (e.g. onboarding-seen flag).
const AUTH_STORAGE_KEYS = [
  'mm-auth-v4', // zustand persist key from authStore.ts
];

export function mapUser(raw: any, isProfileComplete: boolean): AuthUser {
  return {
    id: raw.id,
    email: raw.email ?? null,
    name: raw.user_metadata?.full_name ?? raw.user_metadata?.name ?? null,
    avatar: raw.user_metadata?.avatar_url ?? null,
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

export async function restoreSession(): Promise<void> {
  const store = useAuthStore.getState();
  if (store.isSigningIn) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const isComplete = await checkProfileComplete(session.user.id);
      const user = mapUser(session.user, isComplete);
      store.setSession(user, session.access_token);
      return;
    }
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
              const user = mapUser(data.user, isComplete);
              store.setSession(user, data.session.access_token);
              return;
            }
          }
        }
      } catch (e: any) {
        console.warn('[AuthService] Silent sign-in failed:', e?.code);
      }
    }
    store.setPhase('unauthenticated');
  } catch (e: any) {
    console.warn('[AuthService] Restore failed:', e?.message);
    store.setPhase('unauthenticated');
  }
}

export async function signInWithGoogle(): Promise<void> {
  const store = useAuthStore.getState();
  if (store.isSigningIn) return;
  store.setSigningIn(true);
  store.setError(null);
  try {
    if (!isGoogleReady()) {
      store.setError('Google Sign-In unavailable. Use a dev client build.');
      store.setSigningIn(false);
      return;
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    try { await GoogleSignin.signOut(); } catch {}
    const signInResult = await GoogleSignin.signIn();
    const tokens = await GoogleSignin.getTokens();
    const idToken = tokens?.idToken ?? (signInResult as any)?.data?.idToken;
    if (!idToken) {
      store.setError('Could not get authentication token. Please try again.');
      store.setSigningIn(false);
      return;
    }
    const { data, error: supabaseErr } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      access_token: tokens?.accessToken || undefined,
    });
    if (supabaseErr || !data?.session) {
      store.setError('Authentication failed. Please try again.');
      store.setSigningIn(false);
      return;
    }
    const isComplete = await checkProfileComplete(data.user.id);
    const user = mapUser(data.user, isComplete);
    store.setSession(user, data.session.access_token);
  } catch (err: any) {
    const code = err?.code ?? '';
    const cancelled = ['SIGN_IN_CANCELLED', 'SIGN_IN_REQUIRED'].includes(code)
      || err?.message === 'SIGN_IN_CANCELLED';
    store.setSigningIn(false);
    if (!cancelled) store.setError('Sign-in failed. Please try again.');
  }
}

export async function logout(): Promise<void> {
  const store = useAuthStore.getState();
  if (store.phase !== 'logging_out') {
    store.beginLogout();
  }

  try {
    await Promise.allSettled([
      isGoogleReady() ? GoogleSignin.signOut() : Promise.resolve(),
      supabase.auth.signOut(),
      AsyncStorage.multiRemove(AUTH_STORAGE_KEYS),
    ]);
  } catch (e: any) {
    console.warn('[AuthService] Logout partial error:', e?.message);
  } finally {
    store.finalizeSignOut();
  }
}

export async function deleteAccount(): Promise<void> {
  const store = useAuthStore.getState();
  const user = store.user;
  if (!user?.id) return;
  if (
    store.phase === 'unauthenticated' ||
    store.phase === 'logging_out'
  ) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const { data, error: fnError } = await supabase.functions.invoke('mindmates', {
      body: { action: 'delete_account', userId: user.id },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (fnError || data?.error) {
      console.warn('[deleteAccount] failed:', fnError?.message ?? data?.error);
      return;
    }

    if (store.phase !== 'deleting') {
      store.beginDelete();
    }

    // Account deletion intentionally clears everything, not just auth keys —
    // a deleted account should leave no local trace, including onboarding
    // state. This is the one place a full wipe is the correct product
    // behavior (unlike logout, which should be narrow).
    await Promise.allSettled([
      notificationService.deleteTokenForUser(user.id).catch(() => {}),
      isGoogleReady() ? GoogleSignin.signOut() : Promise.resolve(),
      supabase.auth.signOut(),
      AsyncStorage.clear(),
    ]);
    store.finalizeSignOut();
  } catch (e: any) {
    console.warn('[deleteAccount] unexpected error:', e?.message);
  }
}

export function completeProfile(): void {
  useAuthStore.getState().markProfileComplete();
}