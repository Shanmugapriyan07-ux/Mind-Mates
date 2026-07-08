import { isGoogleReady } from '@/config/googleAuth';
import { supabase } from '@/lib/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
export interface GoogleTokens {
  idToken:     string;
  accessToken: string;
}
export type GoogleAuthResult =
  | { success: true;  tokens: GoogleTokens; email: string | null }
  | { success: false; cancelled: boolean;   error: string | null };
export function classifyGoogleError(err: any): {
  cancelled: boolean;
  message:   string | null;
} {
  const code = err?.code ?? err?.message ?? '';
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
export async function performGoogleSignIn(): Promise<GoogleAuthResult> {
  if (!isGoogleReady()) {
    return {
      success:   false,
      cancelled: false,
      error:     'Google Sign-In not configured. Use a dev client build.',
    };
  }
  try {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
    try {
      await GoogleSignin.signOut();
    } catch {
    }
    const signInResult = await GoogleSignin.signIn();
    console.log('[GoogleAuth] signIn() result:', {
      type:          typeof (signInResult as any),
      hasData:       !!(signInResult as any)?.data,
      hasUser:       !!(signInResult as any)?.data?.user,
      email:         (signInResult as any)?.data?.user?.email,
      hasIdToken:    !!(signInResult as any)?.data?.idToken,
      idTokenLength: (signInResult as any)?.data?.idToken?.length ?? 0,
    });
    const tokens = await GoogleSignin.getTokens();
    const idToken     = tokens?.idToken;
    const accessToken = tokens?.accessToken;
    if (!idToken) {
      const fallbackIdToken = (signInResult as any)?.data?.idToken;
      if (!fallbackIdToken) {
        console.warn('[GoogleAuth] No idToken from signIn() or getTokens()');
        return {
          success:   false,
          cancelled: false,
          error:     'Could not get authentication token. Please try again.',
        };
      }
      return {
        success: true,
        tokens:  {
          idToken:     fallbackIdToken,
          accessToken: accessToken ?? '',
        },
        email: (signInResult as any)?.data?.user?.email ?? null,
      };
    }
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
export async function performSilentSignIn(): Promise<GoogleTokens | null> {
  if (!isGoogleReady()) return null;
  try {
    const currentUser = await GoogleSignin.getCurrentUser();
    if (!currentUser) {
      return null;
    }
    await GoogleSignin.signInSilently();
    const tokens = await GoogleSignin.getTokens();
    if (!tokens?.idToken) {
      console.warn('[GoogleAuth] Silent sign-in: no idToken from getTokens()');
      return null;
    }
    return {
      idToken:     tokens.idToken,
      accessToken: tokens.accessToken ?? '',
    };
  } catch (err: any) {
    console.warn('[GoogleAuth] Silent sign-in failed (non-fatal):', err?.code);
    return null;
  }
}
export async function performGoogleSignOut(): Promise<void> {
  if (!isGoogleReady()) return;
  try {
    await GoogleSignin.signOut();
  } catch (err: any) {
    console.warn('[GoogleAuth] Sign-out failed (non-fatal):', err?.message);
  }
}
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