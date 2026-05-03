// app.config.js
// Full Expo SDK 54 configuration for native Google Sign-In.
// @react-native-google-signin requires a dev/production build — NOT Expo Go.

module.exports = {
  expo: {
    name: "Mind-Mates",
    slug: "Mind-Mates",
    version: "1.0.0",
    icon: "./assets/images/splash-logo.png",
    scheme: "mindmates", // Deep link scheme — used for other OAuth flows
    orientation: "portrait",
    userInterfaceStyle: "light",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    // ── Android ──────────────────────────────────────────────────────────────
    android: {
      package: "com.Mindset.mindmates", // ← Change to your package name
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF",
      },
      // Google Sign-In requires Google Services. This plugin injects
      // google-services.json into the Android build automatically.
      googleServicesFile: "./google-services.json",
    },
    splash: {
      image: "./assets/images/splash-logo.png",
      resizeMode: "contain",
      backgroundColor: "#5C32B5",
      dark: {
        backgroundColor: "#000000",
      },
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    sdkVersion: "54.0.0",
    splash: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/splash-logo.png",
        backgroundImage: "./assets/images/splash-logo.png",
        monochromeImage: "./assets/images/splash-logo.png",
      },
    },
    // ── iOS ───────────────────────────────────────────────────────────────────
    ios: {
      bundleIdentifier: "com.Mindset.mindmates", // ← Change to your bundle ID
      supportsTablet: true,
      // GoogleService-Info.plist is injected by the expo-build-properties plugin
      googleServicesFile: "./GoogleService-Info.plist",
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
      "@react-native-google-signin/google-signin",
      "expo-build-properties",
      "expo-router",
      // Injects google-services.json (Android) and GoogleService-Info.plist (iOS)
      [
         "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#6D4AFF",
          "defaultChannel": "messages",
          "sounds": []
        },
       
        {
          android: {
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            buildToolsVersion: "34.0.0",
          },
           "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    },
        },
      ],
    ],

    // ── Extra ─────────────────────────────────────────────────────────────────
    extra: {
      eas: {
        projectId: "d6f6bc93-db51-4bf0-a7e3-e7282540303e",
      },
       "EXPO_PUBLIC_SUPABASE_URL": "...",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY": "..."
    },
  },
};
