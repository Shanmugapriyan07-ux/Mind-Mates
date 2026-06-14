export default {
  name: "MindMates",
  slug: "MindMates",
  version: "1.0.0",
  scheme: "mindmates",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/images/icon.png",

  android: {
    package: "com.mindset.mindmates",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#6D4AFF",
    },
    googleServicesFile: "./google-services.json",
  },

  ios: {
    bundleIdentifier: "com.mindset.mindmates",
    supportsTablet: false,
    googleServicesFile: "./GoogleService-Info.plist",
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    "@react-native-firebase/app",
    "@react-native-firebase/auth",
    "@react-native-google-signin/google-signin",

    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#6D4AFF",
        defaultChannel: "messages",
        androidChannels: [
          {
            name: "messages",
            importance: 4,
            sound: "default",
            vibrate: true,
            showBadge: true,
            lightColor: "#6D4AFF",
          },
          {
            name: "social",
            importance: 3,
            sound: "default",
            vibrate: true,
            showBadge: true,
            lightColor: "#6D4AFF",
          },
          {
            name: "daily",
            importance: 3,
            sound: "default",
            vibrate: false,
            showBadge: false,
            lightColor: "#6D4AFF",
          },
          {
            name: "badge_sync_silent",
            importance: 1,
            sound: null,
            vibrate: false,
            showBadge: true,
          },
        ],
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: "35.0.0",
          packagingOptions: {
            pickFirst: [
              "**/libc++_shared.so",
              "**/libfbjni.so",
              "**/libreactnativejni.so",
            ],
          },
        },
      },
    ],

    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-logo.png",
        backgroundColor: "#6D4AFF",
      },
    ],

    "expo-asset",
    "expo-video",
  ],

  extra: {
    eas: {
      projectId: "05f96db8-13d5-4f92-a49f-974b74fbc249",
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    },
  },
};
