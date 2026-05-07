import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '../lib/supabase';

// ─── Result types ─────────────────────────────────────────────────────────────

export const AuthResult = {
  SUCCESS: 'success',
  CANCELLED: 'cancelled',       // User dismissed the picker — NOT an error
  IN_PROGRESS: 'in_progress',   // Another sign-in is already running
  PLAY_SERVICES: 'play_services', // Google Play Services missing/outdated
  NETWORK: 'network',           // No internet connection
  INVALID_TOKEN: 'invalid_token', // Token exchange failed
  UNKNOWN: 'unknown',
};

// ─── Core sign-in function ────────────────────────────────────────────────────

export async function signInWithGoogle() {
  try {
    // Step 1: Check Google Play Services (Android only — iOS always passes)
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true, // Prompt user to update if needed
    });

    // Step 2: Show the native Google account picker
    // This is the moment that shows the native sheet — no browser, no WebView.
    // On Android: shows the Material Design account picker bottom sheet
    // On iOS: shows the Google Sign-In SDK native sheet
    const userInfo = await GoogleSignin.signIn();

    // Step 3: Extract idToken
    // The idToken is a signed JWT from Google — use it for server-side auth.
    // NEVER use the user object alone for auth — it's not verified.
    const idToken = userInfo.data?.idToken;

    if (!idToken) {
      return {
        type: AuthResult.INVALID_TOKEN,
        message: 'Google did not return an ID token. Please try again.',
      };
    }

    // Step 4: Exchange Google idToken for a Supabase session
    // Supabase validates the token server-side with Google's public keys.
    // This is the secure server-validated auth step.
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      console.error('[AuthService] Supabase token exchange failed:', error);
      return {
        type: AuthResult.INVALID_TOKEN,
        message: 'Authentication failed. Please try again.',
        error,
      };
    }

    return {
      type: AuthResult.SUCCESS,
      user: data.user,
      session: data.session,
    };

  } catch (error) {
    return classifyGoogleError(error);
  }
}

// ─── Silent sign-in (auto-login on app start) ─────────────────────────────────
// Attempts to restore the previous Google session without showing any UI.
// Call this on app start BEFORE showing the login screen.
// If it succeeds, Supabase already has a valid session from AsyncStorage —
// this just ensures Google's token cache is also refreshed.

export async function trySilentSignIn() {
  try {
    const isSignedIn = await GoogleSignin.hasPreviousSignIn();
    if (!isSignedIn) return null;

    const userInfo = await GoogleSignin.signInSilently();
    const idToken = userInfo.data?.idToken;
    if (!idToken) return null;

    // Refresh Supabase session with fresh Google token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) return null;
    return data.session;
  } catch {
    // Silent sign-in failure is expected when user has never signed in
    // or has revoked access — fail silently, show login screen
    return null;
  }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function signOut() {
  try {
    await Promise.all([
      GoogleSignin.signOut(),       // Clear Google session
      supabase.auth.signOut(),      // Clear Supabase session + AsyncStorage
    ]);
    return { type: AuthResult.SUCCESS };
  } catch (error) {
    console.error('[AuthService] Sign out error:', error);
    // Force clear Supabase even if Google sign-out fails
    await supabase.auth.signOut().catch(() => {});
    return { type: AuthResult.SUCCESS }; // Still treat as success — user is logged out
  }
}

// ─── Get current Supabase session ────────────────────────────────────────────

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ─── Error classifier ─────────────────────────────────────────────────────────

function classifyGoogleError(error) {
  console.warn('[AuthService] Google Sign-In error:', error.code, error.message);

  switch (error.code) {
    case statusCodes.SIGN_IN_CANCELLED:
    case statusCodes.SIGN_IN_REQUIRED:
      // User tapped outside the picker or hit back — completely normal
      return {
        type: AuthResult.CANCELLED,
        message: null, // Don't show any message for cancellation
      };

    case statusCodes.IN_PROGRESS:
      // Sign-in already in progress (e.g. user double-tapped the button)
      return {
        type: AuthResult.IN_PROGRESS,
        message: null, // Loading state is already showing
      };

    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return {
        type: AuthResult.PLAY_SERVICES,
        message: 'Google Play Services is required. Please update it and try again.',
      };

    default:
      if (error.message?.toLowerCase().includes('network')) {
        return {
          type: AuthResult.NETWORK,
          message: 'No internet connection. Please check your connection and try again.',
        };
      }
      return {
        type: AuthResult.UNKNOWN,
        message: 'Something went wrong. Please try again.',
        error,
      };
  }
}