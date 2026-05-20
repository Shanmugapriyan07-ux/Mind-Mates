import { isGoogleReady } from '@/config/googleAuth';
import { supabase } from '@/lib/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleTokens {
  idToken:     string;
  accessToken: string;
}

export type GoogleAuthResult =
  | { success: true;  tokens: GoogleTokens; email: string | null }
  | { success: false; cancelled: boolean;   error: string | null };

// ─── Error classifier ─────────────────────────────────────────────────────────

export function classifyGoogleError(err: any): {
  cancelled: boolean;
  message:   string | null;
} {
  const code = err?.code ?? err?.message ?? '';

  console.log('[GoogleAuth] Error details:', {
    code:    err?.code,
    message: err?.message,
    full:    JSON.stringify(err),
  });

  if (
    code === statusCodes.SIGN_IN_CANCELLED ||
    code === statusCodes.SIGN_IN_REQUIRED  ||
    code === '10' && err?.message === 'SIGN_IN_CANCELLED'
  ) {
    return { cancelled: true, message: null };
  }

  if (code === statusCodes.IN_PROGRESS) {
    return { cancelled: true, message: null };
  }

  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return {
      cancelled: false,
      message:   'Google Play Services needs to be updated.',
    };
  }

  const msg = (err?.message ?? '').toLowerCase();
  if (msg.includes('network') || msg.includes('fetch')) {
    return { cancelled: false, message: 'No internet connection.' };
  }

  return { cancelled: false, message: 'Sign-in failed. Please try again.' };
}

// ─── Core Google Sign-In ──────────────────────────────────────────────────────

export async function performGoogleSignIn(): Promise<GoogleAuthResult> {
  if (!isGoogleReady()) {
    return {
      success:   false,
      cancelled: false,
      error:     'Google Sign-In not configured. Use a dev client build.',
    };
  }

  try {
    // ── Step 1: Play Services check ───────────────────────────────────────────
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
    console.log('[GoogleAuth] Play Services ✅');

    // ── Step 2: Clear any stale session ───────────────────────────────────────
    // This prevents stale token issues and forces fresh account picker
    try {
      await GoogleSignin.signOut();
      console.log('[GoogleAuth] Cleared previous session');
    } catch {
      // Non-fatal — no previous session to clear
    }

    // ── Step 3: Show native account picker ────────────────────────────────────
    console.log('[GoogleAuth] Opening native account picker...');
    const signInResult = await GoogleSignin.signIn();

    console.log('[GoogleAuth] signIn() result:', {
      type:          typeof (signInResult as any),
      hasData:       !!(signInResult as any)?.data,
      hasUser:       !!(signInResult as any)?.data?.user,
      email:         (signInResult as any)?.data?.user?.email,
      hasIdToken:    !!(signInResult as any)?.data?.idToken,
      idTokenLength: (signInResult as any)?.data?.idToken?.length ?? 0,
    });

    // ── Step 4: Get fresh tokens via getTokens() ──────────────────────────────
    // CRITICAL: This is the correct way to get idToken in SDK v11+
    // signIn() may return idToken as null — getTokens() always returns fresh ones
    console.log('[GoogleAuth] Fetching fresh tokens via getTokens()...');
    const tokens = await GoogleSignin.getTokens();

    console.log('[GoogleAuth] getTokens() result:', {
      hasIdToken:        !!tokens?.idToken,
      idTokenLength:     tokens?.idToken?.length ?? 0,
      hasAccessToken:    !!tokens?.accessToken,
      accessTokenLength: tokens?.accessToken?.length ?? 0,
    });

    // ── Step 5: Validate tokens ───────────────────────────────────────────────
    const idToken     = tokens?.idToken;
    const accessToken = tokens?.accessToken;

    if (!idToken) {
      // Last resort: try idToken from signIn result
      const fallbackIdToken = (signInResult as any)?.data?.idToken;

      if (!fallbackIdToken) {
        console.error('[GoogleAuth] ❌ No idToken from signIn() or getTokens()');
        return {
          success:   false,
          cancelled: false,
          error:     'Could not get authentication token. Please try again.',
        };
      }

      console.log('[GoogleAuth] Using fallback idToken from signIn() result');
      return {
        success: true,
        tokens:  {
          idToken:     fallbackIdToken,
          accessToken: accessToken ?? '',
        },
        email: (signInResult as any)?.data?.user?.email ?? null,
      };
    }

    console.log('[GoogleAuth] ✅ Tokens retrieved successfully');
    return {
      success: true,
      tokens:  { idToken, accessToken: accessToken ?? '' },
      email:   (signInResult as any)?.data?.user?.email ?? null,
    };

  } catch (err: any) {
    const classified = classifyGoogleError(err);
    return {
      success:   false,
      cancelled: classified.cancelled,
      error:     classified.message,
    };
  }
}

// ─── Silent sign-in for session restore ──────────────────────────────────────

export async function performSilentSignIn(): Promise<GoogleTokens | null> {
  if (!isGoogleReady()) return null;

  try {
    const currentUser = await GoogleSignin.getCurrentUser();
    if (!currentUser) {
      console.log('[GoogleAuth] No previous sign-in found');
      return null;
    }

    console.log('[GoogleAuth] Attempting silent sign-in...');
    await GoogleSignin.signInSilently();

    // Always use getTokens() after silent sign-in too
    const tokens = await GoogleSignin.getTokens();

    if (!tokens?.idToken) {
      console.warn('[GoogleAuth] Silent sign-in: no idToken from getTokens()');
      return null;
    }

    console.log('[GoogleAuth] ✅ Silent sign-in success');
    return {
      idToken:     tokens.idToken,
      accessToken: tokens.accessToken ?? '',
    };

  } catch (err: any) {
    console.warn('[GoogleAuth] Silent sign-in failed (non-fatal):', err?.code);
    return null;
  }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function performGoogleSignOut(): Promise<void> {
  if (!isGoogleReady()) return;
  try {
    await GoogleSignin.signOut();
    console.log('[GoogleAuth] Signed out ✅');
  } catch (err: any) {
    console.warn('[GoogleAuth] Sign-out failed (non-fatal):', err?.message);
  }
}

// ─── Aliases & Wrappers for AuthContext ───────────────────────────────────────
// These provide the legacy function names expected by authContext.tsx
// while using the robust token logic above and handling Supabase integration.

export async function nativeGoogleSignIn() {
  const result = await performGoogleSignIn();
  if (!result.success) return result;

  const { error } = await supabase.auth.signInWithIdToken({
    provider:     'google',
    token:        result.tokens.idToken,
    access_token: result.tokens.accessToken || undefined,
  });

  if (error) {
    return { success: false, cancelled: false, error: error.message };
  }
  return { success: true, email: result.email };
}

export async function trySilentGoogleSignIn(): Promise<boolean> {
  const tokens = await performSilentSignIn();
  if (!tokens) return false;

  const { error } = await supabase.auth.signInWithIdToken({
    provider:     'google',
    token:        tokens.idToken,
    access_token: tokens.accessToken || undefined,
  });

  if (error) {
    console.warn('[GoogleAuth] Silent sign-in Supabase exchange failed:', error.message);
    return false;
  }
  return true;
}

export async function googleSignOut() {
  return performGoogleSignOut();
}