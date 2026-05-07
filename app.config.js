export default {
  name: "Mind-Mates",
  slug: "Mind-Mates",
  version: "1.0.0",
  scheme: "mindmates",
  orientation: "portrait",
  userInterfaceStyle: "light",

  icon: "./assets/icon.png",

  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },

  android: {
    package: "com.Mindset.mindmates",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    googleServicesFile: "./google-services.json",
  },

  ios: {
    bundleIdentifier: "com.Mindset.mindmates",
    supportsTablet: false,
    googleServicesFile: "./GoogleService-Info.plist",
  },

  plugins: [
    "expo-router",
    "@react-native-google-signin/google-signin",
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: "35.0.0",
        },
      },
    ],
    [
      "expo-notifications",
      {
        color: "#ffffff",
      },
    ],
  ],

  extra: {
    eas: {
      projectId: "d6f6bc93-db51-4bf0-a7e3-e7282540303e",
    },
  },
};
