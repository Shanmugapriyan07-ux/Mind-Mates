// services/googleAuthService.ts
// Production-grade native Google Sign-In service.
// Integrates with your existing Supabase client (lib/supabase.ts).
// Preserves your 3-stage auth flow exactly — only adds native Google SDK layer.
//
// Stage 1: Not logged in        → Login Screen
// Stage 2: Logged in, no profile → BasicInfo
// Stage 3: Logged in + complete  → Home
//
// ARCHITECTURE:
//   googleAuthService (this file)
//     ↓ calls
//   @react-native-google-signin/google-signin (native SDK — no WebView)
//     ↓ returns idToken
//   supabase.auth.signInWithIdToken() (server-side validation)
//     ↓ creates session
//   your existing AuthContext (authContext.tsx) picks it up via onAuthStateChange

import { supabase } from "@/lib/supabase";
import { log } from "@/utils/logger";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";

// ─── Result Types ─────────────────────────────────────────────────────────────
// Structured results — UI only checks result.success, no try/catch needed there

export type GoogleSignInResult =
  | { success: true; userId: string; email: string | null }
  | { success: false; cancelled: boolean; error: string | null };

// ─── Error classifier ─────────────────────────────────────────────────────────

function classifyError(error: any): {
  cancelled: boolean;
  message: string | null;
} {
  const code = error?.code;

  // User cancelled — completely normal, show no error message
  if (
    code === statusCodes.SIGN_IN_CANCELLED ||
    code === statusCodes.SIGN_IN_REQUIRED
  ) {
    log.auth("Google Sign-In cancelled by user");
    return { cancelled: true, message: null };
  }

  // Already in progress — user double-tapped
  if (code === statusCodes.IN_PROGRESS) {
    log.auth("Google Sign-In already in progress");
    return { cancelled: true, message: null };
  }

  // Play Services missing/outdated (Android only)
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return {
      cancelled: false,
      message:
        "Google Play Services is required. Please update it and try again.",
    };
  }

  // Network error
  const msg = error?.message?.toLowerCase() ?? "";
  if (msg.includes("network") || msg.includes("fetch")) {
    return {
      cancelled: false,
      message: "No internet connection. Please check your connection.",
    };
  }

  // Unknown error
  log.error("Google Sign-In unknown error:", error?.message);
  return {
    cancelled: false,
    message: "Sign-in failed. Please try again.",
  };
}

// ─── Main sign-in function ────────────────────────────────────────────────────

export async function nativeGoogleSignIn(): Promise<GoogleSignInResult> {
  try {
    log.auth("Starting native Google Sign-In...");

    // Step 1: Check Google Play Services (Android only — iOS always passes)
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });

    // Step 2: Show native account picker
    // This is the KEY step — shows native sheet, NOT a WebView or browser
    // On Android: Material Design bottom sheet with device accounts
    // On iOS:     Google Sign-In SDK native sheet
    const result = await GoogleSignin.signIn();
    const idToken = result.idToken;

    if (!idToken) {
      log.error("Google Sign-In returned no idToken");
      return {
        success: false,
        cancelled: false,
        error: "Google did not return an ID token. Please try again.",
      };
    }

    log.auth("Got idToken, exchanging with Supabase...");

    // Step 3: Exchange Google idToken for Supabase session
    // Supabase validates the JWT with Google's public keys server-side
    // This is the secure server-validated step — never trust client-only auth
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      log.error("Supabase token exchange failed:", error.message);
      return {
        success: false,
        cancelled: false,
        error: "Authentication failed. Please try again.",
      };
    }

    log.auth("✅ Google Sign-In success:", data.user?.email);

    // Step 4: Your existing onAuthStateChange in AuthContext fires automatically
    // It sets authStatus = 'authenticated'
    // Then your _layout.tsx routing logic takes over (unchanged)
    return {
      success: true,
      userId: data.user?.id ?? "",
      email: data.user?.email ?? null,
    };
  } catch (error: any) {
    const classified = classifyError(error);
    return {
      success: false,
      cancelled: classified.cancelled,
      error: classified.message,
    };
  }
}

// ─── Silent sign-in ───────────────────────────────────────────────────────────
// Attempts to restore previous Google session without showing any UI.
// Called on app start — gives instant auto-login for returning users.
// If it fails, falls back to Supabase session (which is also checked).

export async function trySilentGoogleSignIn(): Promise<boolean> {
  try {
    const isSignedIn = await GoogleSignin.isSignedIn();
    if (!isSignedIn) {
      log.auth("No previous Google Sign-In found");
      return false;
    }

    log.auth("Found previous Google Sign-In, attempting silent restore...");
    const result = await GoogleSignin.signInSilently();
    const idToken = result.idToken;

    if (!idToken) {
      log.auth("Silent sign-in: no idToken returned");
      return false;
    }

    // Refresh Supabase session with fresh Google token
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      log.auth("Silent sign-in Supabase exchange failed:", error.message);
      return false;
    }

    log.auth("✅ Silent sign-in success");
    return true;
  } catch (error: any) {
    // Silent sign-in failure is completely normal for first-time users
    // or when user has revoked access — fail silently
    log.auth("Silent sign-in failed (non-fatal):", error?.code);
    return false;
  }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
// Clears both Google session AND Supabase session.
// Your existing logout() in AuthContext handles the Supabase part.
// This adds the Google SDK clear on top.

export async function googleSignOut(): Promise<void> {
  try {
    // Clear Google SDK session (prevents silent sign-in with stale credentials)
    await GoogleSignin.signOut();
    log.auth("Google SDK session cleared");
  } catch (error: any) {
    // Non-fatal — Supabase session is already cleared by AuthContext.logout()
    log.auth("Google sign-out failed (non-fatal):", error?.message);
  }
}

// ─── Token refresh ────────────────────────────────────────────────────────────
// Supabase handles token refresh automatically via autoRefreshToken: true.
// This is a manual refresh for edge cases (e.g. long background periods).

export async function refreshGoogleToken(): Promise<boolean> {
  try {
    // Get fresh tokens from Google SDK
    const tokens = await GoogleSignin.getTokens();
    if (!tokens.idToken) return false;

    // Exchange with Supabase
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: tokens.idToken,
    });

    return !error;
  } catch {
    return false;
  }
}
