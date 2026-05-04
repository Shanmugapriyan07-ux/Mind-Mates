// config/googleAuth.ts
// Called ONCE in _layout.tsx before any render.
// This pre-warms the Google SDK so the account picker opens instantly on tap.
// UNCHANGED from your existing file — just made TypeScript-safe.

import { GoogleSignin } from '@react-native-google-signin/google-signin';

let _isConfigured = false;

export function configureGoogleSignIn(): void {
  if (_isConfigured) return; // Guard: never configure twice

  GoogleSignin.configure({
    // Web client ID from Google Cloud Console (OAuth 2.0 → Web application type)
    // CRITICAL: Must be the WEB client ID, not Android — needed for idToken generation
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,

    // Force account picker every time (Instagram/Tinder behavior)
    // Even if user is already signed in, they see the picker
    forceCodeForRefreshToken: true,

    // Offline access — gets refresh token for server-side validation
    offlineAccess: true,

    // Request only what you need
    scopes: ['profile', 'email'],
  });

  _isConfigured = true;
  console.info('[GoogleAuth] ✅ Configured');
}

export function isGoogleSignInConfigured(): boolean {
  return _isConfigured;
}