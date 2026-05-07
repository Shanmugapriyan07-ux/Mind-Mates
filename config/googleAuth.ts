
let GoogleSignin: any = null;
let statusCodes: any = {};

// Only load native module in custom dev client / production builds
// Expo Go will skip this and use a mock instead
try {
  const module = require('@react-native-google-signin/google-signin');
  GoogleSignin = module.GoogleSignin;
  statusCodes  = module.statusCodes;
} catch {
  console.warn('[GoogleAuth] Native module not available — running in Expo Go mock mode');
}

let _isConfigured = false;

export function configureGoogleSignIn(): void {
  if (!GoogleSignin) return; // Silent skip in Expo Go
  if (_isConfigured)  return;

  GoogleSignin.configure({
    webClientId:              process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    forceCodeForRefreshToken: true,
    offlineAccess:            true,
    scopes:                   ['profile', 'email'],
  });

  _isConfigured = true;
  console.info('[GoogleAuth] ✅ Configured');
}

export { GoogleSignin, statusCodes };
export function isNativeGoogleAvailable(): boolean {
  return !!GoogleSignin;
}