let _GoogleSignin: any = null;
let _statusCodes: any  = {};
let _isConfigured      = false;
try {
  // This native module is intentionally loaded only outside web.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod    = require('@react-native-google-signin/google-signin');
  _GoogleSignin = mod.GoogleSignin;
  _statusCodes  = mod.statusCodes;
} catch {
  console.warn('[GoogleAuth] Native module unavailable');
}
export const GoogleSignin = _GoogleSignin;
export const statusCodes  = _statusCodes;
export function configureGoogleSignIn(): void {
  if (!_GoogleSignin || _isConfigured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId?.trim()) {
    return;
  }
  try {
    _GoogleSignin.configure({
      webClientId,
      offlineAccess:            true,
      forceCodeForRefreshToken: true,
      scopes:                   ['profile', 'email'],
    });
    _isConfigured = true;
    console.info('[GoogleAuth] ✅ Configured:', webClientId.slice(0, 30) + '...');
  } catch (err: any) {
    console.warn('[GoogleAuth] ❌ Configure failed:', err?.message);
  }
}
export const isGoogleReady  = () => !!_GoogleSignin && _isConfigured;
export const isGoogleLinked = () => !!_GoogleSignin;