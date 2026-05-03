// app.config.js
// Full Expo SDK 54 configuration for native Google Sign-In.
// @react-native-google-signin requires a dev/production build — NOT Expo Go.

module.exports = {
  expo: {
    name: 'Mind-Mates',
    slug: 'Mind-Mates',
    version: '1.0.0',
    scheme: 'mindmates',             // Deep link scheme — used for other OAuth flows
    orientation: 'portrait',
    userInterfaceStyle: 'light',

    // ── Android ──────────────────────────────────────────────────────────────
    android: {
      package: 'com.Mindset.mindmates',   // ← Change to your package name
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      // Google Sign-In requires Google Services. This plugin injects
      // google-services.json into the Android build automatically.
      googleServicesFile: './google-services.json',
    },

    // ── iOS ───────────────────────────────────────────────────────────────────
    ios: {
      bundleIdentifier: 'com.Mindset.mindmates',  // ← Change to your bundle ID
      supportsTablet: false,
      // GoogleService-Info.plist is injected by the expo-build-properties plugin
      googleServicesFile: './GoogleService-Info.plist',
      // The reversed client ID is required for iOS Google Sign-In to redirect back
      // Format: com.googleusercontent.apps.XXXXXXXX-YYYYYYY
      // Get this from GoogleService-Info.plist → REVERSED_CLIENT_ID
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              process.env.EXPO_PUBLIC_GOOGLE_REVERSED_CLIENT_ID,
            ],
          },
        ],
      },
    },

    // ── Plugins ───────────────────────────────────────────────────────────────
    plugins: [
      // @react-native-google-signin native module setup
      '@react-native-google-signin/google-signin',

      // Injects google-services.json (Android) and GoogleService-Info.plist (iOS)
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            buildToolsVersion: '34.0.0',
          },
        },
      ],
    ],

    // ── Extra ─────────────────────────────────────────────────────────────────
    extra: {
      eas: {
        projectId: 'd6f6bc93-db51-4bf0-a7e3-e7282540303e',
      },
    }
  },
};