import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  signInWithGoogle,
  trySilentSignIn,
  signOut as authSignOut,
  AuthResult,
} from '../services/authServices';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  provider: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState('initializing'); // initializing | authenticated | unauthenticated
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

  // ── Session restore + silent sign-in on mount ──────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    initAuth();

    return () => {
      isMounted.current = false;
    };
  }, []);

  // ── Real-time auth state listener ──────────────────────────────────────────
  // Supabase fires this whenever session changes:
  //   SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted.current) return;

        if (session?.user) {
          setUser(mapUser(session.user));
          setStatus('authenticated');
        } else {
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function initAuth() {
    // 1. Check AsyncStorage for existing Supabase session (synchronous-feel restore)
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      if (isMounted.current) {
        setUser(mapUser(session.user));
        setStatus('authenticated');
      }
      return;
    }

    // 2. No Supabase session — try silent Google sign-in
    // This auto-logs in users who previously authenticated
    const silentSession = await trySilentSignIn();
    if (silentSession?.user && isMounted.current) {
      setUser(mapUser(silentSession.user));
      setStatus('authenticated');
      return;
    }

    // 3. No session anywhere — show login screen
    if (isMounted.current) {
      setStatus('unauthenticated');
    }
  }

  // ── Google Sign-In handler ─────────────────────────────────────────────────
  const handleGoogleSignIn = useCallback(async () => {
    if (isSigningIn) return; // Prevent double-tap

    setIsSigningIn(true);
    setError(null);

    const result = await signInWithGoogle();

    if (!isMounted.current) return;

    switch (result.type) {
      case AuthResult.SUCCESS:
        // onAuthStateChange will handle state update — no need to setUser here
        // This prevents a potential double-set race condition
        break;

      case AuthResult.CANCELLED:
        // User dismissed — silently reset, no error message
        break;

      case AuthResult.IN_PROGRESS:
        // Already signing in — just reset loading state
        break;

      default:
        // Show error for network, Play Services, unknown errors
        if ('message' in result && result.message) {
          setError(result.message as any);
        }
    }

    setIsSigningIn(false);
  }, [isSigningIn]);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    setStatus('initializing');
    await authSignOut();
    // onAuthStateChange fires SIGNED_OUT → sets status to unauthenticated
  }, []);

  return {
    user,
    status,           // 'initializing' | 'authenticated' | 'unauthenticated'
    isSigningIn,      // true while Google picker + Supabase exchange in progress
    error,
    signIn: handleGoogleSignIn,
    signOut: handleSignOut,
    clearError: () => setError(null),
  };
}

// ─── Normalize Supabase user object ───────────────────────────────────────────

function mapUser(supabaseUser: any) {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name ?? null,
    avatar: supabaseUser.user_metadata?.avatar_url ?? supabaseUser.user_metadata?.picture ?? null,
    provider: 'google',
  };
}