export default {
  name: "MindMates",
  slug: "MindMates",
  version: "1.0.0",
  scheme: "mindmates",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/images/icon.png",
  splash: {
    image: "./assets/images/splash-logo.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },

  android: {
    package: "com.mindset.mindmates",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
       backgroundColor: "#ffffff", 
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
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    },
  },
};
