// config/googleAuth.js
// Centralized Google Sign-In configuration.
// GoogleSignin.configure() is called ONCE at app startup — not on every button press.
// This is what makes the login feel instant: auth is ready before the user taps anything.

import { GoogleSignin } from '@react-native-google-signin/google-signin';

let _isConfigured = false;

export function configureGoogleSignIn() {
  if (_isConfigured) return; // Guard against double-init

  GoogleSignin.configure({
    // WEB client ID from Google Cloud Console (OAuth 2.0 → Web application type)
    // Required for Supabase/Firebase token exchange — do NOT use Android client ID here
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,

    // iOS only: reversed client ID from GoogleService-Info.plist
    // Format: com.googleusercontent.apps.XXXXXXX-YYYYYYY
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,

    // Request offline access to get a refresh token (needed for server-side validation)
    offlineAccess: true,

    // Force account picker even if user is already signed in
    // This matches Instagram/Tinder behavior — always shows the picker
    forceCodeForRefreshToken: true,

    // Scopes — keep minimal. Only request what you actually use.
    scopes: ['profile', 'email'],
  });

  _isConfigured = true;
  console.info('[GoogleAuth] Configured successfully');
}

export function isGoogleConfigured() {
  return _isConfigured;
}